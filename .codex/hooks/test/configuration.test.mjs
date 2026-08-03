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
  assert.match(configuration, /default_subagent_model = "gpt-5\.6-luna"/);
  assert.match(configuration, /default_subagent_reasoning_effort = "high"/);
});

test("planning agents use bounded role-specific model routing", () => {
  const explorer = fs.readFileSync(
    path.join(repoRoot, ".codex", "agents", "explorer.toml"),
    "utf8",
  );
  const reviewer = fs.readFileSync(
    path.join(repoRoot, ".codex", "agents", "reviewer.toml"),
    "utf8",
  );
  assert.match(explorer, /model = "gpt-5\.6-luna"/);
  assert.match(explorer, /model_reasoning_effort = "high"/);
  assert.match(explorer, /sandbox_mode = "read-only"/);
  assert.match(reviewer, /model = "gpt-5\.6-terra"/);
  assert.match(reviewer, /model_reasoning_effort = "high"/);
  assert.match(reviewer, /sandbox_mode = "read-only"/);
});

test("planning workflow requires classification, packages, and evidence", () => {
  const instructions = fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
  const template = fs.readFileSync(
    path.join(repoRoot, "docs", "agents", "plans", "_template.md"),
    "utf8",
  );
  const delegation = fs.readFileSync(
    path.join(repoRoot, "docs", "agents", "DELEGATION.md"),
    "utf8",
  );
  const sessionStart = fs.readFileSync(
    path.join(repoRoot, ".codex", "hooks", "session-start.mjs"),
    "utf8",
  );
  assert.match(template, /^## Delegation strategy$/m);
  assert.match(template, /^### Preliminary work packages$/m);
  assert.match(template, /^### Actual delegation evidence$/m);
  assert.match(template, /root-only pending worktree orchestration/);
  assert.match(instructions, /Large задача[\s\S]+обязана использовать planning agents/);
  assert.match(instructions, /запускает explorers[\s\S]+отдельному\s+reviewer/);
  assert.match(delegation, /large — planning delegation required/);
  assert.match(delegation, /small — not needed/);
  assert.match(delegation, /DELEGATION_META/);
  assert.match(sessionStart, /Classify plan delegation before approval/);
  assert.match(sessionStart, /root\/Sol synthesizes/);
  assert.match(sessionStart, /Luna explorer/);
  assert.match(sessionStart, /Terra reviewer/);
  assert.match(sessionStart, /ambiguity or risk/);
  assert.match(sessionStart, /docs\/agents\/DELEGATION\.md/);
  assert.match(sessionStart, /only a new trusted session proves/);

  for (const skillName of [
    "backend-game-change",
    "content-pack-change",
    "frontend-game-change",
    "repository-workflow-change",
  ]) {
    const skill = fs.readFileSync(
      path.join(repoRoot, ".agents", "skills", skillName, "SKILL.md"),
      "utf8",
    );
    assert.match(skill, /Create a skeleton[\s\S]+classify delegation before approval/);
    assert.match(skill, /For a large[\s\S]+bounded explorers[\s\S]+reviewer/);
    assert.match(skill, /for\s+small[\s\S]+delegation is not needed/i);
  }
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
