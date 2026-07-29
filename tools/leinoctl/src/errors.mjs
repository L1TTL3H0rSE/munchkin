export const EXIT_CODES = Object.freeze({
  ok: 0,
  usage: 2,
  policy: 3,
  dirty: 4,
  checkFailed: 5,
  internal: 10,
});

export class LeinoError extends Error {
  constructor(code, message, {
    exitCode = EXIT_CODES.policy,
    details = [],
    cause,
  } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "LeinoError";
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

export function asLeinoError(error) {
  if (error instanceof LeinoError) {
    return error;
  }
  return new LeinoError(
    "internal-error",
    error instanceof Error ? error.message : String(error),
    { exitCode: EXIT_CODES.internal, cause: error instanceof Error ? error : undefined },
  );
}
