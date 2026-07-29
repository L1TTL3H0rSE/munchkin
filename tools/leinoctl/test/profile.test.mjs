import assert from "node:assert/strict";
import test from "node:test";
import { loadProfile, validateCommand } from "../src/profile.mjs";
import { fixtureProfile, temporaryDirectory, writeJson } from "./helpers.mjs";

test("profile keeps repository metadata outside the generic package", () => {
  const root = temporaryDirectory();
  writeJson(root, ".leino/profile.json", fixtureProfile({
    repositoryId: "second-project",
    componentsDir: "control/components",
    generatorsFile: "control/generators.json",
  }));
  writeJson(root, "control/components/module.json", {
    schemaVersion: 1,
    id: "custom-module",
    kind: "integration",
    roots: ["modules/custom"],
    checks: [{
      id: "custom-check",
      cwd: "modules/custom",
      argv: ["custom-tool", "check"],
    }],
  });
  writeJson(root, "control/generators.json", {
    schemaVersion: 1,
    generators: [],
  });

  const profile = loadProfile(root);
  assert.equal(profile.repositoryId, "second-project");
  assert.equal(profile.components[0].id, "custom-module");
  assert.deepEqual(profile.components[0].checks[0].argv, ["custom-tool", "check"]);
});

test("profile rejects incompatible versions, traversal and empty argv", () => {
  const root = temporaryDirectory();
  writeJson(root, ".leino/profile.json", {
    ...fixtureProfile(),
    schemaVersion: 2,
  });
  assert.throws(() => loadProfile(root), /expected schemaVersion 1/);
  assert.throws(
    () => validateCommand({ id: "bad", cwd: "../outside", argv: ["tool"] }),
    /repository-relative/,
  );
  assert.throws(
    () => validateCommand({ id: "bad", cwd: ".", argv: [] }),
    /non-empty array/,
  );
  assert.throws(
    () => validateCommand({ cwd: ".", argv: ["tool"] }),
    /command.id must be a non-empty string/,
  );
});

test("profile registries reject unknown fields and duplicate ids", () => {
  const extraRoot = temporaryDirectory();
  writeJson(extraRoot, ".leino/profile.json", fixtureProfile({ typo: true }));
  assert.throws(() => loadProfile(extraRoot), /typo is not allowed/);

  const componentsRoot = temporaryDirectory();
  writeJson(componentsRoot, ".leino/profile.json", fixtureProfile());
  writeJson(componentsRoot, ".leino/components/one.json", {
    schemaVersion: 1,
    id: "duplicate",
    kind: "integration",
    roots: ["one"],
  });
  writeJson(componentsRoot, ".leino/components/two.json", {
    schemaVersion: 1,
    id: "duplicate",
    kind: "integration",
    roots: ["two"],
  });
  assert.throws(() => loadProfile(componentsRoot), /duplicate id: duplicate/);

  const generatorsRoot = temporaryDirectory();
  writeJson(generatorsRoot, ".leino/profile.json", fixtureProfile());
  writeJson(generatorsRoot, ".leino/generators.json", {
    schemaVersion: 1,
    generators: [
      { id: "duplicate", cwd: ".", argv: ["tool"], targets: [] },
      { id: "duplicate", cwd: ".", argv: ["other-tool"], targets: [] },
    ],
  });
  assert.throws(() => loadProfile(generatorsRoot), /duplicate id: duplicate/);
});

test("profile validates toolchain requirements and capability argv", () => {
  const root = temporaryDirectory();
  writeJson(root, ".leino/profile.json", fixtureProfile({
    toolchain: {
      requiredExecutables: ["tool"],
      minimumVersions: { tool: "1.2.3" },
      versionProbes: { tool: ["version", "--short"] },
      capabilities: [{
        id: "tool-feature",
        cwd: ".",
        argv: ["tool", "feature", "--version"],
      }],
    },
  }));
  const profile = loadProfile(root);
  assert.equal(profile.toolchain.minimumVersions.tool, "1.2.3");
  assert.deepEqual(profile.toolchain.versionProbes.tool, ["version", "--short"]);
  assert.deepEqual(profile.toolchain.capabilities[0].argv, [
    "tool",
    "feature",
    "--version",
  ]);

  writeJson(root, ".leino/profile.json", fixtureProfile({
    toolchain: { unexpected: true },
  }));
  assert.throws(() => loadProfile(root), /toolchain.unexpected is not allowed/);

  writeJson(root, ".leino/profile.json", fixtureProfile({
    toolchain: {
      minimumVersions: { tool: "1.2.3" },
      versionProbes: { tool: [] },
    },
  }));
  assert.throws(
    () => loadProfile(root),
    /toolchain\.versionProbes\.tool must be a non-empty array/,
  );

  writeJson(root, ".leino/profile.json", fixtureProfile({
    toolchain: {
      minimumVersions: {},
      versionProbes: { tool: ["version"] },
    },
  }));
  assert.deepEqual(loadProfile(root).toolchain.versionProbes.tool, ["version"]);
});
