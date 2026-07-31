# PLAN: infrastructure P2 platform evolution

- **Plan ID:** `20260731T005309Z-784d5e-infrastructure-p2-platform-evolution`
- **Статус:** draft
- **Создан:** 2026-07-31 00:53:09 UTC
- **Обновлён:** 2026-07-31 01:08:00 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260731T005309Z-569b95-infrastructure-p1-bonus-hardening`.
- **Блокирует:** нет
- **Связанные ADR/handoff:** ADR-0007, ADR-0008, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".github/**",
    "backend/**",
    "frontend/**",
    "content/**",
    "compose*.yml",
    "infra/**",
    "scripts/**",
    "docs/agents/decisions/**",
    "docs/architecture/**",
    "docs/operations/**",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/agents/plans/active/20260731T005309Z-784d5e-infrastructure-p2-platform-evolution.md",
    "docs/agents/plans/archive/20260731T005309Z-784d5e-infrastructure-p2-platform-evolution.md"
  ],
  "components": [
    "repository-workflow",
    "terraform-infrastructure",
    "root-compose",
    "go:backend/game",
    "frontend-workspace",
    "content"
  ],
  "contracts": [
    "platform:p2-trigger-gates-v1",
    "identity:registered-accounts-v1",
    "operations:multi-environment-v1",
    "operations:horizontal-runtime-v1"
  ],
  "dependsOn": [
    "20260731T005309Z-569b95-infrastructure-p1-bonus-hardening"
  ],
  "sharedResources": [
    "infra:yandex-cloud-production-v1",
    "platform:identity-v1",
    "platform:admin-audit-v1",
    "platform:card-assets-v1",
    "platform:staging-v1",
    "platform:horizontal-runtime-v1"
  ]
}
```

## Цель

Заранее сохранить в одном editable plan все P2 направления roadmap и
измеримые triggers, при которых single-VM P0/P1 architecture перестаёт быть
достаточной. Этот файл не разрешает немедленную реализацию всего P2: после
появления первого trigger он обновляется с одним exact selected slice,
архитектурным ADR, narrow write/remote mutation set, migration/rollback/cost
plan и новым approval — без создания нового пустого umbrella plan.

## Критерии приёмки

- [ ] **Admin console:** отдельная operator identity/RBAC, redacted read models,
  immutable audit trail and no reuse of guest credential; trigger — реальная
  operational workflow, которую нельзя безопасно выполнить runbook/CLI.
- [ ] **Card assets:** candidates/published art переходят в S3-compatible
  storage/CDN с immutable content/version/digest boundary, moderation and
  retention; trigger — measured repository/VM storage or delivery need.
- [ ] **Registered accounts/OIDC:** account identity не смешивается с
  game-scoped actor credential; migration/privacy/recovery/abuse contracts
  approved before replacing guest-only participation.
- [ ] **Nitro/Card Studio traces/RUM:** provider traces and browser RUM use
  explicit privacy/consent/cardinality/sampling review and never export
  authoring tokens, prompts, candidate art or gameplay secrets.
- [ ] **Battle analytics:** richer summaries use privacy-safe read models and
  cannot become replay authority; trigger — approved product question and
  bounded aggregate schema.
- [ ] **Staging/preview:** separate identity/state/network/secrets/domain/
  registry/deploy boundary and TTL/cost controls; trigger — production change
  risk exceeds additional environment cost.
- [ ] **Multi-VPS/Managed PostgreSQL/HA:** selected only from measured SLA,
  traffic, DB capacity and recovery evidence; migration includes downtime,
  backup/restore, connection/network and cost plan.
- [ ] **Kubernetes/Helm/ArgoCD/service mesh:** selected only with actual
  multi-service/multi-node scheduling/rollout need that simpler Compose cannot
  meet; no resume-driven platform rewrite.
- [ ] **External realtime adapter/broker:** introduced only at horizontal
  scaling boundary, preserving backend authority, actor privacy, version
  invalidation and idempotency/replay contracts.
- [ ] Selected slice has approved ADR, threat/data-flow model, cost ceiling,
  dependency/provider pinning, migration/rollback, evidence and decommission
  path. Unselected slices remain `deferred`.
- [ ] Full contract/regression/migration/load/security/disaster checks,
  canonical verify and scope-check pass for selected slice.

## Контекст и подтверждённое состояние

- Current target architecture is intentionally a single Yandex Compute VM,
  private registry, local PostgreSQL data disk, Compose/Traefik and keyless
  identities. P2 complexity has no current evidence-based trigger.
- Backend authority, deterministic engine/replay, actor-specific projections,
  immutable content set and idempotency remain non-negotiable across every P2
  topology.
- Card Studio/content rights and server-only credentials impose additional
  storage/CDN/telemetry privacy boundaries.
- P0/P1 evidence must be completed first so capacity/SLA/problem triggers are
  measured rather than assumed.

## Scope

### Входит

- Trigger/evidence matrix and future owner-selected implementation slice for
  every P2 roadmap direction in this same plan.
- Required ADR/data/threat/cost/migration/decommission design before code.
- Exact code/infrastructure/runbook changes only after this draft is narrowed
  and re-approved.

### Не входит

- Implementing all P2 directions together.
- Kubernetes/HA/accounts/admin/analytics without measured trigger.
- Static cloud keys, shared credentials/states or hidden cross-environment
  trust.
- Material scope selected by agent without owner approval.

## Архитектурный подход

1. Maintain a trigger matrix: current measured value, threshold, evidence,
   simplest viable response and why P0/P1 cannot satisfy it.
2. When a threshold is crossed, choose exactly one coherent slice and create/
   approve an ADR inside this same plan lifecycle.
3. Prefer reversible additive migration with dual-read/write or shadow traffic
   only where data contracts justify it; preserve digest/identity/state
   isolation.
4. Decommission superseded resources only after verified cutover/rollback
   window and separate destructive approval.

## Затронутые компоненты и контракты

| P2 slice | Компоненты | Critical contract |
|---|---|---|
| Admin/accounts | backend/frontend/identity/data | RBAC, actor derivation, audit |
| Card assets | content/storage/CDN | Immutable set/version/digest/rights |
| Traces/RUM/analytics | app/telemetry/read models | Privacy/cardinality/no authority |
| Staging/preview | Terraform/GitHub/DNS/secrets | Environment isolation/TTL |
| HA/Kubernetes/broker | compute/DB/deploy/realtime | SLA, consistency, replay/idempotency |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.github/**` | write | Selected platform workflow |
| `backend/**` | write | Selected identity/admin/analytics/realtime contract |
| `frontend/**` | write | Selected account/admin/assets/RUM UI contract |
| `content/**` | write | Selected asset/content storage contract |
| `compose*.yml` | write | Selected runtime topology |
| `infra/**` | write | Selected cloud/platform topology |
| `scripts/**` | write | Selected migration/operation tooling |
| `docs/agents/decisions/**` | write | Mandatory selected-slice ADR |
| `docs/architecture/**` | write | Selected architecture/data-flow |
| `docs/operations/**` | write | Migration/rollback/runbooks |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | P2 trigger/status |
| `docs/agents/plans/active/20260731T005309Z-784d5e-infrastructure-p2-platform-evolution.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T005309Z-784d5e-infrastructure-p2-platform-evolution.md` | write | Archived lifecycle |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| None in base draft | none | No P2 trigger/selection approved |
| Future selected cloud/GitHub/DNS/identity/data resources | conditional | Must be enumerated before approval |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Production P0/P1 | all infra plans | dependencies | Evidence baseline, preserve rollback |
| Game/content/privacy contracts | gameplay/content plans | authoritative modules | ADR cannot weaken invariants |
| Future environments/HA | none yet | this decision plan | Exact isolation before mutation |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 01:08:00 UTC.
- **Обнаруженные пересечения:** potentially repository-wide and intentionally
  downstream of P0/P1 plus current multiplayer/UI dependency chain.
- **Решение:** base plan is not eligible for selection/approval. Before work,
  edit this same file to one narrow selected slice, add exact dependencies and
  paths/resources, create/read its ADR and obtain fresh owner approval.

## План реализации

1. [ ] Complete P0/P1 and collect SLA/load/storage/operator/product evidence.
2. [ ] Refresh P2 trigger matrix; if no trigger is crossed, record `deferred`
   and stop without code/cloud mutation.
3. [ ] With owner choose one slice; write ADR/threat/data/cost/migration design.
4. [ ] Narrow this plan manifest/write/remote mutation set and request approval.
5. [ ] Implement reversible slice with contract/security/migration tests.
6. [ ] Apply/cut over only through separate exact mutation approvals.
7. [ ] Run rollback/disaster/load/privacy evidence and decommission review.
8. [ ] Update roadmap/runbooks, verify/scope-check and archive.

## Проверки

- [ ] Trigger evidence and simpler-alternative comparison
- [ ] Selected ADR acceptance and architecture invariant review
- [ ] Identity/privacy/data migration/rollback tests as applicable
- [ ] Environment/state/secret/IAM isolation assertions
- [ ] Capacity/load/failure/disaster evidence
- [ ] Cost/TTL/decommission checks
- [ ] Full backend/frontend/content/infrastructure regressions for selected slice
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T005309Z-784d5e-infrastructure-p2-platform-evolution`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** speculative platform complexity. **Снижение:** measurable triggers,
  simplest-alternative comparison and one-slice approval.
- **Риск:** identity/data migration violates authority/privacy/replay.
  **Снижение:** mandatory ADR, dual compatibility where justified and contract
  tests.
- **Риск:** environment/HA costs grow silently. **Снижение:** exact ceiling,
  TTL/scale limits and decommission plan.
- **Откат:** slice-specific rollback must be written before approval; base
  draft itself makes no change.

## Открытые вопросы

- No P2 trigger or selected slice currently exists.
- SLA, traffic, storage growth, operator pain, product identity/admin need and
  contest/post-contest priority must be measured.
- Plan is intentionally incomplete and cannot be approved in current broad
  form.

## Согласование

- **Статус:** not requested; incomplete future draft
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** заранее определить всё из infra
  roadmap; incomplete base acceptable. No static cloud keys and no
  implementation/select/commit/push.

## Ход выполнения

- All P2 roadmap directions and their decision triggers captured.
- No slice selected; implementation/cloud mutation not started.

## Итог

Заполняется после реализации.
