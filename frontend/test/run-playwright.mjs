import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn, spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

export const RUNNER_TEARDOWN_TIMEOUT_MS = 10_000;
export const MIN_NODE_MAJOR = 24;

const runnerPath = fileURLToPath(import.meta.url);
const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const defaultCliPath = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
);

function nodeMajor(version) {
  const match = String(version).match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function assertSupportedNode(version = process.versions.node) {
  if (nodeMajor(version) < MIN_NODE_MAJOR) {
    throw new Error(
      `Playwright runner requires Node >=${MIN_NODE_MAJOR}; detected ${version}. `
        + "Use the repository's bundled runtime.",
    );
  }
}

function runDirectoryName() {
  return `munchkin-playwright-${process.pid}`;
}

export function createEvidenceDirectory(tempRoot = os.tmpdir()) {
  const runDirectory = fs.mkdtempSync(
    path.join(tempRoot, `${runDirectoryName()}-`),
  );
  return {
    runDirectory,
    outputDirectory: path.join(runDirectory, "artifacts"),
    reportDirectory: path.join(runDirectory, "report"),
  };
}

function hasWorkersFlag(argumentsList) {
  return argumentsList.some((argument) => (
    argument === "--workers" || argument.startsWith("--workers=")
  ));
}

export function runnerArguments(argumentsList) {
  if (hasWorkersFlag(argumentsList)) {
    return [...argumentsList];
  }
  return [...argumentsList, "--workers=1"];
}

function signalExitCode(signal) {
  return signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;
}

function defaultProcessKill(pid, signal) {
  return process.kill(pid, signal);
}

export function terminateProcessTree(
  pid,
  {
    platform = process.platform,
    signal = "SIGTERM",
    force = false,
    processKill = defaultProcessKill,
    spawnSyncImpl = spawnSync,
  } = {},
) {
  if (!pid) {
    return false;
  }

  if (platform === "win32") {
    try {
      const argumentsList = ["/PID", String(pid), "/T"];
      if (force) {
        argumentsList.push("/F");
      }
      const result = spawnSyncImpl("taskkill.exe", argumentsList, {
        stdio: "ignore",
        windowsHide: true,
      });
      return result?.status === 0;
    } catch {
      return false;
    }
  }

  try {
    processKill(-pid, signal);
    return true;
  } catch {
    try {
      processKill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

function writeError(stderr, error) {
  const message = error instanceof Error ? error.message : String(error);
  stderr.write(`[playwright-runner] ${message}\n`);
}

function isTestResultLine(line) {
  return /^\s*(?:ok|not ok|✓|✘|✖|×)\s+\d+\b/.test(line)
    && /\(\d+(?:\.\d+)?s\)/.test(line);
}

function attachChildOutput(
  child,
  {
    stdout = process.stdout,
    stderr = process.stderr,
    onAllTestsReported,
  } = {},
) {
  let expectedTests = null;
  let completedTests = 0;
  let pendingLine = "";

  const observeStdout = (chunk) => {
    stdout.write(chunk);
    pendingLine += String(chunk);
    const lines = pendingLine.split(/\r?\n/);
    pendingLine = lines.pop() ?? "";
    for (const line of lines) {
      const runningMatch = line.match(/Running\s+(\d+)\s+tests?/i);
      if (runningMatch) {
        expectedTests = Number(runningMatch[1]);
      }
      if (isTestResultLine(line)) {
        completedTests += 1;
        if (expectedTests === null || completedTests >= expectedTests) {
          onAllTestsReported();
        }
      }
    }
  };

  child.stdout?.on("data", observeStdout);
  child.stderr?.on("data", (chunk) => stderr.write(chunk));
}

async function probeURL(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_000);
  timeout.unref?.();
  try {
    const response = await fetchImpl(url, {signal: controller.signal});
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(
  server,
  {
    url,
    fetchImpl = globalThis.fetch,
    timeoutMs = 120_000,
  },
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Node fetch is required for browser server readiness checks");
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.error) {
      throw server.error;
    }
    if (server.child.exitCode !== null || server.child.signalCode !== null) {
      throw new Error(
        `managed browser server exited before readiness: ${server.label}`,
      );
    }
    if (await probeURL(url, fetchImpl)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`managed browser server readiness timed out: ${server.label} ${url}`);
}

function spawnManagedServer(
  label,
  executable,
  argumentsList,
  {
    cwd,
    env,
    spawnImpl,
    stdout,
    stderr,
  },
) {
  const child = spawnImpl(executable, argumentsList, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
  });
  const server = {label, child, error: null, owned: true};
  child.stdout?.on("data", (chunk) => stdout.write(chunk));
  child.stderr?.on("data", (chunk) => stderr.write(chunk));
  child.once("error", (error) => {
    server.error = error;
  });
  return server;
}

function cleanupManagedServers(
  servers,
  {
    platform,
    terminateTree,
    stderr,
  },
) {
  const errors = [];
  for (const server of [...servers].reverse()) {
    if (!server.owned || !server.child.pid) {
      continue;
    }
    const terminated = terminateTree(server.child.pid, {
      platform,
      signal: "SIGKILL",
      force: true,
    });
    let killRequested = false;
    try {
      killRequested = server.child.kill?.("SIGTERM") === true;
    } catch (error) {
      errors.push(`${server.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!terminated && !killRequested && server.child.exitCode === null) {
      errors.push(`${server.label}: process-tree termination was not confirmed`);
    }
  }
  if (errors.length) {
    stderr.write(`[playwright-runner] managed server cleanup: ${errors.join("; ")}\n`);
  }
  return errors;
}

async function startManagedServers(
  {
    env,
    nodeExecutable,
    spawnImpl,
    fetchImpl = globalThis.fetch,
    serverTimeoutMs = 120_000,
    stdout,
    stderr,
  },
) {
  const port = Number(env.PLAYWRIGHT_PORT ?? 4173);
  const apiPort = Number(env.PLAYWRIGHT_API_PORT ?? 18080);
  const isRealE2E = env.MUNCHKIN_REAL_E2E === "1";
  const baseURL = env.WEB_BASE_URL ?? `http://127.0.0.1:${port}`;
  const servers = [];
  const nuxtURL = new URL(baseURL).toString();
  const nuxtAlreadyRunning = await probeURL(nuxtURL, fetchImpl);

  if (!nuxtAlreadyRunning) {
    const nuxtServer = spawnManagedServer(
      "Nuxt",
      nodeExecutable,
      [
        path.join(frontendRoot, "applications", "web", "node_modules", "nuxt", "bin", "nuxt.mjs"),
        "dev",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--no-fork",
      ],
      {
        cwd: path.join(frontendRoot, "applications", "web"),
        env: {
          ...env,
          NUXT_PUBLIC_API_BASE: isRealE2E
            ? `http://127.0.0.1:${apiPort}`
            : baseURL,
        },
        spawnImpl,
        stdout,
        stderr,
      },
    );
    servers.push(nuxtServer);
    await waitForServer(nuxtServer, {
      url: nuxtURL,
      fetchImpl,
      timeoutMs: serverTimeoutMs,
    });
  }

  if (isRealE2E) {
    const apiURL = `http://127.0.0.1:${apiPort}/healthz`;
    const apiAlreadyRunning = await probeURL(apiURL, fetchImpl);
    if (!apiAlreadyRunning) {
      const gameServer = spawnManagedServer(
        "Go game server",
        "go",
        ["run", "./cmd/server"],
        {
          cwd: path.join(repositoryRoot, "backend", "game"),
          env: {
            ...env,
            SERVER_ADDR: `127.0.0.1:${apiPort}`,
            GAME_CONTENT_PATH: env.GAME_CONTENT_PATH ?? "../../content/sets/moscow/v4/cards.json",
            AUTO_MIGRATE: "false",
            CORS_ALLOWED_ORIGINS: baseURL,
          },
          spawnImpl,
          stdout,
          stderr,
        },
      );
      servers.push(gameServer);
      await waitForServer(gameServer, {
        url: apiURL,
        fetchImpl,
        timeoutMs: serverTimeoutMs,
      });
    }
  }

  return servers;
}

function waitForChild(
  child,
  {
    signalSource = process,
    platform = process.platform,
    teardownTimeoutMs = RUNNER_TEARDOWN_TIMEOUT_MS,
    terminateTree = terminateProcessTree,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {},
) {
  return new Promise((resolve) => {
    let settled = false;
    let requestedSignal = null;
    let forced = false;
    let startupError = null;
    let forceTimer = null;
    let completionTimer = null;
    const signalHandlers = new Map();

    const removeSignalListeners = () => {
      for (const signal of ["SIGINT", "SIGTERM"]) {
        signalSource.removeListener?.(signal, signalHandlers.get(signal));
      }
    };

    const finish = (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      if (forceTimer) {
        clearTimeout(forceTimer);
      }
      if (completionTimer) {
        clearTimeout(completionTimer);
      }
      removeSignalListeners();
      resolve({
        code,
        signal: signal ?? requestedSignal,
        forced,
        startupError,
      });
    };

    const forceTerminate = () => {
      forced = true;
      try {
        child.kill?.("SIGKILL");
      } catch {
        // The process may already have exited between the graceful and forceful attempts.
      }
      terminateTree(child.pid, {
        platform,
        signal: "SIGKILL",
        force: true,
      });
      finish(null, "SIGKILL");
    };

    const scheduleTeardown = () => {
      if (settled || completionTimer) {
        return;
      }
      completionTimer = setTimeout(() => {
        stderr.write(
          `[playwright-runner] tests completed but teardown exceeded ${teardownTimeoutMs}ms; forcing process-tree cleanup.\n`,
        );
        forceTerminate();
      }, teardownTimeoutMs);
      completionTimer.unref?.();
    };

    function requestTermination(signal) {
      if (settled || requestedSignal) {
        if (requestedSignal && signal !== requestedSignal) {
          forceTerminate();
        }
        return;
      }
      requestedSignal = signal;
      if (completionTimer) {
        clearTimeout(completionTimer);
        completionTimer = null;
      }
      try {
        child.kill?.(signal);
      } catch (error) {
        writeError(stderr, error);
      }
      terminateTree(child.pid, {
        platform,
        signal,
        force: false,
      });
      forceTimer = setTimeout(forceTerminate, teardownTimeoutMs);
      forceTimer.unref?.();
    }

    attachChildOutput(child, {
      stdout,
      stderr,
      onAllTestsReported: scheduleTeardown,
    });

    for (const signal of ["SIGINT", "SIGTERM"]) {
      const handler = () => requestTermination(signal);
      signalHandlers.set(signal, handler);
      signalSource.on?.(signal, handler);
    }

    child.once("error", (error) => {
      startupError = error;
      writeError(stderr, error);
    });
    child.once("close", (code, signal) => finish(code, signal));
  });
}

export async function runPlaywright(
  argumentsList = process.argv.slice(2),
  {
    spawnImpl = spawn,
    spawnSyncImpl = spawnSync,
    nodeExecutable = process.execPath,
    cliPath = defaultCliPath,
    cwd = frontendRoot,
    env = process.env,
    platform = process.platform,
    nodeVersion = process.versions.node,
    tempRoot = os.tmpdir(),
    evidenceDirectory = null,
    teardownTimeoutMs = RUNNER_TEARDOWN_TIMEOUT_MS,
    signalSource = process,
    manageServers = true,
    fetchImpl = globalThis.fetch,
    serverTimeoutMs = 120_000,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {},
) {
  assertSupportedNode(nodeVersion);

  const evidence = evidenceDirectory ?? createEvidenceDirectory(tempRoot);
  const shouldManageServers = manageServers && !argumentsList.includes("--list");
  const childEnvironment = {
    ...env,
    MUNCHKIN_PLAYWRIGHT_OUTPUT_DIR: evidence.outputDirectory,
    MUNCHKIN_PLAYWRIGHT_REPORT_DIR: evidence.reportDirectory,
    MUNCHKIN_PLAYWRIGHT_RUN_DIR: evidence.runDirectory,
    PW_DISABLE_TS_ESM: "1",
    ...(shouldManageServers ? {MUNCHKIN_PLAYWRIGHT_MANAGED_SERVERS: "1"} : {}),
  };
  const childArguments = runnerArguments(argumentsList);
  const terminateTree = (pid, options) => terminateProcessTree(pid, {
    ...options,
    spawnSyncImpl,
  });
  let managedServers = [];

  if (shouldManageServers) {
    try {
      managedServers = await startManagedServers({
        env: childEnvironment,
        nodeExecutable,
        spawnImpl,
        fetchImpl,
        serverTimeoutMs,
        stdout,
        stderr,
      });
    } catch (error) {
      const cleanupErrors = cleanupManagedServers(managedServers, {
        platform,
        terminateTree,
        stderr,
      });
      writeError(stderr, error);
      if (cleanupErrors.length) {
        stderr.write(`[playwright-runner] server cleanup also failed: ${cleanupErrors.join("; ")}\n`);
      }
      stderr.write(`[playwright-runner] retained evidence: ${evidence.runDirectory}\n`);
      return {
        exitCode: 1,
        signal: null,
        forced: false,
        startupError: error,
        ...evidence,
        retained: true,
      };
    }
  }

  let child;
  try {
    child = spawnImpl(
      nodeExecutable,
      [cliPath, ...childArguments],
      {
        cwd,
        env: childEnvironment,
        stdio: ["inherit", "pipe", "pipe"],
        shell: false,
        windowsHide: true,
        detached: platform !== "win32",
      },
    );
  } catch (error) {
    cleanupManagedServers(managedServers, {
      platform,
      terminateTree,
      stderr,
    });
    writeError(stderr, error);
    stderr.write(`[playwright-runner] retained evidence: ${evidence.runDirectory}\n`);
    return {
      exitCode: 1,
      signal: null,
      forced: false,
      startupError: error,
      ...evidence,
      retained: true,
    };
  }

  const result = await waitForChild(child, {
    signalSource,
    platform,
    teardownTimeoutMs,
    stdout,
    terminateTree,
    stderr,
  });
  const cleanupErrors = cleanupManagedServers(managedServers, {
    platform,
    terminateTree,
    stderr,
  });
  const exitCode = result.signal
    ? signalExitCode(result.signal)
    : result.code ?? 1;
  const teardownError = cleanupErrors.length
    ? new Error(`managed server cleanup failed: ${cleanupErrors.join("; ")}`)
    : null;
  const succeeded = exitCode === 0
    && !result.forced
    && !result.startupError
    && !teardownError;

  if (succeeded) {
    try {
      fs.rmSync(evidence.runDirectory, {recursive: true, force: true});
    } catch (error) {
      writeError(stderr, error);
      stderr.write(`[playwright-runner] retained evidence: ${evidence.runDirectory}\n`);
      return {
        exitCode: 1,
        signal: null,
        forced: false,
        startupError: error,
        ...evidence,
        retained: true,
      };
    }
  } else {
    stderr.write(`[playwright-runner] retained evidence: ${evidence.runDirectory}\n`);
  }

  return {
    exitCode,
    signal: result.signal,
    forced: result.forced,
    startupError: result.startupError ?? teardownError,
    ...evidence,
    retained: !succeeded,
  };
}

export {frontendRoot, repositoryRoot};

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === runnerPath) {
  runPlaywright().then((result) => {
    process.exitCode = result.exitCode;
  }).catch((error) => {
    writeError(process.stderr, error);
    process.exitCode = 1;
  });
}
