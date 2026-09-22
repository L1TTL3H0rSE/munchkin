# PLAN: game table composition decomposition

- **Plan ID:** `20260809T212615Z-c3d56b-game-table-composition-decomposition`
- **Статус:** completed
- **Создан:** 2026-08-09 21:26:15 UTC
- **Обновлён:** 2026-08-10 10:17:13 UTC
- **Владелец:** `019fe88b-0e60-7960-92e7-1a3a1d5513e5`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260809T212616Z-758ff2-frontend-session-api-module-boundaries`.
- **Блокирует:** нет; final checkpoint очереди
- **Связанные ADR/handoff:** `docs/agents/FRONTEND_ENGINEERING_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/plans/active/20260809T212615Z-c3d56b-game-table-composition-decomposition.md",
    "docs/agents/plans/archive/20260809T212615Z-c3d56b-game-table-composition-decomposition.md",
    "frontend/applications/web/app/assets/scss/main.scss",
    "frontend/applications/web/app/assets/scss/base/_app-shell.scss",
    "frontend/applications/web/app/assets/scss/pages/_lobby.scss",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/lobby/**",
    "frontend/applications/web/app/components/ui/SheetDialog.vue",
    "frontend/applications/web/app/pages/index.vue",
    "frontend/applications/web/app/pages/studio/cards.vue",
    "frontend/packages/contracts/src/index.ts",
    "frontend/packages/contracts/src/game.ts",
    "frontend/packages/contracts/src/studio.ts",
    "frontend/packages/contracts/tsconfig.json",
    "frontend/applications/web/test/gameTableViewModel.test.ts",
    "frontend/applications/web/test/gamePresentation.test.ts",
    "frontend/applications/web/test/deathLootSurface.test.ts",
    "frontend/applications/web/test/targetRunAwaySurface.test.ts",
    "frontend/applications/web/test/lobbyEntry.test.ts",
    "frontend/test/browser/player-ui.spec.ts",
    "frontend/test/browser/lobby.spec.ts",
    "frontend/test/browser/a11y.spec.ts",
    "frontend/test/browser/style-foundation.spec.ts"
  ],
  "components": ["frontend-workspace", "pnpm:@munchkin/web"],
  "contracts": ["game:http-v1"],
  "dependsOn": [
    "20260809T212616Z-758ff2-frontend-session-api-module-boundaries"
  ],
  "sharedResources": [
    "frontend-game-table-presentation",
    "frontend-player-style-ownership",
    "frontend-player-browser-selectors"
  ]
}
```

## Цель

Превратить `GameTable.vue` из 2105-line state/layout/style monolith в тонкий
composition shell, устранить дублированное wide/compact Run Away и Death Loot
state и привести live player UI к component-owned SCSS в полезном Digiversity
стиле: scoped root blocks, вложенные `&__`/`&--`, local tokens/mixins и никаких
page/global overrides внутренних элементов. Product layout/copy, Figma parity,
gameplay behavior и wire contracts остаются стабильными.

## Критерии приёмки

- [x] `GameTable` только компонует projection-derived readonly regions и
  маршрутизирует typed intents; Run Away/Death Loot selection, countdown,
  action mapping и region styles принадлежат extracted owners.
- [x] Run Away и Death Loot имеют один feature-local state/view-model owner;
  wide/compact geometry может отличаться, но selection/action legality не
  вычисляется дважды и две interactive copies одновременно не монтируются.
- [x] Extracted/live player components используют typed props/emits, stable
  domain keys, scoped SCSS root block и вложенные `&__`, `&--`, `data-state`.
- [x] Lobby compact rules находятся в `LobbyForm`, `_lobby.scss` отвечает
  только за page layout; `RunAwaySurface` не имеет leaking global style block.
- [x] Raw repeated responsive boundaries заменены существующим `scss/api`;
  hardcoded semantic colors и undocumented `!important` удалены из touched
  player owners без visual-intent change.
- [x] Studio compatibility stylesheet не загружается на every player route:
  existing Studio route imports it locally без Studio decomposition.
- [x] Existing server-supplied actions, expected version, command IDs,
  projection privacy, available-action filtering, focus/dismissal semantics и
  visible copy не изменены.
- [x] Focused unit/browser/a11y/style checks проходят без snapshot update и без
  новой formatter/Stylelint/design-system dependency.

## Контекст и подтверждённое состояние

- `GameTable.vue`: 573-line script, 781-line template, 748-line SCSS; audit
  насчитал 82 computed values, 16 functions и 62 conditional branches.
- Wide Run Away/Death Loot state находится в `GameTable`, compact equivalents
  — в `RunAwaySurface`/`DeathLootSurface`; `GameModalCoordinator` ветвится через
  `matchMedia`.
- `deathLootModel.ts`, `targetRunAwayModel.ts`, `gameTableViewModel.ts` и
  focused tests уже дают feature-local starting points; framework не нужен.
- Repo-wide app scan не нашёл `&__`/`&--`; BEM-shaped names записаны flat,
  хотя normative spec и Digiversity reference use component root nesting.
- `_lobby.scss` переопределяет `.lobby-form__*`; `LobbyForm` уже имеет
  `compact` modifier. `main.scss` globally imports dev-only Studio CSS.
- Previous plans remove dead surfaces, stabilize contract facade and then
  API/session facades; this final UI checkpoint consumes those boundaries.

## Scope

### Входит

- Extract cohesive GameTable layout/presentation regions with their SCSS into
  feature-local owners under existing game domain.
- Consolidate Run Away/Death Loot derived selection/action state and narrow
  modal coordinator to semantic routing/focus.
- Normalize live game/interaction/lobby component SCSS to nested BEM ownership,
  existing tokens/mixins and named boundaries; change only touched semantics.
- Move lobby child overrides into `LobbyForm`, remove confirmed dead app-shell
  selectors, make Studio compatibility import route-local.
- Update focused model/component/browser selectors only where owner moved.

### Не входит

- Standalone mass formatting baseline, Prettier/Stylelint/custom BEM validator,
  new design-system/component package or copied `@digiversity/*` code/theme.
- Card Studio panel/server decomposition; `_studio.scss` remains an explicit
  route-local compatibility layer.
- Figma parity/redesign, visible copy change, new gameplay action/rule,
  backend/content/schema/API/session behavior, visual baseline update or push.
- Generic modal/state framework, Pinia/store, universal abstraction or
  arbitrary split by line count.

## Архитектурный подход

- **Shell, not god component.** `GameTable` composes independently testable
  regions; each region owns template, typed intent and SCSS.
- **One state owner.** Pure feature model owns selection/reconciliation;
  controlled views receive readonly data and emit domain intent.
- **Styles travel with components.** One scoped root block nests elements,
  modifiers and media rules; page/global layers do not target child internals.
- **Existing SCSS API first.** Reuse Munchkin tokens/mixins/boundaries; no
  private Digiversity dependency and no new token unless two owners need it.
- **CSS for geometry, Vue for semantics.** CSS adapts layout; Vue branches only
  when semantic component contracts differ, never to mount duplicate controls.
- **Stable public boundary.** `GameTable` props/emits and game route/session API
  stay stable. Material contract/behavior/visual intent change stops queue.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Game table | Thin shell + extracted presentation regions | `Projection` consumer unchanged |
| Run Away / Death Loot | One selection/action owner each | Existing server descriptors only |
| Game/interaction/lobby styles | Component-owned nested SCSS | Props/emits/copy unchanged |
| Lobby/global shell | Remove cross-component/dead selectors | Page layout only |
| Studio route | Route-local existing compatibility CSS | Studio API/UI unchanged |

## Delegation strategy

- **Классификация:** large — planning delegation required: composition,
  independent decision domains, CSS ownership, responsive semantics and
  browser evidence are separate workstreams.
- Queue Package A (`Terra high`, read-only) recommended this as the final
  checkpoint after contracts/session and rejected a standalone mass reformat.
- Queue Package B (`Terra high`, read-only) confirmed root-block nested BEM,
  composition-root/headless boundaries and existing SCSS API as transferable;
  it rejected new package/store and mandatory Studio split.
- Both completed with `write_set: []`; all implementation remains root-only.

### Delegation findings and closure

| Package | Finding | Disposition/closure |
|---|---|---|
| A | UI/style work belongs last and a standalone repository reformat is too broad. | Accepted: this is the final checkpoint and only live claimed owners are normalized; no mass formatter plan remains. |
| A | Plan 1 narrows several model/test paths later covered by feature globs. | Accepted: exact overlaps are recorded in queue preflight and separated by three completed lifecycle checkpoints/commits. |
| B | Digiversity's useful transfer is ownership: thin composition shell, feature-local state and component-owned nested BEM. | Accepted: criteria require those seams while preserving Munchkin props, intents and existing SCSS API. |
| B | New package/store/design system and mandatory Studio split are YAGNI. | Accepted: all are non-goals; only the unchanged Studio compatibility CSS becomes route-local. |
| B | Responsive refactor must retain accessibility and interaction semantics. | Accepted: keyboard, focus, one-mounted-surface, overflow, reduced-motion and no-update browser gates are required. |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/plans/active/20260809T212615Z-c3d56b-game-table-composition-decomposition.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260809T212615Z-c3d56b-game-table-composition-decomposition.md` | write | Archived lifecycle |
| `frontend/applications/web/app/assets/scss/main.scss` | write | Route-localize Studio compatibility import |
| `frontend/applications/web/app/assets/scss/base/_app-shell.scss` | write | Remove confirmed dead global selectors |
| `frontend/applications/web/app/assets/scss/pages/_lobby.scss` | write | Page layout only; remove child overrides |
| `frontend/applications/web/app/components/game/**` | write | Table regions, decisions and owned styles |
| `frontend/applications/web/app/components/interaction/**` | write | Decision owners and nested SCSS normalization |
| `frontend/applications/web/app/components/lobby/**` | write | Lobby compact owner and nested SCSS |
| `frontend/applications/web/app/components/ui/SheetDialog.vue` | write | Explicit style/focus contract for modal owners |
| `frontend/applications/web/app/pages/index.vue` | write | Lobby page composition/style import cleanup |
| `frontend/applications/web/app/pages/studio/cards.vue` | write | Route-local Studio compatibility import |
| `frontend/packages/contracts/src/index.ts` | write | Node 24-compatible internal re-export specifiers required by browser dev runtime |
| `frontend/packages/contracts/src/game.ts` | write | Node 24-compatible internal card import required by browser dev runtime |
| `frontend/packages/contracts/src/studio.ts` | write | Node 24-compatible internal card import required by browser dev runtime |
| `frontend/packages/contracts/tsconfig.json` | write | Permit explicit TypeScript specifiers in this no-emit package |
| `frontend/applications/web/test/gameTableViewModel.test.ts` | write | Pure table regression |
| `frontend/applications/web/test/gamePresentation.test.ts` | write | Presentation regression |
| `frontend/applications/web/test/deathLootSurface.test.ts` | write | Selection/pass regression |
| `frontend/applications/web/test/targetRunAwaySurface.test.ts` | write | Run Away regression |
| `frontend/applications/web/test/lobbyEntry.test.ts` | write | Lobby ownership regression |
| `frontend/test/browser/player-ui.spec.ts` | write | Player semantic flow selectors |
| `frontend/test/browser/lobby.spec.ts` | write | Lobby semantic/responsive evidence |
| `frontend/test/browser/a11y.spec.ts` | write | One surface/focus/keyboard evidence |
| `frontend/test/browser/style-foundation.spec.ts` | write | Tokens/boundaries/overflow regression |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend-game-table-presentation` | prior API/session plan | this plan | Consume stable facades as final checkpoint |
| `frontend-player-style-ownership` | no other queued writer | this plan | Exclusive live player style normalization |
| `frontend-player-browser-selectors` | no other queued writer | this plan | Semantic assertions only; no baselines |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-09 21:54 UTC aggregate context and all
  queue manifests; unrelated infrastructure drafts have no UI/SCSS claims.
- **Обнаруженные пересечения:** prune narrows helpers in three claimed model/API
  files; contracts/session plans do not claim UI/SCSS paths. Shared type/API
  dependencies are read-only by this plan.
- **Решение:** execute only after three separate completed commits. Unexpected
  gameplay/schema/visual intent or new dependency is a hard stop.

## План реализации

1. [x] Lock current props/emits, visible copy, semantic selectors and focused
  state/style evidence.
2. [x] Extract cohesive GameTable regions with their SCSS; consolidate Run Away
  and Death Loot state and narrow modal routing.
3. [x] Normalize live player component styles to scoped nested BEM using the
  existing SCSS API; move lobby ownership and remove leaking/dead globals.
4. [x] Route-localize unchanged Studio compatibility CSS without Studio split.
5. [x] Verify keyboard/focus/mandatory decisions, responsive boundaries,
  player/lobby visual stability and canonical lifecycle.

## Проверки

- [x] Focused Vitest: game table/presentation/death loot/run away/lobby.
- [x] Repository browser runner: player UI, lobby, a11y and style foundation at
  used N-1/N/N+1 boundaries plus 360×640 and 1440×900; no snapshot update.
- [x] CSS audit: no child-targeting lobby globals, no new raw repeated
  breakpoints, no undocumented `!important`, nested BEM in changed owners.
- [x] `pnpm lint`, `pnpm check`, `pnpm build`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260809T212615Z-c3d56b-game-table-composition-decomposition`.

## Риски и откат

- **Риск:** refactor changes action availability, focus/dismissal, selection,
  CSS specificity/order or route CSS loading while fixtures remain green.
- **Mitigation:** stable facades, pure state tests, actor/observer browser
  assertions, boundary/style smoke and no-update visual control.
- **Откат:** revert isolated final plan commit; do not keep duplicate legacy/new
  owners or restore global overrides as fallback.

## Открытые вопросы

- Exact extracted component filenames may vary inside claimed feature paths;
  public boundary, scope, dependency or visual-intent change requires
  re-approval.
- The queue-level unattended execution policy in the first plan applies:
  private component boundaries, selector names and existing SCSS API choices
  are pre-authorized; visible intent, accessibility and gameplay are frozen.

## Согласование

- **Статус:** approved as exact queue member; material amendment approved
- **Запрошено:** 2026-08-09 21:54:06 UTC
- **Подтверждено:** 2026-08-10
- **Формулировка/ограничения пользователя:** exact four-plan queue and
  unattended policy approved; non-material decisions inside this manifest and
  acceptance criteria are autonomous; no dependency install/upgrade, snapshot
  update or push; separate local commit required.

## Ход выполнения

- Two Terra high read-only reviewers completed; findings synthesized above.
- Exact queue member approved after completed dependency commit `54f728f`;
  targeted takeover from the absent planning session recorded. Implementation
  not started before selection.
- Selected for implementation in the approved queue order.
- In progress: Run Away and Death Loot now use one modal interaction owner at
  every viewport; duplicate wide selection/submission state and styles were
  removed from `GameTable`. Studio CSS is route-local and compact lobby child
  styles are owned by `LobbyForm`.
- Focused Vitest passed 5 files / 20 tests; full frontend lint, typecheck,
  contract 19 tests, web 163 tests and production build passed.
- Browser gate stopped before test execution because the completed contract
  split facade imports extensionless `./card`, `./game` and `./studio`; Node 24
  Nuxt dev reports `ERR_MODULE_NOT_FOUND` for `src/card`. The required fix is
  outside this plan write set, so unattended execution is paused for material
  re-approval rather than widening scope silently.
- Requested material amendment: add
  `frontend/packages/contracts/src/index.ts` to this plan's manifest/write set
  and change only its three internal re-export specifiers to `./card.ts`,
  `./game.ts` and `./studio.ts`. This amendment was subsequently approved and
  is applied below.
- **Material amendment approved:** 2026-08-10; the user explicitly approved
  adding `frontend/packages/contracts/src/index.ts` and the three `.ts`
  re-export specifier corrections so browser verification can resume.
- The approved barrel correction exposed two remaining extensionless imports:
  `game.ts` and `studio.ts` each import `./card`. Node 24 still stops before
  browser execution. The user approved the second material amendment on
  2026-08-10: add exactly those two files to the write set and change only
  those imports to `./card.ts`.
- Mandatory scope audit recorded the diff entirely inside the approved write
  set (`outsideWriteSet: []`, no unledgered paths).
- Browser acceptance now passes: player UI 72, lobby 11, a11y 56 and style
  foundation 3 tests. Focused Vitest remains green at 5 files / 20 tests.
- Full frontend lint passes, but typecheck rejects the five approved `.ts`
  specifiers with `TS5097`. Node 24 requires those explicit extensions while
  this no-emit contract package has not enabled TypeScript's matching option.
  The user approved the third material amendment on 2026-08-10: add
  `frontend/packages/contracts/tsconfig.json` and set only
  `compilerOptions.allowImportingTsExtensions` to `true`.
- After that amendment, contracts typecheck, frontend lint/check/build and all
  canonical `verify --changed` checks pass. The ledger records 15 completed
  required checks; final scope-check reports no failed, stale or missing checks,
  `outsideWriteSet: []`, `unledgered: []` and `ok: true`.

## Итог

`GameTable.vue` reduced from 2105 to 1768 lines and no longer owns duplicate
Run Away/Death Loot selection, countdown, action mapping or region styles.
`RunAwaySurface` and `DeathLootSurface` each own one interaction model rendered
as a desktop inline surface or compact sheet, while `GameModalCoordinator`
only routes the compact presentation. Lobby compact styles moved into
`LobbyForm`; Studio compatibility CSS is route-local. The minimal approved
contract extension fix keeps Node 24 browser runtime and TypeScript no-emit
typecheck aligned. Focused Vitest passed 20 tests, browser suites passed
72+11+56+3 tests, frontend lint/check/build passed, and canonical lifecycle
closed with 15/15 checks and a clean scope-check. No dependency install or
upgrade, snapshot update, lockfile edit, push or other remote effect occurred.
