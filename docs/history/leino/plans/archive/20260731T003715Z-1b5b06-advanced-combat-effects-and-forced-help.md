# PLAN: advanced combat effects and forced help

- **Plan ID:** `20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:15 UTC
- **Обновлён:** 2026-07-31 03:36:54 UTC
- **Владелец:** Codex /root
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260731T001853Z-015911-combat-helper-reward-settlement`.
- **Блокирует:** `20260731T003716Z-81b06c-target-effects-and-run-away-interactions`, `20260731T003716Z-a8bca4-advanced-combat-effects-ui`
- **Связанные ADR/handoff:** ADR-0008, `docs/agents/GAME_INTERACTION_PROTOCOL.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "backend/game/internal/game/content.go",
    "backend/game/internal/game/model.go",
    "backend/game/internal/game/engine.go",
    "backend/game/internal/game/event.go",
    "backend/game/internal/game/effects.go",
    "backend/game/internal/game/projection.go",
    "backend/game/internal/game/*_test.go",
    "backend/game/internal/application/interaction_runtime.go",
    "backend/game/internal/application/interaction_runtime_test.go",
    "backend/game/internal/transport/httpapi/**",
    "frontend/packages/contracts/**",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "content/schema/card-set.schema.json",
    "content/tools/validate.mjs",
    "content/tools/validate.test.mjs",
    "content/sets/moscow/v3/**",
    "content/README.md",
    "docs/agents/plans/active/20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help.md",
    "docs/agents/plans/archive/20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help.md"
  ],
  "components": [
    "go:backend/game",
    "frontend-workspace",
    "game-content",
    "repository-workflow"
  ],
  "contracts": [
    "content:card-set-v1",
    "game:combat-helper-reward-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260731T001853Z-015911-combat-helper-reward-settlement"
  ],
  "sharedResources": [
    "game:advanced-combat-effects-v1",
    "content-set:moscow-core-v3",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ]
}
```

## Цель

Завершить combat-domain v1: поддержать server-registered additional Monster,
monster enhancer/counter и typed forced-help эффекты поверх combat response,
не раскрывая hidden sources и не нарушая one-helper/reward invariants.

## Критерии приёмки

- [x] Новый immutable `moscow-core@3` создаётся из проверенного v2 authoring
  snapshot; v2 остаётся explicit draft, v1/v2 не изменяются,
  author/license/source/digest и original-only content проверяются.
- [x] Schema и closed registry описывают только минимальные typed capabilities
  additional Monster/enhancer/counter/forced help; arbitrary expressions и
  raw target paths невозможны.
- [x] Actor descriptors содержат только собственный source и server-valid
  encounter/side/helper options; чужие hands/capabilities не проецируются.
- [x] Material add/enhance/counter атомарно обновляет encounter set/totals,
  reset-ит response revision и применяет bounded late `+10s`.
- [x] Stable encounter order сохраняется в events и определяет settlement/
  Run Away continuation; replay не повторяет content lookup как outcome.
- [x] Forced help выбирает ровно одного server-legal helper; voluntary accepted
  helper и forced helper одновременно невозможны; typed default reward `0`.
- [x] Counter ссылается на opaque public action/effect ID, а не на private
  source или event payload.
- [x] Unknown capability/effect and old profile fail closed; existing combat/
  help fixtures сохраняют observable behavior.
- [x] HTTP/Zod/API fixtures and cross-actor tests prove privacy, stale target,
  duplicate command, revision reset, hard cap and deterministic replay.

## Контекст и подтверждённое состояние

- Predecessor plans define combat response, one voluntary helper and exact
  reward settlement.
- Initial content registry supported `modify_combat`, but no explicit forced
  help/additional-monster capability contract. Repository truth showed
  `moscow-core@2` is an explicit authoring draft, so published v3 records its
  validated digest as source without changing or relabelling v2.
- ADR-0008 assigns all material combat responses the same CAS/deadline/reset
  semantics and forbids client-selected helper/outcome.
- Terraform plan has no shared paths or contracts.

## Scope

### Входит

- Minimal closed content capability/schema and original `moscow-core@3`.
- Additional Monster/enhancer/counter/forced-help engine/application/
  projection/HTTP contracts and replay/privacy tests.

### Не входит

- Voluntary helper renegotiation, Run Away, target effects, trade/theft/death.
- Vue surfaces, telemetry, infrastructure or commercial reference content.

## Архитектурный подход

1. Version content first and reject unknown capability combinations.
2. Project actor-owned descriptors; revalidate source/target under game CAS.
3. Persist realized encounter/forced-helper outcomes in events.
4. Reuse combat material revision/deadline path rather than add timers.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| content/schema | Typed combat capabilities and v3 pack | Immutable digest |
| pure engine/application | Advanced material responses | Replay-safe events/CAS |
| HTTP/contracts | Actor-specific descriptors | No hidden source/eligibility |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/internal/game/content.go` | write | Capability registry |
| `backend/game/internal/game/model.go` | write | Encounter/helper invariants |
| `backend/game/internal/game/engine.go` | write | Typed commands |
| `backend/game/internal/game/event.go` | write | Realized outcomes |
| `backend/game/internal/game/effects.go` | write | Closed effect application |
| `backend/game/internal/game/projection.go` | write | Actor descriptors |
| `backend/game/internal/game/*_test.go` | write | Replay/privacy/conformance |
| `backend/game/internal/application/interaction_runtime.go` | write | CAS integration |
| `backend/game/internal/application/interaction_runtime_test.go` | write | Race/retry coverage |
| `backend/game/internal/transport/httpapi/**` | write | Strict routes/fixtures |
| `frontend/packages/contracts/**` | write | Zod/types/fixtures |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Typed adapter |
| `content/schema/card-set.schema.json` | write | Closed capabilities |
| `content/tools/validate.mjs` | write | Semantic validation |
| `content/tools/validate.test.mjs` | write | Invalid fixtures |
| `content/sets/moscow/v3/**` | write | New immutable pack |
| `content/README.md` | write | Version/activation notes |
| `docs/agents/plans/active/20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game:advanced-combat-effects-v1` | advanced UI, later mechanics | этот plan | Backend/content first |
| `content-set:moscow-core-v3` | later domain plans | этот plan | Immutable dependency |
| `game:http-v1` | product contracts | этот plan | Exclusive while selected |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:15 UTC
- **Обнаруженные пересечения:** predecessor and later backend/UI drafts share
  contracts; Terraform does not.
- **Решение:** execute after helper backend in a fresh session; later plans
  depend on completed v3 contract.

## План реализации

1. [x] Add schema/validator invalid fixtures and immutable v3 pack.
2. [x] Implement pure advanced combat transitions/events.
3. [x] Add projection/application/HTTP/contracts and cross-actor tests.
4. [x] Run validators, Go/frontend checks, verify/scope-check and archive.

## Проверки

- [x] `node content/tools/validate.mjs content/sets/moscow/v3/cards.json`
- [x] `node --test content/tools/validate.test.mjs`
- [x] `cd backend/game && go test ./...`
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help`
- [x] `git diff --check`

## Риски и откат

- **Риск:** hidden-hand oracle or impossible helper/reward state.
  **Снижение:** opaque roster windows, actor-only descriptors and invariant
  tests.
- **Риск:** content v3 changes old games. **Снижение:** new immutable identity;
  old games retain pinned set/digest/profile.
- **Откат:** disable new-game v3 selection then revert code/content; persisted
  v3 games require compatible binary, not state rewriting.

## Открытые вопросы

- Scope-changing вопросов нет; only original v2-derived content and minimal
  typed capabilities are permitted.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:15 UTC
- **Подтверждено:** 2026-07-31
- **Формулировка/ограничения пользователя:** Пользователь явно подтвердил exact
  plan ID в очереди из девяти планов, разрешил реализацию и отдельный локальный
  commit после каждого плана. Push не разрешён.

## Ход выполнения

- Predecessor `20260731T001853Z-015911-combat-helper-reward-settlement`
  завершён, заархивирован и зафиксирован локальным commit `a8e55a6`.
- Выполнено read-only исследование текущих content/backend/frontend contracts;
  plan переведён в `in_progress` для exact approved selection.
- Создан published `moscow-core@3` с digest
  `sha256:5150be9bd21b86ef9f2adf87fec42f89da26264a3519379f04057e7140bbc238`;
  schema/Node/Go принимают только add/enhance/counter/forced-help capability.
- Новый `lobby-multiplayer-v2@1` активируется только для exact
  `moscow-core@3`; прежние packs/profiles fail closed и не материализуют v3
  capabilities.
- Pure events сохраняют stable encounter order и realized `fx_*` outcomes,
  replay не читает content для применения события. Multiple-monster settlement
  суммирует levels/treasures, forced helper получает typed reward `0`.
- Actor projection, application CAS/receipt, strict Go HTTP fixture и Zod
  fixture покрывают privacy, stale/duplicate actions, revision reset,
  deadline extension и counter target opacity.
- Фактически прошли: v3 validator; 26 content tests; весь Go backend;
  frontend lint/typecheck, 58 tests и production build; `git diff --check`.
- После переноса combat helpers в разрешённый `effects.go` выполнен свежий
  canonical `./leinoctl verify --changed`: все frontend/content/Go, hooks,
  leinoctl, plan-lint, shell syntax и Compose config gates прошли.
- Финальный `scope-check` завершился с `outsideWriteSet: []` и exit code `0`;
  `rules.go` восстановлен byte-for-byte и в итоговый diff не входит.

## Итог

План завершён. Published `moscow-core@3` и exact
`lobby-multiplayer-v2@1` активируют replay-safe additional Monster,
enhancer/counter и forced-help эффекты; actor projection не раскрывает
private sources, а старые profile/content combinations fail closed. Все
обязательные проверки и scope-check прошли, plan перенесён в archive.
