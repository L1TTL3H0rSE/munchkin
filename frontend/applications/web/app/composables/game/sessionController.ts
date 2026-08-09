import {
  computed,
  readonly,
  ref,
  shallowRef,
} from "vue";

import type {Invalidation, Projection} from "@munchkin/contracts";

import {
  GameApiError,
  normalizeGameApiError,
  safeGameApiMessage,
  type GameApiErrorKind,
} from "./apiErrors";
import {createVersionedResync} from "./realtime";
import {createSessionSubmissions} from "./sessionSubmissions";
import type {
  GameConnectionState,
  GameSessionControllerOptions,
  GameSessionScheduler,
} from "./sessionTypes";

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

  const submissions = createSessionSubmissions({
    api: options.api,
    projectionState,
    actionBusyState,
    interactionBusyState,
    errorMessageState,
    interactionErrorState,
    connectionState,
    getOwner: () => lifecycle,
    getGameID: () => currentGameID,
    getCredential: () => currentCredential,
    isCurrent,
    withRequest,
    createCommandID,
    clearConnectionError,
    setConnectionError,
    requestResync: (requiredVersion) =>
      resyncController.request(requiredVersion),
    hasActiveStream: () => stopStream !== undefined,
    reportDiagnostic,
    scheduleRecovery,
    finishTerminalAuth,
    finishTerminalFailure,
    stopActiveStream,
  });

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
    submissions.reset();
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
    submissions.reset();
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
    submitAction: submissions.submitAction,
    submitEconomy: submissions.submitEconomy,
    submitInteraction: submissions.submitInteraction,
  };
}
