# PLAN: multiplayer balance and privacy telemetry

- **Plan ID:** `20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 06:29:20 UTC
- **Владелец:** Codex `/root`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260731T003715Z-361542-death-loot-seat-priority`.
- **Блокирует:** `20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`
- **Связанные ADR/handoff:** ADR-0007, ADR-0008, `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "backend/game/go.mod",
    "backend/game/go.sum",
    "backend/game/cmd/server/main.go",
    "backend/game/internal/application/service.go",
    "backend/game/internal/application/interaction_runtime.go",
    "backend/game/internal/telemetry/**",
    "backend/game/internal/telemetry/*_test.go",
    "backend/game/internal/transport/httpapi/router.go",
    "backend/game/internal/transport/httpapi/router_test.go",
    "docs/agents/plans/active/20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry.md",
    "docs/agents/plans/archive/20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry.md"
  ],
  "components": [
    "go:backend/game"
  ],
  "contracts": [
    "game:death-loot-priority-v1",
    "observability:otel-foundation-v1"
  ],
  "dependsOn": [
    "20260731T003715Z-361542-death-loot-seat-priority"
  ],
  "sharedResources": [
    "observability:otel-foundation-v1",
    "game:multiplayer-balance-signals-v1"
  ]
}
```

## Цель

Добавить vendor-neutral privacy-safe telemetry для balance/operations всех
multiplayer windows без превращения traces/metrics в event history: duration,
close reason, timeout/extension/material response and coarse error signals с
bounded cardinality.

## Критерии приёмки

- [x] OTel SDK/exporter config is optional; disabled/unavailable telemetry does
  not break game API, commit or timeout worker.
- [x] Spans/metrics use allowlisted low-cardinality attributes: interaction
  kind, close reason, outcome class, retry/timeout/extension counters.
- [x] Forbidden: game/player/interaction/card IDs, display names, credentials,
  raw payloads/events/snapshots, deck order and reward card identities.
- [x] Metrics measure window duration, pending timeout rate, material late
  extension, stale conflict and helper accept/decline aggregates.
- [x] Instrumentation happens after/around authoritative transaction and never
  becomes replay/input or changes success semantics.
- [x] Trace propagation across HTTP/application/PostgreSQL respects request
  correlation without exposing bearer/idempotency payload.
- [x] Deterministic tests assert attribute allowlist/cardinality and exporter
  failure isolation.
- [x] Timing defaults `60/30/+10/90` are not changed by this plan; any balance
  change requires playtest evidence and separate compatibility plan.

## Контекст и подтверждённое состояние

- Full multiplayer protocol exists after dependency chain.
- Infrastructure roadmap reserves backend OTel foundation but no active
  implementation plan owns it yet; this plan owns backend instrumentation,
  not Collector/Terraform/dashboard deployment.
- ADR-0007 forbids high-cardinality/private telemetry and requires failure
  isolation.

## Scope

### Входит

- Backend OTel abstraction/wiring, coarse metrics/spans and privacy tests.

### Не входит

- Terraform/Collector/managed sink/dashboard/alerts, logs aggregation, RUM,
  admin analytics or timing changes.

## Архитектурный подход

1. Keep telemetry adapter beside application consumer and inject no-op default.
2. Emit only post-validated coarse attributes from closed enums.
3. Isolate exporter failures and never couple commit/replay to telemetry.
4. Hand off OTLP endpoint/deployment to infrastructure plan.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| backend telemetry | OTel meter/tracer adapters | No gameplay payload |
| application/HTTP | Coarse lifecycle spans | Bounded allowlist |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/go.mod` | write | Pinned OTel dependencies |
| `backend/game/go.sum` | generated | Dependency checksums |
| `backend/game/cmd/server/main.go` | write | Optional lifecycle wiring |
| `backend/game/internal/application/service.go` | write | Command signals |
| `backend/game/internal/application/interaction_runtime.go` | write | Window/timeout signals |
| `backend/game/internal/telemetry/**` | write | Adapter/allowlist |
| `backend/game/internal/telemetry/*_test.go` | write | Privacy/failure tests |
| `backend/game/internal/transport/httpapi/router.go` | write | Trace boundary |
| `backend/game/internal/transport/httpapi/router_test.go` | write | Header/privacy tests |
| `docs/agents/plans/active/20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `observability:otel-foundation-v1` | future infra Collector plan | этот plan for backend API | Infra consumes exporter contract |
| `game:multiplayer-balance-signals-v1` | final UI/state review | этот plan | Aggregate evidence only |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:16 UTC
- **Обнаруженные пересечения:** future infrastructure OTel plan must consume,
  not duplicate backend SDK; current Terraform plan does not touch backend.
- **Решение:** complete gameplay first; coordinate shared resource before any
  Collector/dashboard plan.

## План реализации

1. [x] Add no-op/recording OTel adapter and attribute allowlist tests.
2. [x] Instrument HTTP/application/window lifecycle with failure isolation.
3. [x] Run Go/privacy checks and optional local collector smoke if available.
4. [x] Verify/scope-check and archive.

## Проверки

- [x] `cd backend/game && go test ./...`
- [x] Exporter-disabled and exporter-failure smoke
- [x] Attribute scan contains zero forbidden IDs/names/payloads
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry`
- [x] `git diff --check`

## Риски и откат

- **Риск:** telemetry leaks private/high-cardinality data. **Снижение:** closed
  attribute builders and negative tests.
- **Риск:** exporter failure affects gameplay. **Снижение:** no-op/fail-open
  telemetry boundary.
- **Откат:** disable exporter or revert instrumentation; game data unchanged.

## Открытые вопросы

- External Collector/sink/retention belongs to infrastructure approval and is
  not silently selected here.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** 2026-07-31 05:36:19 UTC
- **Формулировка/ограничения пользователя:** пользователь явно согласовал
  exact plan ID в очереди из девяти plans; после каждого завершённого plan
  требуется отдельный локальный commit и переход к следующему. Push не
  разрешён.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Approval очереди подтверждён пользователем; predecessor
  `20260731T003715Z-361542-death-loot-seat-priority` завершён commit
  `c9b668a`.
- Добавлен disabled-by-default vendor-neutral OTLP/HTTP provider на
  OpenTelemetry Go `v1.43.0`: endpoint включает traces/metrics, отсутствие
  endpoint оставляет pure no-op, init/export/shutdown failure не меняет
  gameplay result.
- HTTP middleware принимает только W3C `traceparent`/`tracestate`, сохраняет
  streaming `Flusher` и пишет лишь coarse method/route-class/status
  attributes. Bearer, idempotency key, path values и bodies не становятся
  telemetry.
- Interaction signals публикуются только после authoritative transaction:
  window duration, closed enum kind/reason/outcome/response и отдельные
  timeout/material-extension/stale/retry counters. Helper accept/decline
  остаются aggregate response classes.
- Шесть focused telemetry tests доказали parent trace propagation,
  attribute/metric allowlist, sanitization unbounded values, disabled config,
  exporter/panic fail-open и application stale/helper/retry signals.
- `go mod verify` и полный `go test ./...` прошли. Канонический verify на
  Node 24 также прошёл frontend lint/check/build, `bash -n` и
  `docker compose --parallel 8 config`.
- Локальный `otelcol`/`otelcol-contrib` отсутствует, поэтому внешний Collector
  smoke не выполнялся; exporter-unavailable path покрыт deterministic test.

## Итог

Backend получил privacy-safe OTel foundation для multiplayer balance signals
без изменения rules/timing/replay. Production Collector, sink, retention и
dashboard остаются downstream infrastructure plans, которые расширяют этот
готовый adapter вместо дублирования gameplay telemetry.
