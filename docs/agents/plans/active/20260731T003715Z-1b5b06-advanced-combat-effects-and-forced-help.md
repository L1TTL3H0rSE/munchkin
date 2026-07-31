# PLAN: advanced combat effects and forced help

- **Plan ID:** `20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help`
- **Статус:** draft
- **Создан:** 2026-07-31 00:37:15 UTC
- **Обновлён:** 2026-07-31 00:37:15 UTC
- **Владелец:** —
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

- [ ] Новый immutable `moscow-core@3` создаётся из опубликованного v2; v1/v2
  не изменяются, author/license/source/digest и original-only content
  проверяются.
- [ ] Schema и closed registry описывают только минимальные typed capabilities
  additional Monster/enhancer/counter/forced help; arbitrary expressions и
  raw target paths невозможны.
- [ ] Actor descriptors содержат только собственный source и server-valid
  encounter/side/helper options; чужие hands/capabilities не проецируются.
- [ ] Material add/enhance/counter атомарно обновляет encounter set/totals,
  reset-ит response revision и применяет bounded late `+10s`.
- [ ] Stable encounter order сохраняется в events и определяет settlement/
  Run Away continuation; replay не повторяет content lookup как outcome.
- [ ] Forced help выбирает ровно одного server-legal helper; voluntary accepted
  helper и forced helper одновременно невозможны; typed default reward `0`.
- [ ] Counter ссылается на opaque public action/effect ID, а не на private
  source или event payload.
- [ ] Unknown capability/effect and old profile fail closed; existing combat/
  help fixtures сохраняют observable behavior.
- [ ] HTTP/Zod/API fixtures and cross-actor tests prove privacy, stale target,
  duplicate command, revision reset, hard cap and deterministic replay.

## Контекст и подтверждённое состояние

- Predecessor plans define combat response, one voluntary helper and exact
  reward settlement.
- Current content registry supports `modify_combat`, but no explicit forced
  help/additional-monster capability contract; `moscow-core@2` immutable.
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

1. [ ] Add schema/validator invalid fixtures and immutable v3 pack.
2. [ ] Implement pure advanced combat transitions/events.
3. [ ] Add projection/application/HTTP/contracts and cross-actor tests.
4. [ ] Run validators, Go/frontend checks, verify/scope-check and archive.

## Проверки

- [ ] `node content/tools/validate.mjs content/sets/moscow/v3/cards.json`
- [ ] `node --test content/tools/validate.test.mjs`
- [ ] `cd backend/game && go test ./...`
- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help`
- [ ] `git diff --check`

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

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:37:15 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Подготовить оставшиеся планы;
  implementation/select/commit/push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.

## Итог

Заполняется после реализации.
