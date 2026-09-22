import {describe, expect, it, vi} from "vitest";
import {createGameApi, GameApiError, normalizeGameApiError, parseGameProjection} from "../src/index";

describe("standalone HTTP boundary", () => {
  it("rejects private or incompatible projections", () => {
    expect(() => parseGameProjection({rng_state: 1, players: []})).toThrow(GameApiError);
    expect(normalizeGameApiError(new TypeError("secret"))).toMatchObject({kind: "offline"});
    expect(normalizeGameApiError(new TypeError("secret")).message).not.toContain("secret");
  });
  it("uses the injected transport and propagates abort without Nuxt", async () => {
    const request = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    const api = createGameApi("http://localhost:8080", request);
    const controller = new AbortController();
    await expect(api.getGame("room/1", "credential", {signal: controller.signal})).rejects.toMatchObject({kind: "aborted"});
    expect(request).toHaveBeenCalledWith("http://localhost:8080/api/v1/games/room%2F1", {
      headers: {Authorization: "Bearer credential"}, signal: controller.signal,
    });
  });
});
