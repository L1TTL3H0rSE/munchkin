# PLAN: death loot priority ui

- **Plan ID:** `20260731T003716Z-fc6391-death-loot-priority-ui`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-08-01 12:02:00 +03:00
- **Владелец:** Codex session `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue8`
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
    "frontend/applications/web/test/fixtures/fixtureData.ts",
    "frontend/applications/web/test/deathLootSurface.test.ts",
    "frontend/test/browser/death-loot.spec.ts",
    "frontend/test/browser/visual-baselines/chromium/death-loot-actor.png",
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

- [x] Only current priority actor receives selectable loot options; other
  players cannot enumerate pool.
- [x] Pick/pass sends current descriptor/version and blocks duplicate submit;
  stale/timeout resync never silently retries.
- [x] Queue/status exposes projection-backed public participant order and
  identifies the current actor only when `response_required_for_you` is true;
  observer seat identity remains hidden by the existing contract.
- [x] Advisory countdown and auto-pass result reuse generic semantics; client
  never advances seat or discards remainder.
- [x] Confirmed pick/public zone/count update comes only from projection; the
  closure notice does not invent a result when the server removes the window.
- [x] Pool-empty/all-pass closure returns focus/context and announces once when
  a newer projection removes the interaction.
- [x] Reconnect/offline preserves last projection and reconstructs current
  seat/deadline from fresh GET.
- [x] Current-looter/observer/terminal fixtures and browser tests cover the
  one-player empty-pool and six-player privacy surfaces,
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
| `frontend/applications/web/test/fixtures/fixtureData.ts` | write | Actor/observer/terminal privacy fixtures |
| `frontend/applications/web/test/deathLootSurface.test.ts` | write | Unit/privacy tests |
| `frontend/test/browser/death-loot.spec.ts` | write | Browser matrix |
| `frontend/test/browser/visual-baselines/chromium/death-loot-actor.png` | generated | Canonical Chromium baseline |
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

1. [x] Add looter/observer/terminal fixtures and view tests.
2. [x] Implement pick/pass/queue/result surfaces.
3. [x] Run browser/a11y/visual/full checks and archive.

## Проверки

- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [x] `cd frontend && pnpm test:browser -- death-loot.spec.ts`
- [x] Cross-actor privacy assertions
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260731T003716Z-fc6391-death-loot-priority-ui`
- [x] `git diff --check`

## Риски и откат

- **Риск:** pool leakage/client seat authority. **Снижение:** separate actor
  fixtures and descriptor-only actions.
- **Откат:** frontend revert; server timeout continues safely.

## Открытые вопросы

- Scope-changing вопросов нет.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** 2026-08-01 11:28:07 +03:00
- **Формулировка/ограничения пользователя:** Пользователь явно одобрил
  продолжение планов #9 и #10 в утверждённом порядке; для каждого разрешены
  implementation, verify/scope-check, archive и отдельный local commit. Push
  не выполнять.

## Ход выполнения

- Реализированы `DeathLootSurface`, descriptor-only `deathLootModel`, actor/
  observer/all-pass/single-player fixtures и privacy/browser tests.
- `InteractionSurface` повторно использует generic controller/countdown/CAS:
  pick/pass не меняют projection оптимистично, duplicate submit блокируется
  существующим `busy`, stale/offline retry не повторяет intent после resync.
- Добавлен closure notice: после более новой projection без interaction он
  возвращает focus на live-region и не придумывает pool/result.
- Проверено: web tests 116/116, lint без warnings, typecheck, production build,
  browser 16 passed / 2 skipped на Chromium/Tablet/Mobile, `plan-lint`,
  canonical `verify --changed`, visual baseline и `git diff --check`.
- Контрактное ограничение для отдельного решения: текущая server projection
  не публикует `seat_order/current seat` observer'у, а после terminal closure
  удаляет `death_loot` из projection. Поэтому UI показывает только
  projection-backed public participants, actor status и closure notice; public
  seat order/result history нельзя безопасно восстановить клиентом без
  расширения backend/contracts scope.

## Итог

Frontend death-loot priority UI реализован и проверен в пределах утверждённого
write set. Actor получает только descriptor-backed pick/pass controls; observer
видит counts и public participants без identities pool; duplicate/stale/offline
семантика переиспользует generic controller. Closure notice возвращает focus и
не выдумывает terminal result при исчезновении interaction из authoritative
projection. Backend seat order и terminal result history намеренно не менялись:
их публикация требует отдельного contract/backend plan.
