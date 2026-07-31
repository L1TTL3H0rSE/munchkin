# PLAN: advanced combat effects ui

- **Plan ID:** `20260731T003716Z-a8bca4-advanced-combat-effects-ui`
- **Статус:** draft
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 00:37:16 UTC
- **Владелец:** —
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
    "frontend/applications/web/test/advancedCombatSurface.test.ts",
    "frontend/test/browser/advanced-combat.spec.ts",
    "frontend/test/browser/visual-baselines/advanced-combat/**",
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

- [ ] Own source/target selectors render only server options; UI never scans
  foreign hands or infers legal side/Monster.
- [ ] Additional monsters and realized modifiers update encounter board only
  after projection; pending intent does not change totals/cards.
- [ ] Counter references public opaque effect/action label without exposing
  hidden source before commit.
- [ ] Forced helper UI shows only server-selected legal options/mandatory
  semantics; no decline when descriptor omits it and no reward promise beyond
  typed projection.
- [ ] Material revision resets prior pass/selection and atomically updates
  countdown from projection.
- [ ] Long multi-monster board remains usable at compact widths; action dock,
  sheet/focus and reduced motion reuse existing primitives.
- [ ] Actor/helper/observer fixtures and browser tests prove privacy, stale
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
| `frontend/applications/web/test/advancedCombatSurface.test.ts` | write | Component/privacy tests |
| `frontend/test/browser/advanced-combat.spec.ts` | write | Browser/a11y |
| `frontend/test/browser/visual-baselines/advanced-combat/**` | generated | Reviewed baselines |
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

1. [ ] Add actor fixtures/view-model tests.
2. [ ] Implement advanced descriptor forms and confirmed board updates.
3. [ ] Run browser/a11y/visual/full checks and archive.

## Проверки

- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `cd frontend && pnpm test:browser -- advanced-combat.spec.ts`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T003716Z-a8bca4-advanced-combat-effects-ui`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** optimistic/private combat leak. **Снижение:** projection-only board
  and cross-actor fixtures.
- **Откат:** frontend revert; backend remains authoritative.

## Открытые вопросы

- Scope-changing вопросов нет.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Подготовить оставшиеся планы;
  implementation/select/commit/push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.

## Итог

Заполняется после реализации.
