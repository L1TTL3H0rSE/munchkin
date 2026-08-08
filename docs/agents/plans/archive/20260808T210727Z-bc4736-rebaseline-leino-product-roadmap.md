# PLAN: rebaseline Leino product roadmap

- **Plan ID:** `20260808T210727Z-bc4736-rebaseline-leino-product-roadmap`
- **Статус:** completed
- **Создан:** 2026-08-08 21:07:27 UTC
- **Обновлён:** 2026-08-09 01:19 MSK
- **Владелец:** execution session `019fe36c-a949-7320-92bf-7ddac8b5beab`; claimed without takeover after planning handoff
- **Repository:** `munchkin`
- **Workspace:** shared
- **Ветка:** `main` at `f828536321120e91fcbf8810e2f28d7d91a512b4`
- **Режим параллельности:** exclusive
- **Зависит от:** нет
- **Блокирует:** будущий отдельный plan `export-leino-history-and-create-repository` (roadmap code P01; exact ID ещё не создан и не является dependency/authorization)
- **Связанные ADR/handoff:** planned `docs/agents/decisions/0010-standalone-leino-product-roadmap.md`, planned `docs/agents/handoffs/20260809-leino-roadmap-trusted-session.md`, source handoff `/Users/kolyalis/Downloads/leino_handoff_bundle/00-COPY-FIRST-MASTER-HANDOFF.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/README.md",
    "docs/agents/HARNESS.md",
    "docs/agents/PROJECT_MEMORY.md",
    "docs/agents/decisions/0010-standalone-leino-product-roadmap.md",
    "docs/agents/handoffs/20260809-leino-roadmap-trusted-session.md",
    "docs/agents/plans/active/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md",
    "docs/agents/plans/archive/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md",
    "docs/agents/plans/active/20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening.md",
    "docs/agents/plans/archive/20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening.md",
    "docs/agents/plans/active/20260808T210727Z-bc4736-rebaseline-leino-product-roadmap.md",
    "docs/agents/plans/archive/20260808T210727Z-bc4736-rebaseline-leino-product-roadmap.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [
    "leino:staged-product-roadmap-v1",
    "repository:plan-supersession-v1",
    "repository:trusted-session-handoff-v1"
  ],
  "dependsOn": [],
  "sharedResources": [
    "repository:harness-policy",
    "repository:plan-registry",
    "product:leino-roadmap"
  ]
}
```

## Цель

Чисто заменить два неутверждённых Leino mega-plan на staged product roadmap:
сохранить их research в archive, зафиксировать standalone Leino boundary и
последовательную очередь P01–P14, не реализуя ни одной product capability и не
выдавая roadmap за approval дочерних plans.

## Критерии приёмки

- [x] Plans `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration` и
      `20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening` не
      исполняются, получают status `cancelled`, точную причину
      `superseded by staged Leino product roadmap`, ссылку на этот plan и
      переносятся теми же файлами в archive без потери research/evidence.
- [x] ADR `0010-standalone-leino-product-roadmap.md` фиксирует: Munchkin остаётся
      consumer/dogfood repository; standalone `leinodev/leino` становится
      будущим source of truth для generic CLI/core/schema только после
      отдельных approved migration plans.
- [x] ADR фиксирует slugs и semantic dependency gates очереди P01–P14, запрет
      ранней parallel-write implementation, P11 single-writer evidence gate и
      отдельную single-writer consistency model для Figma external artifacts;
      несуществующие exact plan IDs не выдумываются.
- [x] Completed checkpoint
      `20260808T093246Z-e55ac3-figma-closed-set-playability-remediation-v2` и
      его product scope не изменяются; optional restructuring разрешено только
      будущим отдельным P15 после P05/P13 и не является частью Leino core.
- [x] Product code, tests, generated code, hooks/config runtime semantics,
      vendored package source/metadata, model routing и external repositories не
      изменяются.
- [x] `plan-lint`, applicable repository-workflow checks, strict text/diff
      review, canonical verify и scope-check проходят; active registry не
      содержит `dependsOn` на cancelled IDs.
- [x] Handoff фиксирует, что изменения HARNESS/lifecycle documentation становятся
      trusted policy evidence только в новой Codex session после завершения,
      archive/release и local commit этого plan.
- [x] Каждый критерий blueprint сохранён выше; уточнения ограничивают ADR
      semantic slugs до появления exact child IDs и заменяют упоминание
      "current Figma plan" на подтверждённый completed checkpoint.

## Контекст и подтверждённое состояние

- До `plan create` 2026-08-09 worktree был clean; branch `main`, HEAD
  `f828536321120e91fcbf8810e2f28d7d91a512b4`.
- `./leinoctl context` нашёл четыре active plans: два infrastructure draft и
  два Leino `awaiting_approval`; все четыре не eligible. P00 имеет
  `dependsOn: []`, потому что его semantic dependencies отсутствуют.
- Оба superseded plans заявляют `implementation не начата`, имеют статус
  `awaiting_approval` и принадлежат owner record session
  `019fc743-f079-7d30-9756-e9aedfd5592e`; соответствующего active session file
  в `.leino/runtime/sessions` нет. Это stale-owner evidence, но не разрешение
  на takeover: execution повторно доказывает inactivity или останавливается.
- В active registry есть ровно одна direct dependency на отменяемый ID:
  worktree plan зависит от runtime-hardening plan; оба входят в одну atomic
  supersession operation. Ни infrastructure plans, ни P00 от них не зависят.
  Archived planning-workflow plan исторически упоминает, что блокировал первый
  mega-plan; исторический archive не переписывается.
- `tools/leinoctl/package.json` подтверждает `@leino/leinoctl` `0.1.0`,
  `private: true`, binary `leinoctl`, Node `>=20`; current generic source
  остаётся в `tools/leinoctl`.
- `.codex/config.toml` подтверждает read-only planning era: multi-agent enabled,
  depth 1, legacy `max_threads = 3`, default Luna/high. P00 не меняет routing.
- `./leinoctl preflight` подтвердил clean registry and Node 24.18.0, но canonical
  toolchain пока not ready: `LEINO_PNPM_EXECUTABLE` unset. Execution не
  устанавливает dependencies и должен предоставить declared existing resolver
  либо fail closed перед canonical verification.
- Latest Figma/gameplay remediation checkpoint
  `20260808T093246Z-e55ac3-figma-closed-set-playability-remediation-v2` лежит в
  archive со status `completed`; его deferred product requirements не
  становятся scope P00.
- ADR registry заканчивается номером `0009`; следующий свободный exact path —
  `0010-standalone-leino-product-roadmap.md`.

## Scope

### Входит

- Lifecycle-only cancellation/archive двух названных unapproved Leino plans с
  сохранением всего технического research.
- ADR о standalone Leino product boundary и staged semantic queue P01–P14,
  включая hard dependency/evidence/failure gates и optional P15 boundary.
- Navigation/HARNESS clarification и durable project memory о source-of-truth
  boundary без изменения executable policy.
- Точный handoff о new trusted session после lifecycle/runbook documentation.
- Lifecycle текущего P00: active → completed archive → guarded release → один
  отдельный local commit после всех проверок.

### Не входит

- Извлечение/копирование Leino code, создание или mutation GitHub repository,
  push, tag, release, package publication, registry smoke или npm visibility.
- Изменение `tools/leinoctl`, `.leino`, `.codex`, `AGENTS.md`, skills, CI,
  package metadata, dependency lockfiles или model routing.
- Реализация worktrees, attempts/leases/fencing, toolchain binding, runners,
  write agents, scheduler concurrency, Figma adapter или telemetry.
- Любые gameplay/frontend/backend/content/Figma capability changes и
  restructuring completed remediation checkpoint; P15 остаётся optional
  отдельным планом.
- Создание P01–P15 plan files, присвоение им exact IDs или approval всей queue.
- Push и любые external mutations; local commit завершённого P00 является
  единственным planned Git effect.

## Архитектурный подход

- Старые mega-plans остаются историческими evidence artifacts: меняются только
  lifecycle status/result/supersession metadata, затем те же файлы переносятся
  в archive; технические разделы не переписываются.
- ADR описывает capability contracts как staged queue. До создания каждого
  child plan используются только roadmap code + slug + semantic dependency;
  `dependsOn` появляется лишь с exact generated IDs в отдельной planning session.
- Roadmap approval не является approval P01–P15. Каждый child plan требует
  current research, exact manifest/ID, lint и отдельную пользовательскую фразу.
- До P11/P12 repository write work остаётся root-only; P11 сначала доказывает
  bounded single-writer packages, P12 допускается только после evidence gate.
- Figma external lane остаётся single-writer external-artifact consistency
  model с exact resource approval; она не разрешает параллельные writes.
- P00 не меняет executable harness. Изменённые HARNESS/navigation тексты
  считаются активированными только после новой trusted session.
- P01–P11, затем P12, P13 и P14 исполняются последовательно с одним selected
  write plan. P11 доказывает только одного writer; concurrent write execution
  не eligible до отдельно approved и доказанного P12. Независимый dependency
  graph не является разрешением раннего параллельного исполнения.

### Staged queue contract для ADR

| Code | Slug | Repository | Semantic dependencies |
|---|---|---|---|
| P01 | `export-leino-history-and-create-repository` | munchkin | exact P00 ID after P00 completion |
| P02 | `bootstrap-standalone-leino-product` | leino | P01 |
| P03 | `release-pipeline-and-first-package-publication` | leino | P02 |
| P04 | `pin-munchkin-to-published-leinoctl` | munchkin | P03 |
| P05 | `plan-spec-and-context-capsules` | leino | P04 |
| P06 | `repository-workspace-runtime-identity` | leino | P05 |
| P07 | `durable-attempts-leases-and-fencing` | leino | P06 |
| P08 | `transitive-toolchain-binding` | leino | P07 |
| P09 | `semantic-agent-routing-and-telemetry` | leino | P05, P07, P08 |
| P10 | `codex-readonly-runner` | leino | P05, P07, P08, P09 |
| P11 | `single-worktree-writer-pilot` | leino | P06, P07, P08, P09, P10 |
| P12 | `two-worker-package-dag` | leino | P11 + evidence gate |
| P13 | `figma-external-artifact-lane` | leino | P05, P07, P09, P10 |
| P14 | `adaptive-routing-evaluation` | leino | P09, P12, P13 |
| P15 optional | `split-gameplay-figma-remediation-epic` | munchkin | P05, P13 |

- P12 нельзя approve до минимум 10 успешных bounded P11 single-writer packages
  и 0 accepted scope violations; P11 не доказывает concurrent writers.
- P14 вправе завершиться `inconclusive` и никогда не меняет active routing без
  отдельного exact approval.
- P04 pin-ит exact published package/lockfile и удаляет vendored source только
  после artifact/behavior parity; implicit install/download запрещены.
- P01 external authorization отдельно повторяет proposed exact target
  `leinodev/leino`, visibility и push; P03 — proposed package
  `@leinodev/leinoctl`, exact version, public visibility, tag/publication; P13 —
  exact Figma file/resource key и mutation scope. Proposed names не доказывают
  существование/доступность и становятся target authority только в отдельном
  child approval. Ни один такой effect не разрешён P00.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| plan registry | Cancel/archive two unapproved plans and preserve evidence | Internal lifecycle only |
| repository workflow docs | Record staged queue, approval and trusted-session gates | Internal governance only |
| ADR/project memory | Record standalone product boundary | No current package/repository migration |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/plans/active/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md` | delete | Lifecycle supersession move from active |
| `docs/agents/plans/archive/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md` | write | Preserve superseded research at archive path |
| `docs/agents/plans/active/20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening.md` | delete | Lifecycle supersession move from active |
| `docs/agents/plans/archive/20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening.md` | write | Preserve superseded research at archive path |
| `docs/agents/decisions/0010-standalone-leino-product-roadmap.md` | write | Product boundary and staged queue ADR |
| `docs/agents/README.md` | write | Navigation to ADR/roadmap boundary |
| `docs/agents/HARNESS.md` | write | No-silent child approval and pre-P11 write boundary clarification |
| `docs/agents/PROJECT_MEMORY.md` | write | Durable standalone source-of-truth boundary |
| `docs/agents/handoffs/20260809-leino-roadmap-trusted-session.md` | write | New trusted-session checkpoint |
| `docs/agents/plans/active/20260808T210727Z-bc4736-rebaseline-leino-product-roadmap.md` | delete | Active lifecycle and final archive move |
| `docs/agents/plans/archive/20260808T210727Z-bc4736-rebaseline-leino-product-roadmap.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `repository:harness-policy` | both superseded mega-plans | stale owner session `019fc743-f079-7d30-9756-e9aedfd5592e` | P00 exclusive; prove inactivity before lifecycle mutation |
| `repository:plan-registry` | all four current active plans | P00 owner session after approval/select | cancel only two named IDs; leave infrastructure drafts unchanged |
| `product:leino-roadmap` | both superseded mega-plans | P00 after explicit approval | P00 supersedes direction; child plans remain separately gated |

### Проверка конфликтов

- **Проверены active plans:**
  `20260731T005309Z-569b95-infrastructure-p1-bonus-hardening` (draft),
  `20260731T005309Z-784d5e-infrastructure-p2-platform-evolution` (draft),
  `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration`
  (awaiting_approval),
  `20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening`
  (awaiting_approval), и P00 draft.
- **Обнаруженные пересечения:** P00 намеренно пересекает plan files и
  `repository:harness-policy` двух superseded plans. Infrastructure drafts
  касаются `INFRASTRUCTURE_ROADMAP.md` и не пересекают P00 write set/shared
  resources. Второй mega-plan пишет manifest первого, поэтому они должны
  отменяться в одной exclusive P00 lifecycle operation.
- **Owner/session:** оба mega-plan owner records stale-looking, но automatic
  takeover запрещён. Hook policy подтверждает, что P00 write set не заменяет
  lifecycle ownership чужих plan files. Execution после read-only liveness
  proof выполняет только exact `plan claim` с `--takeover` для двух named IDs;
  ambiguity — hard stop, bulk owner/session cleanup запрещён.
- **Dependency:** единственный active dependent — отменяемый worktree plan на
  отменяемый runtime plan; их status/move меняются в одной exclusive operation,
  после которой active dangling reference отсутствует. Любой новый third-party
  dependent, owner conflict, unexpected dirty path, ADR 0010 collision или
  изменение queue semantics — hard stop и reapproval.

## Delegation strategy

- **Classification:** large — planning delegation required.
- **Причина:** independent registry/ownership audit и broad roadmap/runtime
  contract mapping, несколько governance surfaces и высокий lifecycle/recovery
  risk при отмене чужих stale-owned plans.
- **Root model / effort:** requested `gpt-5.6` / `high`; root сохраняет scope,
  architecture, authorization, synthesis и approval wording.
- **Root parallel work:** уточнить cancellation ownership semantics,
  manifest/write-set symmetry, failure gates, migration/rollback и canonical
  verification while explorers run.
- **Write boundary:** delegated packages are `read-only`, `write_set: []`;
  potential implementation is `root-only pending worktree orchestration`.
- **Routing note:** first spawn requested the available explorer profile, but
  runtime returned exact error `Unknown model gpt-5.6-luna`; only Sol and Terra
  were callable. Requested Luna/medium therefore cannot run. Root records the
  failure before an explicit bounded fallback to Terra/medium; there is no
  silent model substitution.

### Preliminary work packages

#### `registry-dependency-audit`

- **Package / role / model / effort:** requested explorer /
  `gpt-5.6-luna` / `medium`; spawn failed `Unknown model`; explicit fallback
  default read-only agent / `gpt-5.6-terra` / `medium` with unchanged scope.
- **Bounded scope и context/history:** only active/archive plan headers,
  manifests, direct references, `.leino/runtime/plan-owners` and session file
  names for the two superseded IDs; `fork_turns: none`.
- **Independent from:** root examines cancellation mechanics and verification;
  this package owns dependency/owner evidence only.
- **Access / write set:** `read-only` / `[]`.
- **Expected output:** concise exact path-backed status, dependency, owner,
  active/archive placement and conflict findings.
- **Stop condition:** return evidence or stop on ambiguity/scope expansion; no
  edits, commits, agents, external calls or raw transcript.
- **Root parallel work:** inspect leinoctl cancellation/claim behavior and
  define fail-closed ownership transition.
- **Expected savings:** isolates registry scan and prevents hidden dangling
  dependency or owner assumption from being lost in roadmap synthesis.

#### `roadmap-contract-map`

- **Package / role / model / effort:** explorer / `gpt-5.6-terra` / `medium`.
- **Bounded scope и context/history:** broad read-only mapping of current
  `tools/leinoctl`, profile/harness/delegation docs, two mega-plan contracts and
  blueprint P00/P01–P15 semantics; `fork_turns: none`.
- **Independent from:** registry package does not assess capability migration;
  root does not duplicate broad source-to-stage mapping.
- **Access / write set:** `read-only` / `[]`.
- **Expected output:** staged queue invariants, source-of-truth boundary,
  blueprint acceptance/non-goal/failure-gate gaps with exact paths.
- **Stop condition:** return distilled evidence or stop if implementation
  design is required; no edits, commits, agents or external mutations.
- **Root parallel work:** finalize exact write set, rollback and checks.
- **Expected savings:** separates broad capability mapping from root lifecycle
  synthesis and tests whether the proposal matches current source truth.

#### `adversarial-roadmap-review`

- **Package / role / model / effort:** named reviewer requested
  `gpt-5.6-terra` / `high`, but runtime incorrectly resolved the named profile
  to unavailable Luna and returned `Unknown model`; explicit fallback is a
  default read-only agent with `gpt-5.6-terra` / `high` and unchanged scope.
- **Bounded scope и context/history:** synthesized P00 file plus directly named
  instructions, plans and evidence; `fork_turns: none`; run only after explorer
  synthesis.
- **Independent from:** reviewer tests the whole draft rather than recollecting
  evidence.
- **Access / write set:** `read-only` / `[]`.
- **Expected output:** prioritized blockers for lost blueprint criteria,
  accidental authorization, dependency/owner mistakes, write-set gaps and weak
  checks.
- **Stop condition:** return actionable findings and stop without edits,
  commits, agents or external calls.
- **Root parallel work:** run context/plan-lint consistency checks and prepare
  resolutions, without finalizing status until review is closed.
- **Expected savings:** independent adversarial pass before exact approval.

### Actual delegation evidence

| Package | Result | Evidence/findings | Влияние на plan |
|---|---|---|---|
| `registry-dependency-audit` | completed via explicit Terra/medium fallback | Both old plans are active `awaiting_approval`; one paired direct dependency worktree → runtime; same stale-looking owner session has no session file; historic archive references only worktree ID | Added exact ownership takeover gate, paired atomic cancellation and third-party dependency stop |
| `roadmap-contract-map` | completed | Current source remains private vendored `@leino/leinoctl@0.1.0`; manifest-v1 lacks future specs/capsules; old hardening maps to P08/P09, orchestration to P05–P12; P01–P04/P13/P14 have no current implementation | Added exact queue table, P11/P12 and P14 gates, P04 migration gate and P01/P03/P13 external authorization classes; write set stays documentation-only |
| `adversarial-roadmap-review` | completed via explicit Terra/high fallback | Found planning-owner handoff, post-release rollback, exact external target, serialization and runtime-state wording gaps; reported manifest/handoff asymmetry was stale and disproved by current file plus lint `issues=0` | Added unselected P00 release, separate recovery-plan rollback, proposed exact child targets, serialization through P12 and ignored-runtime clarification |

- **Adversarial review:** all material findings closed. Exact handoff path was
  already symmetric in manifest/write set; current `plan-lint` independently
  confirms no registry issue.

## План реализации

1. [x] Re-run dirty/HEAD/context/registry/owner preflight in a fresh execution
       session; confirm planning owner was released, then prove old owner
       inactivity or stop without takeover.
2. [x] Claim P00 lifecycle without takeover, record exact approval, set P00
       `approved`/`in_progress`, select only P00. After liveness proof, claim
       only the two superseded lifecycle IDs with explicit `--takeover`; do not
       select them. Roadmap direction does not approve any child plan.
3. [x] Create ADR 0010 with standalone boundary, P01–P14 slugs/dependency
       semantics/evidence gates and optional P15 boundary.
4. [x] Change only lifecycle metadata/result of the two named mega-plans to
       `cancelled` with exact supersession reason; move the same full files to
       archive and preserve research.
5. [x] Update README, HARNESS and PROJECT_MEMORY narrowly; create trusted-session
       handoff. Do not change executable hooks/config/source.
6. [x] Scan active dependencies, inspect scoped diff, run all planned checks;
       any unexpected registry/owner/toolchain/write-set change fails closed.
7. [x] Mark P00 completed, move it to archive and run guarded P00 release. With
       no selected session remaining, release the two exact cancelled-plan
       lifecycle claims in handoff mode, create one local commit, do not push,
       and end for a new trusted session.

## Проверки

- [x] Focused registry scan: no active manifest `dependsOn` either cancelled ID;
      both archived files retain their original technical sections and exact
      supersession reason.
- [x] `git diff --check` and manual scoped diff/research-preservation review.
- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs`.
- [x] `(cd tools/leinoctl && node --test)`.
- [x] `./leinoctl preflight` with declared existing pnpm resolver available;
      no dependency install or lockfile mutation.
- [x] `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed` for canonical recorded evidence.
- [x] `./leinoctl scope-check --plan 20260808T210727Z-bc4736-rebaseline-leino-product-roadmap`.
- [x] After archive/release/local commit, new trusted SessionStart evidence is
      deferred to the next session and is not claimed by this execution.

## Риски и откат

- **Риск:** useful mega-plan research is lost or silently rewritten.
  **Mitigation/откат:** preserve the same complete files; only lifecycle/result
  metadata changes; diff review compares archived content before commit. Before
  release, restore only within P00 write set and repeat verify/scope-check. After
  release/local commit, rollback requires a separately approved recovery plan;
  direct `git revert` is not authorized by P00.
- **Риск:** another plan/session depends on or owns a cancelled plan.
  **Mitigation/откат:** re-run dependency and liveness checks; ambiguous owner,
  direct/transitive dependency or live session is a hard stop before writes.
- **Риск:** ADR is mistaken for approval to create/push/publish or run writers.
  **Mitigation/откат:** explicit no-authorization wording in ADR/HARNESS and
  separate exact approval for every child/external target.
- **Риск:** changed lifecycle documentation is claimed active in the same
  session. **Mitigation/откат:** handoff + mandatory new trusted session; current
  session reports docs changed, not hooks activated.
- **Риск:** verification attempts to repair missing pnpm implicitly.
  **Mitigation/откат:** use declared existing executable only; unset/invalid
  resolver fails closed and never authorizes install/lockfile changes.

## Failure gates

- Stop before cancellation on live/ambiguous prior owner, ADR 0010 collision,
  new dirty paths, any third-party active dependency on either superseded ID,
  or any required write outside this exact write set. The paired worktree →
  runtime dependency is expected and removed from active registry atomically.
- Stop and request reapproval if repository/package naming, queue order,
  semantic dependencies, P11/P12 evidence gates, Figma consistency model,
  external targets or risks materially change.
- Stop on any failed lint/test/canonical verify/scope-check; manual checks do not
  substitute for recorded canonical evidence.
- Never resolve conflict by deleting owner/session registries, trimming old
  research, editing child plans, auto-installing dependencies or expanding P00.

## Local lifecycle effects

- Exact `plan claim`/`plan select`/ledger/rotation operations may mutate ignored
  `.leino/runtime/{plan-owners,sessions,plan-rotations}` state. This is required
  lifecycle bookkeeping, not tracked `.leino` configuration scope.
- P00 does not authorize manual editing/deletion of runtime JSON, bulk cleanup,
  tracked `.leino/**` changes or using ignored state as approval evidence.

## Открытые вопросы

- No P00 scope/architecture question remains for approval. Proposed external
  names still require exact child-plan validation/approval; runtime liveness and
  pnpm resolver availability are execution preflight gates, not permission to
  widen scope.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-09 MSK after completed delegation and consistency checks
- **Подтверждено:** 2026-08-09 01:11 MSK, exact plan ID and constraints recorded verbatim below
- **Формулировка/ограничения пользователя:** `Согласую plan
  20260808T210727Z-bc4736-rebaseline-leino-product-roadmap на implementation:
  после доказанного stale-owner preflight выполнить точечный takeover только
  двух named lifecycle IDs, отменить и архивировать их, создать ADR staged
  roadmap, обновить exact write set и handoff, пройти canonical checks,
  archive/release и сделать один local commit; без approval/select P01–P15,
  product code, push или external mutations.`

## Ход выполнения

- Master handoff read first; blueprint treated as proposal, not source of truth.
- Skeleton created by exact repository wrapper; bootstrap exception not used.
- Read-only context/preflight/registry research and adversarial review completed.
- Planning session released unselected P00 lifecycle ownership in handoff mode
  after final lint/text/context checks; a fresh execution session can claim P00
  without implicit takeover.
- Execution session `019fe36c-a949-7320-92bf-7ddac8b5beab` proved the two named
  lifecycle owner records stale: their owner session
  `019fc743-f079-7d30-9756-e9aedfd5592e` has no runtime session state and the
  Codex task is `notLoaded`; P00 was claimed without takeover.
- Exact user approval recorded; P00 selected at
  `2026-08-08T22:11:56.921Z`; status changed to `in_progress` before repository
  implementation writes.
- Targeted takeover completed only for runtime plan at
  `2026-08-08T22:12:14.620Z` and worktree plan at
  `2026-08-08T22:12:18.867Z`; both claims replaced exact stale session
  `019fc743-f079-7d30-9756-e9aedfd5592e`, and neither plan was selected.
- Both mega-plans were cancelled with exact supersession reason and moved to
  archive with technical research preserved. ADR 0010, navigation/HARNESS,
  durable memory and trusted-session handoff were written inside the exact P00
  write set; no executable/product/external surface changed.
- Research-preservation diffs against `HEAD` contain only lifecycle header,
  approval status, progress and result additions for both archived plans. The
  active dependency scan contains no third-party reference to either cancelled
  ID; the only remaining active references are P00 lifecycle paths/evidence.
- Focused evidence: `git diff --check` passed; text-check checked all eight
  present changed text files with zero issues; harness tests passed `44/44`;
  leinoctl tests passed `81/81`; plan-lint reported
  `plans=75 active=3 archive=72 issues=0`.
- Declared cached pnpm resolver
  `/Users/kolyalis/.cache/node/corepack/v1/pnpm/10.8.0/bin/pnpm.cjs` reported
  exact version `10.8.0`; preflight reported `toolchain.ready=true` without any
  install or lockfile mutation.
- Canonical `./leinoctl verify --changed` passed all three required
  repository-workflow checks (`codex-harness-tests`, `leinoctl-tests`,
  `plan-lint`) with exit code 0 and recorded them in the selected session
  ledger.
- First canonical scope report returned `ok=true` for session
  `019fe36c-a949-7320-92bf-7ddac8b5beab`: `outsideWriteSet=[]`,
  `unledgered=[]`, `unledgeredInWriteSet=[]`, `failedChecks=[]` and
  `missingRequiredChecks=[]`; root HEAD remained unchanged at
  `f828536321120e91fcbf8810e2f28d7d91a512b4`. This evidence is included before
  one final canonical verify/scope refresh.

## Итог

Completed the documentation-only P00 scope. The two exact stale-owned mega-plan
lifecycle files were taken over only for cancellation, never selected, marked
`cancelled` with reason `superseded by staged Leino product roadmap` and moved
to archive without technical research changes. ADR 0010 establishes the staged
standalone Leino boundary and semantic P01-P14 queue plus optional P15 while
explicitly withholding child/external authorization.

Final canonical verification passed harness `44/44`, leinoctl `81/81` and
plan-lint with exit code 0. Final scope-check returned `ok=true`,
`outsideWriteSet=[]`, `unledgered=[]`, `failedChecks=[]` and
`missingRequiredChecks=[]` against unchanged root HEAD
`f828536321120e91fcbf8810e2f28d7d91a512b4`. This completed plan is archived
and handed to guarded release; the single local lifecycle commit follows that
release. No P01-P15 approval/select, product code, dependency install, push,
publication or external mutation occurred.
