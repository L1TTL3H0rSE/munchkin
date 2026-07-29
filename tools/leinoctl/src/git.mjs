import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { discoverSubmodules } from "./discovery.mjs";
import { EXIT_CODES, LeinoError } from "./errors.mjs";
import { toPosix } from "./fs.mjs";
import { runCommands } from "./runner.mjs";

function defaultGit(args, { cwd }) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = typeof error.stderr === "string" ? error.stderr.trim() : "";
    throw new LeinoError(
      "git-command-failed",
      `git ${args.join(" ")} failed${stderr ? `: ${stderr}` : ""}`,
      { exitCode: EXIT_CODES.checkFailed, cause: error },
    );
  }
}

export function parsePorcelainZ(raw) {
  const fields = String(raw).split("\0");
  const entries = [];
  for (let index = 0; index < fields.length; index += 1) {
    const record = fields[index];
    if (!record) {
      continue;
    }
    const status = record.slice(0, 2);
    const filePath = toPosix(record.slice(3));
    entries.push({ status, path: filePath });
    if (/[RC]/.test(status) && fields[index + 1]) {
      entries.push({ status: `${status}:source`, path: toPosix(fields[index + 1]) });
      index += 1;
    }
  }
  return entries;
}

function resolveHead(worktreeRoot, git = defaultGit) {
  try {
    const head = git(["rev-parse", "--verify", "HEAD"], { cwd: worktreeRoot }).trim();
    return head || null;
  } catch (error) {
    const inside = git(
      ["rev-parse", "--is-inside-work-tree"],
      { cwd: worktreeRoot },
    ).trim();
    if (inside === "true") {
      return null;
    }
    throw error;
  }
}

function fingerprintPath(worktreeRoot, relativePath, git = defaultGit) {
  const absolute = path.join(worktreeRoot, ...relativePath.split("/"));
  if (!fs.existsSync(absolute)) {
    return "missing";
  }
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) {
    return `symlink:${fs.readlinkSync(absolute)}`;
  }
  if (stat.isFile()) {
    return `file:${crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")}`;
  }
  if (stat.isDirectory() && fs.existsSync(path.join(absolute, ".git"))) {
    const head = resolveHead(absolute, git) ?? "unborn";
    const status = git(
      ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"],
      { cwd: absolute },
    );
    return `git:${head}:${crypto.createHash("sha256").update(status).digest("hex")}`;
  }
  return `directory:${stat.mtimeMs}:${stat.size}`;
}

export function snapshotWorktree(worktreeRoot, { git = defaultGit } = {}) {
  const head = resolveHead(worktreeRoot, git);
  const raw = git(
    ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"],
    { cwd: worktreeRoot },
  );
  const entries = parsePorcelainZ(raw).map((entry) => ({
    ...entry,
    fingerprint: fingerprintPath(worktreeRoot, entry.path, git),
  }));
  return { head, entries };
}

export function snapshotRepository(repoRoot, { git = defaultGit } = {}) {
  const root = snapshotWorktree(repoRoot, { git });
  const submodules = {};
  for (const submodule of discoverSubmodules(repoRoot)) {
    const absolute = path.join(repoRoot, ...submodule.path.split("/"));
    if (fs.existsSync(path.join(absolute, ".git"))) {
      submodules[submodule.path] = snapshotWorktree(absolute, { git });
    }
  }
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    root,
    submodules,
  };
}

function flattenSnapshot(snapshot) {
  const result = new Map();
  for (const entry of snapshot.root?.entries ?? []) {
    result.set(entry.path, `${entry.status}\0${entry.fingerprint}`);
  }
  for (const [submodulePath, worktree] of Object.entries(snapshot.submodules ?? {})) {
    for (const entry of worktree.entries ?? []) {
      result.set(`${submodulePath}/${entry.path}`, `${entry.status}\0${entry.fingerprint}`);
    }
  }
  return result;
}

export function fingerprintSnapshotPaths(snapshot, paths) {
  const flattened = flattenSnapshot(snapshot);
  const records = [...new Set(paths)].sort().map((repoPath) => {
    if (repoPath === ".git/HEAD") {
      return [repoPath, snapshot.root?.head ?? null];
    }
    if (Object.hasOwn(snapshot.submodules ?? {}, repoPath)) {
      return [repoPath, snapshot.submodules[repoPath]?.head ?? null];
    }
    return [repoPath, flattened.get(repoPath) ?? null];
  });
  return crypto.createHash("sha256").update(JSON.stringify(records)).digest("hex");
}

export function changedSinceBaseline(baseline, current) {
  const before = flattenSnapshot(baseline);
  const after = flattenSnapshot(current);
  const paths = new Set([...before.keys(), ...after.keys()]);
  const changed = new Set(
    [...paths].filter((entry) => before.get(entry) !== after.get(entry)),
  );
  if (baseline.root?.head !== current.root?.head) {
    changed.add(".git/HEAD");
  }
  const submodulePaths = new Set([
    ...Object.keys(baseline.submodules ?? {}),
    ...Object.keys(current.submodules ?? {}),
  ]);
  for (const submodulePath of submodulePaths) {
    if (
      baseline.submodules?.[submodulePath]?.head
      !== current.submodules?.[submodulePath]?.head
    ) {
      changed.add(submodulePath);
    }
  }
  return [...changed].sort();
}

export function changedPaths(repoRoot, { base, git = defaultGit } = {}) {
  const paths = new Set();
  if (base) {
    const raw = git(["diff", "--name-only", "-z", `${base}...HEAD`], { cwd: repoRoot });
    for (const entry of raw.split("\0").filter(Boolean)) {
      paths.add(toPosix(entry));
    }
  }
  for (const entry of snapshotWorktree(repoRoot, { git }).entries) {
    paths.add(entry.path);
  }
  return [...paths].sort();
}

export function gitPreflight(repoRoot, { git = defaultGit } = {}) {
  const snapshot = snapshotRepository(repoRoot, { git });
  const dirty = [
    ...snapshot.root.entries.map((entry) => entry.path),
    ...Object.entries(snapshot.submodules).flatMap(([submodulePath, worktree]) => (
      worktree.entries.map((entry) => `${submodulePath}/${entry.path}`)
    )),
  ];
  return {
    clean: dirty.length === 0,
    dirty: [...new Set(dirty)].sort(),
    snapshot,
  };
}

export function syncCommandSequence(jobs = 8) {
  if (!Number.isInteger(jobs) || jobs < 1) {
    throw new LeinoError("sync-jobs-invalid", `sync jobs must be a positive integer: ${jobs}`);
  }
  return [
    {
      id: "git-pull-superproject",
      cwd: ".",
      argv: ["git", "pull", "--ff-only", "--no-recurse-submodules"],
    },
    {
      id: "git-submodule-sync",
      cwd: ".",
      argv: ["git", "submodule", "sync", "--recursive"],
    },
    {
      id: "git-submodule-update",
      cwd: ".",
      argv: [
        "git",
        "submodule",
        "update",
        "--init",
        "--recursive",
        "--jobs",
        String(jobs),
      ],
    },
    {
      id: "git-submodule-status",
      cwd: ".",
      argv: ["git", "submodule", "status", "--recursive"],
    },
  ];
}

export function parseSubmoduleStatus(raw) {
  return String(raw).split(/\r?\n/).filter(Boolean).map((line) => {
    const state = line[0];
    const match = line.slice(1).trim().match(/^([0-9a-f]+)\s+(\S+)(?:\s+\((.*)\))?$/i);
    return {
      state,
      commit: match?.[1] ?? null,
      path: match?.[2] ?? null,
      description: match?.[3] ?? null,
      pinned: state === " " && Boolean(match),
    };
  });
}

export function submoduleStatus(repoRoot, { git = defaultGit } = {}) {
  return parseSubmoduleStatus(
    git(["submodule", "status", "--recursive"], { cwd: repoRoot }),
  );
}

export async function syncRepository(repoRoot, {
  jobs = 8,
  dryRun = false,
  capture = false,
  git = defaultGit,
  run = runCommands,
  onStart,
} = {}) {
  const preflight = gitPreflight(repoRoot, { git });
  if (!preflight.clean) {
    throw new LeinoError(
      "sync-dirty-worktree",
      "sync refused because the superproject or a submodule is dirty",
      { exitCode: EXIT_CODES.dirty, details: preflight.dirty },
    );
  }
  const commands = syncCommandSequence(jobs);
  const results = await run(commands, { repoRoot, dryRun, capture, onStart });
  if (dryRun) {
    return { preflight, commands, results, final: null };
  }

  const finalStatus = submoduleStatus(repoRoot, { git });
  const unpinned = finalStatus.filter((entry) => !entry.pinned);
  if (unpinned.length) {
    throw new LeinoError(
      "sync-submodule-gitlink-mismatch",
      "one or more submodules are not at initialized pinned gitlinks",
      {
        exitCode: EXIT_CODES.checkFailed,
        details: unpinned.map((entry) => `${entry.state || "?"} ${entry.path ?? "<unparsed>"}`),
      },
    );
  }
  const finalPreflight = gitPreflight(repoRoot, { git });
  if (!finalPreflight.clean) {
    throw new LeinoError(
      "sync-final-state-dirty",
      "sync completed commands but final repository state is dirty",
      { exitCode: EXIT_CODES.dirty, details: finalPreflight.dirty },
    );
  }
  return {
    preflight,
    commands,
    results,
    final: {
      clean: true,
      submodules: finalStatus,
    },
  };
}

export { defaultGit };
