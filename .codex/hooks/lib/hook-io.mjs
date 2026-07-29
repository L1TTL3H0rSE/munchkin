import { decodeUtf8Strict } from "./encoding.mjs";

export async function readHookInput(stream = process.stdin) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = decodeUtf8Strict(Buffer.concat(chunks), "hook stdin");
  if (!text.trim()) {
    throw new Error("hook stdin is empty");
  }
  return JSON.parse(text);
}

export function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

export function failClosed(error, prefix = "HARNESS") {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${prefix}: ${message}\n`);
  process.exitCode = 2;
}
