# PLAN: frontend compact figma handoff

- **Plan ID:** `20260803T083541Z-26e9ab-frontend-compact-figma-handoff`
- **Статус:** completed
- **Создан:** 2026-08-03 08:35:41 UTC
- **Обновлён:** 2026-08-03 10:04:00 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `codex/frontend-remaining-plans`
- **Режим параллельности:** exclusive
- **Зависит от:** нет
- **Блокирует:** нет
- **Связанные ADR/handoff:** `docs/agents/FRONTEND_ENGINEERING_SPEC.md`, `docs/agents/GAME_UI_UX_SPEC.md`, Figma file `bmxy6z3Z0bBLHLYryYJYrP`
- **Figma source nodes:** compact integrated states `147:671`, core loop compact states `160:1140`, lobby Selected B `225:14`, desktop lobby control `240:50`; the 360×800 board `122:3` is explicitly out of scope.

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/pages/index.vue",
    "frontend/applications/web/app/components/lobby/LobbyForm.vue",
    "frontend/applications/web/app/assets/lobby/hero-door.png",
    "frontend/applications/web/app/assets/lobby/hero-treasure.png",
    "frontend/applications/web/app/assets/scss/pages/_lobby.scss",
    "frontend/applications/web/app/components/game/mobile/MobileGameTable.vue",
    "frontend/applications/web/app/components/game/mobile/MobileGameHeader.vue",
    "frontend/applications/web/app/components/game/mobile/MobileOpponentSummary.vue",
    "frontend/applications/web/app/components/game/mobile/MobileEncounterStage.vue",
    "frontend/applications/web/app/components/game/mobile/MobileOwnState.vue",
    "frontend/applications/web/app/assets/scss/pages/_game-mobile.scss",
    "frontend/test/browser/figmaStateMatrix.ts",
    "frontend/applications/web/test/figmaStateMatrix.test.ts",
    "frontend/test/browser/visual.spec.ts",
    "frontend/test/browser/lobby.spec.ts",
    "frontend/test/browser/player-ui.spec.ts",
    "frontend/test/browser/visual-baselines/**",
    "docs/agents/plans/active/20260803T083541Z-26e9ab-frontend-compact-figma-handoff.md",
    "docs/agents/plans/archive/20260803T083541Z-26e9ab-frontend-compact-figma-handoff.md"
  ],
  "components": [
    "frontend-workspace",
    "web"
  ],
  "contracts": [
    "frontend:player-ui-design-contract-v2",
    "frontend:visual-baseline-set-v2"
  ],
  "dependsOn": [],
  "sharedResources": [
    "frontend:game-route-composition-v2",
    "frontend:figma-mobile-game-v1",
    "frontend:figma-lobby-flow-b-v1",
    "frontend:visual-baseline-set-v2"
  ]
}
```

## Цель

Привести compact player-facing mobile UI к реальным Figma frames на
поддерживаемом каноническом viewport `360×640`: игровой стол должен использовать
композицию compact board из `147:671` и core-loop states из `160:1140`, а lobby —
Selected B из `225:14`. Сохранить существующие typed actor-specific projection,
server actions, privacy и recovery behavior. Desktop lobby на `1440×900`
проверяется как контроль источника `240:50`; новый desktop redesign не входит.

## Критерии приёмки

- [x] На `360×640` mobile game имеет Figma compact geometry: header около
  `14px/12px`, opponent row `14px/52px`, encounter rail `360px/98px/416px`,
  player/action dock `16px/554px/328px/62px`; legal actions и actor-visible
  sheets остаются доступными.
- [x] Ни один screenshot, baseline или source mapping из 360×800 board
  `122:3` не используется; exact mobile source mapping указывает только на
  `147:671`/`160:1140`.
- [x] На `360×640` lobby совпадает с Selected B: заголовок «Войти в игру»,
  segmented create/join control, соответствующие поля, loading/validation/server
  error states и primary buttons; текущие две stacked cards не рендерятся.
- [x] Existing desktop lobby at `1440×900` remains usable and visually aligned
  with `240:50`; no backend, contract or Card Studio behavior changes.
- [x] Figma matrix records concrete lobby/mobile source node IDs and tests
  assert their mapping to actor-safe fixtures/components.
- [x] No document horizontal overflow, critical actions remain reachable, and
  focused rails/sheets preserve keyboard semantics at canonical and safety
  viewports.
- [x] Changed mobile/lobby visual baselines are regenerated individually and
  reviewed against the corresponding Figma source; no blanket snapshot update.
- [x] Frontend lint, typecheck, unit/browser/a11y/visual checks, canonical
  `./leinoctl verify --changed` and `scope-check` pass.

## Контекст и подтверждённое состояние

- Current branch is `codex/frontend-remaining-plans`; the previous Figma visual
  rebuild commit is already pushed and its plan is archived/released.
- Direct Figma metadata resolves the compact sources: `147:671` is the
  Integrated States compact `360×640` board, `160:1140` is the Core Loop compact
  `360×640` board, and `225:14` is Lobby Entry Selected B `360×640`.
- The previously used implementation renders a legacy mobile header/context
  panel/blank stage/action card arrangement instead of the compact Figma header,
  opponent chips, card rail and bottom dock. Mobile lobby renders two cards while
  Selected B is one minimalist segmented entry form.
- `122:3`, the Integrated States `360×800` board, is intentionally excluded by
  the user and must not be used as evidence or an implementation target.
- `get_design_context` was obtained for the compact game and lobby source boards
  before this plan; the implementation adapts the returned design reference to
  Nuxt/Vue/SCSS and reuses existing typed components.
- Existing typed model/controller/contract behavior is sufficient; this plan
  changes presentation composition, scoped styles, matrix metadata and browser
  evidence only.

## Scope

### Входит

- Compact mobile game composition and its state-specific sheets at `360×640`.
- Mobile lobby Selected B form composition and its idle/loading/validation/error
  presentation.
- The two Figma-provided lobby hero artwork assets used by the desktop control
  frame; they are local build assets, not remote runtime URLs.
- Concrete source-node mapping for compact game/lobby handoffs and targeted
  semantic/visual assertions/baselines.
- Desktop lobby `1440×900` regression verification only.

### Не входит

- The 360×800 Integrated States board and any pixel-parity claim for it.
- Backend, Go engine, HTTP/realtime schemas, persistence, content packs,
  dependencies, Compose, deployment and Card Studio.
- New game rules, action legality, authority, privacy projection or credential
  behavior.
- A broad desktop game redesign or new Figma screens not listed above.

## Архитектурный подход

1. Keep the existing `Projection`/action/controller boundary unchanged and
   refactor only mobile presentation order, sizing and state surfaces.
2. Use the source geometry as a compact layout contract: fixed-size design
   regions are implemented inside fluid safe-area bounds, with the existing
   320px safety fallback and named responsive tokens preserved.
3. Reuse `GameCard`, `CardRail`, `HandTab`, `SheetDialog` and typed `LobbyForm`
   state; do not duplicate server DTOs or create local authoritative state.
4. Make the mobile lobby one selected-mode form at a time with native tab-like
   buttons and preserve both form instances' input/error/loading ownership.
5. Update source mapping and browser assertions before reviewing only the
   changed screenshots.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Mobile game presenters | Compact Figma board regions, cards, opponents, dock and sheets | Existing `Projection`, card action bindings, connection/action state |
| Lobby page/forms | Selected B mobile mode switch and form composition | Existing `LobbyFormInput`, API/session controller |
| Figma/browser matrix | Concrete compact/lobby node IDs and semantic/visual coverage | Actor-safe deterministic fixtures |
| Visual baselines | Individually reviewed `360×640` mobile/lobby captures | Chromium snapshot contract |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/pages/index.vue` | write | Selected B mobile route composition |
| `frontend/applications/web/app/components/lobby/LobbyForm.vue` | write | Shared selected-mode form surface |
| `frontend/applications/web/app/assets/lobby/hero-door.png` | write | Figma lobby hero door artwork |
| `frontend/applications/web/app/assets/lobby/hero-treasure.png` | write | Figma lobby hero treasure artwork |
| `frontend/applications/web/app/assets/scss/pages/_lobby.scss` | write | Mobile Selected B geometry and desktop guardrails |
| `frontend/applications/web/app/components/game/mobile/MobileGameTable.vue` | write | Compact mobile region composition |
| `frontend/applications/web/app/components/game/mobile/MobileGameHeader.vue` | write | Compact header geometry and status |
| `frontend/applications/web/app/components/game/mobile/MobileOpponentSummary.vue` | write | Compact opponent chip row |
| `frontend/applications/web/app/components/game/mobile/MobileEncounterStage.vue` | write | Compact encounter rail/state surface |
| `frontend/applications/web/app/components/game/mobile/MobileOwnState.vue` | write | Compact own-state/player dock integration |
| `frontend/applications/web/app/assets/scss/pages/_game-mobile.scss` | write | Compact game geometry, safe-area and state variants |
| `frontend/test/browser/figmaStateMatrix.ts` | write | Concrete compact/lobby Figma source mapping |
| `frontend/applications/web/test/figmaStateMatrix.test.ts` | write | Mapping regression assertions |
| `frontend/test/browser/visual.spec.ts` | write | Targeted canonical visual cases |
| `frontend/test/browser/lobby.spec.ts` | write | Selected B semantic/form assertions |
| `frontend/test/browser/player-ui.spec.ts` | write | Compact geometry/accessibility assertions |
| `frontend/test/browser/visual-baselines/**` | generated | Individually reviewed changed captures |
| `docs/agents/plans/active/20260803T083541Z-26e9ab-frontend-compact-figma-handoff.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260803T083541Z-26e9ab-frontend-compact-figma-handoff.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:game-route-composition-v2` | archived predecessor UI plans | this plan | own compact presenter rewrite; preserve desktop presenter |
| `frontend:figma-mobile-game-v1` | archived predecessor UI plans | this plan | replace unresolved handoff with `147:671`/`160:1140` |
| `frontend:figma-lobby-flow-b-v1` | archived predecessor UI plans | this plan | replace unresolved handoff with `225:14` |
| `frontend:visual-baseline-set-v2` | archived predecessor UI plan | this plan | update only individually reviewed mobile/lobby files |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-03; no active plan owns these frontend
  paths or shared resources.
- **Обнаруженные пересечения:** predecessor player-facing paths and visual
  baselines are intentionally reused; no active plan owns these paths.
- **Решение:** predecessor plan is completed/archived/released. This plan is
  exclusive for the follow-up compact/lobby rewrite; backend/contracts and
  desktop game paths are outside the write set.
- **Follow-up asset decision:** actual source inspection showed that the
  desktop lobby control uses two supplied Figma artwork fills. The blanket
  rewrite approval is applied to these two local presentation assets; no
  runtime remote asset dependency is introduced.

## План реализации

1. [x] Record the resolved Figma node IDs and exact 360×800 exclusion in the
   matrix and plan before production edits.
2. [x] Refactor mobile lobby composition to Selected B while preserving typed
   create/join submissions and all error/loading semantics.
3. [x] Refactor mobile game composition to compact header/opponent row/encounter
   rail/player dock and state-specific sheets using existing components.
4. [x] Run focused unit, semantic, accessibility and visual checks; review only
   changed `360×640` mobile/lobby captures and keep desktop control green.
5. [x] Run canonical frontend/repository verify and scope-check, archive/release
   this plan, create the local commit and push the approved branch.

## Проверки

- [x] `cd frontend && pnpm lint` — passed via canonical `verify --changed`.
- [x] `cd frontend && pnpm check` and `pnpm build` — passed via canonical
  `verify --changed`; web unit suite: 27 files, 161 tests passed.
- [x] Focused `lobby.spec.ts`, `player-ui.spec.ts`, `visual.spec.ts` and relevant
  web unit tests.
- [x] Canonical browser/a11y/visual runs with individually reviewed snapshots;
  canonical targets include `360×640` and `1440×900`, with safety checks at
  `320×568`, `390×844` and representative boundaries. Final browser run:
  64/64; a11y: 45/45; changed visual baselines: 9/9.
- [x] `./leinoctl verify --changed` — ok; all recorded checks exited 0,
  including frontend lint/check/build, contracts checks, harness tests,
  leinoctl tests, plan lint, script syntax and Compose config.
- [x] `./leinoctl scope-check --plan 20260803T083541Z-26e9ab-frontend-compact-figma-handoff`
  — ok; outsideWriteSet=0, unledgered=0, failedChecks=0, staleChecks=0.
- [x] `git diff --check`, plan lint, guarded archive/release, local commit and
  push on `codex/frontend-remaining-plans`.

## Риски и откат

- **Риск:** mobile composition changes can regress action reachability, focus
  return or state-specific overlays. **Снижение:** preserve existing typed
  components/controllers, run semantic/a11y/browser checks per state family and
  inspect each changed baseline.
- **Риск:** compact card content is denser than the old mobile stage.
  **Снижение:** use bounded rail/sheet patterns, preserve readable text/fallback
  art and keep 320px as safety-only rather than claiming source parity.
- **Откат:** revert only this follow-up commit; the pushed predecessor commit
  remains independently recoverable.

## Открытые вопросы

- Exact compact and lobby source nodes are now resolved. No open Figma-source
  question remains for this scope.
- Desktop game exact parity is not re-opened by this plan; only mobile compact
  and lobby Selected B are being corrected.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-03 08:35:41 UTC
- **Подтверждено:** 2026-08-03, user previously granted blanket approval for
  all required rewrites and then explicitly constrained the current source to
  exclude 360×800 screenshots. The exact follow-up plan records that approval
  for this production write set.
- **Формулировка/ограничения пользователя:** «360х800 скрины тебе не нужны»;
  use Figma compact `360×640` source and make the frontend match the supplied
  Figma file. Push after completion under the existing authorized workflow.

## Ход выполнения

- Read-only context, Figma metadata/screenshots/design context and current
  implementation mismatch were inspected. Approval is recorded; implementation
  starts only after this exact plan is selected in the trusted session.
- The Figma hero artwork files were exported from node `240:50` and added to the
  approved frontend write set after visual review; the user's standing rewrite
  approval covers this presentation-only asset addition.

## Итог

Реализован и проверен compact Figma handoff. Mobile game теперь использует
header/opponent chips/encounter rail/bottom dock на `360×640`, lobby — Selected B
с одной выбранной create/join формой, а desktop lobby сохранён как контрольный
вариант на `1440×900`. Figma matrix закрепляет `147:671`, `160:1140`, `225:14`
и `240:50`/`240:53`; board `122:3` (`360×800`) явно исключён и не используется
ни в screenshots, ни в baselines, ни в source mappings.

Финальная evidence: browser `64/64`, axe `45/45`, visual `9/9`, web unit
`27 files / 161 tests`, typecheck/lint/build — зелёные; `verify --changed` и
`scope-check` — `ok`, write-set и ledger полностью совпали. План архивирован,
released, закоммичен и запушен в `codex/frontend-remaining-plans`.
