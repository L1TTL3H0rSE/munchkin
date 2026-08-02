import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { LeinoError } from "./errors.mjs";
import { resolveExistingDirectoryInside } from "./fs.mjs";

function executableCandidates(executable, env, platform, repoRoot) {
  if (executable.includes("/") || executable.includes("\\")) {
    const absolute = path.isAbsolute(executable)
      ? path.resolve(executable)
      : path.resolve(repoRoot ?? process.cwd(), executable);
    if (platform !== "win32") {
      return [absolute];
    }
    const extensions = String(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";");
    return [absolute, ...extensions.map((extension) => `${absolute}${extension}`)];
  }
  const extensions = platform === "win32"
    ? String(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")
    : [""];
  return String(env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((directory) => extensions.map(
      (extension) => path.join(directory, `${executable}${extension}`),
    ));
}

export function findExecutable(executable, {
  env = process.env,
  platform = process.platform,
  repoRoot = process.cwd(),
} = {}) {
  for (const candidate of executableCandidates(executable, env, platform, repoRoot)) {
    try {
      fs.accessSync(candidate, platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) {
        return fs.realpathSync(candidate);
      }
    } catch {
      // Continue through PATH or declared resolver candidates.
    }
  }
  return null;
}

function numericVersion(value, label) {
  const match = String(value).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) {
    throw new LeinoError(
      "tool-version-unparseable",
      `${label} does not contain a semantic numeric version: ${value}`,
    );
  }
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

function atLeast(actual, minimum) {
  const left = numericVersion(actual, "actual version");
  const right = numericVersion(minimum, "minimum version");
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] > right[index];
    }
  }
  return true;
}

function parseDeclaration(value) {
  const raw = String(value).trim();
  const marker = raw.indexOf("@");
  if (marker < 1 || marker === raw.length - 1) {
    return { name: raw, resolver: "path", raw };
  }
  return {
    name: raw.slice(0, marker),
    resolver: raw.slice(marker + 1),
    raw,
  };
}

function declaredResolvers(profile) {
  const declarations = new Map();
  for (const entry of profile.toolchain?.requiredExecutables ?? []) {
    const declaration = parseDeclaration(entry);
    const previous = declarations.get(declaration.name);
    if (previous && previous.resolver !== declaration.resolver) {
      previous.conflict = [previous.resolver, declaration.resolver];
      continue;
    }
    declarations.set(declaration.name, declaration);
  }

  // The generic core accepts these aliases when a future profile adapter
  // supplies them; legacy profiles remain valid without either field.
  const aliases = profile.toolchain?.executableAliases ?? profile.toolchain?.resolvers;
  if (aliases && typeof aliases === "object" && !Array.isArray(aliases)) {
    for (const [name, resolver] of Object.entries(aliases)) {
      const declaration = { name, resolver: String(resolver), raw: `${name}@${resolver}` };
      const previous = declarations.get(name);
      if (previous && previous.resolver !== "path" && previous.resolver !== declaration.resolver) {
        previous.conflict = [previous.resolver, declaration.resolver];
      } else {
        declarations.set(name, declaration);
      }
    }
  }
  return declarations;
}

function currentRuntimeCandidates(name, { env, platform }) {
  const runtimeDirectory = path.dirname(process.execPath);
  const directories = [
    runtimeDirectory,
    path.resolve(runtimeDirectory, "..", "bin", "fallback"),
    path.resolve(runtimeDirectory, "..", "bin"),
  ];
  const extensions = platform === "win32"
    ? String(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")
    : [""];
  return directories.flatMap((directory) => extensions.map(
    (extension) => path.join(directory, `${name}${extension}`),
  ));
}

function executableProbeOptions(executablePath, platform) {
  return platform === "win32" && /\.(?:cmd|bat)$/i.test(executablePath)
    ? { shell: true }
    : { shell: false };
}

function declaredCandidates(name, resolver, {
  repoRoot,
  env,
  platform,
} = {}) {
  if (resolver === "path" || resolver === "PATH") {
    return { candidates: [name], error: null };
  }
  if (resolver === "current-runtime") {
    return { candidates: currentRuntimeCandidates(name, { env, platform }), error: null };
  }
  if (resolver.startsWith("env:")) {
    const variable = resolver.slice("env:".length);
    const value = String(env[variable] ?? "").trim();
    return value
      ? { candidates: [value], error: null }
      : {
        candidates: [],
        error: `declared resolver ${resolver} is unset for ${name}`,
      };
  }
  if (resolver.startsWith("repo:") || resolver.startsWith("path:")) {
    const relative = resolver.slice(resolver.indexOf(":") + 1);
    if (!relative || path.isAbsolute(relative) || /^[A-Za-z]:[\\/]/.test(relative)) {
      return {
        candidates: [],
        error: `declared resolver ${resolver} must use a repository-relative path`,
      };
    }
    const absolute = path.resolve(repoRoot, ...relative.replaceAll("\\", "/").split("/"));
    const back = path.relative(path.resolve(repoRoot), absolute);
    if (back === ".." || back.startsWith(`..${path.sep}`) || path.isAbsolute(back)) {
      return {
        candidates: [],
        error: `declared resolver ${resolver} escapes the repository`,
      };
    }
    return { candidates: [absolute], error: null };
  }
  return {
    candidates: [],
    error: `unknown declared resolver ${resolver} for ${name}`,
  };
}

export function resolveExecutable(name, {
  repoRoot = process.cwd(),
  profile = {},
  env = process.env,
  platform = process.platform,
} = {}) {
  const declarations = declaredResolvers(profile);
  const declaration = declarations.get(name) ?? { name, resolver: "path", raw: name };
  if (declaration.conflict) {
    return {
      name,
      requested: declaration.raw,
      resolver: declaration.resolver,
      path: null,
      error: `conflicting declared resolvers for ${name}: ${declaration.conflict.join(", ")}`,
    };
  }
  const declared = declaredCandidates(name, declaration.resolver, {
    repoRoot,
    env,
    platform,
  });
  const executablePath = declared.candidates
    .map((candidate) => findExecutable(candidate, { env, platform, repoRoot }))
    .find(Boolean) ?? null;
  return {
    name,
    requested: declaration.raw,
    resolver: declaration.resolver,
    path: executablePath,
    error: executablePath || declared.error
      ? declared.error
      : null,
  };
}

function commandExecutables(profile, graph) {
  return [...new Set([
    "git",
    ...(profile.toolchain?.requiredExecutables ?? []).map((entry) => parseDeclaration(entry).name),
    ...graph.components.flatMap(
      (component) => (component.checks ?? []).map((check) => check.argv[0]),
    ),
    ...(profile.generators ?? []).map((generator) => generator.argv[0]),
  ])].sort();
}

export function inspectToolchain(repoRoot, profile, graph, {
  env = process.env,
  platform = process.platform,
  spawn = spawnSync,
} = {}) {
  const issues = [];
  const executables = commandExecutables(profile, graph).map((name) => {
    const resolution = resolveExecutable(name, { repoRoot, profile, env, platform });
    const executablePath = resolution.path;
    const minimumVersion = profile.toolchain?.minimumVersions?.[name] ?? null;
    let version = null;
    let satisfiesMinimum = executablePath !== null;
    if (resolution.error) {
      issues.push({
        code: "tool-resolver-failed",
        message: resolution.error,
      });
    } else if (!executablePath) {
      issues.push({
        code: "tool-missing",
        message: `required executable is unavailable: ${name}`,
      });
    } else if (minimumVersion) {
      const versionProbe = profile.toolchain?.versionProbes?.[name] ?? ["--version"];
      let result;
      try {
        result = spawn(executablePath, versionProbe, {
          cwd: repoRoot,
          encoding: "utf8",
          env,
          ...executableProbeOptions(executablePath, platform),
          timeout: 10_000,
        });
      } catch {
        result = { status: null, stdout: "", stderr: "" };
      }
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
      try {
        version = numericVersion(output, name).join(".");
        satisfiesMinimum = result.status === 0 && atLeast(version, minimumVersion);
      } catch {
        satisfiesMinimum = false;
      }
      if (!satisfiesMinimum) {
        issues.push({
          code: "tool-version-too-low",
          message: `${name} must be >= ${minimumVersion}; detected ${version ?? "unknown"}`,
        });
      }
    }
    return {
      name,
      requested: resolution.requested,
      resolver: resolution.resolver,
      path: executablePath,
      available: executablePath !== null,
      version,
      minimumVersion,
      satisfiesMinimum,
    };
  });

  const capabilities = (profile.toolchain?.capabilities ?? []).map((command) => {
    const resolution = resolveExecutable(command.argv[0], { repoRoot, profile, env, platform });
    const executablePath = resolution.path;
    if (resolution.error) {
      const result = {
        id: command.id,
        requested: resolution.requested,
        resolver: resolution.resolver,
        path: null,
        available: false,
        message: resolution.error,
      };
      issues.push({ code: "tool-resolver-failed", message: result.message });
      return result;
    }
    if (!executablePath) {
      const result = {
        id: command.id,
        requested: resolution.requested,
        resolver: resolution.resolver,
        path: null,
        available: false,
        message: `capability executable is unavailable: ${command.argv[0]}`,
      };
      issues.push({ code: "tool-capability-missing", message: result.message });
      return result;
    }
    const result = spawn(executablePath, command.argv.slice(1), {
      cwd: resolveExistingDirectoryInside(repoRoot, command.cwd, "capability cwd"),
      encoding: "utf8",
      env,
      ...executableProbeOptions(executablePath, platform),
      timeout: 10_000,
    });
    const available = result.status === 0;
    const message = available
      ? null
      : `${command.id} capability failed with exit ${result.status ?? "unknown"}`;
    if (message) {
      issues.push({ code: "tool-capability-failed", message });
    }
    return {
      id: command.id,
      requested: resolution.requested,
      resolver: resolution.resolver,
      path: executablePath,
      available,
      message,
    };
  });

  return {
    ready: issues.length === 0,
    executables,
    capabilities,
    issues,
  };
}
