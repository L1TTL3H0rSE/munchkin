import fs from "node:fs";
import path from "node:path";
import {
  claimMatchesPath,
  normalizeClaim,
} from "../../../tools/leinoctl/src/claims.mjs";

export { claimMatchesPath, normalizeClaim };

const PATCH_FILE_HEADER = /^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$/;
const PATCH_ADD_HEADER = /^\*\*\* Add File:\s*(.+?)\s*$/;
const PATCH_MOVE_HEADER = /^\*\*\* Move to:\s*(.+?)\s*$/;
const DIFF_FILE_HEADER = /^\+\+\+\s+(?:b\/)?(.+?)\s*$/;

export function toPosix(value) {
  return String(value).replaceAll("\\", "/");
}

function pathApiFor(value) {
  const raw = String(value ?? "");
  return /^[A-Za-z]:[\\/]/.test(raw) || /^\\\\/.test(raw)
    ? path.win32
    : path.posix;
}

export function findRepoRoot(cwd = process.cwd()) {
  let current = path.resolve(cwd);
  let gitFallback = null;

  while (true) {
    if (
      fs.existsSync(path.join(current, ".codex", "hooks.json"))
      && fs.existsSync(path.join(current, "docs", "agents", "plans"))
    ) {
      return current;
    }
    if (!gitFallback && fs.existsSync(path.join(current, ".git"))) {
      gitFallback = current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  if (gitFallback) {
    return gitFallback;
  }
  throw new Error(`repository root not found from ${cwd}`);
}

export function normalizeRepoRelative(repoRoot, candidate, cwd = repoRoot) {
  const raw = String(candidate ?? "").trim().replace(/^["'`]|["'`]$/g, "");
  if (!raw) {
    throw new Error("empty repository path");
  }

  const pathApi = pathApiFor(repoRoot);
  const root = pathApi.resolve(String(repoRoot));
  const cwdRaw = String(cwd ?? repoRoot);
  const explicitWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(raw) || /^\\\\/.test(raw);
  const explicitPosixAbsolute = raw.startsWith("/");
  const foreignAbsolute = pathApi === path.posix
    ? explicitWindowsAbsolute
    : explicitPosixAbsolute && !explicitWindowsAbsolute;
  if (foreignAbsolute) {
    throw new Error(`path uses a different absolute-path style: ${candidate}`);
  }

  const base = pathApi.isAbsolute(cwdRaw)
    ? pathApi.resolve(cwdRaw)
    : pathApi.resolve(root, cwdRaw);
  const baseRelative = pathApi.relative(root, base);
  const baseEscaped = baseRelative === ".."
    || baseRelative.startsWith(`..${pathApi.sep}`)
    || pathApi.isAbsolute(baseRelative);
  if (baseEscaped) {
    throw new Error(`tool cwd escapes repository root: ${cwd}`);
  }

  const resolved = pathApi.isAbsolute(raw)
    ? pathApi.resolve(raw)
    : pathApi.resolve(base, raw);
  const relative = pathApi.relative(root, resolved);
  const escaped = relative === ".."
    || relative.startsWith(`..${pathApi.sep}`)
    || pathApi.isAbsolute(relative);

  if (escaped) {
    throw new Error(`path escapes repository root: ${candidate}`);
  }

  return toPosix(relative || ".");
}

export function extractPatchTargets(patchText, repoRoot, cwd = repoRoot) {
  const targets = new Set();

  for (const line of String(patchText ?? "").split(/\r?\n/)) {
    const match = line.match(PATCH_FILE_HEADER)
      ?? line.match(PATCH_MOVE_HEADER)
      ?? line.match(DIFF_FILE_HEADER);
    if (!match || match[1] === "/dev/null") {
      continue;
    }

    targets.add(normalizeRepoRelative(repoRoot, match[1], cwd));
  }

  return [...targets];
}

export function extractAddedPatchTargets(patchText, repoRoot, cwd = repoRoot) {
  const targets = new Set();
  for (const line of String(patchText ?? "").split(/\r?\n/)) {
    const match = line.match(PATCH_ADD_HEADER);
    if (match) {
      targets.add(normalizeRepoRelative(repoRoot, match[1], cwd));
    }
  }
  return [...targets];
}

export function extractPatchAddedText(patchText) {
  const added = [];
  let insideFile = false;

  for (const line of String(patchText ?? "").split(/\r?\n/)) {
    if (PATCH_FILE_HEADER.test(line) || PATCH_MOVE_HEADER.test(line)) {
      insideFile = true;
      continue;
    }
    if (line.startsWith("*** ")) {
      insideFile = false;
      continue;
    }
    if (insideFile && line.startsWith("+") && !line.startsWith("+++")) {
      added.push(line.slice(1));
    }
  }

  return added.join("\n");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function planIdFromLifecyclePath(repoPath, {
  activeDir = "docs/agents/plans/active",
  archiveDir = "docs/agents/plans/archive",
} = {}) {
  const directories = [activeDir, archiveDir]
    .map((entry) => escapeRegex(toPosix(entry).replace(/\/$/, "")))
    .join("|");
  const match = toPosix(repoPath).match(new RegExp(
    `^(?:${directories})/((?:\\d{4}|\\d{8}T\\d{6}Z-[a-f0-9]{6})-[a-z0-9]+(?:-[a-z0-9]+)*)\\.md$`,
  ));
  return match?.[1] ?? null;
}

export function isPlanLifecyclePath(repoPath, planDirectories) {
  return planIdFromLifecyclePath(repoPath, planDirectories) !== null;
}

export function pathExists(repoRoot, repoPath) {
  return fs.existsSync(path.join(repoRoot, ...toPosix(repoPath).split("/")));
}

export function absoluteFromRepo(repoRoot, repoPath) {
  return path.join(repoRoot, ...toPosix(repoPath).split("/"));
}
