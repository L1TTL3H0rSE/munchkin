# PLAN: responsive game table and action dock

- **Plan ID:** `20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock`
- **Статус:** draft
- **Создан:** 2026-07-31 00:18:53 UTC
- **Обновлён:** 2026-07-31 00:18:53 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation`, `20260731T001853Z-aae2bb-game-session-recovery-controller`.
- **Блокирует:** `20260731T001853Z-f90fcb-generic-interaction-window-ui`
- **Связанные ADR/handoff:** `docs/agents/GAME_UI_UX_SPEC.md`, `docs/agents/FRONTEND_ENGINEERING_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/components/ActionPanel.vue",
    "frontend/applications/web/app/components/actionModel.ts",
    "frontend/applications/web/app/components/GameCard.vue",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/app/assets/main.css",
    "frontend/applications/web/test/actionModel.test.ts",
    "frontend/applications/web/test/gameTableViewModel.test.ts",
    "docs/agents/plans/active/20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock.md",
    "docs/agents/plans/archive/20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation",
    "20260731T001853Z-aae2bb-game-session-recovery-controller"
  ],
  "sharedResources": [
    "frontend:responsive-game-table-v1",
    "frontend:persistent-action-dock-v1"
  ]
}
```

## Цель

Реализовать player-facing game table из принятой UI/UX spec: устойчивую
mobile/tablet/desktop композицию для 1–6 игроков, читаемый encounter/context,
bounded hand с full-hand alternative и persistent server-action dock — без
локального вычисления legality и без изменения backend contracts.

## Критерии приёмки

- [ ] Game route делегирует presentation отдельным cohesive components; page
  не возвращает transport/reconnect logic после controller plan.
- [ ] На `320px` default layout single-column, document overflow отсутствует,
  encounter/context and critical action остаются доступны без horizontal page
  scroll.
- [ ] На tablet/desktop regions переходят только на canonical content-driven
  boundaries; каждый реально используемый N проверен на `N-1/N/N+1`.
- [ ] 1–6 opponents имеют stable density: compact public summary never leaks
  hand contents; detailed public zones открываются semantic button/disclosure
  or sheet, not hover-only UI.
- [ ] Encounter/combat totals/phase and current actor form one stable context
  hierarchy; long Russian copy, missing art and large values wrap without
  clipping.
- [ ] Own hand uses bounded rail with visible continuation affordance and
  keyboard/touch navigation plus `Показать всю руку` grid/sheet alternative
  using the same card instances and selection state.
- [ ] Equipped/carried/traits remain separate semantic zones; empty states do
  not collapse headings/focus unpredictably.
- [ ] Action dock consumes only server `available_actions`, remains reachable
  after long content, respects safe-area/virtual keyboard and never ranks or
  invents multiple actions.
- [ ] Pending action has explicit status separate from invalid/disabled;
  duplicate submit blocked and focus returns to stable action/context after
  projection replacement.
- [ ] Selection reconciliation survives action descriptor replacement and
  removes stale source/target IDs without mutating server projection.
- [ ] Compact sheet/dialog patterns implement initial focus, trap, close,
  return focus and resize preservation; mandatory server decisions are not
  dismissible unless descriptor permits.
- [ ] Component styles are scoped/feature-owned; old gameplay selectors are
  removed from global `main.css` without unrelated Studio reformat.
- [ ] Browser evidence covers viewport matrix, 1/3/6 players, long copy,
  keyboard, coarse pointer, fine hover, 200% zoom, reduced motion, forced
  colors and short landscape.

## Контекст и подтверждённое состояние

- Safe shell plan fixed root 320 overflow, skip navigation, canonical
  boundaries, focus-visible, safe-area/dvh and reduced-motion foundation.
- Current game page renders opponents, table, action bar and all own zones in
  one large template; `main.css` owns gameplay and Studio selectors together.
- Hand/actions/public cards use accidental horizontal rails without complete
  keyboard/full-view evidence.
- Current `ActionPanel` already maps server descriptors through pure
  `actionModel.ts`; this authority boundary remains.
- GAME_UI_UX_SPEC chooses tactical street table, bounded hand + full-hand
  sheet and persistent action surface. Interaction inbox is a later slice.
- Terraform plan has no frontend overlap.

## Scope

### Входит

- Responsive game regions, opponent density, encounter/context and own zones.
- Hand browser/full-hand sheet and persistent action dock.
- Pure view-model helpers, selection reconciliation and component styles.
- Removal of only migrated gameplay CSS from global sheet.
- Recorded manual browser/a11y evidence using deterministic parsed
  projections or real local backend.

### Не входит

- Lobby entry redesign, Card Studio/admin surfaces.
- Backend/Zod/HTTP changes, interaction/helper UI or new domain mechanics.
- New UI framework, carousel dependency, icons/fonts/art or copied theme.
- Playwright/axe/snapshot dependency and CI platform policy.
- Motion polish beyond reduced/static transitions required for usability.

## Архитектурный подход

1. Derive readonly view models from parsed projection; do not copy server state
   into writable store.
2. Split by responsibilities: table context, opponent roster, own zones, hand
   browser and action dock.
3. Use mobile-first scoped CSS with intrinsic grid/flex and semantic tokens
   from existing foundation; no query-per-device.
4. Reuse one selection owner between rail/grid/sheet so responsive presentation
   does not fork action state.
5. Use native buttons/disclosures/forms first; custom modal sheet implements
   complete keyboard/focus lifecycle.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| game route/components | Responsive composition and surface ownership | Readonly existing projection |
| action panel/model | Persistent dock and stable selection | Existing server descriptors only |
| gameplay CSS | Scoped table/hand/action styles | Existing breakpoint foundation |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/pages/game/[id].vue` | write | Compose responsive feature surfaces |
| `frontend/applications/web/app/components/ActionPanel.vue` | write | Persistent accessible action form |
| `frontend/applications/web/app/components/actionModel.ts` | write | Shared stable selection/view model |
| `frontend/applications/web/app/components/GameCard.vue` | write | Responsive content/focus affordances |
| `frontend/applications/web/app/components/game/**` | write | Table, roster, hand and dock owners |
| `frontend/applications/web/app/assets/main.css` | write | Remove migrated gameplay selectors only |
| `frontend/applications/web/test/actionModel.test.ts` | write | Reconciliation regressions |
| `frontend/applications/web/test/gameTableViewModel.test.ts` | write | Density/layout view-model fixtures |
| `docs/agents/plans/active/20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:responsive-game-table-v1` | interaction/helper surfaces | этот plan | Establish regions before overlay surfaces |
| `frontend:persistent-action-dock-v1` | generic interaction UI | этот plan | Keep turn actions separate from interaction inbox |
| `frontend:game-session-controller-v1` | controller plan | dependency | Consume readonly public API |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:18:53 UTC
- **Обнаруженные пересечения:** predecessor and later interaction drafts touch
  game route; Terraform does not.
- **Решение:** complete controller first; this plan then establishes final
  region/component APIs consumed by interaction plans.

## План реализации

1. [ ] Add deterministic view models/fixtures for 1/3/6 players and long copy.
2. [ ] Split responsive table/context/opponent/own-zone components.
3. [ ] Implement bounded hand + full-hand sheet with shared selection.
4. [ ] Implement persistent action dock and pending/focus semantics.
5. [ ] Migrate gameplay styles from global sheet to component ownership.
6. [ ] Run unit/full frontend gates and complete recorded browser matrix.
7. [ ] Canonical verify/scope-check and archive.

## Проверки

- [ ] `cd frontend && pnpm --filter @munchkin/web test`
- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] Browser widths: `320×568`, `360×800`, `374×812`, `375×667`,
  `427×926`, `428×926`, `599×960`, `600×960`, `667×375`, `768×1024`,
  `1024×768`, `1280×720`, `1440×900`, `1900×1080`
- [ ] Browser N-1/N/N+1 for every used breakpoint; assert
  `scrollWidth <= clientWidth`
- [ ] Keyboard/full-hand/action focus, coarse touch, fine hover, reduced
  motion, forced colors, 200% zoom and safe-area/virtual-keyboard smoke
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** visual refactor changes action authority. **Снижение:** same parsed
  descriptors/payload mapper and semantic assertions before style changes.
- **Риск:** sticky dock hides cards/focus. **Снижение:** safe-area spacing,
  short landscape/keyboard tests and no fixed magic height.
- **Риск:** responsive sheet forks selection. **Снижение:** one headless owner,
  presentation-only rail/grid/sheet.
- **Откат:** ordinary frontend revert; no backend, wire, persisted data or
  lockfile change.

## Открытые вопросы

- Scope-changing вопросов нет. New browser automation remains its own future
  tooling plan; this slice records manual evidence honestly.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:18:53 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Пользователь попросил подготовить
  backend/frontend plans параллельно фоновой Terraform-работе; implementation,
  selection, commit и push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Frontend skill and UI/UX spec fixed responsive, authority, focus and browser
  acceptance without changing production code.

## Итог

Заполняется после реализации.
