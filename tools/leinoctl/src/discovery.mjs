import fs from "node:fs";
import path from "node:path";
import { readJson, readText, toPosix, walkFiles } from "./fs.mjs";

function globToRegex(glob) {
  const value = toPosix(glob).replace(/^\.\//, "");
  let source = "^";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "*" && value[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[\\^$.[\]()+|]/g, "\\$&");
    }
  }
  return new RegExp(`${source}$`);
}

export function matchesGlob(value, glob) {
  return globToRegex(glob).test(toPosix(value));
}

export function parseGoRequires(text) {
  const requires = [];
  let inBlock = false;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line) {
      continue;
    }
    if (/^require\s*\($/.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock && line === ")") {
      inBlock = false;
      continue;
    }
    const direct = line.match(/^require\s+(\S+)\s+\S+/);
    const blocked = inBlock ? line.match(/^(\S+)\s+\S+/) : null;
    const moduleName = direct?.[1] ?? blocked?.[1];
    if (moduleName) {
      requires.push(moduleName);
    }
  }
  return [...new Set(requires)].sort();
}

export function discoverGoModules(repoRoot, files = walkFiles(repoRoot, {
  accept: (relative) => path.posix.basename(relative) === "go.mod",
})) {
  return files.map((relative) => {
    const text = readText(path.join(repoRoot, ...relative.split("/")));
    const moduleName = text.match(/^\s*module\s+(\S+)\s*$/m)?.[1] ?? null;
    return {
      root: path.posix.dirname(relative) === "." ? "." : path.posix.dirname(relative),
      manifest: relative,
      module: moduleName,
      requires: parseGoRequires(text),
      hasApp: fs.existsSync(path.join(
        repoRoot,
        ...path.posix.dirname(relative).split("/").filter((entry) => entry !== "."),
        "cmd",
        "app",
      )),
    };
  });
}

export function parsePnpmWorkspace(text) {
  const include = [];
  const exclude = [];
  let inPackages = false;
  for (const line of String(text).split(/\r?\n/)) {
    if (/^packages:\s*$/.test(line.trimEnd())) {
      inPackages = true;
      continue;
    }
    if (!inPackages) {
      continue;
    }
    const match = line.match(/^\s+-\s+['"]?([^'"]+?)['"]?\s*$/);
    if (!match) {
      if (line.trim() && !/^\s/.test(line)) {
        break;
      }
      continue;
    }
    const pattern = match[1].trim();
    if (pattern.startsWith("!")) {
      exclude.push(pattern.slice(1));
    } else {
      include.push(pattern);
    }
  }
  return { include, exclude };
}

export function discoverPnpmPackages(repoRoot, files = walkFiles(repoRoot, {
  accept: (relative) => path.posix.basename(relative) === "package.json"
    || path.posix.basename(relative) === "pnpm-workspace.yaml",
})) {
  const manifests = files.filter((entry) => path.posix.basename(entry) === "package.json");
  const workspaces = [];
  for (const workspaceFile of files.filter(
    (entry) => path.posix.basename(entry) === "pnpm-workspace.yaml",
  )) {
    const workspaceRoot = path.posix.dirname(workspaceFile);
    const patterns = parsePnpmWorkspace(
      readText(path.join(repoRoot, ...workspaceFile.split("/"))),
    );
    const packages = manifests
      .filter((manifest) => {
        const packageRoot = path.posix.dirname(manifest);
        const relative = workspaceRoot === "."
          ? packageRoot
          : packageRoot.startsWith(`${workspaceRoot}/`)
            ? packageRoot.slice(workspaceRoot.length + 1)
            : null;
        return relative !== null
          && patterns.include.some((pattern) => matchesGlob(relative, pattern))
          && !patterns.exclude.some((pattern) => matchesGlob(relative, pattern));
      })
      .map((manifest) => {
        const packageJson = readJson(path.join(repoRoot, ...manifest.split("/")));
        return {
          root: path.posix.dirname(manifest),
          manifest,
          name: typeof packageJson.name === "string" ? packageJson.name : null,
          private: packageJson.private === true,
          scripts: packageJson.scripts && typeof packageJson.scripts === "object"
            ? Object.keys(packageJson.scripts).sort()
            : [],
          dependencies: [...new Set([
            ...Object.keys(packageJson.dependencies ?? {}),
            ...Object.keys(packageJson.devDependencies ?? {}),
            ...Object.keys(packageJson.optionalDependencies ?? {}),
            ...Object.keys(packageJson.peerDependencies ?? {}),
          ])].sort(),
        };
      });
    workspaces.push({
      root: workspaceRoot,
      manifest: workspaceFile,
      patterns,
      packages,
    });
  }
  return workspaces;
}

export function parseGitmodules(text) {
  const result = [];
  let current = null;
  for (const line of String(text).split(/\r?\n/)) {
    const section = line.match(/^\s*\[submodule\s+"(.+)"\]\s*$/);
    if (section) {
      current = { name: section[1] };
      result.push(current);
      continue;
    }
    const property = line.match(/^\s*(path|url|branch)\s*=\s*(.+?)\s*$/);
    if (current && property) {
      current[property[1]] = property[2];
    }
  }
  return result.filter((entry) => entry.path);
}

export function discoverSubmodules(repoRoot) {
  const result = [];
  const visited = new Set();

  function visit(worktreeRoot, prefix = "") {
    const filePath = path.join(worktreeRoot, ".gitmodules");
    if (!fs.existsSync(filePath) || visited.has(filePath)) {
      return;
    }
    visited.add(filePath);
    for (const entry of parseGitmodules(readText(filePath))) {
      const relativePath = toPosix(prefix ? `${prefix}/${entry.path}` : entry.path);
      result.push({ ...entry, path: relativePath });
      visit(path.join(worktreeRoot, ...entry.path.split("/")), relativePath);
    }
  }

  visit(repoRoot);
  return result;
}

export function parseComposeServices(text) {
  const services = [];
  let inServices = false;
  let servicesIndent = -1;
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (!inServices && /^services:\s*(?:#.*)?$/.test(trimmed)) {
      inServices = true;
      servicesIndent = indent;
      continue;
    }
    if (!inServices) {
      continue;
    }
    if (indent <= servicesIndent) {
      break;
    }
    if (indent === servicesIndent + 2) {
      const match = trimmed.match(/^([A-Za-z0-9_.-]+):(?:\s|$)/);
      if (match) {
        services.push(match[1]);
      }
    }
  }
  return services;
}

export function discoverCompose(repoRoot, composeFiles) {
  return composeFiles.flatMap((relative) => {
    const absolute = path.join(repoRoot, ...relative.split("/"));
    if (!fs.existsSync(absolute)) {
      return [];
    }
    return parseComposeServices(readText(absolute)).map((service) => ({
      file: relative,
      service,
    }));
  });
}

export function discoverRepository(repoRoot, profile) {
  const files = walkFiles(repoRoot);
  return {
    goModules: discoverGoModules(
      repoRoot,
      files.filter((entry) => path.posix.basename(entry) === "go.mod"),
    ),
    pnpmWorkspaces: discoverPnpmPackages(
      repoRoot,
      files.filter((entry) => (
        path.posix.basename(entry) === "package.json"
        || path.posix.basename(entry) === "pnpm-workspace.yaml"
      )),
    ),
    submodules: discoverSubmodules(repoRoot),
    composeServices: discoverCompose(repoRoot, profile.composeFiles),
  };
}
