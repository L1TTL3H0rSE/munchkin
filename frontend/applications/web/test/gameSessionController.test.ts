import {readFileSync} from "node:fs";

import {describe, expect, it, vi} from "vitest";

import type {
  ActionDescriptor,
  CommandPayload,
  CommandResult,
  Invalidation,
  Projection,
} from "@munchkin/contracts";

import {
  GameApiError,
  parseGameProjection,
  safeGameApiMessage,
} from "../app/composables/useGameApi";
import {
  createGameSessionController,
  type GameSessionAPI,
  type GameSessionScheduler,
} from "../app/composables/useGameSessionController";

const baseProjection = parseGameProjection(JSON.parse(readFileSync(new URL(
  "../../../../backend/game/internal/transport/httpapi/testdata/"
    + "interaction-projection-v1.json",
  import.meta.url,
), "utf8")) as unknown);

const action = {type: "end_turn"} satisfies ActionDescriptor;
const passInteraction = baseProjection.interaction?.actions.find(
  (candidate) => candidate.type === "pass",
);
if (!passInteraction) {
  throw new Error("pass interaction action was not parsed");
}

interface StreamHarness {
  gameID: string;
  stopped: ReturnType<typeof vi.fn>;
  invalidate: (event: Invalidation) => void;
  disconnect: (error: GameApiError) => void;
}

class FakeScheduler implements GameSessionScheduler {
  readonly delays: number[] = [];
  private readonly tasks = new Map<number, () => void>();
  private nextID = 1;

  setTimeout(callback: () => void, delayMs: number): unknown {
    const id = this.nextID++;
    this.delays.push(delayMs);
    this.tasks.set(id, callback);
    return id;
  }

  clearTimeout(handle: unknown): void {
    if (typeof handle === "number") {
      this.tasks.delete(handle);
    }
  }

  runNext(): void {
    const next = this.tasks.entries().next().value;
    if (!next) {
      throw new Error("no scheduled task");
    }
    const [id, callback] = next;
    this.tasks.delete(id);
    callback();
  }

  get size(): number {
    return this.tasks.size;
  }
}

function projectionAt(
  version: number,
  gameID = "game-a",
): Projection {
  return {...baseProjection, game_id: gameID, version};
}

function commandResult(projection: Projection): CommandResult {
  return {
    game_id: projection.game_id,
    command_id: "command-result",
    version: projection.version,
    replayed: false,
    projection,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return {promise, resolve, reject};
}

function createAPI(initialProjection = projectionAt(7)) {
  const streams: StreamHarness[] = [];
  const getGame = vi.fn<GameSessionAPI["getGame"]>(
    async () => initialProjection,
  );
  const command = vi.fn<GameSessionAPI["command"]>(
    async () => commandResult(initialProjection),
  );
  const interaction = vi.fn<GameSessionAPI["interaction"]>(
    async () => commandResult(initialProjection),
  );
  const stream = vi.fn<GameSessionAPI["stream"]>(
    (gameID, _credential, onInvalidation, onDisconnect, onConnected) => {
      const stopped = vi.fn();
      streams.push({
        gameID,
        stopped,
        invalidate: onInvalidation,
        disconnect: onDisconnect,
      });
      onConnected?.();
      return stopped;
    },
  );
  const api = {getGame, command, interaction, stream} satisfies GameSessionAPI;
  return {api, getGame, command, interaction, stream, streams};
}

function createHarness(options: {
  api?: ReturnType<typeof createAPI>;
  scheduler?: FakeScheduler;
  random?: () => number;
  maxReconnectAttempts?: number;
  reconnectBackoffMs?: readonly number[];
} = {}) {
  const apiHarness = options.api ?? createAPI();
  const scheduler = options.scheduler ?? new FakeScheduler();
  const credentials = {
    read: vi.fn(() => "credential-secret"),
    clearCurrentGame: vi.fn(),
  };
  const navigateToLobby = vi.fn(async () => {});
  const controller = createGameSessionController({
    api: apiHarness.api,
    credentials,
    navigateToLobby,
    scheduler,
    random: options.random ?? (() => 0.5),
    createCommandID: () => "stable-command-id",
    ...(options.maxReconnectAttempts === undefined
      ? {}
      : {maxReconnectAttempts: options.maxReconnectAttempts}),
    ...(options.reconnectBackoffMs === undefined
      ? {}
      : {reconnectBackoffMs: options.reconnectBackoffMs}),
  });
  return {
    controller,
    scheduler,
    credentials,
    navigateToLobby,
    ...apiHarness,
  };
}

async function flushAsync(): Promise<void> {
  for (let index = 0; index < 8; index++) {
    await Promise.resolve();
  }
}

describe("game session controller", () => {
  it("aborts a late initial load and prevents state mutation after stop", async () => {
    const apiHarness = createAPI();
    let requestSignal: AbortSignal | undefined;
    apiHarness.getGame.mockImplementation(
      async (_gameID, _credential, requestOptions) => {
        requestSignal = requestOptions?.signal;
        return new Promise<Projection>((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      },
    );
    const {controller, stream} = createHarness({api: apiHarness});

    const started = controller.start("game-a");
    controller.stop();
    await started;

    expect(requestSignal?.aborted).toBe(true);
    expect(controller.projection.value).toBeNull();
    expect(controller.loading.value).toBe(false);
    expect(stream).not.toHaveBeenCalled();
  });

  it("aborts the old game request before activating a changed route ID", async () => {
    const apiHarness = createAPI();
    let firstSignal: AbortSignal | undefined;
    apiHarness.getGame
      .mockImplementationOnce(
        async (_gameID, _credential, requestOptions) => {
          firstSignal = requestOptions?.signal;
          return new Promise<Projection>((_resolve, reject) => {
            firstSignal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          });
        },
      )
      .mockResolvedValueOnce(projectionAt(3, "game-b"));
    const harness = createHarness({api: apiHarness});

    const firstStart = harness.controller.start("game-a");
    await flushAsync();
    const secondStart = harness.controller.start("game-b");
    await Promise.all([firstStart, secondStart]);

    expect(firstSignal?.aborted).toBe(true);
    expect(harness.controller.projection.value?.game_id).toBe("game-b");
    expect(harness.streams).toHaveLength(1);
    expect(harness.streams[0]?.gameID).toBe("game-b");
  });

  it("owns one stream across reconnects and ignores retired callbacks", async () => {
    const harness = createHarness();
    await harness.controller.start("game-a");
    const first = harness.streams[0];
    if (!first) {
      throw new Error("initial stream was not created");
    }

    harness.controller.retry();
    await flushAsync();
    const second = harness.streams[1];
    if (!second) {
      throw new Error("replacement stream was not created");
    }

    expect(first.stopped).toHaveBeenCalledOnce();
    expect(harness.streams).toHaveLength(2);
    first.disconnect(new GameApiError(
      "offline",
      safeGameApiMessage("offline"),
    ));
    expect(harness.scheduler.size).toBe(0);
    expect(harness.controller.connectionState.value).toBe("connected");
  });

  it("uses bounded full-jitter backoff and stops at the retry ceiling", async () => {
    const apiHarness = createAPI();
    apiHarness.getGame
      .mockResolvedValueOnce(projectionAt(7))
      .mockRejectedValue(new GameApiError(
        "offline",
        safeGameApiMessage("offline"),
      ));
    const harness = createHarness({
      api: apiHarness,
      random: () => 0.5,
      maxReconnectAttempts: 3,
      reconnectBackoffMs: [1_000, 2_000, 4_000],
    });
    await harness.controller.start("game-a");
    const stream = harness.streams[0];
    if (!stream) {
      throw new Error("initial stream was not created");
    }

    stream.disconnect(new GameApiError(
      "offline",
      safeGameApiMessage("offline"),
    ));
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(harness.scheduler.size).toBe(1);
      harness.scheduler.runNext();
      await flushAsync();
    }

    expect(harness.scheduler.delays).toEqual([500, 1_000, 2_000]);
    expect(harness.scheduler.size).toBe(0);
    expect(harness.controller.connectionState.value).toBe("failed");
    expect(harness.controller.errorMessage.value)
      .toBe("Автоматическое восстановление остановлено. Повторите вручную.");
  });

  it.each([
    [-1, 0],
    [2, 999],
  ])("clamps jitter %s to a safe delay", async (random, expectedDelay) => {
    const harness = createHarness({
      random: () => random,
      reconnectBackoffMs: [1_000],
      maxReconnectAttempts: 1,
    });
    await harness.controller.start("game-a");
    harness.streams[0]?.disconnect(new GameApiError(
      "offline",
      safeGameApiMessage("offline"),
    ));

    expect(harness.scheduler.delays).toEqual([expectedDelay]);
  });

  it("does not let an older refresh overwrite a newer command projection", async () => {
    const apiHarness = createAPI(projectionAt(10));
    const oldRefresh = deferred<Projection>();
    apiHarness.getGame
      .mockResolvedValueOnce(projectionAt(10))
      .mockImplementationOnce(async () => oldRefresh.promise);
    apiHarness.command.mockResolvedValue(commandResult(projectionAt(12)));
    const harness = createHarness({api: apiHarness});
    await harness.controller.start("game-a");

    const refreshing = harness.controller.refresh();
    await flushAsync();
    await harness.controller.submitAction(
      action,
      {} satisfies CommandPayload,
    );
    oldRefresh.resolve(projectionAt(11));
    await refreshing;

    expect(harness.controller.projection.value?.version).toBe(12);
  });

  it("retries one network intent with the same command ID", async () => {
    const apiHarness = createAPI();
    apiHarness.command
      .mockRejectedValueOnce(new GameApiError(
        "offline",
        safeGameApiMessage("offline"),
      ))
      .mockResolvedValueOnce(commandResult(projectionAt(8)));
    const harness = createHarness({api: apiHarness});
    await harness.controller.start("game-a");

    await harness.controller.submitAction(
      action,
      {} satisfies CommandPayload,
    );

    expect(harness.command).toHaveBeenCalledTimes(2);
    const firstOptions = harness.command.mock.calls[0]?.[5];
    const secondOptions = harness.command.mock.calls[1]?.[5];
    expect(firstOptions?.commandID).toBe("stable-command-id");
    expect(secondOptions?.commandID).toBe("stable-command-id");
    expect(harness.controller.projection.value?.version).toBe(8);
  });

  it("retries one interaction intent with the same command ID", async () => {
    const apiHarness = createAPI();
    apiHarness.interaction
      .mockRejectedValueOnce(new GameApiError(
        "offline",
        safeGameApiMessage("offline"),
      ))
      .mockResolvedValueOnce(commandResult(projectionAt(8)));
    const harness = createHarness({api: apiHarness});
    await harness.controller.start("game-a");

    await harness.controller.submitInteraction(passInteraction);

    expect(harness.interaction).toHaveBeenCalledTimes(2);
    const firstOptions = harness.interaction.mock.calls[0]?.[6];
    const secondOptions = harness.interaction.mock.calls[1]?.[6];
    expect(harness.interaction.mock.calls[0]?.slice(2, 6)).toEqual([
      7,
      passInteraction.interaction_id,
      passInteraction.action_id,
      "pass",
    ]);
    expect(firstOptions?.commandID).toBe("stable-command-id");
    expect(secondOptions?.commandID).toBe("stable-command-id");
    expect(harness.controller.projection.value?.version).toBe(8);
    expect(harness.controller.interactionError.value).toBe("");
  });

  it("blocks duplicate interaction clicks while the command is pending", async () => {
    const apiHarness = createAPI();
    const pending = deferred<CommandResult>();
    apiHarness.interaction.mockReturnValueOnce(pending.promise);
    const harness = createHarness({api: apiHarness});
    await harness.controller.start("game-a");

    const first = harness.controller.submitInteraction(passInteraction);
    const second = harness.controller.submitInteraction(passInteraction);
    await flushAsync();

    expect(harness.interaction).toHaveBeenCalledOnce();
    expect(harness.controller.interactionBusy.value).toBe(true);
    pending.resolve(commandResult(projectionAt(8)));
    await Promise.all([first, second]);
    expect(harness.controller.interactionBusy.value).toBe(false);
  });

  it("resyncs a stale interaction without silently replaying it", async () => {
    const apiHarness = createAPI();
    apiHarness.getGame
      .mockResolvedValueOnce(projectionAt(7))
      .mockResolvedValueOnce(projectionAt(8));
    apiHarness.interaction.mockRejectedValue(new GameApiError(
      "stale_version",
      safeGameApiMessage("stale_version"),
    ));
    const harness = createHarness({api: apiHarness});
    await harness.controller.start("game-a");

    await harness.controller.submitInteraction(passInteraction);

    expect(harness.interaction).toHaveBeenCalledOnce();
    expect(harness.getGame).toHaveBeenCalledTimes(2);
    expect(harness.controller.projection.value?.version).toBe(8);
    expect(harness.controller.interactionError.value)
      .toBe(safeGameApiMessage("stale_version"));
  });

  it("resyncs a stale intent without silently replaying it", async () => {
    const apiHarness = createAPI();
    apiHarness.getGame
      .mockResolvedValueOnce(projectionAt(7))
      .mockResolvedValueOnce(projectionAt(8));
    apiHarness.command.mockRejectedValue(new GameApiError(
      "stale_version",
      safeGameApiMessage("stale_version"),
    ));
    const harness = createHarness({api: apiHarness});
    await harness.controller.start("game-a");

    await harness.controller.submitAction(
      action,
      {} satisfies CommandPayload,
    );

    expect(harness.command).toHaveBeenCalledOnce();
    expect(harness.getGame).toHaveBeenCalledTimes(2);
    expect(harness.controller.projection.value?.version).toBe(8);
    expect(harness.controller.errorMessage.value)
      .toBe(safeGameApiMessage("stale_version"));
  });

  it("clears only the current credential on terminal auth", async () => {
    const apiHarness = createAPI();
    apiHarness.getGame.mockRejectedValue(new GameApiError(
      "auth",
      safeGameApiMessage("auth"),
      {cause: new Error("credential-secret")},
    ));
    const harness = createHarness({api: apiHarness});

    await harness.controller.start("game-a");

    expect(harness.credentials.clearCurrentGame)
      .toHaveBeenCalledExactlyOnceWith("game-a");
    expect(harness.navigateToLobby).toHaveBeenCalledOnce();
    expect(harness.scheduler.size).toBe(0);
    expect(harness.stream).not.toHaveBeenCalled();
    expect(harness.controller.errorMessage.value)
      .not.toContain("credential-secret");
  });

  it("does one fresh GET after a protocol stream failure and does not loop", async () => {
    const apiHarness = createAPI();
    apiHarness.getGame
      .mockResolvedValueOnce(projectionAt(7))
      .mockResolvedValueOnce(projectionAt(8));
    const harness = createHarness({api: apiHarness});
    await harness.controller.start("game-a");

    harness.streams[0]?.disconnect(new GameApiError(
      "protocol",
      safeGameApiMessage("protocol"),
    ));
    await flushAsync();

    expect(harness.getGame).toHaveBeenCalledTimes(2);
    expect(harness.controller.projection.value?.version).toBe(8);
    expect(harness.controller.connectionState.value).toBe("failed");
    expect(harness.scheduler.size).toBe(0);
  });

  it("cleans up stream, reconnect timer and in-flight command on stop", async () => {
    const apiHarness = createAPI();
    let commandSignal: AbortSignal | undefined;
    apiHarness.command.mockImplementation(
      async (
        _gameID,
        _credential,
        _name,
        _version,
        _payload,
        commandOptions,
      ) => {
        commandSignal = commandOptions?.signal;
        return new Promise<CommandResult>((_resolve, reject) => {
          commandSignal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      },
    );
    const harness = createHarness({api: apiHarness});
    await harness.controller.start("game-a");
    const stream = harness.streams[0];
    if (!stream) {
      throw new Error("initial stream was not created");
    }
    stream.disconnect(new GameApiError(
      "offline",
      safeGameApiMessage("offline"),
    ));
    const command = harness.controller.submitAction(
      action,
      {} satisfies CommandPayload,
    );

    harness.controller.stop();
    await command;

    expect(stream.stopped).toHaveBeenCalledOnce();
    expect(harness.scheduler.size).toBe(0);
    expect(commandSignal?.aborted).toBe(true);
    expect(harness.controller.actionBusy.value).toBe(false);
  });
});
