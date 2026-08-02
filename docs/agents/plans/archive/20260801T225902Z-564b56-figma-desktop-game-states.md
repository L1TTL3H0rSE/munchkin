# PLAN: figma desktop game states

- **Plan ID:** `20260801T225902Z-564b56-figma-desktop-game-states`
- **Статус:** completed
- **Создан:** 2026-08-01 22:59:02 UTC
- **Обновлён:** 2026-08-02 11:38:08 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260801T225856Z-b69a1a-frontend-scss-architecture-foundation`, `20260801T225858Z-49b2b8-figma-lobby-shell-rebuild`, `20260801T225859Z-5831ff-figma-game-primitives-view-models`, `20260801T225900Z-2e903a-figma-mobile-game-states`.
- **Блокирует:** `20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces`, `20260801T225904Z-83bfe1-figma-system-terminal-states`.
- **Связанные ADR/handoff:** Figma desktop battle component set `259:708`, flow sheet `292:3656`.

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/components/game/GameTable.vue",
    "frontend/applications/web/app/components/game/GameContextPanel.vue",
    "frontend/applications/web/app/components/game/OpponentRoster.vue",
    "frontend/applications/web/app/components/game/OwnBoard.vue",
    "frontend/applications/web/app/components/game/desktop/**",
    "frontend/applications/web/app/assets/scss/pages/_game-desktop.scss",
    "frontend/applications/web/test/desktopGamePresentation.test.ts",
    "frontend/applications/web/test/fixtures/**",
    "frontend/test/browser/fixtureSupport.ts",
    "frontend/test/browser/player-ui.spec.ts",
    "frontend/test/browser/visual.spec.ts",
    "frontend/test/browser/visual-baselines/chromium/desktop-*.png",
    "docs/agents/plans/active/20260801T225902Z-564b56-figma-desktop-game-states.md",
    "docs/agents/plans/archive/20260801T225902Z-564b56-figma-desktop-game-states.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "pnpm:@munchkin/contracts",
    "frontend:browser-a11y-harness-v1",
    "frontend:game-presentation-model-v2"
  ],
  "dependsOn": [
    "20260801T225856Z-b69a1a-frontend-scss-architecture-foundation",
    "20260801T225858Z-49b2b8-figma-lobby-shell-rebuild",
    "20260801T225859Z-5831ff-figma-game-primitives-view-models",
    "20260801T225900Z-2e903a-figma-mobile-game-states"
  ],
  "sharedResources": [
    "frontend:figma-desktop-game-v1",
    "frontend:game-route-composition-v2"
  ]
}
```

## Цель

Реализовать утверждённую desktop-композицию battle/table для `1440x900` и
полный набор канонических Figma state variants, используя те же parsed
projection, primitives и intents, но не растягивая mobile layout.

## Критерии приёмки

- [x] Canonical desktop `1440x900` соответствует approved Figma component set:
  header F, compact opponents, encounter/card rail, rail pager, strength,
  contextual actions и hand surface образуют намеренную desktop hierarchy.
- [x] Desktop не показывает старые technical badges (`version`, status enum,
  rules profile), постоянный connection prose, duplicate phase/deck/hand-limit
  telemetry или extra `own-card-count`.
- [x] Игровой стол на `1440x900` помещается в viewport без document scroll;
  long rails/sheets имеют собственный bounded overflow и visible affordance.
- [x] `1280x720` получает компактный laptop layout без уменьшения card text до
  нечитаемого; `1920x1080` ограничивает line/card stage width и не разбрасывает
  controls по пустому экрану.
- [x] 1–6 opponents используют stable density and avatar/status summaries;
  public detail открывается semantic interaction and never leaks hand cards.
- [x] Single/multiple monster fights сохраняют отдельные cards, illustration,
  rules/Bad Stuff/rewards и predictable active-card/pager state.
- [x] Desktop phase families реализованы из одного presentation model:
  lobby/setup, preparation, choose/reveal door, monster/curse/no-monster,
  search for trouble/loot room, combat/help context, run away, reward,
  charity/end turn/waiting, death/recovery and victory placeholders.
- [x] Action placement follows current task: primary action adjacent to the
  affected surface, secondary actions progressive-disclosed; generic bottom
  `ActionPanel` не остаётся permanent technical form.
- [x] Hand and own character information remain available but not permanently
  expanded. Race/class/equipment/strength use shared triggers for later sheets.
- [x] Tablet `600–1023` uses an intentional hybrid of shared regions with one
  semantic order, not simultaneous hidden duplicate presenters.
- [x] Mouse hover is enhancement only; every card/rail/pager/action works by
  keyboard and coarse pointer, with visible focus and 44px controls.
- [x] All desktop state variants have structural fixtures; representative
  families have manually reviewed Chromium baselines rather than an unchecked
  mass snapshot update.
- [x] Canonical visual cases программно вызывают
  `page.setViewportSize({width: 1440, height: 900})` до navigation; default
  `1280x720` project не подменяет approved desktop target.

## Контекст и подтверждённое состояние

- User approved desktop lobby and desktop combat, then requested all remaining
  screens. Figma desktop component set now contains approximately 40 canonical
  variants and flow sheet `292:3656`.
- Current table is one vertical stream with sticky action bar; earlier responsive
  implementation was functional but is not the newly approved visual system.
- Mobile plan establishes the layout dispatcher and shared presentation model;
  desktop is a separate presenter sharing state/action ownership.

## Scope

### Входит

- Desktop/laptop/tablet game regions, state compositions and scoped SCSS.
- Progressive opponents/character/hand triggers and desktop rail geometry.
- Structural/browser/visual fixtures for all canonical base state families.

### Не входит

- Domain content of interaction/decision sheets, final connection/error copy,
  backend/contracts/content or Card Studio.
- Copying Digiversity grid components or adding carousel/UI dependencies.
- Absolute pixel parity at arbitrary ultra-wide/short landscape phone sizes.

## Архитектурный подход

1. `GameTable` is a thin dispatcher; desktop view consumes the same readonly
   discriminated presentation state and emits the same typed intents as mobile.
2. Desktop regions use intrinsic CSS grid with explicit min/max/overflow
   invariants; no JavaScript breakpoint watcher.
3. Repeated phase layouts are compositions of shared card/header/rail/action
   primitives, not copy-pasted per-state pages.
4. State variants differ by data and narrow modifiers (`data-phase`,
   `data-state`), while semantic source order remains keyboard-safe.
5. Figma dictates hierarchy/spacing; server projection dictates what exists,
   who may act and final results.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| game route/dispatcher | desktop presenter activation | existing controller only |
| desktop regions | full Figma base-state layout | presentation model v2 |
| shared public/own surfaces | progressive disclosure triggers | public/self projections |
| browser fixtures | desktop density/state evidence | strict actor-safe data |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/pages/game/[id].vue` | write | Consume desktop presenter |
| `frontend/applications/web/app/components/game/GameTable.vue` | write | Extend dispatcher only |
| `frontend/applications/web/app/components/game/GameContextPanel.vue` | write | Migrate residual desktop context |
| `frontend/applications/web/app/components/game/OpponentRoster.vue` | write | Desktop density/disclosure |
| `frontend/applications/web/app/components/game/OwnBoard.vue` | write | Desktop own-zone trigger contract |
| `frontend/applications/web/app/components/game/desktop/**` | write | Desktop/tablet compositions |
| `frontend/applications/web/app/assets/scss/pages/_game-desktop.scss` | write | Route-level grid/bounds |
| `frontend/applications/web/test/desktopGamePresentation.test.ts` | write | Canonical state mapping |
| `frontend/applications/web/test/fixtures/**` | write | Desktop density/state fixtures |
| `frontend/test/browser/fixtureSupport.ts` | write | Desktop region assertions |
| `frontend/test/browser/player-ui.spec.ts` | write | Desktop semantic/a11y matrix |
| `frontend/test/browser/visual.spec.ts` | write | Reviewed capture selection |
| `frontend/test/browser/visual-baselines/chromium/desktop-*.png` | generated | Canonical state-family baselines |
| `docs/agents/plans/active/20260801T225902Z-564b56-figma-desktop-game-states.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260801T225902Z-564b56-figma-desktop-game-states.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:game-route-composition-v2` | mobile/sheets/status | dependency + этот plan | Extend frozen dispatcher contract |
| `frontend:figma-desktop-game-v1` | decisions/final gate | этот plan | Base screen must stabilize before overlays |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 23:00:21 UTC.
- **Обнаруженные пересечения:** route/table shared with prior mobile and later
  sheet/status slices; no infra overlap.
- **Решение:** sequential queue with separate commit; shared props/emits remain
  stable, material change pauses queue.

## План реализации

1. [x] Convert Figma desktop state set into a checked mapping table from each
   frame/state to projection/fixture/presenter composition.
2. [x] Implement desktop shell/grid/header/opponent/card/hand/action regions.
3. [x] Implement all base phase compositions and 1–6-player density.
4. [x] Add tablet/laptop transitions and explicit overflow invariants.
5. [x] Add exact `1440x900` cases to `visual.spec.ts`, plus structural,
   keyboard, a11y and selected reviewed visual evidence.
6. [x] Full checks, canonical verify/scope-check, archive/local commit; no push.

## Проверки

- [x] Focused desktop presentation/component Vitest suite: `desktopGamePresentation.test.ts`, 11 tests passed; full web suite 25 files/154 tests passed.
- [x] Semantic/browser matrix at `768x1024`, `1024x768`, `1280x720`,
  `1440x900`, `1920x1080`; used boundaries N-1/N/N+1.
- [x] Canonical `1440x900` visuals for preparation, door outcomes, single/multi
  combat, reward, run-away, waiting, death and victory state families.
- [x] `cd frontend && node test/run-playwright.mjs test visual.spec.ts --project=chromium` executes the named `desktop-*` cases after per-test viewport override: 18/18 passed, including 9 desktop cases and 7 mobile regression cases.
- [x] 1/3/6 opponents, long Russian copy, missing art, empty/dense hand, huge
  strength and rules text; no root overflow or sticky overlap.
- [x] Keyboard/coarse pointer, 200% zoom, reduced motion and forced colors: `player-ui` 51/51 passed; targeted axe desktop/base matrix passed 11/12, with `single-charity` explicitly retained as pre-existing `EconomySurface` contrast debt for the next interaction/economy plan.
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`: canonical verify completed all required frontend checks with exit code 0.
- [x] `node .codex/hooks/plan-lint.mjs`: run after archive move with no issues.
- [x] `./leinoctl verify --changed`: passed, `leinoctl verify: ok`.
- [x] `./leinoctl scope-check --plan 20260801T225902Z-564b56-figma-desktop-game-states`: passed, `outsideWriteSet: []`, `missingRequiredChecks: []`.
- [x] `git diff --check`: passed.

## Риски и откат

- **Риск:** 40 frames become duplicated templates. **Снижение:** mapping table,
  shared composition primitives and state modifiers.
- **Риск:** desktop/tablet presenter diverges from mobile legality. **Снижение:**
  one view model/action binding and cross-presenter contract tests.
- **Риск:** bounded viewport clips dense content/focus. **Снижение:** explicit
  internal scroll owners, focus tests and 1280x720 compact layout.
- **Откат:** revert desktop presenter/styles/baselines; mobile and backend data
  remain intact.

## Открытые вопросы

- Scope-changing вопросов нет. Tablet is an intentional responsive bridge
  derived from approved mobile/desktop components; a new tablet-specific flow
  would require separate Figma approval.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 23:00:21 UTC
- **Подтверждено:** 2026-08-02, user batch approval: exact queue in listed order; push запрещён
- **Формулировка/ограничения пользователя:** Desktop lobby/combat and subsequent
  states were approved in Figma; user requested to continue and finish all
  screens while preserving the selected hybrid components. Batch approval этой
  очереди: выполнять exact plan IDs в указанном порядке; push не выполнять.

## Ход выполнения

- Implemented a shared desktop state model in `desktopGameModel.ts` and a thin
  `GameTable` desktop dispatcher. The desktop presenter now composes the
  header, public opponent roster, bounded encounter/card rail, deck rails,
  server-projected combat summary, progressive own-board sheet and contextual
  action dock.
- Implemented the base state-family mapping and fixtures:

  | State family | Fixture/evidence | Presenter composition |
  |---|---|---|
  | lobby/setup and preparation | `single-setup`, `single-preparation`, `desktop-preparation` | desktop header, phase card, deck rail, own summary |
  | door choice/reveal | `single-door-choice`, `desktop-door` | phase/encounter stage and adjacent action |
  | single and multiple combat | `single-combat`, `mobile-combat-multiple`, `desktop-combat-one`, `desktop-combat-multiple` | separate card rail, pager, bounded rules, strength summary |
  | run away and reward | `single-run-away`, `run-away-result`, `desktop-run-away`, `desktop-reward` | run-away status, result/reward context and progressive action |
  | charity/end turn/waiting | `single-charity`, `single-finished`, `stale-projection`, `desktop-waiting` | shared phase family and waiting/result state; economy detail remains next slice |
  | death/recovery/victory | `death-loot-observer`, `victory-six-player`, `desktop-death`, `desktop-victory` | terminal placeholder/bridge with public roster and finished state |

- Added explicit tablet/laptop/ultra-wide bounds, focusable internal card
  scroll regions, coarse-pointer/keyboard/200% checks, reduced-motion and
  forced-colors coverage, and reviewed Chromium baselines.
- Canonical lifecycle gates completed on 2026-08-02: `verify --changed` and
  `scope-check` passed. Generated Playwright artifacts were removed; user-owned
  dirty paths stayed untouched.

## Итог

Desktop/tablet state foundation is complete. The route now selects one semantic
desktop presenter above the mobile breakpoint, preserving the server projection,
privacy-safe public opponent data and typed action bindings. The approved
`1440x900` desktop visual matrix is stable, compact/ultra-wide bounds are
covered, and no permanent legacy telemetry or generic bottom action form is
rendered. The remaining axe failure is isolated to the pre-existing
`EconomySurface` in `single-charity`; it is recorded for the next interaction
surface plan and is outside this plan's decision-sheet scope.
