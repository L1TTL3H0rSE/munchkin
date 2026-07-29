import {ZodError} from "zod";

export type StudioErrorCode =
  | "STUDIO_DISABLED"
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PROVIDER_UNAVAILABLE"
  | "GENERATION_FAILED"
  | "INVALID_IMAGE"
  | "INTERNAL_ERROR";

export class StudioError extends Error {
  readonly code: StudioErrorCode;
  readonly statusCode: number;

  constructor(code: StudioErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = "StudioError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function safeStudioError(error: unknown) {
  if (error instanceof StudioError) {
    return error;
  }
  if (error instanceof ZodError) {
    return new StudioError(
      "INVALID_REQUEST",
      "Запрос Card Studio не прошёл проверку.",
      400,
    );
  }
  return new StudioError(
    "INTERNAL_ERROR",
    "Card Studio не завершила операцию.",
    500,
  );
}
