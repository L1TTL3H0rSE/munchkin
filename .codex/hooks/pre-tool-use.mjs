import { readHookInput, writeJson, failClosed } from "./lib/hook-io.mjs";
import { findRepoRoot } from "./lib/paths.mjs";
import { loadPlanRegistry } from "./lib/plans.mjs";
import { evaluatePreToolUse, preToolHookOutput } from "./lib/policy.mjs";
import { loadProfile } from "../../tools/leinoctl/src/profile.mjs";
import {
  lifecyclePlanIdsForSession,
  readSession,
  resolveSessionId,
} from "../../tools/leinoctl/src/session.mjs";

try {
  const input = await readHookInput();
  const repoRoot = findRepoRoot(input.cwd || process.cwd());
  const registry = loadPlanRegistry(repoRoot);
  const profile = loadProfile(repoRoot);
  let selectedPlanId = null;
  let lifecycleOwnedPlanIds = [];
  try {
    const sessionId = resolveSessionId(input.session_id);
    selectedPlanId = readSession(repoRoot, profile.runtimeDir, sessionId)?.planId ?? null;
    lifecycleOwnedPlanIds = lifecyclePlanIdsForSession(
      repoRoot,
      profile.runtimeDir,
      sessionId,
    );
  } catch {
    selectedPlanId = null;
    lifecycleOwnedPlanIds = [];
  }
  const decision = evaluatePreToolUse(input, {
    repoRoot,
    registry,
    selectedPlanId,
    lifecycleOwnedPlanIds,
    planDirectories: profile.plans,
  });
  const output = preToolHookOutput(decision);
  if (output) {
    writeJson(output);
  }
} catch (error) {
  failClosed(error, "HARNESS_PRE_TOOL");
}
