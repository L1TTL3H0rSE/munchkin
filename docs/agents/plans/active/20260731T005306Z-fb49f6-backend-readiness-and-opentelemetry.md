# PLAN: backend readiness and OpenTelemetry foundation

- **Plan ID:** `20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry`
- **Статус:** draft
- **Создан:** 2026-07-31 00:53:06 UTC
- **Обновлён:** 2026-07-31 01:01:00 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260731T005255Z-b3ea2b-github-actions-yandex-images`, `20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry`, `20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`.
- **Блокирует:**
  `20260731T005306Z-3de45e-production-compose-traefik-and-deploy`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "backend/game/go.mod",
    "backend/game/go.sum",
    "backend/game/Dockerfile",
    "backend/game/cmd/server/main.go",
    "backend/game/internal/repository/postgres/**",
    "backend/game/internal/telemetry/**",
    "backend/game/internal/transport/httpapi/router.go",
    "backend/game/internal/transport/httpapi/router_test.go",
    "frontend/package.json",
    "frontend/pnpm-lock.yaml",
    "frontend/applications/web/nuxt.config.ts",
    "frontend/applications/web/server/plugins/**",
    "frontend/applications/web/server/utils/telemetry/**",
    "infra/otel/**",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/operations/READINESS_MIGRATIONS_AND_OTEL.md",
    "docs/agents/plans/active/20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry.md",
    "docs/agents/plans/archive/20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry.md"
  ],
  "components": [
    "go:backend/game",
    "frontend-workspace",
    "repository-workflow"
  ],
  "contracts": [
    "operations:health-readiness-v1",
    "operations:migration-job-v1",
    "observability:otlp-runtime-v1"
  ],
  "dependsOn": [
    "20260731T005255Z-b3ea2b-github-actions-yandex-images",
    "20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry",
    "20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage"
  ],
  "sharedResources": [
    "observability:otel-foundation-v1",
    "runtime:production-health-v1",
    "database:production-migrations-v1",
    "delivery:immutable-image-pair-v1"
  ]
}
```

## Цель

Закрыть INFRA-006 и INFRA-008: отделить liveness от dependency-aware
readiness, вынести PostgreSQL migrations из каждого server startup в
идемпотентный one-shot operational command и закрепить privacy-safe,
vendor-neutral OTLP contract для Go game service и Nitro server. Недоступная
telemetry не должна менять HTTP/game/migration semantics.

## Критерии приёмки

- [ ] Game предоставляет отдельные `/health/live` и `/health/ready`;
  liveness не зависит от PostgreSQL/collector, readiness проверяет способность
  обслужить запрос и имеет bounded timeout. Legacy `/healthz` либо
  документированно совместим, либо удаляется только после consumer scan.
- [ ] Readiness не раскрывает DSN, SQL text, credentials, game/player/card IDs
  или internal state; response schema и HTTP statuses покрыты tests.
- [ ] Server startup по умолчанию не выполняет schema mutation.
  Idempotent migration command/job имеет advisory lock, ordered migrations,
  explicit timeout и distinct success/failure exit codes.
- [ ] Конкурентные migration attempts не применяют один migration дважды;
  partially failed migration блокирует rollout и не запускает новые app
  containers.
- [ ] Существующий privacy-safe gameplay telemetry plan остаётся source of
  truth для backend attributes. Этот plan не добавляет high-cardinality IDs,
  payloads, credentials, deck/event contents или user data.
- [ ] Go и Nitro поддерживают disabled-by-default OTLP config, resource
  attributes `service.name`, version/revision/environment и trace propagation
  только через allowlisted headers. Exporter failure fail-open для app и
  fail-closed только для отдельного telemetry smoke.
- [ ] Collector config vendor-neutral, без embedded credentials, bounded
  queues/retries/batches и health endpoint; sink/retention/dashboard остаются
  следующему plan.
- [ ] Docker image contract включает migration entrypoint и health probes без
  shelling secrets; image-pair workflow продолжает собирать оба images.
- [ ] Go/PostgreSQL/frontend tests, migration concurrency smoke, collector
  config validation, privacy negative scan, canonical verify и scope-check
  проходят.

## Контекст и подтверждённое состояние

- Current game router имеет один unconditional `GET /healthz`.
- `cmd/server/main.go` вызывает PostgreSQL migration на startup при
  `AUTO_MIGRATE`; migrations читаются из image path.
- Active plan
  `20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry` уже
  владеет backend OTel adapter/allowlist. Этот plan зависит от него и расширяет
  только operational/runtime contract.
- Nitro server не имеет общей telemetry wiring. Production collector/sink,
  dashboards и alerts ещё отсутствуют.
- Immutable image plan обязан быть завершён первым, чтобы health/migration/OTel
  revision публиковалась тем же digest contract.

## Scope

### Входит

- Game liveness/readiness, migration CLI/job и PostgreSQL concurrency tests.
- Go/Nitro OTLP configuration, propagation, resource attributes and shutdown.
- Vendor-neutral Collector base config и operational runbook.
- Image/workflow compatibility checks.

### Не входит

- Managed/self-hosted telemetry destination, logs stack, dashboard, alerting,
  RUM или pricing choice.
- Production Compose/Traefik deployment, DNS/TLS, secrets, backup.
- Новые gameplay metrics beyond approved privacy telemetry contract.
- Database schema/gameplay migrations unrelated to operational runner.

## Архитектурный подход

1. Health handlers используют injected readiness probe; liveness проверяет
   только event loop/process, readiness — bounded PostgreSQL ping и startup
   completion.
2. Migration logic отделяется от repository construction в explicit command,
   использует PostgreSQL advisory lock и migration ledger.
3. Telemetry создаётся через no-op default и единый allowlisted config parser.
   App shutdown flush bounded; exporter failure никогда не отменяет game
   transaction.
4. Collector принимает OTLP внутри private Compose network; наружный receiver
   не публикуется. Destination credentials появятся только через runtime secret
   boundary следующего plan.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| game HTTP | live/ready probes | Bounded non-secret health response |
| PostgreSQL adapter | one-shot migrations | Exit code + advisory lock |
| backend telemetry | operational spans/metrics wiring | Existing privacy allowlist |
| Nitro server | OTLP wiring | No browser credential/PII export |
| Collector config | OTLP receive/process/export placeholder | Private-only endpoint |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/go.mod` | write | Pinned OTel dependencies |
| `backend/game/go.sum` | generated | Dependency checksums |
| `backend/game/Dockerfile` | write | Migration/health image contract |
| `backend/game/cmd/server/main.go` | write | Startup/migration/telemetry lifecycle |
| `backend/game/internal/repository/postgres/**` | write | Probe/migration lock/tests |
| `backend/game/internal/telemetry/**` | write | Operational extension of approved adapter |
| `backend/game/internal/transport/httpapi/router.go` | write | Health endpoints |
| `backend/game/internal/transport/httpapi/router_test.go` | write | Health endpoint tests |
| `frontend/package.json` | write | Pinned OTel server dependencies if justified |
| `frontend/pnpm-lock.yaml` | generated | Dependency lock update |
| `frontend/applications/web/nuxt.config.ts` | write | Nitro telemetry config |
| `frontend/applications/web/server/plugins/**` | write | Nitro telemetry lifecycle |
| `frontend/applications/web/server/utils/telemetry/**` | write | Nitro allowlisted telemetry helpers |
| `infra/otel/**` | write | Collector baseline/config validation |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | INFRA-006/008 status |
| `docs/operations/READINESS_MIGRATIONS_AND_OTEL.md` | write | Operational runbook |
| `docs/agents/plans/active/20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Backend OTel files | multiplayer telemetry plan | dependency plan first | Preserve its privacy contract |
| Image pair contract | WIF/images plan | previous infra plan | Rebuild/publish only after checks |
| Collector config | telemetry destination plan | this plan defines input | Next plan selects exporter/sink |
| Health/migrations | production Compose plan | this plan defines contract | Compose consumes exact endpoints/job |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 01:01:00 UTC.
- **Обнаруженные пересечения:** direct overlap with multiplayer telemetry
  paths and later Compose/telemetry consumers.
- **Решение:** explicit dependency on
  `20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry` и
  terminal UI plan
  `20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`;
  implementation запрещён до их completion/archive и archive image plan.

## План реализации

1. [ ] Re-run context/conflict scan and freeze health/migration/OTLP contracts.
2. [ ] Add health probe abstraction/endpoints and deterministic tests.
3. [ ] Extract migration command with advisory lock/timeouts and integration
   tests; remove implicit production auto-migrate default.
4. [ ] Extend approved backend telemetry and add Nitro server-only OTLP wiring.
5. [ ] Add Collector baseline/config checks and privacy/failure-isolation tests.
6. [ ] Rebuild images, run full checks, update docs/roadmap, verify/scope/archive.

## Проверки

- [ ] `cd backend/game && go test ./...`
- [ ] Real PostgreSQL migration single/concurrent/failure/retry tests
- [ ] Liveness/readiness timeout/status/schema tests
- [ ] `pnpm --dir frontend lint && pnpm --dir frontend check && pnpm --dir frontend build`
- [ ] OTLP disabled/unavailable/slow exporter tests
- [ ] Collector config validation and private-listener assertion
- [ ] Privacy scan for forbidden IDs/payloads/credentials
- [ ] Docker image health/migration entrypoint smoke
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** readiness flaps or amplifies DB load. **Снижение:** bounded timeout,
  cheap ping, interval/backoff and no high-cardinality output.
- **Риск:** migration extraction breaks startup. **Снижение:** real PostgreSQL
  upgrade/empty/concurrent tests and Compose rollout gate.
- **Риск:** telemetry leaks data or blocks requests. **Снижение:** inherited
  allowlist, no-op default, exporter failure isolation and negative tests.
- **Откат:** disable OTLP and restore previous image digest; migration schema is
  forward-only and requires its own compatibility rollback path.

## Открытые вопросы

- Exact OTLP SDK/exporter versions and Nitro integration are frozen only after
  dependency implementation is read.
- Legacy `/healthz` compatibility consumer scan decides alias/removal.
- External sink, retention, price and alerts belong to plan
  `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`.

## Согласование

- **Статус:** not requested; prerequisite draft
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** заранее создать базовые plans по
  infrastructure roadmap. Select/implementation/commit/push не разрешены.

## Ход выполнения

- Base draft создан; dependencies, scope, gates и write set зафиксированы.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
