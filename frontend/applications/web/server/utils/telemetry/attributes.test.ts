import {describe, expect, it} from "vitest";
import {
  allowlistedTraceHeaders,
  classifyRequest,
  completeRequestAttributes,
  statusClass,
} from "./attributes";

describe("server telemetry attributes", () => {
  it("maps health aliases and game paths without exporting identifiers", () => {
    expect(classifyRequest("GET", "/health/live")).toEqual({
      method: "GET",
      routeClass: "health_live",
    });
    expect(classifyRequest("GET", "/healthz").routeClass).toBe("health_live");
    expect(
      classifyRequest(
        "POST",
        "/api/v1/games/private-game-id/commands/end-turn?secret=1",
      ).routeClass,
    ).toBe("game_command");
  });

  it("keeps only bounded trace propagation headers", () => {
    const headers = allowlistedTraceHeaders({
      traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
      tracestate: "vendor=value",
      authorization: "Bearer private-token",
      baggage: "game_id=private-game-id",
      "x-too-long": "private",
    });
    expect(headers).toEqual({
      traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
      tracestate: "vendor=value",
    });
  });

  it("normalizes status attributes to bounded classes", () => {
    expect(completeRequestAttributes("DELETE", "/unknown", 503)).toEqual({
      method: "OTHER",
      routeClass: "unknown",
      statusCode: 503,
      statusClass: "5xx",
    });
    expect(statusClass(700)).toBe("other");
  });
});
