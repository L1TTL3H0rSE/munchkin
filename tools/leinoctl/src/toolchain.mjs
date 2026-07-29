import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { LeinoError } from "./errors.mjs";
import { resolveExistingDirectoryInside } from "./fs.mjs";

function executableCandidates(executable, env, platform) {
  if (executable.includes("/") || executable.includes("\\")) {
    return [path.resolve(executable)];
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
} = {}) {
  for (const candidate of executableCandidates(executable, env, platform)) {
    try {
      fs.accessSync(candidate, platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) {
        return fs.realpathSync(candidate);
      }
    } catch {
      // Continue through PATH candidates.
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

function commandExecutables(profile, graph) {
  return [...new Set([
    "git",
    ...(profile.toolchain?.requiredExecutables ?? []),
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
    const executablePath = findExecutable(name, { env, platform });
    const minimumVersion = profile.toolchain?.minimumVersions?.[name] ?? null;
    let version = null;
    let satisfiesMinimum = executablePath !== null;
    if (!executablePath) {
      issues.push({
        code: "tool-missing",
        message: `required executable is unavailable: ${name}`,
      });
    } else if (minimumVersion) {
      const versionProbe = profile.toolchain?.versionProbes?.[name] ?? ["--version"];
      const result = spawn(executablePath, versionProbe, {
        cwd: repoRoot,
        encoding: "utf8",
        env,
        shell: false,
        timeout: 10_000,
      });
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
      path: executablePath,
      available: executablePath !== null,
      version,
      minimumVersion,
      satisfiesMinimum,
    };
  });

  const capabilities = (profile.toolchain?.capabilities ?? []).map((command) => {
    const executablePath = findExecutable(command.argv[0], { env, platform });
    if (!executablePath) {
      const result = {
        id: command.id,
        available: false,
        message: `capability executable is unavailable: ${command.argv[0]}`,
      };
      issues.push({ code: "tool-capability-missing", message: result.message });
      return result;
    }
    const cwd = resolveExistingDirectoryInside(repoRoot, command.cwd, "capability cwd");
    const result = spawn(executablePath, command.argv.slice(1), {
      cwd,
      encoding: "utf8",
      env,
      shell: false,
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
