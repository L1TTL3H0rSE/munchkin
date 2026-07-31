# PLAN: telemetry backend, dashboards and alerts

- **Plan ID:** `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`
- **Статус:** draft
- **Создан:** 2026-07-31 00:53:07 UTC
- **Обновлён:** 2026-07-31 01:03:00 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260731T005306Z-3de45e-production-compose-traefik-and-deploy`.
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
    "infra/compose/**",
    "infra/otel/**",
    "infra/observability/**",
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

Закрыть INFRA-009: выбрать и развернуть один оплачиваемый/ограниченный
telemetry destination для уже существующего OTLP contract, создать
version-controlled dashboard и actionable alerts, доказать trace/metric path
от production request до UI без утечки credentials, player/game/card IDs или
raw gameplay payloads.

## Критерии приёмки

- [ ] До approval сравниваются минимум managed Yandex и self-hosted/external
  варианты по monthly cost, VM pressure, auth, retention, exportability and
  operator burden; выбран один вариант и budget ceiling.
- [ ] Collector exporter credentials приходят только через runtime secret
  boundary, не Terraform state/Git/image/log; static cloud keys не создаются,
  если destination поддерживает workload/runtime IAM.
- [ ] OTLP receivers остаются private; destination/UI management endpoint не
  открывается публично без отдельной identity/TLS boundary.
- [ ] Retention, queue, retry, memory limiter, disk buffering and failure
  behavior заданы явно. Недоступность destination не ломает game/web.
- [ ] Version-controlled dashboard показывает request rate/error/latency,
  readiness, PostgreSQL dependency, migration/deploy revision и bounded
  gameplay interaction signals без high-cardinality labels.
- [ ] Alerts имеют owner-confirmed channel, thresholds, `for`, severity,
  runbook links and dedup/silence behavior; test alert проходит end-to-end.
- [ ] Telemetry smoke связывает one synthetic request с trace/metrics и exact
  release SHA, затем negative scan подтверждает отсутствие forbidden data.
- [ ] Resource/cost usage после soak остаётся в approved limits; clean
  Terraform/Compose state, canonical verify и scope-check проходят.

## Контекст и подтверждённое состояние

- Dependency plans создают private Collector/OTLP contract, production
  Compose, TLS and digest rollout.
- Destination, dashboard, alert receiver, retention and price не выбраны.
- ADR-0007 требует privacy-safe bounded-cardinality telemetry и
  failure-isolation; event log остаётся authoritative gameplay history.
- Single `2 vCPU / 4 GB` VM ограничивает self-hosted stack; выбор нельзя делать
  без measured memory/disk budget.

## Scope

### Входит

- Vendor/hosting decision with price evidence.
- Destination IAM/secret/config, Collector exporter, dashboard and alerts.
- Synthetic end-to-end telemetry smoke and operator runbook.

### Не входит

- Browser RUM, user analytics, raw event export, admin console.
- Full Loki/Alloy/node/cAdvisor/PostgreSQL/Traefik bonus stack; это P1 plan.
- Backup, supply-chain scanning/signing, application feature metrics.

## Архитектурный подход

1. Measure base VM headroom and vendor prices; stop if no option fits ceiling.
2. Keep app exporters OTLP-only; only Collector knows destination.
3. Provision non-secret resources/IAM with Terraform and inject payload
   separately through Lockbox/runtime identity.
4. Store dashboards/alert rules as code; every alert links a versioned runbook.

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
| `infra/compose/**` | write | Production telemetry config |
| `infra/otel/**` | write | Collector exporter |
| `infra/observability/**` | write | Dashboard/alert definitions |
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
| Selected telemetry service | create/configure | Traces/metrics destination |
| Runtime IAM/Lockbox payload | exact additive/update separately | Exporter auth |
| Alert destination | create/configure | Owner notification |
| Production VM/Compose | controlled update | Collector exporter |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| OTLP foundation | readiness/OTel plan | dependency | Do not change app privacy schema |
| Compose/Lockbox | deploy plan | dependency | Extend through same deploy lock |
| Alerts/logs/metrics | P1 bonus plan | this plan first | P1 extends after base proof |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 01:03:00 UTC.
- **Обнаруженные пересечения:** production Compose/Terraform/roadmap are shared
  with predecessor and all later infra plans.
- **Решение:** strict dependency chain; exact provider, resources, price,
  paths and remote mutations must be refreshed before approval.

## План реализации

1. [ ] Measure VM/cost headroom and compare destination options.
2. [ ] Update this plan with selected provider, exact monthly ceiling,
   retention/auth/IAM and receive owner re-approval.
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

- Destination/provider, exact price ceiling and retention.
- Alert channel/recipients and acceptable test notification.
- Managed IAM vs runtime secret auth.
- Plan is intentionally incomplete and not eligible for approval until these
  choices and an exact remote mutation set are recorded.

## Согласование

- **Статус:** not requested; incomplete prerequisite draft
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** заранее создать базовые plans по
  infrastructure roadmap; incomplete base permitted. No static cloud keys.

## Ход выполнения

- Base draft created with explicit decision/budget gates.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
