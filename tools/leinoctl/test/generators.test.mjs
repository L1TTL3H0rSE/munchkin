import assert from "node:assert/strict";
import test from "node:test";
import { buildGeneratorCommands } from "../src/generators.mjs";

const generators = [
  {
    id: "proto",
    cwd: "contracts",
    argv: ["tool", "proto"],
    checkArgs: ["--check"],
    targets: ["users", "groups"],
  },
  {
    id: "database",
    cwd: "database",
    argv: ["tool", "database"],
    checkArgs: ["--verify"],
    targets: ["accounts"],
  },
];

test("generator targets are dispatched only to their unique owners", () => {
  assert.deepEqual(
    buildGeneratorCommands(generators, ["accounts", "users"], { check: true }),
    [
      {
        id: "proto:users",
        cwd: "contracts",
        argv: ["tool", "proto", "--check", "users"],
      },
      {
        id: "database:accounts",
        cwd: "database",
        argv: ["tool", "database", "--verify", "accounts"],
      },
    ],
  );
});

test("generator dispatch fails closed for unknown and ambiguous targets", () => {
  assert.throws(
    () => buildGeneratorCommands(generators, ["missing"]),
    /no generator owns target missing/,
  );
  assert.throws(
    () => buildGeneratorCommands([
      ...generators,
      {
        id: "duplicate",
        cwd: ".",
        argv: ["tool"],
        checkArgs: [],
        targets: ["users"],
      },
    ], ["users"]),
    /owned by multiple generators/,
  );
});
