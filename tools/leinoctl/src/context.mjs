import fs from "node:fs";
import path from "node:path";
import { assertRepoRelative, toPosix } from "./fs.mjs";

export function relevantInstructionFiles(repoRoot, paths, {
  fileName = "AGENTS.md",
} = {}) {
  const instructions = new Set();
  const addIfPresent = (relative) => {
    if (fs.existsSync(path.join(repoRoot, ...relative.split("/")))) {
      instructions.add(relative);
    }
  };
  addIfPresent(fileName);
  for (const requested of paths) {
    const normalized = assertRepoRelative(toPosix(requested), "context path");
    const segments = normalized.split("/");
    const directorySegments = fs.existsSync(path.join(repoRoot, ...segments))
      && fs.statSync(path.join(repoRoot, ...segments)).isDirectory()
      ? segments
      : segments.slice(0, -1);
    const current = [];
    for (const segment of directorySegments) {
      if (/[*?{]/.test(segment)) {
        break;
      }
      current.push(segment);
      addIfPresent(`${current.join("/")}/${fileName}`);
    }
  }
  return [...instructions].sort();
}
