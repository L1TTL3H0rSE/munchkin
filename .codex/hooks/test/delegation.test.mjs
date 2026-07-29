import assert from "node:assert/strict";
import test from "node:test";
import { validateDelegation } from "../lib/delegation.mjs";

function validInput(overrides = {}, metadataOverrides = {}) {
  const metadata = {
    scope: "audit one frontend adapter",
    independent_from: "root traces the component",
    root_parallel_work: "trace component state and integration boundary",
    expected_savings: "parallel independent adapter evidence avoids serial waiting",
    access: "read-only",
    write_set: [],
    context_turns: "none",
    stop_condition: "return endpoint parameters with paths",
    ...metadataOverrides,
  };
  return {
    message: `DELEGATION_META ${JSON.stringify(metadata)}\nInspect the adapter only.`,
    fork_turns: "none",
    model: "gpt-5.6-terra",
    reasoning_effort: "medium",
    ...overrides,
  };
}

test("bounded independent read-only delegation passes", () => {
  assert.deepEqual(validateDelegation(validInput()), []);
  assert.deepEqual(validateDelegation(validInput({
    agent_type: "explorer",
    model: undefined,
    reasoning_effort: undefined,
  })), []);
});

test("missing metadata and implicit profile fail", () => {
  assert.equal(
    validateDelegation({ message: "inspect it" })[0].code,
    "delegation-metadata-missing",
  );
  assert.ok(
    validateDelegation(validInput({ model: undefined })).some(
      (issue) => issue.code === "delegation-profile-implicit",
    ),
  );
});

test("waiting and unbounded history need concrete justification", () => {
  assert.ok(
    validateDelegation(validInput({}, { root_parallel_work: "wait" })).some(
      (issue) => issue.code === "delegation-no-root-parallel-work",
    ),
  );
  assert.ok(
    validateDelegation(validInput(
      { fork_turns: "all" },
      { context_turns: "all" },
    )).some((issue) => issue.code === "delegation-full-history-unjustified"),
  );
});

test("write delegation is unsupported without a provable worktree binding", () => {
  const registry = {
    active: [{
      planId: "0040-enforce-agent-workflow-guardrails",
      eligible: true,
      writeSet: [{ path: ".codex/hooks/**" }],
    }],
  };
  const issues = validateDelegation(
    validInput({}, {
      access: "write",
      plan_id: "0040-enforce-agent-workflow-guardrails",
      worktree: "C:/workspace/other",
      write_set: [".codex/hooks/new.mjs"],
    }),
    { registry, repoRoot: "C:/workspace/repo" },
  );
  assert.ok(issues.some((issue) => issue.code === "delegation-write-binding-unsupported"));
});
