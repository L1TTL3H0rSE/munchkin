import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  decodeUtf8Strict,
  detectMojibake,
  isLikelyTextPath,
  validateTextFile,
} from "../lib/encoding.mjs";

test("strict UTF-8 preserves Cyrillic without a BOM", () => {
  const expected = "Механически закрепить workflow AI-агентов";
  assert.equal(decodeUtf8Strict(new TextEncoder().encode(expected)), expected);
});

test("strict UTF-8 accepts a BOM and rejects Windows-1251 bytes", () => {
  const expected = "Кириллица";
  const encoded = new TextEncoder().encode(expected);
  const withBom = Uint8Array.from([0xEF, 0xBB, 0xBF, ...encoded]);
  assert.equal(decodeUtf8Strict(withBom), expected);
  assert.throws(
    () => decodeUtf8Strict(Uint8Array.from([0xCA, 0xE8, 0xF0]), "cp1251.txt"),
    /invalid UTF-8/,
  );
});

test("strict UTF-8 rejects invalid bytes and U+FFFD", () => {
  assert.throws(
    () => decodeUtf8Strict(Uint8Array.from([0xD0, 0x20]), "invalid.txt"),
    /invalid UTF-8/,
  );
  assert.throws(
    () => decodeUtf8Strict(new TextEncoder().encode("bad \uFFFD text"), "replacement.txt"),
    /U\+FFFD/,
  );
});

test("mojibake detector catches UTF-8 decoded as Windows-1251", () => {
  const source = "Механически закрепить работу агентов";
  const damaged = new TextDecoder("windows-1251").decode(new TextEncoder().encode(source));
  assert.ok(detectMojibake(damaged).some((issue) => issue.code === "likely-utf8-as-windows1251"));
});

test("mojibake detector accepts normal Russian text with Р and С", () => {
  const source = "Результат сверки: сервис работает, страница сохраняется.";
  assert.deepEqual(detectMojibake(source), []);
});

test("repository contract and manifest formats are validated as text", () => {
  for (const file of [
    "contract.proto",
    "go.mod",
    "go.sum",
    "gradle.properties",
    "Cargo.lock",
    "pnpm-lock.yaml",
  ]) {
    assert.equal(isLikelyTextPath(file), true, file);
  }
});

test("text validation returns detected mojibake issues", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "munchkin-encoding-test-"));
  const file = path.join(directory, "contract.proto");
  const damaged = new TextDecoder("windows-1251").decode(
    new TextEncoder().encode("Механически закрепить работу агентов"),
  );
  fs.writeFileSync(file, damaged, "utf8");
  assert.ok(
    validateTextFile(file).issues.some((issue) => issue.code === "likely-utf8-as-windows1251"),
  );
});
