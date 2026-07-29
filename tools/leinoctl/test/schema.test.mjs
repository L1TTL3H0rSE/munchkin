import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { outputEnvelope } from "../src/output.mjs";
import { fixtureProfile } from "./helpers.mjs";

const schemaDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../schema",
);

function resolveReference(root, reference) {
  return reference.slice(2).split("/").reduce((value, key) => value[key], root);
}

function schemaIssues(schema, value, root = schema, label = "$") {
  if (schema === true) {
    return [];
  }
  if (schema.$ref) {
    return schemaIssues(resolveReference(root, schema.$ref), value, root, label);
  }
  const issues = [];
  if (Object.hasOwn(schema, "const") && value !== schema.const) {
    issues.push(`${label} must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    issues.push(`${label} must match enum`);
  }
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [`${label} must be an object`];
    }
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) {
        issues.push(`${label}.${key} is required`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(schema.properties ?? {}, key)) {
          issues.push(`${label}.${key} is not allowed`);
        }
      }
    } else if (
      schema.additionalProperties
      && typeof schema.additionalProperties === "object"
    ) {
      for (const [key, child] of Object.entries(value)) {
        if (!Object.hasOwn(schema.properties ?? {}, key)) {
          issues.push(...schemaIssues(
            schema.additionalProperties,
            child,
            root,
            `${label}.${key}`,
          ));
        }
      }
    }
    if (schema.propertyNames) {
      for (const key of Object.keys(value)) {
        issues.push(...schemaIssues(
          schema.propertyNames,
          key,
          root,
          `${label} key ${JSON.stringify(key)}`,
        ));
      }
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) {
        issues.push(...schemaIssues(child, value[key], root, `${label}.${key}`));
      }
    }
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      return [`${label} must be an array`];
    }
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      issues.push(`${label} has too few items`);
    }
    if (
      schema.uniqueItems
      && new Set(value.map((entry) => JSON.stringify(entry))).size !== value.length
    ) {
      issues.push(`${label} must contain unique items`);
    }
    value.forEach((entry, index) => {
      issues.push(...schemaIssues(schema.items, entry, root, `${label}[${index}]`));
    });
  }
  if (schema.type === "string") {
    if (typeof value !== "string") {
      issues.push(`${label} must be a string`);
    } else if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push(`${label} is too short`);
    } else if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      issues.push(`${label} does not match pattern`);
    }
  }
  if (schema.type === "integer") {
    if (!Number.isInteger(value)) {
      issues.push(`${label} must be an integer`);
    } else if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push(`${label} is below minimum`);
    }
  }
  if (schema.type === "boolean" && typeof value !== "boolean") {
    issues.push(`${label} must be a boolean`);
  }
  return issues;
}

function readSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(schemaDirectory, name), "utf8"));
}

test("published JSON schemas validate representative v1 fixtures", () => {
  const fixtures = [
    ["profile.schema.json", fixtureProfile()],
    ["component.schema.json", {
      schemaVersion: 1,
      id: "fixture",
      kind: "integration",
      roots: ["src"],
      consumes: [],
      contracts: [],
      checks: [{ id: "test", cwd: ".", argv: ["tool", "test"] }],
    }],
    ["plan-manifest.schema.json", {
      schemaVersion: 1,
      paths: ["src/**"],
      components: [],
      contracts: [],
      dependsOn: [],
      sharedResources: [],
    }],
    ["output.schema.json", outputEnvelope("fixture", { value: true })],
    ["verify-data.schema.json", {
      paths: ["src/index.js"],
      components: ["fixture"],
      checks: [{
        id: "test",
        cwd: ".",
        argv: ["node", "--test"],
        dryRun: true,
      }],
    }],
  ];
  for (const [name, fixture] of fixtures) {
    assert.deepEqual(schemaIssues(readSchema(name), fixture), [], name);
  }
});

test("published closed schemas reject unknown fields", () => {
  for (const name of [
    "profile.schema.json",
    "component.schema.json",
    "plan-manifest.schema.json",
    "output.schema.json",
    "verify-data.schema.json",
  ]) {
    const schema = readSchema(name);
    const issues = schemaIssues(schema, { unexpected: true });
    assert.ok(issues.length > 0, name);
  }
});

test("published schemas reject values that runtime validation rejects", () => {
  const duplicateManifest = {
    schemaVersion: 1,
    paths: ["src/**", "src/**"],
    components: [""],
    contracts: [],
    dependsOn: [],
    sharedResources: [],
  };
  assert.ok(
    schemaIssues(readSchema("plan-manifest.schema.json"), duplicateManifest).length >= 2,
  );

  const invalidComponent = {
    schemaVersion: 1,
    id: "fixture",
    kind: "integration",
    roots: ["../outside"],
    checks: [{ id: "test", cwd: "", argv: [""] }],
  };
  assert.ok(
    schemaIssues(readSchema("component.schema.json"), invalidComponent).length >= 3,
  );

  const invalidProfile = fixtureProfile({
    componentsDir: "/absolute/components",
  });
  assert.ok(
    schemaIssues(readSchema("profile.schema.json"), invalidProfile).length >= 1,
  );

  const invalidVersionProbeProfile = fixtureProfile({
    toolchain: {
      minimumVersions: { go: "1.25.1" },
      versionProbes: { go: [] },
    },
  });
  assert.ok(
    schemaIssues(
      readSchema("profile.schema.json"),
      invalidVersionProbeProfile,
    ).length >= 1,
  );

  const windowsTraversalManifest = {
    schemaVersion: 1,
    paths: ["src\\..\\outside"],
    components: [],
    contracts: [],
    dependsOn: [],
    sharedResources: [],
  };
  assert.ok(
    schemaIssues(
      readSchema("plan-manifest.schema.json"),
      windowsTraversalManifest,
    ).length >= 1,
  );

  invalidComponent.roots = ["..\\outside"];
  assert.ok(
    schemaIssues(readSchema("component.schema.json"), invalidComponent).length >= 1,
  );

  invalidProfile.componentsDir = "\\\\server\\share";
  assert.ok(
    schemaIssues(readSchema("profile.schema.json"), invalidProfile).length >= 1,
  );

  const invalidVerifyData = {
    paths: ["C:\\outside"],
    components: ["fixture"],
    checks: [],
  };
  assert.ok(
    schemaIssues(readSchema("verify-data.schema.json"), invalidVerifyData).length >= 1,
  );
});
