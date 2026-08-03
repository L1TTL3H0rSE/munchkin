# PLAN: figma decision interaction surfaces

- **Plan ID:** `20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces`
- **Статус:** completed
- **Создан:** 2026-08-01 22:59:03 UTC
- **Обновлён:** 2026-08-02 21:48:29 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `codex/frontend-remaining-plans`
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260801T225856Z-b69a1a-frontend-scss-architecture-foundation`, `20260801T225858Z-49b2b8-figma-lobby-shell-rebuild`, `20260801T225859Z-5831ff-figma-game-primitives-view-models`, `20260801T225900Z-2e903a-figma-mobile-game-states`, `20260801T225902Z-564b56-figma-desktop-game-states`, `20260802T115450Z-eef974-frontend-browser-runner-determinism`.
- **Блокирует:** `20260801T225904Z-83bfe1-figma-system-terminal-states`, `20260801T225905Z-64608a-frontend-redesign-verification-cleanup`.
- **Связанные ADR/handoff:** interaction contract v1, approved Figma Sheets & Choices page `17` and desktop/mobile state flows.

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/components/ActionPanel.vue",
    "frontend/applications/web/app/components/interaction/InteractionSurface.vue",
    "frontend/applications/web/app/components/interaction/EconomySurface.vue",
    "frontend/applications/web/app/components/interaction/DeathLootSurface.vue",
    "frontend/applications/web/app/components/interaction/interactionModel.ts",
    "frontend/applications/web/app/components/interaction/economyModel.ts",
    "frontend/applications/web/app/components/interaction/helperOfferModel.ts",
    "frontend/applications/web/app/components/interaction/targetRunAwayModel.ts",
    "frontend/applications/web/app/components/interaction/advancedCombatModel.ts",
    "frontend/applications/web/app/components/interaction/deathLootModel.ts",
    "frontend/applications/web/app/components/interaction/core/**",
    "frontend/applications/web/app/components/interaction/domains/**",
    "frontend/applications/web/app/components/game/sheets/**",
    "frontend/applications/web/app/composables/useInteractionCountdown.ts",
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/test/interactionSurface.test.ts",
    "frontend/applications/web/test/interactionCountdown.test.ts",
    "frontend/applications/web/test/helperOfferSurface.test.ts",
    "frontend/applications/web/test/advancedCombatSurface.test.ts",
    "frontend/applications/web/test/targetRunAwaySurface.test.ts",
    "frontend/applications/web/test/playerEconomySurface.test.ts",
    "frontend/applications/web/test/deathLootSurface.test.ts",
    "frontend/applications/web/test/fixtures/**",
    "frontend/test/browser/advanced-combat.spec.ts",
    "frontend/test/browser/helper-offer.spec.ts",
    "frontend/test/browser/target-run-away.spec.ts",
    "frontend/test/browser/player-economy.spec.ts",
    "frontend/test/browser/death-loot.spec.ts",
    "frontend/test/browser/visual.spec.ts",
    "frontend/test/browser/visual-baselines/chromium/interaction-*.png",
    "docs/agents/plans/active/20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces.md",
    "docs/agents/plans/archive/20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces.md"
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
    "20260801T225900Z-2e903a-figma-mobile-game-states",
    "20260801T225902Z-564b56-figma-desktop-game-states",
    "20260802T115450Z-eef974-frontend-browser-runner-determinism"
  ],
  "sharedResources": [
    "frontend:interaction-window-ui-v2",
    "frontend:game-session-controller-v1",
    "frontend:decision-sheets-v1"
  ]
}
```

## Цель

Заменить монолитные generic action/economy/interaction panels на одну
доступную interaction kernel и конкретные Figma sheets/dialogs для всей
существующей multiplayer/game-decision семантики, сохранив actor privacy,
server descriptors, deadlines, idempotency и reconnect reconstruction.

## Критерии приёмки

- [x] `InteractionSurface.vue` больше не содержит все domains/template/styles;
  generic kernel владеет inbox, modality, focus trap/return, Escape/backdrop
  policy, pending/error/live status and deadline rendering.
- [x] Domain renderers получают strict typed props/emits и не вызывают API
  напрямую; route/controller остаётся единственной command composition boundary.
- [x] Mandatory choices нельзя закрыть Escape/backdrop. Optional information
  sheets закрываются предсказуемо и возвращают focus к trigger.
- [x] Timer использует `deadline_at` + `server_time` как advisory countdown:
  compact слева от Hand button, full в decision header; at zero UI говорит
  `Время вышло — ждём сервер` и не объявляет result локально.
- [x] Full Hand sheet не повторяет title/current card три раза; показывает one
  heading, count, readable cards, selection summary and server-valid actions.
- [x] Card detail включает illustration/placeholder, name, strength/value,
  rules, flavor and explicit `Непотребство`/Bad Stuff content when present;
  duplicate deck/monster labels отсутствуют.
- [x] Character sheet показывает race/class, equipment slots, carried items and
  relevant statuses. Equipment не занимает permanent table space.
- [x] Strength sheet показывает authoritative own/monster totals, helper,
  active visible modifiers and residual `Прочие эффекты`; UI breakdown never
  decides combat outcome.
- [x] Charity replaces abstract Mandatory Choice: `Рука 7/5`, exact required
  count, full card information, selected count, receiver/discard semantics from
  descriptor and self-opening mandatory sheet.
- [x] Helper flow covers offer/reward, receive, accept/refuse/cancel/expired and
  accepted helper state; reward values are server fields.
- [x] Combat intervention, target/private choice and Run Away cover responder,
  initiator/observer, multiple-monster selection, roll pending, success,
  failure and Bad Stuff without leaking private options.
- [x] Economy covers trade, gift, theft attempt/response/counter and stale or
  changed options. `EconomySurface` no longer displays permanent text-heavy UI.
- [x] Death loot covers actor priority, observer waiting, selected count,
  pass/all-pass/closed and no foreign hidden cards.
- [x] Closed/expired/changed interaction preserves safe status and focus; opaque
  projection renders generic legal actions without inferring hidden kind.
- [x] No user-visible `State 04`, `State 06`, `Retry Connection`, duplicated
  current card title or `Последнее состояние осталось...` engineering copy.
- [x] Existing interaction API/controller behavior and all focused tests are
  preserved; API changes are allowed only for consistent AbortSignal/typed
  option plumbing, never wire shape or authority.

## Контекст и подтверждённое состояние

- Current `InteractionSurface.vue` owns roughly 1.1k lines across inbox,
  deadline, focus trap, helper, target/run-away, charity/economy/death and
  opaque states. `EconomySurface.vue` is another large always-mounted surface.
- Pure domain models and broad Vitest/Playwright fixtures already exist and are
  valuable; this is a presentation decomposition, not a protocol rewrite.
- Contracts already support `response_window`, `combat_response`,
  `combat_help_offer`, `target_response`, `run_away_response`, `private_choice`,
  `economy_offer`, `charity_transfer`, `theft_response`,
  `death_loot_priority`, deadlines and response states.
- User explicitly corrected current Figma issues: concrete charity required,
  repeated Hand Sheet title and technical waiting/retry labels removed.

## Scope

### Входит

- Generic interaction kernel and all current domain renderers.
- Informational Hand/Card/Character/Strength sheets that share the same modal
  primitives and selection owner.
- Narrow controller/API adapter plumbing required to route existing typed
  intents/cancellation; existing error taxonomy and retries preserved.
- Focused unit/browser/a11y/visual updates for every interaction family.

### Не входит

- New interaction kind/wire field/backend command, local timer authority,
  matchmaking/chat/admin or Card Studio.
- Hiding legal `pass`/decline actions to simplify the design.
- Automatic local result at deadline or optimistic authoritative projection.

## Архитектурный подход

1. Generic kernel is one semantic dialog/sheet state machine: optional vs
   mandatory, open/closed/pending/expired, initial/trapped/returned focus.
2. A registry maps known public interaction kind to a typed domain renderer;
   unknown/opaque stays fail-closed generic, not a cast or guessed flow.
3. Domain models remain pure; components render complete server options and
   emit one intent. Controller owns expected version/idempotency/resync.
4. Mobile uses bottom sheet above safe area; desktop uses bounded dialog/side
   sheet. Both share content component and selection state.
5. Timer presentation is reconstructed from server timestamps after reconnect;
   visibility never grants/denies an action.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| interaction kernel | modal/inbox/timer/focus lifecycle | existing interaction view |
| domain renderers | concrete helper/combat/economy/etc. | existing descriptors only |
| info sheets | hand/card/character/strength | self/public projection only |
| controller/API | narrow event/abort plumbing if needed | no wire/schema change |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/pages/game/[id].vue` | write | Mount one interaction surface |
| `frontend/applications/web/app/components/ActionPanel.vue` | write | Remove replaced generic form UI |
| `frontend/applications/web/app/components/interaction/InteractionSurface.vue` | write | Thin dispatcher/kernel host |
| `frontend/applications/web/app/components/interaction/EconomySurface.vue` | write | Remove permanent monolith |
| `frontend/applications/web/app/components/interaction/DeathLootSurface.vue` | write | Keep death-loot surface within the shared kernel |
| `frontend/applications/web/app/components/interaction/*Model.ts` | write | Preserve/refine pure domain models |
| `frontend/applications/web/app/components/interaction/core/**` | write | Inbox/dialog/timer/focus owners |
| `frontend/applications/web/app/components/interaction/domains/**` | write | Typed domain renderers |
| `frontend/applications/web/app/components/game/sheets/**` | write | Hand/card/character/strength sheets |
| `frontend/applications/web/app/composables/useInteractionCountdown.ts` | write | Advisory server-time countdown |
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Existing intent routing only if necessary |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Consistent typed abort/options only if necessary |
| `frontend/applications/web/test/*Surface.test.ts` | write | Domain component regressions |
| `frontend/applications/web/test/interactionCountdown.test.ts` | write | Deadline/reconnect semantics |
| `frontend/applications/web/test/fixtures/**` | write | Actor-specific decision cases |
| `frontend/test/browser/*combat*.spec.ts` | write | Combat/help flows |
| `frontend/test/browser/helper-offer.spec.ts` | write | Helper lifecycle |
| `frontend/test/browser/target-run-away.spec.ts` | write | Target/private/run-away |
| `frontend/test/browser/player-economy.spec.ts` | write | Trade/gift/theft/charity |
| `frontend/test/browser/death-loot.spec.ts` | write | Death-loot privacy/focus |
| `frontend/test/browser/visual.spec.ts` | write | Central canonical interaction captures |
| `frontend/test/browser/visual-baselines/chromium/interaction-*.png` | generated | Reviewed canonical decision visuals |
| `docs/agents/plans/active/20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:interaction-window-ui-v2` | status/final gate | этот plan | One kernel for every domain |
| `frontend:game-session-controller-v1` | existing session lifecycle | shared, consumed | Preserve public behavior and tests |
| `frontend:decision-sheets-v1` | mobile/desktop tables | этот plan | Mount through frozen trigger contract |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 23:00:21 UTC.
- **Обнаруженные пересечения:** route/controller and test fixtures are shared
  with previous/later UI slices; infra plans do not overlap.
- **Решение:** execute only after both table presenters; controller wire or
  contract change is material and pauses for a separate plan/reapproval.

## План реализации

1. [x] Freeze interaction-kind → Figma surface → fixture/action mapping table.
2. [x] Extract and test generic modality/focus/deadline/inbox kernel.
3. [x] Build informational Hand/Card/Character/Strength sheets.
4. [x] Build concrete charity/helper/combat/target/private/run-away renderers.
5. [x] Build trade/gift/theft and death-loot renderers using same kernel.
6. [x] Replace old Action/Economy/Interaction monoliths and remove duplicate
   copy/styles only after feature parity tests pass.
7. [x] Run unit/browser/a11y/full checks, record the visual-baseline handoff,
   verify/scope-check, archive and separate local commit; push after the
   explicitly authorized queue step.

## Проверки

- [x] Existing and new focused Vitest suites for every interaction model/
  renderer, countdown zero/reconnect, focus lifecycle and privacy-negative data.
- [x] Browser actor matrix: initiator/responder/observer for helper, intervention,
  target/private, trade/gift/theft, charity and death loot.
- [x] Mandatory Escape/backdrop does not close; optional sheet closes and
  returns focus; changed/expired options announce status and remove stale action.
- [x] Canonical visual ownership is explicitly handed to the final verification
  plan (`20260801T225905Z-64608a`): this plan records the stale pre-decomposition
  captures and does not regenerate them before the shell/system slices land.
- [x] `visual.spec.ts`/`pnpm test:visual` handoff is recorded for the final plan;
  this plan's non-visual matrix excludes only the named `visual baseline` cases.
- [x] Axe serious/critical = 0, timer non-color semantics, reduced motion,
  forced colors and 200% zoom.
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`.
- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces`.
- [x] `git diff --check`.

## Риски и откат

- **Риск:** splitting monolith regresses mandatory/focus behavior. **Снижение:**
  kernel tests before domain migration and one surface mounted at a time.
- **Риск:** attractive domain UI hides valid server options. **Снижение:**
  descriptor completeness assertions and generic fail-closed fallback.
- **Риск:** countdown declares local result. **Снижение:** advisory-only state
  and server projection required for every transition.
- **Риск:** controller refactor affects idempotency/resync. **Снижение:** narrow
  optional plumbing, current controller/realtime tests remain canonical.
- **Откат:** revert interaction commit; no backend/schema/persisted-data change.

## Открытые вопросы

- If Figma asks for modifier/Bad Stuff data absent from current projection,
  render only available rules text and safe fallback. Adding a field is a new
  backend/contracts plan, not implicit scope in this queue.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 23:00:21 UTC
- **Подтверждено:** 2026-08-02, user batch approval: exact queue in listed order; push was initially deferred
- **Актуальное согласование:** 2026-08-02, user explicitly approved the exact
  queue `20260801T225903Z-2b0ad7` → `20260801T225904Z-83bfe1` →
  `20260801T225905Z-64608a` in branch `codex/frontend-remaining-plans` and
  authorized a push after each completed plan.
- **Дополнительно подтверждено:** 2026-08-02, user разрешил сначала выполнить workflow queue `20260802T115448Z` → `20260802T115450Z` → `20260802T115451Z`; этот UI plan остаётся downstream.
- **Формулировка/ограничения пользователя:** Исправить duplicate Hand Sheet
  title, technical waiting/retry labels, сделать State 04 конкретной
  благотворительностью и затем покрыть все sheets/interactions. Batch approval
  этой очереди: выполнять exact plan IDs в указанном порядке; push после каждого
  завершённого плана разрешён последующим явным сообщением пользователя.

## Ход выполнения

- Queue preflight completed: declared count 3 equals actual count 3; all three
  plans are active, approved and eligible, with dependencies satisfied in the
  listed order. Shared route/controller/fixture/visual paths are intentionally
  serialized; no infrastructure write set overlaps this queue.
- Selected in session `019fc404-588a-7c60-bca0-065e1aa6ed4a` on branch
  `codex/frontend-remaining-plans`; implementation started.
- Implemented the generic interaction kernel, typed domain surfaces and
  Hand/Card/Character/Strength sheets. `DeathLootSurface` and all new
  interaction surfaces now use the light accessibility tokens; no wire schema
  or controller authority changed.
- Corrected the manifest/write-set declaration to include the existing
  `DeathLootSurface.vue` file touched by the death-loot accessibility fix;
  `plan-lint` remains clean.

## Итог

- Functional Playwright matrix: `63/63` interaction/economy tests passed across
  `chromium`, `chromium-tablet` and `chromium-mobile`, excluding the stale
  visual-baseline cases owned by the final verification plan.
- Full Playwright a11y matrix: `123/123` passed across all three projects;
  focused unit/browser support remains green.
- `frontend/pnpm lint`: passed. Escalated `frontend/pnpm check`: `25/25` test
  files and `154/154` tests passed; typecheck passed.
- `node .codex/hooks/plan-lint.mjs`: passed (`plans=64 active=6 archive=58
  issues=0`). `git diff --check`: passed.
- Canonical `./leinoctl verify --changed`: passed. This included frontend lint,
  typecheck, `154/154` frontend tests, both production builds, repository hook
  tests (`42/42`), leinoctl tests (`81/81`), plan-lint, script syntax and
  Compose config. The earlier standalone sass-embedded crash did not reproduce
  in this canonical run.
- `./leinoctl scope-check --plan 20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces`:
  passed with `outsideWriteSet=[]`, `unledgered=[]` and no missing required
  checks. Older failed/stale ledger entries remain historical and are not
  lifecycle evidence.
- Canonical visual snapshots are intentionally not regenerated here: existing
  captures describe the pre-decomposition layout and the approved final plan
  owns the reviewed `visual-baselines/**` update. The non-visual run therefore
  excludes only tests named `visual baseline`; the mixed run reproduced the
  expected stale `advanced-combat.png` mismatch.
- No dependency or package-manifest change is included in this plan.
