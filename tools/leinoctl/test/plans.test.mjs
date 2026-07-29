import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  createPlanDraft,
  loadPlanRegistry,
  loadRelevantPlanDocuments,
  relevantPlans,
} from "../src/plans.mjs";
import { temporaryDirectory, writeFile } from "./helpers.mjs";

function planText(planId, {
  status = "in_progress",
  manifestPaths = ["src/**"],
  writeSetPaths = manifestPaths,
  writeMode = "write",
  dependsOn = [],
  sharedResources = [],
  extraManifest = {},
} = {}) {
  return [
    "# PLAN: Fixture",
    "",
    `- **Plan ID:** \`${planId}\``,
    `- **Статус:** ${status}`,
    "- **Владелец:** fixture agent",
    "- **Workspace:** fixture",
    "- **Режим параллельности:** conditional",
    `- **Зависит от:** ${dependsOn.length ? dependsOn.map((entry) => `\`${entry}\``).join(", ") : "нет"}`,
    "",
    "## Machine-readable manifest",
    "",
    "```json",
    JSON.stringify({
      schemaVersion: 1,
      paths: manifestPaths,
      components: [],
      contracts: [],
      dependsOn,
      sharedResources,
      ...extraManifest,
    }, null, 2),
    "```",
    "",
    "## Scope",
    "",
    "### Write set",
    "",
    "| Path | Mode | Reason |",
    "|---|---|---|",
    ...writeSetPaths.map((writePath) => `| \`${writePath}\` | ${writeMode} | fixture |`),
    "",
    "## Согласование",
    "",
    "- **Статус:** approved",
    "- **Подтверждено:** 2026-07-27 fixture",
    "",
  ].join("\n");
}

test("generic plan registry uses configured directories and relevance manifest", () => {
  const root = temporaryDirectory();
  writeFile(root, "control/active/0100-source.md", planText("0100-source"));
  writeFile(
    root,
    "control/active/0101-docs.md",
    planText("0101-docs", { manifestPaths: ["docs/**"] }),
  );
  fs.mkdirSync(`${root}/control/archive`, { recursive: true });
  const registry = loadPlanRegistry(root, {
    activeDir: "control/active",
    archiveDir: "control/archive",
  });
  assert.deepEqual(
    relevantPlans(registry, { paths: ["src/index.js"] }).map((plan) => plan.planId),
    ["0100-source"],
  );
  assert.equal(registry.active[0].manifest.legacy, false);
});

test("numeric prefixes are unique even when full plan IDs differ", () => {
  const root = temporaryDirectory();
  writeFile(root, "control/active/0100-source.md", planText("0100-source"));
  writeFile(
    root,
    "control/archive/0100-other.md",
    planText("0100-other", { status: "completed" }),
  );
  const registry = loadPlanRegistry(root, {
    activeDir: "control/active",
    archiveDir: "control/archive",
  });
  assert.ok(registry.all.every(
    (plan) => plan.issues.some((issue) => issue.code === "duplicate-plan-prefix"),
  ));
});

test("manifest-first relevance does not read full irrelevant plan documents", () => {
  const root = temporaryDirectory();
  const file = writeFile(
    root,
    "control/active/0100-docs.md",
    `${planText("0100-docs", { manifestPaths: ["docs/**"] })}\n${"x".repeat(70_000)}`,
  );
  fs.appendFileSync(file, Buffer.from([0xD0, 0x20]));

  const irrelevant = loadRelevantPlanDocuments(
    root,
    { activeDir: "control/active" },
    { paths: ["src/index.js"] },
  );
  assert.deepEqual(irrelevant.plans, []);
  assert.deepEqual(irrelevant.index, [{
    planId: "0100-docs",
    legacy: false,
    loadedFull: false,
    selected: false,
  }]);
  assert.throws(
    () => loadRelevantPlanDocuments(
      root,
      { activeDir: "control/active" },
      { paths: ["docs/README.md"] },
    ),
    /strict UTF-8/,
  );
});

test("plan creation uses a sortable timestamp plus entropy without overwriting", () => {
  const root = temporaryDirectory();
  fs.mkdirSync(`${root}/control/active`, { recursive: true });
  fs.mkdirSync(`${root}/control/archive`, { recursive: true });
  writeFile(root, "control/archive/0055-existing.md", planText("0055-existing", {
    status: "completed",
  }));
  const directories = {
    activeDir: "control/active",
    archiveDir: "control/archive",
  };
  const first = createPlanDraft(root, directories, "first-task", {
    now: new Date("2026-07-27T10:00:00Z"),
    runtimeDir: "control/runtime",
    randomHex: () => "a1b2c3",
  });
  const second = createPlanDraft(root, directories, "second-task", {
    now: new Date("2026-07-27T10:00:01Z"),
    runtimeDir: "control/runtime",
    randomHex: () => "a1b2c3",
  });
  assert.equal(first.planId, "20260727T100000Z-a1b2c3-first-task");
  assert.equal(second.planId, "20260727T100001Z-a1b2c3-second-task");
  const createdText = fs.readFileSync(first.filePath, "utf8");
  assert.match(createdText, /"schemaVersion": 1/);
  assert.match(createdText, /control\/active\/20260727T100000Z-a1b2c3-first-task\.md/);
  assert.match(createdText, /control\/archive\/20260727T100000Z-a1b2c3-first-task\.md/);
  assert.doesNotMatch(createdText, /docs\/agents\/plans/);
  assert.throws(
    () => createPlanDraft(root, directories, "../invalid"),
    /lowercase kebab-case/,
  );
});

test("modern timestamp plan keys are parsed and cannot be reused", () => {
  const root = temporaryDirectory();
  const firstId = "20260727T100000Z-a1b2c3-first-task";
  const secondId = "20260727T100000Z-a1b2c3-second-task";
  writeFile(root, `control/active/${firstId}.md`, planText(firstId));
  writeFile(
    root,
    `control/archive/${secondId}.md`,
    planText(secondId, { status: "completed" }),
  );
  const registry = loadPlanRegistry(root, {
    activeDir: "control/active",
    archiveDir: "control/archive",
  });
  assert.ok(registry.all.every(
    (plan) => plan.issues.some((issue) => issue.code === "duplicate-plan-key"),
  ));
});

test("relevance expands through shared resources", () => {
  const root = temporaryDirectory();
  writeFile(
    root,
    "control/active/0100-source.md",
    planText("0100-source", {
      manifestPaths: ["src/**"],
      sharedResources: ["public-contract"],
    }),
  );
  writeFile(
    root,
    "control/active/0101-coordinator.md",
    planText("0101-coordinator", {
      manifestPaths: ["other/**"],
      sharedResources: ["public-contract"],
    }),
  );
  fs.mkdirSync(`${root}/control/archive`, { recursive: true });
  const directories = {
    activeDir: "control/active",
    archiveDir: "control/archive",
  };
  const registry = loadPlanRegistry(root, directories);
  assert.deepEqual(
    relevantPlans(registry, { paths: ["src/index.js"] }).map((plan) => plan.planId),
    ["0100-source", "0101-coordinator"],
  );
  assert.deepEqual(
    loadRelevantPlanDocuments(root, directories, {
      paths: ["src/index.js"],
    }).plans.map((plan) => plan.planId),
    ["0100-source", "0101-coordinator"],
  );
});

test("plan manifest rejects fields outside its published schema", () => {
  const root = temporaryDirectory();
  writeFile(
    root,
    "control/active/0100-source.md",
    planText("0100-source", { extraManifest: { typo: true } }),
  );
  fs.mkdirSync(`${root}/control/archive`, { recursive: true });
  const registry = loadPlanRegistry(root, {
    activeDir: "control/active",
    archiveDir: "control/archive",
  });
  assert.ok(registry.active[0].issues.some(
    (issue) => issue.code === "plan-manifest-invalid",
  ));
});

test("plan manifest requires every v1 array and stays aligned with write set", () => {
  const root = temporaryDirectory();
  const missingRequired = planText("0102-missing-required").replace(
    '  "sharedResources": []',
    "",
  );
  writeFile(root, "control/active/0102-missing-required.md", missingRequired);
  const missingRegistry = loadPlanRegistry(root, {
    activeDir: "control/active",
    archiveDir: "control/archive",
  });
  assert.ok(missingRegistry.active[0].issues.some(
    (issue) => issue.code === "plan-manifest-invalid",
  ));

  const drifted = planText("0103-drifted", {
    manifestPaths: ["other/**"],
    writeSetPaths: ["src/**"],
  });
  writeFile(root, "control/active/0103-drifted.md", drifted);
  const driftedRegistry = loadPlanRegistry(root, {
    activeDir: "control/active",
    archiveDir: "control/archive",
  });
  const driftedPlan = driftedRegistry.active.find((plan) => plan.planId === "0103-drifted");
  assert.ok(driftedPlan.issues.some(
    (issue) => issue.code === "write-claim-missing-from-manifest",
  ));
  assert.ok(driftedPlan.issues.some(
    (issue) => issue.code === "manifest-path-missing-write-claim",
  ));
});

test("manifest plan lint validates owner, dependency graph and write access kind", () => {
  const root = temporaryDirectory();
  const invalidOwner = planText("0100-invalid-owner").replace(
    "- **Владелец:** fixture agent",
    "- **Владелец:** —",
  );
  writeFile(root, "control/active/0100-invalid-owner.md", invalidOwner);
  writeFile(
    root,
    "control/active/0101-invalid-mode.md",
    planText("0101-invalid-mode", { writeMode: "write/generated" }),
  );
  writeFile(
    root,
    "control/active/0102-missing-dependency.md",
    planText("0102-missing-dependency", { dependsOn: ["0199-absent"] }),
  );
  const registry = loadPlanRegistry(root, {
    activeDir: "control/active",
    archiveDir: "control/archive",
  });
  assert.ok(registry.active[0].issues.some(
    (issue) => issue.code === "plan-owner-missing",
  ));
  assert.ok(registry.active[1].issues.some(
    (issue) => issue.code === "write-access-kind-invalid",
  ));
  assert.ok(registry.active[2].issues.some(
    (issue) => issue.code === "plan-dependency-missing",
  ));
});

test("manifest plan lint rejects dependency cycles and unsequenced active overlap", () => {
  const root = temporaryDirectory();
  writeFile(
    root,
    "control/active/0100-left.md",
    planText("0100-left", { dependsOn: ["0101-right"] }),
  );
  writeFile(
    root,
    "control/active/0101-right.md",
    planText("0101-right", { dependsOn: ["0100-left"] }),
  );
  writeFile(
    root,
    "control/active/0102-overlap-a.md",
    planText("0102-overlap-a", { manifestPaths: ["shared/**"] }),
  );
  writeFile(
    root,
    "control/active/0103-overlap-b.md",
    planText("0103-overlap-b", { manifestPaths: ["shared/file.txt"] }),
  );
  writeFile(
    root,
    "control/active/0104-resource-a.md",
    planText("0104-resource-a", {
      manifestPaths: ["resource-a/**"],
      sharedResources: ["exclusive-registry"],
    }),
  );
  writeFile(
    root,
    "control/active/0105-resource-b.md",
    planText("0105-resource-b", {
      manifestPaths: ["resource-b/**"],
      sharedResources: ["exclusive-registry"],
    }),
  );
  const registry = loadPlanRegistry(root, {
    activeDir: "control/active",
    archiveDir: "control/archive",
  });
  assert.ok(registry.active[0].issues.some(
    (issue) => issue.code === "plan-dependency-cycle",
  ));
  assert.ok(registry.active[1].issues.some(
    (issue) => issue.code === "plan-dependency-cycle",
  ));
  assert.ok(registry.active[2].issues.some(
    (issue) => issue.code === "active-plan-write-overlap",
  ));
  assert.ok(registry.active[3].issues.some(
    (issue) => issue.code === "active-plan-write-overlap",
  ));
  assert.ok(registry.active[4].issues.some(
    (issue) => issue.code === "active-plan-shared-resource-overlap",
  ));
  assert.ok(registry.active[5].issues.some(
    (issue) => issue.code === "active-plan-shared-resource-overlap",
  ));
});
