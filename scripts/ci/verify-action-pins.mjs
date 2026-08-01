import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const workflowRoot = path.join(repoRoot, ".github", "workflows");
const fullSha = /^[0-9a-f]{40}$/;
const codeqlSha = "c54b30b7df092240050e69945842bc67aee0f0f4";
const attestSha = "f7c74d28b9d84cb8768d0b8ca14a4bac6ef463e6";
const issues = [];

function readWorkflowFiles() {
  if (!fs.existsSync(workflowRoot)) {
    issues.push(".github/workflows is missing");
    return [];
  }
  return fs.readdirSync(workflowRoot)
    .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
    .sort()
    .map((entry) => ({
      name: entry,
      file: path.join(workflowRoot, entry),
      text: fs.readFileSync(path.join(workflowRoot, entry), "utf8"),
    }));
}

function checkActionUses(workflow) {
  const usesPattern = /^\s*uses:\s*([^\s#]+)\s*$/gm;
  for (const match of workflow.text.matchAll(usesPattern)) {
    const value = match[1];
    if (value.startsWith("./") || value.startsWith("docker://")) {
      continue;
    }
    const at = value.lastIndexOf("@");
    const reference = at === -1 ? "" : value.slice(at + 1);
    if (!fullSha.test(reference)) {
      issues.push(`${workflow.name}: action is not pinned to a full SHA: ${value}`);
    }
  }
}

function requireText(workflow, needle) {
  if (!workflow.text.includes(needle)) {
    issues.push(`${workflow.name}: missing required contract: ${needle}`);
  }
}

const workflows = readWorkflowFiles();
for (const workflow of workflows) {
  checkActionUses(workflow);
  if (workflow.text.includes("pull_request_target:")) {
    issues.push(`${workflow.name}: privileged pull_request_target is forbidden`);
  }
  if (workflow.text.includes("@latest") || workflow.text.includes(":latest")) {
    issues.push(`${workflow.name}: mutable latest reference is forbidden`);
  }
}

const ci = workflows.find(({ name }) => name === "ci.yml");
const deploy = workflows.find(({ name }) => name === "deploy-production.yml");
const security = workflows.find(({ name }) => name === "security.yml");

if (!ci) {
  issues.push("ci.yml is missing");
} else {
  requireText(ci, "permissions:\n  contents: read");
  requireText(ci, `actions/attest@${attestSha}`);
  requireText(ci, "environment: production-images");
  requireText(ci, "id-token: write");
  requireText(ci, "attestations: write");
}

if (!deploy) {
  issues.push("deploy-production.yml is missing");
} else {
  requireText(deploy, "if: github.ref == 'refs/heads/main'");
  requireText(deploy, "environment:\n      name: production-deploy");
  requireText(deploy, "verify-release-evidence.sh");
  requireText(deploy, "release_run_id:");
}

if (!security) {
  issues.push("security.yml is missing");
} else {
  requireText(security, "permissions:\n  contents: read");
  requireText(security, `github/codeql-action/init@${codeqlSha}`);
  requireText(security, `github/codeql-action/analyze@${codeqlSha}`);
  requireText(security, "scripts/ci/security-scan.sh");
  if (/secrets\./.test(security.text) || /id-token:\s*write/.test(security.text)) {
    issues.push("security.yml: fork-safe scanner workflow must not receive secrets or an OIDC token");
  }
}

if (issues.length) {
  for (const issue of issues) {
    console.error(`action-pins: ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log(`action-pins: ${workflows.length} workflow files use full-SHA actions and pass trust-boundary checks`);
}
