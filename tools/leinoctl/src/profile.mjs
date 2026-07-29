import fs from "node:fs";
import path from "node:path";
import { LeinoError } from "./errors.mjs";
import { assertRepoRelative, readJson, resolveInside } from "./fs.mjs";

const PROFILE_SCHEMA_VERSION = 1;
const COMPONENT_KINDS = new Set([
  "go-module",
  "go-service",
  "go-library",
  "pnpm-package",
  "pnpm-workspace",
  "submodule",
  "integration",
  "repository",
]);
const PROFILE_KEYS = new Set([
  "schemaVersion",
  "repositoryId",
  "componentsDir",
  "generatorsFile",
  "runtimeDir",
  "plans",
  "composeFiles",
  "sync",
  "toolchain",
  "verification",
]);
const PLAN_KEYS = new Set(["activeDir", "archiveDir"]);
const SYNC_KEYS = new Set(["jobs"]);
const VERIFICATION_KEYS = new Set(["nodeScripts"]);
const TOOLCHAIN_KEYS = new Set([
  "requiredExecutables",
  "minimumVersions",
  "versionProbes",
  "capabilities",
]);
const COMPONENT_KEYS = new Set([
  "schemaVersion",
  "id",
  "kind",
  "roots",
  "consumes",
  "contracts",
  "composeService",
  "checks",
]);
const COMMAND_KEYS = new Set(["id", "cwd", "argv"]);
const GENERATOR_REGISTRY_KEYS = new Set(["schemaVersion", "generators"]);
const GENERATOR_KEYS = new Set(["id", "cwd", "argv", "checkArgs", "targets"]);

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LeinoError("profile-schema-invalid", `${label} must be an object`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new LeinoError("profile-schema-invalid", `${label} must be a non-empty string`);
  }
  return value.trim();
}

function rejectUnknownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new LeinoError(
        "profile-schema-invalid",
        `${label}.${key} is not allowed by schemaVersion ${PROFILE_SCHEMA_VERSION}`,
      );
    }
  }
}

function optionalArray(value, label) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new LeinoError("profile-schema-invalid", `${label} must be an array`);
  }
  return value;
}

function requireNonEmptyStringArray(value, label) {
  if (!Array.isArray(value) || !value.length) {
    throw new LeinoError(
      "profile-schema-invalid",
      `${label} must be a non-empty array`,
    );
  }
  return value.map((entry, index) => requireString(entry, `${label}[${index}]`));
}

function positiveInteger(value, label, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new LeinoError(
      "profile-schema-invalid",
      `${label} must be a positive integer`,
    );
  }
  return value;
}

function assertUniqueIds(entries, label) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new LeinoError(
        "profile-registry-duplicate-id",
        `${label} contains duplicate id: ${entry.id}`,
      );
    }
    seen.add(entry.id);
  }
}

export function validateCommand(command, label = "command") {
  requireObject(command, label);
  rejectUnknownKeys(command, COMMAND_KEYS, label);
  const id = requireString(command.id, `${label}.id`);
  const cwd = assertRepoRelative(
    requireString(command.cwd, `${label}.cwd`),
    `${label}.cwd`,
  );
  if (!Array.isArray(command.argv) || !command.argv.length) {
    throw new LeinoError("profile-schema-invalid", `${label}.argv must be a non-empty array`);
  }
  const argv = command.argv.map((entry, index) => requireString(entry, `${label}.argv[${index}]`));
  return {
    id,
    cwd,
    argv,
  };
}

function validateComponent(value, source) {
  const component = requireObject(value, source);
  rejectUnknownKeys(component, COMPONENT_KEYS, source);
  if (component.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    throw new LeinoError(
      "component-schema-version-unsupported",
      `${source}: expected schemaVersion ${PROFILE_SCHEMA_VERSION}`,
    );
  }
  const id = requireString(component.id, `${source}.id`);
  const kind = requireString(component.kind, `${source}.kind`);
  if (!COMPONENT_KINDS.has(kind)) {
    throw new LeinoError("profile-schema-invalid", `${source}.kind is unsupported: ${kind}`);
  }
  if (!Array.isArray(component.roots) || !component.roots.length) {
    throw new LeinoError("profile-schema-invalid", `${source}.roots must be a non-empty array`);
  }
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id,
    kind,
    roots: component.roots.map((entry) => assertRepoRelative(entry, `${source}.roots`)),
    consumes: optionalArray(component.consumes, `${source}.consumes`)
      .map((entry) => requireString(entry, `${source}.consumes`)),
    contracts: optionalArray(component.contracts, `${source}.contracts`)
      .map((entry) => requireString(entry, `${source}.contracts`)),
    composeService: component.composeService
      ? requireString(component.composeService, `${source}.composeService`)
      : undefined,
    checks: optionalArray(component.checks, `${source}.checks`).map((entry, index) => (
      validateCommand(entry, `${source}.checks[${index}]`)
    )),
  };
}

function validateGenerator(value, source) {
  const generator = requireObject(value, source);
  rejectUnknownKeys(generator, GENERATOR_KEYS, source);
  return {
    id: requireString(generator.id, `${source}.id`),
    cwd: assertRepoRelative(generator.cwd ?? ".", `${source}.cwd`),
    argv: validateCommand({
      id: generator.id,
      cwd: generator.cwd ?? ".",
      argv: generator.argv,
    }, source).argv,
    checkArgs: optionalArray(generator.checkArgs, `${source}.checkArgs`).map((entry, index) => (
      requireString(entry, `${source}.checkArgs[${index}]`)
    )),
    targets: optionalArray(generator.targets, `${source}.targets`).map((entry, index) => (
      requireString(entry, `${source}.targets[${index}]`)
    )),
  };
}

export function loadProfile(repoRoot, profileRelative = ".leino/profile.json") {
  const profilePath = resolveInside(repoRoot, profileRelative, "profile");
  if (!fs.existsSync(profilePath)) {
    throw new LeinoError("profile-missing", `repository profile not found: ${profileRelative}`);
  }
  const raw = requireObject(readJson(profilePath), profileRelative);
  rejectUnknownKeys(raw, PROFILE_KEYS, profileRelative);
  if (raw.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    throw new LeinoError(
      "profile-schema-version-unsupported",
      `${profileRelative}: expected schemaVersion ${PROFILE_SCHEMA_VERSION}`,
    );
  }

  const componentsDir = assertRepoRelative(raw.componentsDir ?? ".leino/components", "componentsDir");
  const generatorsFile = assertRepoRelative(raw.generatorsFile ?? ".leino/generators.json", "generatorsFile");
  const plans = requireObject(raw.plans, "plans");
  rejectUnknownKeys(plans, PLAN_KEYS, "plans");
  const sync = raw.sync === undefined ? {} : requireObject(raw.sync, "sync");
  const verification = raw.verification === undefined
    ? {}
    : requireObject(raw.verification, "verification");
  const toolchain = raw.toolchain === undefined
    ? {}
    : requireObject(raw.toolchain, "toolchain");
  rejectUnknownKeys(sync, SYNC_KEYS, "sync");
  rejectUnknownKeys(verification, VERIFICATION_KEYS, "verification");
  rejectUnknownKeys(toolchain, TOOLCHAIN_KEYS, "toolchain");
  const minimumVersions = toolchain.minimumVersions === undefined
    ? {}
    : requireObject(toolchain.minimumVersions, "toolchain.minimumVersions");
  const versionProbes = toolchain.versionProbes === undefined
    ? {}
    : requireObject(toolchain.versionProbes, "toolchain.versionProbes");
  const normalizedMinimumVersions = Object.fromEntries(
    Object.entries(minimumVersions).map(([executable, version]) => [
      requireString(executable, "toolchain.minimumVersions key"),
      requireString(version, `toolchain.minimumVersions.${executable}`),
    ]),
  );
  const normalizedVersionProbes = Object.fromEntries(
    Object.entries(versionProbes).map(([executable, argv]) => {
      const normalizedExecutable = requireString(
        executable,
        "toolchain.versionProbes key",
      );
      return [
        normalizedExecutable,
        requireNonEmptyStringArray(
          argv,
          `toolchain.versionProbes.${normalizedExecutable}`,
        ),
      ];
    }),
  );
  const profile = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    repositoryId: requireString(raw.repositoryId, "repositoryId"),
    componentsDir,
    generatorsFile,
    runtimeDir: assertRepoRelative(raw.runtimeDir ?? ".leino/runtime", "runtimeDir"),
    plans: {
      activeDir: assertRepoRelative(plans.activeDir, "plans.activeDir"),
      archiveDir: assertRepoRelative(plans.archiveDir, "plans.archiveDir"),
    },
    composeFiles: optionalArray(raw.composeFiles, "composeFiles")
      .map((entry) => assertRepoRelative(entry, "composeFiles")),
    sync: {
      jobs: positiveInteger(sync.jobs, "sync.jobs", 8),
    },
    toolchain: {
      requiredExecutables: optionalArray(
        toolchain.requiredExecutables,
        "toolchain.requiredExecutables",
      ).map((entry) => requireString(entry, "toolchain.requiredExecutables")),
      minimumVersions: normalizedMinimumVersions,
      versionProbes: normalizedVersionProbes,
      capabilities: optionalArray(
        toolchain.capabilities,
        "toolchain.capabilities",
      ).map((entry, index) => validateCommand(
        entry,
        `toolchain.capabilities[${index}]`,
      )),
    },
    verification: {
      nodeScripts: optionalArray(
        verification.nodeScripts ?? ["test", "typecheck", "build"],
        "verification.nodeScripts",
      )
        .map((entry) => requireString(entry, "verification.nodeScripts")),
    },
  };

  const componentsPath = resolveInside(repoRoot, componentsDir, "componentsDir");
  profile.components = fs.existsSync(componentsPath)
    ? fs.readdirSync(componentsPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => validateComponent(
        readJson(path.join(componentsPath, entry.name)),
        `${componentsDir}/${entry.name}`,
      ))
    : [];
  assertUniqueIds(profile.components, "component registry");

  const generatorsPath = resolveInside(repoRoot, generatorsFile, "generatorsFile");
  if (fs.existsSync(generatorsPath)) {
    const generators = requireObject(readJson(generatorsPath), generatorsFile);
    rejectUnknownKeys(generators, GENERATOR_REGISTRY_KEYS, generatorsFile);
    if (generators.schemaVersion !== PROFILE_SCHEMA_VERSION || !Array.isArray(generators.generators)) {
      throw new LeinoError("profile-schema-invalid", `${generatorsFile}: invalid generator registry`);
    }
    profile.generators = generators.generators.map((entry, index) => (
      validateGenerator(entry, `${generatorsFile}.generators[${index}]`)
    ));
    assertUniqueIds(profile.generators, "generator registry");
  } else {
    profile.generators = [];
  }

  return profile;
}
