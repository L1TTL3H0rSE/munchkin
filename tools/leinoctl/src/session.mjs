import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { claimMatchesPath } from "./claims.mjs";
import { EXIT_CODES, LeinoError } from "./errors.mjs";
import {
  changedSinceBaseline,
  fingerprintSnapshotPaths,
  snapshotRepository,
} from "./git.mjs";
import { resolveInside, writeJsonAtomic } from "./fs.mjs";

function safeSessionId(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 160);
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

export function claimPlanLifecycle(repoRoot, runtimeDir, planId, sessionId, {
  takeover = false,
} = {}) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const directory = lifecycleOwnershipDirectory(repoRoot, runtimeDir);
  const filePath = path.join(directory, `${safeSessionId(planId)}.json`);
  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (existing.sessionId !== resolvedSessionId) {
      if (!takeover) {
        throw new LeinoError(
          "plan-lifecycle-owned",
          `plan lifecycle is owned by another session: ${planId}; use explicit takeover after confirming handoff`,
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
  const directory = lifecycleOwnershipDirectory(repoRoot, runtimeDir);
  const filePath = path.join(directory, `${safeSessionId(planId)}.json`);
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
    const selected = readSession(repoRoot, runtimeDir, resolvedSessionId);
    if (selected && selected.planId !== planId) {
      throw new LeinoError(
        "session-plan-mismatch",
        `session is bound to ${selected.planId}, not ${planId}`,
      );
    }
    if (selected) {
      fs.unlinkSync(sessionFile(repoRoot, runtimeDir, resolvedSessionId));
    }
  }
  fs.unlinkSync(filePath);
  return true;
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
  claimPlanLifecycle(
    repoRoot,
    profile.runtimeDir,
    planId,
    resolvedSessionId,
    { takeover },
  );
  const state = {
    schemaVersion: 1,
    repositoryIdentity: repositoryIdentity(repoRoot),
    sessionId: resolvedSessionId,
    planId,
    selectedAt: new Date().toISOString(),
    baseline: snapshot,
    ledger: {
      targets: [],
      checks: [],
    },
  };
  writeJsonAtomic(sessionFile(repoRoot, profile.runtimeDir, resolvedSessionId), state);
  return state;
}

export function recordSessionTargets(repoRoot, profile, sessionId, targets) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const state = readSession(repoRoot, profile.runtimeDir, resolvedSessionId);
  if (!state) {
    return null;
  }
  state.ledger.targets = [...new Set([
    ...(state.ledger?.targets ?? []),
    ...targets,
  ])].sort();
  state.updatedAt = new Date().toISOString();
  writeJsonAtomic(sessionFile(repoRoot, profile.runtimeDir, resolvedSessionId), state);
  return state;
}

export function recordSessionCheck(repoRoot, profile, sessionId, check) {
  const resolvedSessionId = resolveSessionId(sessionId);
  const state = readSession(repoRoot, profile.runtimeDir, resolvedSessionId);
  if (!state) {
    return null;
  }
  state.ledger.checks = [...(state.ledger?.checks ?? []), check];
  state.updatedAt = new Date().toISOString();
  writeJsonAtomic(sessionFile(repoRoot, profile.runtimeDir, resolvedSessionId), state);
  return state;
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
  const lifecyclePaths = new Set([
    `${profile.plans.activeDir}/${state.planId}.md`,
    `${profile.plans.archiveDir}/${state.planId}.md`,
  ]);
  const outsideWriteSet = changed.filter((changedPath) => (
    !lifecyclePaths.has(changedPath)
    && !plan.writeSet.some((claim) => claimMatchesPath(claim.path, changedPath))
  ));
  const ledgerTargets = state.ledger?.targets ?? [];
  const unledgered = changed.filter((changedPath) => !ledgerTargets.includes(changedPath));
  const requiredInputPaths = changed.filter((changedPath) => !lifecyclePaths.has(changedPath));
  const successfulChecks = (state.ledger?.checks ?? []).filter(
    (check) => check.exitCode === 0 && check.dryRun === false,
  );
  const completedChecks = successfulChecks.filter((check) => (
    Array.isArray(check.checkedPaths)
    && requiredInputPaths.every((repoPath) => check.checkedPaths.includes(repoPath))
    && check.inputFingerprint === fingerprintSnapshotPaths(current, check.checkedPaths)
  ));
  const staleChecks = successfulChecks.filter((check) => !completedChecks.includes(check));
  const missingRequiredChecks = requiredChecks.filter((required) => (
    !completedChecks.some((completed) => (
      completed.cwd === required.cwd
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
    requiredChecks,
    completedChecks,
    staleChecks,
    missingRequiredChecks,
    ok: outsideWriteSet.length === 0 && missingRequiredChecks.length === 0,
  };
}
