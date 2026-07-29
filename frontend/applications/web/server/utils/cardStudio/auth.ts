import {createHash, timingSafeEqual} from "node:crypto";
import type {CardStudioConfig} from "./config";
import {StudioError} from "./errors";

export function authorizeCardStudio(
  config: CardStudioConfig,
  authorizationHeader: string | undefined,
) {
  if (!config.enabled || config.token.length < 32) {
    throw new StudioError(
      "STUDIO_DISABLED",
      "Card Studio выключена.",
      404,
    );
  }
  const match = /^Bearer ([^\s]+)$/.exec(authorizationHeader ?? "");
  const presentedToken = match?.[1];
  if (!presentedToken || !equalSecret(presentedToken, config.token)) {
    throw new StudioError(
      "UNAUTHORIZED",
      "Требуется отдельный Card Studio bearer token.",
      401,
    );
  }
}

function equalSecret(actual: string, expected: string) {
  const actualHash = createHash("sha256").update(actual, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualHash, expectedHash);
}
