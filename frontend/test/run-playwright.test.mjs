import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {EventEmitter} from "node:events";

import {
  assertSupportedNode,
  frontendRoot,
  repositoryRoot,
  runPlaywright,
  runnerArguments,
} from "./run-playwright.mjs";

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.pid = 42_424;
    this.kills = [];
  }

  kill(signal) {
    this.kills.push(signal);
    return true;
  }
}

function fakeStderr() {
  let value = "";
  return {
    write(chunk) {
      value += String(chunk);
    },
    text() {
      return value;
    },
  };
}

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "munchkin-runner-test-"));
}

function baseOptions(signalSource, stderr, overrides = {}) {
  return {
    nodeVersion: "24.14.0",
    platform: "win32",
    signalSource,
    stderr,
    manageServers: false,
    tempRoot: tempRoot(),
    teardownTimeoutMs: 25,
    spawnSyncImpl: () => ({status: 0}),
    ...overrides,
  };
}

test("runner rejects an unsupported system Node before starting Playwright", () => {
  assert.throws(() => assertSupportedNode("22.14.0"), /requires Node >=24/);
});

test("runner uses the frontend root and serial default without creating repo artifacts", async () => {
  const signals = new EventEmitter();
  const stderr = fakeStderr();
  const child = new FakeChild();
  let spawnOptions;
  const result = await runPlaywright(["test", "--list"], baseOptions(signals, stderr, {
    spawnImpl: (executable, argumentsList, options) => {
      spawnOptions = {executable, argumentsList, options};
      queueMicrotask(() => child.emit("close", 0, null));
      return child;
    },
  }));

  assert.equal(result.exitCode, 0);
  assert.equal(result.retained, false);
  assert.equal(spawnOptions.options.cwd, frontendRoot);
  assert.equal(spawnOptions.options.shell, false);
  assert.equal(spawnOptions.argumentsList.at(-1), "--workers=1");
  assert.equal(spawnOptions.options.env.MUNCHKIN_PLAYWRIGHT_OUTPUT_DIR.includes(
    repositoryRoot,
  ), false);
  assert.equal(fs.existsSync(result.runDirectory), false);
  fs.rmSync(path.dirname(result.runDirectory), {recursive: true, force: true});
});

test("assertion failure is returned and evidence is retained outside the worktree", async () => {
  const signals = new EventEmitter();
  const stderr = fakeStderr();
  const child = new FakeChild();
  const result = await runPlaywright(["test", "failing.spec.ts"], baseOptions(signals, stderr, {
    spawnImpl: () => {
      queueMicrotask(() => child.emit("close", 7, null));
      return child;
    },
  }));

  assert.equal(result.exitCode, 7);
  assert.equal(result.retained, true);
  assert.equal(result.runDirectory.startsWith(repositoryRoot), false);
  assert.match(stderr.text(), /retained evidence:/);
  fs.rmSync(result.runDirectory, {recursive: true, force: true});
});

test("startup failure is non-zero and does not wait for an external timeout", async () => {
  const signals = new EventEmitter();
  const stderr = fakeStderr();
  const child = new FakeChild();
  const result = await runPlaywright(["test"], baseOptions(signals, stderr, {
    spawnImpl: () => {
      queueMicrotask(() => {
        child.emit("error", new Error("synthetic startup failure"));
        child.emit("close", null, null);
      });
      return child;
    },
  }));

  assert.equal(result.exitCode, 1);
  assert.equal(result.retained, true);
  assert.match(stderr.text(), /synthetic startup failure/);
  fs.rmSync(result.runDirectory, {recursive: true, force: true});
});

test("SIGTERM forces a hung teardown to finish within the bounded timeout", async () => {
  const signals = new EventEmitter();
  const stderr = fakeStderr();
  const child = new FakeChild();
  const startedAt = Date.now();
  const promise = runPlaywright(["test"], baseOptions(signals, stderr, {
    spawnImpl: () => child,
  }));
  setImmediate(() => signals.emit("SIGTERM"));
  const result = await promise;

  assert.ok(Date.now() - startedAt < 1_000);
  assert.equal(result.exitCode, 1);
  assert.equal(result.forced, true);
  assert.deepEqual(child.kills, ["SIGTERM", "SIGKILL"]);
  fs.rmSync(result.runDirectory, {recursive: true, force: true});
});

test("explicit worker and snapshot flags remain caller-controlled", () => {
  assert.deepEqual(
    runnerArguments(["test", "--workers=2", "--update-snapshots"]),
    ["test", "--workers=2", "--update-snapshots"],
  );
});
