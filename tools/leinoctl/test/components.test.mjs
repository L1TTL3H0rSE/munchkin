import assert from "node:assert/strict";
import test from "node:test";
import {
  buildComponentGraph,
  componentChecks,
  impactedComponents,
} from "../src/components.mjs";

test("impact expands to direct consumers and deduplicates canonical checks", () => {
  const profile = {
    components: [
      {
        id: "contract",
        kind: "integration",
        roots: ["contracts/**"],
        consumes: [],
        contracts: ["fixture:contract"],
        checks: [{ id: "contract-check", cwd: ".", argv: ["tool", "check"] }],
      },
      {
        id: "consumer",
        kind: "integration",
        roots: ["apps/consumer"],
        consumes: ["contract"],
        contracts: [],
        checks: [{ id: "contract-check", cwd: ".", argv: ["tool", "check"] }],
      },
      {
        id: "indirect-consumer",
        kind: "integration",
        roots: ["apps/indirect"],
        consumes: ["consumer"],
        contracts: [],
        checks: [{ id: "indirect-check", cwd: ".", argv: ["tool", "indirect"] }],
      },
    ],
    verification: { nodeScripts: ["test"] },
  };
  const discovery = {
    goModules: [],
    pnpmWorkspaces: [],
    submodules: [],
    composeServices: [],
  };
  const graph = buildComponentGraph("/fixture", profile, discovery);
  const impacted = impactedComponents(graph, ["contracts/api.proto"]);
  assert.deepEqual(impacted.map((entry) => entry.id), ["consumer", "contract"]);
  assert.equal(componentChecks(impacted).length, 1);
  assert.deepEqual(componentChecks(impacted)[0], {
    id: "contract-check",
    cwd: ".",
    argv: ["tool", "check"],
  });
});

test("inferred Go and pnpm manifests contribute consumer edges", () => {
  const profile = {
    components: [{
      schemaVersion: 1,
      id: "workspace",
      kind: "pnpm-workspace",
      roots: ["web/pnpm-workspace.yaml"],
      consumes: [],
      contracts: [],
      checks: [],
    }],
    verification: { nodeScripts: ["test"] },
  };
  const discovery = {
    goModules: [
      {
        root: "lib",
        module: "example.test/lib",
        requires: [],
        hasApp: false,
      },
      {
        root: "service",
        module: "example.test/service",
        requires: ["example.test/lib"],
        hasApp: true,
      },
    ],
    pnpmWorkspaces: [{
      manifest: "web/pnpm-workspace.yaml",
      packages: [
        {
          root: "web/packages/ui",
          name: "@fixture/ui",
          scripts: ["test"],
          dependencies: [],
        },
        {
          root: "web/apps/portal",
          name: "@fixture/portal",
          scripts: ["test"],
          dependencies: ["@fixture/ui"],
        },
      ],
    }],
    submodules: [],
    composeServices: [],
  };
  const graph = buildComponentGraph("/fixture", profile, discovery);
  assert.deepEqual(
    impactedComponents(graph, ["lib/source.go"]).map((entry) => entry.id),
    ["go:lib", "go:service"],
  );
  assert.deepEqual(
    impactedComponents(graph, ["web/packages/ui/src/button.ts"]).map((entry) => entry.id),
    ["pnpm:@fixture/portal", "pnpm:@fixture/ui"],
  );
  assert.deepEqual(
    impactedComponents(graph, ["web/pnpm-workspace.yaml"]).map((entry) => entry.id),
    ["pnpm:@fixture/portal", "pnpm:@fixture/ui", "workspace"],
  );
  assert.deepEqual(
    graph.components.find((entry) => entry.id === "go:service").checks.map((entry) => entry.id),
    ["go-test"],
  );
});

test("component graph rejects typoed consumer references", () => {
  const profile = {
    components: [{
      id: "consumer",
      kind: "integration",
      roots: ["consumer"],
      consumes: ["missing-component"],
      contracts: [],
      checks: [],
    }],
    verification: { nodeScripts: [] },
  };
  assert.throws(
    () => buildComponentGraph("/fixture", profile, {
      goModules: [],
      pnpmWorkspaces: [],
      submodules: [],
      composeServices: [],
    }),
    /consumes unknown component/,
  );
});

test("Compose discovery connects service components to the coordinating component", () => {
  const profile = {
    components: [{
      id: "root-compose",
      kind: "integration",
      roots: ["docker-compose.yml"],
      consumes: [],
      contracts: [],
      checks: [{ id: "compose-config", cwd: ".", argv: ["docker", "compose", "config"] }],
    }],
    verification: { nodeScripts: [] },
  };
  const discovery = {
    goModules: [{
      root: "backend/users",
      module: "example.test/users",
      requires: [],
      hasApp: true,
    }],
    pnpmWorkspaces: [],
    submodules: [],
    composeServices: [{ file: "docker-compose.yml", service: "users" }],
  };
  const graph = buildComponentGraph("/fixture", profile, discovery);
  assert.equal(
    graph.components.find((entry) => entry.id === "go:backend/users").composeService,
    "users",
  );
  assert.deepEqual(
    graph.components.find((entry) => entry.id === "root-compose").consumes,
    ["go:backend/users"],
  );
  assert.deepEqual(
    impactedComponents(graph, ["backend/users/main.go"]).map((entry) => entry.id),
    ["go:backend/users", "root-compose"],
  );
});
