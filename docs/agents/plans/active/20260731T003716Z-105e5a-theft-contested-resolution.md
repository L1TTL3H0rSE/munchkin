# PLAN: theft contested resolution

- **Plan ID:** `20260731T003716Z-105e5a-theft-contested-resolution`
- **Статус:** draft
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 00:37:16 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260731T003716Z-5adc34-trade-gift-and-charity-transfer`.
- **Блокирует:** `20260731T003715Z-361542-death-loot-seat-priority`, `20260731T003716Z-3a0180-player-economy-and-theft-ui`
- **Связанные ADR/handoff:** ADR-0008, `docs/agents/GAME_INTERACTION_PROTOCOL.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "backend/game/internal/game/content.go",
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
    "content/schema/card-set.schema.json",
    "content/tools/validate.mjs",
    "content/tools/validate.test.mjs",
    "content/sets/moscow/v4/**",
    "content/README.md",
    "docs/agents/plans/active/20260731T003716Z-105e5a-theft-contested-resolution.md",
    "docs/agents/plans/archive/20260731T003716Z-105e5a-theft-contested-resolution.md"
  ],
  "components": [
    "go:backend/game",
    "frontend-workspace",
    "game-content",
    "repository-workflow"
  ],
  "contracts": [
    "content:card-set-v1",
    "game:player-economy-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260731T003716Z-5adc34-trade-gift-and-charity-transfer"
  ],
  "sharedResources": [
    "game:theft-resolution-v1",
    "content-set:moscow-core-v4",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ]
}
```

## Цель

Добавить theft как closed registered ability с server-selected random target/
outcome, opaque counter window and atomic ownership transfer без перечисления
чужой руки клиенту.

## Критерии приёмки

- [ ] Новый immutable `moscow-core@4` добавляет только original typed theft
  ability/capability; prior versions/digests unchanged.
- [ ] Victim выбирается только из server descriptors; source ability, phase,
  cooldown/cost and victim legality revalidate under CAS.
- [ ] Client never receives victim hand/item candidate list or chooses hidden
  target instance; engine RNG outcome persists in event.
- [ ] Counter window uses opaque public actor set, own counter descriptors and
  30-second auto-pass; no capability timing leak.
- [ ] Cost/counter/random transfer commit atomically or not at all; public zone
  result is revealed only when rule makes it public.
- [ ] Duplicate/retry/stale/timeout and concurrent victim state change have one
  deterministic winner.
- [ ] Replay applies exact stolen/no-op outcome without RNG.
- [ ] Schema/validator, engine/application/HTTP/Zod and three-actor privacy
  tests reject arbitrary target IDs, unknown abilities and private leaks.

## Контекст и подтверждённое состояние

- Current AbilityKind has no theft capability and content is immutable.
- Generic counters, target descriptors and atomic economy ownership exist
  after dependencies.
- ADR-0008 forbids request-foreign-hand-then-client-select flow.

## Scope

### Входит

- Closed theft ability/schema, original v4 pack, counter/RNG/transfer flow.
- Backend/public contract/tests and typed frontend adapter.

### Не входит

- Death loot, generic trade changes, UI, accounts, telemetry or admin.

## Архитектурный подход

1. Validate closed ability and immutable pack before activation.
2. Use public victim descriptor but keep hidden candidate selection in engine.
3. Persist RNG/counter/transfer outcome and apply atomically.
4. Project only own actions and realized public result.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| content | Theft ability and v4 pack | Immutable digest |
| engine/application | Countered RNG transfer | Replay/CAS |
| projection/contracts | Victim/action descriptors | No foreign inventory |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/internal/game/content.go` | write | Theft registry |
| `backend/game/internal/game/model.go` | write | Theft state |
| `backend/game/internal/game/engine.go` | write | Commands/outcome |
| `backend/game/internal/game/rules.go` | write | Legality/cost |
| `backend/game/internal/game/event.go` | write | Persisted RNG/transfer |
| `backend/game/internal/game/projection.go` | write | Private descriptors |
| `backend/game/internal/game/*_test.go` | write | Replay/privacy tests |
| `backend/game/internal/application/interaction_runtime.go` | write | RNG/CAS/timeout |
| `backend/game/internal/application/interaction_runtime_test.go` | write | Races/idempotency |
| `backend/game/internal/transport/httpapi/**` | write | Routes/fixtures |
| `frontend/packages/contracts/**` | write | Schemas/types |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Adapter |
| `content/schema/card-set.schema.json` | write | Ability schema |
| `content/tools/validate.mjs` | write | Validator |
| `content/tools/validate.test.mjs` | write | Invalid fixtures |
| `content/sets/moscow/v4/**` | write | Immutable pack |
| `content/README.md` | write | Version boundary |
| `docs/agents/plans/active/20260731T003716Z-105e5a-theft-contested-resolution.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003716Z-105e5a-theft-contested-resolution.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game:theft-resolution-v1` | economy UI/death backend | этот plan | Contract first |
| `content-set:moscow-core-v4` | later games | этот plan | Immutable |
| `game:http-v1` | product contracts | этот plan | Exclusive |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:16 UTC
- **Обнаруженные пересечения:** ordered backend/content/contracts chain only.
- **Решение:** execute after economy backend; Terraform untouched.

## План реализации

1. [ ] Add schema/validator/v4 content.
2. [ ] Implement pure theft/counter/RNG events.
3. [ ] Add application/projection/HTTP/Zod privacy tests.
4. [ ] Run validators/full checks, verify/scope-check and archive.

## Проверки

- [ ] `node content/tools/validate.mjs content/sets/moscow/v4/cards.json`
- [ ] `node --test content/tools/validate.test.mjs`
- [ ] `cd backend/game && go test ./...`
- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T003716Z-105e5a-theft-contested-resolution`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** foreign inventory/RNG leakage. **Снижение:** server-only selection,
  actor fixtures and no raw event exposure.
- **Откат:** disable v4 selection then revert; pinned old games unaffected.

## Открытые вопросы

- Scope-changing вопросов нет; v1 theft has one typed ability and no
  client-selected hidden card.

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
