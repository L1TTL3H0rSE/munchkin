import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { evaluatePreToolUse, preToolHookOutput } from "../lib/policy.mjs";
import {
  claimPlanLifecycle,
  lifecyclePlanIdsForSession,
} from "../../../tools/leinoctl/src/session.mjs";

const repoRoot = path.resolve("C:/workspace/repo");
const registry = {
  active: [{
    planId: "0040-enforce-agent-workflow-guardrails",
    eligible: true,
    writeSet: [
      { path: ".codex/hooks/**" },
      { path: "docs/agents/plans/active/0040-enforce-agent-workflow-guardrails.md" },
    ],
  }],
};

test("Bash policy blocks missing Docker parallel and unsafe reads", () => {
  assert.equal(
    evaluatePreToolUse(
      { tool_name: "Bash", tool_input: { command: "docker compose up" } },
      { repoRoot, registry, platform: "win32" },
    ).code,
    "docker-parallel-missing",
  );
  assert.equal(
    evaluatePreToolUse(
      { tool_name: "Bash", tool_input: { command: "Get-Content file.md" } },
      { repoRoot, registry, platform: "win32" },
    ).code,
    "unsafe-text-read-encoding",
  );
});

test("current and documented agent tool names require delegation metadata", () => {
  for (const toolName of [
    "Agent",
    "spawn_agent",
    "collaboration.spawn_agent",
    "collaborationspawn_agent",
  ]) {
    assert.equal(
      evaluatePreToolUse(
        { tool_name: toolName, tool_input: { message: "inspect it" } },
        { repoRoot, registry, platform: "win32" },
      ).code,
      "delegation-metadata-missing",
    );
  }
});

test("apply_patch requires a matching write-set claim", () => {
  const allowed = [
    "*** Begin Patch",
    `*** Add File: ${path.join(repoRoot, ".codex", "hooks", "new.mjs")}`,
    "+export const ok = true;",
    "*** End Patch",
  ].join("\n");
  const denied = allowed
    .replace(".codex\\hooks\\new.mjs", "src\\unclaimed.mjs")
    .replace(".codex/hooks/new.mjs", "src/unclaimed.mjs");

  assert.equal(
    evaluatePreToolUse(
      { tool_name: "apply_patch", tool_input: { command: allowed } },
      {
        repoRoot,
        registry,
        selectedPlanId: "0040-enforce-agent-workflow-guardrails",
        lifecycleOwnedPlanIds: ["0040-enforce-agent-workflow-guardrails"],
        platform: "win32",
      },
    ).action,
    "allow",
  );
  assert.equal(
    evaluatePreToolUse(
      { tool_name: "apply_patch", tool_input: { command: denied } },
      {
        repoRoot,
        registry,
        selectedPlanId: "0040-enforce-agent-workflow-guardrails",
        lifecycleOwnedPlanIds: ["0040-enforce-agent-workflow-guardrails"],
        platform: "win32",
      },
    ).code,
    "selected-plan-write-set-mismatch",
  );
});

test("apply_patch resolves relative targets from the tool cwd", () => {
  const nestedRegistry = {
    active: [{
      planId: "0040-enforce-agent-workflow-guardrails",
      eligible: true,
      writeSet: [{ path: "frontend/packages/api/src/**" }],
    }],
  };
  const patch = [
    "*** Begin Patch",
    "*** Add File: src/new.ts",
    "+export const ok = true;",
    "*** End Patch",
  ].join("\n");
  const nestedCwd = path.join(repoRoot, "frontend", "packages", "api");

  assert.equal(
    evaluatePreToolUse(
      { tool_name: "apply_patch", cwd: nestedCwd, tool_input: { command: patch } },
      {
        repoRoot,
        registry: nestedRegistry,
        selectedPlanId: "0040-enforce-agent-workflow-guardrails",
        lifecycleOwnedPlanIds: ["0040-enforce-agent-workflow-guardrails"],
        platform: "win32",
      },
    ).action,
    "allow",
  );
  assert.equal(
    evaluatePreToolUse(
      { tool_name: "apply_patch", cwd: repoRoot, tool_input: { command: patch } },
      {
        repoRoot,
        registry: nestedRegistry,
        selectedPlanId: "0040-enforce-agent-workflow-guardrails",
        lifecycleOwnedPlanIds: ["0040-enforce-agent-workflow-guardrails"],
        platform: "win32",
      },
    ).code,
    "selected-plan-write-set-mismatch",
  );
});

test("non-lifecycle writes require one eligible selected plan", () => {
  const patch = [
    "*** Begin Patch",
    "*** Add File: .codex/hooks/new.mjs",
    "+export const ok = true;",
    "*** End Patch",
  ].join("\n");
  assert.equal(
    evaluatePreToolUse(
      { tool_name: "apply_patch", tool_input: { command: patch } },
      { repoRoot, registry, platform: "win32" },
    ).code,
    "plan-selection-missing",
  );
  assert.equal(
    evaluatePreToolUse(
      { tool_name: "apply_patch", tool_input: { command: patch } },
      { repoRoot, registry, selectedPlanId: "missing-plan", platform: "win32" },
    ).code,
    "selected-plan-not-eligible",
  );
  assert.equal(
    evaluatePreToolUse(
      { tool_name: "apply_patch", tool_input: { command: patch } },
      {
        repoRoot,
        registry,
        selectedPlanId: "0040-enforce-agent-workflow-guardrails",
        platform: "win32",
      },
    ).code,
    "selected-plan-session-owner-mismatch",
  );
});

test("plan lifecycle creation is allowed but later edits require session ownership", () => {
  const newPlanPatch = [
    "*** Begin Patch",
    "*** Add File: docs/agents/plans/active/0042-new-plan.md",
    "+# PLAN: Fixture",
    "*** End Patch",
  ].join("\n");
  const awaitingRegistry = {
    active: [{
      planId: "0041-fixture-plan",
      eligible: false,
      writeSet: [{ path: "src/**" }],
    }],
  };

  assert.equal(
    evaluatePreToolUse(
      { tool_name: "apply_patch", tool_input: { command: newPlanPatch } },
      { repoRoot, registry: awaitingRegistry, platform: "win32" },
    ).action,
    "allow",
  );

  const ownedPlanPatch = [
    "*** Begin Patch",
    "*** Update File: docs/agents/plans/active/0041-fixture-plan.md",
    "@@",
    "-old",
    "+new",
    "*** End Patch",
  ].join("\n");
  assert.equal(
    evaluatePreToolUse(
      { tool_name: "apply_patch", tool_input: { command: ownedPlanPatch } },
      { repoRoot, registry: awaitingRegistry, platform: "win32" },
    ).code,
    "plan-lifecycle-owner-mismatch",
  );
  assert.equal(
    evaluatePreToolUse(
      { tool_name: "apply_patch", tool_input: { command: ownedPlanPatch } },
      {
        repoRoot,
        registry: awaitingRegistry,
        lifecycleOwnedPlanIds: ["0041-fixture-plan"],
        platform: "win32",
      },
    ).action,
    "allow",
  );
});

test("explicit lifecycle takeover revokes the old selected session's write access", () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "leino-policy-owner-"));
  const runtimeDir = ".leino/runtime";
  const planId = "0040-enforce-agent-workflow-guardrails";
  claimPlanLifecycle(runtimeRoot, runtimeDir, planId, "old-session");
  claimPlanLifecycle(runtimeRoot, runtimeDir, planId, "new-session", { takeover: true });
  const patch = [
    "*** Begin Patch",
    "*** Add File: .codex/hooks/new.mjs",
    "+export const ok = true;",
    "*** End Patch",
  ].join("\n");
  const decision = evaluatePreToolUse(
    { tool_name: "apply_patch", tool_input: { command: patch } },
    {
      repoRoot,
      registry,
      selectedPlanId: planId,
      lifecycleOwnedPlanIds: lifecyclePlanIdsForSession(
        runtimeRoot,
        runtimeDir,
        "old-session",
      ),
      platform: "win32",
    },
  );
  assert.equal(decision.code, "selected-plan-session-owner-mismatch");
});

test("apply_patch blocks newly introduced mojibake before write", () => {
  const damaged = new TextDecoder("windows-1251").decode(
    new TextEncoder().encode("Механически закрепить работу агентов"),
  );
  const patch = [
    "*** Begin Patch",
    `*** Add File: ${path.join(repoRoot, ".codex", "hooks", "bad.txt")}`,
    `+${damaged}`,
    "*** End Patch",
  ].join("\n");
  const decision = evaluatePreToolUse(
    { tool_name: "apply_patch", tool_input: { command: patch } },
    { repoRoot, registry, platform: "win32" },
  );
  assert.equal(decision.action, "block");
  assert.equal(
    preToolHookOutput(decision).hookSpecificOutput.permissionDecision,
    "deny",
  );
});
