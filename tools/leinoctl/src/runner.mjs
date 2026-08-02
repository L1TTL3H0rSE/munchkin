import { spawn } from "node:child_process";
import { EXIT_CODES, LeinoError } from "./errors.mjs";
import { resolveExistingDirectoryInside } from "./fs.mjs";
import { validateCommand } from "./profile.mjs";

function attachFailureResult(error, result) {
  error.result = result;
  return error;
}

export async function runCommand(command, {
  repoRoot,
  dryRun = false,
  capture = false,
  env = process.env,
  onStart = () => {},
  timeoutMs = 0,
} = {}) {
  const normalized = validateCommand(command);
  const cwd = resolveExistingDirectoryInside(repoRoot, normalized.cwd, "command cwd");
  const [executable, ...args] = normalized.argv;
  onStart({ ...normalized, cwd });

  if (dryRun) {
    return {
      command: normalized,
      exitCode: 0,
      signal: null,
      started: false,
      timedOut: false,
      stdout: "",
      stderr: "",
      dryRun: true,
    };
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let timeoutHandle;
    let killHandle;
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
    const finish = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (killHandle) {
        clearTimeout(killHandle);
      }
      callback();
    };
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill();
        killHandle = setTimeout(() => child.kill("SIGKILL"), 1_000);
      }, timeoutMs);
    }
    child.on("error", (error) => {
      finish(() => {
        const result = {
          command: normalized,
          exitCode: EXIT_CODES.checkFailed,
          signal: null,
          started: false,
          timedOut,
          stdout,
          stderr,
          dryRun: false,
          error: error.message,
        };
        reject(attachFailureResult(new LeinoError(
          "command-start-failed",
          `failed to start ${executable}: ${error.message}`,
          { exitCode: EXIT_CODES.checkFailed, cause: error },
        ), result));
      });
    });
    child.on("close", (code, signal) => {
      finish(() => {
        const exitCode = Number.isInteger(code) ? code : EXIT_CODES.checkFailed;
        const result = {
          command: normalized,
          exitCode,
          signal: signal ?? null,
          started: true,
          timedOut,
          stdout,
          stderr,
          dryRun: false,
        };
        if (exitCode !== 0 || signal || timedOut) {
          reject(attachFailureResult(new LeinoError(
            "command-failed",
            `${normalized.id} failed with ${signal ? `signal ${signal}` : timedOut ? "timeout" : `exit ${exitCode}`}`,
            {
              exitCode: EXIT_CODES.checkFailed,
              details: capture ? [stdout, stderr].filter(Boolean) : [],
            },
          ), result));
          return;
        }
        resolve(result);
      });
    });
  });
}

export async function runCommands(commands, options = {}) {
  const results = [];
  for (const command of commands) {
    try {
      const result = await runCommand(command, options);
      results.push(result);
      options.onComplete?.(result);
    } catch (error) {
      if (error?.result) {
        results.push(error.result);
        options.onComplete?.(error.result);
      }
      throw error;
    }
  }
  return results;
}
