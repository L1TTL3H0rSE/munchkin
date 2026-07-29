import path from "node:path";
import { claimMatchesPath } from "./paths.mjs";

const REQUIRED_STRING_FIELDS = [
  "scope",
  "independent_from",
  "root_parallel_work",
  "expected_savings",
  "access",
  "stop_condition",
];

export function parseDelegationMeta(message) {
  const firstLine = String(message ?? "").split(/\r?\n/, 1)[0];
  const prefix = "DELEGATION_META ";
  if (!firstLine.startsWith(prefix)) {
    throw new Error("first line must start with DELEGATION_META followed by JSON");
  }
  try {
    return JSON.parse(firstLine.slice(prefix.length));
  } catch (error) {
    throw new Error("DELEGATION_META must contain valid JSON", { cause: error });
  }
}

function normalizedContext(value) {
  if (value === 0 || value === "none") {
    return "none";
  }
  if (value === "all") {
    return "all";
  }
  if (Number.isInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    return value;
  }
  return null;
}

function activePlanById(registry, planId) {
  return registry?.active?.find((plan) => plan.planId === planId);
}

function valueShape(value) {
  if (Array.isArray(value)) {
    return `array(length=${value.length})`;
  }
  if (value && typeof value === "object") {
    return `object(keys=${Object.keys(value).sort().join(",") || "<none>"})`;
  }
  return typeof value;
}

export function validateDelegation(toolInput, { registry, repoRoot } = {}) {
  const issues = [];
  let metadata;
  try {
    metadata = parseDelegationMeta(toolInput?.message ?? toolInput?.prompt ?? toolInput?.task);
  } catch (error) {
    const keys = Object.keys(toolInput ?? {}).sort().join(",") || "<none>";
    const rawMessage = String(toolInput?.message ?? "");
    const markerIndex = rawMessage.indexOf("DELEGATION_META ");
    const lineCount = rawMessage ? rawMessage.split(/\r?\n/).length : 0;
    return [{
      code: "delegation-metadata-missing",
      message: `${error.message}; tool_input keys: ${keys}; message shape: ${valueShape(toolInput?.message)}; marker index: ${markerIndex}; lines: ${lineCount}`,
    }];
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof metadata[field] !== "string" || metadata[field].trim().length < 3) {
      issues.push({ code: "delegation-field-invalid", message: `${field} must be a non-empty string` });
    }
  }

  if (/^(?:wait|waiting|none|nothing|ожид|ждать)/i.test(String(metadata.root_parallel_work ?? "").trim())) {
    issues.push({
      code: "delegation-no-root-parallel-work",
      message: "root_parallel_work must name useful work performed concurrently, not waiting",
    });
  }
  if (String(metadata.scope ?? "").trim() === String(metadata.independent_from ?? "").trim()) {
    issues.push({
      code: "delegation-not-independent",
      message: "scope and independent_from must describe different work",
    });
  }
  if (/^(?:user asked|because requested|пользователь попросил|есть слот)/i.test(String(metadata.expected_savings ?? "").trim())) {
    issues.push({
      code: "delegation-savings-unproven",
      message: "a user request or free slot is context, not expected wall-clock savings",
    });
  }

  const forkTurns = toolInput?.fork_turns;
  const forkContext = normalizedContext(forkTurns);
  const metaContext = normalizedContext(metadata.context_turns);
  if (!forkContext) {
    issues.push({
      code: "delegation-fork-implicit",
      message: "fork_turns must be explicit and bounded; omit full history by default",
    });
  } else if (forkContext !== metaContext) {
    issues.push({
      code: "delegation-context-mismatch",
      message: "DELEGATION_META context_turns must match fork_turns",
    });
  }
  if (forkContext === "all" && String(metadata.full_history_reason ?? "").trim().length < 12) {
    issues.push({
      code: "delegation-full-history-unjustified",
      message: "fork_turns=all requires a concrete full_history_reason",
    });
  }

  const namedProfile = String(toolInput?.agent_type ?? "");
  const hasConfiguredNamedProfile = ["explorer", "reviewer"].includes(namedProfile);
  if ((!toolInput?.model || !toolInput?.reasoning_effort) && !hasConfiguredNamedProfile) {
    issues.push({
      code: "delegation-profile-implicit",
      message: "use explorer/reviewer or explicit model and reasoning_effort so root effort is not inherited silently",
    });
  }
  if (
    ["xhigh", "max", "ultra"].includes(String(toolInput?.reasoning_effort ?? "").toLowerCase())
    && String(metadata.high_effort_reason ?? "").trim().length < 12
  ) {
    issues.push({
      code: "delegation-effort-unjustified",
      message: "xhigh/max/ultra delegation requires high_effort_reason",
    });
  }

  if (metadata.access === "read-only") {
    if (!Array.isArray(metadata.write_set) || metadata.write_set.length !== 0) {
      issues.push({
        code: "delegation-readonly-write-set",
        message: "read-only delegation must declare write_set: []",
      });
    }
  } else if (metadata.access === "write") {
    const plan = activePlanById(registry, metadata.plan_id);
    const worktree = String(metadata.worktree ?? "").trim();
    if (!plan?.eligible) {
      issues.push({
        code: "delegation-write-plan-invalid",
        message: "write delegation requires an eligible approved/in-progress plan_id",
      });
    }
    if (!worktree || !repoRoot || path.resolve(worktree) === path.resolve(repoRoot)) {
      issues.push({
        code: "delegation-shared-worktree",
        message: "write delegation requires a separate worktree, not the shared root workspace",
      });
    }
    if (!Array.isArray(metadata.write_set) || metadata.write_set.length === 0) {
      issues.push({
        code: "delegation-write-set-missing",
        message: "write delegation requires a non-empty write_set",
      });
    } else if (plan && metadata.write_set.some(
      (target) => !plan.writeSet.some((claim) => claimMatchesPath(claim.path, target)),
    )) {
      issues.push({
        code: "delegation-write-set-unclaimed",
        message: "delegated write_set exceeds the plan claims",
      });
    }

    issues.push({
      code: "delegation-write-binding-unsupported",
      message: "current Agent tool does not prove cwd/worktree binding; write subagents remain unsupported",
    });
  } else if (metadata.access) {
    issues.push({
      code: "delegation-access-invalid",
      message: "access must be read-only or write",
    });
  }

  return issues;
}
