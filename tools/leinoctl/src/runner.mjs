import { spawn } from "node:child_process";
import { EXIT_CODES, LeinoError } from "./errors.mjs";
import { resolveExistingDirectoryInside } from "./fs.mjs";
import { validateCommand } from "./profile.mjs";

export async function runCommand(command, {
  repoRoot,
  dryRun = false,
  capture = false,
  env = process.env,
  onStart = () => {},
} = {}) {
  const normalized = validateCommand(command);
  const cwd = resolveExistingDirectoryInside(repoRoot, normalized.cwd, "command cwd");
  const [executable, ...args] = normalized.argv;
  onStart({ ...normalized, cwd });

  if (dryRun) {
    return {
      command: normalized,
      exitCode: 0,
      stdout: "",
      stderr: "",
      dryRun: true,
    };
  }

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env,
      shell: false,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }
    child.on("error", (error) => {
      reject(new LeinoError(
        "command-start-failed",
        `failed to start ${executable}: ${error.message}`,
        { exitCode: EXIT_CODES.checkFailed, cause: error },
      ));
    });
    child.on("close", (code, signal) => {
      const exitCode = Number.isInteger(code) ? code : EXIT_CODES.checkFailed;
      if (exitCode !== 0) {
        reject(new LeinoError(
          "command-failed",
          `${normalized.id} failed with ${signal ? `signal ${signal}` : `exit ${exitCode}`}`,
          {
            exitCode: EXIT_CODES.checkFailed,
            details: capture ? [stdout, stderr].filter(Boolean) : [],
          },
        ));
        return;
      }
      resolve({
        command: normalized,
        exitCode,
        stdout,
        stderr,
        dryRun: false,
      });
    });
  });
}

export async function runCommands(commands, options = {}) {
  const results = [];
  for (const command of commands) {
    const result = await runCommand(command, options);
    results.push(result);
    options.onComplete?.(result);
  }
  return results;
}
