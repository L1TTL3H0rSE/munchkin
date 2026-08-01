export type HeaderRecord = Record<
  string,
  string | string[] | undefined
>;

export interface RequestAttributes {
  method: string;
  routeClass: string;
  statusCode: number;
  statusClass: string;
}

export function classifyRequest(
  methodInput: unknown,
  pathInput: unknown,
): Pick<RequestAttributes, "method" | "routeClass"> {
  const method = normalizeMethod(methodInput);
  const path = normalizePath(pathInput);
  return {
    method,
    routeClass: classifyRoute(method, path),
  };
}

export function completeRequestAttributes(
  methodInput: unknown,
  pathInput: unknown,
  statusInput: unknown,
): RequestAttributes {
  const request = classifyRequest(methodInput, pathInput);
  const statusCode = normalizeStatus(statusInput);
  return {
    ...request,
    statusCode,
    statusClass: statusClass(statusCode),
  };
}

export function allowlistedTraceHeaders(
  headers: HeaderRecord | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of ["traceparent", "tracestate"] as const) {
    const value = readHeader(headers, name);
    const maximum = name === "traceparent" ? 55 : 512;
    if (
      value !== undefined &&
      value.length > 0 &&
      value.length <= maximum &&
      !containsControlCharacter(value)
    ) {
      result[name] = value;
    }
  }
  return result;
}

export function normalizeMethod(input: unknown): string {
  if (typeof input !== "string") {
    return "OTHER";
  }
  const method = input.trim().toUpperCase();
  return method === "GET" || method === "POST" || method === "OPTIONS"
    ? method
    : "OTHER";
}

export function normalizePath(input: unknown): string {
  if (typeof input !== "string" || input.length === 0 || input.length > 512) {
    return "";
  }
  const [path = ""] = input.split("?", 1);
  return path.startsWith("/") && !containsControlCharacter(path)
    ? path
    : "";
}

export function normalizeStatus(input: unknown): number {
  if (
    typeof input !== "number" ||
    !Number.isInteger(input) ||
    input < 100 ||
    input > 599
  ) {
    return 500;
  }
  return input;
}

export function statusClass(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) {
    return "2xx";
  }
  if (statusCode >= 300 && statusCode < 400) {
    return "3xx";
  }
  if (statusCode >= 400 && statusCode < 500) {
    return "4xx";
  }
  if (statusCode >= 500 && statusCode < 600) {
    return "5xx";
  }
  return "other";
}

function classifyRoute(method: string, path: string): string {
  if (method === "GET" && path === "/health/live") {
    return "health_live";
  }
  if (method === "GET" && path === "/health/ready") {
    return "health_ready";
  }
  if (method === "GET" && path === "/healthz") {
    return "health_live";
  }
  if (method === "POST" && path === "/api/v1/lobbies") {
    return "lobby_create";
  }
  if (method === "GET" && /^\/api\/v1\/lobbies\/[^/]+$/u.test(path)) {
    return "lobby_read";
  }
  if (
    method === "GET" &&
    /^\/api\/v1\/content\/[^/]+\/assets\//u.test(path)
  ) {
    return "content_asset";
  }
  if (
    method === "POST" &&
    /^\/api\/v1\/games\/[^/]+\/players$/u.test(path)
  ) {
    return "game_join";
  }
  if (method === "GET" && /^\/api\/v1\/games\/[^/]+$/u.test(path)) {
    return "game_read";
  }
  if (
    method === "GET" &&
    /^\/api\/v1\/games\/[^/]+\/events$/u.test(path)
  ) {
    return "game_events";
  }
  if (
    method === "POST" &&
    /^\/api\/v1\/games\/[^/]+\/(?:start|commands\/[^/]+)$/u.test(path)
  ) {
    return path.endsWith("/start") ? "game_start" : "game_command";
  }
  return "unknown";
}

function readHeader(
  headers: HeaderRecord | undefined,
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }
  for (const [key, rawValue] of Object.entries(headers)) {
    if (key.toLowerCase() !== name) {
      continue;
    }
    if (typeof rawValue === "string") {
      return rawValue.trim();
    }
    if (Array.isArray(rawValue)) {
      return rawValue.join(",").trim();
    }
  }
  return undefined;
}

function containsControlCharacter(value: string): boolean {
  return value.includes("\0") || value.includes("\r") || value.includes("\n");
}
