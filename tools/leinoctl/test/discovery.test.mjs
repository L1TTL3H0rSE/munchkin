import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverRepository,
  parseComposeServices,
  parseGitmodules,
  parsePnpmWorkspace,
} from "../src/discovery.mjs";
import { fixtureProfile, temporaryDirectory, writeFile, writeJson } from "./helpers.mjs";

test("repository discovery infers Go, pnpm, submodule and Compose data", () => {
  const root = temporaryDirectory();
  writeFile(
    root,
    "services/api/go.mod",
    "module example.test/api\n\ngo 1.24\n\nrequire example.test/shared v0.0.0\n",
  );
  writeFile(root, "libraries/shared/go.mod", "module example.test/shared\n\ngo 1.24\n");
  writeFile(root, "web/pnpm-workspace.yaml", "packages:\n  - 'apps/*'\n  - '!apps/ignored'\n");
  writeJson(root, "web/apps/portal/package.json", {
    name: "@fixture/portal",
    private: true,
    dependencies: { "@fixture/ui": "workspace:*" },
    scripts: { test: "node --test", build: "vite build" },
  });
  writeJson(root, "web/apps/ui/package.json", {
    name: "@fixture/ui",
    private: false,
    scripts: { test: "node --test" },
  });
  writeJson(root, "web/apps/ignored/package.json", { name: "@fixture/ignored" });
  writeJson(root, "web/test/fixtures/basic/package.json", { name: "@fixture/not-workspace" });
  writeFile(
    root,
    ".gitmodules",
    "[submodule \"ui\"]\n\tpath = vendor/ui\n\turl = git@example.test/ui.git\n",
  );
  writeFile(
    root,
    "compose.yaml",
    "services:\n  api:\n    image: fixture\n  portal:\n    image: fixture\nvolumes:\n  data:\n",
  );
  const profile = fixtureProfile({ composeFiles: ["compose.yaml"] });
  const discovery = discoverRepository(root, profile);

  assert.deepEqual(discovery.goModules, [
    {
      root: "libraries/shared",
      manifest: "libraries/shared/go.mod",
      module: "example.test/shared",
      requires: [],
      hasApp: false,
    },
    {
      root: "services/api",
      manifest: "services/api/go.mod",
      module: "example.test/api",
      requires: ["example.test/shared"],
      hasApp: false,
    },
  ]);
  assert.deepEqual(
    discovery.pnpmWorkspaces[0].packages.map((entry) => entry.name),
    ["@fixture/portal", "@fixture/ui"],
  );
  assert.deepEqual(
    discovery.pnpmWorkspaces[0].packages.find(
      (entry) => entry.name === "@fixture/portal",
    ).dependencies,
    ["@fixture/ui"],
  );
  assert.deepEqual(discovery.submodules, [{
    name: "ui",
    path: "vendor/ui",
    url: "git@example.test/ui.git",
  }]);
  assert.deepEqual(
    discovery.composeServices.map((entry) => entry.service),
    ["api", "portal"],
  );
});

test("parsers support a synthetic layout without Digiversity paths or Compose", () => {
  assert.deepEqual(parsePnpmWorkspace("packages:\n  - modules/**\n"), {
    include: ["modules/**"],
    exclude: [],
  });
  assert.deepEqual(parseGitmodules(""), []);
  assert.deepEqual(parseComposeServices("name: fixture\n"), []);
});

test("submodule discovery includes initialized nested registries", () => {
  const root = temporaryDirectory();
  writeFile(
    root,
    ".gitmodules",
    "[submodule \"parent\"]\n\tpath = vendor/parent\n\turl = parent.git\n",
  );
  writeFile(
    root,
    "vendor/parent/.gitmodules",
    "[submodule \"child\"]\n\tpath = deps/child\n\turl = child.git\n",
  );
  const discovery = discoverRepository(root, fixtureProfile());
  assert.deepEqual(
    discovery.submodules.map((entry) => entry.path),
    ["vendor/parent", "vendor/parent/deps/child"],
  );
});
