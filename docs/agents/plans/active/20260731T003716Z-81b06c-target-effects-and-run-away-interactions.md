# PLAN: target effects and run away interactions

- **Plan ID:** `20260731T003716Z-81b06c-target-effects-and-run-away-interactions`
- **Статус:** draft
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 00:37:16 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help`.
- **Блокирует:** `20260731T003716Z-5adc34-trade-gift-and-charity-transfer`, `20260731T003715Z-20d561-target-effects-and-run-away-ui`
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
    "backend/game/internal/game/effects.go",
    "backend/game/internal/game/projection.go",
    "backend/game/internal/game/*_test.go",
    "backend/game/internal/application/interaction_runtime.go",
    "backend/game/internal/application/interaction_runtime_test.go",
    "backend/game/internal/transport/httpapi/**",
    "frontend/packages/contracts/**",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "docs/agents/plans/active/20260731T003716Z-81b06c-target-effects-and-run-away-interactions.md",
    "docs/agents/plans/archive/20260731T003716Z-81b06c-target-effects-and-run-away-interactions.md"
  ],
  "components": [
    "go:backend/game",
    "frontend-workspace"
  ],
  "contracts": [
    "game:advanced-combat-effects-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260731T003715Z-1b5b06-advanced-combat-effects-and-forced-help"
  ],
  "sharedResources": [
    "game:target-and-run-away-interactions-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ]
}
```

## Цель

Реализовать actor-specific targetable effects и полный Run Away protocol:
private mandatory choices, opaque counters, server-owned D6/outcomes,
multi-monster stable order and restart-safe timeout defaults.

## Критерии приёмки

- [ ] Initiator получает только server-valid public target IDs; target видит
  только свои private options; observers не получают hidden choice/counter.
- [ ] Hidden counter capability всегда использует opaque 30-second window;
  отсутствие counter не раскрывается immediate close timing.
- [ ] Mandatory timeout применяет deterministic typed default: single option,
  stable discard/transfer order or persisted RNG; unsafe content stays disabled.
- [ ] Each escaping participant/monster uses stable profile order and a
  separate persisted step; client never sends roll or realized outcome.
- [ ] Run Away modifier/counter commits before server roll, resets relevant
  response revision and replay stores exact D6/modifiers/Bad Stuff outcome.
- [ ] Reconnect restores same absolute deadline/step; player/system race has
  one committed outcome.
- [ ] Projection exposes own choices/actions and public realized result only.
- [ ] Legacy single-monster Run Away and non-target effects remain compatible.
- [ ] Engine/application/HTTP/Zod tests cover target privacy, invalid option,
  at-deadline boundary, multiple monsters, death continuation and replay.

## Контекст и подтверждённое состояние

- Generic durable windows and combat encounter order exist after dependencies.
- Current Run Away is single actor command; target effects do not support
  other-player private decisions/counters.
- Existing effect registry remains closed and content pack identity immutable.

## Scope

### Входит

- Target selection/private decisions/counters and timeout defaults.
- Multi-participant/multi-monster Run Away response/roll/outcome flow.
- Engine, application, projection, HTTP/Zod/API contracts and tests.

### Не входит

- Trade/gift/charity/theft/death loot, new content text/art, Vue UI, telemetry.

## Архитектурный подход

1. Model each target/escape step as persisted typed interaction with parent.
2. Inject fixed time and RNG outcome at application boundary; replay applies.
3. Project allowlisted actor options and coarse public outcomes.
4. Reuse deadline index/CAS/receipt rather than client timers.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| pure engine | Target and escape state machines | Persisted outcomes |
| application | Fixed time/RNG/system timeout | Atomic CAS/receipt |
| projection/contracts | Private choices/public results | Strict actor DTO |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/internal/game/model.go` | write | Target/escape state |
| `backend/game/internal/game/engine.go` | write | Typed transitions |
| `backend/game/internal/game/rules.go` | write | Legal/default/order rules |
| `backend/game/internal/game/event.go` | write | Realized RNG/outcomes |
| `backend/game/internal/game/effects.go` | write | Target/Bad Stuff application |
| `backend/game/internal/game/projection.go` | write | Actor-specific descriptors |
| `backend/game/internal/game/*_test.go` | write | Replay/privacy coverage |
| `backend/game/internal/application/interaction_runtime.go` | write | Clock/RNG/CAS integration |
| `backend/game/internal/application/interaction_runtime_test.go` | write | Timeout/race tests |
| `backend/game/internal/transport/httpapi/**` | write | Routes/fixtures |
| `frontend/packages/contracts/**` | write | Strict schemas/types |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Typed adapter |
| `docs/agents/plans/active/20260731T003716Z-81b06c-target-effects-and-run-away-interactions.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003716Z-81b06c-target-effects-and-run-away-interactions.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game:target-and-run-away-interactions-v1` | target UI/economy backend | этот plan | Contract first |
| `game:http-v1` | product contracts | этот plan | Exclusive while selected |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:16 UTC
- **Обнаруженные пересечения:** ordered backend/contracts chain; no Terraform
  overlap.
- **Решение:** fresh session after advanced combat completion.

## План реализации

1. [ ] Add target/escape models, defaults and replay tests.
2. [ ] Implement application RNG/time/CAS paths.
3. [ ] Add projections/HTTP/Zod fixtures and privacy tests.
4. [ ] Run full checks, verify/scope-check and archive.

## Проверки

- [ ] `cd backend/game && go test ./...`
- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T003716Z-81b06c-target-effects-and-run-away-interactions`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** private target/roll leakage. **Снижение:** cross-actor fixtures and
  persisted realized outcome only.
- **Риск:** restart duplicates roll/Bad Stuff. **Снижение:** stable system key,
  per-step CAS and replay tests.
- **Откат:** disable new profile capabilities then revert; old pinned games
  remain compatible.

## Открытые вопросы

- Scope-changing вопросов нет; stable encounter and participant order comes
  from the completed multiplayer profile.

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
