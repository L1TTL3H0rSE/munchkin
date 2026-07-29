import { discoverRepository, matchesGlob } from "./discovery.mjs";
import { LeinoError } from "./errors.mjs";

function stablePathId(value) {
  return value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function inferredComponents(discovery, profile) {
  const goIdsByModule = new Map(
    discovery.goModules
      .filter((module) => module.module)
      .map((module) => [module.module, `go:${module.root === "." ? "root" : module.root}`]),
  );
  const go = discovery.goModules.map((module) => ({
    id: `go:${module.root === "." ? "root" : module.root}`,
    kind: module.hasApp ? "go-service" : "go-module",
    roots: [module.root],
    consumes: (module.requires ?? [])
      .map((required) => goIdsByModule.get(required))
      .filter(Boolean),
    contracts: module.module ? [`go-module:${module.module}`] : [],
    checks: [{
      id: "go-test",
      cwd: module.root,
      argv: ["go", "test", "./..."],
    }],
    discovered: true,
  }));
  const packageIdsByName = new Map(
    discovery.pnpmWorkspaces.flatMap((workspace) => workspace.packages)
      .filter((pkg) => pkg.name)
      .map((pkg) => [pkg.name, `pnpm:${pkg.name}`]),
  );
  const workspaceComponentIds = new Map(
    discovery.pnpmWorkspaces.map((workspace) => [
      workspace.manifest,
      profile.components
        .filter((component) => (
          component.kind === "pnpm-workspace"
          && component.roots.some((root) => rootMatches(root, workspace.manifest))
        ))
        .map((component) => component.id),
    ]),
  );
  const packages = discovery.pnpmWorkspaces.flatMap((workspace) => (
    workspace.packages.map((pkg) => ({
      id: `pnpm:${pkg.name ?? stablePathId(pkg.root)}`,
      kind: "pnpm-package",
      roots: [pkg.root],
      consumes: [...new Set([
        ...(workspaceComponentIds.get(workspace.manifest) ?? []),
        ...(pkg.dependencies ?? [])
          .map((dependency) => packageIdsByName.get(dependency))
          .filter(Boolean),
      ])],
      contracts: pkg.name ? [`pnpm-package:${pkg.name}`] : [],
      checks: profile.verification.nodeScripts
        .filter((script) => pkg.scripts.includes(script))
        .map((script) => ({
          id: `pnpm-${script}`,
          cwd: pkg.root,
          argv: ["pnpm", "run", script],
        })),
      discovered: true,
    }))
  ));
  const submodules = discovery.submodules.map((submodule) => ({
    id: `submodule:${submodule.path}`,
    kind: "submodule",
    roots: [submodule.path],
    consumes: [],
    contracts: [`gitlink:${submodule.path}`],
    checks: [],
    discovered: true,
  }));
  return [...go, ...packages, ...submodules];
}

function rootMatches(root, changedPath) {
  if (root.includes("*") || root.includes("?")) {
    return matchesGlob(changedPath, root);
  }
  return root === "."
    || changedPath === root
    || changedPath.startsWith(`${root}/`);
}

function connectComposeServices(components, composeServices) {
  for (const compose of composeServices) {
    const coordinators = components.filter((component) => (
      component.roots.some((root) => root === compose.file)
    ));
    const owners = components.filter((component) => (
      component.roots.some((root) => (
        !/[*?{]/.test(root)
        && root !== "."
        && root !== compose.file
        && root.split("/").at(-1) === compose.service
      ))
    ));
    if (!owners.length) {
      continue;
    }
    for (const owner of owners) {
      if (owner.composeService && owner.composeService !== compose.service) {
        throw new LeinoError(
          "compose-service-owner-ambiguous",
          `${owner.id} maps to multiple Compose services: ${owner.composeService}, ${compose.service}`,
        );
      }
      owner.composeService = compose.service;
      for (const coordinator of coordinators) {
        coordinator.consumes = [...new Set([...coordinator.consumes, owner.id])];
      }
    }
  }
}

export function buildComponentGraph(repoRoot, profile, discovery = discoverRepository(repoRoot, profile)) {
  const byId = new Map();
  for (const component of inferredComponents(discovery, profile)) {
    byId.set(component.id, component);
  }
  for (const component of profile.components) {
    const previous = byId.get(component.id);
    byId.set(component.id, previous
      ? {
        ...previous,
        ...component,
        roots: [...new Set([...previous.roots, ...component.roots])],
        consumes: [...new Set([...previous.consumes, ...component.consumes])],
        contracts: [...new Set([...previous.contracts, ...component.contracts])],
        checks: component.checks.length ? component.checks : previous.checks,
        discovered: true,
        curated: true,
      }
      : { ...component, curated: true });
  }
  const components = [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
  connectComposeServices(components, discovery.composeServices);
  const knownIds = new Set(components.map((component) => component.id));
  for (const component of components) {
    const unknown = component.consumes.filter((consumerId) => !knownIds.has(consumerId));
    if (unknown.length) {
      throw new LeinoError(
        "component-consumer-unknown",
        `${component.id} consumes unknown component(s): ${unknown.join(", ")}`,
      );
    }
  }
  return {
    schemaVersion: 1,
    components,
    discovery,
  };
}

export function impactedComponents(graph, changedPaths, { includeConsumers = true } = {}) {
  const paths = changedPaths.map((entry) => entry.replaceAll("\\", "/").replace(/^\.\//, ""));
  const selected = new Set(
    graph.components
      .filter((component) => component.roots.some(
        (root) => paths.some((changedPath) => rootMatches(root, changedPath)),
      ))
      .map((component) => component.id),
  );
  if (includeConsumers) {
    const changedComponents = new Set(selected);
    for (const component of graph.components) {
      if (
        !selected.has(component.id)
        && component.consumes.some((dependency) => changedComponents.has(dependency))
      ) {
        selected.add(component.id);
      }
    }
  }
  return graph.components.filter((component) => selected.has(component.id));
}

export function componentChecks(components) {
  const seen = new Set();
  const checks = [];
  for (const component of components) {
    for (const command of component.checks ?? []) {
      const key = `${command.cwd}\0${command.argv.join("\0")}`;
      if (!seen.has(key)) {
        seen.add(key);
        checks.push({ ...command });
      }
    }
  }
  return checks;
}
