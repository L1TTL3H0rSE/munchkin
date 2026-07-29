import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { claimIntersectsPath, claimMatchesPath, normalizeClaim } from "./claims.mjs";
import { LeinoError } from "./errors.mjs";
import { readText, readTextPrefix, resolveInside } from "./fs.mjs";

export const VALID_PLAN_STATUSES = new Set([
  "draft",
  "awaiting_approval",
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
]);

const MUTATING_WRITE_SET_MODES = new Set([
  "write",
  "source",
  "generated",
  "migration",
  "delete",
]);
const VALID_PARALLELISM_MODES = new Set([
  "parallel",
  "conditional",
  "exclusive",
]);
const PLAN_SLUG_SOURCE = "[a-z0-9]+(?:-[a-z0-9]+)*";
const LEGACY_PLAN_FILE_RE = new RegExp(`^\\d{4}-${PLAN_SLUG_SOURCE}\\.md$`);
const MODERN_PLAN_FILE_RE = new RegExp(
  `^\\d{8}T\\d{6}Z-[a-f0-9]{6}-${PLAN_SLUG_SOURCE}\\.md$`,
);
const PLAN_FILE_RE = new RegExp(
  `(?:${LEGACY_PLAN_FILE_RE.source})|(?:${MODERN_PLAN_FILE_RE.source})`,
);
const PLAN_ID_RE = new RegExp(
  `^(?:\\d{4}|\\d{8}T\\d{6}Z-[a-f0-9]{6})-${PLAN_SLUG_SOURCE}$`,
);
const MANIFEST_KEYS = new Set([
  "schemaVersion",
  "paths",
  "components",
  "contracts",
  "dependsOn",
  "sharedResources",
]);
const MANIFEST_REQUIRED_KEYS = [
  "paths",
  "components",
  "contracts",
  "dependsOn",
  "sharedResources",
];

function valueFromInlineCode(value) {
  return String(value ?? "").trim().replace(/^`|`$/g, "");
}

function sectionLines(lines, headings) {
  const accepted = new Set(Array.isArray(headings) ? headings : [headings]);
  const start = lines.findIndex((line) => accepted.has(line.trim()));
  if (start < 0) {
    return [];
  }
  const level = lines[start].match(/^#+/)?.[0].length ?? 2;
  const result = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const headingLevel = lines[index].match(/^#+\s/)?.[0].trim().length;
    if (headingLevel && headingLevel <= level) {
      break;
    }
    result.push(lines[index]);
  }
  return result;
}

function metadataFrom(lines) {
  const metadata = new Map();
  for (const line of lines) {
    const match = line.match(/^- \*\*([^*]+):\*\*\s*(.+?)\s*$/);
    if (match) {
      metadata.set(match[1].trim(), match[2].trim());
    }
    if (line.startsWith("## ")) {
      break;
    }
  }
  return metadata;
}

function metadataValue(metadata, ...keys) {
  for (const key of keys) {
    if (metadata.has(key)) {
      return metadata.get(key);
    }
  }
  return "";
}

function parseWriteSet(lines) {
  const section = sectionLines(lines, "### Write set");
  const claims = [];
  const issues = [];
  const unknownModes = [];
  for (const line of section) {
    if (!line.trim().startsWith("|")) {
      continue;
    }
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2 || /^(Путь|Path|---)/i.test(cells[0])) {
      continue;
    }
    const claim = valueFromInlineCode(cells[0]);
    const mode = valueFromInlineCode(cells[1]).toLowerCase();
    if (!MUTATING_WRITE_SET_MODES.has(mode)) {
      unknownModes.push({ claim, mode });
      continue;
    }
    try {
      claims.push({ path: normalizeClaim(claim), mode });
    } catch (error) {
      issues.push({ code: "invalid-write-claim", message: error.message });
    }
  }
  return { claims, issues, unknownModes };
}

function parseApproval(lines) {
  const section = sectionLines(lines, ["## Согласование", "## Approval"]);
  const metadata = metadataFrom(section);
  return {
    status: valueFromInlineCode(metadataValue(metadata, "Статус", "Status")),
    confirmed: valueFromInlineCode(metadataValue(metadata, "Подтверждено", "Confirmed")),
  };
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new LeinoError("plan-manifest-invalid", `${label} must be an array of strings`);
  }
  const normalized = value.map((entry) => entry.trim());
  if (normalized.some((entry) => entry.length === 0)) {
    throw new LeinoError("plan-manifest-invalid", `${label} must not contain empty values`);
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new LeinoError("plan-manifest-invalid", `${label} must not contain duplicates`);
  }
  return normalized;
}

export function parsePlanManifest(text, fallback = {}) {
  const lines = String(text).split(/\r?\n/);
  const section = sectionLines(lines, [
    "## Machine-readable manifest",
    "## Машиночитаемый manifest",
  ]).join("\n");
  const match = section.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!match) {
    return {
      schemaVersion: 0,
      legacy: true,
      paths: (fallback.writeSet ?? []).map((claim) => claim.path),
      components: [],
      contracts: [],
      dependsOn: fallback.dependsOn ?? [],
      sharedResources: [],
    };
  }
  let raw;
  try {
    raw = JSON.parse(match[1]);
  } catch (error) {
    throw new LeinoError("plan-manifest-invalid", `invalid plan manifest JSON: ${error.message}`);
  }
  if (raw.schemaVersion !== 1) {
    throw new LeinoError("plan-manifest-version-unsupported", "plan manifest schemaVersion must be 1");
  }
  for (const key of Object.keys(raw)) {
    if (!MANIFEST_KEYS.has(key)) {
      throw new LeinoError(
        "plan-manifest-invalid",
        `manifest.${key} is not allowed by schemaVersion 1`,
      );
    }
  }
  for (const key of MANIFEST_REQUIRED_KEYS) {
    if (!Object.hasOwn(raw, key)) {
      throw new LeinoError(
        "plan-manifest-invalid",
        `manifest.${key} is required by schemaVersion 1`,
      );
    }
  }
  return {
    schemaVersion: 1,
    legacy: false,
    paths: stringArray(raw.paths, "manifest.paths").map(normalizeClaim),
    components: stringArray(raw.components, "manifest.components"),
    contracts: stringArray(raw.contracts, "manifest.contracts"),
    dependsOn: stringArray(raw.dependsOn, "manifest.dependsOn"),
    sharedResources: stringArray(raw.sharedResources, "manifest.sharedResources"),
  };
}

function dependencyIds(metadata) {
  const raw = valueFromInlineCode(metadataValue(metadata, "Зависит от", "Depends on"));
  if (!raw || /^(нет|none)$/i.test(raw)) {
    return [];
  }
  return [...raw.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1])
    .filter((candidate) => PLAN_ID_RE.test(candidate));
}

export function parsePlanFile(filePath, placement) {
  const text = readText(filePath);
  const lines = text.split(/\r?\n/);
  const metadata = metadataFrom(lines);
  const fileName = path.basename(filePath);
  const planId = valueFromInlineCode(metadataValue(metadata, "Plan ID"));
  const status = valueFromInlineCode(metadataValue(metadata, "Статус", "Status"));
  const approval = parseApproval(lines);
  const writeSet = parseWriteSet(lines);
  const issues = [...writeSet.issues];
  const owner = valueFromInlineCode(metadataValue(metadata, "Владелец", "Owner"));
  const workspace = valueFromInlineCode(metadataValue(metadata, "Workspace"));
  const parallelism = valueFromInlineCode(
    metadataValue(metadata, "Режим параллельности", "Parallelism"),
  ).toLowerCase();
  const declaredDependencies = dependencyIds(metadata);
  const numericPrefix = fileName.match(/^(\d{4})-/)?.[1] ?? "";
  const modernKey = fileName.match(/^(\d{8}T\d{6}Z-[a-f0-9]{6})-/)?.[1] ?? "";

  if (!PLAN_FILE_RE.test(fileName)) {
    issues.push({ code: "invalid-plan-filename", message: `invalid plan filename: ${fileName}` });
  }
  if (planId !== fileName.replace(/\.md$/, "")) {
    issues.push({
      code: "plan-id-mismatch",
      message: `Plan ID ${planId || "<missing>"} does not match ${fileName}`,
    });
  }
  if (!VALID_PLAN_STATUSES.has(status)) {
    issues.push({ code: "invalid-plan-status", message: `invalid plan status: ${status || "<missing>"}` });
  }
  const approvalStatus = approval.status.toLowerCase();
  const hasApproval = approvalStatus.startsWith("approved")
    && approval.confirmed
    && approval.confirmed !== "—";
  if (status === "awaiting_approval" && approvalStatus.startsWith("approved")) {
    issues.push({
      code: "approval-status-mismatch",
      message: "header awaits approval while approval section is approved",
    });
  }
  if (["approved", "in_progress", "completed"].includes(status) && !hasApproval) {
    issues.push({
      code: "missing-approval-evidence",
      message: `${status} plan lacks approved status and confirmation`,
    });
  }
  if (placement === "active" && ["completed", "cancelled"].includes(status)) {
    issues.push({ code: "wrong-plan-placement", message: `${status} plan must be archived` });
  }
  if (placement === "archive" && !["completed", "cancelled"].includes(status)) {
    issues.push({ code: "wrong-plan-placement", message: `${status} plan must stay active` });
  }
  if (
    placement === "active"
    && writeSet.claims.length === 0
    && !["draft", "cancelled"].includes(status)
  ) {
    issues.push({ code: "missing-write-set", message: "plan has no parseable write-set claims" });
  }

  let manifest;
  try {
    manifest = parsePlanManifest(text, {
      writeSet: writeSet.claims,
      dependsOn: dependencyIds(metadata),
    });
  } catch (error) {
    issues.push({ code: error.code ?? "plan-manifest-invalid", message: error.message });
    manifest = {
      schemaVersion: 0,
      legacy: true,
      paths: writeSet.claims.map((claim) => claim.path),
      components: [],
      contracts: [],
      dependsOn: dependencyIds(metadata),
      sharedResources: [],
    };
  }
  if (!manifest.legacy) {
    const intersects = (left, right) => (
      normalizeClaim(left) === normalizeClaim(right)
      || claimIntersectsPath(left, right)
      || claimIntersectsPath(right, left)
    );
    for (const claim of writeSet.claims) {
      if (!manifest.paths.some((manifestPath) => intersects(manifestPath, claim.path))) {
        issues.push({
          code: "write-claim-missing-from-manifest",
          message: `write-set claim is absent from manifest.paths: ${claim.path}`,
        });
      }
    }
    for (const manifestPath of manifest.paths) {
      if (!writeSet.claims.some((claim) => intersects(manifestPath, claim.path))) {
        issues.push({
          code: "manifest-path-missing-write-claim",
          message: `manifest.paths entry is absent from mutating write set: ${manifestPath}`,
        });
      }
    }
    if (
      ["approved", "in_progress", "completed"].includes(status)
      && (!owner || owner === "—")
    ) {
      issues.push({
        code: "plan-owner-missing",
        message: `${status} plan must declare an owner`,
      });
    }
    if (!workspace || workspace === "—") {
      issues.push({
        code: "plan-workspace-missing",
        message: "manifest plan must declare its workspace",
      });
    }
    if (!VALID_PARALLELISM_MODES.has(parallelism)) {
      issues.push({
        code: "plan-parallelism-invalid",
        message: `manifest plan has invalid parallelism mode: ${parallelism || "<missing>"}`,
      });
    }
    for (const entry of writeSet.unknownModes) {
      issues.push({
        code: "write-access-kind-invalid",
        message: `manifest plan has unsupported write access/kind ${entry.mode || "<missing>"} for ${entry.claim}`,
      });
    }
    if (
      JSON.stringify([...declaredDependencies].sort())
      !== JSON.stringify([...manifest.dependsOn].sort())
    ) {
      issues.push({
        code: "plan-dependencies-mismatch",
        message: "header dependencies and manifest.dependsOn must match",
      });
    }
  }

  return {
    filePath,
    fileName,
    placement,
    text,
    planId,
    numericPrefix,
    coordinationKey: numericPrefix || modernKey,
    status,
    owner,
    workspace,
    parallelism,
    approval,
    manifest,
    writeSet: writeSet.claims,
    unchecked: lines.filter((line) => /^\s*-\s*\[\s\]/.test(line)).length,
    issues,
    eligible: ["approved", "in_progress"].includes(status) && issues.length === 0,
  };
}

function readPlanDirectory(directory, placement) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => parsePlanFile(path.join(directory, entry.name), placement));
}

export function loadPlanRegistry(repoRoot, { activeDir, archiveDir } = {}) {
  if (!activeDir || !archiveDir) {
    throw new LeinoError(
      "plan-registry-config-missing",
      "activeDir and archiveDir are required by the generic plan engine",
    );
  }
  const active = readPlanDirectory(resolveInside(repoRoot, activeDir, "active plans"), "active");
  const archive = readPlanDirectory(resolveInside(repoRoot, archiveDir, "archived plans"), "archive");
  const all = [...active, ...archive];
  const idCounts = new Map();
  const prefixCounts = new Map();
  const modernKeyCounts = new Map();
  for (const plan of all) {
    idCounts.set(plan.planId, (idCounts.get(plan.planId) ?? 0) + 1);
    prefixCounts.set(plan.numericPrefix, (prefixCounts.get(plan.numericPrefix) ?? 0) + 1);
    if (!plan.numericPrefix && plan.coordinationKey) {
      modernKeyCounts.set(
        plan.coordinationKey,
        (modernKeyCounts.get(plan.coordinationKey) ?? 0) + 1,
      );
    }
  }
  for (const plan of all) {
    if (plan.planId && idCounts.get(plan.planId) > 1) {
      plan.issues.push({ code: "duplicate-plan-id", message: `duplicate Plan ID: ${plan.planId}` });
    }
    if (plan.numericPrefix && prefixCounts.get(plan.numericPrefix) > 1) {
      plan.issues.push({
        code: "duplicate-plan-prefix",
        message: `duplicate four-digit plan prefix: ${plan.numericPrefix}`,
      });
    }
    if (
      !plan.numericPrefix
      && plan.coordinationKey
      && modernKeyCounts.get(plan.coordinationKey) > 1
    ) {
      plan.issues.push({
        code: "duplicate-plan-key",
        message: `duplicate timestamp/entropy plan key: ${plan.coordinationKey}`,
      });
    }
    plan.eligible = ["approved", "in_progress"].includes(plan.status) && plan.issues.length === 0;
  }
  const plansById = new Map(all.map((plan) => [plan.planId, plan]));
  for (const plan of all.filter((candidate) => !candidate.manifest.legacy)) {
    for (const dependency of plan.manifest.dependsOn) {
      if (dependency === plan.planId) {
        plan.issues.push({
          code: "plan-self-dependency",
          message: `plan depends on itself: ${dependency}`,
        });
      } else if (!plansById.has(dependency)) {
        plan.issues.push({
          code: "plan-dependency-missing",
          message: `plan dependency is not visible in active/archive registry: ${dependency}`,
        });
      }
    }
  }
  for (const plan of all.filter((candidate) => !candidate.manifest.legacy)) {
    const visiting = new Set();
    const visited = new Set();
    const hasCycle = (current) => {
      if (visiting.has(current.planId)) {
        return true;
      }
      if (visited.has(current.planId)) {
        return false;
      }
      visiting.add(current.planId);
      for (const dependencyId of current.manifest.dependsOn) {
        const dependency = plansById.get(dependencyId);
        if (dependency && !dependency.manifest.legacy && hasCycle(dependency)) {
          return true;
        }
      }
      visiting.delete(current.planId);
      visited.add(current.planId);
      return false;
    };
    if (hasCycle(plan)) {
      plan.issues.push({
        code: "plan-dependency-cycle",
        message: `dependency cycle reaches ${plan.planId}`,
      });
    }
  }
  const concurrentlyEligible = active.filter(
    (plan) => ["approved", "in_progress"].includes(plan.status) && plan.issues.length === 0,
  );
  for (let leftIndex = 0; leftIndex < concurrentlyEligible.length; leftIndex += 1) {
    const left = concurrentlyEligible[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < concurrentlyEligible.length; rightIndex += 1) {
      const right = concurrentlyEligible[rightIndex];
      const ordered = left.manifest.dependsOn.includes(right.planId)
        || right.manifest.dependsOn.includes(left.planId);
      if (ordered) {
        continue;
      }
      const overlappingClaim = left.writeSet.find((leftClaim) => (
        right.writeSet.some((rightClaim) => (
          claimIntersectsPath(leftClaim.path, rightClaim.path)
          || claimIntersectsPath(rightClaim.path, leftClaim.path)
        ))
      ));
      const overlappingResource = left.manifest.sharedResources.find(
        (resource) => right.manifest.sharedResources.includes(resource),
      );
      if (overlappingClaim) {
        left.issues.push({
          code: "active-plan-write-overlap",
          message: `unsequenced write overlap with ${right.planId}: ${overlappingClaim.path}`,
        });
        right.issues.push({
          code: "active-plan-write-overlap",
          message: `unsequenced write overlap with ${left.planId}: ${overlappingClaim.path}`,
        });
      }
      if (overlappingResource) {
        left.issues.push({
          code: "active-plan-shared-resource-overlap",
          message: `unsequenced shared resource with ${right.planId}: ${overlappingResource}`,
        });
        right.issues.push({
          code: "active-plan-shared-resource-overlap",
          message: `unsequenced shared resource with ${left.planId}: ${overlappingResource}`,
        });
      }
    }
  }
  for (const plan of all) {
    plan.eligible = ["approved", "in_progress"].includes(plan.status) && plan.issues.length === 0;
  }
  return { active, archive, all };
}

export function authorizingPlans(registry, repoPath) {
  return registry.active.filter(
    (plan) => plan.eligible && plan.writeSet.some((claim) => claimMatchesPath(claim.path, repoPath)),
  );
}

export function registryIssues(registry) {
  return registry.all.flatMap((plan) => plan.issues.map((issue) => ({
    ...issue,
    planId: plan.planId || plan.fileName,
    filePath: plan.filePath,
  })));
}

export function activePlanSummary(registry) {
  return registry.active.map((plan) => ({
    planId: plan.planId,
    status: plan.status,
    eligible: plan.eligible,
    unchecked: plan.unchecked,
    issueCount: plan.issues.length,
    manifestVersion: plan.manifest.schemaVersion,
  }));
}

export function relevantPlans(registry, {
  paths = [],
  components = [],
  contracts = [],
  sharedResources = [],
} = {}) {
  const relevant = new Set();
  for (const plan of registry.active) {
    const manifest = plan.manifest;
    if (
      paths.some((changedPath) => manifest.paths.some(
        (claim) => claimIntersectsPath(claim, changedPath),
      ))
      || components.some((component) => manifest.components.includes(component))
      || contracts.some((contract) => manifest.contracts.includes(contract))
      || sharedResources.some((resource) => manifest.sharedResources.includes(resource))
    ) {
      relevant.add(plan.planId);
    }
  }
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const plan of registry.active) {
      if (relevant.has(plan.planId)) {
        for (const dependency of plan.manifest.dependsOn) {
          if (registry.active.some((candidate) => candidate.planId === dependency)) {
            if (!relevant.has(dependency)) {
              relevant.add(dependency);
              expanded = true;
            }
          }
        }
        for (const candidate of registry.active) {
          if (
            !relevant.has(candidate.planId)
            && plan.manifest.sharedResources.some(
              (resource) => candidate.manifest.sharedResources.includes(resource),
            )
          ) {
            relevant.add(candidate.planId);
            expanded = true;
          }
        }
      }
    }
  }
  return registry.active.filter((plan) => relevant.has(plan.planId));
}

function manifestMatches(manifest, {
  paths = [],
  components = [],
  contracts = [],
  sharedResources = [],
}) {
  return paths.some((changedPath) => manifest.paths.some(
    (claim) => claimIntersectsPath(claim, changedPath),
    ))
    || components.some((component) => manifest.components.includes(component))
    || contracts.some((contract) => manifest.contracts.includes(contract))
    || sharedResources.some((resource) => manifest.sharedResources.includes(resource));
}

export function loadRelevantPlanDocuments(repoRoot, { activeDir }, criteria = {}) {
  const directory = resolveInside(repoRoot, activeDir, "active plans");
  const entries = fs.existsSync(directory)
    ? fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
      .sort((left, right) => left.name.localeCompare(right.name))
    : [];
  const index = entries.map((entry) => {
    const filePath = path.join(directory, entry.name);
    const prefix = readTextPrefix(filePath);
    let manifest;
    try {
      manifest = parsePlanManifest(prefix);
    } catch (error) {
      return {
        planId: entry.name.replace(/\.md$/, ""),
        filePath,
        legacy: true,
        loadedFull: true,
        plan: parsePlanFile(filePath, "active"),
        manifestError: error.message,
      };
    }
    if (manifest.legacy) {
      const plan = parsePlanFile(filePath, "active");
      return {
        planId: plan.planId,
        filePath,
        legacy: true,
        loadedFull: true,
        plan,
        manifest: plan.manifest,
      };
    }
    return {
      planId: entry.name.replace(/\.md$/, ""),
      filePath,
      legacy: false,
      loadedFull: false,
      manifest,
    };
  });

  const selected = new Set();
  for (const entry of index) {
    const manifest = entry.plan?.manifest ?? entry.manifest;
    if (manifestMatches(manifest, criteria)) {
      selected.add(entry.planId);
    }
  }
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const entry of index) {
      const manifest = entry.plan?.manifest ?? entry.manifest;
      if (selected.has(entry.planId)) {
        for (const dependency of manifest.dependsOn) {
          if (!selected.has(dependency) && index.some((candidate) => candidate.planId === dependency)) {
            selected.add(dependency);
            expanded = true;
          }
        }
        for (const candidate of index) {
          const candidateManifest = candidate.plan?.manifest ?? candidate.manifest;
          if (
            !selected.has(candidate.planId)
            && manifest.sharedResources.some(
              (resource) => candidateManifest.sharedResources.includes(resource),
            )
          ) {
            selected.add(candidate.planId);
            expanded = true;
          }
        }
      }
    }
  }

  const plans = [];
  for (const entry of index) {
    if (!selected.has(entry.planId)) {
      continue;
    }
    if (!entry.plan) {
      entry.plan = parsePlanFile(entry.filePath, "active");
      entry.loadedFull = true;
    }
    plans.push(entry.plan);
  }
  return {
    plans,
    index: index.map((entry) => ({
      planId: entry.planId,
      legacy: entry.legacy,
      loadedFull: entry.loadedFull,
      selected: selected.has(entry.planId),
    })),
  };
}

function planFileNames(directory) {
  return fs.existsSync(directory)
    ? fs.readdirSync(directory).filter((entry) => PLAN_FILE_RE.test(entry))
    : [];
}

function newPlanText(planId, shortName, createdAt, { activeDir, archiveDir }) {
  const activePlanPath = `${activeDir}/${planId}.md`;
  const archivedPlanPath = `${archiveDir}/${planId}.md`;
  return [
    `# PLAN: ${shortName.replaceAll("-", " ")}`,
    "",
    `- **Plan ID:** \`${planId}\``,
    "- **Статус:** draft",
    `- **Создан:** ${createdAt}`,
    `- **Обновлён:** ${createdAt}`,
    "- **Владелец:** —",
    "- **Workspace:** shared",
    "- **Ветка:** current",
    "- **Режим параллельности:** conditional",
    "- **Зависит от:** нет",
    "- **Блокирует:** нет",
    "- **Связанные ADR/handoff:** —",
    "",
    "## Machine-readable manifest",
    "",
    "```json",
    JSON.stringify({
      schemaVersion: 1,
      paths: [activePlanPath, archivedPlanPath],
      components: [],
      contracts: [],
      dependsOn: [],
      sharedResources: [],
    }, null, 2),
    "```",
    "",
    "## Цель",
    "",
    "Заполнить наблюдаемый результат.",
    "",
    "## Критерии приёмки",
    "",
    "- [ ] Заполнить проверяемые критерии.",
    "",
    "## Контекст и подтверждённое состояние",
    "",
    "- Заполнить после read-only исследования.",
    "",
    "## Scope",
    "",
    "### Входит",
    "",
    "- Заполнить.",
    "",
    "### Не входит",
    "",
    "- Заполнить.",
    "",
    "## Архитектурный подход",
    "",
    "- Заполнить.",
    "",
    "## Затронутые компоненты и контракты",
    "",
    "| Компонент | Изменение | Публичный контракт/данные |",
    "|---|---|---|",
    "| — | — | — |",
    "",
    "## Координация с другими планами",
    "",
    "### Write set",
    "",
    "| Путь/ресурс | Режим | Причина |",
    "|---|---|---|",
    `| \`${activePlanPath}\` | write | Active lifecycle плана |`,
    `| \`${archivedPlanPath}\` | write | Archived lifecycle плана |`,
    "",
    "### Shared resources",
    "",
    "| Ресурс | Другие планы | Владелец | Порядок/стратегия |",
    "|---|---|---|---|",
    "| Нет | — | — | — |",
    "",
    "### Проверка конфликтов",
    "",
    `- **Проверены active plans:** ${createdAt}`,
    "- **Обнаруженные пересечения:** заполнить",
    "- **Решение:** заполнить",
    "",
    "## План реализации",
    "",
    "1. [ ] Заполнить атомарные шаги.",
    "",
    "## Проверки",
    "",
    "- [ ] Заполнить canonical checks.",
    "",
    "## Риски и откат",
    "",
    "- **Риск:** заполнить.",
    "- **Откат:** заполнить.",
    "",
    "## Открытые вопросы",
    "",
    "- Заполнить.",
    "",
    "## Согласование",
    "",
    "- **Статус:** awaiting user approval",
    `- **Запрошено:** ${createdAt}`,
    "- **Подтверждено:** —",
    "- **Формулировка/ограничения пользователя:** —",
    "",
    "## Ход выполнения",
    "",
    "- Draft создан атомарно; реализация не начата.",
    "",
    "## Итог",
    "",
    "Заполняется после реализации.",
    "",
  ].join("\n");
}

export function createPlanDraft(repoRoot, { activeDir, archiveDir }, shortName, {
  now = new Date(),
  runtimeDir = ".leino/runtime",
  randomHex = () => crypto.randomBytes(3).toString("hex"),
} = {}) {
  const slug = String(shortName ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new LeinoError(
      "plan-short-name-invalid",
      `plan short name must be lowercase kebab-case: ${shortName}`,
    );
  }
  const activePath = resolveInside(repoRoot, activeDir, "active plans");
  const archivePath = resolveInside(repoRoot, archiveDir, "archived plans");
  const runtimePath = resolveInside(repoRoot, runtimeDir, "plan registry runtime");
  const lockPath = path.join(runtimePath, "plan-registry.lock");
  fs.mkdirSync(activePath, { recursive: true });
  fs.mkdirSync(runtimePath, { recursive: true });
  const createdAt = now.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");

  let lockDescriptor = null;
  const waitArray = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; attempt < 200 && lockDescriptor === null; attempt += 1) {
    try {
      lockDescriptor = fs.openSync(lockPath, "wx", 0o600);
      fs.writeFileSync(lockDescriptor, `${process.pid} ${Date.now()}\n`, "utf8");
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > 30_000) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch {
        continue;
      }
      Atomics.wait(waitArray, 0, 0, 10);
    }
  }
  if (lockDescriptor === null) {
    throw new LeinoError("plan-registry-busy", "plan registry is busy; retry plan create");
  }

  try {
    const names = [...planFileNames(activePath), ...planFileNames(archivePath)];
    const usedKeys = new Set(names.map((fileName) => (
      fileName.match(/^(\d{4})-/)?.[1]
      ?? fileName.match(/^(\d{8}T\d{6}Z-[a-f0-9]{6})-/)?.[1]
    )).filter(Boolean));
    const timestamp = now.toISOString()
      .replaceAll("-", "")
      .replaceAll(":", "")
      .replace(/\.\d{3}/, "");
    for (let attempt = 0; attempt < 1_000; attempt += 1) {
      const entropy = String(randomHex()).toLowerCase();
      if (!/^[a-f0-9]{6}$/.test(entropy)) {
        throw new LeinoError("plan-entropy-invalid", `invalid six-hex entropy: ${entropy}`);
      }
      const key = `${timestamp}-${entropy}`;
      if (usedKeys.has(key)) {
        continue;
      }
      const planId = `${key}-${slug}`;
      const filePath = path.join(activePath, `${planId}.md`);
      fs.writeFileSync(filePath, newPlanText(planId, slug, createdAt, {
        activeDir,
        archiveDir,
      }), {
        encoding: "utf8",
        flag: "wx",
      });
      return { planId, filePath };
    }
    throw new LeinoError(
      "plan-id-exhausted",
      "could not allocate a unique timestamp and entropy plan id",
    );
  } finally {
    fs.closeSync(lockDescriptor);
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // A stale lock is recoverable by the next create attempt.
    }
  }
}
