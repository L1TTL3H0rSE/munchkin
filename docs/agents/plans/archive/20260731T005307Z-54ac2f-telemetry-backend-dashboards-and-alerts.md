# PLAN: telemetry backend, dashboards and alerts

- **Plan ID:** `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`
- **Статус:** completed
- **Создан:** 2026-07-31 00:53:07 UTC
- **Обновлён:** 2026-08-01 17:52:00 UTC
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

- [x] Provider decision зафиксирован: managed Yandex Monium для metrics и
  traces, без logs и без self-hosted Grafana/Prometheus/Loki на production VM.
  Incremental soft ceiling — `500 RUB/month`; alert на 70% и stop/review при
  прогнозе превышения 100%. Общий cloud budget notification не считается hard
  spend cap. Account-specific spend/headroom evidence is a separate remote
  gate and was not run locally.
- [x] Collector exporter credentials приходят только через runtime secret
  boundary, не Terraform state/Git/image/log. Dedicated service account имеет
  только `monium.metrics.writer` и `monium.traces.writer`; API key ограничен scopes
  `yc.monium.metrics.write` и `yc.monium.traces.write`, имеет owner-managed
  expiry/rotation не более 90 дней и хранится в Lockbox. Static cloud keys и
  log-write scope отсутствуют; no secret payload was generated or inserted.
- [x] OTLP receivers остаются private; destination/UI management endpoint не
  открывается публично без отдельной identity/TLS boundary. Local Compose
  config passed; live listener evidence was not run.
- [x] Service retention принят: traces — 4 дня; metrics живут, пока поступают
  samples, и удаляются после 30 дней без новых values; logs не ingest-ятся.
  Queue, retry, memory limiter, bounded buffering/sampling and failure behavior
  заданы явно. Недоступность destination не ломает game/web; live destination
  outage/fill/recovery was not run.
- [x] Version-controlled dashboard показывает request rate/error/latency,
  readiness, PostgreSQL dependency, migration/deploy revision и bounded
  gameplay interaction signals без high-cardinality labels. Live dashboard
  import/query evidence remains a separate remote gate.
- [x] Alerts отправляются только owner на owner-supplied email; адрес хранится
  вне Git/plan. Base rules: readiness unavailable `>2m`, sustained 5xx `>1%`,
  disk free `<15%` и p95 above measured baseline. Rules имеют `for`, severity,
  runbook links, dedup/silence behavior; definitions and the owner-only
  delivery procedure are version-controlled, while import and test email were
  not run.
  Backup freshness/failure signal and exact alert rule are owned by the later
  backup plan after its metric exists.
- [x] Telemetry smoke связывает one synthetic request с trace/metrics и exact
  release SHA, затем negative scan подтверждает отсутствие forbidden data. The
  static/privacy path passed; live Monium trace/metric evidence remains unrun.
- [x] Resource/cost usage после soak остаётся в approved limits; clean
  Terraform/Compose state, canonical verify и scope-check проходят. The
  approved 60-minute soak and account-specific cost review were not run because
  Docker/Monium/remote mutation gates remain unapproved or unavailable.

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

1. [x] Record official Monium pricing/retention/auth evidence and keep the
   approved `500 RUB/month` soft ceiling with 70% review and 100% stop gates.
   Live VM headroom and account-specific cost remain remote evidence gates.
2. [x] Freeze exact Monium resources, dashboard/alert provisioning mechanism,
   IAM/API-key/Lockbox edges and preserve the separate remote-mutation approval
   boundary.
3. [x] Implement Collector/Compose/Terraform/dashboard/alerts/smoke/runbook
   wiring and pass local validation without generating or persisting secrets.
4. [x] Keep the exact cloud plan/apply gate explicit; no Terraform plan refresh,
   apply, Monium resource, IAM, Lockbox payload or alert-channel mutation was
   run.
5. [x] Implement the host-side deployment/import procedure; production VM
   update and dashboard/alert import remain separately approved operations.
6. [x] Implement synthetic trace/metric, privacy, outage and 60-minute soak
   evidence commands. Docker, Monium UI/API, test email and soak remain unrun
   because their required remote/runtime gates are not approved.
7. [x] Update runbook/roadmap and prepare canonical verify, scope-check,
   archive/release and separate local commit.

## Проверки

- [x] Terraform fmt/validate/check passed; exact post-apply clean plan was not
  run because backend refresh/apply is a separate approval gate.
- [x] Collector config/secret/listener negative checks passed locally;
  version-pinned Collector image execution was skipped because Docker daemon is
  unavailable and no runtime secret exists.
- [x] Synthetic request trace + metric + release SHA smoke command is present;
  Monium query evidence is not available before remote secret/deploy approval.
- [x] Forbidden attribute/cardinality scan passed on dashboard/alert artifacts
  and Collector privacy deletion actions.
- [x] Destination outage/fill/retry recovery path is bounded and implemented;
  live outage/fill/recovery was not run.
- [x] Alert delivery, dedup, silence and runbook links are version-controlled;
  owner email/test delivery/import were not run.
- [x] Approved 60-minute soak command is implemented; resource/cost review and
  the live soak were not run.
- [x] `node .codex/hooks/plan-lint.mjs` — passed before archive (`plans=49
  active=6 archive=43 issues=0`).
- [x] `./leinoctl verify --changed` — passed in the explicit session with
  Node `v24.14.0`/pnpm `11.9.0`/Git Bash: 42 harness tests, 68/69 leinoctl
  tests with one platform-permission skip, plan-lint and Terraform check.
- [x] `./leinoctl scope-check --plan 20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`
  — exit 0, `ok: true`, empty `outsideWriteSet` and
  `missingRequiredChecks`; warnings only reported post-write-hook coverage and
  stale historical results.
- [x] `git diff --check` — passed.

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
- Plan is approved and locally complete; remote mutation, secret payload,
  runtime, alert-delivery, soak and account-cost evidence remain separately
  gated and are not implied by this archive.

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
- 2026-08-01 plan selected in session
  `019fbde1-fd6a-79e3-8b47-9f217363607f`; implementation completed within the
  exact write set. No Monium/Lockbox/IAM/VM mutation, secret generation,
  Terraform apply or alert email was attempted.
- Local evidence now includes private Compose telemetry wiring, provider-backed
  Terraform validation, dashboard/alert JSON/YAML, privacy scan and the
  explicit 60-minute live smoke command. Docker daemon, live Monium and host
  resource/cost evidence remain environment/approval limited.
- Canonical verify recorded all four required checks for the exact session on
  the staged write set. Final scope-check returned `ok: true`, with empty
  `outsideWriteSet` and `missingRequiredChecks`; only the known post-write-hook
  coverage and stale historical-result warnings remained.

## Итог

Локальная реализация и обязательные repository gates завершены; остаются только
отдельно согласуемые remote, secret, runtime, alert-delivery and cost/soak
evidence gates. Plan готов к archive/release и отдельному локальному commit.
