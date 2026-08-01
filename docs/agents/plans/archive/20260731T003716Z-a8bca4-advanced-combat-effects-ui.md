# PLAN: advanced combat effects ui

- **Plan ID:** `20260731T003716Z-a8bca4-advanced-combat-effects-ui`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-08-01 08:43:19 +03:00
- **Владелец:** Codex session `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue6`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help`, `20260731T001853Z-40d6e6-combat-helper-offer-ui`, `20260731T003716Z-f423ed-player-ui-browser-a11y-harness`.
- **Блокирует:** `20260731T003715Z-20d561-target-effects-and-run-away-ui`
- **Связанные ADR/handoff:** ADR-0008, `docs/agents/GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/test/fixtures/**",
    "frontend/applications/web/test/advancedCombatSurface.test.ts",
    "frontend/test/browser/advanced-combat.spec.ts",
    "frontend/test/browser/visual-baselines/chromium/advanced-combat.png",
    "docs/agents/plans/active/20260731T003716Z-a8bca4-advanced-combat-effects-ui.md",
    "docs/agents/plans/archive/20260731T003716Z-a8bca4-advanced-combat-effects-ui.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "game:advanced-combat-effects-v1",
    "frontend:generic-interaction-surface-v1",
    "frontend:browser-a11y-harness-v1"
  ],
  "dependsOn": [
    "20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help",
    "20260731T001853Z-40d6e6-combat-helper-offer-ui",
    "20260731T003716Z-f423ed-player-ui-browser-a11y-harness"
  ],
  "sharedResources": [
    "frontend:advanced-combat-effects-v1"
  ]
}
```

## Цель

Добавить UI для additional Monster, enhancer/counter and forced help через
готовый generic interaction surface, показывая только actor descriptors and
authoritative realized combat changes.

## Критерии приёмки

- [x] Own source/target selectors render only server options; UI never scans
  foreign hands or infers legal side/Monster.
- [x] Additional monsters and realized modifiers update encounter board only
  after projection; pending intent does not change totals/cards.
- [x] Counter references public opaque effect/action label without exposing
  hidden source before commit.
- [x] Forced helper UI shows only server-selected legal options/mandatory
  semantics; no decline when descriptor omits it and no reward promise beyond
  typed projection.
- [x] Material revision resets prior pass/selection and atomically updates
  countdown from projection.
- [x] Long multi-monster board remains usable at compact widths; action dock,
  sheet/focus and reduced motion reuse existing primitives.
- [x] Actor/helper/observer fixtures and browser tests prove privacy, stale
  descriptor recovery, keyboard, zoom and no overflow.

## Контекст и подтверждённое состояние

- Generic interaction/helper UI and responsive board are dependencies.
- Backend/content contract owns all legality/outcomes.

## Scope

### Входит

- Advanced combat descriptor forms, board/result presentation and tests.

### Не входит

- Backend/contracts, Run Away, economy/death, new timer/modal or optimistic
  outcome.

## Архитектурный подход

1. Extend typed view mapper, not generic transport DTO.
2. Reuse interaction lifecycle/countdown/focus primitives.
3. Render only confirmed projection deltas and public encounter state.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| interaction/game components | Advanced combat forms/board | Backend descriptors |
| browser harness | Actor/privacy fixtures | No hidden data |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Typed submits |
| `frontend/applications/web/app/components/interaction/**` | write | Descriptor forms |
| `frontend/applications/web/app/components/game/**` | write | Encounter/forced-helper result |
| `frontend/applications/web/test/fixtures/**` | write | Advanced actor/privacy projections |
| `frontend/applications/web/test/advancedCombatSurface.test.ts` | write | Component/privacy tests |
| `frontend/test/browser/advanced-combat.spec.ts` | write | Browser/a11y |
| `frontend/test/browser/visual-baselines/chromium/advanced-combat.png` | generated | Reviewed canonical Chromium baseline |
| `docs/agents/plans/active/20260731T003716Z-a8bca4-advanced-combat-effects-ui.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003716Z-a8bca4-advanced-combat-effects-ui.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:advanced-combat-effects-v1` | target UI/final coverage | этот plan | Complete first |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:16 UTC
- **Обнаруженные пересечения:** dependencies serialize generic feature files;
  no Terraform overlap.
- **Решение:** execute after backend/helper UI/harness.

## План реализации

1. [x] Add actor fixtures/view-model tests.
2. [x] Implement advanced descriptor forms and confirmed board updates.
3. [x] Run browser/a11y/visual/full checks and archive.

## Проверки

- [x] `cd frontend && pnpm lint && pnpm check && pnpm build` — passed; web
  suite reports 17 files / 102 tests, contracts checks also pass, and Nuxt
  client/server/Nitro build completes.
- [x] `cd frontend && pnpm test:browser -- advanced-combat.spec.ts` — the
  Chromium board/observer/visual cases pass; after correcting the forced-help
  text locator, a dedicated Chromium run reports `ok 1`. Tablet/mobile
  advanced cases reach the assertions without failure artifacts, but the
  Playwright wrapper exits 124 while tearing down Nuxt, so no inflated full
  matrix pass count is claimed.
- [x] `node .codex/hooks/plan-lint.mjs` — final lifecycle run recorded after
  archive.
- [x] `./leinoctl verify --changed` — passed in session
  `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue6`; contracts, web, shell syntax
  and Compose config gates all completed successfully.
- [x] `./leinoctl scope-check --plan 20260731T003716Z-a8bca4-advanced-combat-effects-ui`
  — `ok=true`, `outsideWriteSet=[]`, `missingRequiredChecks=[]` in session
  `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue6`.
- [x] `git diff --check` — passed.

## Риски и откат

- **Риск:** optimistic/private combat leak. **Снижение:** projection-only board
  and cross-actor fixtures.
- **Откат:** frontend revert; backend remains authoritative.

## Открытые вопросы

- Scope-changing вопросов нет.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** 2026-08-01 07:57:15 +03:00
- **Формулировка/ограничения пользователя:** Пользователь явно одобрил
  batch approval queue в указанном порядке; этот plan выполняется после
  `20260731T001853Z-40d6e6-combat-helper-offer-ui`, проходит собственные
  verify/scope-check, archive и отдельный локальный commit. Push не
  выполнять. Manifest дополнен typed UI fixtures и фактическим Chromium
  baseline path; backend/contracts не изменяются.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- 2026-08-01: plan принят из утверждённой batch queue после commit
  `eab4f47`; fixture и baseline paths уточнены до начала implementation.
- Добавлены typed projection-only advanced combat labels/details, multi-monster
  and public-effect presentation, mandatory forced-helper semantics and
  actor/observer fixtures. Generic interaction revision, countdown, focus,
  responsive dock and reduced-motion primitives остаются общими; optimistic
  combat totals и private target/source inference не добавлялись.
- Добавлен reviewed Chromium baseline
  `frontend/test/browser/visual-baselines/chromium/advanced-combat.png`.
- Full web Vitest сообщает 17 files / 102 tests passed; canonical verify
  завершился успешно. Browser runner имеет известное ограничение teardown:
  после выполнения advanced cases процесс иногда возвращает 124 при остановке
  Nuxt dev server, поэтому это явно отражено в evidence без заявления о
  полном matrix pass.
- Harness сообщает 42/42 passed; `tools/leinoctl` сообщает 68 passed и 1
  platform skip; plan-lint сообщает `plans=49 active=12 archive=37 issues=0`.

## Итог

Implementation, canonical verify и scope-check завершены в отдельной
queue6-сессии; backend/contracts не изменялись. Plan находится в archive и
готов к release до отдельного локального commit; push не выполняется.
