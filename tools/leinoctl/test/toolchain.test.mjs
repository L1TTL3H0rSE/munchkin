import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { inspectToolchain, resolveExecutable } from "../src/toolchain.mjs";
import { temporaryDirectory, writeFile } from "./helpers.mjs";

test("toolchain inspection reports missing executables and version constraints", () => {
  const root = temporaryDirectory();
  const profile = {
    toolchain: {
      requiredExecutables: ["definitely-missing-leino-tool", "node"],
      minimumVersions: {
        node: "1.0.0",
      },
      capabilities: [],
    },
    generators: [],
  };
  const graph = {
    components: [{
      checks: [{ id: "node-check", cwd: ".", argv: ["node", "--version"] }],
    }],
  };
  const result = inspectToolchain(root, profile, graph);
  assert.equal(result.ready, false);
  assert.ok(result.issues.some(
    (issue) => issue.code === "tool-missing"
      && issue.message.includes("definitely-missing-leino-tool"),
  ));
  const node = result.executables.find((entry) => entry.name === "node");
  assert.equal(node.available, true);
  assert.equal(node.satisfiesMinimum, true);
});

test("toolchain inspection uses profile version probes with a --version fallback", () => {
  const root = temporaryDirectory();
  const binDirectory = path.join(root, "bin");
  const goExecutable = writeFile(root, "bin/go", "#!/bin/sh\n");
  const legacyExecutable = writeFile(root, "bin/legacy-tool", "#!/bin/sh\n");
  const gitExecutable = writeFile(root, "bin/git", "#!/bin/sh\n");
  fs.chmodSync(goExecutable, 0o755);
  fs.chmodSync(legacyExecutable, 0o755);
  fs.chmodSync(gitExecutable, 0o755);
  const calls = [];
  const profile = {
    toolchain: {
      requiredExecutables: ["go", "legacy-tool"],
      minimumVersions: {
        go: "1.25.1",
        "legacy-tool": "2.0.0",
      },
      versionProbes: {
        go: ["version"],
      },
      capabilities: [],
    },
    generators: [],
  };
  const result = inspectToolchain(root, profile, { components: [] }, {
    env: { PATH: binDirectory },
    platform: "darwin",
    spawn(executable, argv) {
      calls.push([path.basename(executable), argv]);
      if (path.basename(executable) === "go") {
        return {
          status: 0,
          stdout: "go version go1.26.5 darwin/amd64\n",
          stderr: "",
        };
      }
      return {
        status: 0,
        stdout: "legacy-tool 2.1.0\n",
        stderr: "",
      };
    },
  });

  assert.equal(result.ready, true);
  assert.deepEqual(calls, [
    ["go", ["version"]],
    ["legacy-tool", ["--version"]],
  ]);
  const go = result.executables.find((entry) => entry.name === "go");
  assert.equal(go.version, "1.26.5");
  assert.equal(go.satisfiesMinimum, true);
});

test("declared executable resolver wins over PATH and reports the resolved path", () => {
  const root = temporaryDirectory();
  const declared = writeFile(root, "bin/declared-tool", "#!/bin/sh\n");
  const shimDirectory = path.join(root, "shim");
  const shim = writeFile(root, "shim/declared-tool", "#!/bin/sh\n");
  const git = writeFile(root, "shim/git", "#!/bin/sh\n");
  fs.chmodSync(declared, 0o755);
  fs.chmodSync(shim, 0o755);
  fs.chmodSync(git, 0o755);
  const profile = {
    toolchain: {
      requiredExecutables: ["declared-tool@env:LEINO_DECLARED_TOOL"],
      minimumVersions: { "declared-tool": "2.0.0" },
      capabilities: [],
    },
    generators: [],
  };
  const graph = {
    components: [{
      checks: [{ id: "declared-check", cwd: ".", argv: ["declared-tool", "check"] }],
    }],
  };
  const result = inspectToolchain(root, profile, graph, {
    env: {
      PATH: shimDirectory,
      LEINO_DECLARED_TOOL: declared,
    },
    platform: "darwin",
    spawn(executable) {
      assert.equal(executable, fs.realpathSync(declared));
      return { status: 0, stdout: "declared-tool 2.1.0\n", stderr: "" };
    },
  });
  assert.equal(result.ready, true);
  const tool = result.executables.find((entry) => entry.name === "declared-tool");
  assert.equal(tool.path, fs.realpathSync(declared));
  assert.equal(tool.resolver, "env:LEINO_DECLARED_TOOL");
  assert.equal(tool.version, "2.1.0");
  assert.equal(resolveExecutable("declared-tool", {
    repoRoot: root,
    profile,
    env: { PATH: shimDirectory, LEINO_DECLARED_TOOL: declared },
    platform: "darwin",
  }).path, fs.realpathSync(declared));
});

test("declared resolver mismatch fails closed without falling back to a PATH shim", () => {
  const root = temporaryDirectory();
  const shim = writeFile(root, "bin/mismatch-tool", "#!/bin/sh\n");
  fs.chmodSync(shim, 0o755);
  const profile = {
    toolchain: {
      requiredExecutables: ["mismatch-tool@env:LEINO_MISSING_TOOL"],
      minimumVersions: {},
      capabilities: [],
    },
    generators: [],
  };
  const result = inspectToolchain(root, profile, {
    components: [{ checks: [{ id: "mismatch", cwd: ".", argv: ["mismatch-tool"] }] }],
  }, {
    env: { PATH: path.join(root, "bin") },
    platform: "darwin",
  });
  assert.equal(result.ready, false);
  assert.equal(result.executables.find((entry) => entry.name === "mismatch-tool").path, null);
  assert.ok(result.issues.some((issue) => issue.code === "tool-resolver-failed"));
});
