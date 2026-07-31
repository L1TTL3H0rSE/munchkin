# PLAN: infrastructure P1 bonus hardening

- **Plan ID:** `20260731T005309Z-569b95-infrastructure-p1-bonus-hardening`
- **Статус:** draft
- **Создан:** 2026-07-31 00:53:09 UTC
- **Обновлён:** 2026-07-31 01:07:00 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo`.
- **Блокирует:**
  `20260731T005309Z-784d5e-infrastructure-p2-platform-evolution`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".github/**",
    "README.md",
    "backend/game/**",
    "frontend/**",
    "compose.production.yml",
    "infra/ansible/**",
    "infra/compose/**",
    "infra/k6/**",
    "infra/observability/**",
    "infra/otel/**",
    "infra/terraform/environments/production/**",
    "scripts/production/**",
    "docs/architecture/**",
    "docs/operations/**",
    "docs/demo/**",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/agents/plans/active/20260731T005309Z-569b95-infrastructure-p1-bonus-hardening.md",
    "docs/agents/plans/archive/20260731T005309Z-569b95-infrastructure-p1-bonus-hardening.md"
  ],
  "components": [
    "repository-workflow",
    "terraform-infrastructure",
    "root-compose",
    "go:backend/game",
    "frontend-workspace"
  ],
  "contracts": [
    "observability:correlated-logs-v1",
    "observability:host-stack-v1",
    "operations:external-synthetic-v1",
    "performance:k6-production-smoke-v1",
    "security:advanced-production-v1"
  ],
  "dependsOn": [
    "20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo"
  ],
  "sharedResources": [
    "infra:yandex-cloud-production-v1",
    "cloud:yandex-compute:fv4eule47h2vqo5ki48k",
    "observability:production-telemetry-v1",
    "delivery:immutable-image-pair-v1",
    "runtime:production-security-v1"
  ]
}
```

## Цель

Заранее зафиксировать один editable, decision-gated plan для всех P1 bonuses
INFRA-B01…B10. После завершения P0 выбрать owner-approved subset по
демо-ценности, бюджету, VM headroom и риску, затем реализовать его по фазам без
создания нового пустого umbrella plan. Любое сокращение/расширение выбранного
subset и remote mutation set требует обновления этого же файла и нового
approval.

## Критерии приёмки

- [ ] До approval собраны P0 baseline, VM headroom, telemetry/storage/network
  cost и contest deadline; для B01…B10 есть value/cost/risk/effort ranking.
- [ ] **INFRA-B01:** structured JSON logs + Alloy/Loki (или выбранный
  эквивалент) дают trace→correlated logs без credentials, player/game/card IDs,
  payloads или unbounded labels.
- [ ] **INFRA-B02:** node/container/PostgreSQL/Traefik metrics показывают CPU,
  memory, disk, network, DB pool/query aggregates and ingress latency/errors;
  collectors не получают лишний raw Docker access.
- [ ] **INFRA-B03:** Alertmanager/managed alerts доставляют readiness, 5xx,
  disk pressure and backup freshness/failure с dedup/silence/runbooks.
- [ ] **INFRA-B04:** Trivy/SBOM/Dependabot/keyless Cosign or equivalent evidence
  attached to exact image digest/full SHA; static signing/cloud keys absent.
- [ ] **INFRA-B05:** Ansible or improved cloud-init воспроизводит current host
  baseline на fresh disposable host from documented inventory, без secrets in
  repository/state.
- [ ] **INFRA-B06:** k6 smoke/load profiles имеют owner-approved latency/error
  thresholds, bounded production rate/duration and manual/CI safety gate.
- [ ] **INFRA-B07:** external synthetic monitor detects VPS/DNS/TLS outage from
  outside production host and alerts through tested channel.
- [ ] **INFRA-B08:** CSP/HSTS/nosniff/referrer and related browser headers
  проверены automatically against real routes/WebSocket/assets without
  breaking application.
- [ ] **INFRA-B09:** deploy annotations link dashboard latency/error changes to
  exact rollout SHA/digests and rollback.
- [ ] **INFRA-B10:** Traefik uses file provider or narrowly scoped Docker socket
  proxy; raw unrestricted `/var/run/docker.sock` отсутствует.
- [ ] Selected subset has exact budget/write/remote mutation set, rollback and
  evidence. Unselected bonuses остаются явно `deferred`, не claimed complete.
- [ ] Full regression, soak/load/synthetic/security checks, canonical verify
  and scope-check pass within approved production safety limits.

## Контекст и подтверждённое состояние

- P1 is optional and must not delay truthful P0 production/demo closure.
- Existing roadmap recommends these ten bonuses, but final relevance depends on
  actual P0 stack and contest time.
- Single `2 vCPU / 4 GB` VM makes combined Loki/Alloy/exporters/cAdvisor
  potentially unsafe; managed/off-host alternatives need price comparison.
- Several bonuses overlap P0 security/telemetry work; this plan must consume
  actual gaps rather than duplicate completed evidence.

## Scope

### Входит

- Evaluation and owner-approved implementation of B01…B10 in this plan file.
- Config/code/infra/runbook/evidence needed for selected subset.
- Measured resource/cost/latency/security impact and rollback.

### Не входит

- Claiming all bonuses mandatory.
- P2 admin/accounts/storage/staging/HA/Kubernetes/broker work.
- Static cloud/signing keys, unbounded load tests or public management ports.
- Paid service/cloud mutation before exact approval.

## Архитектурный подход

1. Score bonuses after P0 using demo value, reliability gain, monthly cost,
   implementation risk, VM headroom and dependency overlap.
2. Update this same plan with exact selected subset and narrow paths/resources;
   obtain re-approval before code.
3. Implement in safety order: socket/headers/supply-chain, host metrics/logs,
   alerts/annotations/synthetics, bounded k6, reproducible host.
4. Each phase is independently disableable and must preserve P0 deploy/rollback.

## Затронутые компоненты и контракты

| Фаза | Компоненты | Наблюдаемый контракт |
|---|---|---|
| B01–B03/B09 | logs/metrics/alerts/dashboards | Correlated low-cardinality operations |
| B04/B08/B10 | CI/images/Traefik | Keyless evidence + browser/socket hardening |
| B05 | host automation | Fresh-host reproducibility |
| B06 | k6 | Bounded latency/error thresholds |
| B07 | external monitor | Off-host outage detection |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.github/**` | write | B04/B06 workflow evidence |
| `README.md` | write | Completed bonus evidence |
| `backend/game/**` | write | Structured logs/metrics if selected |
| `frontend/**` | write | Browser headers/RUM-safe tests if selected |
| `compose.production.yml` | write | Selected production services |
| `infra/ansible/**` | write | B05 host reproducibility |
| `infra/compose/**` | write | B01–B03/B10 services/config |
| `infra/k6/**` | write | B06 profiles |
| `infra/observability/**` | write | B01–B03/B07/B09 definitions |
| `infra/otel/**` | write | Logs/metrics pipeline |
| `infra/terraform/environments/production/**` | write | Managed telemetry/synthetics/IAM |
| `scripts/production/**` | write | Host/smoke/load/operations helpers |
| `docs/architecture/**` | write | Selected architecture changes |
| `docs/operations/**` | write | Selected runbooks |
| `docs/demo/**` | write | Contest bonus evidence |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | B01–B10 status |
| `docs/agents/plans/active/20260731T005309Z-569b95-infrastructure-p1-bonus-hardening.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T005309Z-569b95-infrastructure-p1-bonus-hardening.md` | write | Archived lifecycle |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| Production VM/Compose | conditional controlled update | Selected agents/proxy |
| Telemetry/alert/synthetic services | conditional create/update | Selected B01–B03/B07/B09 |
| GitHub settings/evidence | conditional update | B04/B06 |
| Disposable host | conditional create/destroy with approval | B05 proof |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| P0 production stack | all prior infra plans | dependencies | Baseline first, no regression |
| VM resource budget | telemetry/backup/runtime | this plan evaluates | Stop above approved headroom |
| Security/evidence | security plan | dependency | Extend only documented gaps |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 01:07:00 UTC.
- **Обнаруженные пересечения:** broad by design across completed P0 resources;
  P2 follows after this plan.
- **Решение:** this is deliberately incomplete and not eligible for approval.
  Before approval update exact subset, narrow write set, budget, dependencies
  and remote mutations in this same file; no new umbrella plan required.

## План реализации

1. [ ] Refresh P0 evidence, deadline, costs and VM headroom.
2. [ ] Score B01…B10 and choose exact subset with owner.
3. [ ] Narrow this plan/write set/resources/checks and request approval.
4. [ ] Implement selected phases one at a time behind disable/rollback switches.
5. [ ] Run load/soak/synthetic/security/fresh-host evidence as applicable.
6. [ ] Update README/demo/roadmap with completed bonuses only.
7. [ ] Verify/scope-check and archive; record unselected bonuses as deferred.

## Проверки

- [ ] P0 regression: deploy/readiness/TLS/telemetry/backup/security
- [ ] VM CPU/memory/disk/network soak under selected agents and k6
- [ ] Privacy/cardinality/log/secret negative scan
- [ ] Alert/synthetic/annotation end-to-end tests
- [ ] Browser header/WebSocket/assets regression
- [ ] Docker socket raw-access negative test
- [ ] SBOM/keyless signature/evidence verification
- [ ] Fresh disposable host baseline test if B05 selected
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T005309Z-569b95-infrastructure-p1-bonus-hardening`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** optional stack destabilizes/costs more than P0. **Снижение:** ranked
  subset, hard budgets, phase toggles and measured soak.
- **Риск:** observability expands sensitive/high-cardinality data. **Снижение:**
  inherited allowlists, redaction and negative queries.
- **Риск:** load test harms production. **Снижение:** explicit rate/duration/
  environment gates and owner-approved window.
- **Откат:** disable/remove selected phase and restore P0 digest/config; remote
  deletion or disposable-host destroy uses separate exact approval.

## Открытые вопросы

- Exact selected subset, priority and contest deadline.
- Additional monthly budget and minimum VM headroom.
- Managed vs self-hosted logs/metrics/synthetic options.
- Alert channel and disposable-host budget.
- Until resolved, plan remains an incomplete non-approvable base.

## Согласование

- **Статус:** not requested; incomplete optional draft
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** заранее определить всё из infra
  roadmap; incomplete base plan acceptable. No static cloud keys and no
  implementation/select/commit/push.

## Ход выполнения

- All roadmap B01…B10 captured in one editable decision-gated plan.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
