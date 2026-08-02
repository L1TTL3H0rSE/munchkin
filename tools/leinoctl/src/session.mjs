import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { claimMatchesPath, normalizeClaim } from "./claims.mjs";
import { EXIT_CODES, LeinoError } from "./errors.mjs";
import {
  changedSinceBaseline,
  fingerprintSnapshotPaths,
  snapshotRepository,
} from "./git.mjs";
import { resolveInside, toPosix, writeJsonAtomic } from "./fs.mjs";

const SESSION_LOCK_ATTEMPTS = 100;
const SESSION_LOCK_WAIT_MS = 5;

function safeSessionId(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 160);
}

function normalizeLedgerPath(value) {
  return normalizeClaim(toPosix(String(value ?? "")).replace(/^\.\//, ""));
}

function normalizeLedgerPaths(values) {
  if (!Array.isArray(values)) {
    throw new LeinoError("session-ledger-invalid", "session ledger paths must be an array");
  }
  return [...new Set(values.map(normalizeLedgerPath))].sort();
}

function normalizeRecordedCheck(check) {
  if (!check || typeof check !== "object") {
    throw new LeinoError("session-check-invalid", "session check must be an object");
  }
  if (!check.id || !Array.isArray(check.argv)) {
    throw new LeinoError("session-check-invalid", "session check requires id and argv");
  }
  return {
    ...check,
    id: String(check.id),
    cwd: normalizeLedgerPath(check.cwd ?? "."),
    argv: check.argv.map((entry) => String(entry)),
    exitCode: Number.isInteger(check.exitCode) ? check.exitCode : null,
    signal: check.signal ?? null,
    started: check.started !== false,
    timedOut: check.timedOut === true,
    dryRun: check.dryRun === true,
    checkedPaths: normalizeLedgerPaths(check.checkedPaths ?? []),
    inputFingerprint: check.inputFingerprint ?? null,
  };
}

function sessionCheckKey(check) {
  return JSON.stringify([
    check.id,
    check.cwd,
    check.argv,
    check.exitCode,
    check.signal,
    check.started,
    check.timedOut,
    check.dryRun,
    check.checkedPaths,
    check.inputFingerprint,
  ]);
}

function withSessionLedgerLock(filePath, callback) {
  const lockPath = `${filePath}.lock`;
  let descriptor;
  for (let attempt = 0; attempt < SESSION_LOCK_ATTEMPTS; attempt += 1) {
    try {
      descriptor = fs.openSync(lockPath, "wx", 0o600);
      try {
        fs.writeFileSync(descriptor, `${process.pid}\n`, "utf8");
      } catch (error) {
        fs.closeSync(descriptor);
        descriptor = undefined;
        try {
          fs.unlinkSync(lockPath);
        } catch (cleanupError) {
          if (cleanupError?.code !== "ENOENT") {
            throw cleanupError;
          }
        }
        throw error;
      }
      break;
    } catch (error) {
      if (error?.code !== "EEXIST" || attempt === SESSION_LOCK_ATTEMPTS - 1) {
        throw new LeinoError(
          "session-ledger-locked",
          `session ledger is locked: ${path.basename(filePath)}`,
          { cause: error },
        );
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, SESSION_LOCK_WAIT_MS);
    }
  }
  try {
    return callback();
  } finally {
    try {
      fs.closeSync(descriptor);
    } finally {
      try {
        fs.unlinkSync(lockPath);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }
  }
}

function updateSessionLedger(repoRoot, runtimeDir, sessionId, updater) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const filePath = sessionFile(repoRoot, runtimeDir, resolvedSessionId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return withSessionLedgerLock(filePath, () => {
    const state = readSession(repoRoot, runtimeDir, resolvedSessionId);
    if (!state) {
      return null;
    }
    const next = updater(state);
    next.updatedAt = new Date().toISOString();
    writeJsonAtomic(filePath, next);
    return next;
  });
}

export function resolveSessionId(explicit, env = process.env) {
  const value = explicit || env.LEINO_SESSION_ID || env.CODEX_THREAD_ID;
  if (!value) {
    throw new LeinoError(
      "session-id-missing",
      "session ID is required; set LEINO_SESSION_ID or run inside Codex",
      { exitCode: EXIT_CODES.usage },
    );
  }
  return safeSessionId(value);
}

export function repositoryIdentity(repoRoot) {
  const real = fs.realpathSync(repoRoot);
  return crypto.createHash("sha256").update(real).digest("hex");
}

export function sessionFile(repoRoot, runtimeDir, sessionId) {
  const directory = resolveInside(repoRoot, `${runtimeDir}/sessions`, "session runtime");
  return path.join(directory, `${safeSessionId(sessionId)}.json`);
}

function lifecycleOwnershipDirectory(repoRoot, runtimeDir) {
  return resolveInside(repoRoot, `${runtimeDir}/plan-owners`, "plan ownership runtime");
}

function lifecycleOwnershipFile(repoRoot, runtimeDir, planId) {
  return path.join(
    lifecycleOwnershipDirectory(repoRoot, runtimeDir),
    `${safeSessionId(planId)}.json`,
  );
}

function rotationCheckpointDirectory(repoRoot, runtimeDir) {
  return resolveInside(repoRoot, `${runtimeDir}/plan-rotations`, "plan rotation runtime");
}

function rotationCheckpointFile(repoRoot, runtimeDir, sessionId) {
  return path.join(
    rotationCheckpointDirectory(repoRoot, runtimeDir),
    `${safeSessionId(sessionId)}.json`,
  );
}

function lifecyclePaths(profile, planId) {
  return new Set([
    `${profile.plans.activeDir}/${planId}.md`,
    `${profile.plans.archiveDir}/${planId}.md`,
  ]);
}

function dirtyEntryMap(snapshot) {
  const entries = new Map();
  for (const entry of snapshot.root?.entries ?? []) {
    entries.set(entry.path, `${entry.status}\0${entry.fingerprint}`);
  }
  for (const [submodulePath, worktree] of Object.entries(snapshot.submodules ?? {})) {
    for (const entry of worktree.entries ?? []) {
      entries.set(
        `${submodulePath}/${entry.path}`,
        `${entry.status}\0${entry.fingerprint}`,
      );
    }
  }
  return entries;
}

export function claimPlanLifecycle(repoRoot, runtimeDir, planId, sessionId, {
  takeover = false,
} = {}) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const filePath = lifecycleOwnershipFile(repoRoot, runtimeDir, planId);
  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (existing.sessionId !== resolvedSessionId) {
      if (!takeover) {
        let priorSessionState = "absent";
        try {
          if (fs.existsSync(sessionFile(repoRoot, runtimeDir, existing.sessionId))) {
            readSession(repoRoot, runtimeDir, existing.sessionId);
            priorSessionState = "present";
          }
        } catch {
          priorSessionState = "invalid";
        }
        throw new LeinoError(
          "plan-lifecycle-owned",
          `plan lifecycle is owned by another session: ${planId}; use explicit takeover after confirming handoff`,
          {
            details: [
              `existing owner session: ${existing.sessionId}`,
              `existing session state: ${priorSessionState}`,
              "takeover is explicit and must be limited to this plan",
            ],
          },
        );
      }
      const ownership = {
        schemaVersion: 1,
        repositoryIdentity: repositoryIdentity(repoRoot),
        planId,
        sessionId: resolvedSessionId,
        claimedAt: new Date().toISOString(),
        takenOverFrom: existing.sessionId,
      };
      writeJsonAtomic(filePath, ownership);
      return ownership;
    }
    return existing;
  }
  const ownership = {
    schemaVersion: 1,
    repositoryIdentity: repositoryIdentity(repoRoot),
    planId,
    sessionId: resolvedSessionId,
    claimedAt: new Date().toISOString(),
  };
  writeJsonAtomic(filePath, ownership);
  return ownership;
}

export function releasePlanLifecycle(repoRoot, runtimeDir, planId, sessionId, {
  releaseSelectedSession = false,
} = {}) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const filePath = lifecycleOwnershipFile(repoRoot, runtimeDir, planId);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (existing.sessionId !== resolvedSessionId) {
    throw new LeinoError(
      "plan-lifecycle-owned",
      `plan lifecycle is owned by another session: ${planId}`,
    );
  }
  if (releaseSelectedSession) {
    throw new LeinoError(
      "selected-plan-release-guard-required",
      "selected plans must use the guarded rotation release",
    );
  }
  fs.unlinkSync(filePath);
  return true;
}

export function readRotationCheckpoint(repoRoot, runtimeDir, sessionId) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const filePath = rotationCheckpointFile(repoRoot, runtimeDir, resolvedSessionId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const state = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (state.repositoryIdentity !== repositoryIdentity(repoRoot)) {
    throw new LeinoError(
      "rotation-repository-mismatch",
      "rotation checkpoint belongs to another repository",
    );
  }
  return state;
}

function validateRotationCommit(checkpoint, profile, nextPlanId, current) {
  if (checkpoint.releaseSnapshot?.root?.head === current.root?.head) {
    throw new LeinoError(
      "session-plan-commit-required",
      `commit completed plan ${checkpoint.previousPlanId} before selecting ${nextPlanId}`,
    );
  }

  const allowedLifecyclePaths = new Set([
    ...lifecyclePaths(profile, checkpoint.previousPlanId),
    ...lifecyclePaths(profile, nextPlanId),
  ]);
  const baselineEntries = dirtyEntryMap(checkpoint.baseline);
  const currentEntries = dirtyEntryMap(current);
  const unexpected = new Set();

  for (const [repoPath, fingerprint] of baselineEntries) {
    if (
      !allowedLifecyclePaths.has(repoPath)
      && currentEntries.get(repoPath) !== fingerprint
    ) {
      unexpected.add(repoPath);
    }
  }
  for (const [repoPath, fingerprint] of currentEntries) {
    if (
      !allowedLifecyclePaths.has(repoPath)
      && baselineEntries.get(repoPath) !== fingerprint
    ) {
      unexpected.add(repoPath);
    }
  }

  if (unexpected.size) {
    throw new LeinoError(
      "session-plan-transition-dirty",
      `worktree changed outside lifecycle checkpoints after releasing ${checkpoint.previousPlanId}`,
      { details: [...unexpected].sort() },
    );
  }
}

export function releaseSelectedPlanForRotation(
  repoRoot,
  profile,
  registry,
  planId,
  {
    sessionId,
    current = snapshotRepository(repoRoot),
    requiredChecks = [],
  } = {},
) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const state = readSession(repoRoot, profile.runtimeDir, resolvedSessionId);
  if (!state) {
    throw new LeinoError(
      "session-not-selected",
      "no selected plan exists; use lifecycle release for an unselected handoff",
    );
  }
  if (state.planId !== planId) {
    throw new LeinoError(
      "session-plan-mismatch",
      `session is bound to ${state.planId}, not ${planId}`,
    );
  }

  const plan = registry.all?.find((candidate) => candidate.planId === planId)
    ?? registry.archive?.find((candidate) => candidate.planId === planId);
  if (
    !plan
    || plan.placement !== "archive"
    || plan.status !== "completed"
    || plan.unchecked !== 0
    || plan.issues?.length
  ) {
    throw new LeinoError(
      "selected-plan-not-completed",
      `selected plan must be completed, lint-clean and archived before release: ${planId}`,
    );
  }

  const report = sessionScopeReport(repoRoot, profile, registry, {
    sessionId: resolvedSessionId,
    current,
    requiredChecks,
  });
  if (!report.ok) {
    throw new LeinoError(
      "selected-plan-release-check-failed",
      `selected plan has unresolved scope or verification checks: ${planId}`,
      {
        details: [
          ...report.outsideWriteSet.map((entry) => `outside write set: ${entry}`),
          ...report.unledgered.map((entry) => `unledgered target: ${entry}`),
          ...report.staleChecks.map((check) => `stale check: ${check.id} (${check.cwd})`),
          ...report.missingRequiredChecks.map(
            (entry) => `required check not completed: ${entry.id} (${entry.cwd})`,
          ),
        ],
      },
    );
  }

  const ownershipPath = lifecycleOwnershipFile(repoRoot, profile.runtimeDir, planId);
  if (!fs.existsSync(ownershipPath)) {
    throw new LeinoError(
      "plan-lifecycle-owner-missing",
      `selected plan has no lifecycle owner: ${planId}`,
    );
  }
  const ownership = JSON.parse(fs.readFileSync(ownershipPath, "utf8"));
  if (ownership.sessionId !== resolvedSessionId) {
    throw new LeinoError(
      "plan-lifecycle-owned",
      `plan lifecycle is owned by another session: ${planId}`,
    );
  }

  const releasedAt = new Date().toISOString();
  const history = [
    ...(state.rotationHistory ?? []),
    {
      planId,
      selectedAt: state.selectedAt,
      releasedAt,
      baselineHead: state.baseline?.root?.head ?? null,
      releaseHead: current.root?.head ?? null,
    },
  ].slice(-32);
  const checkpoint = {
    schemaVersion: 1,
    repositoryIdentity: repositoryIdentity(repoRoot),
    sessionId: resolvedSessionId,
    previousPlanId: planId,
    releasedAt,
    baseline: state.baseline,
    releaseSnapshot: current,
    rotationHistory: history,
  };
  const checkpointPath = rotationCheckpointFile(
    repoRoot,
    profile.runtimeDir,
    resolvedSessionId,
  );
  const selectedSessionPath = sessionFile(
    repoRoot,
    profile.runtimeDir,
    resolvedSessionId,
  );

  writeJsonAtomic(checkpointPath, checkpoint);
  try {
    fs.unlinkSync(ownershipPath);
    fs.unlinkSync(selectedSessionPath);
  } catch (error) {
    if (!fs.existsSync(ownershipPath)) {
      writeJsonAtomic(ownershipPath, ownership);
    }
    if (fs.existsSync(checkpointPath)) {
      fs.unlinkSync(checkpointPath);
    }
    throw error;
  }

  return {
    released: true,
    mode: "rotation",
    planId,
    sessionId: resolvedSessionId,
    releasedAt,
    report,
  };
}

export function lifecyclePlanIdsForSession(repoRoot, runtimeDir, sessionId) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const directory = lifecycleOwnershipDirectory(repoRoot, runtimeDir);
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .flatMap((entry) => {
      try {
        const ownership = JSON.parse(fs.readFileSync(path.join(directory, entry.name), "utf8"));
        return ownership.repositoryIdentity === repositoryIdentity(repoRoot)
          && ownership.sessionId === resolvedSessionId
          ? [ownership.planId]
          : [];
      } catch {
        return [];
      }
    })
    .sort();
}

export function readSession(repoRoot, runtimeDir, sessionId) {
  const filePath = sessionFile(repoRoot, runtimeDir, sessionId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const state = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (state.repositoryIdentity !== repositoryIdentity(repoRoot)) {
    throw new LeinoError("session-repository-mismatch", "session state belongs to another repository");
  }
  return state;
}

export function selectSessionPlan(repoRoot, profile, registry, planId, {
  sessionId,
  snapshot = snapshotRepository(repoRoot),
  takeover = false,
} = {}) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const existing = readSession(repoRoot, profile.runtimeDir, resolvedSessionId);
  if (existing) {
    if (existing.planId === planId) {
      claimPlanLifecycle(
        repoRoot,
        profile.runtimeDir,
        planId,
        resolvedSessionId,
        { takeover },
      );
      return existing;
    }
    throw new LeinoError(
      "session-plan-already-selected",
      `session is already bound to ${existing.planId}; start a new session to select ${planId}`,
    );
  }
  const plan = registry.active.find((candidate) => candidate.planId === planId);
  if (!plan) {
    throw new LeinoError("plan-not-active", `active plan not found: ${planId}`);
  }
  if (!plan.eligible) {
    throw new LeinoError(
      "plan-not-eligible",
      `plan ${planId} is not approved/in_progress or has registry issues`,
      { details: plan.issues.map((issue) => issue.code) },
    );
  }
  const rotationCheckpoint = readRotationCheckpoint(
    repoRoot,
    profile.runtimeDir,
    resolvedSessionId,
  );
  if (rotationCheckpoint) {
    validateRotationCommit(rotationCheckpoint, profile, planId, snapshot);
  }
  claimPlanLifecycle(
    repoRoot,
    profile.runtimeDir,
    planId,
    resolvedSessionId,
    { takeover },
  );
  const state = {
    schemaVersion: 2,
    repositoryIdentity: repositoryIdentity(repoRoot),
    sessionId: resolvedSessionId,
    planId,
    selectedAt: new Date().toISOString(),
    baseline: snapshot,
    ledger: {
      targets: [],
      checks: [],
    },
    rotationHistory: rotationCheckpoint?.rotationHistory ?? [],
  };
  writeJsonAtomic(sessionFile(repoRoot, profile.runtimeDir, resolvedSessionId), state);
  if (rotationCheckpoint) {
    fs.unlinkSync(rotationCheckpointFile(repoRoot, profile.runtimeDir, resolvedSessionId));
  }
  return state;
}

export function recordSessionTargets(repoRoot, profile, sessionId, targets) {
  const normalizedTargets = normalizeLedgerPaths(targets);
  return updateSessionLedger(repoRoot, profile.runtimeDir, sessionId, (state) => {
    state.ledger = state.ledger ?? { targets: [], checks: [] };
    state.ledger.targets = normalizeLedgerPaths([
      ...(state.ledger.targets ?? []),
      ...normalizedTargets,
    ]);
    return state;
  });
}

export function recordSessionCheck(repoRoot, profile, sessionId, check) {
  const normalizedCheck = normalizeRecordedCheck(check);
  return updateSessionLedger(repoRoot, profile.runtimeDir, sessionId, (state) => {
    state.ledger = state.ledger ?? { targets: [], checks: [] };
    const checks = (state.ledger.checks ?? []).map(normalizeRecordedCheck);
    if (!checks.some((entry) => sessionCheckKey(entry) === sessionCheckKey(normalizedCheck))) {
      checks.push(normalizedCheck);
    }
    state.ledger.checks = checks;
    return state;
  });
}

export function sessionScopeReport(repoRoot, profile, registry, {
  sessionId,
  current = snapshotRepository(repoRoot),
  requiredChecks = [],
} = {}) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const state = readSession(repoRoot, profile.runtimeDir, resolvedSessionId);
  if (!state) {
    throw new LeinoError("session-not-selected", "no plan is selected for this session");
  }
  const plan = registry.all?.find((candidate) => candidate.planId === state.planId)
    ?? registry.active.find((candidate) => candidate.planId === state.planId);
  const completedArchive = plan?.placement === "archive" && plan.status === "completed";
  if (!plan || (!plan.eligible && !completedArchive)) {
    throw new LeinoError("selected-plan-not-eligible", `selected plan is no longer eligible: ${state.planId}`);
  }
  const changed = changedSinceBaseline(state.baseline, current);
  const planLifecyclePaths = lifecyclePaths(profile, state.planId);
  const outsideWriteSet = changed.filter((changedPath) => (
    !planLifecyclePaths.has(changedPath)
    && !plan.writeSet.some((claim) => claimMatchesPath(claim.path, changedPath))
  ));
  const ledgerTargets = normalizeLedgerPaths(state.ledger?.targets ?? []);
  const changedInputs = changed.filter((changedPath) => !planLifecyclePaths.has(changedPath));
  const unledgered = changedInputs.filter((changedPath) => !ledgerTargets.includes(changedPath));
  const unledgeredInWriteSet = unledgered.filter((changedPath) => (
    plan.writeSet.some((claim) => claimMatchesPath(claim.path, changedPath))
  ));
  const unledgeredOutsideWriteSet = unledgered.filter((changedPath) => (
    !unledgeredInWriteSet.includes(changedPath)
  ));
  const requiredInputPaths = changed.filter(
    (changedPath) => !planLifecyclePaths.has(changedPath),
  );
  const successfulChecks = (state.ledger?.checks ?? []).filter(
    (check) => check.exitCode === 0 && check.dryRun === false && check.timedOut !== true,
  );
  const failedChecks = (state.ledger?.checks ?? []).filter(
    (check) => check.exitCode !== 0 || check.dryRun === true || check.timedOut === true,
  );
  const completedChecks = successfulChecks.filter((check) => (
    Array.isArray(check.checkedPaths)
    && requiredInputPaths.every((repoPath) => check.checkedPaths.includes(repoPath))
    && check.inputFingerprint === fingerprintSnapshotPaths(current, check.checkedPaths)
  ));
  const staleChecks = successfulChecks.filter((check) => !completedChecks.includes(check));
  const missingRequiredChecks = requiredChecks.filter((required) => (
    !completedChecks.some((completed) => (
      completed.id === required.id
      && completed.cwd === required.cwd
      && JSON.stringify(completed.argv) === JSON.stringify(required.argv)
    ))
  ));
  return {
    schemaVersion: 1,
    planId: state.planId,
    sessionId: resolvedSessionId,
    changed,
    outsideWriteSet,
    ledgerTargets,
    unledgered,
    unledgeredInWriteSet,
    unledgeredOutsideWriteSet,
    requiredChecks,
    completedChecks,
    failedChecks,
    staleChecks,
    missingRequiredChecks,
    ok: outsideWriteSet.length === 0
      && unledgered.length === 0
      && missingRequiredChecks.length === 0,
  };
}
