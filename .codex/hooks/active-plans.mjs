import { findRepoRoot } from "./lib/paths.mjs";
import { activePlanSummary, loadPlanRegistry } from "./lib/plans.mjs";

const repoRoot = findRepoRoot(process.cwd());
const registry = loadPlanRegistry(repoRoot);

for (const plan of activePlanSummary(registry)) {
  process.stdout.write(
    `${plan.planId}\t${plan.status}\teligible=${plan.eligible}\tunchecked=${plan.unchecked}\tissues=${plan.issueCount}\n`,
  );
}
