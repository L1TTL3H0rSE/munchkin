import {
  normalizeGameApiError,
  type GameApiErrorKind,
} from "../../composables/useGameApi";

export type LobbyFormMode = "create" | "join";
export type LobbyField = "displayName" | "gameID" | "form";
export type LobbyFormState = "idle" | "loading" | "success" | "error" | "offline";

export type LobbyFormInput =
  | {
      mode: "create";
      displayName: string;
    }
  | {
      mode: "join";
      displayName: string;
      gameID: string;
    };

export interface LobbyFormError {
  field: LobbyField;
  kind: GameApiErrorKind | "validation";
  message: string;
  retryable: boolean;
}
export function validateLobbyInput(
  mode: LobbyFormMode,
  input: LobbyFormInput,
): LobbyFormError | undefined {
  if (!input.displayName.trim()) {
    return {
      field: "displayName",
      kind: "validation",
      message: "Введите имя игрока.",
      retryable: false,
    };
  }

  if (input.displayName.trim().length > 40) {
    return {
      field: "displayName",
      kind: "validation",
      message: "Имя игрока должно быть не длиннее 40 символов.",
      retryable: false,
    };
  }

  if (mode === "join" && (input.mode !== "join" || !input.gameID.trim())) {
    return {
      field: "gameID",
      kind: "validation",
      message: "Введите ID игры.",
      retryable: false,
    };
  }

  return undefined;
}

export function lobbyFormError(error: unknown): LobbyFormError {
  const normalized = normalizeGameApiError(error);
  const field = normalized.kind === "not_found" ? "gameID" : "form";
  const message = lobbyErrorMessage(normalized.kind);

  return {
    field,
    kind: normalized.kind,
    message,
    retryable: normalized.kind === "offline" || normalized.kind === "transient",
  };
}

function lobbyErrorMessage(kind: GameApiErrorKind): string {
  switch (kind) {
    case "not_found":
      return "Комната не найдена. Проверьте код и повторите попытку.";
    case "offline":
      return "Проверьте подключение и повторите попытку.";
    case "transient":
      return "Сейчас не получается открыть комнату. Повторите попытку через несколько секунд.";
    case "validation":
      return "Проверьте данные и повторите попытку.";
    case "stale_version":
      return "Комната изменилась. Повторите вход ещё раз.";
    case "conflict":
      return "Попытка уже обработана. Повторите ещё раз.";
    case "auth":
      return "Не удалось открыть комнату. Попробуйте ещё раз.";
    case "aborted":
      return "Попытка остановлена. Можно повторить её снова.";
    case "protocol":
    case "unexpected":
      return "Не удалось открыть комнату. Повторите попытку.";
  }
}
