# PLAN: backend readiness and OpenTelemetry foundation

- **Plan ID:** `20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry`
- **Статус:** approved
- **Создан:** 2026-07-31 00:53:06 UTC
- **Обновлён:** 2026-08-01 15:15:14 UTC
- **Владелец:** Codex / `019fbde1-fd6a-79e3-8b47-9f217363607f`
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; отдельная ветка не создаётся по указанию владельца
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
    "backend/game/cmd/migrate/main.go",
    "backend/game/cmd/migrate/main_test.go",
    "backend/game/cmd/server/main.go",
    "backend/game/internal/repository/postgres/store.go",
    "backend/game/internal/repository/postgres/store_integration_test.go",
    "backend/game/internal/repository/postgres/migrations.go",
    "backend/game/internal/repository/postgres/migrations_test.go",
    "backend/game/internal/telemetry/telemetry.go",
    "backend/game/internal/telemetry/telemetry_test.go",
    "backend/game/internal/telemetry/provider.go",
    "backend/game/internal/telemetry/provider_test.go",
    "backend/game/internal/telemetry/http.go",
    "backend/game/internal/telemetry/application_test.go",
    "backend/game/internal/transport/httpapi/router.go",
    "backend/game/internal/transport/httpapi/router_test.go",
    "frontend/package.json",
    "frontend/pnpm-lock.yaml",
    "frontend/applications/web/nuxt.config.ts",
    "frontend/applications/web/server/plugins/otel.ts",
    "frontend/applications/web/server/utils/telemetry/runtime.ts",
    "frontend/applications/web/server/utils/telemetry/runtime.test.ts",
    "frontend/applications/web/server/utils/telemetry/attributes.ts",
    "frontend/applications/web/server/utils/telemetry/attributes.test.ts",
    "infra/otel/collector.production.yaml",
    "infra/otel/collector.test.yaml",
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
  обслужить запрос и имеет bounded timeout. Legacy `GET /healthz` сохраняется
  на всём production v1 как тестируемый compatibility alias к `/health/live`
  с текущим `200 {"status":"ok"}`; удаление возможно только отдельным
  breaking-plan после нового consumer scan.
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
- [ ] Go OTel modules сохраняются на уже установленной согласованной линии
  `v1.43.0`; dependency churn вне этой линии не входит в plan.
- [ ] Nitro использует exact server-only pins:
  `@opentelemetry/api@1.9.1`,
  `@opentelemetry/sdk-trace-node@2.10.0`,
  `@opentelemetry/sdk-metrics@2.10.0`,
  `@opentelemetry/resources@2.10.0`,
  `@opentelemetry/semantic-conventions@1.43.0`,
  `@opentelemetry/exporter-trace-otlp-proto@0.221.0` и
  `@opentelemetry/exporter-metrics-otlp-proto@0.221.0`. Browser RUM,
  auto-instrumentation bundle and browser credentials не добавляются.
- [ ] Go и Nitro поддерживают disabled-by-default OTLP config, resource
  attributes `service.name`, version/revision/environment и trace propagation
  только через allowlisted headers. Exporter failure fail-open для app и
  fail-closed только для отдельного telemetry smoke.
- [ ] Collector Contrib фиксируется на `0.153.0`, а production image — также
  immutable digest, разрешённый при implementation. Config vendor-neutral,
  без embedded credentials, с bounded queues/retries/batches и health
  endpoint; sink/retention/dashboard остаются следующему plan.
- [ ] Docker image contract включает migration entrypoint и health probes без
  shelling secrets; image-pair workflow продолжает собирать оба images.
- [ ] Go/PostgreSQL/frontend tests, migration concurrency smoke, collector
  config validation, privacy negative scan, canonical verify и scope-check
  проходят.

## Контекст и подтверждённое состояние

- Current game router имеет один unconditional `GET /healthz`. Consumer scan
  нашёл tracked consumers в root `docker-compose.yml`, `README.md` и
  `frontend/playwright.config.ts`, поэтому удаление несовместимо с текущим
  repository contract.
- `cmd/server/main.go` вызывает PostgreSQL migration на startup при
  `AUTO_MIGRATE`; migrations читаются из image path.
- Dependency plan
  `20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry` завершён;
  backend уже имеет OTel adapter/allowlist и direct OTel modules `v1.43.0`.
  Этот plan расширяет только operational/runtime contract и не переписывает
  готовую gameplay telemetry foundation.
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

1. Health handlers используют injected readiness probe; `/health/live`
   проверяет только event loop/process, `/health/ready` — bounded PostgreSQL
   ping и startup completion, а `/healthz` делегирует live handler без
   отдельной семантики.
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
| `backend/game/cmd/migrate/main.go` | write | Explicit migration entrypoint |
| `backend/game/cmd/migrate/main_test.go` | write | Entrypoint failure/timeout contract |
| `backend/game/cmd/server/main.go` | write | Startup/migration/telemetry lifecycle |
| `backend/game/internal/repository/postgres/store.go` | write | Bounded readiness probe integration |
| `backend/game/internal/repository/postgres/store_integration_test.go` | write | Real PostgreSQL readiness/migration checks |
| `backend/game/internal/repository/postgres/migrations.go` | write | Advisory-lock migration runner |
| `backend/game/internal/repository/postgres/migrations_test.go` | write | Migration concurrency/failure tests |
| `backend/game/internal/telemetry/telemetry.go` | write | Operational allowlist extension |
| `backend/game/internal/telemetry/telemetry_test.go` | write | Attribute/privacy tests |
| `backend/game/internal/telemetry/provider.go` | write | OTel provider lifecycle |
| `backend/game/internal/telemetry/provider_test.go` | write | Provider failure-isolation tests |
| `backend/game/internal/telemetry/http.go` | write | HTTP operational telemetry |
| `backend/game/internal/telemetry/application_test.go` | write | Application telemetry contract tests |
| `backend/game/internal/transport/httpapi/router.go` | write | Health endpoints |
| `backend/game/internal/transport/httpapi/router_test.go` | write | Health endpoint tests |
| `frontend/package.json` | write | Pinned OTel server dependencies if justified |
| `frontend/pnpm-lock.yaml` | generated | Dependency lock update |
| `frontend/applications/web/nuxt.config.ts` | write | Nitro telemetry config |
| `frontend/applications/web/server/plugins/otel.ts` | write | Nitro telemetry lifecycle |
| `frontend/applications/web/server/utils/telemetry/runtime.ts` | write | Nitro server-only OTLP wiring |
| `frontend/applications/web/server/utils/telemetry/runtime.test.ts` | write | Disabled/failure-isolation tests |
| `frontend/applications/web/server/utils/telemetry/attributes.ts` | write | Bounded attribute allowlist |
| `frontend/applications/web/server/utils/telemetry/attributes.test.ts` | write | Privacy/cardinality tests |
| `infra/otel/collector.production.yaml` | write | Collector baseline for production successor |
| `infra/otel/collector.test.yaml` | write | Collector config validation fixture |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | INFRA-006/008 status |
| `docs/operations/READINESS_MIGRATIONS_AND_OTEL.md` | write | Operational runbook |
| `docs/agents/plans/active/20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry.md` | write | Archived lifecycle |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| GitHub, registry, production VM/cloud/DNS/data | none | This plan changes and tests local code/config only; publish/deploy belongs to successors |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Backend OTel files | multiplayer telemetry plan | dependency plan first | Preserve its privacy contract |
| Image pair contract | WIF/images plan | previous infra plan | Rebuild/publish only after checks |
| Collector config | telemetry destination plan | this plan defines input | Next plan selects exporter/sink |
| Health/migrations | production Compose plan | this plan defines contract | Compose consumes exact endpoints/job |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 14:44:19 UTC.
- **Обнаруженные пересечения:** direct overlap with multiplayer telemetry
  paths and later Compose/telemetry consumers.
- **Решение:** explicit dependency on
  `20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry` и
  terminal UI plan
  `20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`;
  implementation запрещён до их completion/archive и archive image plan.

## План реализации

1. [ ] Re-run context/conflict scan and verify the recorded `/healthz` alias,
   migration contract and exact OTel pins without reopening provider choices.
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

- Owner-independent choices settled for this draft: `/healthz` remains a
  production-v1 alias, Go OTel remains `v1.43.0`, Nitro packages use the exact
  pins above, and Collector Contrib uses `0.153.0` plus implementation-time
  image digest verification.
- Remaining evidence gates are implementation-only: migration concurrency on
  real PostgreSQL, Nitro build/runtime compatibility, Collector config
  validation and privacy/failure-isolation tests.
- External sink, retention, price and alerts belong to plan
  `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 15:15:14 UTC
- **Подтверждено:** 2026-08-01 15:15:14 UTC
- **Формулировка/ограничения пользователя:** пользователь формально одобрил
  последовательную очередь exact plans начиная с этого plan и разрешил
  approvals, select, implementation, verify, scope-check, archive/release,
  подготовительный local commit plan-файлов и отдельный local commit после
  каждого завершённого plan. Подтверждены audit defaults и сокращённый
  Monium soak на 60 минут; ветка не создаётся. Разрешён обычный push в
  `origin/main` только после успешных проверок. PostgreSQL password и
  dedicated deploy SSH key разрешено безопасно сгенерировать и передать
  непосредственно в утверждённые secret stores без вывода или сохранения в
  Git, plan, chat или logs. Remote mutations, Terraform apply, DNS/NS,
  secret payload insertion, GitHub/Yandex settings, production VM
  bootstrap/deploy и платные/destructive actions не одобрены заранее:
  перед каждым таким этапом нужен sanitized exact mutation plan и отдельное
  approval.

## Ход выполнения

- Base draft создан; dependencies, scope, gates и write set зафиксированы.
- 2026-08-01 audit recorded the compatibility policy and exact OTel versions.
- 2026-08-01 formal queue approval recorded with the remote-mutation gates
  above; implementation remains gated by dependency/archive checks.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
