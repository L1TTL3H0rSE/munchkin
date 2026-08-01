import {describe, expect, it} from "vitest";

import {GameApiError} from "../app/composables/useGameApi";
import {
  lobbyFormError,
  validateLobbyInput,
  type LobbyFormInput,
} from "../app/components/lobby/lobbyModel";

describe("lobby form model", () => {
  it("validates create and join inputs without a shared busy state", () => {
    const createInput: LobbyFormInput = {
      mode: "create",
      displayName: "  Алиса  ",
    };
    const joinInput: LobbyFormInput = {
      mode: "join",
      displayName: "Борис",
      gameID: "game_fixture",
    };

    expect(validateLobbyInput("create", createInput)).toBeUndefined();
    expect(validateLobbyInput("join", joinInput)).toBeUndefined();
    expect(validateLobbyInput("join", {
      mode: "join",
      displayName: "Борис",
      gameID: "",
    })).toMatchObject({
      field: "gameID",
      kind: "validation",
    });
  });

  it("returns field-linked not-found copy without raw API text", () => {
    const result = lobbyFormError(new GameApiError(
      "not_found",
      "raw backend token=secret",
    ));

    expect(result).toEqual({
      field: "gameID",
      kind: "not_found",
      message: "Комната не найдена. Проверьте ID и повторите попытку.",
      retryable: false,
    });
    expect(result.message).not.toContain("token=secret");
  });

  it("keeps offline retry guidance and hides unexpected causes", () => {
    const offline = lobbyFormError(new TypeError("credential=private"));
    const unexpected = lobbyFormError(new Error("raw provider response"));

    expect(offline).toMatchObject({
      field: "form",
      kind: "offline",
      retryable: true,
      message: "Нет связи с сервером игры.",
    });
    expect(unexpected.message).toBe("Не удалось выполнить запрос к игре.");
    expect(unexpected.message).not.toContain("raw provider response");
  });
});
