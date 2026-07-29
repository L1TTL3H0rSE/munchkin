import assert from "node:assert/strict";
import test from "node:test";
import { evaluateStopState } from "../lib/stop-policy.mjs";

test("foreign in-progress plans do not block an unbound session", () => {
  assert.deepEqual(
    evaluateStopState({
      session: null,
      plan: null,
      scope: null,
      registryIssues: [],
    }),
    { block: false, warnings: [], reasons: [] },
  );
});

test("selected session blocks only after writes with unresolved selected plan", () => {
  const session = { ledger: { targets: ["src/new.js"] } };
  const plan = { planId: "0055-fixture", status: "in_progress", unchecked: 2 };
  const scope = {
    changed: ["src/new.js"],
    outsideWriteSet: [],
    unledgered: [],
  };
  const result = evaluateStopState({ session, plan, scope });
  assert.equal(result.block, true);
  assert.deepEqual(result.reasons, ["2 unchecked plan item(s) remain"]);
});

test("scope violations block and unledgered writes stay visible", () => {
  const result = evaluateStopState({
    session: { ledger: { targets: [] } },
    plan: { planId: "0055-fixture", status: "approved", unchecked: 0 },
    scope: {
      changed: ["outside.txt"],
      outsideWriteSet: ["outside.txt"],
      unledgered: ["outside.txt"],
    },
  });
  assert.equal(result.block, true);
  assert.ok(result.reasons[0].includes("outside selected write set"));
  assert.ok(result.warnings[0].includes("not recorded"));
});

test("approved plans with writes still require checklist and canonical checks", () => {
  const result = evaluateStopState({
    session: { ledger: { targets: ["src/new.js"] } },
    plan: { planId: "0055-fixture", status: "approved", unchecked: 1 },
    scope: {
      changed: ["src/new.js"],
      outsideWriteSet: [],
      unledgered: [],
      missingRequiredChecks: [{ id: "test" }],
    },
  });
  assert.equal(result.block, true);
  assert.deepEqual(result.reasons, [
    "1 unchecked plan item(s) remain",
    "1 required check(s) remain",
  ]);
});

test("scope errors and missing selected plans fail closed after writes", () => {
  const session = { ledger: { targets: ["src/new.js"] } };
  const scopeError = evaluateStopState({
    session,
    plan: { planId: "0055-fixture", status: "in_progress", unchecked: 0 },
    scope: {
      changed: ["src/new.js"],
      outsideWriteSet: [],
      unledgered: [],
      error: "selected plan is no longer eligible",
    },
  });
  assert.equal(scopeError.block, true);
  assert.match(scopeError.reasons[0], /scope check failed/);

  const missingPlan = evaluateStopState({
    session,
    plan: null,
    scope: {
      changed: ["src/new.js"],
      outsideWriteSet: [],
      unledgered: [],
    },
  });
  assert.equal(missingPlan.block, true);
  assert.match(missingPlan.reasons[0], /selected plan is missing/);
});
