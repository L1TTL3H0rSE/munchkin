import fs from "node:fs";
import path from "node:path";
import {
  buildComponentGraph,
  componentChecks,
  impactedComponents,
} from "./components.mjs";
import { relevantInstructionFiles } from "./context.mjs";
import { discoverRepository } from "./discovery.mjs";
import { asLeinoError, EXIT_CODES, LeinoError } from "./errors.mjs";
import { buildGeneratorCommands } from "./generators.mjs";
import {
  changedSinceBaseline,
  changedPaths,
  fingerprintSnapshotPaths,
  gitPreflight,
  snapshotRepository,
  submoduleStatus,
  syncRepository,
} from "./git.mjs";
import { outputEnvelope, writeOutput } from "./output.mjs";
import {
  activePlanSummary,
  createPlanDraft,
  loadPlanRegistry,
  loadRelevantPlanDocuments,
  registryIssues,
} from "./plans.mjs";
import { loadProfile } from "./profile.mjs";
import { runCommands } from "./runner.mjs";
import { inspectToolchain } from "./toolchain.mjs";
import { checkTextPaths } from "./text.mjs";
import {
  claimPlanLifecycle,
  readSession,
  recordSessionCheck,
  releasePlanLifecycle,
  releaseSelectedPlanForRotation,
  resolveSessionId,
  selectSessionPlan,
  sessionScopeReport,
} from "./session.mjs";

const BOOLEAN_OPTIONS = new Set([
  "changed",
  "check",
  "dry-run",
  "help",
  "json",
  "require-clean",
  "require-toolchain",
  "relevant",
  "takeover",
]);
const REPEATABLE_OPTIONS = new Set(["components", "contracts", "paths"]);
const VALUE_OPTIONS = new Set([
  "base",
  "components",
  "contracts",
  "jobs",
  "paths",
  "plan",
  "profile",
  "repo",
  "session",
]);
const GLOBAL_OPTIONS = new Set(["help", "json", "profile", "repo"]);
const COMMAND_OPTIONS = {
  preflight: new Set(["require-clean", "require-toolchain"]),
  components: new Set(["base", "changed", "paths"]),
  compose: new Set(["dry-run", "jobs"]),
  submodules: new Set(),
  context: new Set(["base", "changed", "components", "contracts", "paths"]),
  "plan-relevant": new Set(["base", "changed", "components", "contracts", "paths", "relevant"]),
  "plan-create": new Set(),
  "plan-claim": new Set(["session", "takeover"]),
  "plan-release": new Set(["session"]),
  "plan-select": new Set(["session", "takeover"]),
  "scope-check": new Set(["plan", "session"]),
  "text-check": new Set(["base", "changed", "paths"]),
  verify: new Set(["base", "changed", "dry-run", "paths", "session"]),
  generate: new Set(["check", "dry-run", "session"]),
  sync: new Set(["dry-run", "jobs"]),
};

function parseArguments(argv) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const [nameWithDashes, inlineValue] = token.split(/=(.*)/s, 2);
    const name = nameWithDashes.slice(2);
    if (!BOOLEAN_OPTIONS.has(name) && !VALUE_OPTIONS.has(name)) {
      throw new LeinoError(
        "option-unknown",
        `unknown option: --${name}`,
        { exitCode: EXIT_CODES.usage },
      );
    }
    if (BOOLEAN_OPTIONS.has(name) && inlineValue === undefined) {
      options[name] = true;
      continue;
    }
    if (BOOLEAN_OPTIONS.has(name)) {
      throw new LeinoError(
        "option-value-unexpected",
        `--${name} does not accept a value`,
        { exitCode: EXIT_CODES.usage },
      );
    }
    const value = inlineValue ?? argv[++index];
    if (value === undefined || value.startsWith("--")) {
      throw new LeinoError(
        "option-value-missing",
        `--${name} requires a value`,
        { exitCode: EXIT_CODES.usage },
      );
    }
    if (REPEATABLE_OPTIONS.has(name)) {
      options[name] = [
        ...(options[name] ?? []),
        ...value.split(",").map((entry) => entry.trim()).filter(Boolean),
      ];
    } else {
      options[name] = value;
    }
  }
  return { options, positionals };
}

function validateInvocation(command, positionals, options) {
  const allowed = new Set([
    ...GLOBAL_OPTIONS,
    ...(COMMAND_OPTIONS[command] ?? []),
  ]);
  for (const name of Object.keys(options)) {
    if (!allowed.has(name)) {
      throw new LeinoError(
        "option-command-mismatch",
        `--${name} is not valid for ${command}`,
        { exitCode: EXIT_CODES.usage },
      );
    }
  }

  const exactPositionals = {
    preflight: 1,
    components: 1,
    submodules: 1,
    context: 1,
    "plan-relevant": positionals[0] === "active-plans" ? 1 : 2,
    "plan-create": 3,
    "plan-claim": 3,
    "plan-release": 3,
    "plan-select": 3,
    "scope-check": 1,
    "text-check": 1,
    verify: 1,
    sync: 1,
  };
  const expected = exactPositionals[command];
  if (expected !== undefined && positionals.length !== expected) {
    throw new LeinoError(
      "command-arguments-invalid",
      `${command} received an invalid number of positional arguments`,
      { exitCode: EXIT_CODES.usage },
    );
  }
  if (command === "generate" && positionals.length < 1) {
    throw new LeinoError(
      "command-arguments-invalid",
      "generate requires a command name",
      { exitCode: EXIT_CODES.usage },
    );
  }
  if (command === "compose" && positionals.length < 2) {
    throw new LeinoError(
      "command-arguments-invalid",
      "compose requires arguments after --",
      { exitCode: EXIT_CODES.usage },
    );
  }
}

function findRepoRoot(start) {
  let current = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(current, ".leino", "profile.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new LeinoError(
        "repository-profile-not-found",
        `could not find .leino/profile.json from ${start}`,
      );
    }
    current = parent;
  }
}

function loadContext(options, { includeRegistry = true } = {}) {
  const repoRoot = findRepoRoot(options.repo ?? process.cwd());
  const profile = loadProfile(repoRoot, options.profile ?? ".leino/profile.json");
  const registry = includeRegistry ? loadPlanRegistry(repoRoot, profile.plans) : null;
  return { repoRoot, profile, registry };
}

function pathSelection(repoRoot, options) {
  return options.paths?.length
    ? options.paths
    : changedPaths(repoRoot, { base: options.base });
}

function verificationPathSelection(repoRoot, profile, options, env = process.env) {
  if (options.paths?.length) {
    return options.paths;
  }
  if (options.base) {
    return changedPaths(repoRoot, { base: options.base });
  }
  try {
    const sessionId = resolveSessionId(options.session, env);
    const session = readSession(repoRoot, profile.runtimeDir, sessionId);
    if (session) {
      return changedSinceBaseline(session.baseline, snapshotRepository(repoRoot));
    }
  } catch {
    // Human and CI invocations without a selected session use the worktree.
  }
  return changedPaths(repoRoot);
}

function commandLine(command) {
  return `${command.cwd === "." ? "." : command.cwd}$ ${command.argv.join(" ")}`;
}

function commandRunnerOptions(repoRoot, options) {
  return {
    repoRoot,
    dryRun: options["dry-run"] === true,
    capture: options.json === true,
    onStart: options.json
      ? () => {}
      : (command) => process.stdout.write(`${commandLine(command)}\n`),
  };
}

function maybeRecordChecks(
  repoRoot,
  profile,
  results,
  checkedPaths = [],
  explicitSessionId,
  env = process.env,
) {
  if (!explicitSessionId && !env.CODEX_THREAD_ID && !env.LEINO_SESSION_ID) {
    return;
  }
  let sessionId;
  try {
    sessionId = resolveSessionId(explicitSessionId, env);
  } catch {
    return;
  }
  const session = readSession(repoRoot, profile.runtimeDir, sessionId);
  if (!session) {
    return;
  }
  const lifecyclePaths = new Set([
    `${profile.plans.activeDir}/${session.planId}.md`,
    `${profile.plans.archiveDir}/${session.planId}.md`,
  ]);
  const coveredPaths = [...new Set(checkedPaths)]
    .filter((repoPath) => !lifecyclePaths.has(repoPath))
    .sort();
  const inputFingerprint = fingerprintSnapshotPaths(
    snapshotRepository(repoRoot),
    coveredPaths,
  );
  for (const result of results) {
    recordSessionCheck(repoRoot, profile, sessionId, {
      id: result.command.id,
      cwd: result.command.cwd,
      argv: result.command.argv,
      exitCode: result.exitCode,
      dryRun: result.dryRun,
      checkedPaths: coveredPaths,
      inputFingerprint,
      completedAt: new Date().toISOString(),
    });
  }
}

function helpText() {
  return [
    "Usage: leinoctl <command> [options]",
    "",
    "Read-only:",
    "  preflight [--require-clean] [--require-toolchain]",
    "  components [--changed] [--base <git-ref>]",
    "  submodules",
    "  context --paths <path[,path...]>",
    "  plan relevant --paths <path[,path...]>",
    "  scope-check [--plan <plan-id>]",
    "  text-check --changed|--paths <paths> [--base <git-ref>]",
    "",
    "Session:",
    "  plan create <short-kebab-name>",
    "  plan claim <plan-id> [--takeover] [--session <id>]",
    "  plan release <plan-id> [--session <id>]  # handoff or guarded completed rotation",
    "  plan select <plan-id> [--takeover] [--session <id>]",
    "",
    "Explicit execution:",
    "  compose [--jobs <N>] [--dry-run] -- <compose-args...>",
    "  verify --changed|--paths <paths> [--base <git-ref>] [--dry-run]",
    "  generate [--check] [target...] [--dry-run]",
    "  sync [--jobs <N>] [--dry-run]",
    "",
    "Global: --json --repo <path> --profile <relative-path>",
  ].join("\n");
}

async function execute(command, positionals, options, context) {
  const { repoRoot, profile, registry } = context;

  if (command === "preflight") {
    const git = gitPreflight(repoRoot);
    const issues = registryIssues(registry);
    const graph = buildComponentGraph(repoRoot, profile);
    const toolchain = inspectToolchain(repoRoot, profile, graph);
    const ok = issues.length === 0
      && (!options["require-clean"] || git.clean)
      && (!options["require-toolchain"] || toolchain.ready);
    return outputEnvelope(command, {
      repositoryId: profile.repositoryId,
      root: repoRoot,
      node: process.version,
      codexDoctor: {
        invoked: false,
        command: "codex doctor",
        responsibility: "Codex installation diagnostics; repository checks remain in leinoctl",
      },
      gitClean: git.clean,
      dirtyPaths: git.dirty,
      toolchain,
      activePlans: activePlanSummary(registry),
      registryIssues: issues,
    }, {
      ok,
      warnings: [
        ...(git.clean ? [] : [`worktree has ${git.dirty.length} dirty path(s)`]),
        ...(!options["require-toolchain"]
          ? toolchain.issues.map((issue) => issue.message)
          : []),
      ],
      errors: [
        ...issues.map((issue) => `${issue.planId}:${issue.code}`),
        ...(options["require-toolchain"]
          ? toolchain.issues.map((issue) => issue.message)
          : []),
      ],
    });
  }

  if (command === "components") {
    const discovery = discoverRepository(repoRoot, profile);
    const graph = buildComponentGraph(repoRoot, profile, discovery);
    const paths = options.changed || options.paths?.length || options.base
      ? pathSelection(repoRoot, options)
      : [];
    const components = paths.length ? impactedComponents(graph, paths) : graph.components;
    return outputEnvelope(command, {
      paths,
      components,
      counts: {
        components: components.length,
        discoveredComponents: graph.components.length,
        goModules: discovery.goModules.length,
        pnpmPackages: discovery.pnpmWorkspaces.reduce(
          (total, workspace) => total + workspace.packages.length,
          0,
        ),
        submodules: discovery.submodules.length,
        composeServices: discovery.composeServices.length,
      },
    });
  }

  if (command === "submodules") {
    const discovery = discoverRepository(repoRoot, profile);
    const snapshot = snapshotRepository(repoRoot);
    const statusByPath = new Map(
      submoduleStatus(repoRoot).map((entry) => [entry.path, entry]),
    );
    const metadataByPath = new Map(
      discovery.submodules.map((entry) => [entry.path, entry]),
    );
    const paths = [...new Set([
      ...metadataByPath.keys(),
      ...statusByPath.keys(),
    ])].sort();
    return outputEnvelope(command, paths.map((submodulePath) => {
      const status = statusByPath.get(submodulePath);
      return {
        ...(metadataByPath.get(submodulePath) ?? {}),
        path: submodulePath,
        initialized: Boolean(status && status.state !== "-"),
        pinned: status?.pinned ?? false,
        gitlinkStatus: status?.state ?? null,
        commit: status?.commit ?? null,
        head: snapshot.submodules[submodulePath]?.head ?? null,
        dirty: (snapshot.submodules[submodulePath]?.entries.length ?? 0) > 0,
      };
    }));
  }

  if (command === "context" || command === "plan-relevant") {
    const paths = pathSelection(repoRoot, options);
    const graph = buildComponentGraph(repoRoot, profile);
    const components = impactedComponents(graph, paths);
    const criteria = {
      paths,
      components: [...(options.components ?? []), ...components.map((entry) => entry.id)],
      contracts: [...new Set([
        ...(options.contracts ?? []),
        ...components.flatMap((entry) => entry.contracts ?? []),
      ])],
    };
    const relevant = loadRelevantPlanDocuments(repoRoot, profile.plans, criteria);
    const plans = relevant.plans;
    return outputEnvelope(command, {
      paths,
      instructions: relevantInstructionFiles(repoRoot, paths),
      components: components.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        roots: entry.roots,
        composeService: entry.composeService,
      })),
      plans: plans.map((plan) => ({
        planId: plan.planId,
        status: plan.status,
        eligible: plan.eligible,
        manifestVersion: plan.manifest.schemaVersion,
        file: path.relative(repoRoot, plan.filePath).replaceAll("\\", "/"),
      })),
      planScan: relevant.index,
    });
  }

  if (command === "plan-create") {
    const shortName = positionals[2];
    if (!shortName) {
      throw new LeinoError(
        "plan-short-name-missing",
        "plan create requires <short-kebab-name>",
        { exitCode: EXIT_CODES.usage },
      );
    }
    const created = createPlanDraft(repoRoot, profile.plans, shortName, {
      runtimeDir: profile.runtimeDir,
    });
    try {
      claimPlanLifecycle(
        repoRoot,
        profile.runtimeDir,
        created.planId,
        resolveSessionId(undefined),
      );
    } catch (error) {
      if (error?.code !== "session-id-missing") {
        throw error;
      }
    }
    return outputEnvelope(command, {
      planId: created.planId,
      file: path.relative(repoRoot, created.filePath).replaceAll("\\", "/"),
      status: "draft",
    });
  }

  if (command === "plan-select") {
    const planId = positionals[2];
    if (!planId) {
      throw new LeinoError(
        "plan-id-missing",
        "plan select requires <plan-id>",
        { exitCode: EXIT_CODES.usage },
      );
    }
    const state = selectSessionPlan(repoRoot, profile, registry, planId, {
      sessionId: options.session,
      takeover: options.takeover === true,
    });
    return outputEnvelope(command, {
      planId: state.planId,
      sessionId: state.sessionId,
      selectedAt: state.selectedAt,
      baselineDirtyPaths: [
        ...state.baseline.root.entries.map((entry) => entry.path),
        ...Object.entries(state.baseline.submodules).flatMap(([submodulePath, worktree]) => (
          worktree.entries.map((entry) => `${submodulePath}/${entry.path}`)
        )),
      ],
    });
  }

  if (command === "plan-claim") {
    const planId = positionals[2];
    const plan = registry.active.find((candidate) => candidate.planId === planId);
    if (!plan) {
      throw new LeinoError("plan-not-active", `active plan not found: ${planId}`);
    }
    const ownership = claimPlanLifecycle(
      repoRoot,
      profile.runtimeDir,
      planId,
      resolveSessionId(options.session),
      { takeover: options.takeover === true },
    );
    return outputEnvelope(command, {
      planId,
      sessionId: ownership.sessionId,
      claimedAt: ownership.claimedAt,
      takenOverFrom: ownership.takenOverFrom,
    });
  }

  if (command === "plan-release") {
    const planId = positionals[2];
    const resolvedSessionId = resolveSessionId(options.session);
    const selectedSession = readSession(repoRoot, profile.runtimeDir, resolvedSessionId);
    if (!selectedSession) {
      const released = releasePlanLifecycle(
        repoRoot,
        profile.runtimeDir,
        planId,
        resolvedSessionId,
      );
      return outputEnvelope(command, { planId, released, mode: "handoff" });
    }

    const current = snapshotRepository(repoRoot);
    const changed = changedSinceBaseline(selectedSession.baseline, current);
    const graph = buildComponentGraph(repoRoot, profile);
    const requiredChecks = componentChecks(impactedComponents(graph, changed));
    const result = releaseSelectedPlanForRotation(
      repoRoot,
      profile,
      registry,
      planId,
      {
        sessionId: resolvedSessionId,
        current,
        requiredChecks,
      },
    );
    return outputEnvelope(command, {
      planId,
      released: result.released,
      mode: result.mode,
      releasedAt: result.releasedAt,
      completedChecks: result.report.completedChecks.map((check) => check.id),
    }, {
      warnings: result.report.unledgered.length
        ? [`${result.report.unledgered.length} changed path(s) were not recorded by post-write hooks`]
        : [],
    });
  }

  if (command === "scope-check") {
    const resolvedSessionId = resolveSessionId(options.session);
    const selectedSession = readSession(repoRoot, profile.runtimeDir, resolvedSessionId);
    if (!selectedSession) {
      throw new LeinoError("session-not-selected", "no plan is selected for this session");
    }
    const current = snapshotRepository(repoRoot);
    const changed = changedSinceBaseline(selectedSession.baseline, current);
    const graph = buildComponentGraph(repoRoot, profile);
    const requiredChecks = componentChecks(impactedComponents(graph, changed));
    const report = sessionScopeReport(repoRoot, profile, registry, {
      sessionId: resolvedSessionId,
      current,
      requiredChecks,
    });
    if (options.plan && options.plan !== report.planId) {
      throw new LeinoError(
        "scope-plan-mismatch",
        `selected plan is ${report.planId}, not ${options.plan}`,
      );
    }
    return outputEnvelope(command, report, {
      ok: report.ok,
      warnings: [
        ...(report.unledgered.length
          ? [`${report.unledgered.length} changed path(s) were not recorded by a post-write hook`]
          : []),
        ...(report.staleChecks.length
          ? [`${report.staleChecks.length} successful check result(s) no longer cover current inputs`]
          : []),
      ],
      errors: [
        ...report.outsideWriteSet.map((entry) => `outside write set: ${entry}`),
        ...report.missingRequiredChecks.map(
          (entry) => `required check not completed: ${entry.id} (${entry.cwd})`,
        ),
      ],
    });
  }

  if (command === "text-check") {
    const paths = verificationPathSelection(repoRoot, profile, options);
    const result = checkTextPaths(repoRoot, paths);
    return outputEnvelope(command, {
      paths,
      checked: result.checked,
      skipped: result.skipped,
      issues: result.issues,
    }, {
      ok: result.ok,
      errors: result.issues.map((issue) => (
        `${issue.path}: [${issue.code}] ${issue.message}`
      )),
    });
  }

  if (command === "verify") {
    const paths = verificationPathSelection(repoRoot, profile, options);
    const graph = buildComponentGraph(repoRoot, profile);
    const components = impactedComponents(graph, paths);
    const checks = componentChecks(components);
    const runnerOptions = commandRunnerOptions(repoRoot, options);
    runnerOptions.onComplete = (result) => {
      maybeRecordChecks(repoRoot, profile, [result], paths, options.session);
    };
    const results = await runCommands(checks, runnerOptions);
    return outputEnvelope(command, {
      paths,
      components: components.map((entry) => entry.id),
      checks: results.map((result) => ({
        id: result.command.id,
        cwd: result.command.cwd,
        argv: result.command.argv,
        dryRun: result.dryRun,
        stdout: options.json ? result.stdout : undefined,
        stderr: options.json ? result.stderr : undefined,
      })),
    });
  }

  if (command === "generate") {
    const requested = positionals.slice(1);
    const commands = buildGeneratorCommands(profile.generators, requested, {
      check: options.check === true,
    });
    const runnerOptions = commandRunnerOptions(repoRoot, options);
    runnerOptions.onComplete = (result) => {
      maybeRecordChecks(repoRoot, profile, [result], [], options.session);
    };
    const results = await runCommands(commands, runnerOptions);
    return outputEnvelope(command, {
      generators: results.map((result) => ({
        id: result.command.id,
        argv: result.command.argv,
        dryRun: result.dryRun,
        stdout: options.json ? result.stdout : undefined,
        stderr: options.json ? result.stderr : undefined,
      })),
    });
  }

  if (command === "compose") {
    const jobs = options.jobs === undefined ? profile.sync.jobs : Number(options.jobs);
    if (!Number.isInteger(jobs) || jobs < 4) {
      throw new LeinoError(
        "compose-parallel-invalid",
        "compose --jobs must be an integer >= 4",
        { exitCode: EXIT_CODES.usage },
      );
    }
    const composeArgs = positionals.slice(1);
    if (composeArgs.some((entry) => entry === "--parallel" || entry.startsWith("--parallel="))) {
      throw new LeinoError(
        "compose-parallel-duplicate",
        "leinoctl owns the single Docker Compose --parallel option",
        { exitCode: EXIT_CODES.usage },
      );
    }
    const commandSpec = {
      id: "compose",
      cwd: ".",
      argv: [
        "docker",
        "compose",
        "--parallel",
        String(jobs),
        ...profile.composeFiles.flatMap((file) => ["-f", file]),
        ...composeArgs,
      ],
    };
    const results = await runCommands([commandSpec], commandRunnerOptions(repoRoot, options));
    return outputEnvelope(command, {
      commands: results.map((result) => ({
        id: result.command.id,
        argv: result.command.argv,
        dryRun: result.dryRun,
        stdout: options.json ? result.stdout : undefined,
        stderr: options.json ? result.stderr : undefined,
      })),
    });
  }

  if (command === "sync") {
    const jobs = options.jobs === undefined ? profile.sync.jobs : Number(options.jobs);
    const result = await syncRepository(repoRoot, {
      jobs,
      dryRun: options["dry-run"] === true,
      capture: options.json === true,
      onStart: commandRunnerOptions(repoRoot, options).onStart,
    });
    return outputEnvelope(command, {
      commands: result.results.map((entry) => ({
        id: entry.command.id,
        argv: entry.command.argv,
        dryRun: entry.dryRun,
        stdout: options.json ? entry.stdout : undefined,
        stderr: options.json ? entry.stderr : undefined,
      })),
    });
  }

  throw new LeinoError(
    "command-unknown",
    `unknown command: ${positionals.join(" ") || "<missing>"}`,
    { exitCode: EXIT_CODES.usage },
  );
}

function canonicalCommand(positionals, options) {
  if (options.help || !positionals.length || positionals[0] === "help") {
    return "help";
  }
  if (positionals[0] === "plan" && positionals[1] === "relevant") {
    return "plan-relevant";
  }
  if (positionals[0] === "plan" && positionals[1] === "select") {
    return "plan-select";
  }
  if (positionals[0] === "plan" && positionals[1] === "claim") {
    return "plan-claim";
  }
  if (positionals[0] === "plan" && positionals[1] === "release") {
    return "plan-release";
  }
  if (positionals[0] === "plan" && positionals[1] === "create") {
    return "plan-create";
  }
  if (positionals[0] === "active-plans" && options.relevant) {
    return "plan-relevant";
  }
  return positionals[0];
}

export async function main(argv, {
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let options = {
    json: argv.some((token) => token === "--json"),
  };
  let command = "unknown";
  try {
    const parsed = parseArguments(argv);
    options = parsed.options;
    command = canonicalCommand(parsed.positionals, options);
    if (command === "help") {
      writeOutput(outputEnvelope("help", helpText()), { json: options.json, stream: stdout });
      return EXIT_CODES.ok;
    }
    validateInvocation(command, parsed.positionals, options);
    const context = loadContext(options, {
      includeRegistry: !["context", "plan-relevant"].includes(command),
    });
    const envelope = await execute(command, parsed.positionals, options, context);
    writeOutput(envelope, { json: options.json, stream: stdout });
    return envelope.ok ? EXIT_CODES.ok : EXIT_CODES.policy;
  } catch (error) {
    const failure = asLeinoError(error);
    writeOutput(outputEnvelope(command, null, {
      ok: false,
      errors: [failure.message, ...failure.details],
    }), { json: options.json, stream: stderr });
    return failure.exitCode;
  }
}
