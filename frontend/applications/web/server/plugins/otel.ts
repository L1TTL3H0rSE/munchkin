import type {H3Event} from "h3";
import {createNitroTelemetryRuntime, type RequestHandle} from "~~/server/utils/telemetry/runtime";

const requestTelemetryKey = "__munchkinTelemetryRequest";

export default defineNitroPlugin((nitroApp) => {
  const runtime = createNitroTelemetryRuntime(useRuntimeConfig().telemetry);

  nitroApp.hooks.hook("request", (event) => {
    const handle = runtime.startRequest({
      method: event.node.req.method,
      path: event.path,
      headers: event.node.req.headers,
    });
    if (handle) {
      contextRecord(event)[requestTelemetryKey] = handle;
    }
  });

  nitroApp.hooks.hook("afterResponse", (event) => {
    const context = contextRecord(event);
    const handle = readRequestHandle(context[requestTelemetryKey]);
    runtime.endRequest(handle, {statusCode: event.node.res.statusCode});
    context[requestTelemetryKey] = undefined;
  });

  nitroApp.hooks.hook("close", async () => {
    await runtime.shutdown();
  });
});

function contextRecord(event: H3Event): Record<string, unknown> {
  return event.context as Record<string, unknown>;
}

function readRequestHandle(input: unknown): RequestHandle | undefined {
  if (
    typeof input === "object" &&
    input !== null &&
    "span" in input &&
    "startedAt" in input &&
    "method" in input &&
    "routeClass" in input
  ) {
    return input as RequestHandle;
  }
  return undefined;
}
