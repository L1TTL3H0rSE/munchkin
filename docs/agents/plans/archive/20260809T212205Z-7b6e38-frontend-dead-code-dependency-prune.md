# PLAN: frontend dead code dependency prune

- **Plan ID:** `20260809T212205Z-7b6e38-frontend-dead-code-dependency-prune`
- **Статус:** completed
- **Создан:** 2026-08-09 21:22:05 UTC
- **Обновлён:** 2026-08-10
- **Владелец:** `019fe88b-0e60-7960-92e7-1a3a1d5513e5`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** нет
- **Блокирует:** `20260809T212617Z-7a4a07-frontend-contract-domain-split`
- **Связанные ADR/handoff:** `docs/agents/FRONTEND_ENGINEERING_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/plans/active/20260809T212205Z-7b6e38-frontend-dead-code-dependency-prune.md",
    "docs/agents/plans/archive/20260809T212205Z-7b6e38-frontend-dead-code-dependency-prune.md",
    "frontend/applications/web/app/components/lobby/LobbyRecoveryHint.vue",
    "frontend/applications/web/app/components/ui/AdvisoryTimer.vue",
    "frontend/applications/web/app/components/ui/IconButton.vue",
    "frontend/applications/web/app/components/ui/LiveRegion.vue",
    "frontend/applications/web/app/components/ui/PhaseLabel.vue",
    "frontend/applications/web/app/components/ui/PlayerBadge.vue",
    "frontend/applications/web/app/components/ui/SemanticButton.vue",
    "frontend/applications/web/app/components/ui/StatusBadge.vue",
    "frontend/applications/web/app/components/ui/StrengthIndicator.vue",
    "frontend/applications/web/app/components/ui/VisuallyHidden.vue",
    "frontend/applications/web/app/components/ui/advisoryTimerModel.ts",
    "frontend/applications/web/app/components/ui/phaseModel.ts",
    "frontend/applications/web/app/components/interaction/economyModel.ts",
    "frontend/applications/web/app/components/interaction/targetRunAwayModel.ts",
    "frontend/applications/web/app/components/game/gamePresentationModel.ts",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/plugins/uiFixture.client.ts",
    "frontend/applications/web/nuxt.config.ts",
    "frontend/applications/web/package.json",
    "frontend/pnpm-workspace.yaml",
    "frontend/pnpm-lock.yaml",
    "frontend/applications/web/test/gamePresentation.test.ts"
  ],
  "components": ["frontend-workspace", "pnpm:@munchkin/web"],
  "contracts": [],
  "dependsOn": [],
  "sharedResources": [
    "frontend-workspace-lockfile",
    "frontend-game-api-facade",
    "frontend-player-models"
  ]
}
```

## Цель

Удалить только доказанно мёртвые frontend components/models/plugin/helpers и
неиспользуемые Pinia dependencies, не добавляя replacement abstractions и не
меняя product behavior, visual presentation, gameplay или wire contracts. Это
первый checkpoint фиксированной четырёхплановой frontend-quality очереди.

## Критерии приёмки

- [x] Каждый удаляемый Vue component не имеет explicit template/import,
  `resolveComponent`, dynamic `:is`, production/test/browser consumer; Nuxt
  auto-import candidate проверен по имени отдельно.
- [x] Удалены ровно десять orphan Vue components и две поддерживающие их pure
  models; live `SheetDialog` и остальные real consumers сохранены.
- [x] Production auto-plugin `uiFixture.client.ts` удалён: app consumer
  отсутствует, browser/unit fixtures импортируют adapter прямо из test tree.
- [x] Удалены только exported helpers без callers: `deathLoot`, `isMyTurn`,
  `opponentStatusLabel`, `economyActionKey`, `ownCardByID`, `theftActionLabel`,
  `runAwayState`; живые exports/semantics не затронуты.
- [x] `pinia`/`@pinia/nuxt` отсутствуют в Nuxt modules, manifest/catalog и
  lockfile; repo-wide scan по store APIs остаётся пустым.
- [x] Lockfile regenerated declared `pnpm@10.8.0` содержит только Pinia
  removal/reachability delta, без upgrade/install unrelated packages.
- [x] Public contracts, visible copy/layout and runtime flows unchanged;
  focused/canonical checks pass.

## Контекст и подтверждённое состояние

- Read-only scan 2026-08-09/10 found no `defineStore`, `storeToRefs`, store
  consumer, `resolveComponent` or dynamic component reference for candidates;
  Pinia appears only in `nuxt.config.ts`, web manifest and catalog.
- Exact orphan components: `LobbyRecoveryHint`, `AdvisoryTimer`, `IconButton`,
  `LiveRegion`, `PhaseLabel`, `PlayerBadge`, `SemanticButton`, `StatusBadge`,
  `StrengthIndicator`, `VisuallyHidden`.
- `AdvisoryTimer`/`PhaseLabel` are the only consumers of their pure models;
  `gamePresentation.test.ts` directly tests those orphan APIs.
- `uiFixture.client.ts` imports `test/fixtures/fixtureAdapter.ts`; no app/test
  consumer reads its provided `uiFixture` key.
- Exact `pnpm@10.8.0` is available in current Corepack cache and was verified;
  fallback `pnpm@11.16.0` is explicitly not an allowed substitute.
- Worktree was clean before creating these four plan files; selected plan is
  none and implementation has not started.

## Scope

### Входит

- Delete the exact ten Vue files, two orphan models and unused fixture plugin.
- Remove the seven caller-free exports/bodies from four live modules and their
  legacy-only test assertions.
- Remove Pinia Nuxt module/direct dependencies/catalog pins and reconcile the
  single frontend lockfile with declared pnpm.
- Repo-wide usage proof and focused tests after deletion.

### Не входит

- Replacement component library/barrel/store, formatter/Stylelint, layout/
  SCSS/BEM refactor, GameTable decomposition, API/session/contracts move.
- Card Studio split, Figma parity, gameplay/backend/content/schema, visible
  copy, snapshot update, dependency upgrade/install, push.

## Архитектурный подход

- **Delete, do not wrap.** No compatibility aliases, deprecated exports or
  empty components for code with zero consumers.
- **Nuxt-aware proof.** Search explicit imports/tags plus runtime component
  resolution paths before deletion; auto-import availability alone is not use.
- **Generated lockfile through declared tool.** Manifest/catalog first, exact
  `pnpm@10.8.0` lockfile-only reconciliation second, diff must be removal-only.
- **Keep real seams.** Live `SheetDialog`, session API, models and tests remain;
  only caller-free exports/assertions are removed.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Nuxt web UI | Delete orphan auto-import candidates/plugin | Runtime API unchanged |
| Player models/API | Remove caller-free exports | Live behavior unchanged |
| Frontend workspace | Remove unused Pinia dependencies | Lockfile removal only |
| Unit tests | Remove assertions for deleted orphan APIs | Live coverage retained |

## Delegation strategy

- **Классификация:** large — planning delegation required for the whole queue:
  dead-code proof, contracts, transport lifecycle and UI/style ownership are
  independent workstreams with shared owners.
- **Package A — Terra high, read-only, completed:** audited exact queue slicing,
  manifests/write intersections, direct dependencies, lockfile authorization,
  Nuxt auto-import deletion risk and trusted-session gates. It recommended
  four checkpoints, lockfile ownership only here, and no standalone mass
  formatter/Studio plan.
- **Package B — Terra high, read-only, completed:** checked current Munchkin and
  Digiversity component/library/API patterns, challenged YAGNI splits and
  specified contract/session/UI acceptance gates. It confirmed Studio split is
  conditional and a new shared package/store is unjustified.
- Native `spawn_agent` was attempted with valid first-line metadata but the
  active adapter hook returned `delegation-metadata-missing`; after explicit
  approval both packages ran as separate `gpt-5.6-terra`, high, `read-only`
  Codex processes. Both had `write_set: []`; root performed every repository
  write and synthesized the four drafts.

### Delegation findings and closure

| Package | Finding | Disposition/closure |
|---|---|---|
| A | Six checkpoints were not justified; formatting and Studio-only plans added broad/noisy ownership. | Accepted: queue reduced to four; standalone formatting and Studio split drafts removed. |
| A | Lockfile and dependency removal must have one owner and exact toolchain. | Accepted here only: plan 1 owns Pinia removal and removal-only `pnpm@10.8.0` reconciliation; later plans forbid dependency mutation. |
| A | `useGameApi.ts` and player-model paths overlap later work. | Accepted and closed by the explicit four-plan dependency chain, canonical closeout and separate commit before the next select. |
| A | Nuxt auto-import/dynamic lookup can hide component consumers. | Accepted: explicit tag/import, auto-import name, `resolveComponent`, dynamic `:is`, test and browser scans are acceptance gates before deletion. |
| B | Card Studio composition split is speculative for this audit. | Accepted: no Studio decomposition; only route-local ownership of its existing stylesheet remains in plan 4. |
| B | A new shared package, store or generic UI framework has no second real consumer. | Accepted as queue-wide non-goals; existing package root, composable facades and feature models remain. |
| B | BEM normalization should travel with live component owners, not a mass formatter pass. | Accepted: style work is limited to touched game/interaction/lobby owners in plan 4. |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/plans/active/20260809T212205Z-7b6e38-frontend-dead-code-dependency-prune.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260809T212205Z-7b6e38-frontend-dead-code-dependency-prune.md` | write | Archived lifecycle |
| `frontend/applications/web/app/components/lobby/LobbyRecoveryHint.vue` | delete | No consumer |
| `frontend/applications/web/app/components/ui/AdvisoryTimer.vue` | delete | No consumer |
| `frontend/applications/web/app/components/ui/IconButton.vue` | delete | No consumer |
| `frontend/applications/web/app/components/ui/LiveRegion.vue` | delete | No consumer |
| `frontend/applications/web/app/components/ui/PhaseLabel.vue` | delete | No consumer |
| `frontend/applications/web/app/components/ui/PlayerBadge.vue` | delete | No consumer |
| `frontend/applications/web/app/components/ui/SemanticButton.vue` | delete | No consumer |
| `frontend/applications/web/app/components/ui/StatusBadge.vue` | delete | No consumer |
| `frontend/applications/web/app/components/ui/StrengthIndicator.vue` | delete | No consumer |
| `frontend/applications/web/app/components/ui/VisuallyHidden.vue` | delete | No consumer |
| `frontend/applications/web/app/components/ui/advisoryTimerModel.ts` | delete | Only deleted component/test consumes it |
| `frontend/applications/web/app/components/ui/phaseModel.ts` | delete | Only deleted component/test consumes it |
| `frontend/applications/web/app/components/interaction/economyModel.ts` | write | Remove three caller-free exports |
| `frontend/applications/web/app/components/interaction/targetRunAwayModel.ts` | write | Remove caller-free `runAwayState` |
| `frontend/applications/web/app/components/game/gamePresentationModel.ts` | write | Remove caller-free `opponentStatusLabel` |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Remove caller-free `deathLoot`/`isMyTurn` |
| `frontend/applications/web/app/plugins/uiFixture.client.ts` | delete | Test fixture must not enter production graph |
| `frontend/applications/web/nuxt.config.ts` | write | Remove Pinia module |
| `frontend/applications/web/package.json` | write | Remove Pinia dependencies |
| `frontend/pnpm-workspace.yaml` | write | Remove orphan catalog pins |
| `frontend/pnpm-lock.yaml` | generated | Exact declared pnpm reconciliation |
| `frontend/applications/web/test/gamePresentation.test.ts` | write | Remove orphan model assertions/imports |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend-workspace-lockfile` | none later | this plan | Only queue checkpoint allowed to mutate dependencies/lockfile |
| `frontend-game-api-facade` | session/API plan | this plan first | Remove dead exports, commit, then refactor stable live facade |
| `frontend-player-models` | final GameTable/style plan | this plan first | Remove dead helpers, then refactor live owners |

### Queue preflight до batch approval

- **Fresh approval preflight (2026-08-10):** `./leinoctl preflight`, aggregate
  `./leinoctl context --paths ...` and `node .codex/hooks/plan-lint.mjs`
  reconfirmed the same four exact IDs/order/dependency graph, all four active
  and awaiting approval before this record, clean registry, and only these
  four user-owned untracked plan files. Exact declared pnpm is not yet mapped
  in the process environment; execution must resolve cached `pnpm@10.8.0`
  through the repository profile and stop rather than install, download or
  substitute another version.

- **Declared count:** `4` plans.
- **Actual exact IDs:** `4` plans.
- **Exact order:**
  1. `20260809T212205Z-7b6e38-frontend-dead-code-dependency-prune`
  2. `20260809T212617Z-7a4a07-frontend-contract-domain-split`
  3. `20260809T212616Z-758ff2-frontend-session-api-module-boundaries`
  4. `20260809T212615Z-c3d56b-game-table-composition-decomposition`
- **Dependency graph:** plan 1 has no dependency; 2 directly depends on 1; 3
  directly depends on 2; 4 directly depends on 3. Exact order satisfies graph.
- **Placement/eligibility/owner:** all four are in `active/`, status
  `awaiting_approval`, ineligible, owner `—`, selected/claimed session none.
- **Write intersections:** plan 1 → 3 shares exact `useGameApi.ts`; plan 1 → 4
  intersects through `LobbyRecoveryHint.vue` inside `components/lobby/**`,
  `economyModel.ts` and `targetRunAwayModel.ts` inside
  `components/interaction/**`, `gamePresentationModel.ts` inside
  `components/game/**`, and exact `gamePresentation.test.ts`. These are
  intentional delete/narrow-first sequences separated by lifecycle closeout
  and commits. Plans 2 → 3 and 3 → 4 share frozen public semantics only, not
  write paths; every other pair has no write-path intersection.
- **Shared resources:** lockfile exclusive to plan 1; contracts exclusive to
  plan 2; session/API exclusive to plan 3; player presentation/styles/browser
  selectors exclusive to plan 4.
- **Aggregate context (2026-08-09 21:54 UTC):**
  `./leinoctl context --paths frontend/applications/web/app/components,frontend/applications/web/app/composables,frontend/applications/web/app/assets/scss,frontend/applications/web/app/pages,frontend/applications/web/test,frontend/packages/contracts,frontend/test/browser,frontend/pnpm-lock.yaml`
  returned `ok`; loaded root/frontend instructions, components
  `frontend-workspace`, `pnpm:@munchkin/contracts`, `pnpm:@munchkin/web` and
  `root-compose`, and exactly these four matching plans. All four were
  ineligible before approval; the two unrelated infrastructure drafts were
  discovered by the registry scan but not loaded into frontend context.

### Unattended execution policy for the approved queue

- Batch approval pre-authorizes root to choose exact private filenames,
  extraction size, private symbol names, test placement inside claimed globs,
  mechanical step order and the smallest existing helper/token/mixin that
  satisfies each plan. These are non-material implementation decisions and do
  not require another approval.
- Root may retry local checks, use a narrower equivalent repository-declared
  focused check, and correct implementation/test defects inside the selected
  plan's manifest. It may not weaken assertions or skip canonical
  `verify`/`scope-check` gates.
- If an optional abstraction has no demonstrated second responsibility or
  consumer, root keeps the simpler existing owner and records the decision;
  no speculative compatibility layer is required.
- Ordinary refactor discoveries that stay inside the manifest, acceptance
  criteria, public-behavior freeze and listed risks are handled autonomously
  and summarized in the plan rather than sent back for approval overnight.
- A hard stop remains only when completion requires a path/resource outside
  the manifest, a public contract/gameplay/privacy/visible-intent change, a new
  dependency, snapshot or remote effect, changed queue metadata/order, deletion
  of a newly proven live consumer, or bypass of a failed canonical gate. In
  that case root preserves local evidence and waits; it does not improvise an
  unauthorized expansion or select the dependent next plan.
- This policy is incorporated into all four exact queue members; it does not
  authorize install/download/upgrade, push, Figma/cloud mutation or parallel
  selection.
- **Hard stops:** ID/count/order/dependency/write set/shared resource/risk
  change; contract or gameplay semantic change; unexpected dirty path; failed
  canonical check; snapshot update; dependency install/upgrade; unavailable
  exact pnpm; push without separate permission.

### Проверка конфликтов

- **Проверены active plans:** 2026-08-09 21:54 UTC aggregate context plus all
  six active manifests; the two infrastructure drafts have no frontend claims.
- **Обнаруженные пересечения:** only intentional serialized intersections
  listed above; two pre-existing infrastructure drafts do not claim frontend.
- **Решение:** exact chain, verify/scope-check/archive/release/separate local
  commit per plan. No push. Any material delta stops and requests re-approval.

## План реализации

1. [x] Repeat exact explicit/auto/dynamic usage inventory against the selected
   checkout and stop if any candidate gained a consumer.
2. [x] Delete only listed components/models/plugin and remove listed
   caller-free exports/assertions.
3. [x] Remove Pinia module/dependencies/catalog pins and regenerate lockfile
   with exact declared pnpm under explicit lockfile-only authorization.
4. [x] Run focused/canonical checks and inspect diff for behavior/visual/
   contract or unrelated resolution churn.

## Проверки

- [x] Repo-wide explicit/import/template/`resolveComponent`/dynamic usage scan.
- [x] Focused web unit tests for touched models/API plus full `pnpm check`.
- [x] `pnpm lint`, `pnpm check`, `pnpm build` from `frontend/`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260809T212205Z-7b6e38-frontend-dead-code-dependency-prune`.

## Риски и откат

- **Риск:** hidden Nuxt dynamic consumer; lockfile command changes unrelated
  resolution; helper looked public but only external consumer is untracked.
- **Mitigation:** exact tracked consumer scan, build/browser checks, removal-only
  lockfile diff and stable package-private status.
- **Откат:** revert isolated plan commit or restore the exact deleted owner
  before commit; no compatibility wrapper/flag.

## Открытые вопросы

- None before approval. Exact lockfile-only command is authorized separately in
  the requested batch-approval wording; package downloads/upgrades remain
  forbidden.

## Согласование

- **Статус:** approved for exact four-plan queue
- **Запрошено:** 2026-08-09 21:54:06 UTC
- **Подтверждено:** 2026-08-10
- **Формулировка/ограничения пользователя:** exact four-plan queue approved in
  the listed order, including unattended execution policy, autonomous
  non-material decisions inside manifests/acceptance criteria, removal-only
  offline lockfile reconciliation through `pnpm@10.8.0`, sequential lifecycle
  and one local commit per plan. Dependency install/upgrade, snapshot update
  and push are forbidden.

## Ход выполнения

- Two Terra high read-only planning packages completed and were synthesized.
- Exact four-plan queue approved; plan selected in the current trusted session
  after targeted takeover from the absent planning session.
- Repo-wide explicit, kebab-case, auto-import, dynamic component and caller
  scans reconfirmed the exact orphan/helper inventory before deletion.
- Exact cached `pnpm@10.8.0` performed lockfile-only offline reconciliation
  with zero downloads/additions. `ignoredOptionalDependencies: [pinia]`
  prevents Nuxt/vue-router from reintroducing the removed optional peer while
  leaving global peer installation unchanged; lockfile delta is Pinia and its
  newly unreachable optional graph only.
- Focused Vitest passed 31/31; `pnpm lint`, `pnpm check` (19 contracts + 163
  web tests) and `pnpm build` passed. Sandbox loopback denial and one sandbox
  Dart/Sass cpuinfo crash were both rerun successfully outside the sandbox.
- Canonical `./leinoctl verify --changed` passed all 15 required checks;
  `scope-check` passed with no outside-write-set or unledgered paths. The
  ledger retains one superseded sandbox-only failed check as a warning.

## Итог

- Deleted the exact ten orphan Vue components, two orphan models and one
  production fixture plugin; removed seven caller-free helpers and legacy-only
  test assertions.
- Removed direct Pinia module/dependencies/catalog entries and the resolved
  `@pinia/nuxt`/`pinia` packages via removal-only offline lockfile
  reconciliation; no dependency version changed.
- Public contracts, visible behavior and live UI owners remain unchanged.
- No dependency install/upgrade, snapshot update, push or remote effect was
  performed.
