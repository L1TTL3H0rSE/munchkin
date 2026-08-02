# PLAN: infrastructure P1 bonus hardening

- **Plan ID:** `20260731T005309Z-569b95-infrastructure-p1-bonus-hardening`
- **Статус:** draft
- **Создан:** 2026-07-31 00:53:09 UTC
- **Обновлён:** 2026-08-01 14:40:07 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260731T005306Z-3de45e-production-compose-traefik-and-deploy`, `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`, `20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo`.
- **Блокирует:**
  `20260731T005309Z-784d5e-infrastructure-p2-platform-evolution`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/agents/plans/active/20260731T005309Z-569b95-infrastructure-p1-bonus-hardening.md",
    "docs/agents/plans/archive/20260731T005309Z-569b95-infrastructure-p1-bonus-hardening.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [
    "platform:p1-bonus-decision-v1"
  ],
  "dependsOn": [
    "20260731T005306Z-3de45e-production-compose-traefik-and-deploy",
    "20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts",
    "20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo"
  ],
  "sharedResources": [
    "cloud:yandex-compute:fv4eule47h2vqo5ki48k",
    "observability:production-telemetry-v1",
    "delivery:production-release-evidence-v1",
    "dns:munchkin.l1ttl3h0rse.ru"
  ]
}
```

## Цель

Честно закрыть contest P1 bonus как `all deferred`, не отбирая время и
headroom у P0. Первый production deploy назначен на
`2026-08-02 09:00–11:00 Europe/Moscow`, а P1 требовал полностью завершённый
P0, затем минимум 24 часа stable evidence и hard cutoff
`2026-08-02 18:00 Europe/Moscow`. Эти условия одновременно невыполнимы.
Текущий plan разрешает только зафиксировать deferral; он не разрешает bonus
code, workflow, load traffic, Monium changes или новые расходы.

## Критерии приёмки

- [ ] После archive всех P0 predecessors подтверждено, что первый deploy не
  мог дать 24 полных часа evidence до P1 cutoff; пропущенные данные не
  экстраполируются и deadline не переносится агентом.
- [ ] `INFRA-B01`–`INFRA-B10` отмечены в roadmap как `deferred/not attempted`,
  а не complete/partial; contest claims и README не начисляют за них бонус.
- [ ] P1 не меняет `.github`, README/demo, application code, Compose,
  Terraform, scripts, VM, Monium, DNS, alerts or public traffic.
- [ ] Incremental budget остаётся `0 RUB/month`; существующие managed Monium
  and owner-only email alerts не меняются.
- [ ] Для возможного post-contest plan сохранена рекомендация: сначала только
  `B09` deploy annotation, затем `B06` один bounded k6 smoke. Это не selected
  slice и не authorization.
- [ ] Future `B09` разрешается лишь после доказанного machine-readable release
  artifact (full commit SHA, game/web digests, workflow run/result/timestamp)
  и поддерживаемого idempotent Monium annotation endpoint/auth contract.
- [ ] Future `B06` разрешается лишь после `B09`, минимум 24h stable baseline,
  available RAM `>=1 GiB`, CPU p95 `<=70%`, disk free `>=30%`, no sustained
  swap/unresolved incident; one run, `1–2 VUs`, `<=1 request/s`, `<=60s`, abort
  on readiness/5xx/latency/resource guard.

## Контекст и подтверждённое состояние

- Public DNS audit 2026-08-01 показывает Timeweb delegation и NXDOMAIN для
  production hostname; P0 deploy/telemetry/backup/security/demo ещё не завершены.
- Maintenance/deploy window начинается 2026-08-02 в 09:00 MSK. Даже
  мгновенно успешный deploy не создаёт 24h baseline к cutoff 18:00 того же дня.
- Broad P1 stack (Loki/Alloy/exporters/socket proxy/headers/infra tests и
  другие B-items) не принадлежит этому plan и остаётся без implementation owner.
- Владелец согласился с условной приоритизацией `B09 → B06`, нулевым budget и
  deadline; audit evidence переводит условный результат в `all deferred`.

## Scope

### Входит

- Зафиксировать calendar/evidence decision и all-deferred status в roadmap.
- Сохранить post-contest recommendation без implementation ownership.

### Не входит

- Любая реализация `B01`–`B10`.
- Workflow/scripts/k6/docs-demo/README/runtime/cloud/Monium/DNS mutations.
- Перенос deadline, ослабление 24h/headroom gates или claim partial bonus.
- Создание post-contest implementation plan без нового owner request/approval.

## Архитектурный подход

1. Дождаться завершения P0 dependency chain только для truthful evidence links.
2. Записать в roadmap, что contest P1 не запускался из-за доказанного
   calendar gate, а не из-за подразумеваемой реализации.
3. Завершить/архивировать этот decision-only plan без remote mutation.
4. После contest при новом запросе создать отдельный narrow plan; повторно
   проверить Monium annotation API/release artifact before considering `B09`,
   затем отдельно проверить 24h headroom before `B06`.

## Затронутые компоненты и контракты

| Компонент | Изменение | Контракт |
|---|---|---|
| repository workflow/docs | All-deferred decision only | `platform:p1-bonus-decision-v1` |
| P0 VM/Monium/release evidence | Read-only proof | No mutation/no bonus claim |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | Truthful P1 all-deferred status |
| `docs/agents/plans/active/20260731T005309Z-569b95-infrastructure-p1-bonus-hardening.md` | write | Active decision lifecycle |
| `docs/agents/plans/archive/20260731T005309Z-569b95-infrastructure-p1-bonus-hardening.md` | write | Archived decision lifecycle |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| GitHub, production VM, Monium, DNS, public endpoint | none | Decision-only all-deferred closure |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| P0 release/telemetry/VM evidence | deploy/telemetry/docs | predecessors | Read only after archive |
| Roadmap | all infrastructure plans | this decision after P0 | Update only P1 status/evidence |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 14:44:19 UTC.
- **Обнаруженные пересечения:** future bonus implementations would overlap P0
  workflows/config/runtime; current plan overlaps only roadmap/lifecycle docs.
- **Решение:** no predecessor files/resources are writable. A post-contest
  bonus is a new scope requiring its own plan and approval.

## План реализации

1. [ ] Verify archived P0 timestamps and link the evidence showing the missed
   24h/cutoff combination.
2. [ ] Mark every B-item deferred/not-attempted in roadmap without bonus claim.
3. [ ] Run plan-lint, verify/scope-check and archive this decision-only plan.
4. [ ] Stop. Do not create or execute post-contest work without a new request.

## Проверки

- [ ] P0 completion/deploy timestamp versus 24h window and cutoff
- [ ] B01–B10 all explicitly deferred/not attempted
- [ ] No `.github`/code/Compose/Terraform/scripts/runtime/remote diff
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T005309Z-569b95-infrastructure-p1-bonus-hardening`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** deadline переносится молча ради bonus. **Снижение:** fixed cutoff
  and all-deferred acceptance criterion.
- **Риск:** future recommendation воспринимается как current authorization.
  **Снижение:** decision-only manifest, empty remote set and new-plan gate.
- **Риск:** docs claim unimplemented bonus. **Снижение:** evidence link and
  explicit not-attempted wording.
- **Откат:** revert exact roadmap/plan documentation diff; no remote state is
  changed.

## Открытые вопросы

- Contest P1 decision is settled: all B-items are deferred under the current
  deadline.
- Whether to pursue post-contest `B09`/`B06` is intentionally outside this
  plan and requires a new owner request.

## Согласование

- **Статус:** not requested; decision-only all-deferred draft
- **Запрошено:** —
- **Подтверждено:** owner accepted the original conditional priority/deadline;
  formal approval of this corrected all-deferred decision remains pending.
- **Формулировка/ограничения пользователя:** выбрать subset/priority/deadline/
  budget/headroom/provider/channel. Audit selected no contest implementation
  because the accepted gates are temporally impossible; no
  select/implementation/commit/push.

## Ход выполнения

- 2026-08-01: conditional B09→B06 implementation scope removed after calendar
  audit proved that 24h evidence cannot fit before cutoff.
- All remote/code paths removed; no bonus implementation or traffic started.

## Итог

Заполняется после all-deferred decision closure.
