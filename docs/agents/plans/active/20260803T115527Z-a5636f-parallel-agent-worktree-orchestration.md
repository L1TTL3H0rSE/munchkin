# PLAN: parallel agent worktree orchestration

- **Plan ID:** `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration`
- **Статус:** awaiting_approval
- **Создан:** 2026-08-03 11:55:27 UTC
- **Обновлён:** 2026-08-04 17:20 MSK
- **Владелец:** Codex
- **Workspace:** controller checkout + isolated linked worktrees under `.leino/runtime/worktrees/`
- **Ветка:** `codex/frontend-remaining-plans`
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260803T111613Z-1cf94f-agent-delegation-planning-workflow`, `20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening`.
- **Блокирует:** безопасные parallel Luna writers и restart/recovery workflow
- **Связанные ADR/handoff:** новый `docs/agents/decisions/0010-parallel-agent-worktree-orchestration.md`,
  `docs/agents/HARNESS.md`, `docs/agents/DELEGATION.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "AGENTS.md",
    ".codex/config.toml",
    ".codex/agents/worker.toml",
    ".codex/hooks.json",
    ".codex/hooks/lib/policy.mjs",
    ".codex/hooks/lib/worker-policy.mjs",
    ".codex/hooks/pre-tool-use.mjs",
    ".codex/hooks/post-tool-use.mjs",
    ".codex/hooks/session-start.mjs",
    ".codex/hooks/stop.mjs",
    ".codex/hooks/test/configuration.test.mjs",
    ".codex/hooks/test/policy.test.mjs",
    ".codex/hooks/test/stop-policy.test.mjs",
    ".codex/hooks/test/worker-policy.test.mjs",
    ".leino/profile.json",
    ".leino/components/repository-workflow.json",
    ".agents/skills/backend-game-change/SKILL.md",
    ".agents/skills/content-pack-change/SKILL.md",
    ".agents/skills/frontend-game-change/SKILL.md",
    ".agents/skills/repository-workflow-change/SKILL.md",
    "tools/leinoctl/src/cli.mjs",
    "tools/leinoctl/src/git.mjs",
    "tools/leinoctl/src/index.mjs",
    "tools/leinoctl/src/profile.mjs",
    "tools/leinoctl/src/session.mjs",
    "tools/leinoctl/src/delegations.mjs",
    "tools/leinoctl/src/worktrees.mjs",
    "tools/leinoctl/src/workers.mjs",
    "tools/leinoctl/test/cli.test.mjs",
    "tools/leinoctl/test/git.test.mjs",
    "tools/leinoctl/test/profile.test.mjs",
    "tools/leinoctl/test/schema.test.mjs",
    "tools/leinoctl/test/session.test.mjs",
    "tools/leinoctl/test/delegations.test.mjs",
    "tools/leinoctl/test/worktrees.test.mjs",
    "tools/leinoctl/test/workers.test.mjs",
    "docs/agents/README.md",
    "docs/agents/HARNESS.md",
    "docs/agents/DELEGATION.md",
    "docs/agents/decisions/0010-parallel-agent-worktree-orchestration.md",
    "docs/agents/plans/README.md",
    "docs/agents/plans/_template.md",
    "docs/agents/plans/active/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md",
    "docs/agents/plans/archive/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md"
  ],
  "components": ["repository-workflow"],
  "contracts": [
    "codex:parallel-worktree-workers-v1",
    "leinoctl:delegation-registry-v1",
    "leinoctl:worker-recovery-v1",
    "leinoctl:transitive-toolchain-environment-v1"
  ],
  "dependsOn": [
    "20260803T111613Z-1cf94f-agent-delegation-planning-workflow",
    "20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening"
  ],
  "sharedResources": [
    "repository:harness-policy",
    "repository:plan-authoring-contract",
    "git:linked-worktrees",
    "codex:worker-session-runtime",
    "local:delegation-runtime-registry"
  ]
}
```

## Цель

Добавить в leinoctl устойчивый local orchestrator, который из одобренной
plan delegation map создаёт независимые Git worktrees, запускает в них bounded
Luna workers через сохраняемые `codex exec -C` sessions, допускает параллельную
работу только для совместимых write sets/shared resources, а затем безопасно
восстанавливает, проверяет и интегрирует результаты под authority root/Sol.

Потеря сети, завершение Codex или падение controller не должны уничтожать
локальный результат либо требовать памяти прежнего agent: branch, worktree,
package contract, session ID, process state, diff/checkpoint и integration
status восстанавливаются из Git и `.leino/runtime`.

Root toolchain binding и transitive environment создаёт prerequisite plan.
Этот plan не реализует второй resolver: worker adapter потребляет тот же
validated binding/fingerprint и передаёт готовый environment в каждый worktree.

## Критерии приёмки

- [ ] Capability preflight проверяет конкретный local Codex CLI: `codex exec
      -C`, persistent session JSON event с session ID и `codex exec resume`.
      Отсутствующая/изменённая capability блокирует worker launch до записи.
- [ ] Fan-out разрешён только от pinned base commit. Controller может иметь
      только ожидаемые lifecycle-файлы из selected-plan baseline; произвольный
      dirty product/config state не коммитится и не переносится автоматически.
- [ ] Каждый package фиксирует immutable ID, plan ID, base commit, branch,
      worktree path, model/profile, exact write-set subset, shared resources,
      dependencies, checks, stop condition и integration order.
- [ ] `leinoctl delegation prepare` проверяет dependency graph, write-set и
      shared-resource intersections. Пересекающиеся либо зависимые writers
      сериализуются; параллельно запускаются только независимые packages.
- [ ] Worktrees создаются атомарно под `.leino/runtime/worktrees/<package-id>`
      на уникальных temporary branches от одного base commit. Worker получает
      этот каталог как primary `-C`/sandbox root без writable controller path.
- [ ] Repository-owned worker adapter запускает bounded `codex exec -C` с Luna,
      `workspace-write`, проверенными project hooks и сохранением session ID;
      raw model/tool JSONL и secrets не становятся durable registry content.
- [ ] Worker adapter принимает только validated binding/environment contract
      prerequisite plan и не выполняет собственный resolver, package-manager
      pin discovery либо implicit install.
- [ ] Каждый worker launch сверяет prerequisite binding fingerprint, наследует
      его verified aliases для child/grandchild commands и fail-closed останавливается
      при missing/stale binding до запуска Codex worker.
- [ ] Worker hooks разрешают изменения только delegated subset и блокируют plan
      approval/select/status/archive/release, push, cloud mutations, dependency
      install, snapshot refresh и writes в controller/чужой worktree.
- [ ] Durable registry использует atomic writes/locks и состояния
      `prepared|running|orphaned|checkpointed|completed|integrated|cleaned|failed`,
      хранит bounded heartbeat/PID/session/commit/evidence metadata и переживает
      restart controller process.
- [ ] Worker не создаёт integration commit самостоятельно. После остановки
      supervisor сверяет base/HEAD/diff/write set/UTF-8, запускает package checks
      и только затем создаёт recoverable checkpoint commit в temporary branch.
- [ ] `delegation recover` сверяет registry с `git worktree list --porcelain`,
      process liveness, branch HEAD и dirty state; completed commit принимается
      без перезапуска, dirty worktree продолжается через saved session либо новый
      recovery agent, а неоднозначное состояние fail-closed не очищается.
- [ ] Resume предпочитает exact saved Codex session. Если session недоступна,
      replacement worker получает plan package, current diff, checkpoint и
      remaining criteria; корректность не зависит от скрытого reasoning старого
      agent и повторный запуск не дублирует уже интегрированную работу.
- [ ] `delegation integrate` сначала повторно валидирует package commit и
      dependency order, затем применяет commit в controller как контролируемый
      fast-forward/cherry-pick transition. Merge conflict не разрешается
      автоматически и переводит package в explicit failed/attention state.
- [ ] После интеграции root выполняет общий diff review, canonical `verify` и
      `scope-check`; worker checks не заменяют root session ledger/evidence.
- [ ] Cleanup удаляет только clean integrated worktree; branch/checkpoint
      сохраняется до доказанной достижимости результата из controller history.
      Dirty/orphaned/ambiguous worktree автоматически не удаляется.
- [ ] Unit/integration tests покрывают macOS/Windows paths, process interruption,
      network-like worker exit, stale PID, missing session, dirty recovery,
      duplicate start, conflicting packages, partial integration и cleanup.
- [ ] После изменения CLI/hooks/config выполнен handoff и новая trusted session;
      один controlled live smoke доказывает two-worktree parallel launch,
      interruption одного worker, recovery и последующую clean integration.

## Контекст и подтверждённое состояние

- Git linked worktrees предоставляют отдельные directories/index/branches при
  общем object store; незакоммиченные изменения одного worktree не появляются
  в другом и требуют явной integration.
- Текущий встроенный `spawn_agent` не принимает `cwd`/worktree binding и agents
  разделяют рабочую директорию, поэтому он остаётся read-only lane.
- Local `codex-cli 0.145.0-alpha.27` 2026-08-03 предоставляет `codex exec -C
  <DIR>`, `--sandbox workspace-write`, `--json` и `codex exec resume
  <SESSION_ID>`; это делает repository-owned worker adapter реализуемым без
  форка Codex, но alpha capability требует runtime probe и fail-closed fallback.
- Codex hook schema не документирует `agent_id` для PreToolUse/PostToolUse.
  В этой архитектуре authority определяется isolated worktree + package env/
  runtime record, а не shared-worktree actor identity.
- Current leinoctl связывает selected plan и lifecycle ownership с root session
  в `.leino/runtime/sessions`; смена branch/worktree не создаёт новый plan
  owner. Worker поэтому получает delegated package authority и никогда не
  выбирает root plan самостоятельно.
- Existing Git/session core уже умеет snapshot, dirty fingerprints, atomic
  session ledger locks и fast-forward path accounting; новые worktree/package
  primitives должны переиспользовать их, не создавать второй plan parser.
- `.leino/runtime` ignored и локален: он подходит для restart на том же диске,
  но не является cross-machine recovery. Temporary commits сохраняют файловый
  snapshot; remote backup требует отдельного явного push permission.
- Prerequisite runtime/toolchain plan вычисляет project requirements из profile-
  declared authoritative sources, строит transitive environment и связывает его
  fingerprint с verification ledger. Поэтому этот plan должен только подключить
  готовый contract к worker launcher и проверить inheritance в worktrees.
- Direct delegation dependency вводит delegation map/model routing и оставляет
  writes у root, поэтому этот plan не поддерживает две конкурирующие write policies.

## Scope

### Входит

- Repository-owned worktree/worker orchestrator в generic leinoctl core.
- Profile-level limits и Munchkin policy: default `maxWorkers = 2`, hard cap 3.
- Clean/pinned base preflight и разрешённая lifecycle-only controller dirtiness.
- Package DAG, exact write-set/shared-resource partition и integration order.
- `prepare`, `start`, `status`, `recover`, `resume`, `integrate`, `cleanup` CLI.
- Atomic local registry, process/session metadata, checkpoint and crash recovery.
- Consumption готового prerequisite toolchain binding/environment во всех
  worktrees без второго resolver или tracked machine-specific absolute paths.
- `codex exec -C` launch adapter с persisted sessions, bounded output и hooks.
- Worker-specific Pre/Post/Stop policy и root-owned integration verification.
- Temporary branches/checkpoint commits и safe cleanup semantics.
- Документация, ADR, plan template/skills и cross-platform regression tests.

### Не входит

- Патч или fork Codex runtime, изменение built-in `spawn_agent` API либо
  предположение, что будущая alpha CLI schema останется неизменной.
- Параллельные writers с пересекающимися write sets/shared resources.
- Автоматический перенос/commit произвольного dirty user state в worker base.
- Автоматическое разрешение merge conflicts, rebase/force push или удаление
  dirty/orphaned worktree/branch.
- Remote/cloud worker fleet, shared database/registry, cross-machine recovery,
  автоматический push/PR и backup временных branches.
- Secrets, bearer tokens, полные transcripts либо raw JSONL в registry/logs.
- Implicit download/install package managers, смена repository pnpm pin вслед
  за Codex bundle и hardcoded user/cache paths в tracked files.
- Product/backend/frontend/content changes, кроме test fixtures harness core.

## Архитектурный подход

- **Controller authority:** выбранный plan, approval, root ledger, integration,
  canonical verification и lifecycle остаются в root/Sol session.
- **Package authority:** worker получает immutable capability document для
  одного plan package и отдельный filesystem root. Оно не является plan
  ownership и не разрешает lifecycle или external mutations.
- **Launcher boundary:** generic adapter формирует argv/environment и запускает
  `codex exec -C <worktree> --model gpt-5.6-luna --sandbox workspace-write
  --json`; hooks trust bypass допускается только после проверки hook/config
  digest against pinned base, иначе launch останавливается.
- **Toolchain boundary:** prerequisite generic core уже проверяет repository-
  declared requirements и создаёт local binding/environment. Worker adapter
  принимает этот contract, проверяет fingerprint freshness и передаёт готовый
  environment descendants; он не переопределяет discovery или version policy.
- **Durable state:** registry source of truth — atomic JSON + Git inspection;
  PID/heartbeat и Codex session ID являются hints. При расхождении filesystem/
  branch/diff имеют приоритет, а automation не удаляет данные.
- **Recovery:** saved session возобновляется из worktree cwd; при невозможности
  новый worker получает deterministic recovery prompt. Наличие checkpoint или
  dirty diff определяет продолжение, не старый conversational context.
- **Integration:** supervisor materializes checkpoint commit после validation;
  root применяет packages только в dependency order. Любой conflict или scope
  drift требует root review и при material change повторного approval.
- **Portability:** process creation, quoting, termination и path comparison не
  используют shell strings; Windows `.cmd`/signals и POSIX termination имеют
  отдельные adapters/tests.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| leinoctl generic core | worktree, package registry, process/recovery/integration commands | `leinoctl:delegation-registry-v1`, `leinoctl:worker-recovery-v1` |
| toolchain consumer | prerequisite binding freshness and worker inheritance | consumes `leinoctl:transitive-toolchain-environment-v1` |
| Munchkin profile | concurrency/worktree root/launcher limits | additive profile schema |
| Codex hooks | package-scoped worker authority | `codex:parallel-worktree-workers-v1` |
| plan authoring | executable package DAG and recovery fields | template/docs; manifest v1 сохраняется |
| Git history | temporary worker branches/checkpoints, root integration commits | local only; no push |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `AGENTS.md` | write | Replace root-only boundary with isolated worker contract |
| `.codex/config.toml` | write | Worker/concurrency capability defaults |
| `.codex/agents/worker.toml` | write | Luna bounded implementation profile |
| `.codex/hooks.json` | write | Worker lifecycle/policy dispatch configuration |
| `.codex/hooks/lib/policy.mjs` | write | Route root plan versus delegated package authority |
| `.codex/hooks/lib/worker-policy.mjs` | write | New package/worktree policy core |
| `.codex/hooks/pre-tool-use.mjs` | write | Exact worker target and forbidden-operation gate |
| `.codex/hooks/post-tool-use.mjs` | write | Worker target/evidence recording |
| `.codex/hooks/session-start.mjs` | write | Worker recovery context and capability checks |
| `.codex/hooks/stop.mjs` | write | Worker completion is package-scoped, not plan completion |
| `.codex/hooks/test/{configuration,policy,stop-policy,worker-policy}.test.mjs` | write | Harness regression matrix |
| `.leino/profile.json` | write | Worktree root, concurrency and Codex launcher profile |
| `.leino/components/repository-workflow.json` | write | New hook test registration/contracts |
| `.agents/skills/{backend-game-change,content-pack-change,frontend-game-change,repository-workflow-change}/SKILL.md` | write | Domain package partition/recovery guidance |
| `tools/leinoctl/src/{cli,git,index,profile,session}.mjs` | write | Extend generic delegation/Git/profile/session core and consume prerequisite environment |
| `tools/leinoctl/src/{delegations,worktrees,workers}.mjs` | write | New registry/worktree/launcher modules |
| `tools/leinoctl/test/{cli,git,profile,schema,session}.test.mjs` | write | Existing contract and worker-environment consumption regressions |
| `tools/leinoctl/test/{delegations,worktrees,workers}.test.mjs` | write | New lifecycle/recovery/integration tests |
| `docs/agents/{README,HARNESS,DELEGATION}.md` | write | Durable operator workflow and boundaries |
| `docs/agents/decisions/0010-parallel-agent-worktree-orchestration.md` | write | Cross-cutting decision and rejected alternatives |
| `docs/agents/plans/{README,_template}.md` | write | Package DAG/base/recovery/evidence fields |
| `docs/agents/plans/active/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| `repository:harness-policy` | direct dependency; completed production live WIF predecessor | exclusive | direct dependency archive/release и отдельный commit перед select |
| `repository:plan-authoring-contract` | dependency plan | этот plan после dependency | additive package execution/recovery fields |
| `git:linked-worktrees` | все local Git operations | controller/root | unique branches/paths; no cleanup ambiguous state |
| `codex:worker-session-runtime` | local Codex session store | worker supervisor | exact saved session ID; no `--last` recovery |
| `local:delegation-runtime-registry` | root and workers | leinoctl atomic lock | ignored local state; one controller mutation at a time |

### Проверка конфликтов

- **Проверены active plans:** `./leinoctl context --paths ...`, current
  manifests, Codex CLI help/version и repository workflow sources, 2026-08-03.
- **Queue preflight:** declared count `2`, actual count `2`; exact order
  `20260803T111613Z-1cf94f-agent-delegation-planning-workflow` →
  `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration`; второй plan
  имеет direct `dependsOn` на первый, оба `awaiting_approval`, approval не записан.
- **Обнаруженные пересечения:** direct dependency владеет AGENTS/config/hooks/
  skills/docs surfaces: 13 exact paths и shared resources
  `repository:harness-policy`, `repository:plan-authoring-contract`.
  Archived completed production-live predecessor исторически менял
  `docs/agents/HARNESS.md`, `tools/leinoctl/src/{cli,git,session}.mjs` и tests.
- **Решение:** exact order
  `20260802T164112Z-dfb164-production-live-wif-registry-evidence` (`completed`) →
  `20260803T111613Z-1cf94f-agent-delegation-planning-workflow` →
  `20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening` →
  `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration`.
  Каждый plan проходит verify/scope-check/archive/release/local commit; новый
  select — только в fresh eligible session. Другие active plans не меняются.

## Delegation strategy

- **Classification:** large/high-risk repository workflow; implementation
  fan-out запрещён до появления worktree runner, чтобы plan не зависел от
  механизма, который сам создаёт.
- **Planning evidence:** root проверил current hook/session/Git core и local
  Codex CLI capability. После approval architecture slices могут получить
  read-only reviewers согласно completed dependency policy.
- **Implementation order:** generic registry/Git state machine → fake-process
  worker adapter/tests → repository hook/profile → controlled live smoke.
- **Authority:** root пишет bootstrap implementation либо использует только уже
  активированный predecessor read-only delegation. Этот plan не dogfoods
  write workers до post-commit trusted-session validation.

## План реализации

1. [ ] Зафиксировать ADR-0010 и capability contract/probe для exact Codex CLI
       launch/resume/JSON events; неизвестную версию блокировать fail-closed.
2. [ ] Подключить prerequisite transitive-toolchain environment к worker
       adapter: проверить fingerprint freshness и передать неизменный bounded env
       в Codex process и его descendants без повторного version discovery.
3. [ ] Расширить generic profile и CLI командами delegation lifecycle, сохранив
       repository-specific limits в `.leino/profile.json`.
4. [ ] Реализовать atomic package registry, locks, state transitions,
       heartbeat/process/session metadata и deterministic recovery audit.
5. [ ] Реализовать Git worktree/branch primitives, pinned-base/dirty preflight,
       DAG/conflict scheduling, checkpoint validation и safe cleanup.
6. [ ] Реализовать cross-platform Codex worker adapter с `-C`, exact session
       capture/resume, bounded concurrency/cancellation и sanitized evidence.
7. [ ] Добавить worker hook authority и запреты lifecycle/external/generated/
       dependency writes; root plan ownership/ledger не передавать.
8. [ ] Реализовать integrate path: revalidate package commit, dependency order,
       conflict stop, root fast-forward accounting и stale-evidence invalidation.
9. [ ] Добавить unit/integration tests с fake Codex processes и real temporary
       Git repositories для crash/recovery/conflict/cleanup matrix.
10. [ ] Обновить AGENTS, skills, HARNESS, DELEGATION и plan template/runbook.
11. [ ] Выполнить canonical checks, archive/release/local commit, начать новую
        trusted session и провести bounded live two-worker interruption/recovery
        smoke без push или product changes.

## Оценка времени

- **Реалистично:** 44–68 инженерных часов, ориентировочно 7–11 рабочих дней.
- **Разбивка:** capability/ADR/toolchain consumption 0.5–1 день; registry/worktrees 2–3 дня;
  launcher/recovery 2–3 дня; hooks/integration 1–2 дня; tests/docs/live smoke
  1.5–3 дня.
- **Резерв:** ещё 2–4 дня, если alpha Codex JSON/session semantics окажутся
  нестабильны и потребуется отдельный compatibility adapter.
- **Не включено:** ожидание dependencies/approval, model queue/network downtime,
  remote backup/push и platform fork.

## Проверки

- [ ] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs`
- [ ] `(cd tools/leinoctl && node --test)`
- [ ] focused temporary-repository tests: prepare/start/orphan/recover/integrate/cleanup
- [ ] fake-process tests for interrupt, stale PID, missing/invalid session ID and retry
- [ ] worker-environment tests: prerequisite fingerprint accepted, stale/missing
      binding rejected, and verified aliases inherited by child/grandchild commands
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl preflight`
- [ ] `./leinoctl text-check --changed`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260803T115527Z-a5636f-parallel-agent-worktree-orchestration`
- [ ] `git diff --check` и scoped diff/temporary-branch review
- [ ] New trusted-session live smoke: two disjoint Luna worktrees, interrupt one,
      exact-session resume or deterministic replacement, checkpoint, integrate,
      canonical verification and non-destructive cleanup

## Риски и откат

- **Риск:** alpha Codex CLI меняет JSON/session/flags. **Митигация:** capability
  probe, strict adapter versioning, no `--last`, fail-closed fallback to root.
- **Риск:** Codex bundle обновляет executable/version/path. **Митигация:**
  fingerprint + version revalidation, no tracked absolute cache paths, exact
  pnpm pin и fail-closed explicit bootstrap вместо silent substitution.
- **Риск:** dirty user files попадают в worker base. **Митигация:** pinned HEAD,
  lifecycle-only baseline exception, no automatic snapshot of arbitrary dirt.
- **Риск:** duplicate workers после restart. **Митигация:** registry lock,
  PID/heartbeat + filesystem inspection, exact session/package idempotency.
- **Риск:** потеря контекста agent. **Митигация:** immutable package contract,
  saved session ID, current diff/checkpoint и deterministic recovery prompt.
- **Риск:** concurrent packages скрыто делят resource. **Митигация:** declared
  sharedResources/DAG, intersection gate и serialization by default.
- **Риск:** worker обходит write set через shell. **Митигация:** isolated
  sandbox/worktree, worker hook policy, post-run full Git diff validation;
  harness остаётся guardrail, не security boundary.
- **Риск:** automatic cleanup уничтожает recovery data. **Митигация:** clean +
  integrated + reachable preconditions; branch сохраняется, ambiguous state
  требует root/user action.
- **Риск:** integration ломает controller history. **Митигация:** no rebase/
  force, explicit commit validation/order, conflict stop, canonical reverify.
- **Откат:** revert отдельного harness commit; неинтегрированные worktrees и
  branches сначала перечисляются и сохраняются, затем удаляются только явно.

## Открытые вопросы

- Нет. Initial implementation использует repository-owned `codex exec -C`
  adapter; встроенный `spawn_agent` остаётся read-only, пока не появится native
  hard worktree binding.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-08-03 после read-only capability/conflict анализа
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** создать второй отдельный plan для
  параллельных writers в разных worktree, чистого/pinned snapshot, durable
  state, interruption recovery, agent restart, checkpoint и controlled
  integration; оценить сложность и время.

## Ход выполнения

- Draft создан атомарно; implementation не начата.
- Read-only проверка подтвердила local `codex exec -C` и exact-session resume,
  а также direct/transitive write-set dependencies.

## Итог

Заполняется после реализации.
