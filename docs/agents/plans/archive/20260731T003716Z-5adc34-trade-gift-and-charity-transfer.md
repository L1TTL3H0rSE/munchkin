# PLAN: trade gift and charity transfer

- **Plan ID:** `20260731T003716Z-5adc34-trade-gift-and-charity-transfer`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 04:59:43 UTC
- **Владелец:** Codex /root
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

- [x] Trade/gift доступны только в server-allowed parent phases and blocked by
  combat/mandatory decisions.
- [x] Offerer selects only descriptor-owned transferable cards/clauses and one
  legal recipient; no arbitrary hand IDs/free-text obligations.
- [x] Exact offer visible only to parties; observers see public zone/count
  delta only after committed transfer.
- [x] Accept revalidates ownership/loadout/capacity under CAS and transfers all
  clauses atomically; decline/cancel/timeout moves nothing.
- [x] One pending addressed offer, stable IDs, 30-second deadline and
  idempotent retry semantics.
- [x] Charity derives lowest-level recipients from public state and requires
  exactly excess cards.
- [x] Charity timeout uses persisted stable hand order and round-robin seat
  order; absent recipients cause deterministic deck-kind discard.
- [x] Allocation event stores exact recipient/card mapping; replay does not
  recompute current levels/order.
- [x] Cross-actor projection/HTTP/Zod tests reject foreign cards, partial
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

1. [x] Add trade/gift/charity models and replay/privacy fixtures.
2. [x] Implement CAS/system timeout and strict projections/routes.
3. [x] Add Zod/API consumers and concurrency tests.
4. [x] Run full checks, verify/scope-check and archive.

## Проверки

- [x] `cd backend/game && go test ./...`
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260731T003716Z-5adc34-trade-gift-and-charity-transfer`
- [x] `git diff --check`

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

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** 2026-07-31
- **Формулировка/ограничения пользователя:** Пользователь явно подтвердил exact
  plan ID в очереди из девяти планов, разрешил реализацию и отдельный локальный
  commit после каждого плана. Push не разрешён.

## Ход выполнения

- Predecessor
  `20260731T003716Z-81b06c-target-effects-and-run-away-interactions`
  завершён, заархивирован и зафиксирован локальным commit `96996ac`.
- Получен свежий impact/context для engine, application, HTTP и frontend
  contracts; перечитаны scoped instructions, ADR-0008 и interaction protocol.
- После подтверждённого завершения исходной planning-session выполнен explicit
  takeover; plan выбран session
  `019fb5dd-0f28-7241-a45d-5acf3255717a`.
- Добавлен profile-gated player economy: carried-item trade/gift clauses,
  addressed accept/decline/cancel lifecycle, 30-секундный timeout и атомарная
  повторная проверка ownership/loadout/Big-item capacity под CAS.
- Добавлена обязательная charity transfer: lowest-level recipients,
  persisted hand/seat order, manual exact allocation, round-robin timeout и
  deterministic deck-kind discard при отсутствии получателей.
- Exact clauses доступны только сторонам offer; observer projection сохраняет
  только coarse interaction kind. Legacy charity `instance_ids` HTTP contract
  сохранён для старых rules profiles.
- Канонический `./leinoctl verify --changed` прошёл 16 checks: весь Go backend,
  frontend lint/typecheck, 62 Vitest tests, два Nuxt production builds,
  42 hook tests, 68/69 leinoctl tests (1 platform skip), plan-lint, Bash syntax
  и `docker compose --parallel 8 config`.

## Итог

Player economy v1 завершён. Trade/gift выполняются только из серверных
descriptor-owned carried items и коммитятся целиком либо не меняют ownership.
Charity хранит точную allocation mapping в событии и не пересчитывает её при
replay; timeout стабилен относительно persisted hand/seat order. Scoped Go,
HTTP, application, Zod и cross-actor privacy tests зелёные; canonical verify
и final scope-check прошли.
