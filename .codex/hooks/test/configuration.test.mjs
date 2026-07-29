import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

test("hooks use one PreToolUse dispatcher and Windows overrides", () => {
  const configuration = JSON.parse(
    fs.readFileSync(path.join(repoRoot, ".codex", "hooks.json"), "utf8"),
  );
  const preTool = configuration.hooks.PreToolUse;
  assert.equal(preTool.length, 1);
  assert.match(preTool[0].matcher, /Agent/);
  assert.match(preTool[0].matcher, /spawn_agent/);
  assert.match(preTool[0].matcher, /collaborationspawn_agent/);
  assert.equal(preTool[0].hooks.length, 1);
  assert.match(preTool[0].hooks[0].commandWindows, /^node -e /);
  assert.match(preTool[0].hooks[0].commandWindows, /\.codex','hooks','pre-tool-use\.mjs/);
  assert.doesNotMatch(preTool[0].hooks[0].commandWindows, /git rev-parse/);
});

test("project config caps depth and thread count", () => {
  const configuration = fs.readFileSync(path.join(repoRoot, ".codex", "config.toml"), "utf8");
  assert.match(configuration, /hooks = true/);
  assert.match(configuration, /max_threads = 3/);
  assert.match(configuration, /max_depth = 1/);
});

test("repository generator registry is valid and intentionally empty", () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(repoRoot, ".leino", "generators.json"), "utf8"),
  );
  assert.deepEqual(registry, {
    schemaVersion: 1,
    generators: [],
  });
});
