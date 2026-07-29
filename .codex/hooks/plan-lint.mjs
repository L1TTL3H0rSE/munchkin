import path from "node:path";
import { findRepoRoot } from "./lib/paths.mjs";
import { loadPlanRegistry, registryIssues } from "./lib/plans.mjs";

const repoRoot = findRepoRoot(process.cwd());
const registry = loadPlanRegistry(repoRoot);
const issues = registryIssues(registry);

for (const issue of issues) {
  const relative = path.relative(repoRoot, issue.filePath).replaceAll("\\", "/");
  process.stderr.write(`${relative}: [${issue.code}] ${issue.message}\n`);
}

process.stdout.write(
  `plans=${registry.all.length} active=${registry.active.length} archive=${registry.archive.length} issues=${issues.length}\n`,
);
if (issues.length) {
  process.exitCode = 1;
}
