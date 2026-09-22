# PLAN: death loot seat priority

- **Plan ID:** `20260731T003715Z-361542-death-loot-seat-priority`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:15 UTC
- **Обновлён:** 2026-07-31 06:04:10 UTC
- **Владелец:** Codex `/root`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260731T003716Z-105e5a-theft-contested-resolution`.
- **Блокирует:** `20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry`, `20260731T003716Z-fc6391-death-loot-priority-ui`
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
    "docs/agents/plans/active/20260731T003715Z-361542-death-loot-seat-priority.md",
    "docs/agents/plans/archive/20260731T003715Z-361542-death-loot-seat-priority.md"
  ],
  "components": [
    "go:backend/game",
    "frontend-workspace"
  ],
  "contracts": [
    "game:theft-resolution-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260731T003716Z-105e5a-theft-contested-resolution"
  ],
  "sharedResources": [
    "game:death-loot-priority-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ]
}
```

## Цель

Заменить immediate death discard на deterministic loot pool with stable seat
priority: только current looter видит legal options, pick/pass/timeout
передаёт очередь, остаток discard-ится terminal event.

## Критерии приёмки

- [x] Death event creates internal lootable pool and preserves profile-defined
  traits/persistent state; public projection reveals only safe counts/results.
- [x] Living actors ordered by stable persisted seat order, not response
  latency or connection status.
- [x] Only current priority actor receives own legal pool options; others
  cannot enumerate remaining private cards.
- [x] Pick/pass uses server descriptor and current version; chosen card
  ownership revalidates atomically.
- [x] Each seat has absolute 30-second deadline; timeout auto-pass is
  restart-safe and never skips two seats.
- [x] Pool empty/all seats terminal closes window, exact remainder discard
  stored in event and parent phase resumes deterministically.
- [x] Disconnect/reconnect preserves same priority/deadline.
- [x] Concurrent pick/timeout and duplicate requests yield one committed
  transition.
- [x] Replay/privacy/HTTP/Zod tests cover 1–6 players, no loot, mixed zones,
  all pass, pool exhaustion and observer redaction.

## Контекст и подтверждённое состояние

- Current death immediately discards lootable zones.
- Generic deadline/CAS and private option descriptors exist after dependencies.
- ADR-0008 explicitly selects seat-priority exception for scarce loot.

## Scope

### Входит

- Death pool, seat queue, pick/pass/timeout, terminal discard/continuation.
- Engine/application/projection/HTTP/Zod/API contracts and tests.

### Не входит

- Resurrection, auctions, account inventory, UI, telemetry or new content.

## Архитектурный подход

1. Persist pool and seat cursor; event carries exact movement/discard.
2. Keep one active priority actor and private options.
3. Use per-seat deadline revision and current timeout worker.
4. Resume parent only after terminal pool transition.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| engine | Death pool/priority state | Exact replay events |
| application | Per-seat timeout/CAS | Restart-safe |
| projection/contracts | Current actor options | Redacted observers |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/internal/game/model.go` | write | Pool/priority state |
| `backend/game/internal/game/engine.go` | write | Pick/pass/close |
| `backend/game/internal/game/rules.go` | write | Seat/order legality |
| `backend/game/internal/game/event.go` | write | Exact movements |
| `backend/game/internal/game/effects.go` | write | Death transition |
| `backend/game/internal/game/projection.go` | write | Private options |
| `backend/game/internal/game/*_test.go` | write | Replay/privacy tests |
| `backend/game/internal/application/interaction_runtime.go` | write | Per-seat timeout |
| `backend/game/internal/application/interaction_runtime_test.go` | write | Races/restart |
| `backend/game/internal/transport/httpapi/**` | write | Routes/fixtures |
| `frontend/packages/contracts/**` | write | Schemas/types |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Adapter |
| `docs/agents/plans/active/20260731T003715Z-361542-death-loot-seat-priority.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003715Z-361542-death-loot-seat-priority.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game:death-loot-priority-v1` | death UI/telemetry | этот plan | Contract first |
| `game:http-v1` | product contracts | этот plan | Exclusive |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:15 UTC
- **Обнаруженные пересечения:** final ordered gameplay backend contract slice.
- **Решение:** fresh session after theft completion; no Terraform overlap.

## План реализации

1. [x] Add pool/seat/timeout model and replay fixtures.
2. [x] Implement projection/application/routes/contracts.
3. [x] Prove privacy, restart and pick-v-timeout races.
4. [x] Run full checks, verify/scope-check and archive.

## Проверки

- [x] `cd backend/game && go test ./...`
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260731T003715Z-361542-death-loot-seat-priority`
- [x] `git diff --check`

## Риски и откат

- **Риск:** pool/priority leaks private death state. **Снижение:** current actor
  allowlist and observer fixtures.
- **Риск:** timeout skips/moves twice. **Снижение:** cursor/revision CAS tests.
- **Откат:** disable new death profile before revert; active pools require
  compatible binary, never manual snapshot editing.

## Открытые вопросы

- Scope-changing вопросов нет; stable seat order from game state is normative.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:15 UTC
- **Подтверждено:** 2026-07-31 05:36:19 UTC
- **Формулировка/ограничения пользователя:** пользователь явно согласовал
  exact plan ID в очереди из девяти plans; после каждого завершённого plan
  требуется отдельный локальный commit и переход к следующему. Push не
  разрешён.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Approval очереди подтверждён пользователем; predecessor
  `20260731T003716Z-105e5a-theft-contested-resolution` завершён commit
  `d45fbf6`.
- Выполнен свежий `leinoctl context`, полностью прочитаны applicable
  `AGENTS.md`, ADR-0008, multiplayer protocol, frontend engineering spec и
  skills `backend-game-change`/`frontend-game-change`.
- Добавлен versioned rules profile `lobby-multiplayer-v4`: смерть переносит
  lootable hand/carried/equipped карты во внутренний pool, сохраняет
  persistent character state и фиксирует стабильный порядок живых мест.
- Каждый looter получает отдельное 30-секундное actor-private interaction
  окно. Pick использует только opaque server descriptor; pass и timeout
  двигают ровно один persisted seat cursor.
- Проекция раскрывает всем только безопасные счётчики, а legal card options
  и actions — только текущему looter. HTTP strictness test отвергает
  клиентский `instance_id`; Zod-схема отвергает internal pool/seat data.
- Replay фиксирует точный pick/discard outcome; application tests доказали
  idempotent duplicate, stale CAS, restart timeout и конкурентный
  pick-v-timeout с единственным committed переходом.
- Канонический Node 24 verify прошёл: 18 contract tests, 46 web tests,
  полный `go test ./...`, frontend lint/typecheck/build, `bash -n` и
  `docker compose --parallel 8 config`.

## Итог

Death loot больше не уничтожается немедленно для новых `moscow-core` v4 игр:
он проходит приватный deterministic seat-priority цикл, а точный остаток
фиксируется и discard-ится только в terminal transition. Старые rules
profiles остаются replay-compatible и сохраняют прежнее поведение.
