import {createGameApi} from "./game/apiClient";

export {
  buildContentAssetURL,
  parseGameProjection,
  type GameCommandOptions,
  type GameRequestOptions,
} from "./game/apiClient";
export {
  GameApiError,
  normalizeGameApiError,
  safeGameApiMessage,
  type GameApiErrorKind,
} from "./game/apiErrors";
export {createVersionedResync} from "./game/realtime";

export function useGameApi() {
  const config = useRuntimeConfig();
  const baseURL = String(config.public.apiBase).replace(/\/$/, "");
  return createGameApi(baseURL);
}
