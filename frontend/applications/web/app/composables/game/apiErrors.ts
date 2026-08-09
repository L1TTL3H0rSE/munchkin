import {ZodError} from "zod";

import {apiErrorSchema} from "@munchkin/contracts";

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

export class GameTransportError extends Error {
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
  if (isRecord(error) && error.name === "AbortError") {
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
  const payload = response ? (response._data ?? response.data) : undefined;
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
