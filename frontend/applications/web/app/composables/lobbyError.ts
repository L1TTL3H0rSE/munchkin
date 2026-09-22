import {normalizeGameApiError} from "@munchkin/api";
import {lobbyErrorForKind} from "@munchkin/components";

export function lobbyFormError(error: unknown) {
  return lobbyErrorForKind(normalizeGameApiError(error).kind);
}
