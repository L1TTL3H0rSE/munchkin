import fs from "node:fs";
import path from "node:path";
import { LeinoError } from "./errors.mjs";

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true });
const DEFAULT_IGNORES = new Set([
  ".git",
  ".idea",
  ".leino/runtime",
  ".next",
  ".nitro",
  ".nuxt",
  ".output",
  ".pnpm-store",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "vendor",
]);

export function decodeUtf8Strict(bytes, source = "text") {
  try {
    const text = STRICT_UTF8.decode(bytes);
    if (text.includes("\uFFFD")) {
      throw new LeinoError("invalid-utf8", `${source} contains U+FFFD`);
    }
    return text;
  } catch (error) {
    if (error instanceof LeinoError) {
      throw error;
    }
    throw new LeinoError("invalid-utf8", `${source} is not strict UTF-8`, { cause: error });
  }
}

export function readText(filePath) {
  return decodeUtf8Strict(fs.readFileSync(filePath), filePath);
}

export function readTextPrefix(filePath, maxBytes = 64 * 1024) {
  const descriptor = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(maxBytes);
    const bytesRead = fs.readSync(descriptor, buffer, 0, maxBytes, 0);
    const bytes = buffer.subarray(0, bytesRead);
    for (let trim = 0; trim <= 3 && trim <= bytes.length; trim += 1) {
      try {
        return new TextDecoder("utf-8", { fatal: true })
          .decode(bytes.subarray(0, bytes.length - trim));
      } catch (error) {
        if (trim === 3 || trim === bytes.length) {
          throw new LeinoError(
            "invalid-utf8",
            `${filePath} prefix is not strict UTF-8`,
            { cause: error },
          );
        }
      }
    }
    return "";
  } finally {
    fs.closeSync(descriptor);
  }
}

export function readJson(filePath) {
  try {
    return JSON.parse(readText(filePath));
  } catch (error) {
    if (error instanceof LeinoError) {
      throw error;
    }
    throw new LeinoError("invalid-json", `${filePath}: ${error.message}`, { cause: error });
  }
}

export function toPosix(value) {
  return String(value).replaceAll("\\", "/");
}

export function assertRepoRelative(value, label = "path") {
  const normalized = toPosix(String(value ?? "").trim()).replace(/^\.\//, "");
  if (
    !normalized
    || normalized.startsWith("/")
    || /^[A-Za-z]:\//.test(normalized)
    || normalized.split("/").includes("..")
  ) {
    throw new LeinoError("invalid-repository-path", `${label} must stay repository-relative: ${value}`);
  }
  return normalized;
}

export function resolveInside(repoRoot, candidate, label = "path") {
  const relative = assertRepoRelative(candidate, label);
  const root = path.resolve(repoRoot);
  const absolute = path.resolve(root, ...relative.split("/"));
  const back = path.relative(root, absolute);
  if (back === ".." || back.startsWith(`..${path.sep}`) || path.isAbsolute(back)) {
    throw new LeinoError("path-escapes-repository", `${label} escapes repository: ${candidate}`);
  }
  return absolute;
}

export function resolveExistingDirectoryInside(repoRoot, candidate, label = "directory") {
  const root = fs.realpathSync(path.resolve(repoRoot));
  const lexical = resolveInside(root, candidate, label);
  let resolved;
  try {
    resolved = fs.realpathSync(lexical);
  } catch (error) {
    throw new LeinoError(
      "repository-directory-missing",
      `${label} does not resolve to an existing directory: ${candidate}`,
      { cause: error },
    );
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new LeinoError(
      "repository-directory-invalid",
      `${label} is not a directory: ${candidate}`,
    );
  }
  const back = path.relative(root, resolved);
  if (back === ".." || back.startsWith(`..${path.sep}`) || path.isAbsolute(back)) {
    throw new LeinoError(
      "path-escapes-repository",
      `${label} resolves outside repository through a symlink: ${candidate}`,
    );
  }
  return resolved;
}

function isIgnored(relativePath, baseName, extraIgnores) {
  const relative = toPosix(relativePath);
  return DEFAULT_IGNORES.has(baseName)
    || DEFAULT_IGNORES.has(relative)
    || extraIgnores.some((entry) => (
      relative === entry || relative.startsWith(`${entry}/`)
    ));
}

export function walkFiles(repoRoot, {
  from = ".",
  extraIgnores = [],
  accept = () => true,
} = {}) {
  const root = path.resolve(repoRoot);
  const start = from === "." ? root : resolveInside(root, from, "walk root");
  const ignores = extraIgnores.map((entry) => assertRepoRelative(entry, "ignore path"));
  const result = [];
  const stack = [start];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => right.name.localeCompare(left.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const relative = toPosix(path.relative(root, absolute));
      if (isIgnored(relative, entry.name, ignores)) {
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile() && accept(relative, absolute)) {
        result.push(relative);
      }
    }
  }

  return result.sort();
}

export function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, filePath);
}
