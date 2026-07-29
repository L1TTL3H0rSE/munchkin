import {
  createError,
  defineEventHandler,
  getHeader,
  type EventHandler,
  type EventHandlerRequest,
  type H3Event,
} from "h3";
import {authorizeCardStudio} from "./auth";
import {
  normalizeCardStudioConfig,
  requireCardStudioEnabled,
  type CardStudioConfig,
} from "./config";
import {safeStudioError} from "./errors";
import {CardStudioService} from "./service";

type StudioHandler<T> = (
  event: H3Event,
  service: CardStudioService,
  config: CardStudioConfig,
) => Promise<T>;

let servicePromise: Promise<CardStudioService> | undefined;
let serviceKey = "";

export function defineStudioHandler<T>(
  handler: StudioHandler<T>,
): EventHandler<EventHandlerRequest, Promise<T>> {
  return defineEventHandler(async (event) => {
    try {
      const runtime = useRuntimeConfig(event);
      requireCardStudioEnabled(runtime.cardStudio);
      const config = normalizeCardStudioConfig(runtime.cardStudio);
      authorizeCardStudio(config, getHeader(event, "authorization"));
      const service = await sharedService(config);
      return await handler(event, service, config);
    } catch (error) {
      const safe = safeStudioError(error);
      throw createError({
        statusCode: safe.statusCode,
        statusMessage: safe.message,
        data: {
          error: true,
          code: safe.code,
          message: safe.message,
        },
      });
    }
  });
}

async function sharedService(config: CardStudioConfig) {
  const nextKey = JSON.stringify({
    provider: config.provider,
    dataDir: config.dataDir,
    model: config.openai.model,
    maxImageBytes: config.maxImageBytes,
    jobTimeoutMs: config.jobTimeoutMs,
  });
  if (!servicePromise || nextKey !== serviceKey) {
    serviceKey = nextKey;
    servicePromise = CardStudioService.create(config);
  }
  return servicePromise;
}
