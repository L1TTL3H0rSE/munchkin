import {
  VALID_PLAN_STATUSES,
  activePlanSummary,
  authorizingPlans,
  loadPlanRegistry as loadGenericPlanRegistry,
  parsePlanFile,
  parsePlanManifest,
  registryIssues,
  relevantPlans,
} from "../../../tools/leinoctl/src/plans.mjs";

const REPOSITORY_PLAN_DIRECTORIES = Object.freeze({
  activeDir: "docs/agents/plans/active",
  archiveDir: "docs/agents/plans/archive",
});

export {
  VALID_PLAN_STATUSES,
  activePlanSummary,
  authorizingPlans,
  parsePlanFile,
  parsePlanManifest,
  registryIssues,
  relevantPlans,
};

export function loadPlanRegistry(repoRoot) {
  return loadGenericPlanRegistry(repoRoot, REPOSITORY_PLAN_DIRECTORIES);
}
