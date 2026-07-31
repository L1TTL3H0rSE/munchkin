# PLAN: death loot priority ui

- **Plan ID:** `20260731T003716Z-fc6391-death-loot-priority-ui`
- **Статус:** draft
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 00:37:16 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260731T003715Z-361542-death-loot-seat-priority`, `20260731T003716Z-3a0180-player-economy-and-theft-ui`.
- **Блокирует:** `20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`
- **Связанные ADR/handoff:** ADR-0008, `docs/agents/GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/test/deathLootSurface.test.ts",
    "frontend/test/browser/death-loot.spec.ts",
    "frontend/test/browser/visual-baselines/death-loot/**",
    "docs/agents/plans/active/20260731T003716Z-fc6391-death-loot-priority-ui.md",
    "docs/agents/plans/archive/20260731T003716Z-fc6391-death-loot-priority-ui.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "game:death-loot-priority-v1",
    "frontend:generic-interaction-surface-v1",
    "frontend:browser-a11y-harness-v1"
  ],
  "dependsOn": [
    "20260731T003715Z-361542-death-loot-seat-priority",
    "20260731T003716Z-3a0180-player-economy-and-theft-ui"
  ],
  "sharedResources": [
    "frontend:death-loot-priority-v1"
  ]
}
```

## Цель

Добавить privacy-safe death loot priority UI: current looter sees own pick/pass
options and deadline, observers see queue/count/public results, reconnect
restores exact authoritative seat.

## Критерии приёмки

- [ ] Only current priority actor receives selectable loot options; other
  players cannot enumerate pool.
- [ ] Pick/pass sends current descriptor/version and blocks duplicate submit;
  stale/timeout resync never silently retries.
- [ ] Queue/status identifies public current seat/order without implying hidden
  option ownership.
- [ ] Advisory countdown and auto-pass result reuse generic semantics; client
  never advances seat or discards remainder.
- [ ] Confirmed pick/public zone/count update comes only from projection.
- [ ] Pool-empty/all-pass terminal returns focus/context and announces once.
- [ ] Reconnect/offline preserves last projection and reconstructs current
  seat/deadline from fresh GET.
- [ ] Current-looter/observer fixtures and browser tests cover 1–6 players,
  all-pass, pool exhaustion, timeout race, keyboard, zoom and no overflow.

## Контекст и подтверждённое состояние

- Backend seat-priority contract and economy interaction UI are dependencies.

## Scope

### Входит

- Loot options/queue/pass/result UI and unit/browser/a11y/visual tests.

### Не входит

- Backend/priority rules, auctions, resurrection, raw pool/event history.

## Архитектурный подход

1. Reuse generic interaction identity/countdown/controller.
2. Render options only from actor descriptor.
3. Keep observer queue/count projection separate from private pool form.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| interaction/game UI | Loot form/queue/result | Actor-specific projection |
| browser fixtures | Looter/observer states | Redacted pool |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Typed pick/pass |
| `frontend/applications/web/app/components/interaction/**` | write | Loot decision |
| `frontend/applications/web/app/components/game/**` | write | Queue/public result |
| `frontend/applications/web/test/deathLootSurface.test.ts` | write | Unit/privacy tests |
| `frontend/test/browser/death-loot.spec.ts` | write | Browser matrix |
| `frontend/test/browser/visual-baselines/death-loot/**` | generated | Baselines |
| `docs/agents/plans/active/20260731T003716Z-fc6391-death-loot-priority-ui.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003716Z-fc6391-death-loot-priority-ui.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:death-loot-priority-v1` | final UI coverage | этот plan | Final domain UI |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:16 UTC
- **Обнаруженные пересечения:** ordered interaction UI chain only.
- **Решение:** execute after backend/economy UI; Terraform untouched.

## План реализации

1. [ ] Add looter/observer fixtures and view tests.
2. [ ] Implement pick/pass/queue/result surfaces.
3. [ ] Run browser/a11y/visual/full checks and archive.

## Проверки

- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `cd frontend && pnpm test:browser -- death-loot.spec.ts`
- [ ] Cross-actor privacy assertions
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T003716Z-fc6391-death-loot-priority-ui`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** pool leakage/client seat authority. **Снижение:** separate actor
  fixtures and descriptor-only actions.
- **Откат:** frontend revert; server timeout continues safely.

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
