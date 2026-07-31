# PLAN: contest README, runbooks and production demo

- **Plan ID:** `20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo`
- **Статус:** draft
- **Создан:** 2026-07-31 00:53:08 UTC
- **Обновлён:** 2026-07-31 01:06:00 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260731T005308Z-3beea1-production-security-and-supply-chain`.
- **Блокирует:** `20260731T005309Z-569b95-infrastructure-p1-bonus-hardening`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "README.md",
    "docs/architecture/**",
    "docs/operations/**",
    "docs/demo/**",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/agents/PROJECT_MEMORY.md",
    "docs/agents/plans/active/20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo.md",
    "docs/agents/plans/archive/20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [
    "documentation:production-evidence-v1",
    "documentation:operator-runbooks-v1",
    "documentation:contest-demo-v1"
  ],
  "dependsOn": [
    "20260731T005308Z-3beea1-production-security-and-supply-chain"
  ],
  "sharedResources": [
    "github:repo:L1TTL3H0rSE/munchkin",
    "docs:production-runbooks-v1",
    "demo:production-munchkin-v1"
  ]
}
```

## Цель

Закрыть INFRA-012: превратить фактически доказанную production
инфраструктуру в короткий воспроизводимый contest/demo narrative. README,
architecture diagram, deploy/rollback/backup/observability/security runbooks
и demo checklist должны ссылаться на измеряемые evidence, не обещая
непроверенные HA/SLA/feature capabilities.

## Критерии приёмки

- [ ] README кратко объясняет product, architecture, local start, canonical
  checks, CI/WIF/no-static-key delivery, production URL/status and limitations.
- [ ] Diagram показывает GitHub OIDC→Yandex WIF→registry, digest deploy→VM,
  Traefik/web/game/PostgreSQL, Lockbox, telemetry and off-host backup trust/data
  flows; secrets/private data boundaries отмечены.
- [ ] Runbooks cover deploy, failed migration, rollback, reboot recovery,
  DNS/TLS, WIF revoke, secret rotation, telemetry outage, alert handling,
  backup and isolated restore with prerequisites/stop conditions.
- [ ] Every claimed infrastructure capability links to current automated check,
  cloud/host evidence or completed archived plan. IDs/URLs are non-secret and
  current; credentials, personal IP/CIDR and sensitive screenshots absent.
- [ ] Demo script has timed happy path plus controlled fallback: open app,
  create/join/play representative flow, show HTTPS, release SHA, CI images,
  dashboard/alert and backup freshness without exposing private game state.
- [ ] Fresh-machine/documentation dry-run by owner follows commands without
  undocumented context; destructive commands are clearly gated.
- [ ] Broken links, Markdown/lint/text/secret checks, canonical verify and
  scope-check pass.

## Контекст и подтверждённое состояние

- Previous plans are intended to complete all P0 infrastructure and produce
  archived evidence/runbooks.
- README currently cannot truthfully claim deployed application, telemetry or
  restore until dependencies finish.
- Documentation must use existing operational files rather than duplicate
  divergent instructions.

## Scope

### Входит

- README, architecture/evidence index, consolidated runbooks and demo script.
- Documentation verification and owner dry-run.
- Roadmap status based on completed evidence only.

### Не входит

- Infrastructure/application changes, cloud mutations or production deploy.
- Fabricated screenshots/metrics/check results.
- P1/P2 implementation.

## Архитектурный подход

1. Build an evidence matrix from archived plans and current live read-only
   checks.
2. Keep README short; detailed operator procedures stay in versioned runbooks.
3. Use one source of truth per procedure and link it from README/demo.
4. Mark optional/P1/P2 and current limitations explicitly.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| README | Production/contest entrypoint | Current verified capabilities |
| architecture docs | Trust/data-flow diagram | Non-secret resource topology |
| operations docs | Runbook consolidation | Owner-safe commands/gates |
| demo docs | Timed evidence script | No fabricated state |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `README.md` | write | Primary project entrypoint |
| `docs/architecture/**` | write | Diagram/evidence |
| `docs/operations/**` | write | Consolidated runbooks |
| `docs/demo/**` | write | Contest/demo script |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | Verified P0 status |
| `docs/agents/PROJECT_MEMORY.md` | write | Durable verified production facts |
| `docs/agents/plans/active/20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Existing runbooks | all previous infra plans | this plan consolidates | Do not duplicate commands |
| Live production evidence | production plans | read-only | Refresh immediately before docs |
| README/demo claims | P1 plan | this plan baseline | P1 updates only after real evidence |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 01:06:00 UTC.
- **Обнаруженные пересечения:** `docs/operations/**` and roadmap are produced by
  predecessor plans; P1 will later extend evidence.
- **Решение:** start only after security plan archive; refresh exact paths and
  narrow write set before approval.

## План реализации

1. [ ] Inventory archived plans/runbooks/live non-secret state and build claim
   → evidence matrix.
2. [ ] Update exact document map/demo duration and request owner approval.
3. [ ] Rewrite README as concise entrypoint; consolidate/link runbooks.
4. [ ] Add architecture/evidence diagram and timed demo/fallback checklist.
5. [ ] Run fresh-reader command/link/secret/document dry-run.
6. [ ] Update roadmap/project memory only with durable verified facts.
7. [ ] Verify/scope-check and archive.

## Проверки

- [ ] Markdown/link/anchor and strict UTF-8 checks
- [ ] Commands copied into clean/read-only dry-run where safe
- [ ] URL/TLS/release SHA/dashboard/backup freshness evidence refresh
- [ ] Secret/personal-data/resource-ID classification scan
- [ ] Claim-to-archived-plan evidence matrix has no unsupported claim
- [ ] Demo timed dry-run and fallback path
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** docs overclaim/stale resource state. **Снижение:** evidence matrix,
  refreshed read-only checks and explicit limitations/date.
- **Риск:** operational commands leak/delete. **Снижение:** placeholders,
  stop conditions, separate mutation approvals and secret scan.
- **Риск:** duplicate runbooks drift. **Снижение:** one canonical file per
  procedure with links.
- **Откат:** documentation-only revert; production state unchanged.

## Открытые вопросы

- Contest/demo time limit, target audience and acceptable screenshots/video.
- Whether production URL can be public in README.
- Exact completed P0 evidence is unknown until dependencies finish; draft must
  be refreshed before approval.

## Согласование

- **Статус:** not requested; prerequisite draft
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** заранее создать все infra roadmap
  plans; no select/implementation/commit/push.

## Ход выполнения

- Base documentation/demo plan created behind all P0 runtime dependencies.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
