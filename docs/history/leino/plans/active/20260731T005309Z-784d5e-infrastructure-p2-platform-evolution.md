# PLAN: infrastructure P2 platform evolution

- **Plan ID:** `20260731T005309Z-784d5e-infrastructure-p2-platform-evolution`
- **Статус:** draft
- **Создан:** 2026-07-31 00:53:09 UTC
- **Обновлён:** 2026-08-01 14:40:07 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260731T005309Z-569b95-infrastructure-p1-bonus-hardening`.
- **Блокирует:** нет
- **Связанные ADR/handoff:** ADR-0007, ADR-0008 и ADR-0009 как
  read-only foundations; новый ADR создаётся только после выбора exact slice;
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/agents/plans/active/20260731T005309Z-784d5e-infrastructure-p2-platform-evolution.md",
    "docs/agents/plans/archive/20260731T005309Z-784d5e-infrastructure-p2-platform-evolution.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [
    "platform:p2-trigger-gates-v1"
  ],
  "dependsOn": [
    "20260731T005309Z-569b95-infrastructure-p1-bonus-hardening"
  ],
  "sharedResources": [
    "infra:yandex-cloud-production-v1",
    "observability:production-telemetry-v1",
    "delivery:production-release-evidence-v1"
  ]
}
```

## Цель

Провести только evidence-based P2 decision review после стабильного P0 и
архивированного P1 all-deferred decision:
собрать полные production metrics и operational evidence, сравнить их с
заранее зафиксированными triggers и либо оставить все P2 slices `deferred`,
либо предложить владельцу ровно один exact slice. Этот draft не разрешает
код, инфраструктуру, ADR или remote mutation. Выбранный slice сначала
получает narrow manifest/write set, ADR, migration/rollback/cost plan и новое
явное approval.

## Критерии приёмки

- [ ] Сняты семь полных последовательных суток production evidence после
  фактического завершения/stabilization P0 и P1 decision closure. Если это
  произошло не позднее `2026-08-02 18:00 Europe/Moscow`, earliest review —
  `2026-08-09 18:00 Europe/Moscow`; при более позднем завершении окно
  автоматически сдвигается. Неисполненный all-deferred P1 не требуется
  реализовывать; любой будущий runtime-changing P1 slice создаёт новое окно.
- [ ] Evidence содержит CPU, RAM, swap, disk, inode и network headroom;
  request rate, p50/p95/p99 и 5xx; SSE connections/reconnects; PostgreSQL
  size/growth, pool utilization, query p95 and slow queries; backup size/age,
  measured restore duration; actual cloud bill; incidents, rollbacks,
  deployment/operator pain; repository/published-asset growth; подтверждённую
  необходимость accounts/admin/staging.
- [ ] Incident thresholds из P0 остаются incident/repair signals, а не
  автоматическим оправданием platform rewrite: readiness failure `>2m`, 5xx
  `>1%`, free disk `<15%` или backup age `>26h` сначала требуют восстановления
  и root-cause analysis в текущей архитектуре.
- [ ] Каждый P2 candidate сравнен с текущим значением, trigger, источником
  evidence, простейшим P0/P1 response и причиной, почему его недостаточно.
- [ ] Если ни один trigger не подтверждён, roadmap фиксирует все slices как
  `deferred`, plan завершается без ADR, кода, cloud/GitHub/DNS/data mutations
  и без дополнительных расходов.
- [ ] Если trigger подтверждён, владелец выбирает ровно один exact slice;
  текущий plan останавливается до добавления narrow paths/resources,
  accepted ADR, threat/data-flow model, dependency pins, migration, rollback,
  cost ceiling, decommission path и нового approval.

### Candidate triggers — не подтверждённые текущие факты

| Slice | Trigger для review | Сначала проверить более простое решение |
|---|---|---|
| VM capacity / multi-VM | CPU или RAM `>80%` не менее 15 минут в трёх normal-load windows, либо прогноз исчерпания disk/inodes `<30 days` после P0/P1 tuning | Query/cache/limits cleanup, resize одной VM/disk |
| Managed PostgreSQL / HA | DB pool `>80%` в трёх normal-load windows, query p95 `>2x` seven-day baseline после index/query tuning, либо измеренные RTO/SLA не достигаются локальной PostgreSQL | Index/query/connection tuning и restore drill |
| Staging/preview | Реальный production incident/rollback или повторяющийся release blocker, доказанно вызванный отсутствием изолированной pre-production проверки | Ephemeral local/CI environment и stronger smoke |
| Kubernetes/Helm/ArgoCD | Не менее двух independently scaling runtime services/nodes и доказанная scheduling/rollout задача, которую single-VM Compose не решает | Compose profiles, VM resize, отдельный bounded worker |
| External realtime adapter/broker | Подтверждённая horizontal realtime boundary: несколько backend replicas/nodes с необходимостью shared fan-out, при сохранении version invalidation/replay/idempotency | One-node SSE и existing invalidation contract |
| Card assets/CDN | Published assets `>5 GiB`, monthly delivery `>50 GiB` или measured asset growth прогнозирует исчерпание production storage `<90 days` | Optimisation, immutable repository bundle, existing Object Storage |
| Registered accounts/OIDC | Есть подтверждённые recurring users и требование cross-device identity/recovery, которое game-scoped guest credential не выполняет | Export/rejoin/recovery runbook без account identity |
| Admin console | Не менее двух recurring operator actions в неделю нельзя безопасно и аудируемо выполнить narrow CLI/runbook | Audited least-privilege CLI/runbook |
| Traces/RUM/analytics | Конкретный production incident или approved product question нельзя диагностировать server metrics/traces; отдельно приняты consent/privacy/cardinality/sampling gates | Existing Monium server telemetry and bounded aggregates |

## Контекст и подтверждённое состояние

- Current target architecture — одна Yandex Compute VM, private registry,
  local PostgreSQL data disk, Compose/Traefik, keyless deploy and managed
  Monium. На 2026-08-01 P0 ещё не даёт требуемого seven-day production window.
- P2 complexity сейчас не имеет подтверждённого capacity/SLA/product trigger;
  поэтому exact slice заранее выбирать было бы спекуляцией.
- Backend authority, deterministic engine/replay, actor-specific projections,
  immutable content set, credential derivation, idempotency and content-rights
  boundaries сохраняются при любой будущей topology.
- Владелец подтвердил решение идти через реальные metrics/triggers и отдельное
  согласование slice; это не является approval реализации P2.

## Scope

### Входит

- Read-only сбор и проверка семидневного production evidence.
- Обновление trigger matrix и P2 status в roadmap.
- Decision result: `all deferred` либо предложение одного exact slice для
  отдельного согласования.

### Не входит

- Изменение `.github`, backend, frontend, content, Compose, Terraform,
  scripts, operations docs, ADR или runtime/data/cloud resources.
- Создание ADR до подтверждённого trigger и выбора slice владельцем.
- Accounts/admin/staging/HA/Kubernetes/broker/analytics «на будущее».
- Любые новые расходы или material scope, выбранные агентом самостоятельно.

## Архитектурный подход

1. Дождаться завершения P0/P1 и полного seven-day evidence window.
2. Для каждого candidate записать current value, interval/source, threshold,
   incident context и самый простой response в текущей архитектуре.
3. При отсутствии trigger завершить decision plan как `deferred` без
   реализации.
4. При наличии trigger предложить владельцу один slice и остановиться.
5. Только после выбора подготовить accepted ADR, exact architecture/data flow,
   migration/rollback/cost/decommission plan, сузить manifest и запросить
   новое approval до любой записи за пределами decision docs.

## Затронутые компоненты и контракты

| Компонент | Изменение | Контракт |
|---|---|---|
| repository workflow/docs | Seven-day evidence matrix и decision result | `platform:p2-trigger-gates-v1` |
| production VM/Monium/release evidence | Только read-only источник | No mutation, no authority change |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | Current metrics, triggers and P2 decision |
| `docs/agents/plans/active/20260731T005309Z-784d5e-infrastructure-p2-platform-evolution.md` | write | Active decision lifecycle |
| `docs/agents/plans/archive/20260731T005309Z-784d5e-infrastructure-p2-platform-evolution.md` | write | Archived decision lifecycle |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| Production VM, Monium, GitHub, Yandex Cloud/DNS, data | none | Read-only evidence; no selected P2 slice |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Production VM | P0/P1 plans | dependencies | Read metrics only after stable P0/P1 |
| Monium telemetry | telemetry/P1 plans | dependencies | Read seven-day series; alerts unchanged |
| Release/rollback evidence | deploy/security/P1 plans | dependencies | Read exact SHA/digests/results only |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 14:44:19 UTC.
- **Обнаруженные пересечения:** future P2 implementation could overlap almost
  every product/infrastructure area; current decision write set overlaps only
  roadmap and this plan lifecycle.
- **Решение:** predecessor resources are read-only. Any selected slice is a
  material scope change: enumerate exact overlaps/dependencies/resources,
  stop and obtain fresh approval before implementation.

## План реализации

1. [ ] Verify P0/P1 completion time and calculate the first valid review time.
2. [ ] Collect and timestamp seven complete days of metrics, cost and
   operational/product evidence; do not extrapolate missing series.
3. [ ] Fill current-value/trigger/simpler-alternative matrix.
4. [ ] If no trigger is crossed, record `deferred`, verify/scope-check and
   archive without remote mutation.
5. [ ] If a trigger is crossed, present one recommended slice plus evidence
   and cost range to the owner, then stop.
6. [ ] After owner choice only, add ADR, narrow scope/write/remote mutation
   set, migration/rollback/cost plan and request new approval.

## Проверки

- [ ] Seven-day interval completeness, timestamps and source links/queries
- [ ] Current value versus candidate threshold, with incident periods labelled
- [ ] Simpler P0/P1 alternative and actual monthly-cost comparison
- [ ] No runtime/cloud/GitHub/DNS/data mutation in decision phase
- [ ] Architecture invariants and privacy/data-flow impact for any proposed slice
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T005309Z-784d5e-infrastructure-p2-platform-evolution`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** неполное/аномальное семидневное окно создаёт ложный trigger.
  **Снижение:** completeness check, incident labels and no extrapolation.
- **Риск:** incident alert ошибочно превращается в platform rewrite.
  **Снижение:** root-cause и simplest-response gate до P2 comparison.
- **Риск:** broad draft воспринимается как разрешение реализации.
  **Снижение:** decision-only manifest, empty remote mutation set and mandatory
  reapproval after exact slice selection.
- **Откат:** decision phase меняет только roadmap/plan docs; revert the exact
  documentation diff. Future slice rollback must be written before approval.

## Открытые вопросы

- Фактических seven-day P0/P1 metrics ещё нет; до их появления slice не
  выбирается.
- Все P2 направления сейчас `deferred`. Staging является первым практичным
  candidate только при подтверждённом deployment incident/risk; иначе оно
  остаётся deferred вместе с остальными slices.
- Budget, provider and migration details intentionally не запрашиваются до
  выбора slice: decision-only phase не разрешает расходы.

## Согласование

- **Статус:** not requested; decision-only draft
- **Запрошено:** —
- **Подтверждено:** decision order only; this is not approval of a P2 slice or
  implementation.
- **Формулировка/ограничения пользователя:** сначала реальные
  metrics/triggers; затем помощь с выбором exact slice, ADR,
  migration/rollback/cost plan и новое approval. Пользователь подтвердил этот
  порядок 2026-08-01; implementation/select/commit/push не разрешены.

## Ход выполнения

- 2026-08-01: broad repository-wide write set удалён; plan сужен до
  read-only evidence review и двух decision documents.
- Candidate thresholds и earliest possible review window зафиксированы.
- Metrics collection, slice selection, ADR and remote mutation не начинались.

## Итог

Заполняется после evidence review.
