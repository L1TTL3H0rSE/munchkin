# PLAN: contest README, runbooks and production demo

- **Plan ID:** `20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo`
- **Статус:** completed
- **Создан:** 2026-07-31 00:53:08 UTC
- **Обновлён:** 2026-08-01 19:42:10 UTC
- **Владелец:** Codex / `019fbde1-fd6a-79e3-8b47-9f217363607f`
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; отдельная ветка не создаётся по указанию владельца
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry`, `20260731T005306Z-3de45e-production-compose-traefik-and-deploy`, `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`, `20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore`, `20260731T005308Z-3beea1-production-security-and-supply-chain`.
- **Блокирует:** `20260731T005309Z-569b95-infrastructure-p1-bonus-hardening`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "README.md",
    "docs/architecture/PRODUCTION_INFRASTRUCTURE.md",
    "docs/demo/CONTEST_DEMO.md",
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
    "20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry",
    "20260731T005306Z-3de45e-production-compose-traefik-and-deploy",
    "20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts",
    "20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore",
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

- [x] README кратко объясняет product, architecture, local start, canonical
  checks, CI/WIF/no-static-key delivery, production URL/status and limitations.
  Public `https://munchkin.l1ttl3h0rse.ru` публикуется только после valid HTTPS
  smoke; README явно говорит, что production URL ещё не доказан, и рабочая
  ссылка до live smoke не публикуется.
- [x] Diagram показывает GitHub OIDC→Yandex WIF→registry, digest deploy→VM,
  Traefik/web/game/PostgreSQL, Lockbox, telemetry and off-host backup trust/data
  flows; secrets/private data boundaries отмечены, а live edges помечены как
  owner-gated.
- [x] Runbooks cover deploy, failed migration, rollback, reboot recovery,
  DNS/TLS, WIF revoke, secret rotation, telemetry outage, alert handling,
  backup and isolated restore with prerequisites/stop conditions through the
  existing canonical operation documents.
- [x] Every claimed repository-side infrastructure capability links to a current
  automated check or completed archived plan; cloud/host/runtime capabilities
  without evidence are explicitly labelled unrun.
- [x] Demo is a timed `5-minute` live path for a mixed/non-expert contest
  audience: open required public HTTPS URL, create/join/play representative
  flow, show release SHA, CI images, dashboard/alert and backup freshness
  without exposing private game state. Fresh sanitized screenshots are allowed
  as supplementary/fallback evidence; prerecorded video is not included. The
  script and privacy/stop rules are implemented; the live path remains unrun
  until its separate runtime gates are approved and evidenced.
- [x] Fresh-machine/documentation dry-run follows read-only/local commands
  without undocumented context; destructive commands are clearly gated. The
  owner-facing script records the exact limitation when public/runtime evidence
  is unavailable.
- [x] Broken local links, strict UTF-8/replacement and secret-pattern checks,
  canonical verify and scope-check pass; accepted live gates remain explicit.

## Контекст и подтверждённое состояние

- Previous plans are intended to complete all P0 infrastructure and produce
  archived evidence/runbooks.
- README currently cannot truthfully claim deployed application, telemetry or
  restore until dependencies finish.
- Documentation must use existing operational files rather than duplicate
  divergent instructions.
- Owner requires a five-minute live demo and public URL after HTTPS smoke,
  permits sanitized screenshots and does not want prerecorded fallback.

## Scope

### Входит

- README, architecture/evidence index, read-only predecessor-runbook audit and
  demo script.
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
4. Mark optional/P1/P2 and current limitations explicitly. Demo uses the live
   five-minute public-URL flow; screenshots are freshly captured/sanitized
   evidence and never justify an unsupported production claim.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| README | Production/contest entrypoint | Current verified capabilities |
| architecture docs | Trust/data-flow diagram | Non-secret resource topology |
| operations docs | Read-only link/consistency audit | Owner-safe commands/gates |
| demo docs | Timed evidence script | No fabricated state |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `README.md` | write | Primary project entrypoint |
| `docs/architecture/PRODUCTION_INFRASTRUCTURE.md` | write | Exact architecture/evidence diagram |
| `docs/demo/CONTEST_DEMO.md` | write | Five-minute contest/demo script |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | Verified P0 status |
| `docs/agents/PROJECT_MEMORY.md` | write | Durable verified production facts |
| `docs/agents/plans/active/20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo.md` | write | Archived lifecycle |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| GitHub, production VM/cloud/DNS/data | none | Docs consume only verified read-only evidence |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Existing runbooks | all previous infra plans | predecessors, read-only | Link; do not duplicate or rewrite commands |
| Live production evidence | production plans | read-only | Refresh immediately before docs |
| README/demo claims | this plan | exact owner | P1 is all-deferred and cannot extend claims |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 14:44:19 UTC.
- **Обнаруженные пересечения:** roadmap is shared; predecessor runbooks and
  live evidence are read-only inputs. P1 has no implementation write set.
- **Решение:** start only after security plan archive; write only README, the
  exact architecture/demo files, roadmap/memory and this lifecycle.

## План реализации

1. [x] Inventory archived plans/runbooks/live non-secret state and build the
   claim → evidence matrix. The predecessor plans are archived; local
   repository evidence is available, while public URL, cloud, host, Monium
   and backup runtime evidence remain explicitly unrun.
2. [x] Record the fixed five-minute live demo, public-URL-after-HTTPS-smoke
   gate, screenshot policy and no-prerecorded constraint; the queue approval
   is the formal owner approval for this exact documentation scope.
3. [x] Rewrite README as concise entrypoint and link exact predecessor
   runbooks. No runbook defect required an out-of-scope edit.
4. [x] Add architecture/evidence diagram and timed demo/stop checklist; no
   fabricated screenshot, metric or production claim was added.
5. [x] Run fresh-reader command/link/secret/document dry-run; local checks
   passed and unavailable runtime evidence remains an explicit stop condition.
6. [x] Update roadmap/project memory only with durable verified facts.
7. [x] Canonical verify and scope-check passed; plan is complete and ready for
   archive/release and its separate local commit.

## Проверки

- [x] Markdown local-link and strict UTF-8/replacement checks passed; no
  broken local target was found.
- [x] Read-only/local documentation dry-run commands passed; remote commands
  were not executed.
- [x] URL/TLS/release SHA/dashboard/backup freshness evidence boundary was
  refreshed in the matrix; live evidence remains explicitly unrun.
- [x] Secret/personal-data/resource-ID classification scan passed for the new
  documentation; no credential, owner email, personal CIDR or private data was
  added.
- [x] Claim-to-archived-plan evidence matrix has no unsupported repository-side
  claim; every live-only claim is labelled unrun or owner-gated.
- [x] Five-minute live-demo script dry-run and privacy review passed; public
  HTTPS live path and sanitized screenshot capture remain unrun, and no
  prerecorded artifact/path was added.
- [x] `node .codex/hooks/plan-lint.mjs` passed before archive with
  `plans=50 active=3 archive=47 issues=0`.
- [x] `./leinoctl verify --changed --session
  e6afc969-9462-4343-aefc-a653b89dea87` passed: 42 harness tests, 68/69
  leinoctl tests with one documented platform symlink-permission skip, and
  plan-lint passed.
- [x] `./leinoctl scope-check --plan
  20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo` passed with
  `outsideWriteSet=[]`, `missingRequiredChecks=[]` and no stale checks; the
  only warning was six paths without post-write hook ledger entries.
- [x] `git diff --check` passed.

## Риски и откат

- **Риск:** docs overclaim/stale resource state. **Снижение:** evidence matrix,
  refreshed read-only checks and explicit limitations/date.
- **Риск:** operational commands leak/delete. **Снижение:** placeholders,
  stop conditions, separate mutation approvals and secret scan.
- **Риск:** duplicate runbooks drift. **Снижение:** one canonical file per
  procedure with links.
- **Откат:** documentation-only revert; production state unchanged.

## Открытые вопросы

- Demo duration is fixed at five minutes for a mixed/non-expert live contest
  audience.
- Production URL is required and may appear in README only after successful
  HTTPS smoke.
- Sanitized screenshots are allowed; prerecorded fallback is not included.
- Repository-side P0 evidence is now indexed by the completed predecessor
  plans; public HTTPS, cloud/host, WIF/registry, Monium and backup runtime
  evidence still must be refreshed only through their separate owner gates.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 15:15:14 UTC
- **Подтверждено:** 2026-08-01 15:15:14 UTC
- **Формулировка/ограничения пользователя:** пользователь формально одобрил
  последовательную очередь exact plans начиная с этого plan и разрешил
  approvals, select, implementation, verify, scope-check, archive/release,
  подготовительный local commit plan-файлов и отдельный local commit после
  каждого завершённого plan. Подтверждены audit defaults, five-minute live
  demo/public-URL gate и сокращённый Monium soak на 60 минут; ветка не
  создаётся. Разрешён обычный push в `origin/main` только после успешных
  проверок. PostgreSQL password и dedicated deploy SSH key разрешено
  безопасно сгенерировать и передать непосредственно в утверждённые secret
  stores без вывода или сохранения в Git, plan, chat или logs. Remote
  mutations, Terraform apply, изменение Timeweb NS, secret payload insertion,
  GitHub/Yandex settings, production VM bootstrap/deploy и любые
  платные/destructive actions не одобрены заранее: перед каждым таким этапом
  нужен sanitized exact mutation plan и отдельное approval. Документация не
  добавляет непроверенную production URL; owner email и личные данные остаются
  вне Git/plan.

## Ход выполнения

- Base documentation/demo plan created behind all P0 runtime dependencies.
- 2026-08-01 selected in trusted session `e6afc969-9462-4343-aefc-a653b89dea87`
  after Plan5 release and separate commit `de93453`; no remote mutation was
  attempted.
- 2026-08-01 archived predecessor plans and canonical operations runbooks were
  audited. The evidence matrix separates local contracts/checks from unrun
  public URL, cloud, host, Monium and backup runtime gates.
- 2026-08-01 implemented README, architecture/evidence index, five-minute
  live-only demo script, roadmap status and durable memory entry. Local link,
  UTF-8, secret-pattern, action-pin, static security and isolated Compose
  checks passed; no remote mutation or live demo was attempted.
- 2026-08-01 canonical verify and scope-check passed in trusted session
  `e6afc969-9462-4343-aefc-a653b89dea87`; all changed paths stayed in the exact
  documentation write set.

## Итог

The repository now has a concise entrypoint, a non-secret production
architecture/evidence matrix and a timed live-only contest script linked to
the canonical operational runbooks. It makes no public-URL, deployment,
attestation, Monium, backup/restore or HA claim without fresh evidence. Local
documentation/lifecycle checks passed; remote/cloud/host/secret and live demo
gates remain separately approved and unrun.
- 2026-08-01 owner demo constraints recorded; no media was captured/generated.
- 2026-08-01 formal queue approval recorded with the remote-mutation gates
  above; implementation remains dependency-gated.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
