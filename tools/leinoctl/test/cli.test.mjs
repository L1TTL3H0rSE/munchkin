import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { main } from "../src/cli.mjs";
import { EXIT_CODES } from "../src/errors.mjs";
import { snapshotRepository } from "../src/git.mjs";
import { readSession, selectSessionPlan } from "../src/session.mjs";
import { fixtureProfile, temporaryDirectory, writeFile, writeJson } from "./helpers.mjs";

function captureStream() {
  let value = "";
  return {
    stream: {
      write(chunk) {
        value += chunk;
      },
    },
    value() {
      return value;
    },
  };
}

function planText(planId, status, writePath) {
  return [
    `# PLAN: ${planId}`,
    "",
    `- **Plan ID:** \`${planId}\``,
    `- **Статус:** ${status}`,
    "- **Владелец:** Fixture",
    "- **Workspace:** shared",
    "- **Режим параллельности:** exclusive",
    "",
    "## Machine-readable manifest",
    "",
    "```json",
    JSON.stringify({
      schemaVersion: 1,
      paths: [
        writePath,
        `.plans/active/${planId}.md`,
        `.plans/archive/${planId}.md`,
      ],
      components: [],
      contracts: [],
      dependsOn: [],
      sharedResources: [],
    }, null, 2),
    "```",
    "",
    "## Координация с другими планами",
    "",
    "### Write set",
    "",
    "| Path | Mode | Reason |",
    "|---|---|---|",
    `| \`${writePath}\` | write | fixture |`,
    `| \`.plans/active/${planId}.md\` | write | lifecycle |`,
    `| \`.plans/archive/${planId}.md\` | write | lifecycle |`,
    "",
    "## Согласование",
    "",
    "- **Статус:** approved",
    "- **Подтверждено:** 2026-07-31 00:00 UTC",
    "",
  ].join("\n");
}

test("CLI reports parse and command option failures as versioned JSON", async () => {
  for (const argv of [
    ["components", "--json", "--unknown"],
    ["components", "--json", "--jobs", "4"],
  ]) {
    const stdout = captureStream();
    const stderr = captureStream();
    const exitCode = await main(argv, {
      stdout: stdout.stream,
      stderr: stderr.stream,
    });
    assert.equal(exitCode, EXIT_CODES.usage);
    assert.equal(stdout.value(), "");
    const envelope = JSON.parse(stderr.value());
    assert.equal(envelope.schemaVersion, 1);
    assert.equal(envelope.tool.name, "leinoctl");
    assert.equal(envelope.ok, false);
    assert.equal(envelope.errors.length, 1);
  }
});

test("compose command owns parallelism and preserves literal arguments", async () => {
  const root = temporaryDirectory();
  writeJson(root, ".leino/profile.json", fixtureProfile({
    composeFiles: ["compose.yml"],
  }));
  const stdout = captureStream();
  const stderr = captureStream();
  const exitCode = await main([
    "compose",
    "--dry-run",
    "--jobs",
    "8",
    "--repo",
    root,
    "--json",
    "--",
    "up",
    "--build",
    "fixture service",
  ], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(exitCode, EXIT_CODES.ok, stderr.value());
  const envelope = JSON.parse(stdout.value());
  assert.deepEqual(envelope.data.commands[0].argv, [
    "docker",
    "compose",
    "--parallel",
    "8",
    "-f",
    "compose.yml",
    "up",
    "--build",
    "fixture service",
  ]);
});

test("components path selection emits only the impact closure", async () => {
  const root = temporaryDirectory();
  writeJson(root, ".leino/profile.json", fixtureProfile());
  writeJson(root, ".leino/components/source.json", {
    schemaVersion: 1,
    id: "source",
    kind: "integration",
    roots: ["src"],
  });
  writeJson(root, ".leino/components/consumer.json", {
    schemaVersion: 1,
    id: "consumer",
    kind: "integration",
    roots: ["consumer"],
    consumes: ["source"],
  });
  const stdout = captureStream();
  const stderr = captureStream();
  const exitCode = await main([
    "components",
    "--paths",
    "src/file.txt",
    "--repo",
    root,
    "--json",
  ], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(exitCode, EXIT_CODES.ok, stderr.value());
  const envelope = JSON.parse(stdout.value());
  assert.deepEqual(
    envelope.data.components.map((entry) => entry.id),
    ["consumer", "source"],
  );
  assert.equal(envelope.data.counts.components, 2);
});

test("context includes plans matched only through impacted component contracts", async () => {
  const root = temporaryDirectory();
  writeJson(root, ".leino/profile.json", fixtureProfile());
  writeJson(root, ".leino/components/source.json", {
    schemaVersion: 1,
    id: "source",
    kind: "integration",
    roots: ["src"],
    contracts: ["fixture:public-api"],
  });
  writeFile(root, "AGENTS.md", "root instructions\n");
  writeFile(root, "src/AGENTS.md", "source instructions\n");
  writeFile(root, ".plans/active/0100-contract-plan.md", [
    "# PLAN: Contract",
    "",
    "- **Plan ID:** `0100-contract-plan`",
    "- **Статус:** awaiting_approval",
    "",
    "## Machine-readable manifest",
    "",
    "```json",
    JSON.stringify({
      schemaVersion: 1,
      paths: ["other/**"],
      components: [],
      contracts: ["fixture:public-api"],
      dependsOn: [],
      sharedResources: [],
    }, null, 2),
    "```",
    "",
    "## Координация с другими планами",
    "",
    "### Write set",
    "",
    "| Path | Mode | Reason |",
    "|---|---|---|",
    "| `other/**` | write | fixture |",
    "",
  ].join("\n"));
  const stdout = captureStream();
  const stderr = captureStream();
  const exitCode = await main([
    "context",
    "--paths",
    "src/file.txt",
    "--repo",
    root,
    "--json",
  ], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(exitCode, EXIT_CODES.ok, stderr.value());
  const envelope = JSON.parse(stdout.value());
  assert.deepEqual(envelope.data.instructions, ["AGENTS.md", "src/AGENTS.md"]);
  assert.deepEqual(envelope.data.plans.map((plan) => plan.planId), [
    "0100-contract-plan",
  ]);
});

test("verify without an explicit base ignores dirty state that predates session selection", async () => {
  const root = temporaryDirectory();
  writeJson(root, ".leino/profile.json", fixtureProfile());
  writeJson(root, ".leino/components/user.json", {
    schemaVersion: 1,
    id: "user-dirty",
    kind: "integration",
    roots: ["user.txt"],
    checks: [{ id: "user-check", cwd: ".", argv: ["node", "-e", "0"] }],
  });
  writeJson(root, ".leino/components/planned.json", {
    schemaVersion: 1,
    id: "planned",
    kind: "integration",
    roots: ["planned.txt"],
    checks: [{ id: "planned-check", cwd: ".", argv: ["node", "-e", "0"] }],
  });
  writeFile(root, ".gitignore", ".leino/runtime/\n");
  writeFile(root, "user.txt", "baseline\n");
  writeFile(root, "planned.txt", "baseline\n");
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: root });
  execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Fixture"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });

  writeFile(root, "user.txt", "pre-existing user change\n");
  const profile = fixtureProfile();
  selectSessionPlan(root, profile, {
    active: [{
      planId: "0100-fixture",
      eligible: true,
      writeSet: [{ path: "planned.txt", mode: "write" }],
    }],
  }, "0100-fixture", {
    sessionId: "verify-session",
    snapshot: snapshotRepository(root),
  });
  writeFile(root, "planned.txt", "planned session change\n");

  const stdout = captureStream();
  const stderr = captureStream();
  const exitCode = await main([
    "verify",
    "--changed",
    "--dry-run",
    "--session",
    "verify-session",
    "--repo",
    root,
    "--json",
  ], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(exitCode, EXIT_CODES.ok, stderr.value());
  const envelope = JSON.parse(stdout.value());
  assert.deepEqual(envelope.data.paths, ["planned.txt"]);
  assert.deepEqual(envelope.data.components, ["planned"]);
  assert.equal(
    readSession(root, profile.runtimeDir, "verify-session").ledger.checks.length,
    1,
  );
});

test("CLI rotates completed plans in one session only after a separate commit", async () => {
  const root = temporaryDirectory();
  const firstPlan = "0100-first";
  const nextPlan = "0101-next";
  writeJson(root, ".leino/profile.json", fixtureProfile());
  writeFile(root, ".gitignore", ".leino/runtime/\n");
  writeFile(
    root,
    `.plans/active/${firstPlan}.md`,
    planText(firstPlan, "in_progress", "src/**"),
  );
  writeFile(
    root,
    `.plans/active/${nextPlan}.md`,
    planText(nextPlan, "approved", "next/**"),
  );
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: root });
  execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Fixture"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });

  let stdout = captureStream();
  let stderr = captureStream();
  let exitCode = await main([
    "plan",
    "select",
    firstPlan,
    "--session",
    "queue-session",
    "--repo",
    root,
    "--json",
  ], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(exitCode, EXIT_CODES.ok, stderr.value());

  writeFile(root, "src/change.js", "export const changed = true;\n");
  fs.unlinkSync(`${root}/.plans/active/${firstPlan}.md`);
  writeFile(
    root,
    `.plans/archive/${firstPlan}.md`,
    planText(firstPlan, "completed", "src/**"),
  );

  stdout = captureStream();
  stderr = captureStream();
  exitCode = await main([
    "plan",
    "release",
    firstPlan,
    "--session",
    "queue-session",
    "--repo",
    root,
    "--json",
  ], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(exitCode, EXIT_CODES.ok, stderr.value());
  assert.equal(JSON.parse(stdout.value()).data.mode, "rotation");
  assert.equal(readSession(root, ".leino/runtime", "queue-session"), null);

  stdout = captureStream();
  stderr = captureStream();
  exitCode = await main([
    "plan",
    "select",
    nextPlan,
    "--session",
    "queue-session",
    "--repo",
    root,
    "--json",
  ], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(exitCode, EXIT_CODES.policy);
  assert.match(stderr.value(), /commit completed plan/);

  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "complete first"], { cwd: root });

  stdout = captureStream();
  stderr = captureStream();
  exitCode = await main([
    "plan",
    "select",
    nextPlan,
    "--session",
    "queue-session",
    "--repo",
    root,
    "--json",
  ], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(exitCode, EXIT_CODES.ok, stderr.value());
  const state = readSession(root, ".leino/runtime", "queue-session");
  assert.equal(state.planId, nextPlan);
  assert.deepEqual(state.ledger, { targets: [], checks: [] });
  assert.deepEqual(
    state.rotationHistory.map((entry) => entry.planId),
    [firstPlan],
  );
});
