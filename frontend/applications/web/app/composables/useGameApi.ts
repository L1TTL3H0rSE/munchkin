import {ZodError} from "zod";

import {
  apiErrorSchema,
  commandResultSchema,
  combatHelpRequestSchema,
  combatResolutionRequestSchema,
  economyOfferRequestSchema,
  charityRequestSchema,
  theftRequestSchema,
  interactionCommandRequestSchema,
  invalidationSchema,
  lobbyResultSchema,
  lobbySummarySchema,
  projectionSchema,
  commandPayloadSchema,
  type ActionDescriptor,
  type ActionType,
  type ServerActionDescriptor,
  type CommandResult,
  type CommandPayload,
  type Invalidation,
  type InteractionIntent,
  type CharityAllocation,
  type LobbyResult,
  type Projection,
} from "@munchkin/contracts";

export type GameApiErrorKind =
  | "aborted"
  | "auth"
  | "validation"
  | "conflict"
  | "stale_version"
  | "not_found"
  | "offline"
  | "transient"
  | "protocol"
  | "unexpected";

export class GameApiError extends Error {
  readonly kind: GameApiErrorKind;
  readonly status?: number;

  constructor(
    kind: GameApiErrorKind,
    message: string,
    options: {cause?: unknown; status?: number} = {},
  ) {
    super(message, options.cause === undefined ? undefined : {
      cause: options.cause,
    });
    this.name = "GameApiError";
    this.kind = kind;
    if (options.status !== undefined) {
      this.status = options.status;
    }
  }
}

export interface GameRequestOptions {
  signal?: AbortSignal;
}

export interface GameCommandOptions extends GameRequestOptions {
  commandID?: string;
}

const unsupportedActionTypes = new Set<ActionType>([
  "propose_trade",
  "propose_gift",
  "attempt_theft",
]);

export function useGameApi() {
  const config = useRuntimeConfig();
  const baseURL = String(config.public.apiBase).replace(/\/$/, "");

  async function createLobby(displayName: string) {
    return requestGameplay(
      () => $fetch(`${baseURL}/api/v1/lobbies`, {
        method: "POST",
        body: {display_name: displayName},
      }),
      clientLobbyResult,
    );
  }

  async function getLobby(gameID: string) {
    return requestGameplay(
      () => $fetch(
        `${baseURL}/api/v1/lobbies/${encodeURIComponent(gameID)}`,
      ),
      (response) => lobbySummarySchema.parse(response),
    );
  }

  async function joinLobby(gameID: string, displayName: string, expectedVersion: number) {
    const credential = randomCredential();
    const commandID = crypto.randomUUID();
    const request = () => requestGameplay(
      () => $fetch(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/players`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": commandID,
          },
          body: {
            display_name: displayName,
            expected_version: expectedVersion,
          },
        },
      ),
      clientLobbyResult,
    );
    try {
      return await request();
    } catch (error) {
      const normalized = normalizeGameApiError(error);
      if (
        normalized.kind !== "offline" &&
        normalized.kind !== "transient"
      ) {
        throw error;
      }
      return request();
    }
  }

  async function getGame(
    gameID: string,
    credential: string,
    options: GameRequestOptions = {},
  ) {
    return requestGameplay(
      () => $fetch(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}`,
        {
          headers: authorization(credential),
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientProjection,
    );
  }

  async function command(
    gameID: string,
    credential: string,
    name: ActionType,
    expectedVersion: number,
    payload: CommandPayload = {},
    options: GameCommandOptions = {},
  ) {
    const pathName = name.replaceAll("_", "-");
    const path = name === "start" ? "start" : `commands/${pathName}`;
    const commandID = options.commandID ?? crypto.randomUUID();
    const parsedPayload = parseClientRequest(
      () => commandPayloadSchema.parse(payload),
    );
    return requestGameplay(
      () => $fetch(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/${path}`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": commandID,
          },
          body: {
            expected_version: expectedVersion,
            ...parsedPayload,
          },
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientCommandResult,
    );
  }

  async function interaction(
    gameID: string,
    credential: string,
    expectedVersion: number,
    interactionID: string,
    actionID: string,
    intent: InteractionIntent,
    options: GameCommandOptions = {},
  ) {
    const request = parseClientRequest(
      () => interactionCommandRequestSchema.parse({
        expected_version: expectedVersion,
        interaction_id: interactionID,
        action_id: actionID,
        intent,
      }),
    );
    const path = intent === "pass"
      ? "pass-interaction"
      : "respond-interaction";
    const commandID = options.commandID ?? crypto.randomUUID();
    return requestGameplay(
      () => $fetch(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/${path}`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": commandID,
          },
          body: request,
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientCommandResult,
    );
  }

  async function requestCombatResolution(
    gameID: string,
    credential: string,
    expectedVersion: number,
  ) {
    const request = parseClientRequest(
      () => combatResolutionRequestSchema.parse({
        expected_version: expectedVersion,
      }),
    );
    return requestGameplay(
      () => $fetch(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/request-combat-resolution`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: request,
        },
      ),
      clientCommandResult,
    );
  }

  async function combatHelp(
    gameID: string,
    credential: string,
    expectedVersion: number,
    actionID: string,
    options: GameCommandOptions = {},
  ) {
    const request = parseClientRequest(
      () => combatHelpRequestSchema.parse({
        expected_version: expectedVersion,
        action_id: actionID,
      }),
    );
    const commandID = options.commandID ?? crypto.randomUUID();
    return requestGameplay(
      () => $fetch(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/combat-help`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": commandID,
          },
          body: request,
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientCommandResult,
    );
  }

  async function economyOffer(
    gameID: string,
    credential: string,
    expectedVersion: number,
    kind: "trade" | "gift",
    recipientPlayerID: string,
    offeredInstanceIDs: string[],
    requestedInstanceIDs: string[] = [],
  ) {
    const request = parseClientRequest(
      () => economyOfferRequestSchema.parse({
        expected_version: expectedVersion,
        recipient_player_id: recipientPlayerID,
        offered_instance_ids: offeredInstanceIDs,
        ...(kind === "trade"
          ? {requested_instance_ids: requestedInstanceIDs}
          : {}),
      }),
    );
    return requestGameplay(
      () => $fetch(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/propose-${kind}`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: request,
        },
      ),
      clientCommandResult,
    );
  }

  async function resolveCharity(
    gameID: string,
    credential: string,
    expectedVersion: number,
    allocations: CharityAllocation[] = [],
  ) {
    const request = parseClientRequest(
      () => charityRequestSchema.parse({
        expected_version: expectedVersion,
        ...(allocations.length > 0 ? {allocations} : {}),
      }),
    );
    return requestGameplay(
      () => $fetch(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/resolve-charity`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: request,
        },
      ),
      clientCommandResult,
    );
  }

  async function attemptTheft(
    gameID: string,
    credential: string,
    expectedVersion: number,
    sourceInstanceID: string,
    abilityIndex: number,
    costInstanceID: string,
    victimPlayerID: string,
  ) {
    const request = parseClientRequest(
      () => theftRequestSchema.parse({
        expected_version: expectedVersion,
        source_instance_id: sourceInstanceID,
        ability_index: abilityIndex,
        cost_instance_ids: [costInstanceID],
        victim_player_id: victimPlayerID,
      }),
    );
    return requestGameplay(
      () => $fetch(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/attempt-theft`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: request,
        },
      ),
      clientCommandResult,
    );
  }

  async function deathLoot(
    gameID: string,
    credential: string,
    expectedVersion: number,
    interactionID: string,
    actionID: string,
    intent: "respond" | "pass",
  ) {
    return interaction(
      gameID,
      credential,
      expectedVersion,
      interactionID,
      actionID,
      intent,
    );
  }

  function stream(
    gameID: string,
    credential: string,
    onInvalidation: (event: Invalidation) => void,
    onDisconnect: (error: GameApiError) => void,
    onConnected?: () => void,
  ) {
    const controller = new AbortController();
    void consumeStream(
      `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/events`,
      credential,
      controller.signal,
      onInvalidation,
      onConnected,
    ).catch((error) => {
      if (!controller.signal.aborted) {
        onDisconnect(normalizeGameApiError(error));
      }
    });
    return () => controller.abort();
  }

  function contentAssetURL(setID: string, image: string) {
    return buildContentAssetURL(baseURL, setID, image);
  }

  return {
    createLobby,
    getLobby,
    joinLobby,
    getGame,
    command,
    interaction,
    requestCombatResolution,
    combatHelp,
    economyOffer,
    resolveCharity,
    attemptTheft,
    deathLoot,
    stream,
    contentAssetURL,
  };
}

function clientLobbyResult(response: unknown): LobbyResult {
  const parsed = lobbyResultSchema.parse(response);
  return {
    ...parsed,
    projection: clientProjection(parsed.projection),
  };
}

function clientCommandResult(response: unknown): CommandResult {
  const parsed = commandResultSchema.parse(response);
  return {
    ...parsed,
    projection: clientProjection(parsed.projection),
  };
}

function clientProjection(response: unknown): Projection {
  const parsed = projectionSchema.parse(response);
  return {
    ...parsed,
    turn: {
      ...parsed.turn,
      available_actions: parsed.turn.available_actions.map((action) => {
        if (!isSupportedAction(action)) {
          throw new GameApiError(
            "protocol",
            safeGameApiMessage("protocol"),
          );
        }
        return action;
      }),
    },
  };
}

function isSupportedAction(
  action: ServerActionDescriptor,
): action is ActionDescriptor {
  return !unsupportedActionTypes.has(action.type);
}

export function parseGameProjection(response: unknown): Projection {
  try {
    return clientProjection(response);
  } catch (error) {
    throw normalizeGameApiError(error);
  }
}

export function buildContentAssetURL(
  baseURL: string,
  setID: string,
  image: string,
) {
  const relativePath = image.startsWith("assets/")
    ? image.slice("assets/".length)
    : image;
  const safePath = relativePath.split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${baseURL.replace(/\/$/, "")}/api/v1/content/${encodeURIComponent(setID)}/assets/${safePath}`;
}

export function createVersionedResync(options: {
  getVersion: () => number | undefined;
  refresh: () => Promise<void>;
  maxDrainPasses?: number;
}) {
  let pendingVersion: number | undefined;
  let requestedRefreshGeneration = 0;
  let completedRefreshGeneration = 0;
  let inFlight: Promise<void> | undefined;

  async function drain() {
    let passes = 0;
    for (;;) {
      passes++;
      const targetGeneration = requestedRefreshGeneration;
      await options.refresh();
      completedRefreshGeneration = Math.max(
        completedRefreshGeneration,
        targetGeneration,
      );
      const currentVersion = options.getVersion();
      const versionSatisfied = pendingVersion === undefined ||
        (currentVersion !== undefined && currentVersion >= pendingVersion);
      if (
        versionSatisfied &&
        completedRefreshGeneration >= requestedRefreshGeneration
      ) {
        return;
      }
      if (passes >= (options.maxDrainPasses ?? 3)) {
        throw new GameApiError(
          "transient",
          safeGameApiMessage("transient"),
        );
      }
    }
  }

  function request(requiredVersion?: number) {
    if (requiredVersion === undefined) {
      requestedRefreshGeneration++;
    } else {
      pendingVersion = Math.max(pendingVersion ?? requiredVersion, requiredVersion);
    }
    if (!inFlight) {
      inFlight = drain().finally(() => {
        inFlight = undefined;
      });
    }
    return inFlight;
  }

  return {request};
}

async function consumeStream(
  url: string,
  credential: string,
  signal: AbortSignal,
  onInvalidation: (event: Invalidation) => void,
  onConnected?: () => void,
) {
  const response = await fetch(url, {
    headers: authorization(credential),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new GameTransportError(response.status);
  }
  onConnected?.();
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", {fatal: true});
  let buffer = "";
  for (;;) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    try {
      buffer += decoder.decode(value, {stream: true});
    } catch (error) {
      throw new GameApiError(
        "protocol",
        safeGameApiMessage("protocol"),
        {cause: error},
      );
    }
    for (;;) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary < 0) {
        break;
      }
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame.split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6);
      if (!data) {
        continue;
      }
      let event: Invalidation;
      try {
        const payload: unknown = JSON.parse(data);
        event = invalidationSchema.parse(payload);
      } catch (error) {
        throw new GameApiError(
          "protocol",
          safeGameApiMessage("protocol"),
          {cause: error},
        );
      }
      onInvalidation(event);
    }
  }
  try {
    decoder.decode();
  } catch (error) {
    throw new GameApiError(
      "protocol",
      safeGameApiMessage("protocol"),
      {cause: error},
    );
  }
  throw new GameApiError(
    "offline",
    safeGameApiMessage("offline"),
  );
}

function authorization(credential: string) {
  return {Authorization: `Bearer ${credential}`};
}

function randomCredential() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function isMyTurn(projection: Projection) {
  return projection.status === "active" && projection.turn.player_id === projection.you.player_id;
}

async function requestGameplay<T>(
  request: () => Promise<unknown>,
  parse: (response: unknown) => T,
): Promise<T> {
  try {
    return parse(await request());
  } catch (error) {
    throw normalizeGameApiError(error);
  }
}

function parseClientRequest<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new GameApiError(
      "validation",
      safeGameApiMessage("validation"),
      {cause: error},
    );
  }
}

class GameTransportError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("game transport response failed");
    this.name = "GameTransportError";
    this.status = status;
  }
}

export function normalizeGameApiError(error: unknown): GameApiError {
  if (error instanceof GameApiError) {
    return error;
  }
  if (isAbortFailure(error)) {
    return new GameApiError(
      "aborted",
      safeGameApiMessage("aborted"),
      {cause: error},
    );
  }
  if (error instanceof ZodError) {
    return new GameApiError(
      "protocol",
      safeGameApiMessage("protocol"),
      {cause: error},
    );
  }

  const response = readRecord(error, "response");
  const status = readNumber(response, "status")
    ?? (error instanceof GameTransportError ? error.status : undefined);
  const payload = response
    ? (response._data ?? response.data)
    : undefined;
  const parsedPayload = apiErrorSchema.safeParse(payload);
  const code = parsedPayload.success
    ? parsedPayload.data.code.toLowerCase()
    : "";
  const kind = classifyGameApiError(status, code, error);
  return new GameApiError(
    kind,
    safeGameApiMessage(kind),
    {
      cause: error,
      ...(status === undefined ? {} : {status}),
    },
  );
}

function classifyGameApiError(
  status: number | undefined,
  code: string,
  error: unknown,
): GameApiErrorKind {
  if (
    status === 401 ||
    status === 403 ||
    code === "forbidden" ||
    code === "unauthorized"
  ) {
    return "auth";
  }
  if (status === 404 || code === "not_found") {
    return "not_found";
  }
  if (
    code === "version_conflict" ||
    code === "interaction_expired" ||
    code === "interaction_closed"
  ) {
    return "stale_version";
  }
  if (status === 409 || code === "idempotency_key_reused") {
    return "conflict";
  }
  if (
    status === 400 ||
    status === 422 ||
    code === "invalid_request" ||
    code === "rule_violation" ||
    code === "illegal_interaction_action"
  ) {
    return "validation";
  }
  if (status !== undefined && status >= 500) {
    return "transient";
  }
  if (status === undefined && error instanceof TypeError) {
    return "offline";
  }
  if (status === undefined && isRecord(error)) {
    const name = error.name;
    if (name === "FetchError" || name === "NetworkError") {
      return "offline";
    }
  }
  return "unexpected";
}

export function safeGameApiMessage(kind: GameApiErrorKind): string {
  switch (kind) {
    case "aborted":
      return "Запрос отменён.";
    case "auth":
      return "Сессия игры истекла. Вернитесь в лобби.";
    case "validation":
      return "Действие сейчас недоступно.";
    case "conflict":
      return "Действие конфликтует с уже обработанным запросом.";
    case "stale_version":
      return "Состояние игры изменилось. Обновите его и повторите действие.";
    case "not_found":
      return "Игра не найдена.";
    case "offline":
      return "Нет связи с сервером игры.";
    case "transient":
      return "Сервер игры временно недоступен.";
    case "protocol":
      return "Получен несовместимый ответ сервера.";
    case "unexpected":
      return "Не удалось выполнить запрос к игре.";
  }
}

function isAbortFailure(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}

function readRecord(
  value: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

function readNumber(
  value: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const candidate = value?.[key];
  return typeof candidate === "number" ? candidate : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
