import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  changedSinceBaseline,
  parseSubmoduleStatus,
  parsePorcelainZ,
  repositoryDeltaSinceBaseline,
  snapshotWorktree,
  syncCommandSequence,
  syncRepository,
} from "../src/git.mjs";
import { LeinoError } from "../src/errors.mjs";
import { temporaryDirectory, writeFile } from "./helpers.mjs";

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function initializeWorkRepository(directory) {
  fs.mkdirSync(directory, { recursive: true });
  git(directory, ["init", "--initial-branch=main"]);
  git(directory, ["config", "user.email", "fixture@example.test"]);
  git(directory, ["config", "user.name", "Fixture"]);
}

function createRemoteRepository(root, name, fileName = "README.md") {
  const remote = path.join(root, `${name}.git`);
  const work = path.join(root, `${name}-work`);
  fs.mkdirSync(remote, { recursive: true });
  git(remote, ["init", "--bare", "--initial-branch=main"]);
  initializeWorkRepository(work);
  writeFile(work, fileName, `${name} initial\n`);
  git(work, ["add", "."]);
  git(work, ["commit", "-m", `${name} initial`]);
  git(work, ["remote", "add", "origin", remote]);
  git(work, ["push", "-u", "origin", "main"]);
  return { remote, work, head: git(work, ["rev-parse", "HEAD"]) };
}

async function withFileProtocol(callback) {
  const previous = process.env.GIT_ALLOW_PROTOCOL;
  process.env.GIT_ALLOW_PROTOCOL = "file";
  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.GIT_ALLOW_PROTOCOL;
    } else {
      process.env.GIT_ALLOW_PROTOCOL = previous;
    }
  }
}

test("porcelain parser preserves spaces and rename source", () => {
  assert.deepEqual(
    parsePorcelainZ(" M file with spaces.txt\0R  new.txt\0old.txt\0"),
    [
      { status: " M", path: "file with spaces.txt" },
      { status: "R ", path: "new.txt" },
      { status: "R :source", path: "old.txt" },
    ],
  );
});

test("worktree snapshot supports an unborn repository", () => {
  const root = temporaryDirectory();
  initializeWorkRepository(root);
  writeFile(root, "README.md", "uncommitted bootstrap\n");

  const snapshot = snapshotWorktree(root);

  assert.equal(snapshot.head, null);
  assert.deepEqual(snapshot.entries.map((entry) => entry.path), ["README.md"]);
});

test("sync sequence only fast-forwards root and checks out pinned gitlinks", () => {
  const commands = syncCommandSequence(6);
  assert.deepEqual(commands.map((entry) => entry.argv), [
    ["git", "pull", "--ff-only", "--no-recurse-submodules"],
    ["git", "submodule", "sync", "--recursive"],
    ["git", "submodule", "update", "--init", "--recursive", "--jobs", "6"],
    ["git", "submodule", "status", "--recursive"],
  ]);
  const serialized = JSON.stringify(commands);
  for (const forbidden of ["stash", "reset", "--force", "checkout"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("sync dry-run preserves command ordering with an injected executor", async () => {
  const root = temporaryDirectory();
  const git = (args) => {
    if (args[0] === "rev-parse") {
      return "0123456789abcdef\n";
    }
    if (args[0] === "status") {
      return "";
    }
    throw new Error(`unexpected git call: ${args.join(" ")}`);
  };
  let captured = [];
  const result = await syncRepository(root, {
    jobs: 4,
    dryRun: true,
    git,
    run: async (commands) => {
      captured = commands;
      return commands.map((command) => ({
        command,
        exitCode: 0,
        stdout: "",
        stderr: "",
        dryRun: true,
      }));
    },
  });
  assert.deepEqual(captured, result.commands);
  assert.equal(result.preflight.clean, true);
});

test("scope delta detects clean root and submodule HEAD transitions", () => {
  const baseline = {
    root: { head: "root-a", entries: [] },
    submodules: {
      "vendor/ui": { head: "sub-a", entries: [] },
    },
  };
  const current = {
    root: { head: "root-b", entries: [] },
    submodules: {
      "vendor/ui": { head: "sub-b", entries: [] },
    },
  };
  assert.deepEqual(
    changedSinceBaseline(baseline, current),
    [".git/HEAD", "vendor/ui"],
  );
});

test("repository delta audits every fast-forward commit path and rejects rewinds", () => {
  const root = temporaryDirectory();
  initializeWorkRepository(root);
  writeFile(root, "src/kept.txt", "base\n");
  writeFile(root, "outside.txt", "base\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "base"]);
  const baseline = {
    root: snapshotWorktree(root),
    submodules: {},
  };

  writeFile(root, "src/kept.txt", "changed\n");
  writeFile(root, "outside.txt", "temporary unauthorized change\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "change both paths"]);
  writeFile(root, "outside.txt", "base\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "restore outside path"]);
  const current = {
    root: snapshotWorktree(root),
    submodules: {},
  };

  const forward = repositoryDeltaSinceBaseline(root, baseline, current);
  assert.equal(forward.rootHeadTransition.mode, "fast-forward");
  assert.deepEqual(forward.rootHeadTransition.paths, ["outside.txt", "src/kept.txt"]);
  assert.deepEqual(forward.changed, [".git/HEAD", "outside.txt", "src/kept.txt"]);

  const rewind = repositoryDeltaSinceBaseline(root, current, baseline);
  assert.equal(rewind.rootHeadTransition.mode, "non-forward");
  assert.deepEqual(rewind.rootHeadTransition.paths, []);
  assert.deepEqual(rewind.changed, [".git/HEAD"]);
});

test("submodule status distinguishes pinned, missing, drifted and conflicted states", () => {
  assert.deepEqual(
    parseSubmoduleStatus([
      " abcdef vendor/pinned (heads/main)",
      "-123456 vendor/missing",
      "+789abc vendor/drifted (heads/feature)",
      "Udeadbe vendor/conflicted",
    ].join("\n")).map((entry) => [entry.state, entry.path, entry.pinned]),
    [
      [" ", "vendor/pinned", true],
      ["-", "vendor/missing", false],
      ["+", "vendor/drifted", false],
      ["U", "vendor/conflicted", false],
    ],
  );
});

test("sync rejects a final submodule state that is not pinned", async () => {
  const root = temporaryDirectory();
  const git = (args) => {
    if (args[0] === "rev-parse") {
      return "0123456789abcdef\n";
    }
    if (args[0] === "status") {
      return "";
    }
    if (args[0] === "submodule") {
      return "+012345 vendor/ui (heads/feature)\n";
    }
    throw new Error(`unexpected git call: ${args.join(" ")}`);
  };
  await assert.rejects(
    () => syncRepository(root, {
      jobs: 4,
      git,
      run: async (commands) => commands.map((command) => ({
        command,
        exitCode: 0,
        stdout: "",
        stderr: "",
        dryRun: false,
      })),
    }),
    /not at initialized pinned gitlinks/,
  );
});

test("sync refuses dirty state before running any command", async () => {
  const root = temporaryDirectory();
  writeFile(root, "dirty.txt", "dirty\n");
  let ran = false;
  const git = (args) => {
    if (args[0] === "rev-parse") {
      return "0123456789abcdef\n";
    }
    if (args[0] === "status") {
      return " M dirty.txt\0";
    }
    throw new Error(`unexpected git call: ${args.join(" ")}`);
  };
  await assert.rejects(
    () => syncRepository(root, {
      git,
      run: async () => {
        ran = true;
        return [];
      },
    }),
    /superproject or a submodule is dirty/,
  );
  assert.equal(ran, false);
});

test("sync surfaces partial command failure without reset or rollback", async () => {
  const root = temporaryDirectory();
  const git = (args) => {
    if (args[0] === "rev-parse") {
      return "0123456789abcdef\n";
    }
    if (args[0] === "status") {
      return "";
    }
    throw new Error(`unexpected git call: ${args.join(" ")}`);
  };
  await assert.rejects(
    () => syncRepository(root, {
      git,
      run: async (commands) => {
        assert.equal(commands[0].id, "git-pull-superproject");
        throw new LeinoError(
          "command-failed",
          "submodule update failed after root fast-forward",
        );
      },
    }),
    /failed after root fast-forward/,
  );
});

test("sync rejects a dirty final state after pinned submodule verification", async () => {
  const root = temporaryDirectory();
  writeFile(root, "generated.txt", "changed after sync\n");
  let statusCalls = 0;
  const git = (args) => {
    if (args[0] === "rev-parse") {
      return "0123456789abcdef\n";
    }
    if (args[0] === "status") {
      statusCalls += 1;
      return statusCalls === 1 ? "" : " M generated.txt\0";
    }
    if (args[0] === "submodule") {
      return " abcdef vendor/ui\n";
    }
    throw new Error(`unexpected git call: ${args.join(" ")}`);
  };
  await assert.rejects(
    () => syncRepository(root, {
      git,
      run: async (commands) => commands.map((command) => ({
        command,
        exitCode: 0,
        stdout: "",
        stderr: "",
        dryRun: false,
      })),
    }),
    /final repository state is dirty/,
  );
});

test("sync integration fast-forwards root, follows a changed URL and initializes nested gitlinks", async () => {
  await withFileProtocol(async () => {
    const fixture = temporaryDirectory("leino-sync-integration-");
    const nested = createRemoteRepository(fixture, "nested", "nested.txt");
    const parent = createRemoteRepository(fixture, "parent", "parent.txt");
    const superproject = createRemoteRepository(fixture, "super", "root.txt");

    git(superproject.work, [
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      parent.remote,
      "vendor/parent",
    ]);
    git(superproject.work, ["commit", "-am", "add parent"]);
    git(superproject.work, ["push"]);

    const client = path.join(fixture, "client");
    git(fixture, [
      "-c",
      "protocol.file.allow=always",
      "clone",
      "--recurse-submodules",
      superproject.remote,
      client,
    ]);

    git(parent.work, [
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      nested.remote,
      "nested/child",
    ]);
    git(parent.work, ["commit", "-am", "add nested child"]);
    git(parent.work, ["push"]);
    const parentHead = git(parent.work, ["rev-parse", "HEAD"]);

    const mirror = path.join(fixture, "parent-mirror.git");
    git(fixture, ["clone", "--bare", parent.remote, mirror]);
    const checkedParent = path.join(superproject.work, "vendor/parent");
    git(checkedParent, ["fetch", "origin"]);
    git(checkedParent, ["checkout", parentHead]);
    git(superproject.work, [
      "config",
      "-f",
      ".gitmodules",
      "submodule.vendor/parent.url",
      mirror,
    ]);
    git(superproject.work, ["add", ".gitmodules", "vendor/parent"]);
    git(superproject.work, ["commit", "-m", "advance parent and change URL"]);
    git(superproject.work, ["push"]);

    const result = await syncRepository(client, { jobs: 4, capture: true });
    assert.equal(result.final.clean, true);
    assert.equal(
      git(path.join(client, "vendor/parent"), ["rev-parse", "HEAD"]),
      parentHead,
    );
    assert.equal(
      git(path.join(client, "vendor/parent/nested/child"), ["rev-parse", "HEAD"]),
      nested.head,
    );
    assert.equal(
      git(client, ["config", "--get", "submodule.vendor/parent.url"]),
      mirror,
    );
    assert.ok(result.final.submodules.every((entry) => entry.pinned));
  });
});

test("sync integration leaves a successful root fast-forward visible after submodule failure", async () => {
  await withFileProtocol(async () => {
    const fixture = temporaryDirectory("leino-sync-partial-");
    const child = createRemoteRepository(fixture, "child", "child.txt");
    const superproject = createRemoteRepository(fixture, "super", "root.txt");
    git(superproject.work, [
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      child.remote,
      "vendor/child",
    ]);
    git(superproject.work, ["commit", "-am", "add child"]);
    git(superproject.work, ["push"]);
    const client = path.join(fixture, "client");
    git(fixture, [
      "-c",
      "protocol.file.allow=always",
      "clone",
      "--recurse-submodules",
      superproject.remote,
      client,
    ]);
    const oldChildHead = git(path.join(client, "vendor/child"), ["rev-parse", "HEAD"]);

    writeFile(child.work, "child.txt", "child advanced\n");
    git(child.work, ["add", "child.txt"]);
    git(child.work, ["commit", "-m", "advance child"]);
    git(child.work, ["push"]);
    const newChildHead = git(child.work, ["rev-parse", "HEAD"]);
    const checkedChild = path.join(superproject.work, "vendor/child");
    git(checkedChild, ["fetch", "origin"]);
    git(checkedChild, ["checkout", newChildHead]);
    const missingRemote = path.join(fixture, "missing-child.git");
    git(superproject.work, [
      "config",
      "-f",
      ".gitmodules",
      "submodule.vendor/child.url",
      missingRemote,
    ]);
    git(superproject.work, ["add", ".gitmodules", "vendor/child"]);
    git(superproject.work, ["commit", "-m", "advance child to unavailable remote"]);
    git(superproject.work, ["push"]);
    const advancedRootHead = git(superproject.work, ["rev-parse", "HEAD"]);

    await assert.rejects(
      () => syncRepository(client, { jobs: 4, capture: true }),
      /git-submodule-update failed/,
    );
    assert.equal(git(client, ["rev-parse", "HEAD"]), advancedRootHead);
    assert.equal(
      git(path.join(client, "vendor/child"), ["rev-parse", "HEAD"]),
      oldChildHead,
    );
  });
});
