# PLAN: player economy and theft ui

- **Plan ID:** `20260731T003716Z-3a0180-player-economy-and-theft-ui`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-08-01 11:12:00 +03:00
- **Владелец:** Codex session `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue8`
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
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/components/actionModel.ts",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/test/fixtures/fixtureData.ts",
    "frontend/applications/web/test/gameCardInteraction.test.ts",
    "frontend/applications/web/test/gameSessionController.test.ts",
    "frontend/applications/web/test/playerEconomySurface.test.ts",
    "frontend/packages/contracts/src/index.ts",
    "frontend/test/browser/player-economy.spec.ts",
    "frontend/test/browser/visual-baselines/chromium/player-economy-charity-transfer.png",
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

- [x] Trade/gift form lists only own transferable descriptor cards, one legal
  recipient and typed clauses; no foreign hand scan/free-text contract.
- [x] Recipient sees exact party offer with accept/decline; observer sees no
  offered identities before commit.
- [x] Cancel/decline/expired/stale states are durable and projection-driven;
  optimistic UI never moves cards.
- [x] Charity allocator must assign exactly server-required excess cards to
  descriptor recipients; field/group errors are accessible.
- [x] Charity timeout/result shows authoritative allocation/discard and
  reconnect reconstructs current state.
- [x] Theft shows public victim option and own ability/counter descriptors,
  never hidden candidate cards or client RNG control.
- [x] Confirmed transfers update hand/public zones atomically without duplicate
  announcements or stale selection.
- [x] Three-actor fixtures/browser tests cover party/observer privacy, keyboard,
  long offers, timeout, offline, zoom, reduced motion and no overflow.

## Контекст и подтверждённое состояние

- Backend economy/theft contracts and generic target UI are dependencies.
- Existing wire schemas and server descriptors are consumed as-is; the
  frontend adapter exposes the three already-defined economy/theft action
  descriptors to a specialized surface while keeping them out of generic
  command rendering.
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
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Economy descriptor adapter and idempotent options |
| `frontend/applications/web/app/pages/game/[id].vue` | write | Route wiring for specialized submits |
| `frontend/applications/web/app/components/actionModel.ts` | write | Economy action labels |
| `frontend/applications/web/app/components/interaction/**` | write | Offer/allocation/theft forms |
| `frontend/applications/web/app/components/game/**` | write | Confirmed zones/results |
| `frontend/applications/web/test/fixtures/fixtureData.ts` | write | Three-actor economy fixtures |
| `frontend/applications/web/test/gameCardInteraction.test.ts` | write | Typed descriptor regression |
| `frontend/applications/web/test/gameSessionController.test.ts` | write | Idempotent economy submit regression |
| `frontend/applications/web/test/playerEconomySurface.test.ts` | write | Unit/privacy tests |
| `frontend/packages/contracts/src/index.ts` | write | Existing server descriptor projection type |
| `frontend/test/browser/player-economy.spec.ts` | write | Browser matrix |
| `frontend/test/browser/visual-baselines/chromium/player-economy-charity-transfer.png` | generated | Baseline |
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

1. [x] Add party/observer fixtures and view-model tests.
2. [x] Implement trade/gift/charity/theft surfaces.
3. [x] Run browser/a11y/visual/full checks and prepare archive.

## Проверки

- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [x] `cd frontend && pnpm test:browser -- player-economy.spec.ts`
- [x] Cross-actor privacy assertions
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260731T003716Z-3a0180-player-economy-and-theft-ui` — `ok=true`, `outsideWriteSet=[]`, `missingRequiredChecks=[]` in recovery session `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue8`.
- [x] `git diff --check`

## Риски и откат

- **Риск:** offered/stolen identities leak or move optimistically.
  **Снижение:** party fixtures and projection-only ownership.
- **Откат:** frontend revert; backend remains authoritative.

## Открытые вопросы

- Scope-changing вопросов нет; no free-text/auction/account inventory.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** 2026-08-01 09:38:30 +03:00
- **Формулировка/ограничения пользователя:** Подготовить оставшиеся планы;
  пользователь явно одобрил batch approval queue в указанном порядке; этот
  plan выполняется после target/Run Away UI, проходит собственные
  verify/scope-check, archive и отдельный локальный commit. Push не
  выполнять. Backend/contracts не изменяются.

## Ход выполнения

- Draft создан атомарно; plan выбран для session
  `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue8` после завершения предыдущего
  ordered plan.
- Реализован специализированный actor-specific `EconomySurface` и typed
  `economyModel`: gift/trade используют только собственные transferable cards,
  trade requests остаются opaque, theft принимает только server descriptors, а
  charity требует exact allocation/discard mapping.
- `useGameApi` и `useGameSessionController` передают existing wire descriptors
  через отдельные typed methods с expected version, stable idempotency key,
  transient/offline retry и projection-only updates; backend и wire schemas не
  изменялись.
- `InteractionSurface`, `GameTable` и game route подключены к specialized
  submit path; generic action panel не получает economy/theft descriptors.
  Observer offer details remain opaque; counter copy не раскрывает hidden
  candidates.
- Добавлены party/observer/charity/theft fixtures, unit privacy/controller
  tests и browser matrix. Responsive fixes удерживают deck/phase, long charity
  labels/buttons и modal content в viewport при 200% zoom.
- Focused Vitest: 4 files, 26 tests passed. Nuxt typecheck, web ESLint и
  contracts `tsc --noEmit` passed.
- Browser `player-economy.spec.ts`: 15 cases across Chromium 1280, tablet 599
  и mobile 320; 13 passed, 2 skipped because visual baseline is canonical
  Chromium-only. Visual baseline was generated and inspected; no reconnect or
  session-expired overlay is present.
- Final canonical `leinoctl verify --changed` passed with Node 24.14.0/pnpm
  11.9.0 after the responsive CSS edits: frontend 19 files/111 tests,
  contracts 18 tests, lint/typecheck/build, hooks 42/42,
  leinoctl 68 passed/1 platform skip, plan-lint 0 issues and compose config.
- Recovery-session scope-check passed with `ok=true`,
  `outsideWriteSet=[]` and `missingRequiredChecks=[]`; the exact generated
  Chromium baseline is included in the manifest/write set.

## Итог

Implementation, verification and scope-check are complete; the plan is ready
for archive, release and its separate local commit. Push не выполняется.
