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
      message: "Комната не найдена. Проверьте код и повторите попытку.",
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
      message: "Проверьте подключение и повторите попытку.",
    });
    expect(unexpected.message).toBe("Не удалось открыть комнату. Повторите попытку.");
    expect(unexpected.message).not.toContain("raw provider response");
  });

  it("uses product-language messages for every server failure kind", () => {
    const kinds = [
      "auth",
      "validation",
      "conflict",
      "stale_version",
      "protocol",
      "unexpected",
    ] as const;

    for (const kind of kinds) {
      const result = lobbyFormError(new GameApiError(kind, "raw backend detail"));
      expect(result.field).toBe("form");
      expect(result.message).not.toContain("raw backend detail");
      expect(result.message).not.toMatch(/sessionStorage|bearer|SSR|URL|API|version/i);
    }
  });
});
