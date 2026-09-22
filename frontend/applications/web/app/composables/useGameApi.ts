import {createGameApi} from "@munchkin/api";

export {
  buildContentAssetURL,
  parseGameProjection,
  type GameCommandOptions,
  type GameRequestOptions,
} from "@munchkin/api";
export {
  GameApiError,
  normalizeGameApiError,
  safeGameApiMessage,
  type GameApiErrorKind,
} from "@munchkin/api";
export {createVersionedResync} from "@munchkin/api";

export function useGameApi() {
  const config = useRuntimeConfig();
  const baseURL = String(config.public.apiBase).replace(/\/$/, "");
  return createGameApi(baseURL, $fetch);
}
