# PLAN: figma system terminal states

- **Plan ID:** `20260801T225904Z-83bfe1-figma-system-terminal-states`
- **Статус:** approved
- **Создан:** 2026-08-01 22:59:04 UTC
- **Обновлён:** 2026-08-02 12:20:00 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260801T225856Z-b69a1a-frontend-scss-architecture-foundation`, `20260801T225858Z-49b2b8-figma-lobby-shell-rebuild`, `20260801T225859Z-5831ff-figma-game-primitives-view-models`, `20260801T225900Z-2e903a-figma-mobile-game-states`, `20260801T225902Z-564b56-figma-desktop-game-states`, `20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces`, `20260802T115450Z-eef974-frontend-browser-runner-determinism`.
- **Блокирует:** `20260801T225905Z-64608a-frontend-redesign-verification-cleanup`.
- **Связанные ADR/handoff:** Figma lifecycle/system frames, game-session recovery controller v1.

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/app.vue",
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/components/GameConnectionStatus.vue",
    "frontend/applications/web/app/components/game/GameTable.vue",
    "frontend/applications/web/app/components/game/status/**",
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/test/gameApiErrors.test.ts",
    "frontend/applications/web/test/gameSessionController.test.ts",
    "frontend/applications/web/test/realtimeResync.test.ts",
    "frontend/applications/web/test/systemStatePresentation.test.ts",
    "frontend/applications/web/test/fixtures/**",
    "frontend/test/browser/player-ui.spec.ts",
    "frontend/test/browser/real-boundary.spec.ts",
    "frontend/test/browser/visual.spec.ts",
    "frontend/test/browser/visual-baselines/chromium/system-*.png",
    "docs/agents/plans/active/20260801T225904Z-83bfe1-figma-system-terminal-states.md",
    "docs/agents/plans/archive/20260801T225904Z-83bfe1-figma-system-terminal-states.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "pnpm:@munchkin/contracts",
    "frontend:browser-a11y-harness-v1",
    "frontend:game-session-controller-v1"
  ],
  "dependsOn": [
    "20260801T225856Z-b69a1a-frontend-scss-architecture-foundation",
    "20260801T225858Z-49b2b8-figma-lobby-shell-rebuild",
    "20260801T225859Z-5831ff-figma-game-primitives-view-models",
    "20260801T225900Z-2e903a-figma-mobile-game-states",
    "20260801T225902Z-564b56-figma-desktop-game-states",
    "20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces",
    "20260802T115450Z-eef974-frontend-browser-runner-determinism"
  ],
  "sharedResources": [
    "frontend:system-state-ui-v2",
    "frontend:game-session-controller-v1"
  ]
}
```

## Цель

Завершить product-level system, recovery, death and terminal state UX на
mobile/desktop: тихие automatic transitions, ясные actionable failures,
stable last projection during resync, accessible announcements and approved
Figma death/recovery/victory surfaces без инженерных labels.

## Критерии приёмки

- [ ] First load uses layout-stable skeleton/status; no flash of old topbar or
  generic `Состояние игры недоступно` before parsed result.
- [ ] `connecting`/`resyncing` during automatic recovery is a compact non-blocking
  icon/header indicator over the last safe projection, not a large text panel.
- [ ] Automatic reconnect remains automatic with bounded backoff. UI does not
  show a mysterious `Retry Connection` button while retry is already running.
- [ ] Manual retry appears only after terminal recoverable failure, has product
  copy explaining its effect, invokes controller retry and does not pretend to
  refresh the entire page.
- [ ] Offline, reconnecting, stale action, options changed, server update and
  failed connection are distinct typed states with non-color icon/text and no
  raw backend error/credential/version.
- [ ] Last projection remains readable but disabled only where required;
  duplicate `Последнее состояние осталось на экране...` copy is removed.
- [ ] Lost/invalid credential clears only scoped session credential and routes
  to a concise re-entry state; token never appears in message/URL/log.
- [ ] Not found/unavailable/forbidden/finished game have separate safe surfaces
  and one clear navigation/retry action where legal.
- [ ] Death state, death-loot transition, redraw/recovery and observer waiting
  use approved character/table compositions; server projection controls every
  transition.
- [ ] Victory and completed game show winner/final state, disable stale commands
  and offer explicit navigation; no generic action rail remains.
- [ ] Waiting state is quiet contextual feedback, not a permanent full-width
  `Waiting Status Hint`; current actor remains visible in header/opponent state.
- [ ] Motion communicates confirmed projection deltas only, is bounded and has
  equivalent static/live text under `prefers-reduced-motion`.
- [ ] Connection and important game changes use deduplicated polite/assertive
  live regions; no announcement storm on every SSE invalidation.
- [ ] Controller monotonicity, abort cleanup, coalesced resync, invalid envelope,
  gap/reconnect GET and idempotent retry tests remain green.

## Контекст и подтверждённое состояние

- Existing controller already owns initial fetch, SSE invalidation-only stream,
  AbortControllers, monotonic projection, bounded reconnect/backoff and safe
  typed error mapping. This plan primarily changes presentation.
- Current `GameConnectionStatus` is a large text box rendered during loading,
  above every table and on failure. User requested icon-only transient loss and
  questioned redundant manual retry.
- Figma state set includes loading, reconnect, lost session, unavailable,
  finished, death/recovery and victory variants.

## Scope

### Входит

- Typed mapping from controller status/error to product system presentation.
- Loading/recovery/failure/session/terminal/death/victory components and motion.
- Narrow controller/API correction only if UI exposes a real lifecycle mismatch;
  existing public behavior otherwise remains untouched.
- Unit/browser/real-boundary/a11y/visual evidence.

### Не входит

- New reconnect protocol, WebSocket, offline command queue, service worker,
  local authoritative transition or backend schema.
- Toast framework, global notification store, sound/haptics or Card Studio.

## Архитектурный подход

1. Pure status mapper converts typed `GameConnectionState` + safe API error kind
   + projection status into a discriminated presentation state.
2. Route chooses skeleton/table/terminal surface; table header owns compact
   transient status, one live-region owner announces deduplicated changes.
3. Controller stays the only lifecycle authority. Components emit retry/
   navigate intents and never call `location.reload()`.
4. Confirmed motion is triggered by projection version/delta, not optimistic
   commands, and is disabled/replaced semantically for reduced motion.
5. Terminal states remove old actions and focus the primary heading/action.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| route/status mapper | loading/recovery/terminal selection | typed controller state |
| connection status | compact/transient vs actionable failure | safe error taxonomy |
| death/victory surfaces | Figma terminal compositions | server projection only |
| controller tests | preserve lifecycle invariants | invalidation-only SSE |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/app.vue` | write | Stable shell/landmark for terminal routes |
| `frontend/applications/web/app/pages/game/[id].vue` | write | Route-level state selection/focus |
| `frontend/applications/web/app/components/GameConnectionStatus.vue` | write | Compact/actionable status variants |
| `frontend/applications/web/app/components/game/GameTable.vue` | write | Header status/motion integration |
| `frontend/applications/web/app/components/game/status/**` | write | System/death/victory surfaces |
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Narrow lifecycle correction if evidenced |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Preserve safe error mapping if evidenced |
| `frontend/applications/web/test/gameApiErrors.test.ts` | write | Safe error presentation |
| `frontend/applications/web/test/gameSessionController.test.ts` | write | Recovery/session invariants |
| `frontend/applications/web/test/realtimeResync.test.ts` | write | Invalidation/resync regressions |
| `frontend/applications/web/test/systemStatePresentation.test.ts` | write | Pure system-state mapping |
| `frontend/applications/web/test/fixtures/**` | write | Terminal/death/victory cases |
| `frontend/test/browser/player-ui.spec.ts` | write | System-state semantics/a11y |
| `frontend/test/browser/real-boundary.spec.ts` | write | Honest browser-to-Go recovery smoke |
| `frontend/test/browser/visual.spec.ts` | write | Central canonical system captures |
| `frontend/test/browser/visual-baselines/chromium/system-*.png` | generated | Reviewed terminal baselines |
| `docs/agents/plans/active/20260801T225904Z-83bfe1-figma-system-terminal-states.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260801T225904Z-83bfe1-figma-system-terminal-states.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:system-state-ui-v2` | final gate | этот plan | Complete before final matrix |
| `frontend:game-session-controller-v1` | all game plans | existing owner + этот plan | Presentation first; behavior change needs evidence |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 23:00:21 UTC.
- **Обнаруженные пересечения:** route/table/controller shared with earlier UI
  plans; infrastructure drafts do not overlap.
- **Решение:** last product slice after interaction commit; any transport/wire
  expansion is material and stops queue for reapproval.

## План реализации

1. [ ] Enumerate controller/error/projection combinations and expected Figma
   surface, retry/navigation and live-region priority.
2. [ ] Add pure mapping tests, loading skeleton and compact transient status.
3. [ ] Implement terminal failure/session/not-found/finished surfaces.
4. [ ] Implement death/recovery/victory/waiting compositions and focus paths.
5. [ ] Add confirmed motion/static equivalents and deduplicated announcements.
6. [ ] Run lifecycle/unit/browser/real-boundary/a11y/visual/full checks.
7. [ ] Verify/scope-check, archive and separate local commit; no push.

## Проверки

- [ ] Focused API error/controller/realtime/system mapper Vitest suites.
- [ ] Browser: first load, connecting, resync over last state, offline retry,
  auto reconnect success, stale action, session lost, unavailable, finished,
  death/recovery and victory at `360x640` and `1440x900`.
- [ ] Real boundary distinguishes fixture visual tests from browser→Nuxt→Go
  actor projection/reconnect smoke.
- [ ] Credential/raw error/version negative assertions in DOM/artifacts.
- [ ] Live-region dedupe, focus destination, reduced motion, forced colors and
  200% zoom; Axe serious/critical = 0.
- [ ] `visual.spec.ts` sets exact `360x640`/`1440x900` per case, and
  `cd frontend && pnpm test:visual` executes every named `system-*` capture.
- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`.
- [ ] `node .codex/hooks/plan-lint.mjs`.
- [ ] `./leinoctl verify --changed`.
- [ ] `./leinoctl scope-check --plan 20260801T225904Z-83bfe1-figma-system-terminal-states`.
- [ ] `git diff --check`.

## Риски и откат

- **Риск:** presentation disables still-valid action during transient reconnect.
  **Снижение:** controller state matrix and server descriptor reachability test.
- **Риск:** manual retry duplicates automatic loop. **Снижение:** retry control
  only in terminal recoverable state.
- **Риск:** live announcements become noisy. **Снижение:** one deduplicated owner
  keyed by semantic state/version.
- **Риск:** motion implies unconfirmed result. **Снижение:** projection-delta-only
  trigger and static semantic equivalent.
- **Откат:** revert status/terminal commit; protocol and persisted data unchanged.

## Открытые вопросы

- Scope-changing вопросов нет. Existing automatic reconnect is authoritative;
  no button may imply page refresh unless a future explicitly approved flow
  chooses that behavior.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 23:00:21 UTC
- **Подтверждено:** 2026-08-02, user batch approval: exact queue in listed order; push запрещён
- **Дополнительно подтверждено:** 2026-08-02, user разрешил сначала выполнить workflow queue `20260802T115448Z` → `20260802T115450Z` → `20260802T115451Z`; этот UI plan остаётся downstream.
- **Формулировка/ограничения пользователя:** Connection loss should normally be
  an icon over the screen; technical retry/waiting labels were rejected; all
  remaining lifecycle screens should be drawn/implemented consistently. Batch
  approval этой очереди: выполнять exact plan IDs в указанном порядке; push не
  выполнять.

## Ход выполнения

- Draft prepared after controller/error/Figma audit; implementation not started.

## Итог

Заполняется после реализации.
