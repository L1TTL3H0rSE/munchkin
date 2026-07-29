import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  claimMatchesPath,
  extractPatchAddedText,
  extractPatchTargets,
  normalizeRepoRelative,
  isPlanLifecyclePath,
} from "../lib/paths.mjs";

const repoRoot = path.resolve("C:/workspace/repo");

test("repository path normalization rejects traversal", () => {
  assert.equal(normalizeRepoRelative(repoRoot, "docs/agents/README.md"), "docs/agents/README.md");
  assert.throws(() => normalizeRepoRelative(repoRoot, "../outside.txt"), /escapes repository root/);
});

test("repository path normalization uses the tool cwd for relative targets", () => {
  const nestedCwd = path.join(repoRoot, "frontend", "packages", "api");
  assert.equal(
    normalizeRepoRelative(repoRoot, "src/index.ts", nestedCwd),
    "frontend/packages/api/src/index.ts",
  );
  assert.throws(
    () => normalizeRepoRelative(repoRoot, "src/index.ts", path.join(repoRoot, "..", "outside")),
    /tool cwd escapes repository root/,
  );
});

test("patch parser extracts add, update, delete, and move targets", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: docs/agents/README.md",
    "@@",
    "+line",
    "*** Move to: docs/agents/README-new.md",
    `*** Add File: ${path.join(repoRoot, "src", "file with spaces.ts")}`,
    "+export {};",
    "*** Delete File: old.txt",
    "*** End Patch",
  ].join("\n");
  assert.deepEqual(
    extractPatchTargets(patch, repoRoot),
    [
      "docs/agents/README.md",
      "docs/agents/README-new.md",
      "src/file with spaces.ts",
      "old.txt",
    ],
  );
  assert.equal(extractPatchAddedText(patch), "line\nexport {};");
});

test("write claims support braces and recursive globs", () => {
  assert.equal(
    claimMatchesPath(".codex/agents/{explorer,reviewer}.toml", ".codex/agents/reviewer.toml"),
    true,
  );
  assert.equal(claimMatchesPath(".codex/hooks/**", ".codex/hooks/lib/policy.mjs"), true);
  assert.equal(claimMatchesPath(".codex/hooks/**", ".codex/config.toml"), false);
});

test("legacy and collision-resistant plan IDs are lifecycle paths", () => {
  assert.equal(
    isPlanLifecyclePath("docs/agents/plans/active/0055-fixture.md"),
    true,
  );
  assert.equal(
    isPlanLifecyclePath(
      "docs/agents/plans/active/20260727T100000Z-a1b2c3-fixture.md",
    ),
    true,
  );
});
