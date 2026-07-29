import assert from "node:assert/strict";
import test from "node:test";
import {
  validateDockerComposeCommand,
  validateTextReadCommand,
} from "../lib/commands.mjs";

test("Docker Compose requires one parallel value of at least four", () => {
  assert.equal(validateDockerComposeCommand("docker compose config")[0].code, "docker-parallel-missing");
  assert.equal(
    validateDockerComposeCommand("docker compose --parallel 3 up")[0].code,
    "docker-parallel-too-low",
  );
  assert.equal(
    validateDockerComposeCommand("docker compose --parallel nope up")[0].code,
    "docker-parallel-too-low",
  );
  assert.deepEqual(validateDockerComposeCommand("docker compose --parallel 4 config"), []);
  assert.deepEqual(validateDockerComposeCommand("docker.exe compose --parallel=8 up"), []);
});

test("every Docker Compose invocation in a compound command is checked", () => {
  const issues = validateDockerComposeCommand(
    "docker compose --parallel 4 config && docker compose up",
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "docker-parallel-missing");
  assert.equal(
    validateDockerComposeCommand("docker compose --parallel 4 $(Get-Content args.txt)")[0].code,
    "docker-compose-ambiguous",
  );
});

test("PowerShell text reads require explicit UTF-8 or byte mode", () => {
  assert.equal(validateTextReadCommand("Get-Content file.md", "win32")[0].code, "unsafe-text-read-encoding");
  assert.equal(validateTextReadCommand("gc file.md", "win32")[0].code, "unsafe-text-read-encoding");
  assert.equal(validateTextReadCommand("cmd /c type file.md", "win32")[0].code, "unsafe-text-read-encoding");
  assert.deepEqual(validateTextReadCommand("Get-Content -Raw -Encoding utf8 file.md", "win32"), []);
  assert.deepEqual(validateTextReadCommand("Get-Content -Encoding Byte file.md", "win32"), []);
  assert.deepEqual(validateTextReadCommand("rg -n pattern file.md", "win32"), []);
  assert.deepEqual(validateTextReadCommand("type command", "linux"), []);
});
