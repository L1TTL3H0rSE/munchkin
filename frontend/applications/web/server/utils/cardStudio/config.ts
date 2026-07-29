import type {
  StudioProviderInfo,
  StudioQuality,
} from "./types";
import {StudioError} from "./errors";

export interface CardStudioConfig {
  enabled: boolean;
  token: string;
  provider: "fake" | "openai";
  dataDir: string;
  jobTimeoutMs: number;
  maxImageBytes: number;
  openai: {
    apiKey: string;
    model: string;
  };
}

export interface RawRuntimeConfig {
  enabled?: unknown;
  token?: unknown;
  provider?: unknown;
  dataDir?: unknown;
  jobTimeoutMs?: unknown;
  maxImageBytes?: unknown;
  openai?: {
    apiKey?: unknown;
    model?: unknown;
  };
}

export function requireCardStudioEnabled(
  input: RawRuntimeConfig | undefined,
) {
  if (input?.enabled !== true) {
    throw new StudioError(
      "STUDIO_DISABLED",
      "Card Studio выключена.",
      404,
    );
  }
}

export function normalizeCardStudioConfig(
  input: RawRuntimeConfig | undefined,
): CardStudioConfig {
  const rawProvider = input?.provider;
  const provider = rawProvider === undefined || rawProvider === ""
    ? "fake"
    : rawProvider;
  if (provider !== "fake" && provider !== "openai") {
    throw new StudioError(
      "PROVIDER_UNAVAILABLE",
      "Card Studio provider не настроен.",
      503,
    );
  }
  const dataDir = boundedConfigString(
    input?.dataDir ?? ".card-studio",
    260,
    "Card Studio data directory не настроена.",
  );
  const model = boundedConfigString(
    input?.openai?.model ?? "gpt-image-2",
    120,
    "Image model не настроена.",
  );
  if (!/^gpt-image-2(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) {
    throw new StudioError(
      "PROVIDER_UNAVAILABLE",
      "Image model не входит в server allowlist.",
      503,
    );
  }
  return {
    enabled: input?.enabled === true,
    token: typeof input?.token === "string" ? input.token : "",
    provider,
    dataDir,
    jobTimeoutMs: boundedNumber(
      input?.jobTimeoutMs,
      10_000,
      180_000,
      120_000,
    ),
    maxImageBytes: boundedNumber(
      input?.maxImageBytes,
      1_048_576,
      52_428_800,
      25_165_824,
    ),
    openai: {
      apiKey: typeof input?.openai?.apiKey === "string"
        ? input.openai.apiKey
        : "",
      model,
    },
  };
}

export function providerInfo(
  config: CardStudioConfig,
  defaultQuality: StudioQuality = "low",
): StudioProviderInfo {
  const realGeneration = config.provider === "openai";
  return {
    provider: config.provider,
    model: realGeneration ? config.openai.model : "fake-card-art-v1",
    size: "1024x1536",
    default_quality: defaultQuality,
    real_generation: realGeneration,
    cost_warning: realGeneration
      ? "Каждое нажатие Generate создаёт отдельный платный запрос OpenAI."
      : "Fake provider работает offline и не создаёт внешних расходов.",
  };
}

function boundedConfigString(
  value: unknown,
  maximum: number,
  message: string,
) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum ||
    value.includes("\0")
  ) {
    throw new StudioError("PROVIDER_UNAVAILABLE", message, 503);
  }
  return value;
}

function boundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    return fallback;
  }
  return number;
}
