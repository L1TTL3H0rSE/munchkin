# PLAN: telemetry backend, dashboards and alerts

- **Plan ID:** `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`
- **Статус:** approved
- **Создан:** 2026-07-31 00:53:07 UTC
- **Обновлён:** 2026-08-01 15:15:14 UTC
- **Владелец:** Codex / `019fbde1-fd6a-79e3-8b47-9f217363607f`
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; отдельная ветка не создаётся по указанию владельца
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry`, `20260731T005306Z-3de45e-production-compose-traefik-and-deploy`.
- **Блокирует:**
  `20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "compose.production.yml",
    "infra/otel/collector.production.yaml",
    "infra/observability/monium/production-dashboard.json",
    "infra/observability/monium/production-alerts.yaml",
    "infra/terraform/environments/production/telemetry.tf",
    "infra/terraform/environments/production/iam.tf",
    "infra/terraform/environments/production/outputs.tf",
    "infra/terraform/environments/production/variables.tf",
    "infra/terraform/README.md",
    "scripts/production/telemetry-smoke.sh",
    "scripts/terraform-check.sh",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/operations/OBSERVABILITY.md",
    "docs/agents/plans/active/20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts.md",
    "docs/agents/plans/archive/20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts.md"
  ],
  "components": [
    "repository-workflow",
    "terraform-infrastructure",
    "root-compose"
  ],
  "contracts": [
    "observability:telemetry-destination-v1",
    "observability:production-dashboard-v1",
    "observability:production-alerts-v1"
  ],
  "dependsOn": [
    "20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry",
    "20260731T005306Z-3de45e-production-compose-traefik-and-deploy"
  ],
  "sharedResources": [
    "observability:otel-foundation-v1",
    "observability:production-telemetry-v1",
    "cloud:yandex-compute:fv4eule47h2vqo5ki48k",
    "infra:yandex-cloud-production-v1"
  ]
}
```

## Цель

Закрыть INFRA-009: подключить уже существующий OTLP contract к выбранному
managed Yandex Monium, создать version-controlled dashboard и actionable
email alerts, доказать trace/metric path от production request до UI без
утечки credentials, player/game/card IDs или raw gameplay payloads и удержать
incremental telemetry spend в soft ceiling `500 RUB/month`.

## Критерии приёмки

- [ ] Provider decision зафиксирован: managed Yandex Monium для metrics и
  traces, без logs и без self-hosted Grafana/Prometheus/Loki на production VM.
  Incremental soft ceiling — `500 RUB/month`; alert на 70% и stop/review при
  прогнозе превышения 100%. Общий cloud budget notification не считается hard
  spend cap.
- [ ] Collector exporter credentials приходят только через runtime secret
  boundary, не Terraform state/Git/image/log. Dedicated service account имеет
  только `monium.metrics.writer` и `monium.traces.writer`; API key ограничен scopes
  `yc.monium.metrics.write` и `yc.monium.traces.write`, имеет owner-managed
  expiry/rotation не более 90 дней и хранится в Lockbox. Static cloud keys и
  log-write scope отсутствуют.
- [ ] OTLP receivers остаются private; destination/UI management endpoint не
  открывается публично без отдельной identity/TLS boundary.
- [ ] Service retention принят: traces — 4 дня; metrics живут, пока поступают
  samples, и удаляются после 30 дней без новых values; logs не ingest-ятся.
  Queue, retry, memory limiter, bounded buffering/sampling and failure behavior
  заданы явно. Недоступность destination не ломает game/web.
- [ ] Version-controlled dashboard показывает request rate/error/latency,
  readiness, PostgreSQL dependency, migration/deploy revision и bounded
  gameplay interaction signals без high-cardinality labels.
- [ ] Alerts отправляются только owner на owner-supplied email; адрес хранится
  вне Git/plan. Base rules: readiness unavailable `>2m`, sustained 5xx `>1%`,
  disk free `<15%` и p95 above measured baseline. Rules имеют `for`, severity,
  runbook links, dedup/silence behavior; test email проходит end-to-end.
  Backup freshness/failure signal and exact alert rule are owned by the later
  backup plan after its metric exists.
- [ ] Telemetry smoke связывает one synthetic request с trace/metrics и exact
  release SHA, затем negative scan подтверждает отсутствие forbidden data.
- [ ] Resource/cost usage после soak остаётся в approved limits; clean
  Terraform/Compose state, canonical verify и scope-check проходят.

## Контекст и подтверждённое состояние

- Dependency plans создают private Collector/OTLP contract, production
  Compose, TLS and digest rollout.
- Destination выбран: managed Yandex Monium, metrics+traces only, soft ceiling
  `500 RUB/month`, service retention выше, email receiver — owner only.
- ADR-0007 требует privacy-safe bounded-cardinality telemetry и
  failure-isolation; event log остаётся authoritative gameplay history.
- Single `2 vCPU / 4 GB` VM исключает self-hosted stack из этого P0 plan;
  Collector overhead всё равно проверяется measured soak.

## Scope

### Входит

- Vendor/hosting decision with price evidence.
- Destination IAM/secret/config, Collector exporter, dashboard and alerts.
- Synthetic end-to-end telemetry smoke and operator runbook.

### Не входит

- Browser RUM, user analytics, raw event export, admin console.
- Full Loki/Alloy/node/cAdvisor/PostgreSQL/Traefik bonus stack; it is deferred
  with no implementation owner in the contest P1 decision plan.
- Backup, supply-chain scanning/signing, application feature metrics.

## Архитектурный подход

1. Measure base VM headroom and actual Monium ingest/alert price; stop if the
   selected configuration cannot fit `500 RUB/month`.
2. Keep app exporters OTLP-only; only Collector knows destination.
3. Provision non-secret Monium/IAM metadata with Terraform where provider
   coverage is proven; inject scoped API-key payload separately through
   Lockbox/runtime secret boundary.
4. Store dashboards as code. If current Terraform provider does not cover
   alerts/channels, keep version-controlled definitions and apply/import them
   through a documented API/UI procedure rather than claiming unsupported
   Terraform management. Every alert links a versioned runbook.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Collector/Compose | Production exporter | Private OTLP, bounded queue |
| Terraform | Destination/IAM metadata | No payload in state |
| dashboards | Operational panels | Low-cardinality metrics/traces |
| alerts | Failure notification | Threshold + runbook |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `compose.production.yml` | write | Destination service wiring |
| `infra/otel/collector.production.yaml` | write | Collector/exporter config |
| `infra/observability/monium/production-dashboard.json` | write | Base dashboard as code |
| `infra/observability/monium/production-alerts.yaml` | write | Base non-backup alerts as code |
| `infra/terraform/environments/production/telemetry.tf` | write | Managed telemetry resources |
| `infra/terraform/environments/production/iam.tf` | write | Runtime exporter access |
| `infra/terraform/environments/production/outputs.tf` | write | Non-secret telemetry outputs |
| `infra/terraform/environments/production/variables.tf` | write | Telemetry inputs |
| `infra/terraform/README.md` | write | Resource/auth documentation |
| `scripts/production/telemetry-smoke.sh` | write | E2E evidence |
| `scripts/terraform-check.sh` | write | Telemetry/IAM assertions |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | INFRA-009 status |
| `docs/operations/OBSERVABILITY.md` | write | Operator runbook |
| `docs/agents/plans/active/20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts.md` | write | Archived lifecycle |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| Yandex Monium project/resources | create/configure | Metrics/traces destination |
| Dedicated Monium writer SA/API key/Lockbox payload | exact additive/update separately | Scoped exporter auth |
| Owner-only email alert destination | create/configure | Owner notification; address outside Git |
| Production VM/Compose | controlled update | Collector exporter |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| OTLP foundation | readiness/OTel plan | dependency | Do not change app privacy schema |
| Compose/Lockbox | deploy plan | dependency | Extend through same deploy lock |
| Base alerts/dashboard | backup plan | this plan first | Backup adds only its exact signal/rule after archive |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 14:44:19 UTC.
- **Обнаруженные пересечения:** production Compose/Terraform/roadmap are shared
  with predecessor and all later infra plans.
- **Решение:** strict dependency chain. Provider, no-logs boundary, retention,
  soft ceiling, writer auth and owner-only email channel are settled for this
  draft; implementation must still prove provider coverage, exact resource
  plan, test delivery and measured cost before remote mutation approval.

## План реализации

1. [ ] Measure VM/cost headroom and validate current Monium pricing/quotas for
   the recorded metrics+traces/no-logs design.
2. [ ] Freeze exact Monium resources, dashboard/alert provisioning mechanism,
   IAM/API-key/Lockbox edges and request formal owner approval.
3. [ ] Implement Terraform/config/secret wiring and local validation.
4. [ ] Show exact cloud plan; apply only after separate owner approval.
5. [ ] Deploy Collector exporter and import dashboards/alerts.
6. [ ] Run synthetic trace/metric/alert, privacy and outage/soak tests.
7. [ ] Update runbook/roadmap, verify/scope-check and archive.

## Проверки

- [ ] Terraform fmt/validate/check and exact post-apply clean plan
- [ ] Collector config/secret/listener negative tests
- [ ] Synthetic request trace + metric + release SHA query
- [ ] Forbidden attribute/cardinality scan
- [ ] Destination outage/fill/retry recovery
- [ ] Test alert delivery, dedup and runbook link
- [ ] 24h or owner-approved shorter soak resource/cost review
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** stack exhausts small VM/budget. **Снижение:** managed-first
  comparison, hard limits, measured soak and stop threshold.
- **Риск:** secrets/private gameplay data exported. **Снижение:** Collector
  boundary, allowlists, Lockbox and negative query/log scan.
- **Риск:** noisy alerts. **Снижение:** threshold/`for`/dedup/silence tests.
- **Откат:** disable exporter to no-op, remove dashboard/alerts; app remains
  healthy. Destructive remote deletion requires separate approval.

## Открытые вопросы

- Owner selected email alerts to owner only. The audit recommends Yandex
  Monium, metrics+traces only, no logs, `500 RUB/month` soft ceiling, service
  retention and a dedicated scoped writer API key in Lockbox.
- Personal email is intentionally not persisted in this public plan; owner
  enters it directly in the notification/runtime boundary and permits one
  controlled test message during plan execution.
- Remaining evidence gates: current Terraform/API coverage, exact Monium
  project/header/resource IDs, full cost estimate, 24h or owner-approved
  shorter soak, test email and remote mutation plan.
- Plan stays draft/unapproved until predecessor archive and exact mutation set
  are reviewed.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 15:15:14 UTC
- **Подтверждено:** 2026-08-01 15:15:14 UTC
- **Формулировка/ограничения пользователя:** пользователь формально одобрил
  последовательную очередь exact plans начиная с этого plan и разрешил
  approvals, select, implementation, verify, scope-check, archive/release,
  подготовительный local commit plan-файлов и отдельный local commit после
  каждого завершённого plan. Подтверждены audit defaults, включая managed
  Monium metrics+traces only, owner-only alerts, soft ceiling `500 RUB/month`
  и сокращённый Monium soak длительностью 60 минут; ветка не создаётся.
  Разрешён обычный push в `origin/main` только после успешных проверок.
  PostgreSQL password и dedicated deploy SSH key разрешено безопасно
  сгенерировать и передать непосредственно в утверждённые secret stores без
  вывода или сохранения в Git, plan, chat или logs. Remote mutations,
  Terraform apply, secret payload insertion, GitHub/Yandex settings,
  production VM bootstrap/deploy и любые платные/destructive actions не
  одобрены заранее: перед каждым таким этапом нужен sanitized exact mutation
  plan и отдельное approval. Owner email для alerts остаётся вне Git/plan.

## Ход выполнения

- Base draft created with explicit decision/budget gates.
- 2026-08-01 owner decisions recorded; personal email not persisted.
- 2026-08-01 formal queue approval recorded with the 60-minute soak and
  remote-mutation gates above; implementation remains dependency-gated.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
