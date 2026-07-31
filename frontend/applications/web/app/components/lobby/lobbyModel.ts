import {
  normalizeGameApiError,
  type GameApiErrorKind,
} from "../../composables/useGameApi";

export type LobbyFormMode = "create" | "join";
export type LobbyField = "displayName" | "gameID" | "form";

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
  const message = normalized.kind === "not_found"
    ? "Комната не найдена. Проверьте ID и повторите попытку."
    : normalized.message;

  return {
    field,
    kind: normalized.kind,
    message,
    retryable: normalized.kind === "offline" || normalized.kind === "transient",
  };
}
