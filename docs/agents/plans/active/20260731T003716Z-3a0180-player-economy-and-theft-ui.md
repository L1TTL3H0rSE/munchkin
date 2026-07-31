# PLAN: player economy and theft ui

- **Plan ID:** `20260731T003716Z-3a0180-player-economy-and-theft-ui`
- **Статус:** draft
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 00:37:16 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260731T003716Z-5adc34-trade-gift-and-charity-transfer`, `20260731T003716Z-105e5a-theft-contested-resolution`, `20260731T003715Z-20d561-target-effects-and-run-away-ui`.
- **Блокирует:** `20260731T003716Z-fc6391-death-loot-priority-ui`
- **Связанные ADR/handoff:** ADR-0008, `docs/agents/GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/test/playerEconomySurface.test.ts",
    "frontend/test/browser/player-economy.spec.ts",
    "frontend/test/browser/visual-baselines/player-economy/**",
    "docs/agents/plans/active/20260731T003716Z-3a0180-player-economy-and-theft-ui.md",
    "docs/agents/plans/archive/20260731T003716Z-3a0180-player-economy-and-theft-ui.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "game:player-economy-v1",
    "game:theft-resolution-v1",
    "frontend:generic-interaction-surface-v1",
    "frontend:browser-a11y-harness-v1"
  ],
  "dependsOn": [
    "20260731T003716Z-5adc34-trade-gift-and-charity-transfer",
    "20260731T003716Z-105e5a-theft-contested-resolution",
    "20260731T003715Z-20d561-target-effects-and-run-away-ui"
  ],
  "sharedResources": [
    "frontend:player-economy-theft-v1"
  ]
}
```

## Цель

Добавить party-private trade/gift, mandatory charity allocation and opaque
theft UI, используя только server descriptors and confirmed ownership/count
updates.

## Критерии приёмки

- [ ] Trade/gift form lists only own transferable descriptor cards, one legal
  recipient and typed clauses; no foreign hand scan/free-text contract.
- [ ] Recipient sees exact party offer with accept/decline; observer sees no
  offered identities before commit.
- [ ] Cancel/decline/expired/stale states are durable and projection-driven;
  optimistic UI never moves cards.
- [ ] Charity allocator must assign exactly server-required excess cards to
  descriptor recipients; field/group errors are accessible.
- [ ] Charity timeout/result shows authoritative allocation/discard and
  reconnect reconstructs current state.
- [ ] Theft shows public victim option and own ability/counter descriptors,
  never hidden candidate cards or client RNG control.
- [ ] Confirmed transfers update hand/public zones atomically without duplicate
  announcements or stale selection.
- [ ] Three-actor fixtures/browser tests cover party/observer privacy, keyboard,
  long offers, timeout, offline, zoom, reduced motion and no overflow.

## Контекст и подтверждённое состояние

- Backend economy/theft contracts and generic target UI are dependencies.
- Guest players and game-scoped inventory remain; no account marketplace.

## Scope

### Входит

- Trade/gift/charity/theft forms/results and unit/browser/a11y/visual tests.

### Не входит

- Backend/contracts, death loot, chat/auction, account inventory or client RNG.

## Архитектурный подход

1. Build party-specific view models from strict descriptors.
2. Reuse generic interaction/controller/countdown/focus.
3. Clear forms on interaction/version/options change.
4. Render movement only from confirmed projection.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| interaction/game UI | Economy/theft forms/results | Party DTO only |
| browser fixtures | Three-actor privacy matrix | No hidden inventory |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Typed submits |
| `frontend/applications/web/app/components/interaction/**` | write | Offer/allocation/theft forms |
| `frontend/applications/web/app/components/game/**` | write | Confirmed zones/results |
| `frontend/applications/web/test/playerEconomySurface.test.ts` | write | Unit/privacy tests |
| `frontend/test/browser/player-economy.spec.ts` | write | Browser matrix |
| `frontend/test/browser/visual-baselines/player-economy/**` | generated | Baselines |
| `docs/agents/plans/active/20260731T003716Z-3a0180-player-economy-and-theft-ui.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003716Z-3a0180-player-economy-and-theft-ui.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:player-economy-theft-v1` | death/final UI | этот plan | Complete first |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:16 UTC
- **Обнаруженные пересечения:** ordered interaction UI chain only.
- **Решение:** execute after both backend contracts and target UI.

## План реализации

1. [ ] Add party/observer fixtures and view-model tests.
2. [ ] Implement trade/gift/charity/theft surfaces.
3. [ ] Run browser/a11y/visual/full checks and archive.

## Проверки

- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `cd frontend && pnpm test:browser -- player-economy.spec.ts`
- [ ] Cross-actor privacy assertions
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T003716Z-3a0180-player-economy-and-theft-ui`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** offered/stolen identities leak or move optimistically.
  **Снижение:** party fixtures and projection-only ownership.
- **Откат:** frontend revert; backend remains authoritative.

## Открытые вопросы

- Scope-changing вопросов нет; no free-text/auction/account inventory.

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
