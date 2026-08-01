import {
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  type Attributes,
  type Span,
} from "@opentelemetry/api";
import {
  OTLPMetricExporter,
} from "@opentelemetry/exporter-metrics-otlp-proto";
import {
  OTLPTraceExporter,
} from "@opentelemetry/exporter-trace-otlp-proto";
import {resourceFromAttributes} from "@opentelemetry/resources";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import {
  allowlistedTraceHeaders,
  classifyRequest,
  type HeaderRecord,
  normalizeStatus,
  statusClass,
} from "./attributes";

const instrumentationName = "@munchkin/web/server";
const maxConfigStringLength = 256;

export interface TelemetryConfig {
  enabled: boolean;
  endpoint: string;
  serviceName: string;
  version: string;
  revision: string;
  environment: string;
}

export interface RequestStart {
  method: unknown;
  path: unknown;
  headers?: HeaderRecord;
}

export interface RequestEnd {
  statusCode: unknown;
}

export interface RequestHandle {
  readonly span: Span;
  readonly startedAt: number;
  readonly method: string;
  readonly routeClass: string;
}

export interface TelemetryRuntime {
  startRequest(input: RequestStart): RequestHandle | undefined;
  endRequest(handle: RequestHandle | undefined, input: RequestEnd): void;
  shutdown(): Promise<void>;
}

interface RuntimeRecord extends TelemetryRuntime {
  readonly tracerProvider: NodeTracerProvider;
  readonly meterProvider: MeterProvider;
}

export function readTelemetryConfig(input: unknown): TelemetryConfig {
  const raw = isRecord(input) ? input : {};
  const endpoint = boundedString(raw.endpoint) ?? "";
  const enabled = raw.enabled === true && endpoint !== "";
  return {
    enabled,
    endpoint,
    serviceName: boundedString(raw.serviceName) ?? "munchkin-web",
    version: boundedString(raw.version) ?? "unknown",
    revision: boundedString(raw.revision) ?? "unknown",
    environment: environmentValue(raw.environment),
  };
}

export function normalizeEndpoint(
  input: unknown,
  signal: "traces" | "metrics",
): string | undefined {
  const value = boundedString(input);
  if (!value) {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      return undefined;
    }
    const path = url.pathname.replace(/\/+$/u, "");
    const versioned = path.replace(/\/v1\/(?:traces|metrics)$/u, "");
    url.pathname = `${versioned}/v1/${signal}`.replace(/\/+/gu, "/");
    return url.toString();
  } catch {
    return undefined;
  }
}

export function createNitroTelemetryRuntime(
  input: unknown,
): TelemetryRuntime {
  const config = readTelemetryConfig(input);
  if (!config.enabled) {
    return noopRuntime();
  }
  const traceEndpoint = normalizeEndpoint(config.endpoint, "traces");
  const metricEndpoint = normalizeEndpoint(config.endpoint, "metrics");
  if (!traceEndpoint || !metricEndpoint) {
    return noopRuntime();
  }

  try {
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.version,
      "service.revision": config.revision,
      "deployment.environment": config.environment,
    });
    const traceExporter = new OTLPTraceExporter({url: traceEndpoint});
    const tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: [
        new BatchSpanProcessor(traceExporter, {
          maxQueueSize: 512,
          maxExportBatchSize: 128,
          scheduledDelayMillis: 5_000,
          exportTimeoutMillis: 5_000,
        }),
      ],
    });
    tracerProvider.register();

    const metricExporter = new OTLPMetricExporter({url: metricEndpoint});
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10_000,
      exportTimeoutMillis: 5_000,
      maxExportBatchSize: 128,
    });
    const meterProvider = new MeterProvider({
      resource,
      readers: [metricReader],
    });
    const tracer = tracerProvider.getTracer(instrumentationName);
    const meter = meterProvider.getMeter(instrumentationName);
    const requestCount = meter.createCounter("http.server.request.count");
    const requestDuration = meter.createHistogram(
      "http.server.request.duration",
      {unit: "ms"},
    );
    const runtime: RuntimeRecord = {
      tracerProvider,
      meterProvider,
      startRequest(input) {
        try {
          const request = classifyRequest(input.method, input.path);
          const parentContext = propagation.extract(
            ROOT_CONTEXT,
            allowlistedTraceHeaders(input.headers),
          );
          const span = tracer.startSpan(
            "http.server.request",
            {kind: SpanKind.SERVER},
            parentContext,
          );
          return {
            span,
            startedAt: Date.now(),
            method: request.method,
            routeClass: request.routeClass,
          };
        } catch {
          return undefined;
        }
      },
      endRequest(handle, input) {
        if (!handle) {
          return;
        }
        try {
          const statusCode = normalizeStatus(input.statusCode);
          const attributes: Attributes = {
            "http.request.method": handle.method,
            "http.route.class": handle.routeClass,
            "http.response.status_code": statusCode,
            "http.response.status_class": statusClass(statusCode),
          };
          handle.span.setAttributes(attributes);
          handle.span.end();
          const duration = Math.max(0, Date.now() - handle.startedAt);
          requestCount.add(1, attributes);
          requestDuration.record(duration, attributes);
        } catch {
          // Telemetry must never change application response semantics.
        }
      },
      async shutdown() {
        await Promise.allSettled([
          tracerProvider.shutdown(),
          meterProvider.shutdown(),
        ]);
      },
    };
    return runtime;
  } catch {
    return noopRuntime();
  }
}

function noopRuntime(): TelemetryRuntime {
  return {
    startRequest: () => undefined,
    endRequest: () => undefined,
    shutdown: async () => undefined,
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function boundedString(input: unknown): string | undefined {
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    input.length > maxConfigStringLength ||
    input.includes("\0") ||
    input.includes("\r") ||
    input.includes("\n")
  ) {
    return undefined;
  }
  return input.trim();
}

function environmentValue(input: unknown): string {
  const value = boundedString(input)?.toLowerCase();
  return value === "development" ||
    value === "test" ||
    value === "staging" ||
    value === "production"
    ? value
    : "unknown";
}
