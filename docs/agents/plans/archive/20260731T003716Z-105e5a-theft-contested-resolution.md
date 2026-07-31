# PLAN: theft contested resolution

- **Plan ID:** `20260731T003716Z-105e5a-theft-contested-resolution`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 05:31:18 UTC
- **Владелец:** Codex `/root`
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

- [x] Новый immutable `moscow-core@4` добавляет только original typed theft
  ability/capability; prior versions/digests unchanged.
- [x] Victim выбирается только из server descriptors; source ability, phase,
  cooldown/cost and victim legality revalidate under CAS.
- [x] Client never receives victim hand/item candidate list or chooses hidden
  target instance; engine RNG outcome persists in event.
- [x] Counter window uses opaque public actor set, own counter descriptors and
  30-second auto-pass; no capability timing leak.
- [x] Cost/counter/random transfer commit atomically or not at all; public zone
  result is revealed only when rule makes it public.
- [x] Duplicate/retry/stale/timeout and concurrent victim state change have one
  deterministic winner.
- [x] Replay applies exact stolen/no-op outcome without RNG.
- [x] Schema/validator, engine/application/HTTP/Zod and three-actor privacy
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

1. [x] Add schema/validator/v4 content.
2. [x] Implement pure theft/counter/RNG events.
3. [x] Add application/projection/HTTP/Zod privacy tests.
4. [x] Run validators/full checks, verify/scope-check and archive.

## Проверки

- [x] `node content/tools/validate.mjs content/sets/moscow/v4/cards.json`
- [x] `node --test content/tools/validate.test.mjs`
- [x] `cd backend/game && go test ./...`
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260731T003716Z-105e5a-theft-contested-resolution`
- [x] `git diff --check`

## Риски и откат

- **Риск:** foreign inventory/RNG leakage. **Снижение:** server-only selection,
  actor fixtures and no raw event exposure.
- **Откат:** disable v4 selection then revert; pinned old games unaffected.

## Открытые вопросы

- Scope-changing вопросов нет; v1 theft has one typed ability and no
  client-selected hidden card.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** 2026-07-31 05:05:45 UTC
- **Формулировка/ограничения пользователя:** пользователь явно согласовал
  exact plan ID в очереди из девяти plans; после каждого завершённого plan
  требуется отдельный локальный commit и переход к следующему. Push не
  разрешён.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Approval очереди подтверждён пользователем; predecessor
  `20260731T003716Z-5adc34-trade-gift-and-charity-transfer` завершён commit
  `383972a`.
- Выполнен свежий `leinoctl context`, полностью прочитаны applicable
  `AGENTS.md` и skill `content-pack-change`; выбран immutable boundary
  `moscow-core@4` без изменения prior versions.
- Добавлен `lobby-multiplayer-v3@1`, closed ability
  `steal_random_card`, capability `counter_theft`, actor-owned descriptors,
  30-second opaque window и persisted RNG outcome.
- Engine/application tests покрывают counter/timeout/replay, idempotency,
  stale version, forged foreign target/cost, cooldown и три actor-specific
  projection без foreign-hand leak.
- Canonical Node 24 `verify --changed` прошёл 15 checks; final scope-check:
  `outsideWriteSet: []`, `staleChecks: []`, `missingRequiredChecks: []`.

## Итог

Plan завершён. Published immutable `moscow-core@4` имеет digest
`sha256:f7289170bf3b74ed72f81cbd4c79907f32c50a8a950e5bcc11e3689d99cb683b`;
v1-v3 не изменены. Проверки: content/schema 29/29, contracts 17/17, web 46/46,
полный Go suite, frontend lint/typecheck/build, plan-lint, canonical verify,
scope-check и `git diff --check` — успешно.
