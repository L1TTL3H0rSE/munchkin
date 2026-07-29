import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function runScript(script, args = [], env = {}) {
  return spawnSync("bash", [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("package bin entrypoint exists and is not hidden by repository ignores", () => {
  const packageRoot = path.join(repoRoot, "tools/leinoctl");
  const manifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const binTarget = manifest.bin?.leinoctl;

  assert.equal(binTarget, "./bin/leinoctl.mjs");
  assert.equal(existsSync(path.resolve(packageRoot, binTarget)), true);

  const ignored = spawnSync(
    "git",
    ["check-ignore", "--no-index", "--quiet", "tools/leinoctl/bin/leinoctl.mjs"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(
    ignored.status,
    1,
    `package entrypoint must be committable: ${ignored.stderr || ignored.stdout}`,
  );
});

test("root Compose entrypoint rejects parallelism below the repository minimum", () => {
  const result = runScript("scripts/dev.sh", [], { LEINO_COMPOSE_PARALLEL: "3" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /integer >= 4/);
});

test("dev entrypoint owns the single Compose parallel option", () => {
  for (const args of [["--parallel", "8"], ["--parallel=8"]]) {
    const result = runScript("scripts/dev.sh", args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Do not pass --parallel directly/);
  }
});
