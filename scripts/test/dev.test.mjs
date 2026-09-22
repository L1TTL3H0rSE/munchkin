import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../dev.sh", import.meta.url));
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";

test("dev script preserves Compose commands and rejects unsafe options", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "munchkin-dev-test-"));
  fs.writeFileSync(path.join(directory, "docker"), '#!/usr/bin/env bash\nprintf "%s\\n" "$@"\n', {mode: 0o755});
  const run = (args, parallel = "8") => spawnSync(bash, [script, ...args], {
    cwd: os.tmpdir(),
    encoding: "utf8",
    env: {...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`, MUNCHKIN_COMPOSE_PARALLEL: parallel},
  });
  try {
    for (const [args, expected] of [[[], ["up", "--build"]], [["down"], ["down"]], [["config", "--quiet"], ["config", "--quiet"]]]) {
      const result = run(args);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(result.stdout.trim().split(/\r?\n/), ["compose", "--parallel", "8", "-f", "docker-compose.yml", ...expected]);
    }
    for (const args of [["down", "-v"], ["down", "--volumes"], ["--parallel=2"]]) {
      assert.equal(run(args).status, 2);
    }
    assert.equal(run(["config"], "3").status, 2);
    assert.equal(run(["config"], "invalid").status, 2);
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});
