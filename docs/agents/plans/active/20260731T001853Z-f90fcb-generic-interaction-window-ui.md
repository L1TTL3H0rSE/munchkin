# PLAN: generic interaction window ui

- **Plan ID:** `20260731T001853Z-f90fcb-generic-interaction-window-ui`
- **Статус:** draft
- **Создан:** 2026-07-31 00:18:53 UTC
- **Обновлён:** 2026-07-31 00:18:53 UTC
- **Владелец:** —
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
    "frontend/applications/web/app/composables/useInteractionCountdown.ts",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/test/interactionSurface.test.ts",
    "frontend/applications/web/test/interactionCountdown.test.ts",
    "frontend/applications/web/test/gameSessionController.test.ts",
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

- [ ] Projection `interaction` является единственным durable source; mount,
  reconnect and route restore reconstruct inbox/surface from fresh GET, not
  stale local modal state.
- [ ] Inbox remains visible whenever open interaction exists, including actor
  with only `pass` or no current action; it does not reveal responder count,
  foreign response state or hidden capability.
- [ ] Large layout uses centered dialog, compact layout bottom/side sheet, but
  both are one semantic component/state owner and preserve selection/focus on
  responsive resize.
- [ ] Actor sees only server-projected actions/sources/targets. UI may validate
  selected descriptor fields for UX but never scans hand/players to invent
  intervention eligibility.
- [ ] Submit sends current interaction/action ID, expected version and fresh
  command ID through controller. Duplicate click is blocked; retry of same
  network attempt preserves ID.
- [ ] Pass is explicit labeled action and applies only to current projection
  revision. After material invalidation/resync previous pass does not remain
  visually terminal.
- [ ] Countdown derives from `deadline_at - server_time` plus monotonic local
  elapsed time, is advisory, clamps at zero and never closes/extends window or
  sends client timeout.
- [ ] Updated server deadline atomically replaces countdown; no stacked timers,
  negative display or animation queue. Reduced motion uses static numeric/text.
- [ ] Stale version/action, expired and closed responses trigger safe
  classified message + projection resync; UI does not silently resubmit intent.
- [ ] Modal mandatory choice cannot Escape/backdrop-dismiss unless a
  server-permitted pass/cancel descriptor exists.
- [ ] Initial focus, trap, return focus and dynamic removal are deterministic;
  after close focus returns to inbox trigger, action dock or game context.
- [ ] Status changes use bounded `aria-live`; timer does not announce every
  second. Error/expired/offline remain durable, not toast-only.
- [ ] Component tests cover pass-only, material form, no-action opaque window,
  update revision, expiry, reconnect reconstruction, resize, keyboard and
  reduced motion.
- [ ] Full viewport/state browser matrix has no document overflow, clipped
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
| `frontend/applications/web/app/composables/useInteractionCountdown.ts` | write | Advisory timer owner |
| `frontend/applications/web/app/components/interaction/**` | write | Inbox, form, dialog/sheet surfaces |
| `frontend/applications/web/test/interactionSurface.test.ts` | write | Semantic/state/keyboard coverage |
| `frontend/applications/web/test/interactionCountdown.test.ts` | write | Clock/revision/cleanup tests |
| `frontend/applications/web/test/gameSessionController.test.ts` | write | Interaction error/resync cases |
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

1. [ ] Add deterministic pass/material/opaque/reconnect fixtures and headless
   mapper/countdown tests.
2. [ ] Implement inbox and responsive semantic dialog/sheet.
3. [ ] Wire typed submit/error/resync to controller.
4. [ ] Complete focus/live/reduced-motion and projection-update behavior.
5. [ ] Run unit/full frontend and manual viewport/accessibility matrix.
6. [ ] Canonical verify/scope-check and archive.

## Проверки

- [ ] `cd frontend && pnpm --filter @munchkin/web test`
- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] Browser: open/pass/material/update/expired/offline/reconnect states at
  `320×568`, `374×812`, `599×960`, `667×375`, `768×1024`, `1024×768`,
  `1280×720`, `1440×900`, with used N-1/N/N+1
- [ ] Browser: keyboard trap/return, resize while open, coarse pointer,
  200% zoom, reduced motion, forced colors, root overflow assertion
- [ ] Cross-actor check: pass-only actor never receives foreign source/target
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T001853Z-f90fcb-generic-interaction-window-ui`
- [ ] `git diff --check`

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

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:18:53 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Пользователь попросил подготовить
  backend/frontend plans параллельно фоновой Terraform-работе; implementation,
  selection, commit и push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Frontend skill and accepted UI/protocol specs fixed authority, timer, focus,
  privacy and responsive acceptance.

## Итог

Заполняется после реализации.
