import {
  computed,
  onMounted,
  onBeforeUnmount,
  readonly,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import type {
  ActionDescriptor,
  CommandPayload,
  CommandResult,
  CharityAllocation,
  InteractionView,
  InteractionIntent,
  Invalidation,
  Projection,
} from "@munchkin/contracts";

import type {EconomySubmission} from "../components/interaction/economyModel";

import {
  GameApiError,
  createVersionedResync,
  normalizeGameApiError,
  safeGameApiMessage,
  type GameApiErrorKind,
  type GameCommandOptions,
  type GameRequestOptions,
} from "./useGameApi";

type InteractionActionView = InteractionView["actions"][number];

export type GameConnectionState =
  | "connecting"
  | "connected"
  | "resyncing"
  | "offline"
  | "failed";

export interface GameSessionAPI {
  getGame: (
    gameID: string,
    credential: string,
    options?: GameRequestOptions,
  ) => Promise<Projection>;
  command: (
    gameID: string,
    credential: string,
    name: ActionDescriptor["type"],
    expectedVersion: number,
    payload?: CommandPayload,
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  requestCombatResolution: (
    gameID: string,
    credential: string,
    expectedVersion: number,
  ) => Promise<CommandResult>;
  interaction: (
    gameID: string,
    credential: string,
    expectedVersion: number,
    interactionID: string,
    actionID: string,
    intent: InteractionIntent,
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  combatHelp: (
    gameID: string,
    credential: string,
    expectedVersion: number,
    actionID: string,
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  economyOffer: (
    gameID: string,
    credential: string,
    expectedVersion: number,
    kind: "trade" | "gift",
    recipientPlayerID: string,
    offeredInstanceIDs: string[],
    requestedInstanceIDs?: string[],
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  resolveCharity: (
    gameID: string,
    credential: string,
    expectedVersion: number,
    allocations?: CharityAllocation[],
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  attemptTheft: (
    gameID: string,
    credential: string,
    expectedVersion: number,
    sourceInstanceID: string,
    abilityIndex: number,
    costInstanceID: string,
    victimPlayerID: string,
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  stream: (
    gameID: string,
    credential: string,
    onInvalidation: (event: Invalidation) => void,
    onDisconnect: (error: GameApiError) => void,
    onConnected?: () => void,
  ) => () => void;
}

export interface GameCredentialAdapter {
  read: (gameID: string) => string | null;
  clearCurrentGame: (gameID: string) => void;
}

export interface GameSessionScheduler {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface GameSessionControllerOptions {
  api: GameSessionAPI;
  credentials: GameCredentialAdapter;
  navigateToLobby: () => void | Promise<void>;
  scheduler?: GameSessionScheduler;
  random?: () => number;
  createCommandID?: () => string;
  reconnectBackoffMs?: readonly number[];
  maxReconnectAttempts?: number;
  onDiagnostic?: (error: GameApiError) => void;
}

export interface UseGameSessionControllerOptions
  extends GameSessionControllerOptions {
  gameID: MaybeRefOrGetter<string>;
}

const defaultBackoffMs = [1_000, 2_000, 4_000, 8_000, 15_000] as const;

const defaultScheduler: GameSessionScheduler = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(
    handle as ReturnType<typeof setTimeout>,
  ),
};

export function createGameSessionController(
  options: GameSessionControllerOptions,
) {
  const scheduler = options.scheduler ?? defaultScheduler;
  const random = options.random ?? Math.random;
  const createCommandID = options.createCommandID
    ?? (() => crypto.randomUUID());
  const reconnectBackoffMs = options.reconnectBackoffMs ?? defaultBackoffMs;
  const maxReconnectAttempts = options.maxReconnectAttempts
    ?? reconnectBackoffMs.length;

  const projectionState = shallowRef<Projection | null>(null);
  const loadingState = ref(true);
  const actionBusyState = ref(false);
  const interactionBusyState = ref(false);
  const errorMessageState = ref("");
  const errorKindState = ref<GameApiErrorKind | null>(null);
  const interactionErrorState = ref("");
  const connectionState = ref<GameConnectionState>("connecting");

  let currentGameID = "";
  let currentCredential: string | null = null;
  let lifecycle = 0;
  let isStopped = false;
  let reconnectAttempts = 0;
  let reconnectTimer: unknown;
  let stopStream: (() => void) | undefined;
  let streamOwner = 0;
  let pendingCommand:
    | {commandID: string; lifecycle: number}
    | undefined;
  let pendingInteraction:
    | {
        commandID: string;
        lifecycle: number;
        interactionID: string;
        actionID: string;
      }
    | undefined;
  const requestControllers = new Set<AbortController>();
  let resyncController = createSessionResync(lifecycle);

  function isCurrent(owner: number): boolean {
    return !isStopped && lifecycle === owner;
  }

  function clearConnectionError(): void {
    errorMessageState.value = "";
    errorKindState.value = null;
  }

  function setConnectionError(error: GameApiError): void {
    errorMessageState.value = error.message;
    errorKindState.value = error.kind;
  }

  function createSessionResync(owner: number) {
    return createVersionedResync({
      getVersion: () => projectionState.value?.version,
      refresh: () => refreshProjection(owner),
    });
  }

  async function withRequest<T>(
    owner: number,
    request: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (!isCurrent(owner)) {
      throw new GameApiError("aborted", safeGameApiMessage("aborted"));
    }
    const controller = new AbortController();
    requestControllers.add(controller);
    try {
      return await request(controller.signal);
    } finally {
      requestControllers.delete(controller);
    }
  }

  async function refreshProjection(owner: number): Promise<void> {
    const gameID = currentGameID;
    const credential = currentCredential;
    if (!credential || !isCurrent(owner)) {
      throw new GameApiError("auth", safeGameApiMessage("auth"));
    }
    const next = await withRequest(
      owner,
      (signal) => options.api.getGame(gameID, credential, {signal}),
    );
    if (!isCurrent(owner)) {
      return;
    }
    if (next.game_id !== gameID) {
      throw new GameApiError(
        "protocol",
        safeGameApiMessage("protocol"),
      );
    }
    const current = projectionState.value;
    if (!current || next.version >= current.version) {
      projectionState.value = next;
    }
  }

  async function start(gameID: string): Promise<void> {
    closeCurrentSession();
    lifecycle++;
    const owner = lifecycle;
    isStopped = false;
    currentGameID = gameID;
    projectionState.value = null;
    loadingState.value = true;
    actionBusyState.value = false;
    interactionBusyState.value = false;
    clearConnectionError();
    interactionErrorState.value = "";
    connectionState.value = "connecting";
    reconnectAttempts = 0;
    resyncController = createSessionResync(owner);

    try {
      currentCredential = options.credentials.read(gameID);
    } catch (error) {
      currentCredential = null;
      finishInitialFailure(normalizeGameApiError(error), owner);
      return;
    }
    if (!currentCredential) {
      finishTerminalAuth(owner);
      return;
    }

    try {
      await refreshProjection(owner);
      if (!isCurrent(owner)) {
        return;
      }
      loadingState.value = false;
      connect(owner);
    } catch (error) {
      if (!isCurrent(owner)) {
        return;
      }
      finishInitialFailure(normalizeGameApiError(error), owner);
    }
  }

  function connect(owner: number): void {
    if (!isCurrent(owner) || !currentCredential) {
      return;
    }
    stopActiveStream();
    connectionState.value = "connecting";
    const ownedStream = ++streamOwner;
    try {
      stopStream = options.api.stream(
        currentGameID,
        currentCredential,
        (event) => handleInvalidation(event, owner, ownedStream),
        (error) => handleDisconnect(error, owner, ownedStream),
        () => {
          if (isCurrentStream(owner, ownedStream)) {
            connectionState.value = "connected";
          }
        },
      );
    } catch (error) {
      handleDisconnect(
        normalizeGameApiError(error),
        owner,
        ownedStream,
      );
    }
  }

  function isCurrentStream(owner: number, ownedStream: number): boolean {
    return isCurrent(owner) && streamOwner === ownedStream;
  }

  function handleInvalidation(
    event: Invalidation,
    owner: number,
    ownedStream: number,
  ): void {
    if (!isCurrentStream(owner, ownedStream)) {
      return;
    }
    if (event.game_id !== currentGameID) {
      void recoverFromProtocol(
        new GameApiError("protocol", safeGameApiMessage("protocol")),
        owner,
      );
      return;
    }

    reconnectAttempts = 0;
    const currentVersion = projectionState.value?.version;
    if (currentVersion !== undefined && event.version <= currentVersion) {
      connectionState.value = "connected";
      return;
    }
    connectionState.value = "resyncing";
    void resyncController.request(event.version)
      .then(() => {
        if (isCurrentStream(owner, ownedStream)) {
          connectionState.value = "connected";
        }
      })
      .catch((error: unknown) => {
        handleDisconnect(
          normalizeGameApiError(error),
          owner,
          ownedStream,
        );
      });
  }

  function handleDisconnect(
    error: GameApiError,
    owner: number,
    ownedStream: number,
  ): void {
    if (!isCurrentStream(owner, ownedStream)) {
      return;
    }
    stopActiveStream();
    reportDiagnostic(error);
    switch (error.kind) {
      case "aborted":
        return;
      case "auth":
        finishTerminalAuth(owner);
        return;
      case "protocol":
        void recoverFromProtocol(error, owner);
        return;
      case "offline":
      case "transient":
        setConnectionError(error);
        scheduleRecovery(owner);
        return;
      case "not_found":
      case "validation":
      case "conflict":
      case "stale_version":
      case "unexpected":
        finishTerminalFailure(error, owner);
    }
  }

  async function recoverFromProtocol(
    error: GameApiError,
    owner: number,
  ): Promise<void> {
    if (!isCurrent(owner)) {
      return;
    }
    stopActiveStream();
    connectionState.value = "resyncing";
    try {
      await resyncController.request();
    } catch (refreshError) {
      if (!isCurrent(owner)) {
        return;
      }
      const normalized = normalizeGameApiError(refreshError);
      reportDiagnostic(normalized);
      if (normalized.kind === "auth") {
        finishTerminalAuth(owner);
        return;
      }
    }
    if (!isCurrent(owner)) {
      return;
    }
    setConnectionError(error);
    connectionState.value = "failed";
  }

  function scheduleRecovery(owner: number): void {
    if (!isCurrent(owner) || reconnectTimer !== undefined) {
      return;
    }
    stopActiveStream();
    loadingState.value = false;
    if (reconnectAttempts >= maxReconnectAttempts) {
      connectionState.value = "failed";
      errorMessageState.value =
        "Автоматическое восстановление остановлено. Повторите вручную.";
      errorKindState.value = "transient";
      return;
    }

    connectionState.value = "offline";
    const backoffIndex = Math.min(
      reconnectAttempts,
      reconnectBackoffMs.length - 1,
    );
    const backoff = reconnectBackoffMs[backoffIndex] ?? 0;
    const jitter = Math.max(0, Math.min(random(), 0.999_999_999));
    const delayMs = Math.floor(backoff * jitter);
    reconnectAttempts++;
    reconnectTimer = scheduler.setTimeout(() => {
      reconnectTimer = undefined;
      void recoverConnection(owner);
    }, delayMs);
  }

  async function recoverConnection(owner: number): Promise<void> {
    if (!isCurrent(owner)) {
      return;
    }
    connectionState.value = "resyncing";
    try {
      await resyncController.request();
      if (!isCurrent(owner)) {
        return;
      }
      clearConnectionError();
      connect(owner);
    } catch (error) {
      if (!isCurrent(owner)) {
        return;
      }
      const normalized = normalizeGameApiError(error);
      reportDiagnostic(normalized);
      if (normalized.kind === "auth") {
        finishTerminalAuth(owner);
      } else if (
        normalized.kind === "offline" ||
        normalized.kind === "transient"
      ) {
        setConnectionError(normalized);
        scheduleRecovery(owner);
      } else {
        finishTerminalFailure(normalized, owner);
      }
    }
  }

  async function refresh(): Promise<void> {
    const owner = lifecycle;
    if (!isCurrent(owner)) {
      return;
    }
    connectionState.value = "resyncing";
    try {
      await resyncController.request();
      if (isCurrent(owner)) {
        clearConnectionError();
        if (stopStream) {
          connectionState.value = "connected";
        } else {
          connect(owner);
        }
      }
    } catch (error) {
      if (!isCurrent(owner)) {
        return;
      }
      const normalized = normalizeGameApiError(error);
      reportDiagnostic(normalized);
      if (normalized.kind === "auth") {
        finishTerminalAuth(owner);
      } else if (
        normalized.kind === "offline" ||
        normalized.kind === "transient"
      ) {
        setConnectionError(normalized);
        scheduleRecovery(owner);
      } else {
        finishTerminalFailure(normalized, owner);
      }
    }
  }

  function retry(): void {
    const owner = lifecycle;
    if (!isCurrent(owner)) {
      return;
    }
    clearReconnectTimer();
    reconnectAttempts = 0;
    clearConnectionError();
    void recoverConnection(owner);
  }

  async function submitAction(
    action: ActionDescriptor,
    payload: CommandPayload,
  ): Promise<void> {
    const owner = lifecycle;
    const current = projectionState.value;
    const credential = currentCredential;
    if (
      !isCurrent(owner) ||
      !current ||
      !credential ||
      pendingCommand
    ) {
      return;
    }

    const commandID = createCommandID();
    pendingCommand = {commandID, lifecycle: owner};
    actionBusyState.value = true;
    clearConnectionError();

    const execute = () => withRequest(
      owner,
      (signal) => action.type === "request_combat_resolution"
        ? options.api.requestCombatResolution(
          currentGameID,
          credential,
          current.version,
        )
        : options.api.command(
          currentGameID,
          credential,
          action.type,
          current.version,
          payload,
          {commandID, signal},
        ),
    );

    try {
      let result: CommandResult;
      try {
        result = await execute();
      } catch (error) {
        const normalized = normalizeGameApiError(error);
        if (
          normalized.kind !== "offline" &&
          normalized.kind !== "transient"
        ) {
          throw normalized;
        }
        result = await execute();
      }
      if (!isCurrent(owner)) {
        return;
      }
      if (
        result.game_id !== currentGameID ||
        result.projection.game_id !== currentGameID
      ) {
        throw new GameApiError(
          "protocol",
          safeGameApiMessage("protocol"),
        );
      }
      const visible = projectionState.value;
      if (!visible || result.projection.version >= visible.version) {
        projectionState.value = result.projection;
      }
    } catch (error) {
      if (!isCurrent(owner)) {
        return;
      }
      await handleActionFailure(normalizeGameApiError(error), owner);
    } finally {
      if (
        pendingCommand?.commandID === commandID &&
        pendingCommand.lifecycle === owner
      ) {
        pendingCommand = undefined;
        actionBusyState.value = false;
      }
    }
  }

  async function submitEconomy(request: EconomySubmission): Promise<void> {
    const owner = lifecycle;
    const current = projectionState.value;
    const credential = currentCredential;
    if (
      !isCurrent(owner) ||
      !current ||
      !credential ||
      pendingCommand ||
      pendingInteraction
    ) {
      return;
    }

    if (request.kind === "charity" && request.interactionID &&
      current.interaction?.interaction_id !== request.interactionID) {
      setConnectionError(new GameApiError(
        "stale_version",
        safeGameApiMessage("stale_version"),
      ));
      connectionState.value = "resyncing";
      await resyncController.request().catch((error: unknown) => {
        reportDiagnostic(normalizeGameApiError(error));
      });
      if (isCurrent(owner) && stopStream) {
        connectionState.value = "connected";
      }
      return;
    }

    if (request.kind !== "charity") {
      const liveAction = current.turn.available_actions.find((candidate) =>
        candidate.type === request.action.type &&
        candidate.source_instance_id === request.action.source_instance_id &&
        candidate.ability_index === request.action.ability_index,
      );
      if (!liveAction) {
        setConnectionError(new GameApiError(
          "stale_version",
          safeGameApiMessage("stale_version"),
        ));
        connectionState.value = "resyncing";
        await resyncController.request().catch((error: unknown) => {
          reportDiagnostic(normalizeGameApiError(error));
        });
        if (isCurrent(owner) && stopStream) {
          connectionState.value = "connected";
        }
        return;
      }
    }

    const commandID = createCommandID();
    pendingCommand = {commandID, lifecycle: owner};
    actionBusyState.value = true;
    clearConnectionError();

    const execute = () => withRequest(
      owner,
      (signal) => {
        switch (request.kind) {
          case "offer":
            return options.api.economyOffer(
              currentGameID,
              credential,
              current.version,
              request.offerKind,
              request.recipientPlayerID,
              request.offeredInstanceIDs,
              request.requestedInstanceIDs,
              {commandID, signal},
            );
          case "charity":
            return options.api.resolveCharity(
              currentGameID,
              credential,
              current.version,
              request.allocations,
              {commandID, signal},
            );
          case "theft":
            return options.api.attemptTheft(
              currentGameID,
              credential,
              current.version,
              request.action.source_instance_id ?? "",
              request.action.ability_index ?? 0,
              request.costInstanceID,
              request.victimPlayerID,
              {commandID, signal},
            );
        }
      },
    );

    try {
      let result: CommandResult;
      try {
        result = await execute();
      } catch (error) {
        const normalized = normalizeGameApiError(error);
        if (
          normalized.kind !== "offline" &&
          normalized.kind !== "transient"
        ) {
          throw normalized;
        }
        result = await execute();
      }
      if (!isCurrent(owner)) {
        return;
      }
      if (
        result.game_id !== currentGameID ||
        result.projection.game_id !== currentGameID
      ) {
        throw new GameApiError(
          "protocol",
          safeGameApiMessage("protocol"),
        );
      }
      const visible = projectionState.value;
      if (!visible || result.projection.version >= visible.version) {
        projectionState.value = result.projection;
      }
      clearConnectionError();
    } catch (error) {
      if (!isCurrent(owner)) {
        return;
      }
      await handleActionFailure(normalizeGameApiError(error), owner);
    } finally {
      if (
        pendingCommand?.commandID === commandID &&
        pendingCommand.lifecycle === owner
      ) {
        pendingCommand = undefined;
        actionBusyState.value = false;
      }
    }
  }

  async function handleActionFailure(
    error: GameApiError,
    owner: number,
  ): Promise<void> {
    reportDiagnostic(error);
    setConnectionError(error);
    switch (error.kind) {
      case "aborted":
        return;
      case "auth":
        finishTerminalAuth(owner);
        return;
      case "stale_version":
        errorMessageState.value = error.message;
        connectionState.value = "resyncing";
        try {
          await resyncController.request();
          if (isCurrent(owner) && stopStream) {
            connectionState.value = "connected";
          }
        } catch (refreshError) {
          if (isCurrent(owner)) {
            const normalized = normalizeGameApiError(refreshError);
            reportDiagnostic(normalized);
            if (
              normalized.kind === "offline" ||
              normalized.kind === "transient"
            ) {
              scheduleRecovery(owner);
            } else if (normalized.kind === "auth") {
              finishTerminalAuth(owner);
            } else {
              finishTerminalFailure(normalized, owner);
            }
          }
        }
        return;
      case "offline":
      case "transient":
        scheduleRecovery(owner);
        return;
      case "protocol":
        stopActiveStream();
        connectionState.value = "failed";
        return;
      case "validation":
      case "conflict":
      case "not_found":
      case "unexpected":
        return;
    }
  }

  async function submitInteraction(
    action: InteractionActionView,
  ): Promise<void> {
    const owner = lifecycle;
    const current = projectionState.value;
    const credential = currentCredential;
    const visibleInteraction = current?.interaction;
    if (
      !isCurrent(owner) ||
      !current ||
      !credential ||
      !visibleInteraction ||
      pendingInteraction
    ) {
      return;
    }

    const descriptor = visibleInteraction.actions.find((candidate) =>
      candidate.interaction_id === action.interaction_id &&
      candidate.action_id === action.action_id,
    );
    const isCombatHelpAction = descriptor?.type === "offer_help" ||
      descriptor?.type === "cancel_help";
    const intent = isCombatHelpAction
      ? undefined
      : descriptor?.type as InteractionIntent | undefined;
    if (
      !descriptor ||
      (!isCombatHelpAction && intent === undefined) ||
      (!isCombatHelpAction && descriptor.type !== intent)
    ) {
      interactionErrorState.value = safeGameApiMessage("validation");
      return;
    }

    const commandID = createCommandID();
    pendingInteraction = {
      commandID,
      lifecycle: owner,
      interactionID: descriptor.interaction_id,
      actionID: descriptor.action_id,
    };
    interactionBusyState.value = true;
    interactionErrorState.value = "";

    const execute = () => withRequest(
      owner,
      (signal) => isCombatHelpAction
        ? options.api.combatHelp(
          currentGameID,
          credential,
          current.version,
          descriptor.action_id,
          {commandID, signal},
        )
        : options.api.interaction(
          currentGameID,
          credential,
          current.version,
          descriptor.interaction_id,
          descriptor.action_id,
          intent as InteractionIntent,
          {commandID, signal},
        ),
    );

    try {
      let result: CommandResult;
      try {
        result = await execute();
      } catch (error) {
        const normalized = normalizeGameApiError(error);
        if (
          normalized.kind !== "offline" &&
          normalized.kind !== "transient"
        ) {
          throw normalized;
        }
        result = await execute();
      }
      if (!isCurrent(owner)) {
        return;
      }
      if (
        result.game_id !== currentGameID ||
        result.projection.game_id !== currentGameID
      ) {
        throw new GameApiError(
          "protocol",
          safeGameApiMessage("protocol"),
        );
      }
      const visible = projectionState.value;
      if (!visible || result.projection.version >= visible.version) {
        projectionState.value = result.projection;
      }
      interactionErrorState.value = "";
    } catch (error) {
      if (!isCurrent(owner)) {
        return;
      }
      await handleInteractionFailure(normalizeGameApiError(error), owner);
    } finally {
      if (
        pendingInteraction?.commandID === commandID &&
        pendingInteraction.lifecycle === owner
      ) {
        pendingInteraction = undefined;
        interactionBusyState.value = false;
      }
    }
  }

  async function handleInteractionFailure(
    error: GameApiError,
    owner: number,
  ): Promise<void> {
    reportDiagnostic(error);
    switch (error.kind) {
      case "aborted":
        return;
      case "auth":
        finishTerminalAuth(owner);
        return;
      case "stale_version":
      case "conflict":
      case "protocol":
        interactionErrorState.value = error.message;
        connectionState.value = "resyncing";
        try {
          await resyncController.request();
          if (isCurrent(owner) && stopStream) {
            connectionState.value = "connected";
          }
        } catch (refreshError) {
          if (!isCurrent(owner)) {
            return;
          }
          const normalized = normalizeGameApiError(refreshError);
          reportDiagnostic(normalized);
          if (normalized.kind === "auth") {
            finishTerminalAuth(owner);
          } else if (
            normalized.kind === "offline" ||
            normalized.kind === "transient"
          ) {
            interactionErrorState.value = normalized.message;
            scheduleRecovery(owner);
          } else {
            interactionErrorState.value = normalized.message;
            connectionState.value = "failed";
          }
        }
        return;
      case "offline":
      case "transient":
        interactionErrorState.value = error.message;
        scheduleRecovery(owner);
        return;
      case "validation":
      case "not_found":
      case "unexpected":
        interactionErrorState.value = error.message;
    }
  }

  function finishInitialFailure(error: GameApiError, owner: number): void {
    if (!isCurrent(owner)) {
      return;
    }
    loadingState.value = false;
    reportDiagnostic(error);
    setConnectionError(error);
    if (error.kind === "auth") {
      finishTerminalAuth(owner);
    } else if (
      error.kind === "offline" ||
      error.kind === "transient"
    ) {
      errorMessageState.value = error.message;
      scheduleRecovery(owner);
    } else {
      finishTerminalFailure(error, owner);
    }
  }

  function finishTerminalAuth(owner: number): void {
    if (!isCurrent(owner)) {
      return;
    }
    const gameID = currentGameID;
    stopActiveStream();
    clearReconnectTimer();
    abortRequests();
    loadingState.value = false;
    actionBusyState.value = false;
    interactionBusyState.value = false;
    pendingInteraction = undefined;
    connectionState.value = "failed";
    errorMessageState.value = safeGameApiMessage("auth");
    errorKindState.value = "auth";
    interactionErrorState.value = "";
    try {
      options.credentials.clearCurrentGame(gameID);
    } catch (error) {
      reportDiagnostic(normalizeGameApiError(error));
    }
    lifecycle++;
    void Promise.resolve(options.navigateToLobby()).catch((error: unknown) => {
      reportDiagnostic(normalizeGameApiError(error));
    });
  }

  function finishTerminalFailure(
    error: GameApiError,
    owner: number,
  ): void {
    if (!isCurrent(owner)) {
      return;
    }
    stopActiveStream();
    clearReconnectTimer();
    loadingState.value = false;
    connectionState.value = "failed";
    setConnectionError(error);
  }

  function reportDiagnostic(error: GameApiError): void {
    options.onDiagnostic?.(error);
  }

  function stopActiveStream(): void {
    const stop = stopStream;
    stopStream = undefined;
    streamOwner++;
    stop?.();
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer === undefined) {
      return;
    }
    scheduler.clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }

  function abortRequests(): void {
    for (const controller of requestControllers) {
      controller.abort();
    }
    requestControllers.clear();
  }

  function closeCurrentSession(): void {
    stopActiveStream();
    clearReconnectTimer();
    abortRequests();
    pendingCommand = undefined;
    pendingInteraction = undefined;
    currentCredential = null;
  }

  function stop(): void {
    isStopped = true;
    lifecycle++;
    closeCurrentSession();
    loadingState.value = false;
    actionBusyState.value = false;
    interactionBusyState.value = false;
  }

  return {
    projection: computed<Projection | null>(() => projectionState.value),
    loading: readonly(loadingState),
    actionBusy: readonly(actionBusyState),
    interactionBusy: readonly(interactionBusyState),
    errorMessage: readonly(errorMessageState),
    errorKind: readonly(errorKindState),
    interactionError: readonly(interactionErrorState),
    connectionState: readonly(connectionState),
    isBusy: computed(() =>
      loadingState.value ||
      actionBusyState.value ||
      interactionBusyState.value ||
      connectionState.value === "connecting" ||
      connectionState.value === "resyncing"
    ),
    start,
    stop,
    refresh,
    retry,
    submitAction,
    submitEconomy,
    submitInteraction,
  };
}

export function useGameSessionController(
  options: UseGameSessionControllerOptions,
) {
  const controller = createGameSessionController(options);
  onMounted(() => {
    watch(
      () => toValue(options.gameID),
      (gameID) => {
        void controller.start(gameID);
      },
      {immediate: true},
    );
  });
  onBeforeUnmount(() => controller.stop());
  return controller;
}
