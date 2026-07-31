import {readFileSync} from "node:fs";

import {afterEach, describe, expect, it, vi} from "vitest";

import {
  GameApiError,
  normalizeGameApiError,
  useGameApi,
} from "../app/composables/useGameApi";

const projectionFixture: unknown = JSON.parse(readFileSync(new URL(
  "../../../../backend/game/internal/transport/httpapi/testdata/"
    + "interaction-projection-v1.json",
  import.meta.url,
), "utf8"));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("game API error adapter", () => {
  it.each([
    [403, "forbidden", "auth"],
    [404, "not_found", "not_found"],
    [409, "version_conflict", "stale_version"],
    [409, "idempotency_key_reused", "conflict"],
    [422, "rule_violation", "validation"],
    [503, "internal_error", "transient"],
  ] as const)(
    "classifies status %i and code %s as %s",
    (status, code, expectedKind) => {
      const error = normalizeGameApiError({
        response: {
          status,
          _data: {
            error: true,
            code,
            message: "raw backend secret token=do-not-display",
          },
        },
      });

      expect(error.kind).toBe(expectedKind);
      expect(error.message).not.toContain("raw backend");
      expect(error.message).not.toContain("do-not-display");
    },
  );

  it("classifies offline, abort and unexpected failures without raw copy", () => {
    expect(normalizeGameApiError(new TypeError("token=network-secret")).kind)
      .toBe("offline");
    expect(normalizeGameApiError(
      new DOMException("credential-secret", "AbortError"),
    ).kind).toBe("aborted");
    const unexpected = normalizeGameApiError(
      new Error("stack and private projection"),
    );
    expect(unexpected.kind).toBe("unexpected");
    expect(unexpected.message).toBe("Не удалось выполнить запрос к игре.");
  });

  it("turns an invalid projection into a safe protocol error", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {apiBase: "https://game.example.test"},
    }));
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({
      game_id: "game_fixture",
      version: 7,
      private_hand: ["secret-card"],
    }));

    const result = useGameApi().getGame(
      "game_fixture",
      "credential-secret",
    );

    await expect(result).rejects.toMatchObject({
      kind: "protocol",
      message: "Получен несовместимый ответ сервера.",
    });
    await expect(result).rejects.not.toThrow("secret-card");
  });

  it("forwards route-owned abort signals without putting credentials in URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(projectionFixture);
    const controller = new AbortController();
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {apiBase: "https://game.example.test"},
    }));
    vi.stubGlobal("$fetch", fetchMock);

    await useGameApi().getGame(
      "game fixture",
      "credential-secret",
      {signal: controller.signal},
    );

    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://game.example.test/api/v1/games/game%20fixture",
    );
    expect(url).not.toContain("credential-secret");
    expect(request.signal).toBe(controller.signal);
    expect(request.headers).toEqual({
      Authorization: "Bearer credential-secret",
    });
  });

  it("keeps already normalized diagnostic causes outside user copy", () => {
    const cause = new Error("raw framework response");
    const error = new GameApiError(
      "unexpected",
      "Не удалось выполнить запрос к игре.",
      {cause},
    );

    expect(normalizeGameApiError(error)).toBe(error);
    expect(error.message).not.toContain(cause.message);
    expect(error.cause).toBe(cause);
  });
});
