import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readHookInput, writeJson } from "./lib/hook-io.mjs";
import { findRepoRoot } from "./lib/paths.mjs";
import { loadPlanRegistry, registryIssues } from "./lib/plans.mjs";
import { evaluateStopState } from "./lib/stop-policy.mjs";
import { loadProfile } from "../../tools/leinoctl/src/profile.mjs";
import {
  buildComponentGraph,
  componentChecks,
  impactedComponents,
} from "../../tools/leinoctl/src/components.mjs";
import {
  changedSinceBaseline,
  snapshotRepository,
} from "../../tools/leinoctl/src/git.mjs";
import {
  readSession,
  repositoryIdentity,
  resolveSessionId,
  sessionScopeReport,
} from "../../tools/leinoctl/src/session.mjs";

function messageFor(plan, scope, state) {
  const lines = [];
  if (state.reasons.length) {
    lines.push(`HARNESS_STOP: selected plan ${plan.planId} is unresolved.`);
    for (const reason of state.reasons) {
      lines.push(`- ${reason}`);
    }
    if (scope.outsideWriteSet.length) {
      lines.push(`- outside: ${scope.outsideWriteSet.slice(0, 8).join(", ")}`);
    }
  }
  for (const warning of state.warnings.slice(0, 8)) {
    lines.push(`warning: ${warning}`);
  }
  if (state.reasons.length) {
    lines.push("Update the selected plan and run leinoctl scope-check before finishing.");
  }
  return lines.join("\n");
}

function fingerprintPath(repoRoot, sessionId) {
  const directory = path.join(os.tmpdir(), "leinoctl-stop");
  fs.mkdirSync(directory, { recursive: true });
  return path.join(
    directory,
    `${repositoryIdentity(repoRoot)}-${String(sessionId).replace(/[^A-Za-z0-9_-]/g, "_")}.json`,
  );
}

try {
  const input = await readHookInput();
  if (input.stop_hook_active) {
    writeJson({});
  } else {
    const repoRoot = findRepoRoot(input.cwd || process.cwd());
    const profile = loadProfile(repoRoot);
    const registry = loadPlanRegistry(repoRoot);
    const issues = registryIssues(registry);
    let sessionId = null;
    let session = null;
    try {
      sessionId = resolveSessionId(input.session_id);
      session = readSession(repoRoot, profile.runtimeDir, sessionId);
    } catch {
      session = null;
    }

    if (!session) {
      writeJson(issues.length
        ? {
          systemMessage: issues.slice(0, 8)
            .map((issue) => `HARNESS_STOP warning: ${issue.planId}:${issue.code}`)
            .join("\n"),
        }
        : {});
    } else {
      const plan = registry.all.find((candidate) => candidate.planId === session.planId) ?? null;
      let scope = null;
      try {
        const current = snapshotRepository(repoRoot);
        const changed = changedSinceBaseline(session.baseline, current);
        const graph = buildComponentGraph(repoRoot, profile);
        const requiredChecks = componentChecks(impactedComponents(graph, changed));
        scope = sessionScopeReport(repoRoot, profile, registry, {
          sessionId,
          current,
          requiredChecks,
        });
      } catch (error) {
        scope = {
          changed: session.ledger?.targets ?? [],
          outsideWriteSet: [],
          unledgered: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
      const state = evaluateStopState({ session, plan, scope, registryIssues: issues });
      const message = messageFor(plan ?? { planId: session.planId }, scope, state);
      if (!state.block) {
        writeJson(message ? { systemMessage: message } : {});
      } else {
        const fingerprint = crypto.createHash("sha256")
          .update(JSON.stringify({ planId: session.planId, scope, state }))
          .digest("hex");
        const statePath = fingerprintPath(repoRoot, sessionId);
        let previous = null;
        try {
          previous = JSON.parse(fs.readFileSync(statePath, "utf8"));
        } catch {
          previous = null;
        }
        if (previous?.fingerprint === fingerprint) {
          writeJson({ systemMessage: message });
        } else {
          fs.writeFileSync(statePath, `${JSON.stringify({ fingerprint })}\n`, "utf8");
          writeJson({ decision: "block", reason: message });
        }
      }
    }
  }
} catch (error) {
  writeJson({
    systemMessage: `HARNESS_STOP: ${error instanceof Error ? error.message : String(error)}`,
  });
}
