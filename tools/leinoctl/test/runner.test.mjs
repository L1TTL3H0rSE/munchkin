import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runCommand, runCommands } from "../src/runner.mjs";
import { temporaryDirectory } from "./helpers.mjs";

test("runner passes argv literally without shell interpolation", async () => {
  const root = temporaryDirectory();
  const marker = "would-be-shell-expansion";
  const result = await runCommand({
    id: "literal-argv",
    cwd: ".",
    argv: [
      process.execPath,
      "-e",
      "process.stdout.write(process.argv[1])",
      `$(touch ${marker})`,
    ],
  }, {
    repoRoot: root,
    capture: true,
  });
  assert.equal(result.stdout, `$(touch ${marker})`);
  assert.equal(fs.existsSync(`${root}/${marker}`), false);
});

test("runner preserves command order and rejects cwd traversal", async () => {
  const root = temporaryDirectory();
  const started = [];
  const commands = [
    { id: "first", cwd: ".", argv: ["tool", "first"] },
    { id: "second", cwd: ".", argv: ["tool", "second"] },
  ];
  const results = await runCommands(commands, {
    repoRoot: root,
    dryRun: true,
    onStart: (command) => started.push(command.id),
  });
  assert.deepEqual(started, ["first", "second"]);
  assert.deepEqual(results.map((entry) => entry.command.id), ["first", "second"]);
  await assert.rejects(
    () => runCommand({
      id: "escape",
      cwd: "../outside",
      argv: ["tool"],
    }, {
      repoRoot: root,
      dryRun: true,
    }),
    /repository-relative/,
  );
});

test("runner rejects a repository-relative cwd symlink that resolves outside", async (t) => {
  const root = temporaryDirectory();
  const outside = temporaryDirectory();
  try {
    fs.symlinkSync(outside, `${root}/escape`, "dir");
  } catch (error) {
    if (error?.code === "EPERM") {
      t.skip("directory symlinks require unavailable platform permission");
      return;
    }
    throw error;
  }
  await assert.rejects(
    () => runCommand({
      id: "symlink-escape",
      cwd: "escape",
      argv: [process.execPath, "-e", "0"],
    }, {
      repoRoot: root,
      dryRun: true,
    }),
    /resolves outside repository/,
  );
});

test("runner reports each successful command before a later command fails", async () => {
  const root = temporaryDirectory();
  const completed = [];
  await assert.rejects(
    () => runCommands([
      {
        id: "success",
        cwd: ".",
        argv: [process.execPath, "-e", "process.exit(0)"],
      },
      {
        id: "failure",
        cwd: ".",
        argv: [process.execPath, "-e", "process.exit(7)"],
      },
    ], {
      repoRoot: root,
      capture: true,
      onComplete: (result) => completed.push(result.command.id),
    }),
    /failure failed with exit 7/,
  );
  assert.deepEqual(completed, ["success"]);
});
