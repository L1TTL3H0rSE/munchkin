import fs from "node:fs";
import { detectMojibake, isLikelyTextPath, validateTextFile } from "./lib/encoding.mjs";
import { readHookInput, writeJson, failClosed } from "./lib/hook-io.mjs";
import {
  absoluteFromRepo,
  extractAddedPatchTargets,
  extractPatchAddedText,
  extractPatchTargets,
  findRepoRoot,
  planIdFromLifecyclePath,
} from "./lib/paths.mjs";
import { loadProfile } from "../../tools/leinoctl/src/profile.mjs";
import {
  claimPlanLifecycle,
  recordSessionTargets,
  resolveSessionId,
} from "../../tools/leinoctl/src/session.mjs";

try {
  const input = await readHookInput();
  const repoRoot = findRepoRoot(input.cwd || process.cwd());
  const patch = input?.tool_input?.command ?? input?.tool_input?.patch ?? "";
  const targets = extractPatchTargets(patch, repoRoot, input.cwd || repoRoot);
  const addedTargets = extractAddedPatchTargets(patch, repoRoot, input.cwd || repoRoot);
  const failures = [];

  for (const target of targets) {
    const absolute = absoluteFromRepo(repoRoot, target);
    if (!fs.existsSync(absolute) || !isLikelyTextPath(target)) {
      continue;
    }
    try {
      const result = validateTextFile(absolute);
      for (const issue of result.issues ?? []) {
        failures.push(`${target}: ${issue.message}`);
      }
    } catch (error) {
      failures.push(`${target}: ${error.message}`);
    }
  }

  for (const issue of detectMojibake(extractPatchAddedText(patch))) {
    failures.push(`added text: ${issue.message}`);
  }

  try {
    const profile = loadProfile(repoRoot);
    const sessionId = resolveSessionId(input.session_id);
    for (const target of addedTargets) {
      const planId = planIdFromLifecyclePath(target, profile.plans);
      if (planId) {
        claimPlanLifecycle(repoRoot, profile.runtimeDir, planId, sessionId);
      }
    }
    recordSessionTargets(repoRoot, profile, sessionId, targets);
  } catch (error) {
    if (error?.code !== "session-id-missing") {
      failures.push(`session ledger: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length) {
    writeJson({
      decision: "block",
      reason: `HARNESS_POST_TOOL: ${failures.join("; ")}`,
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "The tool already ran. Do not continue from corrupted text; repair only within the approved write set.",
      },
    });
  }
} catch (error) {
  failClosed(error, "HARNESS_POST_TOOL");
}
