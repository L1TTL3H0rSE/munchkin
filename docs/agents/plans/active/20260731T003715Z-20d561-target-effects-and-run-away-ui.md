# PLAN: target effects and run away ui

- **Plan ID:** `20260731T003715Z-20d561-target-effects-and-run-away-ui`
- **Статус:** draft
- **Создан:** 2026-07-31 00:37:15 UTC
- **Обновлён:** 2026-07-31 00:37:15 UTC
- **Владелец:** —
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
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/test/targetRunAwaySurface.test.ts",
    "frontend/test/browser/target-run-away.spec.ts",
    "frontend/test/browser/visual-baselines/target-run-away/**",
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

- [ ] Initiator target selector contains only descriptor IDs; target private
  choices never appear to observers.
- [ ] Mandatory choices cannot dismiss unless server action permits; errors
  focus linked controls and timeout result comes from projection.
- [ ] Counter surface stays opaque/pass-capable and does not reveal who holds
  a response.
- [ ] Run Away shows current participant/encounter step, advisory deadline and
  server-confirmed D6/modifiers/result; no roll button payload chooses RNG.
- [ ] Multi-monster sequence preserves authoritative order and reconnects to
  exact current step.
- [ ] Bad Stuff/death transition replaces UI atomically from projection.
- [ ] Browser/privacy tests cover initiator/target/observer, long options,
  timeout, reconnect, keyboard, zoom, reduced motion and no overflow.

## Контекст и подтверждённое состояние

- Backend target/Run Away contract and advanced generic interaction UI are
  dependencies.

## Scope

### Входит

- Target/private choice/counter and Run Away step/result presentation/tests.

### Не входит

- Backend/RNG, economy/death loot, local timeout or new modal primitive.

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
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Typed submits |
| `frontend/applications/web/app/components/interaction/**` | write | Choice/counter forms |
| `frontend/applications/web/app/components/game/**` | write | Escape/result context |
| `frontend/applications/web/test/targetRunAwaySurface.test.ts` | write | Unit/privacy tests |
| `frontend/test/browser/target-run-away.spec.ts` | write | Browser matrix |
| `frontend/test/browser/visual-baselines/target-run-away/**` | generated | Baselines |
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

1. [ ] Add actor/step fixtures and form tests.
2. [ ] Implement target/counter/Run Away surfaces.
3. [ ] Run browser/a11y/visual/full checks and archive.

## Проверки

- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `cd frontend && pnpm test:browser -- target-run-away.spec.ts`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T003715Z-20d561-target-effects-and-run-away-ui`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** private option/RNG inference. **Снижение:** actor fixtures and
  projection-only outcome.
- **Откат:** frontend revert; server deadlines/defaults continue safely.

## Открытые вопросы

- Scope-changing вопросов нет.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:37:15 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Подготовить оставшиеся планы;
  implementation/select/commit/push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.

## Итог

Заполняется после реализации.
