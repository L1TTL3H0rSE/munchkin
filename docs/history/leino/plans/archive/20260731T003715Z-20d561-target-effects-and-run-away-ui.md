# PLAN: target effects and run away ui

- **Plan ID:** `20260731T003715Z-20d561-target-effects-and-run-away-ui`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:15 UTC
- **Обновлён:** 2026-08-01 09:32:52 +03:00
- **Владелец:** Codex session `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue7`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260731T003716Z-81b06c-target-effects-and-run-away-interactions`, `20260731T003716Z-a8bca4-advanced-combat-effects-ui`.
- **Блокирует:** `20260731T003716Z-3a0180-player-economy-and-theft-ui`
- **Связанные ADR/handoff:** ADR-0008, `docs/agents/GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/packages/contracts/src/index.ts",
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/components/ActionPanel.vue",
    "frontend/applications/web/app/components/actionModel.ts",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/test/fixtures/**",
    "frontend/applications/web/test/targetRunAwaySurface.test.ts",
    "frontend/test/browser/target-run-away.spec.ts",
    "frontend/test/browser/visual-baselines/chromium/target-run-away.png",
    "docs/agents/plans/active/20260731T003715Z-20d561-target-effects-and-run-away-ui.md",
    "docs/agents/plans/archive/20260731T003715Z-20d561-target-effects-and-run-away-ui.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "game:target-and-run-away-interactions-v1",
    "frontend:generic-interaction-surface-v1",
    "frontend:browser-a11y-harness-v1"
  ],
  "dependsOn": [
    "20260731T003716Z-81b06c-target-effects-and-run-away-interactions",
    "20260731T003716Z-a8bca4-advanced-combat-effects-ui"
  ],
  "sharedResources": [
    "frontend:target-run-away-ui-v1"
  ]
}
```

## Цель

Добавить actor-private target choices/counters and multi-step Run Away UI,
показывая server-owned roll/outcome and deadline without client RNG/defaults.

## Критерии приёмки

- [x] Initiator target selector contains only descriptor IDs; target private
  choices never appear to observers.
- [x] Mandatory choices cannot dismiss unless server action permits; errors
  focus linked controls and timeout result comes from projection.
- [x] Counter surface stays opaque/pass-capable and does not reveal who holds
  a response.
- [x] Run Away shows current participant/encounter step, advisory deadline and
  server-confirmed D6/modifiers/result; no roll button payload chooses RNG.
- [x] Multi-monster sequence preserves authoritative order and reconnects to
  exact current step.
- [x] Bad Stuff/death transition replaces UI atomically from projection.
- [x] Browser/privacy tests cover initiator/target/observer, long options,
  timeout, reconnect, keyboard, zoom, reduced motion and no overflow.

## Контекст и подтверждённое состояние

- Backend target/Run Away contract and advanced generic interaction UI are
  dependencies; the frontend typed projection alias now exposes the already
  completed `play_target_effect` descriptor without changing backend protocol.

## Scope

### Входит

- Target/private choice/counter and Run Away step/result presentation/tests.

### Не входит

- Backend/engine/RNG/protocol DTOs, economy/death loot, local timeout or new
  modal primitive.

## Архитектурный подход

1. Map actor descriptors into controlled forms.
2. Reuse generic mandatory dialog/countdown/controller.
3. Render roll/outcome only from confirmed projection.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| interaction/game UI | Target and escape surfaces | Actor projection only |
| browser fixtures | Three-actor/step coverage | Privacy-safe |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/packages/contracts/src/index.ts` | write | Expose completed target action descriptor to typed consumer |
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Typed submits |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Accept completed target descriptor from projection |
| `frontend/applications/web/app/components/ActionPanel.vue` | write | Descriptor-only target selector |
| `frontend/applications/web/app/components/actionModel.ts` | write | Target action label/payload mapping |
| `frontend/applications/web/app/components/interaction/**` | write | Choice/counter forms |
| `frontend/applications/web/app/components/game/**` | write | Escape/result context |
| `frontend/applications/web/test/fixtures/**` | write | Actor/step projections |
| `frontend/applications/web/test/targetRunAwaySurface.test.ts` | write | Unit/privacy tests |
| `frontend/test/browser/target-run-away.spec.ts` | write | Browser matrix |
| `frontend/test/browser/visual-baselines/chromium/target-run-away.png` | generated | Reviewed Chromium baseline |
| `docs/agents/plans/active/20260731T003715Z-20d561-target-effects-and-run-away-ui.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003715Z-20d561-target-effects-and-run-away-ui.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:target-run-away-ui-v1` | economy/final UI | этот plan | Complete first |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:15 UTC
- **Обнаруженные пересечения:** ordered interaction UI feature chain only.
- **Решение:** execute after backend and advanced UI; Terraform untouched.

## План реализации

1. [x] Add actor/step fixtures and form tests.
2. [x] Implement target/counter/Run Away surfaces.
3. [x] Run browser/a11y/visual/full checks and archive.

## Проверки

- [x] `cd frontend && pnpm lint && pnpm check && pnpm build` — passed through
  canonical Node 24/pnpm verify; web reports 18 files / 107 tests, contracts
  18 tests, and Nuxt client/server/Nitro build completes.
- [x] `cd frontend && pnpm test:browser -- target-run-away.spec.ts` — the
  Chromium target-initiator and visual cases report `ok 1` in dedicated
  single-worker runs; the Chromium tablet target/run-away matrix reports
  `ok 6`. The wrapper exits 124 while tearing down Nuxt, so no inflated full
  matrix pass count is claimed; the focused assertion runs themselves pass.
- [x] `node .codex/hooks/plan-lint.mjs` — pre-archive lifecycle run reports
  `plans=49 active=12 archive=37 issues=0`.
- [x] `./leinoctl verify --changed` — passed in session
  `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue7`; contracts, web, harness,
  tools, shell syntax, plan-lint and Compose config gates all completed.
- [x] `./leinoctl scope-check --plan 20260731T003715Z-20d561-target-effects-and-run-away-ui`
  — `ok=true`, `outsideWriteSet=[]`, `missingRequiredChecks=[]` in session
  `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue7`; the report also notes that
  changed paths were not recorded by a post-write hook in this desktop run.
- [x] `git diff --check` — passed.

## Риски и откат

- **Риск:** private option/RNG inference. **Снижение:** actor fixtures and
  projection-only outcome.
- **Откат:** frontend revert; server deadlines/defaults continue safely.

## Открытые вопросы

- Scope-changing вопросов нет.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:15 UTC
- **Подтверждено:** 2026-08-01 08:58:00 +03:00
- **Формулировка/ограничения пользователя:** Подготовить оставшиеся планы;
  пользователь явно одобрил batch approval queue в указанном порядке; этот
  plan выполняется после advanced combat UI, проходит собственные
  verify/scope-check, archive и отдельный локальный commit. Push не
  выполнять. Backend/engine/protocol contracts не изменяются; frontend
  typed projection alias may expose the existing completed descriptor.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- 2026-08-01: plan принят из утверждённой batch queue после commit
  `40edc7c`; target/Run Away write set уточнён до фактических typed consumer,
  fixture, browser and reviewed baseline paths.
- Добавлены actor-specific target initiator/response/private-choice/observer
  fixtures, descriptor-only target payload tests, opaque counter labels and
  mandatory private-choice behavior.
- Добавлены projection-only Run Away current-step, ordered attempt, modifier,
  D6/result and Bad Stuff surfaces; no client roll/default outcome is emitted.
- Добавлены responsive browser/privacy cases for initiator/target/observer,
  long private options, keyboard dismissal policy, reduced motion/forced colors,
  compact-width overflow and ordered multi-monster results.
- Добавлен reviewed Chromium baseline
  `frontend/test/browser/visual-baselines/chromium/target-run-away.png`;
  visual run reports `ok 1`. Playwright's existing Nuxt teardown returns 124
  after assertions, recorded without treating it as an assertion failure.
- Canonical verify reports 42/42 harness tests, 68/69 leinoctl tests with one
  platform skip, web 18 files / 107 tests, contracts 18 tests and plan-lint
  without issues. Final post-archive plan-lint reports
  `plans=49 active=11 archive=38 issues=0`.

## Итог

Implementation, canonical verify and browser evidence completed in the
separate queue7 session; backend engine/protocol contracts remain unchanged.
Plan is archived and scope-checked; release is pending its separate local
commit. Push is not performed.
