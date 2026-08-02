import assert from "node:assert/strict";
import test from "node:test";
import {
  claimPlanLifecycle,
  lifecyclePlanIdsForSession,
  readRotationCheckpoint,
  readSession,
  recordSessionCheck,
  recordSessionTargets,
  releasePlanLifecycle,
  releaseSelectedPlanForRotation,
  resolveSessionId,
  selectSessionPlan,
  sessionScopeReport,
} from "../src/session.mjs";
import { fingerprintSnapshotPaths } from "../src/git.mjs";
import { temporaryDirectory } from "./helpers.mjs";

const cleanSnapshot = {
  schemaVersion: 1,
  capturedAt: "2026-07-27T00:00:00.000Z",
  root: { head: "abc", entries: [] },
  submodules: {},
};

function registry() {
  return {
    active: [{
      planId: "0100-fixture",
      eligible: true,
      writeSet: [{ path: "src/**", mode: "write" }],
    }],
  };
}

function completedRegistry(planId = "0100-fixture") {
  const plan = {
    planId,
    placement: "archive",
    status: "completed",
    unchecked: 0,
    issues: [],
    eligible: false,
    writeSet: [{ path: "src/**", mode: "write" }],
  };
  return {
    active: [],
    archive: [plan],
    all: [plan],
  };
}

test("session selection binds one eligible plan and preserves baseline", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  const state = selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-1",
    snapshot: cleanSnapshot,
  });
  assert.equal(state.planId, "0100-fixture");
  assert.deepEqual(
    readSession(root, profile.runtimeDir, "thread-1").baseline,
    cleanSnapshot,
  );
});

test("scope report catches out-of-plan and unledgered writes", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-2",
    snapshot: cleanSnapshot,
  });
  recordSessionTargets(root, profile, "thread-2", ["src/new.js"]);
  const current = {
    ...cleanSnapshot,
    root: {
      head: "abc",
      entries: [
        { status: " M", path: "src/new.js", fingerprint: "file:1" },
        { status: " M", path: "outside.txt", fingerprint: "file:2" },
      ],
    },
  };
  const report = sessionScopeReport(root, profile, registry(), {
    sessionId: "thread-2",
    current,
  });
  assert.deepEqual(report.outsideWriteSet, ["outside.txt"]);
  assert.deepEqual(report.unledgered, ["outside.txt"]);
  assert.equal(report.ok, false);
});

test("session ledger normalizes and idempotently merges repeated targets and checks", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-ledger-merge",
    snapshot: cleanSnapshot,
  });
  recordSessionTargets(root, profile, "thread-ledger-merge", [".\\src\\two.js", "src/one.js"]);
  recordSessionTargets(root, profile, "thread-ledger-merge", ["src/one.js", "./src/three.js"]);
  const check = {
    id: "fixture-check",
    cwd: ".",
    argv: ["node", "--test"],
    exitCode: 0,
    dryRun: false,
    checkedPaths: ["src\\one.js", "./src/two.js"],
    inputFingerprint: "fingerprint",
  };
  recordSessionCheck(root, profile, "thread-ledger-merge", check);
  recordSessionCheck(root, profile, "thread-ledger-merge", check);
  const state = readSession(root, profile.runtimeDir, "thread-ledger-merge");
  assert.deepEqual(state.ledger.targets, ["src/one.js", "src/three.js", "src/two.js"]);
  assert.equal(state.ledger.checks.length, 1);
  assert.deepEqual(state.ledger.checks[0].checkedPaths, ["src/one.js", "src/two.js"]);
});

test("scope report catches generated, migration, deleted and submodule writes", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  const baseline = {
    ...cleanSnapshot,
    submodules: {
      "frontend/app": { head: "sub-before", entries: [] },
    },
  };
  selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-mutation-kinds",
    snapshot: baseline,
  });
  const current = {
    ...cleanSnapshot,
    root: {
      head: "abc",
      entries: [
        { status: "??", path: "src/shell-generated.js", fingerprint: "file:generated" },
        { status: "??", path: "migrations/001.sql", fingerprint: "file:migration" },
        { status: " D", path: "deleted.txt", fingerprint: "missing" },
      ],
    },
    submodules: {
      "frontend/app": {
        head: "sub-after",
        entries: [{ status: " M", path: "inside.ts", fingerprint: "file:inside" }],
      },
    },
  };
  const report = sessionScopeReport(root, profile, registry(), {
    sessionId: "thread-mutation-kinds",
    current,
  });
  assert.deepEqual(report.outsideWriteSet, [
    "deleted.txt",
    "frontend/app",
    "frontend/app/inside.ts",
    "migrations/001.sql",
  ]);
  assert.deepEqual(report.changed, [
    "deleted.txt",
    "frontend/app",
    "frontend/app/inside.ts",
    "migrations/001.sql",
    "src/shell-generated.js",
  ]);
  assert.equal(report.ok, false);
});

test("scope report requires successful non-dry-run canonical checks", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  const requiredChecks = [{
    id: "fixture-test",
    cwd: ".",
    argv: ["node", "--test"],
  }];
  selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-checks",
    snapshot: cleanSnapshot,
  });
  let report = sessionScopeReport(root, profile, registry(), {
    sessionId: "thread-checks",
    current: cleanSnapshot,
    requiredChecks,
  });
  assert.deepEqual(report.missingRequiredChecks, requiredChecks);
  assert.equal(report.ok, false);

  recordSessionCheck(root, profile, "thread-checks", {
    ...requiredChecks[0],
    exitCode: 0,
    dryRun: true,
  });
  report = sessionScopeReport(root, profile, registry(), {
    sessionId: "thread-checks",
    current: cleanSnapshot,
    requiredChecks,
  });
  assert.equal(report.missingRequiredChecks.length, 1);

  recordSessionCheck(root, profile, "thread-checks", {
    ...requiredChecks[0],
    exitCode: 0,
    dryRun: false,
    checkedPaths: [],
    inputFingerprint: fingerprintSnapshotPaths(cleanSnapshot, []),
  });
  report = sessionScopeReport(root, profile, registry(), {
    sessionId: "thread-checks",
    current: cleanSnapshot,
    requiredChecks,
  });
  assert.deepEqual(report.missingRequiredChecks, []);
  assert.equal(report.ok, true);
});

test("scope report expires successful checks after checked inputs change", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  const requiredChecks = [{
    id: "fixture-test",
    cwd: ".",
    argv: ["node", "--test"],
  }];
  const checkedSnapshot = {
    ...cleanSnapshot,
    root: {
      head: "abc",
      entries: [{ status: " M", path: "src/new.js", fingerprint: "file:1" }],
    },
  };
  selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-stale-check",
    snapshot: cleanSnapshot,
  });
  recordSessionTargets(root, profile, "thread-stale-check", ["src/new.js"]);
  recordSessionCheck(root, profile, "thread-stale-check", {
    ...requiredChecks[0],
    exitCode: 0,
    dryRun: false,
    checkedPaths: ["src/new.js"],
    inputFingerprint: fingerprintSnapshotPaths(checkedSnapshot, ["src/new.js"]),
  });

  let report = sessionScopeReport(root, profile, registry(), {
    sessionId: "thread-stale-check",
    current: checkedSnapshot,
    requiredChecks,
  });
  assert.equal(report.ok, true);
  assert.equal(report.staleChecks.length, 0);

  const modifiedSnapshot = {
    ...checkedSnapshot,
    root: {
      head: "abc",
      entries: [{ status: " M", path: "src/new.js", fingerprint: "file:2" }],
    },
  };
  report = sessionScopeReport(root, profile, registry(), {
    sessionId: "thread-stale-check",
    current: modifiedSnapshot,
    requiredChecks,
  });
  assert.equal(report.ok, false);
  assert.equal(report.staleChecks.length, 1);
  assert.deepEqual(report.missingRequiredChecks, requiredChecks);
});

test("session ID comes from explicit input or supported environment", () => {
  assert.equal(resolveSessionId("explicit", {}), "explicit");
  assert.equal(resolveSessionId(undefined, { LEINO_SESSION_ID: "leino" }), "leino");
  assert.equal(resolveSessionId(undefined, { CODEX_THREAD_ID: "codex" }), "codex");
  assert.throws(() => resolveSessionId(undefined, {}), /session ID is required/);
});

test("select is idempotent for one plan and rejects baseline reset or plan switching", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  const first = selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-3",
    snapshot: cleanSnapshot,
  });
  const dirtySnapshot = {
    ...cleanSnapshot,
    root: {
      head: "abc",
      entries: [{ status: " M", path: "outside.txt", fingerprint: "file:1" }],
    },
  };
  const repeated = selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-3",
    snapshot: dirtySnapshot,
  });
  assert.deepEqual(repeated.baseline, first.baseline);
  const otherRegistry = {
    active: [
      ...registry().active,
      { planId: "0101-other", eligible: true, writeSet: [{ path: "other/**", mode: "write" }] },
    ],
  };
  assert.throws(
    () => selectSessionPlan(root, profile, otherRegistry, "0101-other", {
      sessionId: "thread-3",
      snapshot: dirtySnapshot,
    }),
    /already bound/,
  );
});

test("plan lifecycle ownership supports explicit handoff and release", () => {
  const root = temporaryDirectory();
  const runtimeDir = ".leino/runtime";
  const ownership = claimPlanLifecycle(root, runtimeDir, "0100-fixture", "thread-owner");
  assert.equal(ownership.planId, "0100-fixture");
  assert.deepEqual(
    lifecyclePlanIdsForSession(root, runtimeDir, "thread-owner"),
    ["0100-fixture"],
  );
  assert.deepEqual(
    lifecyclePlanIdsForSession(root, runtimeDir, "thread-other"),
    [],
  );
  assert.throws(
    () => claimPlanLifecycle(root, runtimeDir, "0100-fixture", "thread-other"),
    /owned by another session/,
  );
  const takenOver = claimPlanLifecycle(
    root,
    runtimeDir,
    "0100-fixture",
    "thread-other",
    { takeover: true },
  );
  assert.equal(takenOver.takenOverFrom, "thread-owner");
  assert.deepEqual(
    lifecyclePlanIdsForSession(root, runtimeDir, "thread-owner"),
    [],
  );
  assert.deepEqual(
    lifecyclePlanIdsForSession(root, runtimeDir, "thread-other"),
    ["0100-fixture"],
  );
  assert.equal(
    releasePlanLifecycle(root, runtimeDir, "0100-fixture", "thread-other"),
    true,
  );
  assert.deepEqual(
    lifecyclePlanIdsForSession(root, runtimeDir, "thread-other"),
    [],
  );
});

test("takeover changes only the requested owner and reports missing prior session state", () => {
  const root = temporaryDirectory();
  const runtimeDir = ".leino/runtime";
  claimPlanLifecycle(root, runtimeDir, "0100-fixture", "thread-old");
  claimPlanLifecycle(root, runtimeDir, "0101-other", "thread-old");
  assert.throws(
    () => claimPlanLifecycle(root, runtimeDir, "0100-fixture", "thread-new"),
    (error) => /existing session state: absent/.test(error.details.join("\n")),
  );
  claimPlanLifecycle(root, runtimeDir, "0100-fixture", "thread-new", { takeover: true });
  assert.deepEqual(lifecyclePlanIdsForSession(root, runtimeDir, "thread-old"), ["0101-other"]);
  assert.deepEqual(lifecyclePlanIdsForSession(root, runtimeDir, "thread-new"), ["0100-fixture"]);
});

test("selected release requires completed archive and preserves state on failure", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-release-failure",
    snapshot: cleanSnapshot,
  });
  const current = {
    ...cleanSnapshot,
    root: {
      head: "abc",
      entries: [{
        status: " M",
        path: "src/change.js",
        fingerprint: "file:changed",
      }],
    },
  };

  assert.throws(
    () => releaseSelectedPlanForRotation(
      root,
      profile,
      registry(),
      "0100-fixture",
      {
        sessionId: "thread-release-failure",
        current,
      },
    ),
    /must be completed/,
  );
  assert.equal(
    readSession(root, profile.runtimeDir, "thread-release-failure").planId,
    "0100-fixture",
  );
  assert.deepEqual(
    lifecyclePlanIdsForSession(root, profile.runtimeDir, "thread-release-failure"),
    ["0100-fixture"],
  );
  assert.equal(
    readRotationCheckpoint(root, profile.runtimeDir, "thread-release-failure"),
    null,
  );
  assert.throws(
    () => releasePlanLifecycle(
      root,
      profile.runtimeDir,
      "0100-fixture",
      "thread-release-failure",
      { releaseSelectedSession: true },
    ),
    /guarded rotation release/,
  );
});

test("selected release rejects missing checks without mutating ownership", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-release-check",
    snapshot: cleanSnapshot,
  });
  const current = {
    ...cleanSnapshot,
    root: {
      head: "abc",
      entries: [{
        status: " M",
        path: "src/change.js",
        fingerprint: "file:changed",
      }],
    },
  };
  const requiredChecks = [{
    id: "fixture-check",
    cwd: ".",
    argv: ["node", "--test"],
  }];

  assert.throws(
    () => releaseSelectedPlanForRotation(
      root,
      profile,
      completedRegistry(),
      "0100-fixture",
      {
        sessionId: "thread-release-check",
        current: {
          ...cleanSnapshot,
          root: {
            head: "abc",
            entries: [{
              status: " M",
              path: "outside.txt",
              fingerprint: "file:outside",
            }],
          },
        },
      },
    ),
    /unresolved scope or verification/,
  );
  assert.throws(
    () => releaseSelectedPlanForRotation(
      root,
      profile,
      completedRegistry(),
      "0100-fixture",
      {
        sessionId: "thread-release-check",
        current,
        requiredChecks,
      },
    ),
    /unresolved scope or verification/,
  );
  assert.equal(
    readSession(root, profile.runtimeDir, "thread-release-check").planId,
    "0100-fixture",
  );
  assert.deepEqual(
    lifecyclePlanIdsForSession(root, profile.runtimeDir, "thread-release-check"),
    ["0100-fixture"],
  );
});

test("completed release requires a commit then resets baseline and ledger for next plan", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-rotation",
    snapshot: cleanSnapshot,
  });
  recordSessionTargets(root, profile, "thread-rotation", ["src/change.js"]);
  const releasedSnapshot = {
    ...cleanSnapshot,
    root: {
      head: "abc",
      entries: [{
        status: " M",
        path: "src/change.js",
        fingerprint: "file:changed",
      }],
    },
  };

  const released = releaseSelectedPlanForRotation(
    root,
    profile,
    completedRegistry(),
    "0100-fixture",
    {
      sessionId: "thread-rotation",
      current: releasedSnapshot,
    },
  );
  assert.equal(released.mode, "rotation");
  assert.equal(readSession(root, profile.runtimeDir, "thread-rotation"), null);
  assert.deepEqual(
    lifecyclePlanIdsForSession(root, profile.runtimeDir, "thread-rotation"),
    [],
  );
  assert.equal(
    readRotationCheckpoint(root, profile.runtimeDir, "thread-rotation").previousPlanId,
    "0100-fixture",
  );

  const nextRegistry = {
    active: [{
      planId: "0101-next",
      eligible: true,
      issues: [],
      writeSet: [{ path: "next/**", mode: "write" }],
    }],
  };
  assert.throws(
    () => selectSessionPlan(root, profile, nextRegistry, "0101-next", {
      sessionId: "thread-rotation",
      snapshot: releasedSnapshot,
    }),
    /commit completed plan/,
  );

  const committedSnapshot = {
    ...cleanSnapshot,
    root: { head: "def", entries: [] },
  };
  const next = selectSessionPlan(root, profile, nextRegistry, "0101-next", {
    sessionId: "thread-rotation",
    snapshot: committedSnapshot,
  });
  assert.equal(next.schemaVersion, 2);
  assert.equal(next.planId, "0101-next");
  assert.deepEqual(next.ledger, { targets: [], checks: [] });
  assert.equal(next.rotationHistory.length, 1);
  assert.equal(next.rotationHistory[0].planId, "0100-fixture");
  assert.deepEqual(next.baseline, committedSnapshot);
  assert.equal(
    readRotationCheckpoint(root, profile.runtimeDir, "thread-rotation"),
    null,
  );
});

test("rotation preserves pre-existing dirty paths and permits only next lifecycle edits", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  const baseline = {
    ...cleanSnapshot,
    root: {
      head: "abc",
      entries: [{
        status: " M",
        path: "user.txt",
        fingerprint: "file:user",
      }],
    },
  };
  selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-dirty-baseline",
    snapshot: baseline,
  });
  recordSessionTargets(root, profile, "thread-dirty-baseline", ["src/change.js"]);
  releaseSelectedPlanForRotation(
    root,
    profile,
    completedRegistry(),
    "0100-fixture",
    {
      sessionId: "thread-dirty-baseline",
      current: {
        ...baseline,
        root: {
          head: "abc",
          entries: [
            ...baseline.root.entries,
            {
              status: " M",
              path: "src/change.js",
              fingerprint: "file:changed",
            },
          ],
        },
      },
    },
  );
  const nextRegistry = {
    active: [{
      planId: "0101-next",
      eligible: true,
      issues: [],
      writeSet: [{ path: "next/**", mode: "write" }],
    }],
  };
  const committedWithApproval = {
    ...baseline,
    root: {
      head: "def",
      entries: [
        ...baseline.root.entries,
        {
          status: " M",
          path: ".plans/active/0101-next.md",
          fingerprint: "file:approval",
        },
      ],
    },
  };
  assert.equal(
    selectSessionPlan(
      root,
      profile,
      nextRegistry,
      "0101-next",
      {
        sessionId: "thread-dirty-baseline",
        snapshot: committedWithApproval,
      },
    ).planId,
    "0101-next",
  );

  const secondRoot = temporaryDirectory();
  selectSessionPlan(secondRoot, profile, registry(), "0100-fixture", {
    sessionId: "thread-mutated-baseline",
    snapshot: baseline,
  });
  recordSessionTargets(secondRoot, profile, "thread-mutated-baseline", ["src/change.js"]);
  releaseSelectedPlanForRotation(
    secondRoot,
    profile,
    completedRegistry(),
    "0100-fixture",
    {
      sessionId: "thread-mutated-baseline",
      current: {
        ...baseline,
        root: {
          head: "abc",
          entries: [
            ...baseline.root.entries,
            {
              status: " M",
              path: "src/change.js",
              fingerprint: "file:changed",
            },
          ],
        },
      },
    },
  );
  assert.throws(
    () => selectSessionPlan(secondRoot, profile, nextRegistry, "0101-next", {
      sessionId: "thread-mutated-baseline",
      snapshot: {
        ...baseline,
        root: {
          head: "def",
          entries: [{
            status: " M",
            path: "user.txt",
            fingerprint: "file:mutated",
          }],
        },
      },
    }),
    /worktree changed outside lifecycle checkpoints/,
  );
});

test("selecting a plan claims exclusive session ownership", () => {
  const root = temporaryDirectory();
  const profile = {
    runtimeDir: ".leino/runtime",
    plans: { activeDir: ".plans/active", archiveDir: ".plans/archive" },
  };
  selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-owner",
    snapshot: cleanSnapshot,
  });
  assert.throws(
    () => selectSessionPlan(root, profile, registry(), "0100-fixture", {
      sessionId: "thread-other",
      snapshot: cleanSnapshot,
    }),
    /owned by another session/,
  );
  const transferred = selectSessionPlan(root, profile, registry(), "0100-fixture", {
    sessionId: "thread-other",
    snapshot: cleanSnapshot,
    takeover: true,
  });
  assert.equal(transferred.sessionId, "thread-other");
});
