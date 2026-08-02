# PLAN: figma game primitives view models

- **Plan ID:** `20260801T225859Z-5831ff-figma-game-primitives-view-models`
- **Статус:** completed
- **Создан:** 2026-08-01 22:58:59 UTC
- **Обновлён:** 2026-08-02 12:47:00 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260801T225856Z-b69a1a-frontend-scss-architecture-foundation`, `20260801T225858Z-49b2b8-figma-lobby-shell-rebuild`.
- **Блокирует:** `20260801T225900Z-2e903a-figma-mobile-game-states`, `20260801T225902Z-564b56-figma-desktop-game-states`.
- **Связанные ADR/handoff:** approved Figma component pages and desktop state set node `259:708`.

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/components/ActionPanel.vue",
    "frontend/applications/web/app/components/actionModel.ts",
    "frontend/applications/web/app/components/GameCard.vue",
    "frontend/applications/web/app/components/game/CardZone.vue",
    "frontend/applications/web/app/components/game/GameTable.vue",
    "frontend/applications/web/app/components/game/HandBrowser.vue",
    "frontend/applications/web/app/components/game/gameTableViewModel.ts",
    "frontend/applications/web/app/components/game/primitives/**",
    "frontend/applications/web/app/components/ui/**",
    "frontend/applications/web/app/composables/useGamePresentation.ts",
    "frontend/applications/web/app/composables/useCardSelection.ts",
    "frontend/applications/web/test/actionModel.test.ts",
    "frontend/applications/web/test/gameCardInteraction.test.ts",
    "frontend/applications/web/test/gameTableViewModel.test.ts",
    "frontend/applications/web/test/gamePresentation.test.ts",
    "frontend/applications/web/test/fixtures/**",
    "docs/agents/plans/active/20260801T225859Z-5831ff-figma-game-primitives-view-models.md",
    "docs/agents/plans/archive/20260801T225859Z-5831ff-figma-game-primitives-view-models.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "pnpm:@munchkin/contracts",
    "frontend:scss-foundation-v1"
  ],
  "dependsOn": [
    "20260801T225856Z-b69a1a-frontend-scss-architecture-foundation",
    "20260801T225858Z-49b2b8-figma-lobby-shell-rebuild"
  ],
  "sharedResources": [
    "frontend:game-presentation-model-v2",
    "frontend:figma-primitives-v1",
    "frontend:card-selection-owner-v2"
  ]
}
```

## Цель

Создать внутри одного Nuxt app типизированный presentation layer и локальные
Figma primitives, на которых mobile и desktop смогут собирать разные layouts
из одного actor-specific server projection. Компоненты должны стать тонкими
render/emit owners; server legality, RNG, результаты и privacy остаются за
`@munchkin/contracts` и existing controller/API.

## Критерии приёмки

- [x] `useGamePresentation`/pure models возвращают exhaustive discriminated
  presentation states для status/phase/encounter/combat/run-away/decision,
  не копируя projection в mutable store и не изобретая legal actions.
- [x] Action visibility/enabled state строится только из server
  `available_actions`/interaction descriptors; payload mapper, expected version
  и idempotency semantics остаются существующими.
- [x] Local primitives созданы в app, не в новой package: semantic button,
  icon button, avatar/player badge, phase label, strength indicator, advisory
  timer, deck back, card frame, card rail, rail pager, hand tab, sheet/dialog
  shell, status badge and visually-hidden/live-region helper.
- [x] Props/emits объявлены типами; event maps допускают `v-bind`/`v-on` из
  composables; components не импортируют `$fetch`, router, sessionStorage или
  raw transport DTO.
- [x] Card сохраняет обязательную illustration area и original placeholder;
  text располагается поверх/внутри утверждённой frame geometry, а не вместо art.
- [x] Monster/door cards на столе не получают redundant labels. Curse title
  остаётся частью card content. Footer использует один style/color и
  `justify-content: space-between`: слева level reward, справа treasures.
- [x] Несколько monsters представлены отдельными cards в bounded rail/pager;
  ни одна aggregate card не скрывает имя, силу, rules или Bad Stuff.
- [x] Door и Treasure deck backs — оригинальные local SVG/CSS assets по
  утверждённым заглушкам, без коммерческого trade dress и image generation.
- [x] Hand tab повторяет утверждённый Figma rail: центральная `Рука · N`,
  optional timer слева только при actionable deadline, optional interaction
  indicator справа только при реальном open interaction.
- [x] Strength value использует approved compact typography (`14px` в header
  usage). Breakdown опирается на authoritative totals и только видимые
  contributors; неатрибутированный остаток маркируется как прочие эффекты.
- [x] One selection owner обслуживает compact rail, full-hand sheet и card
  action context; projection version change удаляет stale selection.
- [x] Placeholder, long Russian copy, huge numeric values, empty and dense
  rails имеют deterministic unit/component fixtures.

## Контекст и подтверждённое состояние

- Current `GameTable` напрямую вычисляет own/visible cards, action maps,
  pending/confirmed motion and selection. `GameCard`, `HandBrowser`,
  `ActionPanel` имеют полезную typed behavior, но presentation соответствует
  старому UI.
- Contracts уже содержат card illustration path, rules/flavor, monster stats,
  rewards, combat totals/effects, all available actions and interaction kinds.
- Figma hybrid закрепил Card D/E, Header/Card Rail/Rail Pager F, illustration
  placeholder, hand indicator и compact strength.
- Digiversity reference показывает pattern `typed props/emits → view-model
  composable → thin view`; Munchkin применяет его app-locally.

## Scope

### Входит

- Pure mapping/presentation/selection models and tests.
- Local UI/game primitives and scoped SCSS.
- Refactor existing card/rail/action components sufficient to expose stable
  contracts to later mobile/desktop plans.
- Extend existing actor-safe fixture catalog; no production fixture mode.

### Не входит

- Final route/table composition, all domain sheets, system/reconnect visuals,
  new wire fields, backend logic or Card Studio.
- New UI package, global component auto-index generator, external icon/font/
  carousel dependency.
- Local computation of combat result, eligible targets, deadline authority,
  foreign hand contents or deck order.

## Архитектурный подход

1. `packages/contracts` remains wire owner; app presentation types wrap parsed
   types and use discriminated unions for render state.
2. Pure mapping functions accept readonly projection and return labels,
   references and server action bindings, never a second domain model.
3. Composables own ephemeral UI only: selected card, open sheet, focus return,
   rail index and confirmed visual delta.
4. Primitives are accessible native elements with narrow props/emits and
   component-owned SCSS; no business behavior or route awareness.
5. Mobile/desktop parents choose composition; primitives do not branch on
   `window.innerWidth` or duplicate state.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| presentation models | projection → render-ready discriminated state | readonly parsed projection |
| card/action/selection | Figma frame and one action owner | existing action descriptors |
| local primitives | typed props/emits and SCSS | app-internal only |
| fixtures/tests | every primitive edge state | actor-specific public data only |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/components/ActionPanel.vue` | write | Thin action presenter contract |
| `frontend/applications/web/app/components/actionModel.ts` | write | Server descriptor mapping/reconciliation |
| `frontend/applications/web/app/components/GameCard.vue` | write | Approved card anatomy and art fallback |
| `frontend/applications/web/app/components/game/CardZone.vue` | write | Bounded zone primitive consumer |
| `frontend/applications/web/app/components/game/GameTable.vue` | write | Shared presentation and selection owner integration |
| `frontend/applications/web/app/components/game/HandBrowser.vue` | write | Shared rail/sheet selection contract |
| `frontend/applications/web/app/components/game/gameTableViewModel.ts` | write | Pure normalized presentation mapping |
| `frontend/applications/web/app/components/game/primitives/**` | write | Figma game primitives |
| `frontend/applications/web/app/components/ui/**` | write | App-local accessible primitives |
| `frontend/applications/web/app/composables/useGamePresentation.ts` | write | Headless screen view model |
| `frontend/applications/web/app/composables/useCardSelection.ts` | write | One ephemeral selection owner |
| `frontend/applications/web/test/actionModel.test.ts` | write | Descriptor mapping regressions |
| `frontend/applications/web/test/gameCardInteraction.test.ts` | write | Card semantics/selection |
| `frontend/applications/web/test/gameTableViewModel.test.ts` | write | Projection mapping |
| `frontend/applications/web/test/gamePresentation.test.ts` | write | Exhaustive presentation states |
| `frontend/applications/web/test/fixtures/**` | write | Strict public component fixtures |
| `docs/agents/plans/active/20260801T225859Z-5831ff-figma-game-primitives-view-models.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260801T225859Z-5831ff-figma-game-primitives-view-models.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:game-presentation-model-v2` | mobile/desktop/sheets/status | этот plan | Freeze typed contract before layouts |
| `frontend:figma-primitives-v1` | all following UI slices | этот plan | App-local stable primitive API |
| `frontend:card-selection-owner-v2` | hand and decision sheets | этот plan | Single owner, reused later |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 23:00:21 UTC.
- **Обнаруженные пересечения:** later mobile/desktop plans consume the same
  primitives; existing infrastructure plans do not touch frontend.
- **Решение:** complete/commit this contract plan before layout plans; material
  props/emits change later requires queue reapproval.

## План реализации

1. [x] Inventory every Figma primitive and map it to available contract fields;
   mark unsupported visual data instead of inventing it.
2. [x] Add pure presentation state and server-action mapping tests first.
3. [x] Extract one card/selection/rail owner from current `GameTable`.
4. [x] Build local UI/game primitives with typed props/emits and scoped SCSS.
5. [x] Implement original deck backs and card placeholder assets/components.
6. [x] Validate semantic markup, focus, long content and reduced-motion states.
7. [x] Full frontend checks, canonical verify/scope-check, archive/local commit.

## Проверки

- [x] Focused Vitest: action, card, presentation, selection and fixture privacy.
- [x] Browser fixture/component smoke checks for accessible names, native buttons, disabled/pending,
  one card title, reward footer parity and multi-card rail paging.
- [x] `rg -n "@digiversity|<div[^>]+@click|\bany\b"` over changed app files,
  followed by manual review of legitimate matches.
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`.
- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260801T225859Z-5831ff-figma-game-primitives-view-models`.
- [x] `git diff --check`.

## Риски и откат

- **Риск:** presentation mapping becomes a second rules engine. **Снижение:**
  server descriptors are sole authority; models only group/label references.
- **Риск:** primitive abstraction recreates a library. **Снижение:** app-local,
  concrete Figma consumers and no public package/export barrel.
- **Риск:** card refactor loses obscure fields/privacy. **Снижение:** Zod fixtures,
  existing action tests and separate self/other inputs.
- **Риск:** multiple render modes fork selection. **Снижение:** one composable
  owner and version reconciliation tests.
- **Откат:** revert isolated component/model commit; API/contracts/data intact.

## Открытые вопросы

- Exact per-modifier strength attribution отсутствует в текущем contract для
  всех cases. Plan показывает authoritative total + known visible rows +
  residual `Прочие эффекты`; новый detailed backend breakdown требует отдельный
  backend/contract plan и повторное согласование.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 23:00:21 UTC
- **Подтверждено:** 2026-08-02, user batch approval: exact queue in listed order; push запрещён
- **Формулировка/ограничения пользователя:** Использовать утверждённый гибрид
  Figma и Digiversity-style code organization, не создавать library; card art
  area обязательна, multiple monsters — отдельные cards, hand rail/header/card
  follow approved variants. Batch approval этой очереди: выполнять exact plan
  IDs в указанном порядке; push не выполнять.

## Ход выполнения

- Added `useGamePresentation` with discriminated status/phase/encounter/combat/run-away/decision states and server-only action mappings.
- Added app-local typed UI/game primitives: buttons, player/phase/strength/status surfaces, advisory timer, dialog/live-region helpers, card frame/placeholder/deck backs, bounded rails/pager and hand tab.
- Refactored `GameCard`, `CardZone`, `HandBrowser` and `GameTable` to consume the shared frame/rail/presentation/selection contracts; stale card selection clears on projection version changes.
- Preserved actor-specific privacy and existing command payload/idempotency/controller boundaries; no contracts, backend, router, credential or Card Studio changes.
- Focused Vitest: 23 tests passed before the full suite; full web Vitest: 23 files, 131 tests passed.
- Browser fixture smoke: 37/43 passed in the parallel cold-start run; the six initial navigation timeouts passed on a one-worker rerun. The later 37 tests and card-action/keyboard/media checks passed.
- `frontend` lint, Nuxt typecheck and web build passed; browser artifacts were removed after inspection. Pattern scan and `git diff --check` passed.
- Canonical `verify --changed` and scope-check completed successfully after archive preparation; one unledgered lifecycle path warning is expected from the post-commit plan transition.

## Итог

Completed and archived as `20260801T225859Z-5831ff-figma-game-primitives-view-models.md`. The frozen app-local primitive and presentation contracts are ready for the ordered mobile and desktop layout plans. No push performed.
