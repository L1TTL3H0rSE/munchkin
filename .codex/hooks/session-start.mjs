import { readHookInput, writeJson } from "./lib/hook-io.mjs";
import { findRepoRoot } from "./lib/paths.mjs";
import { activePlanSummary, loadPlanRegistry, registryIssues } from "./lib/plans.mjs";
import { loadProfile } from "../../tools/leinoctl/src/profile.mjs";
import {
  readSession,
  resolveSessionId,
} from "../../tools/leinoctl/src/session.mjs";

try {
  const input = await readHookInput();
  const repoRoot = findRepoRoot(input.cwd || process.cwd());
  const registry = loadPlanRegistry(repoRoot);
  const plans = activePlanSummary(registry);
  const issues = registryIssues(registry);
  const profile = loadProfile(repoRoot);
  let selected = null;
  try {
    const sessionId = resolveSessionId(input.session_id);
    selected = readSession(repoRoot, profile.runtimeDir, sessionId);
  } catch {
    selected = null;
  }
  const active = plans.map(
    (plan) => `${plan.planId}:${plan.status}${plan.issueCount ? `!${plan.issueCount}` : ""}`,
  );
  const context = [
    "Munchkin harness is active for this trusted session.",
    "Before repository writes, run leinoctl plan select <plan-id>; hooks enforce only that selected plan.",
    "Use leinoctl context --paths <paths> to load impacted components and relevant plans.",
    "Read repository text as strict UTF-8; use rg or Get-Content -Raw -Encoding utf8.",
    "Docker Compose requires --parallel >= 4. Agent delegation requires DELEGATION_META.",
    `Active plans: ${active.join(", ") || "none"}.`,
    `Selected plan: ${selected?.planId ?? "none"}.`,
    issues.length
      ? `Plan registry issues: ${issues.slice(0, 5).map((issue) => `${issue.planId}:${issue.code}`).join(", ")}.`
      : "Plan registry lint: clean.",
    "Project hooks are local guardrails, not an administrator-enforced security boundary.",
  ].join("\n");

  writeJson({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  });
} catch (error) {
  writeJson({
    systemMessage: `HARNESS_SESSION_START: ${error instanceof Error ? error.message : String(error)}`,
  });
}
