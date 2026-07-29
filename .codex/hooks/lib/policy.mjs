import { detectMojibake } from "./encoding.mjs";
import { validateDockerComposeCommand, validateTextReadCommand } from "./commands.mjs";
import { validateDelegation } from "./delegation.mjs";
import { authorizingPlans } from "./plans.mjs";
import {
  claimMatchesPath,
  extractAddedPatchTargets,
  extractPatchAddedText,
  extractPatchTargets,
  planIdFromLifecyclePath,
} from "./paths.mjs";

function block(code, message, details = []) {
  return { action: "block", code, message, details };
}

function allow(code = "allowed") {
  return { action: "allow", code };
}

function toolCommand(input) {
  if (typeof input?.tool_input === "string") {
    return input.tool_input;
  }
  return input?.tool_input?.command ?? input?.tool_input?.patch ?? "";
}

export function evaluatePreToolUse(input, {
  repoRoot,
  registry,
  selectedPlanId = null,
  lifecycleOwnedPlanIds = [],
  planDirectories,
  platform = process.platform,
}) {
  const toolName = String(input?.tool_name ?? "");

  if (toolName === "Bash") {
    const command = toolCommand(input);
    if (!command) {
      return block("shell-input-missing", "Bash hook input is missing tool_input.command");
    }
    const issues = [
      ...validateDockerComposeCommand(command),
      ...validateTextReadCommand(command, platform),
    ];
    return issues.length
      ? block(issues[0].code, issues[0].message, issues)
      : allow("shell-policy-passed");
  }

  if (["apply_patch", "Edit", "Write"].includes(toolName)) {
    const patch = toolCommand(input);
    if (!patch) {
      return block("patch-input-missing", "apply_patch hook input is missing tool_input.command");
    }

    const addedIssues = detectMojibake(extractPatchAddedText(patch));
    if (addedIssues.length) {
      return block(
        addedIssues[0].code,
        `patch adds unsafe text: ${addedIssues[0].message}`,
        addedIssues,
      );
    }

    let targets;
    try {
      targets = extractPatchTargets(patch, repoRoot, input?.cwd ?? repoRoot);
    } catch (error) {
      return block("patch-target-invalid", error.message);
    }
    if (!targets.length) {
      return block("patch-target-missing", "could not determine apply_patch targets");
    }
    const addedTargets = new Set(
      extractAddedPatchTargets(patch, repoRoot, input?.cwd ?? repoRoot),
    );
    const lifecycleOwners = new Set(lifecycleOwnedPlanIds);

    for (const target of targets) {
      const lifecyclePlanId = planIdFromLifecyclePath(target, planDirectories);
      if (lifecyclePlanId) {
        if (
          selectedPlanId === lifecyclePlanId
          && lifecycleOwners.has(lifecyclePlanId)
        ) {
          continue;
        }
        const existing = [...(registry.active ?? []), ...(registry.archive ?? [])]
          .find((plan) => plan.planId === lifecyclePlanId);
        if (!existing && addedTargets.has(target)) {
          continue;
        }
        if (
          existing
          && !existing.eligible
          && lifecycleOwners.has(lifecyclePlanId)
        ) {
          continue;
        }
        return block(
          "plan-lifecycle-owner-mismatch",
          `${target} is not owned by the current session`,
        );
      }
      if (!selectedPlanId) {
        return block(
          "plan-selection-missing",
          "select one eligible plan for this session before repository writes",
        );
      }
      const selectedPlan = registry.active.find((plan) => plan.planId === selectedPlanId);
      if (!selectedPlan || !selectedPlan.eligible) {
        return block(
          "selected-plan-not-eligible",
          `selected plan is missing or no longer eligible: ${selectedPlanId}`,
        );
      }
      if (!lifecycleOwners.has(selectedPlanId)) {
        return block(
          "selected-plan-session-owner-mismatch",
          `selected plan ${selectedPlanId} is owned by another session or requires recovery`,
        );
      }
      if (!selectedPlan.writeSet.some((claim) => claimMatchesPath(claim.path, target))) {
        return block(
          "selected-plan-write-set-mismatch",
          `${target} is not claimed by selected plan ${selectedPlanId}`,
        );
      }
      const plans = authorizingPlans(registry, target);
      if (plans.length === 0) {
        return block(
          "write-set-unclaimed",
          `${target} is not claimed by an eligible approved/in-progress plan`,
        );
      }
      if (plans.length > 1) {
        return block(
          "write-set-conflict",
          `${target} is claimed by multiple eligible plans: ${plans.map((plan) => plan.planId).join(", ")}`,
        );
      }
      if (plans[0].planId !== selectedPlanId) {
        return block(
          "selected-plan-owner-mismatch",
          `${target} is owned by ${plans[0].planId}, not selected plan ${selectedPlanId}`,
        );
      }
    }

    return allow("patch-policy-passed");
  }

  if ([
    "Agent",
    "spawn_agent",
    "collaboration.spawn_agent",
    "collaborationspawn_agent",
  ].includes(toolName)) {
    const issues = validateDelegation(input?.tool_input ?? {}, { registry, repoRoot });
    return issues.length
      ? block(issues[0].code, issues[0].message, issues)
      : allow("delegation-policy-passed");
  }

  return block(
    "tool-not-covered",
    `PreToolUse received unsupported tool_name: ${toolName || "<missing>"}`,
  );
}

export function preToolHookOutput(decision) {
  if (decision.action !== "block") {
    return null;
  }
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `[${decision.code}] ${decision.message}`,
    },
  };
}
