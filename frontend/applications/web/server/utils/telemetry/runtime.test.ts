import {describe, expect, it} from "vitest";
import {
  createNitroTelemetryRuntime,
  normalizeEndpoint,
  readTelemetryConfig,
} from "./runtime";

describe("server telemetry runtime", () => {
  it("is disabled unless an explicit endpoint is configured", () => {
    expect(readTelemetryConfig({enabled: false, endpoint: "http://collector"})).toMatchObject({
      enabled: false,
      endpoint: "http://collector",
    });
    expect(readTelemetryConfig({enabled: true, endpoint: ""}).enabled).toBe(false);
    expect(createNitroTelemetryRuntime({enabled: false}).startRequest({
      method: "GET",
      path: "/health/live",
    })).toBeUndefined();
  });

  it("normalizes OTLP signal paths and rejects credentialed URLs", () => {
    expect(normalizeEndpoint("http://collector:4318", "traces"))
      .toBe("http://collector:4318/v1/traces");
    expect(normalizeEndpoint("http://collector:4318/v1/metrics", "traces"))
      .toBe("http://collector:4318/v1/traces");
    expect(normalizeEndpoint("http://user:secret@collector:4318", "metrics"))
      .toBeUndefined();
  });

  it("fails open when runtime initialization is not usable", async () => {
    const runtime = createNitroTelemetryRuntime({
      enabled: true,
      endpoint: "not a URL",
    });
    expect(runtime.startRequest({method: "GET", path: "/health/ready"}))
      .toBeUndefined();
    await expect(runtime.shutdown()).resolves.toBeUndefined();
  });
});
