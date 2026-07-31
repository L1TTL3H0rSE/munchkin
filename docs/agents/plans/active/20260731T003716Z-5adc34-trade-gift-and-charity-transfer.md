# PLAN: trade gift and charity transfer

- **Plan ID:** `20260731T003716Z-5adc34-trade-gift-and-charity-transfer`
- **Статус:** draft
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 00:37:16 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260731T003716Z-81b06c-target-effects-and-run-away-interactions`.
- **Блокирует:** `20260731T003716Z-105e5a-theft-contested-resolution`, `20260731T003716Z-3a0180-player-economy-and-theft-ui`
- **Связанные ADR/handoff:** ADR-0008, `docs/agents/GAME_INTERACTION_PROTOCOL.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "backend/game/internal/game/model.go",
    "backend/game/internal/game/engine.go",
    "backend/game/internal/game/rules.go",
    "backend/game/internal/game/event.go",
    "backend/game/internal/game/projection.go",
    "backend/game/internal/game/*_test.go",
    "backend/game/internal/application/interaction_runtime.go",
    "backend/game/internal/application/interaction_runtime_test.go",
    "backend/game/internal/transport/httpapi/**",
    "frontend/packages/contracts/**",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "docs/agents/plans/active/20260731T003716Z-5adc34-trade-gift-and-charity-transfer.md",
    "docs/agents/plans/archive/20260731T003716Z-5adc34-trade-gift-and-charity-transfer.md"
  ],
  "components": [
    "go:backend/game",
    "frontend-workspace"
  ],
  "contracts": [
    "game:target-and-run-away-interactions-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260731T003716Z-81b06c-target-effects-and-run-away-interactions"
  ],
  "sharedResources": [
    "game:player-economy-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ]
}
```

## Цель

Добавить безопасную other-player economy v1: addressed trade/gift offers и
обязательную charity transfer с atomic ownership changes, party-specific
privacy and deterministic anti-stall timeout.

## Критерии приёмки

- [ ] Trade/gift доступны только в server-allowed parent phases and blocked by
  combat/mandatory decisions.
- [ ] Offerer selects only descriptor-owned transferable cards/clauses and one
  legal recipient; no arbitrary hand IDs/free-text obligations.
- [ ] Exact offer visible only to parties; observers see public zone/count
  delta only after committed transfer.
- [ ] Accept revalidates ownership/loadout/capacity under CAS and transfers all
  clauses atomically; decline/cancel/timeout moves nothing.
- [ ] One pending addressed offer, stable IDs, 30-second deadline and
  idempotent retry semantics.
- [ ] Charity derives lowest-level recipients from public state and requires
  exactly excess cards.
- [ ] Charity timeout uses persisted stable hand order and round-robin seat
  order; absent recipients cause deterministic deck-kind discard.
- [ ] Allocation event stores exact recipient/card mapping; replay does not
  recompute current levels/order.
- [ ] Cross-actor projection/HTTP/Zod tests reject foreign cards, partial
  transfer, stale version and privacy leaks.

## Контекст и подтверждённое состояние

- Current charity only self-discards excess cards; trade/gift do not exist.
- Generic addressed/mandatory windows and deterministic timeout foundation
  exist after dependencies.
- Game players are guest participants; no account/global inventory is needed.

## Scope

### Входит

- Trade/gift offer lifecycle and atomic transfer.
- Charity allocation/timeout/discard and actor-specific projection.
- Engine/application/HTTP/Zod/API contracts and tests.

### Не входит

- Theft, death loot, auction/chat, accounts, Vue UI or telemetry.

## Архитектурный подход

1. Store exact clauses/parties in typed events and revalidate on accept.
2. Keep offer details party-only; public projection shows committed zones.
3. Model charity as mandatory interaction with deterministic system default.
4. Use existing CAS/receipt/deadline machinery.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| engine | Offer and charity state machines | Atomic ownership events |
| application | Party intents/system allocation | CAS/idempotency |
| projection/contracts | Party-only clauses | Privacy-safe DTO |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/internal/game/model.go` | write | Offer/allocation state |
| `backend/game/internal/game/engine.go` | write | Commands/transfers |
| `backend/game/internal/game/rules.go` | write | Phase/ownership/default rules |
| `backend/game/internal/game/event.go` | write | Exact allocations |
| `backend/game/internal/game/projection.go` | write | Party descriptors |
| `backend/game/internal/game/*_test.go` | write | Replay/privacy tests |
| `backend/game/internal/application/interaction_runtime.go` | write | CAS/system timeout |
| `backend/game/internal/application/interaction_runtime_test.go` | write | Race/retry tests |
| `backend/game/internal/transport/httpapi/**` | write | Routes/fixtures |
| `frontend/packages/contracts/**` | write | Schemas/types |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Typed adapter |
| `docs/agents/plans/active/20260731T003716Z-5adc34-trade-gift-and-charity-transfer.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003716Z-5adc34-trade-gift-and-charity-transfer.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game:player-economy-v1` | economy UI/theft backend | этот plan | Contract first |
| `game:http-v1` | product contracts | этот plan | Exclusive while selected |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:16 UTC
- **Обнаруженные пересечения:** sequential backend/contracts chain only; no
  Terraform overlap.
- **Решение:** execute after target/run-away plan in fresh session.

## План реализации

1. [ ] Add trade/gift/charity models and replay/privacy fixtures.
2. [ ] Implement CAS/system timeout and strict projections/routes.
3. [ ] Add Zod/API consumers and concurrency tests.
4. [ ] Run full checks, verify/scope-check and archive.

## Проверки

- [ ] `cd backend/game && go test ./...`
- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T003716Z-5adc34-trade-gift-and-charity-transfer`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** partial transfer/foreign-card leak. **Снижение:** atomic clause
  revalidation and three-actor serialized fixtures.
- **Риск:** charity timeout changes after replay. **Снижение:** exact allocation
  event with stable order.
- **Откат:** disable new economy actions then revert; no destructive rewrite.

## Открытые вопросы

- Scope-changing вопросов нет; v1 has exact card clauses and no enforceable
  chat/free-text.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Подготовить оставшиеся планы;
  implementation/select/commit/push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.

## Итог

Заполняется после реализации.
