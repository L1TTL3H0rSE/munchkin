# PLAN: generic interaction window ui

- **Plan ID:** `20260731T001853Z-f90fcb-generic-interaction-window-ui`
- **Статус:** completed
- **Создан:** 2026-07-31 00:18:53 UTC
- **Обновлён:** 2026-08-01 07:05:34 +03:00
- **Владелец:** Codex session `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue4-retry`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260731T001853Z-be25a0-combat-response-domain-activation`, `20260731T001853Z-aae2bb-game-session-recovery-controller`, `20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock`.
- **Блокирует:** `20260731T001853Z-40d6e6-combat-helper-offer-ui`
- **Связанные ADR/handoff:** ADR-0008, `docs/agents/GAME_INTERACTION_PROTOCOL.md`, `docs/agents/GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/composables/useInteractionCountdown.ts",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/test/interactionSurface.test.ts",
    "frontend/applications/web/test/interactionCountdown.test.ts",
    "frontend/applications/web/test/gameSessionController.test.ts",
    "frontend/applications/web/test/interactionApi.test.ts",
    "docs/agents/plans/active/20260731T001853Z-f90fcb-generic-interaction-window-ui.md",
    "docs/agents/plans/archive/20260731T001853Z-f90fcb-generic-interaction-window-ui.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "game:combat-response-domain-v1",
    "game:http-v1",
    "game:realtime-v1",
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260731T001853Z-be25a0-combat-response-domain-activation",
    "20260731T001853Z-aae2bb-game-session-recovery-controller",
    "20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock"
  ],
  "sharedResources": [
    "frontend:generic-interaction-surface-v1"
  ]
}
```

## Цель

Добавить reusable player interaction surface поверх actor-specific server
descriptors: persistent inbox, responsive dialog/sheet, advisory countdown,
pass/material response, expired/stale/reconnect states and accessible focus/
live behavior, не вычисляя eligibility, deadline extension или combat outcome
на клиенте.

## Критерии приёмки

- [x] Projection `interaction` является единственным durable source; mount,
  reconnect and route restore reconstruct inbox/surface from fresh GET, not
  stale local modal state.
- [x] Inbox remains visible whenever open interaction exists, including actor
  with only `pass` or no current action; it does not reveal responder count,
  foreign response state or hidden capability.
- [x] Large layout uses centered dialog, compact layout bottom/side sheet, but
  both are one semantic component/state owner and preserve selection/focus on
  responsive resize.
- [x] Actor sees only server-projected actions/sources/targets. UI may validate
  selected descriptor fields for UX but never scans hand/players to invent
  intervention eligibility.
- [x] Submit sends current interaction/action ID, expected version and fresh
  command ID through controller. Duplicate click is blocked; retry of same
  network attempt preserves ID.
- [x] Pass is explicit labeled action and applies only to current projection
  revision. After material invalidation/resync previous pass does not remain
  visually terminal.
- [x] Countdown derives from `deadline_at - server_time` plus monotonic local
  elapsed time, is advisory, clamps at zero and never closes/extends window or
  sends client timeout.
- [x] Updated server deadline atomically replaces countdown; no stacked timers,
  negative display or animation queue. Reduced motion uses static numeric/text.
- [x] Stale version/action, expired and closed responses trigger safe
  classified message + projection resync; UI does not silently resubmit intent.
- [x] Modal mandatory choice cannot Escape/backdrop-dismiss unless a
  server-permitted pass/cancel descriptor exists.
- [x] Initial focus, trap, return focus and dynamic removal are deterministic;
  after close focus returns to inbox trigger, action dock or game context.
- [x] Status changes use bounded `aria-live`; timer does not announce every
  second. Error/expired/offline remain durable, not toast-only.
- [x] Model/controller tests plus browser coverage cover pass-only, material form,
  update revision, expiry, reconnect reconstruction, resize, keyboard and
  reduced motion.
- [x] Full viewport/state browser matrix has no document overflow, clipped
  focus or action dock overlap with surface open.

## Контекст и подтверждённое состояние

- Runtime boundary already exposes absolute deadline/server time, own response
  state and actor-specific generic actions; combat activation plan will add
  real material descriptors.
- Current Vue page ignores `projection.interaction`; no inbox, countdown,
  modal/sheet or interaction submission surface exists.
- GAME_UI_UX_SPEC requires generic windows before helper/reward UI and keeps
  turn action dock separate from interaction inbox.
- Session controller plan owns monotonic projection/reconnect/error lifecycle;
  this plan consumes and minimally extends its typed submit API.
- Responsive table plan establishes regions/safe action dock used for focus
  return and overlay placement.
- Terraform work remains outside frontend paths.

## Scope

### Входит

- Generic interaction inbox and one responsive dialog/sheet implementation.
- Headless descriptor form for pass/material source/target options.
- Advisory countdown, projection revision reconciliation and controller submit.
- Focus, keyboard, live region, offline/stale/expired/reconnect UI states.
- Unit/component/manual browser evidence.

### Не входит

- Helper selection/reward offer form, accepted helper summary or settlement.
- Backend/Zod/HTTP contract changes; plan consumes completed combat contract.
- Additional Monster, Run Away, trade, target effects or domain-specific copy
  not present in descriptors.
- Client timeout, local eligibility, optimistic combat totals/outcome.
- New dialog/carousel dependency, Playwright/axe install, global CSS rewrite.

## Архитектурный подход

1. Keep projection interaction identity/revision as state key; local state is
   only transient selection/open presentation.
2. Separate headless action mapper/countdown from modal/sheet presentation.
3. Submit through session controller so expected version, command ID,
   classified errors and resync are consistent with turn actions.
4. Use monotonic clock for display only and replace from new server metadata.
5. Implement native semantic form/buttons and explicit focus lifecycle; CSS
   scoped under interaction feature.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| interaction components | Inbox/dialog/sheet/form | Consumes actor-specific descriptors |
| countdown composable | Advisory remaining time | No authority or client timeout |
| session controller | Typed interaction submit/resync | Existing HTTP/realtime contract |
| game route | Compose inbox in stable region | No backend model duplication |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/pages/game/[id].vue` | write | Compose interaction surface |
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Typed interaction submit and state |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Preserve interaction command ID and abort signal |
| `frontend/applications/web/app/composables/useInteractionCountdown.ts` | write | Advisory timer owner |
| `frontend/applications/web/app/components/interaction/**` | write | Inbox, form, dialog/sheet surfaces |
| `frontend/applications/web/test/interactionSurface.test.ts` | write | Semantic/state/keyboard coverage |
| `frontend/applications/web/test/interactionCountdown.test.ts` | write | Clock/revision/cleanup tests |
| `frontend/applications/web/test/gameSessionController.test.ts` | write | Interaction error/resync cases |
| `frontend/applications/web/test/interactionApi.test.ts` | write | Interaction command transport options |
| `docs/agents/plans/active/20260731T001853Z-f90fcb-generic-interaction-window-ui.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T001853Z-f90fcb-generic-interaction-window-ui.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:generic-interaction-surface-v1` | helper and later domain UIs | этот plan | Generic lifecycle first |
| `frontend:game-session-controller-v1` | controller | dependency | Extend public submit API only |
| `frontend:responsive-game-table-v1` | layout | dependency | Mount in documented interaction region |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:18:53 UTC
- **Обнаруженные пересечения:** depends on backend contract and both earlier
  frontend plans; later helper UI extends same feature directory. Terraform
  has no overlap.
- **Решение:** start only after all three predecessors are completed and
  pushed; helper UI follows this plan.

## План реализации

1. [x] Use the existing deterministic pass/material/opaque/reconnect fixtures and headless
   mapper/countdown tests.
2. [x] Implement inbox and responsive semantic dialog/sheet.
3. [x] Wire typed submit/error/resync to controller.
4. [x] Complete focus/live/reduced-motion and projection-update behavior.
5. [x] Run unit/full frontend and manual viewport/accessibility matrix.
6. [x] Canonical verify/scope-check and archive.

## Проверки

- [x] `cd frontend && pnpm --filter @munchkin/web test` — 15 files, 95 tests passed.
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build` — passed.
- [x] Browser: interaction fixtures pass-only/material/opaque/helper-offer passed
  at chromium, chromium-tablet and chromium-mobile; the 75-test player UI
  matrix reported 75/75 passed with no overflow. The runner timed out only
  while tearing down Nuxt's dev server after the completed tests.
- [x] Browser: open/pass/material/update/expired/offline/reconnect states and
  keyboard/focus shell, reduced motion, forced colors, responsive overflow
  assertions passed in the existing configured representative viewport
  projects; the interaction component owns the dialog trap/return and
  resize-safe surface.
- [x] Cross-actor check: pass-only actor never receives foreign source/target
  — action mapper consumes only the actor projection.
- [x] `node .codex/hooks/plan-lint.mjs` — `plans=49 active=15 archive=34 issues=0`.
- [x] `./leinoctl verify --changed` — all canonical checks passed, including
  contracts, web, harness, leinoctl, shell syntax, and Compose config.
- [x] `./leinoctl scope-check --plan 20260731T001853Z-f90fcb-generic-interaction-window-ui`
  — `outsideWriteSet=[]`, `missingRequiredChecks=[]`, `ok=true`.
- [x] `git diff --check` — passed.

## Риски и откат

- **Риск:** countdown becomes authority. **Снижение:** display-only composable,
  no timeout request and all close/update from projection.
- **Риск:** modal hides action dock or traps focus after server close.
  **Снижение:** dynamic removal/return owner and short landscape/resize tests.
- **Риск:** stale local selection sends wrong source. **Снижение:** interaction
  identity/version reconciliation and descriptor membership at submit.
- **Откат:** ordinary frontend revert; backend windows continue and timeout
  server-side, so old clients remain functionally safe though less usable.

## Открытые вопросы

- Scope-changing вопросов нет. Generic surface does not render helper reward;
  exact helper UI remains the dependent plan.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:18:53 UTC
- **Подтверждено:** 2026-08-01 06:16:32 +03:00
- **Формулировка/ограничения пользователя:** Пользователь явно одобрил
  batch approval queue в указанном порядке, включая этот plan; после каждого
  plan требуется verify/scope-check, archive и отдельный локальный commit.
  Push не выполнять.

## Ход выполнения

- Generic actor-specific inbox, responsive dialog/sheet, advisory countdown,
  descriptor-only action mapping and controller submission are implemented.
- `useGameApi` now carries the fresh interaction command ID and abort signal;
  the controller preserves that ID across one transient retry and resyncs
  stale/conflicting projections without replaying intent.
- SSR/client startup is mounted on the client and the route has a stable
  hydration shell, removing the previous connection-status hydration warning.
- Existing interaction fixtures were used for pass-only, material, opaque and
  specialized helper states; no backend contract or helper-domain behavior was
  added.

## Фактическая проверка

- Focused and full web tests passed: `15` files / `95` tests.
- Canonical verify passed in session
  `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue4-retry`; scope-check found no
  outside-write-set paths and no missing required checks.
- Browser matrix: all `75/75` player-ui cases passed across Chromium,
  tablet and mobile projects; targeted interaction axe checks passed `4/4`.
  The Playwright wrapper exits with timeout while Nuxt dev-server teardown is
  pending, after the tests have already reported success.

## Итог

Готово. Plan completed; archive and separate local commit are the next
lifecycle actions. Push не выполнялся.
