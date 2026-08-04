# PLAN: agent runtime and toolchain hardening

- **Plan ID:** `20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening`
- **Статус:** awaiting_approval
- **Создан:** 2026-08-04 13:40:01 UTC
- **Обновлён:** 2026-08-04 17:20 MSK
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260803T111613Z-1cf94f-agent-delegation-planning-workflow`.
- **Блокирует:** `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration`
- **Связанные ADR/handoff:** `docs/agents/HARNESS.md`,
  `docs/agents/DELEGATION.md`, существующий parallel-worktree plan

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "AGENTS.md",
    "frontend/AGENTS.md",
    ".codex/config.toml",
    ".codex/agents/explorer.toml",
    ".codex/agents/terra-explorer.toml",
    ".codex/hooks/lib/delegation.mjs",
    ".codex/hooks/session-start.mjs",
    ".codex/hooks/test/configuration.test.mjs",
    ".codex/hooks/test/delegation.test.mjs",
    ".leino/profile.json",
    ".leino/components/repository-workflow.json",
    ".agents/skills/repository-workflow-change/SKILL.md",
    "tools/leinoctl/src/cli.mjs",
    "tools/leinoctl/src/profile.mjs",
    "tools/leinoctl/src/runner.mjs",
    "tools/leinoctl/src/session.mjs",
    "tools/leinoctl/src/toolchain.mjs",
    "tools/leinoctl/test/cli.test.mjs",
    "tools/leinoctl/test/profile.test.mjs",
    "tools/leinoctl/test/runner.test.mjs",
    "tools/leinoctl/test/schema.test.mjs",
    "tools/leinoctl/test/session.test.mjs",
    "tools/leinoctl/test/toolchain.test.mjs",
    "tools/leinoctl/schema/profile.schema.json",
    "docs/agents/HARNESS.md",
    "docs/agents/DELEGATION.md",
    "docs/agents/plans/_template.md",
    "docs/agents/plans/active/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md",
    "docs/agents/plans/active/20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening.md",
    "docs/agents/plans/archive/20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening.md"
  ],
  "components": ["repository-workflow"],
  "contracts": [
    "codex:read-only-subagent-routing-policy-v1",
    "leinoctl:transitive-toolchain-environment-v1"
  ],
  "dependsOn": [
    "20260803T111613Z-1cf94f-agent-delegation-planning-workflow"
  ],
  "sharedResources": [
    "repository:harness-policy",
    "repository:plan-authoring-contract",
    "codex:local-subagent-runtime",
    "local:toolchain-binding"
  ]
}
```

## Цель

Устранить два воспроизведённых local-runtime gap до реализации write workers:
canonical checks получают один verified toolchain не только для `argv[0]`, но
и для вложенных workspace subprocesses, а planning delegation явно запрашивает
model/effort и после распознанной недоступности Luna использует только named
read-only Terra fallback. Actual-model observation не подменяется config-тестом
и остаётся non-gating, пока runtime не предоставит поддерживаемый callback.

## Критерии приёмки

- [ ] Каждый canonical verify строит и version-validates immutable binding до
      первого check из repository profile: generic core не содержит имён
      проектов, manifest paths или project-specific version constants.
- [ ] Exact package-manager pin вычисляется через profile-declared authoritative
      version source. Для Munchkin это `frontend/package.json#packageManager`,
      но другой repository может объявить собственный manifest/source без
      изменения leinoctl core. Resolver принимает только candidate, совпавший с
      вычисленным manager name и exact version, и ничего не скачивает.
- [ ] После успешного resolution leinoctl формирует bounded process environment,
      в котором верхний command запускается по absolute path, а child/grandchild
      lookup имени `pnpm` получает тот же вычисленный exact executable через verified runtime
      overlay без ручного shim, global PATH mutation или implicit install.
- [ ] PATH overlay совместим с POSIX и Windows `.cmd`/`.bat`, injected platform
      path semantics и paths with spaces. Унаследованные `npm_execpath`/
      `npm_node_execpath` scrubbed как недоверенная metadata; generic core не
      выдаёт launcher path за pnpm CLI entry.
- [ ] Profile schema разделяет exact manifest-derived requirements и обычные
      minimum-version requirements. Смена authoritative manifest value меняет
      binding fingerprint и делает старую verification evidence incomplete.
- [ ] Root verify и будущий worker adapter используют один environment builder;
      session ledger сохраняет только toolchain fingerprint, а scope freshness
      считает check incomplete при missing/stale binding до продолжения lifecycle.
- [ ] Routing evidence различает configured route, explicit requested
      model/effort, exact spawn outcome и fallback decision без копирования raw
      JSONL; произвольный local rollout-файл не считается trusted evidence.
- [ ] Luna failure никогда не падает в writable `default`/`worker`: fallback —
      named Terra explorer с `sandbox_mode = "read-only"`, затем root.
- [ ] Delegation hook требует explicit model и reasoning effort даже для named
      profile; global default безопасно указывает на Terra. Actual model может
      быть записана только как non-gating observation из поддерживаемой runtime
      metadata, связанной с конкретным spawn; missing/unknown source не разрешает
      никакой будущий write route.
- [ ] Focused fixtures и canonical verify подтверждают nested pinned-pnpm
      execution; новая trusted session вынесена в post-commit activation handoff,
      потому что текущая session не может доказать загрузку новых hooks/config.
- [ ] Parallel-worktree plan зависит от этого plan и переиспользует готовые
      routing/toolchain contracts без дублирования implementation scope.

## Контекст и подтверждённое состояние

- После frontend closeout worktree clean на commit `7e296c0`; frontend plan
  archived, `./leinoctl preflight` проходит с единственным toolchain warning.
- Clean-checkout preflight воспроизводит unset
  `pnpm@env:LEINO_PNPM_EXECUTABLE`; при переданном pinned runner верхний pnpm
  стартует, но `frontend/package.json` повторно вызывает имя `pnpm`, отсутствующее
  в PATH bundled runtime.
- `runCommand` разрешает только верхний executable и передаёт исходный `env`
  без verified toolchain overlay; существующий тест доказывает direct resolver,
  но не child/grandchild inheritance.
- `verify` вызывает `runCommands` напрямую и не вызывает `inspectToolchain`;
  minimum version сейчас проверяется preflight-инспекцией, но не execution gate.
- Current resolver использует host `path.delimiter` даже при injected Windows
  platform, поэтому часть cross-platform unit fixtures даёт ложную уверенность.
- В отдельной frontend session named Luna explorer был отклонён runtime ошибкой
  `Unknown model gpt-5.6-luna`, после чего ручной fallback использовал Terra
  через general-purpose profile. Общий model catalog при этом Luna показывал.
- Existing worktree plan уже декларирует toolchain binding, но не закрепляет
  transitive subprocess lookup и не чинит текущий read-only spawn path.
- На clean checkout `codex-cli 0.146.0-alpha.9.2` одновременно показывает Luna
  в model catalog, оставляет `multi_agent_v2` выключенным и печатает
  `could not create PATH aliases: Operation not permitted`; catalog/feature
  flags не являются доказательством executable или subagent launch capability.
- Два preferred/implicit spawn вызова в этой planning session были отклонены
  как Luna; только `agent_type=reviewer` плюс explicit Terra/high создал child.
  Child `session_meta.source.subagent.thread_spawn` связал parent thread и
  agent path, а `turn_context` подтвердил actual `gpt-5.6-terra`.

## Scope

### Входит

- Generic leinoctl environment builder, resolver/binding fingerprint и tests.
- Generic profile-driven version requirements: exact package-manager versions
  из declared manifest source и minimum versions из repository policy; no
  repository dependency changes.
- Named read-only Terra fallback, explicit request policy и bounded sanitized
  spawn-outcome evidence; без unsupported runtime-log parser.
- Planning/execution delegation documentation и downstream plan dependency.

### Не входит

- Write subagents, Git worktree creation, checkpoint/recovery и integration.
- Patch/fork Codex runtime либо обещание поддержки undocumented V2 flags.
- Dependency install, package-manager upgrade, lockfile или product changes.
- Full raw rollout retention, cross-machine telemetry или usage billing system.

## Архитектурный подход

- Toolchain resolution возвращает не только launch path, но и sanitized
  transitive environment overlay. Overlay создаётся в ignored runtime/temp
  location из уже проверенных executables и наследуется всеми descendants.
- Binding содержит profile declaration, authoritative source identity/digest,
  вычисленное version requirement, real path, version result, platform и
  executable/launcher identity digest. Он
  пересобирается до execution; ledger хранит только fingerprint, не absolute paths.
- Overlay публикует только verified aliases для инструментов из binding вместо
  добавления целого родительского bin directory. Direct command по-прежнему
  запускается absolute path; hostile original PATH остаётся после overlay.
- Agent routing не доверяет одному named profile: каждый spawn явно передаёт
  model и effort; recognized Luna-unavailable outcome ведёт к explicit named
  read-only Terra, затем к root. Любой другой/неизвестный outcome fail-closed.
- Durable evidence ограничено requested route, tool outcome/failure class,
  fallback decision, surface/version и config/profile digest. Actual child model
  является только non-gating observation, если Codex когда-либо отдаст её через
  поддерживаемый correlated callback; repository не парсит произвольные JSONL.
- Current plan остаётся небольшим prerequisite; worktree orchestration потребляет
  его contracts и сосредотачивается на isolated writes/recovery/integration.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| leinoctl generic core | Transitive tool environment и ledger freshness | additive internal toolchain contract |
| Codex project profiles | Safe Luna/Terra read-only routing | project-local agent profiles/config |
| repository workflow docs | Execution delegation/fallback/evidence contract | plan authoring and trusted-session workflow |
| downstream worktree plan | Dependency/scope refinement | no implementation in this plan |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/plans/active/20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening.md` | write | Archived lifecycle плана |
| `tools/leinoctl/src/{cli,profile,runner,session,toolchain}.mjs` | write | Generic toolchain execution and ledger implementation |
| `tools/leinoctl/test/{cli,profile,runner,schema,session,toolchain}.test.mjs` | write | Cross-platform, freshness and fail-closed regressions |
| `tools/leinoctl/schema/profile.schema.json` | write | Exact-pin/resolver policy schema |
| `.codex/{config.toml,agents/*,hooks/session-start.mjs,hooks/test/configuration.test.mjs}` | write | Read-only routing and trusted-session guidance |
| `.codex/hooks/lib/delegation.mjs` | write | Require explicit safe routing despite profile/runtime drift |
| `.codex/hooks/test/delegation.test.mjs` | write | Routing/fallback validation regressions |
| `.leino/{profile.json,components/repository-workflow.json}` | write | Repository policy/check registration |
| `AGENTS.md` | write | Durable delegation/runtime rules |
| `frontend/AGENTS.md` | write | Canonical frontend toolchain environment rule |
| `.agents/skills/repository-workflow-change/SKILL.md` | write | Workflow planning/verification rule |
| `docs/agents/HARNESS.md` | write | Operator toolchain/routing contract |
| `docs/agents/DELEGATION.md` | write | Safe runtime fallback/evidence contract |
| `docs/agents/plans/_template.md` | write | Plan routing/evidence fields |
| `docs/agents/plans/active/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md` | write | Add dependency and remove duplicated prerequisite scope |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `repository:harness-policy` | completed delegation plan; worktree plan | exclusive | this prerequisite before worktree plan |
| `repository:plan-authoring-contract` | completed delegation plan; worktree plan | this plan | additive routing/evidence fields first |
| `codex:local-subagent-runtime` | all local planning sessions | this plan | explicit read-only routing/fallback only |
| `local:toolchain-binding` | canonical checks; future workers | leinoctl | one fingerprinted binding, serialized refresh |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-04 after frontend archive/commit;
  `leinoctl context` and manifests for repository-workflow scope.
- **Обнаруженные пересечения:** exact harness/docs/toolchain overlap with
  `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration`, which is
  still awaiting approval; infrastructure drafts do not own these paths now.
- **Решение:** this plan becomes a direct prerequisite and owns routing plus
  transitive toolchain contracts first. During implementation, before downstream
  approval, its manifest `dependsOn` gains this exact plan ID; its owned contract
  `leinoctl:workspace-toolchain-binding-v1`, `src/toolchain.mjs` and matching test
  ownership are removed and replaced by consumption of
  `leinoctl:transitive-toolchain-environment-v1`. Its toolchain goal, acceptance
  bullets and step 2 become worker-adapter consumption/inheritance tests only;
  resolution, pins, overlay, profile/schema and ledger freshness remain owned
  exclusively here. No concurrent implementation.

## Delegation strategy

- **Classification:** large — planning delegation required.
- **Причина:** два независимых runtime workstream, cross-platform process
  semantics и safety-sensitive fallback profile require independent evidence.
- **Root parallel work:** root resolves plan conflicts, contract boundaries,
  downstream dependency and acceptance/verification design.
- **Write boundary:** delegated `write_set: []`; all repository writes remain
  root-only pending worktree orchestration.

### Preliminary work packages

- **Package / role / model / effort:** transitive-toolchain-audit / explorer /
  Luna / high.
  **Bounded scope:** `tools/leinoctl/src/{runner,toolchain,cli}.mjs`, direct tests,
  `.leino/profile.json`, `frontend/package.json`; `fork_turns: none`.
  **Independent from:** does not inspect agent routing or plan conflicts.
  **Access / write set:** read-only / `[]`.
  **Expected output:** exact missing inheritance paths, portable design and
  regression matrix with file evidence.
  **Stop condition:** return findings without edits or dependency execution.
  **Root parallel work:** route/dependency/write-set synthesis.
  **Expected savings:** avoids loading process/platform edge cases into root
  while the plan contract is drafted.
- **Package / role / model / effort:** subagent-runtime-routing-audit / explorer /
  Luna / high.
  **Bounded scope:** `.codex/config.toml`, `.codex/agents/*.toml`, configuration
  tests, relevant sanitized local rollout evidence and current Codex capabilities;
  `fork_turns: none`.
  **Independent from:** does not inspect pnpm/process environment.
  **Access / write set:** read-only / `[]`.
  **Expected output:** requested-vs-actual routing gap, safe fallback/probe and
  tests with paths; no raw logs in plan.
  **Stop condition:** stop on unknown schema after reporting bounded uncertainty.
  **Root parallel work:** conflict scan and architecture/verification synthesis.
  **Expected savings:** parallelizes unstable-runtime evidence and prevents
  config-only assumptions.

### Actual delegation evidence

| Package | Result | Evidence/findings | Влияние на plan |
|---|---|---|---|
| transitive-toolchain-audit | completed via explicit Terra read-only fallback | Direct absolute resolver is non-transitive; verify skips version gate; current tests miss descendants/hostile PATH; injected Windows delimiter is wrong | Require exact binding before verify, verified alias overlay, scrub inherited npm metadata and add POSIX/Windows descendant/staleness tests |
| subagent-runtime-routing-audit | completed via explicit Terra read-only fallback | Preferred Luna and implicit reviewer both resolved to unavailable Luna; explicit reviewer+Terra succeeded. Static config tests do not prove actual child model; no Terra explorer exists | Add Terra explorer, explicit model/effort hook rule, safe default and sanitized requested-route/outcome/fallback evidence; keep actual model non-gating without supported runtime source |
| adversarial-review | completed via explicit Terra read-only reviewer | Found missing session-ledger/schema/runner scope, unsupported trusted actual-model capture, ambiguous downstream ownership, invalid post-archive acceptance order and optimistic estimate | Add session/schema/runner scope; downgrade actual model to supported-source-only non-gating observation; define exact downstream handoff; make fresh-session smoke post-commit activation; re-estimate |

## План реализации

1. [ ] Implement generic profile-declared version-source parsing and binding
       discovery/validation from derived manifest pin, explicit candidate,
       current runtime/bundle and existing cache. Munchkin profile points to its
       frontend manifest; generic core contains no Munchkin path or version.
2. [ ] Build a fingerprinted ignored alias overlay and cloned descendant env;
       keep absolute outer launch and scrub hostile inherited npm metadata.
3. [ ] Make verify require the validated binding and include its fingerprint in
       normalized session checks/key/freshness; unknown/stale binding makes the
       recorded check incomplete and fails before a new check starts.
4. [ ] Add POSIX/Windows child/grandchild, hostile PATH/node/pnpm, spaces,
       wrong-version, missing-overlay and stale-binding tests. Add injected
       platform/path semantics through resolver, overlay and runner dispatch.
5. [ ] Add named Terra read-only fallback, safe global default and explicit
       model/effort requirement in delegation validation.
6. [ ] Define sanitized requested-route/outcome/fallback evidence; accept actual
       model only from a future supported correlated runtime source and never
       parse arbitrary session JSONL as an enforcement signal.
7. [ ] Update delegation/session/docs/template and apply the exact downstream
       dependency/ownership handoff described above.
8. [ ] Run focused tests and canonical lifecycle checks, then complete,
       archive, release and create one local commit.
9. [ ] Publish a post-commit fresh-session activation handoff for bounded routing
       and nested-pnpm smoke; a failure opens a follow-up plan and does not mutate
       the archived prerequisite.

## Проверки

- [ ] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs`
- [ ] `(cd tools/leinoctl && node --test)`
- [ ] focused nested pnpm plus routing config/delegation fixture tests
- [ ] wrong-version declared env fails before check despite executable existence
- [ ] fixture repositories with different package-manager pins resolve their own
      versions without a core change; changing the manifest invalidates old evidence
- [ ] hostile PATH cannot replace bound node/pnpm in child or grandchild
- [ ] injected Windows path/PATHEXT and spaces fixture plus native CI-compatible test
- [ ] routing fixture records explicit requested model/effort, recognized failure
      class and Terra/root fallback without treating config or arbitrary JSONL as actual model
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl preflight`
- [ ] `./leinoctl text-check --changed`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening`
- [ ] post-commit handoff names the new trusted-session live smoke; it is activation
      evidence, not a completion gate executable by the current session

## Риски и откат

- **Риск:** PATH overlay silently selects an unintended executable.
  **Митигация:** generate aliases only from version-validated binding, keep
  direct absolute launch and test a hostile earlier PATH.
- **Риск:** rollout/runtime schema changes or Luna availability differs by
  client surface. **Митигация:** only requested route and spawn outcome are
  gating; actual model is non-gating without a supported correlated callback,
  and unknown outcomes route to root, never writable default.
- **Риск:** prerequisite duplicates the large worktree plan. **Митигация:**
  make the dependency explicit and remove overlapping implementation there
  before either approval.
- **Откат:** revert the isolated harness commit; remove only ignored generated
  overlay after confirming no process uses it. Existing root-only workflow remains.

## Открытые вопросы

- Whether the installed Codex runtime accepts the community V2 routing flags
  is live evidence, not an assumption; implementation must not depend on them.

## Оценка времени

- **Реалистично:** 14–22 инженерных часа, обычно 2–4 рабочих дня.
- **Разбивка:** exact binding/overlay/version gate 5–8 ч; ledger/profile/schema
  integration 3–5 ч; routing policy/fallback 2–3 ч; cross-platform tests,
  downstream handoff, docs и lifecycle 4–6 ч.
- **Не включено:** ожидание model rollout, patch Codex runtime, dependency
  download и write-worktree orchestration.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-08-04 13:40:01 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** fix recurring bundled-runtime
  resolver/shim failures systemically after frontend plan completion; derive
  project tool versions from repository-declared sources rather than hardcode
  Munchkin values in the harness; also harden earlier Luna subagent routing
  issue, without write agents yet.

## Ход выполнения

- Draft создан атомарно; реализация не начата.

## Итог

Заполняется после реализации.
