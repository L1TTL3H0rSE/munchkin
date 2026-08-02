# PLAN: frontend redesign verification cleanup

- **Plan ID:** `20260801T225905Z-64608a-frontend-redesign-verification-cleanup`
- **Статус:** approved
- **Создан:** 2026-08-01 22:59:05 UTC
- **Обновлён:** 2026-08-02 12:20:00 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260801T225856Z-b69a1a-frontend-scss-architecture-foundation`, `20260801T225858Z-49b2b8-figma-lobby-shell-rebuild`, `20260801T225859Z-5831ff-figma-game-primitives-view-models`, `20260801T225900Z-2e903a-figma-mobile-game-states`, `20260801T225902Z-564b56-figma-desktop-game-states`, `20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces`, `20260801T225904Z-83bfe1-figma-system-terminal-states`, `20260802T115450Z-eef974-frontend-browser-runner-determinism`.
- **Блокирует:** нет.
- **Связанные ADR/handoff:** `docs/agents/FRONTEND_ENGINEERING_SPEC.md`, `docs/agents/GAME_UI_UX_SPEC.md`, Figma file `bmxy6z3Z0bBLHLYryYJYrP`.

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/playwright.config.ts",
    "frontend/applications/web/test/fixtures/**",
    "frontend/applications/web/test/**",
    "frontend/test/browser/figmaStateMatrix.ts",
    "frontend/test/browser/**",
    "frontend/test/browser/visual-baselines/**",
    "docs/agents/FRONTEND_ENGINEERING_SPEC.md",
    "docs/agents/GAME_UI_UX_SPEC.md",
    "docs/agents/plans/active/20260801T225905Z-64608a-frontend-redesign-verification-cleanup.md",
    "docs/agents/plans/archive/20260801T225905Z-64608a-frontend-redesign-verification-cleanup.md"
  ],
  "components": [
    "frontend-workspace",
    "repository-workflow"
  ],
  "contracts": [
    "pnpm:@munchkin/contracts",
    "frontend:browser-a11y-harness-v1",
    "frontend:scss-foundation-v1",
    "frontend:game-presentation-model-v2",
    "frontend:interaction-window-ui-v2"
  ],
  "dependsOn": [
    "20260801T225856Z-b69a1a-frontend-scss-architecture-foundation",
    "20260801T225858Z-49b2b8-figma-lobby-shell-rebuild",
    "20260801T225859Z-5831ff-figma-game-primitives-view-models",
    "20260801T225900Z-2e903a-figma-mobile-game-states",
    "20260801T225902Z-564b56-figma-desktop-game-states",
    "20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces",
    "20260801T225904Z-83bfe1-figma-system-terminal-states",
    "20260802T115450Z-eef974-frontend-browser-runner-determinism"
  ],
  "sharedResources": [
    "frontend:browser-a11y-harness-v1",
    "frontend:visual-baseline-set-v2",
    "frontend:player-ui-design-contract-v2"
  ]
}
```

## Цель

Провести отдельный adversarial completion pass по всей утверждённой очереди:
доказать соответствие Figma/behavior/privacy/a11y/responsive contracts,
расширить deterministic state matrix, доказать отсутствие старого UI/CSS и
зафиксировать честное текущее состояние specs без позднего broad product refactor.

## Критерии приёмки

- [ ] Создана versioned mapping table `Figma frame/state → parsed fixture →
  route/component → available server action → semantic/browser/visual check`;
  source — `frontend/test/browser/figmaStateMatrix.ts`, его напрямую consume-ят
  structural и visual specs; каждый approved frame покрыт или объяснён variant.
- [ ] Every existing server phase/action/interaction/status has at least one
  actor-specific deterministic fixture and structural assertion; foreign hand,
  deck order, RNG, credential and internal state отсутствуют.
- [ ] Descriptor coverage registry типизирован исчерпывающе для exported
  `ActionType`/known interaction/status/phase sets (`satisfies Record<...>` или
  эквивалентный compile-time gate), поэтому новый enum member ломает check до
  добавления fixture и semantic control.
- [ ] Canonical visuals are pinned Chromium: mobile `360x640`, desktop
  `1440x900`. Baselines cover each distinct composition family, not every
  text-only variation; all generated changes reviewed individually.
- [ ] `visual.spec.ts` consumes the registry and explicitly sets exact viewport
  per case before navigation. Existing `pnpm test:visual` therefore executes
  every registered canonical family without relying on project default size.
- [ ] Responsive semantic smoke covers `390x844`, `427x926`, `768x1024`,
  `1024x768`, `1280x720`, `1920x1080` and N-1/N/N+1 of each actually used
  layout boundary.
- [ ] Safety-only unsupported `320x568` and phone landscape checks assert no
  horizontal root overflow, credential leak or unreachable critical action,
  without claiming Figma parity/no-scroll support.
- [ ] Base supported game states have no document scroll or sticky overlap;
  long content scrolls only in labeled bounded owner and final action remains
  visible above safe area/keyboard.
- [ ] Keyboard matrix covers skip link, rails, pager, card activation, full
  hand, optional/mandatory sheets, focus trap/return and final action.
- [ ] Axe serious/critical = 0 for every state family; 200% and selected 400%
  zoom, reduced motion, forced colors and coarse/fine pointer are verified.
- [ ] Lobby success/error, all gameplay phases, multi-monster, full interaction
  domains, loading/reconnect/offline/stale/session, death/recovery/victory and
  1–6-player density are all represented.
- [ ] Real-boundary test remains separate and honestly proves browser→Nuxt→Go
  actor projection/command/invalidation/resync, not fixture E2E.
- [ ] `rg`, typecheck and browser evidence prove that predecessors removed old
  acid/dark/technical copy, obsolete selectors and unreferenced components;
  Card Studio compatibility smoke passes. Any remaining product code defect
  blocks completion and returns to an amended/new narrow plan.
- [ ] No `@digiversity/*`, copied theme/font/assets, clickable non-semantic div,
  raw unknown DTO in component, `any`, local legality/result/deadline authority
  or credential persistence regression remains.
- [ ] Specs describe actual implementation/tooling/support matrix and no longer
  label implemented interactions/harness as FUTURE/missing.
- [ ] All focused/full frontend, browser, a11y, visual, real-boundary,
  repository verify and scope checks pass from a clean dependency state.

## Контекст и подтверждённое состояние

- Existing fixtures already cover preparation, door, combat, run-away, charity,
  helper, advanced/target/private, economy/theft, death, victory, density,
  offline/stale and missing art; they should be extended, not replaced.
- Current Playwright projects are only `1280x720`, `599x720`, `320x720`, and
  visual suite captures one primary combat plus a few domain baselines.
- Earlier specs contain stale audit claims and pre-Figma visual direction.
- Each implementation slice has its own verification, so this plan is not a
  substitute for them; it is the cross-slice completeness/adversarial gate.

## Scope

### Входит

- Fixture/state registry, Playwright project/matrix helpers, semantic/a11y/
  visual/real-boundary tests and reviewed baselines.
- Final specs/current-state/DoD correction.

### Не входит

- New feature, backend/content/wire schema, dependency/CI policy, automatic
  snapshot acceptance, redesign of Card Studio or support expansion beyond the
  agreed matrix.
- Broad refactor justified only by aesthetics or coverage percentage.
- Любая запись в player production Vue/TS/SCSS. Найденный defect требует
  amendment/reapproval или отдельного exact implementation plan.

## Архитектурный подход

1. One typed state registry is consumed by structural, a11y and visual tests;
   fixtures remain parsed through `projectionSchema` and privacy-negative tests.
2. Matrix is tiered to bound runtime: all states at canonical semantic viewport,
   dense critical subset at every boundary, selected family visuals only on
   canonical Chromium, one opt-in real boundary.
3. Snapshot updates are review artifacts, never a blanket `--update-snapshots`
   acceptance.
4. Этот plan не исправляет production code: failed product criterion возвращает
   очередь к конкретному owner plan или создаёт новый narrow plan.
5. Final docs distinguish automated evidence, manual Figma comparison and
   unsupported viewport fallback honestly.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| fixture registry | complete state/Figma mapping | strict actor projections |
| browser harness | tiered viewport/a11y/visual matrix | no production fixture leak |
| specs | actual final state and support claims | design contract v2 evidence |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/playwright.config.ts` | write | Canonical and semantic viewport projects |
| `frontend/applications/web/test/**` | write | Full component/model state coverage |
| `frontend/test/browser/figmaStateMatrix.ts` | write | Typed exhaustive Figma/descriptor/fixture registry |
| `frontend/test/browser/**` | write | Mapping/semantic/a11y/visual/real tests |
| `frontend/test/browser/visual-baselines/**` | generated | Individually reviewed canonical artifacts |
| `docs/agents/FRONTEND_ENGINEERING_SPEC.md` | write | Final current-state evidence |
| `docs/agents/GAME_UI_UX_SPEC.md` | write | Final support/state matrix |
| `docs/agents/plans/active/20260801T225905Z-64608a-frontend-redesign-verification-cleanup.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260801T225905Z-64608a-frontend-redesign-verification-cleanup.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:browser-a11y-harness-v1` | existing CI/tooling | этот plan extends tests only | No dependency/CI change |
| `frontend:visual-baseline-set-v2` | all UI consumers | этот plan | Exclusive reviewed update |
| `frontend:player-ui-design-contract-v2` | entire queue | dependency + этот plan | Record implementation evidence |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 23:00:21 UTC.
- **Обнаруженные пересечения:** intentionally overlaps completed UI slices and
  browser baselines; must be last. Current infra drafts do not overlap paths.
- **Решение:** select only after all predecessors are completed, archived and
  separately committed. Any new feature/schema issue pauses for a new plan.

## План реализации

1. [ ] Build checked Figma/contract/fixture/state coverage registry and identify
   only genuine gaps after all predecessor commits.
2. [ ] Expand tiered browser/a11y/visual matrix and privacy-negative assertions.
3. [ ] Run canonical visuals; review every changed baseline against Figma.
4. [ ] Run real-boundary and lifecycle/action reachability smoke.
5. [ ] If product defect remains, stop and route it to an amended/new exact
   implementation plan; do not absorb production changes here.
6. [ ] Update specs with exact final implementation/evidence/support boundaries.
7. [ ] Run full canonical checks from clean state, scope-check, archive/release
   and final separate local commit; no push without explicit authorization.

## Проверки

- [ ] `cd frontend && pnpm lint`.
- [ ] `cd frontend && pnpm check`.
- [ ] `cd frontend && pnpm build`.
- [ ] `cd frontend && pnpm test:browser`.
- [ ] `cd frontend && pnpm test:a11y`.
- [ ] `cd frontend && pnpm test:visual` with no unreviewed baseline writes.
- [ ] `figmaStateMatrix.ts` compile-time coverage includes every exported action
  descriptor and its fixture/control assertion; `visual.spec.ts` consumes all
  distinct canonical families from that same registry.
- [ ] Opt-in real-boundary Chromium smoke with local Go application boundary.
- [ ] State registry reports zero unmapped approved Figma compositions and zero
  reachable server descriptors without semantic action control.
- [ ] Privacy-negative fixtures and credential artifact scan pass.
- [ ] Manual Figma comparison at `360x640` and `1440x900` plus safe-area and
  real browser chrome inspection.
- [ ] `node .codex/hooks/plan-lint.mjs`.
- [ ] `./leinoctl verify --changed`.
- [ ] `./leinoctl scope-check --plan 20260801T225905Z-64608a-frontend-redesign-verification-cleanup`.
- [ ] `git diff --check`.

## Риски и откат

- **Риск:** huge snapshot churn hides regressions. **Снижение:** tiered selected
  visuals and individual review; no bulk acceptance.
- **Риск:** финальный gate находит product defect. **Снижение:** не расширять
  broad write set; остановить completion и создать/amend narrow owner plan.
- **Риск:** full matrix becomes flaky/too slow. **Снижение:** all-state canonical
  semantics, dense boundary subset, visual Chromium-only, real smoke separate.
- **Риск:** docs overclaim unsupported screens. **Снижение:** explicit full
  support vs safety-only evidence table.
- **Откат:** revert final tests/baselines/docs commit; earlier verified commits
  remain independently recoverable.

## Открытые вопросы

- Approval exact queue подтверждает, что dev-only `/studio/cards` не redesign-ится,
  а только проходит compatibility checks. A failed criterion that requires
  product code, backend, contracts, dependency or new Figma design blocks this
  plan and requires amended/new approval; it is not silently absorbed.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 23:00:21 UTC
- **Подтверждено:** 2026-08-02, user batch approval: exact queue in listed order; push запрещён
- **Дополнительно подтверждено:** 2026-08-02, user разрешил сначала выполнить workflow queue `20260802T115448Z` → `20260802T115450Z` → `20260802T115451Z`; этот final-gate остаётся после неё.
- **Формулировка/ограничения пользователя:** User requested the complete
  frontend/layout plan at once. This final slice proves the whole approved
  player-facing rebuild and does not redesign the dev-only Card Studio. Batch
  approval этой очереди: выполнять exact plan IDs в указанном порядке; push не
  выполнять.

## Ход выполнения

- Draft prepared as final exact queue item; implementation not started.

## Итог

Заполняется после реализации.
