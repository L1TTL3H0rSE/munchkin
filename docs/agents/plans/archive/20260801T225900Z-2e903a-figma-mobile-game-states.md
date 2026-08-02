# PLAN: figma mobile game states

- **Plan ID:** `20260801T225900Z-2e903a-figma-mobile-game-states`
- **Статус:** completed
- **Создан:** 2026-08-01 22:59:00 UTC
- **Обновлён:** 2026-08-02 10:53:41 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260801T225856Z-b69a1a-frontend-scss-architecture-foundation`, `20260801T225858Z-49b2b8-figma-lobby-shell-rebuild`, `20260801T225859Z-5831ff-figma-game-primitives-view-models`.
- **Блокирует:** `20260801T225902Z-564b56-figma-desktop-game-states`, `20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces`.
- **Связанные ADR/handoff:** approved `360x640` Figma hybrid and state pages, `docs/agents/GAME_UI_UX_SPEC.md`.

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
    "frontend/applications/web/app/components/game/mobile/**",
    "frontend/applications/web/app/assets/scss/pages/_game-mobile.scss",
    "frontend/applications/web/test/mobileGamePresentation.test.ts",
    "frontend/applications/web/test/fixtures/**",
    "frontend/test/browser/fixtureSupport.ts",
    "frontend/test/browser/player-ui.spec.ts",
    "frontend/test/browser/visual.spec.ts",
    "frontend/test/browser/visual-baselines/chromium/mobile-*.png",
    "docs/agents/plans/active/20260801T225900Z-2e903a-figma-mobile-game-states.md",
    "docs/agents/plans/archive/20260801T225900Z-2e903a-figma-mobile-game-states.md"
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
    "20260801T225859Z-5831ff-figma-game-primitives-view-models"
  ],
  "sharedResources": [
    "frontend:figma-mobile-game-v1",
    "frontend:game-route-composition-v2"
  ]
}
```

## Цель

Реализовать самостоятельную portrait-mobile композицию игрового стола для
утверждённого `360x640` viewport: одна текущая задача, неизменный читаемый
размер карты, отсутствие document scroll в supported gameplay states,
контекстные controls и safe-area-aware hand tab вместо уменьшенной desktop UI.

## Критерии приёмки

- [x] Supported canonical viewport — `360x640` CSS px с `100svh`/`100dvh` и
  bottom safe area; browser chrome не вычисляется magic constant и не создаёт
  скрытую нижнюю action button.
- [x] В базовом игровом состоянии body/document не скроллится; scroll допускается
  только внутри bounded rail/sheet. Карта сохраняет утверждённый размер, а
  пространство освобождается композицией controls.
- [x] Постоянный marketing/header отсутствует. Compact game header показывает
  только текущий контекст, схематичных opponents и strength `14px`; room ID,
  rules profile/version/deck telemetry доступны только в secondary details.
- [x] Opponents представлены compact avatars/count/status; public detail
  открывается button/sheet и не раскрывает hand cards beyond `hand_count`.
- [x] Rail controls на phone не используют отдельные arrow buttons. Swipe,
  native scroll, pager и visible continuation дают touch/keyboard access без
  перекрытия card text.
- [x] Battle card rail корректно показывает one/multiple monsters, сохраняет
  illustration/rules/rewards и не подписывает cards как `Монстр`/`Дверь`.
- [x] Combat controls собраны без отдельной vertical panel: contextual character
  action слева, primary server action справа; mandatory interaction surfaces
  открываются сами через later shared decision contract.
- [x] Strength tap открывает detail trigger; battle-card tap может открыть ту
  же breakdown surface, но authoritative win/total не вычисляется локально.
- [x] Hand скрыта, когда projection не даёт relevant card actions; `Рука · N`
  открывает shared sheet. Кнопка `сыграть карту` отдельно от hand не дублируется.
- [x] Hand tab не становится status bar: timer слева только при actionable
  deadline, interaction indicator справа только при actual pending window.
- [x] Base state families имеют mobile composition: preparation, choose door,
  in-room lobby/waiting/start, door monster, curse, empty door, search for
  trouble/loot room, combat with one/multiple monsters, resolution/reward,
  run-away progression, turn end, waiting, empty/small/dense hand.
- [x] Reward footer в card показывает слева `+N уровень`, справа
  `N сокровищ` одним typography/color.
- [x] `390x844` и `427x926` используют same mobile flow with controlled extra
  whitespace, а не растягивают card. Tablet handoff at chosen boundary is
  intentional and checked at N-1/N/N+1.
- [x] `320`/short-height/phone landscape не обещают visual parity: fail-safe
  режим может scroll, но не прячет legal action, не ломает focus и не показывает
  private data. Отдельный redesign этих режимов не входит.
- [x] Canonical visual cases программно вызывают
  `page.setViewportSize({width: 360, height: 640})` до navigation; их результат
  не зависит от default `320/599/1280` Playwright projects.

## Контекст и подтверждённое состояние

- User rejected `360x800`; current approved compact target is `360x640`, card
  size must remain unchanged and bottom gesture safe area is mandatory.
- Current GameTable renders metadata, connection prose, full roster, context,
  own board/economy and sticky action panel sequentially, causing exactly the
  clutter and page scroll identified by the user.
- Current components already consume server descriptors and must not be
  replaced with phase guesses.
- Figma hybrid fixed header/card rail/rail pager/hand tab and six initial
  states; later desktop work expanded the shared state families.

## Scope

### Входит

- Mobile route/table composition, compact header/opponents/context/card/hand/
  action regions and phase-specific visibility.
- Scoped SCSS for supported portrait sizes, dynamic viewport and safe area.
- Mobile fixtures, semantic browser assertions and reviewed canonical visuals.

### Не входит

- Desktop final composition, complete decision-sheet domain renderers,
  connection terminal screens, backend/contracts or Card Studio.
- Full visual support for short-height (<640 CSS px) or phone landscape.
- Scaling card below approved geometry to force unsupported screens to fit.

## Архитектурный подход

1. Route remains controller composition; `MobileGameTable` receives readonly
   presentation state and emits typed intents.
2. CSS owns composition by supported breakpoint/capability. No runtime
   user-agent/device-name branch and no S25-specific pixel hack.
3. Projection/actions decide which information/action exists; UI priority only
   decides where it is rendered.
4. One fixed viewport shell contains header, flexible card stage and bottom
   dock; every internal scroll owner has `min-height: 0`, label and affordance.
5. Mobile and desktop may use different DOM presentation components while
   sharing primitives, view models, selection and action bindings.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| game route/table | mobile presenter selection/composition | existing controller projection |
| mobile regions | phase-aware render-only components | presentation model v2 |
| opponent/hand/action | compact progressive disclosure | server public fields/actions only |
| browser fixtures | supported/fallback viewport evidence | actor-safe parsed projection |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/pages/game/[id].vue` | write | Compose shared/mobile presenter |
| `frontend/applications/web/app/components/game/GameTable.vue` | write | Thin layout dispatcher |
| `frontend/applications/web/app/components/game/GameContextPanel.vue` | write | Remove always-on context clutter |
| `frontend/applications/web/app/components/game/OpponentRoster.vue` | write | Compact actor-safe summary |
| `frontend/applications/web/app/components/game/OwnBoard.vue` | write | Progressive own information |
| `frontend/applications/web/app/components/game/mobile/**` | write | Mobile regions/state compositions |
| `frontend/applications/web/app/assets/scss/pages/_game-mobile.scss` | write | Supported viewport composition |
| `frontend/applications/web/test/mobileGamePresentation.test.ts` | write | State/visibility contract |
| `frontend/applications/web/test/fixtures/**` | write | Mobile deterministic cases |
| `frontend/test/browser/fixtureSupport.ts` | write | Mobile viewport/assertion helpers |
| `frontend/test/browser/player-ui.spec.ts` | write | Mobile semantic/a11y flow |
| `frontend/test/browser/visual.spec.ts` | write | Reviewed mobile capture selection |
| `frontend/test/browser/visual-baselines/chromium/mobile-*.png` | generated | Canonical state-family baselines |
| `docs/agents/plans/active/20260801T225900Z-2e903a-figma-mobile-game-states.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260801T225900Z-2e903a-figma-mobile-game-states.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:game-route-composition-v2` | desktop/sheets/status | этот plan | Establish dispatcher; later extend, not fork |
| `frontend:figma-mobile-game-v1` | decisions/final gate | этот plan | Freeze base layout before overlays |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 23:00:21 UTC.
- **Обнаруженные пересечения:** desktop and later overlays reuse game route/
  table. Infrastructure drafts do not overlap.
- **Решение:** ordered commits; later plan consumes frozen props/emits and only
  material contract changes trigger reapproval.

## План реализации

1. [x] Add structural tests for `360x640` region budget and each base state.
2. [x] Replace always-on GameTable sequence with thin responsive dispatcher.
3. [x] Implement compact header/opponents/card stage/action dock/hand tab.
4. [x] Implement phase compositions and multi-monster rail without card scaling.
5. [x] Add supported portrait and safety-only fallback CSS/a11y behavior.
6. [x] Add exact `360x640` cases to `visual.spec.ts`, then review Figma parity,
   focus order, safe-area and no-scroll evidence; do not auto-accept baselines.
7. [x] Full checks, verify/scope-check, archive/local commit; no push.

## Проверки

- [x] Focused/full Vitest mobile presentation/visibility/selection tests:
  `24` files and `143` tests passed in the web workspace.
- [x] Chromium canonical visual at exactly `360x640` for representative setup,
  door, combat-one, combat-multiple, reward, run-away and waiting states.
- [x] `cd frontend && node test/run-playwright.mjs test visual.spec.ts --project=chromium --grep "mobile-" --workers=1` executes the named `mobile-*` cases after per-test viewport override: `7/7` passed with no snapshot updates.
- [x] Full `visual.spec.ts` was run and its pre-existing desktop
  `single-combat.png` baseline mismatch was recorded; the exact mobile subset
  above is green and the baseline is owned by the next desktop-state plan.
- [x] Semantic/overflow smoke at `360x640`, `390x844`, `427x926` and tablet
  boundary N-1/N/N+1; base state has `scrollHeight <= clientHeight`.
- [x] Safety-only smoke at `320x568`, `667x375`, `844x390`: critical action
  reachable and no horizontal root overflow; no pixel-parity assertion.
- [x] Coarse pointer, keyboard rail, focus-visible, reduced-motion, forced
  colors and 200% zoom assertions.
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`: passed; contracts
  `18` tests and web `143` tests passed.
- [x] `node .codex/hooks/plan-lint.mjs`: `plans=58 active=7 archive=51 issues=0`.
- [x] `./leinoctl verify --changed`: all canonical checks exit `0`.
- [x] `./leinoctl scope-check --plan 20260801T225900Z-2e903a-figma-mobile-game-states`: `outsideWriteSet=[]`, `missingRequiredChecks=[]`.
- [x] `git diff --check`.

## Риски и откат

- **Риск:** `100svh` + safe area clips action on a real browser. **Снижение:**
  smallest-viewport semantics, safe-area padding and real-device/manual smoke.
- **Риск:** hiding hand/context hides legal action. **Снижение:** visibility
  maps server descriptors; every descriptor fixture asserts a reachable control.
- **Риск:** fixed card size overflows dense multi-monster fight. **Снижение:**
  bounded rail/pager, one readable card viewport, no overlay arrows.
- **Риск:** mobile-specific DOM duplicates state/focus. **Снижение:** shared
  presentation/selection owner and only one active presenter in accessibility tree.
- **Откат:** revert mobile composition commit to previous table; server state,
  sessions and persisted data unchanged.

## Открытые вопросы

- Scope-changing вопросов нет. Full-support target `360x640`, no card scaling,
  unsupported short-height/phone-landscape and safe-area policy are explicit
  user decisions from the design dialogue.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 23:00:21 UTC
- **Подтверждено:** 2026-08-02, user batch approval: exact queue in listed order; push запрещён
- **Формулировка/ограничения пользователя:** Сделать вариант `360x640`, при
  необходимости менять components; strength font около `14px`; отказаться от
  `360x800`, small-height и landscape visual support, card не уменьшать. Batch
  approval этой очереди: выполнять exact plan IDs в указанном порядке; push не
  выполнять.

## Ход выполнения

- Реализован mobile-only presenter с shared projection/action bindings,
  compact header/opponents/context, fixed-size encounter rail, hand tab/sheets,
  action dock и safety-only fallback CSS.
- Добавлены state-family/presentation tests, deterministic multiple-monster
  fixture, exact viewport helpers, responsive/safety browser matrix и семь
  reviewed `360x640` Chromium baselines.
- Mobile base axe spot-checks проходят; full repository axe остаётся частично
  красным на legacy desktop action bar и later-owned EconomySurface, поэтому
  это не выдано за результат текущего plan.

## Итог

- Mobile composition реализована и визуально просмотрена для setup, door,
  combat-one, combat-multiple, reward, run-away и waiting.
- `48/48` player-ui browser tests, `7/7` mobile visual comparisons, `143/143`
  web Vitest tests, root lint/check/build и targeted mobile axe checks passed.
- Full visual run имеет единственный ожидаемый out-of-scope mismatch:
  archived desktop `single-combat.png` не соответствует новой промежуточной
  desktop composition и будет обновлён desktop-state plan.
- Push не выполнялся; release и отдельный локальный commit выполняются после
  canonical verify/scope-check.
