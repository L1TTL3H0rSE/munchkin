# PLAN: frontend Figma visual rebuild

- **Plan ID:** `20260802T231819Z-15da13-frontend-figma-visual-rebuild`
- **Статус:** approved
- **Создан:** 2026-08-02 23:18:19 UTC
- **Обновлён:** 2026-08-03 00:32:00 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `codex/frontend-remaining-plans`
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260801T225905Z-64608a-frontend-redesign-verification-cleanup` (evidence handoff)
- **Блокирует:** нет
- **Связанные ADR/handoff:** `docs/agents/FRONTEND_ENGINEERING_SPEC.md`, `docs/agents/GAME_UI_UX_SPEC.md`, Figma file `bmxy6z3Z0bBLHLYryYJYrP`
- **Figma source nodes:** desktop state set `259:708`, desktop flow sheet `292:3656`; individual desktop states are the 40 symbols listed below.

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/app.vue",
    "frontend/applications/web/app/pages/index.vue",
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/components/ActionPanel.vue",
    "frontend/applications/web/app/components/GameConnectionStatus.vue",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/composables/useGamePresentation.ts",
    "frontend/applications/web/app/assets/scss/api/**",
    "frontend/applications/web/app/assets/scss/base/**",
    "frontend/applications/web/app/assets/scss/main.scss",
    "frontend/applications/web/app/assets/scss/pages/_lobby.scss",
    "frontend/applications/web/app/assets/scss/pages/_game-mobile.scss",
    "frontend/applications/web/app/assets/scss/pages/_game-desktop.scss",
    "frontend/applications/web/test/**",
    "frontend/test/browser/**",
    "frontend/test/browser/visual-baselines/**",
    "frontend/playwright.config.ts",
    "docs/agents/plans/active/20260802T231819Z-15da13-frontend-figma-visual-rebuild.md",
    "docs/agents/plans/archive/20260802T231819Z-15da13-frontend-figma-visual-rebuild.md"
  ],
  "components": [
    "frontend-workspace",
    "web",
    "repository-workflow"
  ],
  "contracts": [
    "frontend:player-ui-design-contract-v2",
    "frontend:game-presentation-model-v2",
    "frontend:interaction-window-ui-v2",
    "frontend:visual-baseline-set-v2"
  ],
  "dependsOn": [
    "20260801T225905Z-64608a-frontend-redesign-verification-cleanup"
  ],
  "sharedResources": [
    "frontend:player-ui-design-contract-v2",
    "frontend:game-route-composition-v2",
    "frontend:figma-desktop-game-v1",
    "frontend:figma-mobile-game-v1",
    "frontend:decision-sheets-v1",
    "frontend:system-state-ui-v2",
    "frontend:visual-baseline-set-v2"
  ]
}
```

## Цель

Переделать player-facing Nuxt UI по реальным Figma state frames, а не по
описательным предположениям: сохранить actor-specific server projection и
typed actions, но привести shell, grid, cards, rails, sheets, interaction
surfaces, system states, lobby и responsive compositions к согласованным
Figma hierarchy, spacing, typography, color tokens и state variants.

## Критерии приёмки

- [ ] Все 40 desktop state symbols из Figma node `259:708` имеют checked
  mapping `Figma node → fixture → route/component → projected action/state →
  semantic/browser/visual check`; ни один frame не считается покрытым только по
  имени.
- [ ] `292:3656` flow-sheet modes и approved mobile/lobby/decision handoffs
  имеют отдельные mapping entries или явно отмечены как shared responsive
  variant; missing source node не маскируется как parity.
- [ ] Desktop canonical `1440x900` reproduces the Figma composition geometry:
  16px outer frame, 56px header, 248px opponent panel, 240x400 encounter
  card, bounded rails, action/sheet placement and light paper surfaces.
- [ ] Mobile canonical `360x640` reproduces the approved mobile composition;
  responsive rows remain tested at `390x844`, `427x926`, `768x1024`,
  `1024x768`, `1280x720`, `1920x1080` plus actual breakpoint N-1/N/N+1.
- [ ] Lobby, loading, reconnecting, connection failure, unavailable, waiting,
  combat, required response, charity, run-away, reward, death, recovery,
  victory, trade, gift, theft, private/stale/expired choice and empty-hand
  compositions are rendered from typed actor fixtures and have semantic checks.
- [ ] Figma visual tokens are mapped to repository tokens without external
  fonts/assets or copied commercial trade dress; no acid/dark legacy player UI,
  technical raw copy, `any`, raw DTO or client authority remains.
- [ ] Sheets/dialogs use native dialog semantics, focus trap/return, safe-area
  behavior and server-projected legal actions; action controls remain reachable
  and visible at supported sizes.
- [ ] Visual baselines are regenerated only for individually reviewed changed
  cases at exact canonical viewports; no blanket snapshot acceptance.
- [ ] Full frontend lint/typecheck/unit/build, browser, a11y, visual,
  privacy-negative, real-boundary, repository verify and scope checks pass.

## Контекст и подтверждённое состояние

- Previous commits `a12a7bc` and `e02c976` implemented behavior and layout
  slices from plan/spec descriptions, but direct Figma node inspection was not
  performed before implementation. Their functional checks are evidence of
  behavior only, not proof of Figma visual parity.
- The real source is Figma file `bmxy6z3Z0bBLHLYryYJYrP`. Node `259:708`
  contains 40 desktop states: `ActiveTurn`, `HandExpanded`,
  `RequiredResponse`, `Charity`, `Waiting`, `Reconnecting`,
  `ConnectionFailed`, `CharacterOpen`, `StrengthOpen`, `OpponentOpen`,
  `DoorReady`, `PostDoorChoice`, `RunAwayChoice`, `RewardReceived`,
  `Preparation`, `CurseEffect`, `HelpOffer`, `HelpIncoming`, `HelpAccepted`,
  `RunAwayPending`, `RunAwaySuccess`, `RunAwayFailure`, `RunAwayNextMonster`,
  `EndTurnReady`, `TurnPassed`, `Death`, `DeathLoot`, `DeathRecovery`,
  `Victory`, `Trade`, `Gift`, `TheftResponse`, `PrivateChoice`, `StaleChoice`,
  `ExpiredChoice`, `EmptyHand`, `InitialLoading`, `SessionLost`,
  `GameUnavailable`, and `GameFinished`.
- Node `292:3656` contains reusable modes `Cards3`, `Cards2Summary`, `Result`,
  `System` and `Empty`.
- The current final verification plan explicitly excludes production writes;
  this plan is a material scope change and must be separately approved before
  changing Vue/TS/SCSS.
- Card Studio `/studio/cards` is compatibility-only and is not redesigned.

## Scope

### Входит

- Player-facing lobby, game route, desktop/mobile presenters, shared game
  primitives, cards/rails/pager, action dock, sheets/dialogs, interaction
  domains, connection/system/terminal surfaces and their scoped styles.
- Deterministic actor-safe fixture registry and browser/visual/a11y/privacy
  evidence needed to prove every Figma state mapping.
- Playwright canonical projects/helpers and individually reviewed baselines.

### Не входит

- Backend, Go engine, wire contracts, migrations, content packs, credentials,
  dependency upgrades, CI or Compose changes.
- Card Studio visual redesign.
- Inventing Figma frames that are not present in the source file; such a gap is
  recorded as blocked/open and requires a new Figma source or user decision.

## Архитектурный подход

1. Build the mapping registry from the actual Figma node IDs first; each visual
   change must point to a concrete frame and an actor-safe fixture.
2. Keep presentation and action authority in existing typed contracts; change
   only layout/rendering and test fixtures, never legality, RNG, deadline or
   credential authority.
3. Establish tokens and shared primitives once, then compose the 40 states from
   shared regions with narrow state modifiers instead of copied screens.
4. Use exact 1440x900 and 360x640 snapshots, then run semantic/responsive
   boundaries and real-browser boundary separately.
5. Treat every changed screenshot as a review artifact; a mismatch blocks the
   corresponding state rather than being accepted automatically.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Lobby/page shell | Figma Flow B geometry and states | existing lobby API and typed form state |
| Desktop/mobile presenters | Figma state compositions and responsive grid | `Projection`, `GamePresentation` |
| Cards/rails/sheets | Figma primitives, spacing and focus behavior | actor-visible card/action descriptors |
| Interaction/system surfaces | Figma decision/result/recovery modes | `InteractionView`, typed error taxonomy |
| Browser harness | exact state registry and reviewed visual gates | parsed actor-safe fixtures |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/app.vue` | write | Figma shell and route landmarks |
| `frontend/applications/web/app/pages/index.vue` | write | Figma lobby Flow B |
| `frontend/applications/web/app/pages/game/[id].vue` | write | route/state composition |
| `frontend/applications/web/app/components/ActionPanel.vue` | write | Figma action control/dock |
| `frontend/applications/web/app/components/GameConnectionStatus.vue` | write | system header/status |
| `frontend/applications/web/app/components/game/**` | write | presenters and primitives |
| `frontend/applications/web/app/components/interaction/**` | write | sheets and decision states |
| `frontend/applications/web/app/composables/useGamePresentation.ts` | write | typed presentation mapping only |
| `frontend/applications/web/app/assets/scss/api/**` | write | repository Figma tokens/mixins |
| `frontend/applications/web/app/assets/scss/base/**` | write | shell/reset/layout foundations |
| `frontend/applications/web/app/assets/scss/main.scss` | write | page style ownership |
| `frontend/applications/web/app/assets/scss/pages/_lobby.scss` | write | lobby composition |
| `frontend/applications/web/app/assets/scss/pages/_game-mobile.scss` | write | mobile composition |
| `frontend/applications/web/app/assets/scss/pages/_game-desktop.scss` | write | desktop/tablet composition |
| `frontend/applications/web/test/**` | write | model and fixture evidence |
| `frontend/test/browser/**` | write | semantic/a11y/visual/browser evidence |
| `frontend/test/browser/visual-baselines/**` | generated | individually reviewed snapshots |
| `frontend/playwright.config.ts` | write | canonical visual/browser projects |
| `docs/agents/plans/active/20260802T231819Z-15da13-frontend-figma-visual-rebuild.md` | write | active lifecycle |
| `docs/agents/plans/archive/20260802T231819Z-15da13-frontend-figma-visual-rebuild.md` | write | archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:player-ui-design-contract-v2` | final gate | this plan | authoritative visual boundary |
| `frontend:visual-baseline-set-v2` | final gate | this plan | exclusive reviewed update |
| `frontend:game-route-composition-v2` | archived mobile/desktop slices | this plan | replace through one dispatcher |
| `frontend:figma-desktop-game-v1` | archived desktop slice | this plan | consume concrete nodes |
| `frontend:figma-mobile-game-v1` | archived mobile slice | this plan | preserve approved responsive behavior |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-03; current final-gate plan owns only
  browser/spec/baseline work and must finish or be explicitly amended before
  this plan is selected.
- **Обнаруженные пересечения:** all player-facing UI paths intentionally
  overlap predecessor commits; Card Studio and backend paths do not overlap.
- **Решение:** preserve predecessor commits, select this plan only after the
  final-gate lifecycle boundary is resolved, then make one focused visual
  rebuild with separate checks and commit.

## План реализации

1. [ ] Record all Figma node IDs and build the exhaustive state/fixture/component
   mapping before production edits.
2. [ ] Rebuild tokens, page shell, lobby and shared primitive geometry from the
   Figma source.
3. [ ] Rebuild desktop 40-state compositions and mobile responsive variants,
   keeping server-projected actions and actor privacy intact.
4. [ ] Rebuild decision sheets, interaction domains, recovery/terminal states
   and flow-sheet modes.
5. [ ] Run exact canonical visual captures and review every changed baseline
   against the corresponding Figma node; route real defects through this plan.
6. [ ] Run complete responsive, keyboard, a11y, privacy and real-boundary gates.
7. [ ] Run canonical verify/scope-check, archive/release, commit and push only
   after the user-authorized delivery step.

## Проверки

- [ ] Figma mapping registry reports zero unmapped source nodes and zero
  unrepresented implemented state descriptors.
- [ ] `cd frontend && pnpm lint`.
- [ ] `cd frontend && pnpm check`.
- [ ] `cd frontend && pnpm build`.
- [ ] `cd frontend && pnpm test:browser`.
- [ ] `cd frontend && pnpm test:a11y`.
- [ ] `cd frontend && pnpm test:visual` with individually reviewed snapshots.
- [ ] Opt-in real browser → Nuxt → Go boundary.
- [ ] Privacy/credential/raw DTO/legacy selector scans and Card Studio smoke.
- [ ] `node .codex/hooks/plan-lint.mjs`.
- [ ] `./leinoctl verify --changed`.
- [ ] `./leinoctl scope-check --plan 20260802T231819Z-15da13-frontend-figma-visual-rebuild`.
- [ ] `git diff --check`.

## Риски и откат

- **Риск:** broad visual rewrite introduces regressions in already working
  behavior. **Снижение:** keep contracts/controller unchanged, run focused
  tests after each state family, and retain predecessor commits.
- **Риск:** source frame lacks a mobile/lobby node for a claimed state.
  **Снижение:** record the exact gap; do not fabricate parity.
- **Откат:** revert only this plan's commit; `a12a7bc` and `e02c976` remain
  independently recoverable.

## Открытые вопросы

- The desktop source node set is concrete. Mobile and lobby node IDs must be
  resolved from the approved Figma handoff before claiming those screens are
  complete.
- Any backend or contract mismatch is outside this plan and blocks the affected
  state until separately approved.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-03
- **Подтверждено:** 2026-08-03, user approved all rewrites in this exact production write set, including Figma-driven Vue/TS/SCSS changes, fixtures, browser evidence, baselines and push after completion.
- **Формулировка/ограничения пользователя:** User explicitly requested to
  redo the frontend because the current implementation does not match Figma;
  this plan records the required production write set and must be approved
  before implementation.

## Ход выполнения

- Approved after the user identified that prior implementation lacked direct
  Figma verification. Production implementation is not started under this
  plan; lifecycle selection waits for the currently selected final-gate plan
  to be resolved.

## Итог

Заполняется после реализации.
