import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { main } from "../src/cli.mjs";
import { EXIT_CODES } from "../src/errors.mjs";
import { snapshotRepository } from "../src/git.mjs";
import { readSession, recordSessionTargets, selectSessionPlan } from "../src/session.mjs";
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

test("verify records failed command evidence before returning the failure", async () => {
  const root = temporaryDirectory();
  const profile = fixtureProfile();
  writeJson(root, ".leino/profile.json", profile);
  writeJson(root, ".leino/components/failing.json", {
    schemaVersion: 1,
    id: "failing",
    kind: "integration",
    roots: ["planned.txt"],
    checks: [{
      id: "failing-check",
      cwd: ".",
      argv: ["node", "-e", "process.exit(7)"],
    }],
  });
  writeFile(root, ".gitignore", ".leino/runtime/\n");
  writeFile(root, "planned.txt", "baseline\n");
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: root });
  execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Fixture"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });

  selectSessionPlan(root, profile, {
    active: [{
      planId: "0100-fixture",
      eligible: true,
      writeSet: [{ path: "planned.txt", mode: "write" }],
    }],
  }, "0100-fixture", {
    sessionId: "failed-verify-session",
    snapshot: snapshotRepository(root),
  });
  writeFile(root, "planned.txt", "changed\n");

  const stdout = captureStream();
  const stderr = captureStream();
  const exitCode = await main([
    "verify",
    "--changed",
    "--session",
    "failed-verify-session",
    "--repo",
    root,
    "--json",
  ], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(exitCode, EXIT_CODES.checkFailed, stderr.value());
  const state = readSession(root, profile.runtimeDir, "failed-verify-session");
  assert.deepEqual(state.ledger.targets, ["planned.txt"]);
  const check = state.ledger.checks[0];
  assert.equal(check.id, "failing-check");
  assert.equal(check.cwd, ".");
  assert.deepEqual(check.argv, ["node", "-e", "process.exit(7)"]);
  assert.equal(check.exitCode, 7);
  assert.equal(check.dryRun, false);
  assert.deepEqual(check.checkedPaths, ["planned.txt"]);
  assert.match(check.inputFingerprint, /^[0-9a-f]{64}$/);
});

test("verify executes the profile-declared executable instead of a PATH shim", async () => {
  const root = temporaryDirectory();
  const variable = "LEINO_TEST_DECLARED_CHECK";
  const previous = process.env[variable];
  const declaredExecutable = process.platform === "win32"
    ? writeFile(
      root,
      "bin/declared-check.cmd",
      "@echo off\r\n<nul set /p \"=%~1\"\r\nexit /b 0\r\n",
    )
    : writeFile(
      root,
      "bin/declared-check",
      "#!/bin/sh\nprintf '%s' \"$1\"\n",
    );
  if (process.platform !== "win32") {
    fs.chmodSync(declaredExecutable, 0o755);
  }
  try {
    process.env[variable] = declaredExecutable;
    writeJson(root, ".leino/profile.json", fixtureProfile({
      toolchain: {
        requiredExecutables: [`declared-check@env:${variable}`],
        minimumVersions: {},
        versionProbes: {},
        capabilities: [],
      },
    }));
    writeJson(root, ".leino/components/declared.json", {
      schemaVersion: 1,
      id: "declared",
      kind: "integration",
      roots: ["planned.txt"],
      checks: [{
        id: "declared-check",
        cwd: ".",
        argv: ["declared-check", "declared resolver"],
      }],
    });
    writeFile(root, "planned.txt", "fixture\n");

    const stdout = captureStream();
    const stderr = captureStream();
    const exitCode = await main([
      "verify",
      "--paths",
      "planned.txt",
      "--repo",
      root,
      "--json",
    ], {
      stdout: stdout.stream,
      stderr: stderr.stream,
    });
    assert.equal(exitCode, EXIT_CODES.ok, stderr.value());
    const envelope = JSON.parse(stdout.value());
    assert.equal(envelope.data.checks[0].stdout, "declared resolver");
    assert.deepEqual(envelope.data.checks[0].argv, [
      "declared-check",
      "declared resolver",
    ]);
  } finally {
    if (previous === undefined) {
      delete process.env[variable];
    } else {
      process.env[variable] = previous;
    }
  }
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
  recordSessionTargets(root, fixtureProfile(), "queue-session", ["src/change.js"]);
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
