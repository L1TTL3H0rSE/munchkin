import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadPlanRegistry, parsePlanFile } from "../lib/plans.mjs";

function planText({
  planId = "0041-fixture-plan",
  status = "in_progress",
  approvalStatus = "approved",
  confirmed = "2026-07-22, test user",
  claim = "src/**",
} = {}) {
  return [
    "# PLAN: Fixture",
    "",
    `- **Plan ID:** \`${planId}\``,
    `- **Статус:** ${status}`,
    "",
    "## Scope",
    "",
    "### Write set",
    "",
    "| Путь/ресурс | Режим | Причина |",
    "|---|---|---|",
    `| \`${claim}\` | write | fixture |`,
    "",
    "## Согласование",
    "",
    `- **Статус:** ${approvalStatus}`,
    `- **Подтверждено:** ${confirmed}`,
    "",
  ].join("\n");
}

function temporaryRegistry() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "munchkin-plan-test-"));
  fs.mkdirSync(path.join(root, "docs", "agents", "plans", "active"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "agents", "plans", "archive"), { recursive: true });
  return root;
}

test("approved plan with a valid claim is eligible", () => {
  const root = temporaryRegistry();
  const file = path.join(root, "docs", "agents", "plans", "active", "0041-fixture-plan.md");
  fs.writeFileSync(file, planText(), "utf8");
  const plan = parsePlanFile(file, "active");
  assert.equal(plan.eligible, true);
  assert.deepEqual(plan.issues, []);
});

test("header and approval drift invalidates a plan", () => {
  const root = temporaryRegistry();
  const file = path.join(root, "docs", "agents", "plans", "active", "0041-fixture-plan.md");
  fs.writeFileSync(file, planText({ status: "awaiting_approval" }), "utf8");
  const plan = parsePlanFile(file, "active");
  assert.equal(plan.eligible, false);
  assert.ok(plan.issues.some((issue) => issue.code === "approval-status-mismatch"));
});

test("an invalid plan status is rejected", () => {
  const root = temporaryRegistry();
  const file = path.join(root, "docs", "agents", "plans", "active", "0041-fixture-plan.md");
  fs.writeFileSync(file, planText({ status: "running" }), "utf8");
  const plan = parsePlanFile(file, "active");
  assert.ok(plan.issues.some((issue) => issue.code === "invalid-plan-status"));
});

test("path traversal claim and wrong placement are rejected", () => {
  const root = temporaryRegistry();
  const file = path.join(root, "docs", "agents", "plans", "archive", "0041-fixture-plan.md");
  fs.writeFileSync(file, planText({ claim: "../outside", status: "in_progress" }), "utf8");
  const plan = parsePlanFile(file, "archive");
  assert.ok(plan.issues.some((issue) => issue.code === "invalid-write-claim"));
  assert.ok(plan.issues.some((issue) => issue.code === "wrong-plan-placement"));
});

test("duplicate plan IDs are rejected across active and archive", () => {
  const root = temporaryRegistry();
  const active = path.join(root, "docs", "agents", "plans", "active", "0041-fixture-plan.md");
  const archive = path.join(root, "docs", "agents", "plans", "archive", "0041-fixture-plan.md");
  fs.writeFileSync(active, planText(), "utf8");
  fs.writeFileSync(archive, planText({ status: "completed" }), "utf8");
  const registry = loadPlanRegistry(root);
  assert.ok(registry.all.every(
    (plan) => plan.issues.some((issue) => issue.code === "duplicate-plan-id"),
  ));
});

test("different plan IDs cannot reuse a four-digit prefix", () => {
  const root = temporaryRegistry();
  const active = path.join(root, "docs", "agents", "plans", "active", "0041-fixture-plan.md");
  const archive = path.join(root, "docs", "agents", "plans", "archive", "0041-other-plan.md");
  fs.writeFileSync(active, planText(), "utf8");
  fs.writeFileSync(
    archive,
    planText({ planId: "0041-other-plan", status: "completed" }),
    "utf8",
  );
  const registry = loadPlanRegistry(root);
  assert.ok(registry.all.every(
    (plan) => plan.issues.some((issue) => issue.code === "duplicate-plan-prefix"),
  ));
  assert.ok(registry.all.every((plan) => plan.eligible === false));
});

test("generated, migration, source and delete claims authorize mutations", () => {
  const root = temporaryRegistry();
  for (const mode of ["source", "generated", "migration", "delete"]) {
    const planId = `004${mode.length}-${mode}-fixture`;
    const file = path.join(root, "docs", "agents", "plans", "active", `${planId}.md`);
    fs.writeFileSync(file, planText({ planId }).replace("| write | fixture |", `| ${mode} | fixture |`), "utf8");
    const plan = parsePlanFile(file, "active");
    assert.deepEqual(plan.writeSet, [{ path: "src/**", mode }]);
  }
});
