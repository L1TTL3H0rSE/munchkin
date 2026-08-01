# PLAN: production Compose, Traefik, DNS, TLS and controlled deploy

- **Plan ID:** `20260731T005306Z-3de45e-production-compose-traefik-and-deploy`
- **Статус:** approved
- **Создан:** 2026-07-31 00:53:06 UTC
- **Обновлён:** 2026-08-01 15:15:14 UTC
- **Владелец:** Codex / `019fbde1-fd6a-79e3-8b47-9f217363607f`
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; отдельная ветка не создаётся по указанию владельца
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry`.
- **Блокирует:**
  `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`,
  `docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".github/workflows/deploy-production.yml",
    "compose.production.yml",
    "infra/compose/traefik-static.yml",
    "infra/compose/traefik-dynamic.yml",
    "infra/release/production-release-evidence.schema.json",
    "infra/terraform/bootstrap/github_actions.tf",
    "infra/terraform/bootstrap/outputs.tf",
    "infra/terraform/environments/production/dns.tf",
    "infra/terraform/environments/production/iam.tf",
    "infra/terraform/environments/production/lockbox.tf",
    "infra/terraform/environments/production/outputs.tf",
    "infra/terraform/environments/production/variables.tf",
    "infra/terraform/README.md",
    "scripts/production/bootstrap-host.sh",
    "scripts/production/deploy.sh",
    "scripts/production/rollback.sh",
    "scripts/production/status.sh",
    "scripts/production/smoke.sh",
    "scripts/production/systemd/munchkin-compose.service",
    "scripts/terraform-check.sh",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/operations/PRODUCTION_DEPLOYMENT.md",
    "docs/operations/PRODUCTION_ROLLBACK.md",
    "docs/operations/PRODUCTION_SECRETS.md",
    "docs/agents/plans/active/20260731T005306Z-3de45e-production-compose-traefik-and-deploy.md",
    "docs/agents/plans/archive/20260731T005306Z-3de45e-production-compose-traefik-and-deploy.md"
  ],
  "components": [
    "repository-workflow",
    "terraform-infrastructure",
    "root-compose"
  ],
  "contracts": [
    "delivery:production-compose-v1",
    "delivery:digest-rollout-v1",
    "delivery:production-release-evidence-v1",
    "operations:dns-tls-v1",
    "operations:runtime-secrets-v1"
  ],
  "dependsOn": [
    "20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry"
  ],
  "sharedResources": [
    "infra:yandex-cloud-production-v1",
    "cloud:yandex-compute:fv4eule47h2vqo5ki48k",
    "cloud:yandex-address:81.26.187.230",
    "cloud:yandex-container-registry:crpdnmjudj1usiu90gdn",
    "github:environment:production-deploy",
    "dns:munchkin.l1ttl3h0rse.ru",
    "runtime:production-health-v1",
    "delivery:immutable-image-pair-v1",
    "delivery:production-release-evidence-v1"
  ]
}
```

## Цель

Закрыть оставшуюся automation boundary INFRA-003 и INFRA-004/005/007:
развернуть digest-pinned `game`/`web`/PostgreSQL за Traefik на существующей VM,
подключить domain/DNS/TLS, runtime secrets и controlled CD с one-shot
migrations, smoke, last-known-good rollback и fail-closed host boundary.

## Критерии приёмки

- [ ] `compose.production.yml` использует только digest-pinned `game`/`web`;
  `latest`, mutable tags и local production build запрещены.
- [ ] Наружу bind-ятся только Traefik `80/443`; PostgreSQL, game, web,
  Collector/admin/API management endpoints остаются private/loopback.
- [ ] PostgreSQL data живёт на existing `/srv/munchkin/postgres`; secrets и
  ACME storage имеют root-only permissions; containers non-root where
  compatible, `read_only`, dropped capabilities, bounded logs, restart and
  resource/health policies заданы явно.
- [ ] One-shot migration service успешно завершается до app rollout. Failed
  migration/readiness/smoke останавливает deploy и не переключает
  last-known-good release.
- [ ] Traefik маршрутизирует exact production hostname, получает/renew-ит TLS,
  делает HTTP→HTTPS redirect и не получает unrestricted raw Docker socket.
  До INFRA-B10 используется безопасный file provider или socket proxy.
- [ ] DNS A record указывает на reserved IPv4 `81.26.187.230`; DNS zone/NS
  ownership и registrar mutation подтверждаются отдельно. Owner подтвердил
  домен `l1ttl3h0rse.ru`, production hostname
  `munchkin.l1ttl3h0rse.ru`, registrar Timeweb и целевую authoritative zone в
  Yandex Cloud DNS. Delegation/record остаются live evidence gate. TLS public
  smoke проверяет certificate chain, hostname и expiry.
- [ ] Lockbox metadata/ACL могут управляться Terraform, но secret payload,
  database password, deploy private key и ACME account data не попадают в
  Terraform state/Git. Payload создаётся/rotates owner-side через отдельный
  runbook.
- [ ] Production secret inventory ограничен PostgreSQL password/derived DSN,
  scoped deploy SSH private key и будущими destination credentials из
  последующих plans. Card Studio выключен; `OPENAI_API_KEY`/authoring token и
  общий game-signing secret в public production отсутствуют.
- [ ] Host получает secrets через instance-attached keyless runtime identity
  либо другой заранее одобренный short-lived mechanism; static Yandex cloud
  keys на VM/GitHub запрещены.
- [ ] Automation deploy user не входит в `docker` group, не имеет general root
  shell и может через pinned SSH host key/sudo запустить только root-owned
  allowlisted deploy/status/rollback commands.
- [ ] Выбран отдельный scoped deploy SSH key в protected GitHub environment:
  dedicated deploy user, pinned host key, no root login/general shell/docker
  group, root-owned allowlisted sudo commands and documented rotation. OS
  Login/short-lived SSH остаётся возможной последующей migration, не блокером
  contest deploy.
- [ ] ACME сначала использует staging, затем production. Owner-supplied ACME
  email передаётся только owner-side при deploy и не сохраняется в Git/plan;
  ACME account state имеет root-only permissions на VM.
- [ ] Первый controlled deploy/maintenance window зафиксирован на
  `2026-08-02 09:00–11:00 Europe/Moscow`; если readiness не становится green
  за 5 минут, rollout останавливается и запускается совместимый rollback.
- [ ] GitHub deploy job работает только через protected
  `production-deploy`, main/full-SHA release pair and concurrency lock.
  Cloud access, если нужен registry verification, только через отдельный exact
  WIF subject/least-privilege SA; static cloud keys отсутствуют.
- [ ] Deploy state хранит current/previous digest pair atomically. Rollback не
  откатывает database schema вслепую и использует только совместимый previous
  image pair.
- [ ] `delivery:production-release-evidence-v1` валидируется JSON Schema
  `infra/release/production-release-evidence.schema.json`. Каждый deploy и
  rollback, включая failed attempt, создаёт `release-evidence.json` с
  `schemaVersion`, operation/result, full commit SHA, immutable game/web
  digests, GitHub workflow run ID/attempt/URL, started/completed timestamps,
  migration/readiness/smoke results and previous release reference.
- [ ] Successful operation atomically updates root-owned
  `/srv/munchkin/state/current-release.json` and preserves
  `/srv/munchkin/state/previous-release.json`; failed operation leaves current
  unchanged. GitHub artifact name is
  `production-release-evidence-<run-id>-<run-attempt>`, retention is 30 days,
  payload contains no secrets and downstream jobs receive read-only
  `actions:read` access only after their own plan/approval.
- [ ] Reboot recovery проверена: mounted data disk, Docker, Compose stack,
  secrets availability, TLS and readiness возвращаются без manual drift.
- [ ] Terraform/Compose/scripts/tests, public/internal smoke, rollback/reboot
  drill, secret scan, canonical verify и scope-check проходят.

## Контекст и подтверждённое состояние

- Existing VM `fv4eule47h2vqo5ki48k` RUNNING на `81.26.187.230`; Docker/Compose
  active, `/srv/munchkin` baseline и separate ext4 data disk подтверждены.
- Security group уже разрешает public `80/443` и owner-CIDR SSH; application,
  database и management ports не открыты.
- Registry/runtime pull identity существует, но images/application Compose,
  DNS/TLS, Lockbox payload и deploy automation ещё отсутствуют.
- Owner подтвердил Timeweb/domain/Yandex Cloud DNS target, owner-side ACME
  email policy и первое окно `2026-08-02 09:00–11:00 MSK`. Scoped deploy SSH
  и runtime-only secret injection выбраны аудитом как безопасные defaults и
  остаются частью formal plan review. Фактическая public NS/A/TLS делегация
  проверяется отдельно перед mutation и после propagation.
- Public DNS audit `2026-08-01` показывает текущую, ещё не production-ready
  конфигурацию: delegation остаётся на `ns1.timeweb.ru`, `ns2.timeweb.ru`,
  `ns3.timeweb.org`, `ns4.timeweb.org`; apex указывает на Timeweb
  `92.53.96.223`/`2a03:6f00:1::5c35:60df`, а
  `munchkin.l1ttl3h0rse.ru` отвечает `NXDOMAIN`. Yandex Cloud DNS delegation и
  production A record `81.26.187.230` ещё не применены публично.
- Dev Compose публикует local ports и остаётся development-only; production
  topology создаётся отдельным file.
- Dependency plan предоставляет exact readiness/migration/OTLP contracts.

## Scope

### Входит

- Production Compose/Traefik configuration, host filesystem/systemd boundary.
- Domain/DNS/TLS and secret metadata/access wiring.
- GitHub controlled CD, exact image pair deployment, smoke and rollback.
- Reboot/failure drills and owner runbooks.

### Не входит

- Telemetry destination/dashboard/alerts, off-host backup, supply-chain
  signing/retention and contest README.
- Registrar/domain purchase without explicit owner decision.
- Secret values in Git/Terraform/chat/logs.
- Kubernetes, load balancer, Managed PostgreSQL, multi-zone HA.
- Unreviewed cloud apply, DNS/NS change, production deploy or destructive
  rollback.

## Архитектурный подход

1. Production Compose has `traefik`, `web`, `game`, `postgres`, one-shot
   `migrate` and optional private Collector. Only Traefik publishes ports.
2. Root-owned deploy command validates pair manifest/digests/config/secrets,
   pulls images using ephemeral runtime IAM, runs migration, rolls services in
   dependency order, waits readiness, runs internal/public smoke and commits
   release state atomically.
3. GitHub environment permits main-only deploy; SSH host key is pinned from
   authenticated serial evidence. Selected scoped deploy credential lives
   only in the protected GitHub environment, rotates by runbook and grants no
   general root/Docker access.
4. Terraform manages only non-secret DNS/Lockbox/IAM metadata. Secret payload
   and registrar changes are independent owner gates. ACME contact value is
   owner-side input, not repository data.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| production Compose | Runtime topology | Digest pair + health dependencies |
| Traefik | HTTPS ingress | `munchkin.l1ttl3h0rse.ru` |
| GitHub CD | Controlled rollout | Protected environment + pinned host |
| Terraform DNS/Lockbox/IAM | Metadata/access | No secret payload in state |
| VM host boundary | Allowlisted deploy/rollback | No Docker-group/root shell |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.github/workflows/deploy-production.yml` | write | Controlled CD |
| `compose.production.yml` | write | Production topology |
| `infra/compose/traefik-static.yml` | write | Traefik entrypoints/providers/TLS config |
| `infra/compose/traefik-dynamic.yml` | write | Versioned routers/middleware/services config |
| `infra/release/production-release-evidence.schema.json` | write | Canonical deploy/rollback evidence contract |
| `infra/terraform/bootstrap/github_actions.tf` | write | Optional exact deploy WIF identity |
| `infra/terraform/bootstrap/outputs.tf` | write | Deploy identity outputs |
| `infra/terraform/environments/production/dns.tf` | write | DNS zone/records |
| `infra/terraform/environments/production/iam.tf` | write | Runtime/deploy least privilege |
| `infra/terraform/environments/production/lockbox.tf` | write | Secret metadata/access |
| `infra/terraform/environments/production/outputs.tf` | write | Non-secret deploy handoff |
| `infra/terraform/environments/production/variables.tf` | write | Non-secret/sensitive inputs |
| `infra/terraform/README.md` | write | Root/state/credential documentation |
| `scripts/production/bootstrap-host.sh` | write | Idempotent host/user/layout bootstrap |
| `scripts/production/deploy.sh` | write | Digest deploy and release evidence |
| `scripts/production/rollback.sh` | write | Compatible previous-pair rollback |
| `scripts/production/status.sh` | write | Non-secret release/readiness status |
| `scripts/production/smoke.sh` | write | Public/internal production smoke |
| `scripts/production/systemd/munchkin-compose.service` | write | Root-owned boot/runtime unit |
| `scripts/terraform-check.sh` | write | DNS/Lockbox/IAM assertions |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | INFRA-003/004/005/007 status |
| `docs/operations/PRODUCTION_DEPLOYMENT.md` | write | Deployment runbook |
| `docs/operations/PRODUCTION_ROLLBACK.md` | write | Rollback runbook |
| `docs/operations/PRODUCTION_SECRETS.md` | write | Secret lifecycle runbook |
| `docs/agents/plans/active/20260731T005306Z-3de45e-production-compose-traefik-and-deploy.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T005306Z-3de45e-production-compose-traefik-and-deploy.md` | write | Archived lifecycle |

### Remote mutation set

| Ресурс | Режим | Причина |
|---|---|---|
| GitHub `production-deploy` environment | create/configure | Main-only deploy gate |
| Optional deploy WIF SA/credential | create, no keys | Registry verification only |
| DNS zone/records/registrar NS | create/update | Production hostname |
| Lockbox metadata/version payload | create/update separately | Runtime secrets |
| Runtime IAM | exact additive role | Secret payload and registry pull |
| Production VM/release evidence | controlled file/user/systemd/Compose change | First app deploy and exact current/previous proof |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Image pair | WIF/images plan | dependency | Accept only verified digests |
| Health/migrations/Collector | readiness/OTel plan | dependency | Consume exact contracts |
| Production VM/data disk | foundation/backup/telemetry | this deploy plan | Root-owned serialized deploy lock |
| DNS/TLS/Traefik | security plan | this plan first | Exact P0 security hardening extends after archive; P1 is deferred |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 14:44:19 UTC.
- **Обнаруженные пересечения:** later telemetry, backup, security and docs
  plans consume the same production Compose/Terraform/roadmap files.
- **Решение:** strict dependency chain; this plan starts only after readiness/
  OTel archive. Domain/registrar/target DNS, secret inventory, scoped SSH,
  ACME handling and maintenance window are settled for this draft; live DNS,
  exact cloud plans and remote mutations still require evidence/approval.

## План реализации

1. [ ] Validate the recorded owner decisions with public NS/SOA/A evidence,
   secret-boundary tests, pinned SSH host identity and ACME staging preflight.
2. [ ] Define production Compose/Traefik/file-provider/secrets contracts and
   config tests.
3. [ ] Implement host bootstrap/deploy/release-evidence files and validate them
   against local fixtures only; do not mutate the production VM.
4. [ ] Implement Terraform/GitHub workflow definitions locally, then show the
   exact cloud/GitHub/DNS/Lockbox/IAM/SSH/VM mutation plan and obtain separate
   approvals for apply, registrar, payload and host-bootstrap actions.
5. [ ] Only after those approvals apply the non-secret graph, perform
   owner-gated NS/payload insertion and bootstrap the host.
6. [ ] Run first migration/deploy/ACME/TLS smoke only after separate rollout
   approval in the recorded maintenance window.
7. [ ] Perform failed-rollout, rollback and reboot-recovery drills.
8. [ ] Update runbooks/roadmap, verify/scope-check and archive.

## Проверки

- [ ] Production Compose config/schema and no-host-port assertions
- [ ] Image references contain exactly two `@sha256` values and no `latest`
- [ ] Secret/state/log negative scans
- [ ] Traefik route/TLS/redirect/security boundary tests
- [ ] Migration failure and readiness timeout abort deploy
- [ ] Internal database/game/web health smoke
- [ ] Public DNS/TLS/web/game API smoke
- [ ] Previous-pair rollback and incompatible-schema guard
- [ ] VM reboot recovery and listener audit
- [ ] Terraform fmt/validate/check + exact clean post-apply plans
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T005306Z-3de45e-production-compose-traefik-and-deploy`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** DNS/TLS propagation blocks launch. **Снижение:** preflight,
  low-TTL staged record, ACME staging, keep IP-based owner SSH.
- **Риск:** secret leaks into Terraform/logs. **Снижение:** payload outside
  state, root-only files, masked jobs and negative scans.
- **Риск:** deploy/migration leaves partial state. **Снижение:** host lock,
  explicit phases, atomic release marker and compatible last-known-good pair.
- **Риск:** automation gets root-equivalent Docker access. **Снижение:**
  no Docker group; allowlisted root-owned sudo command only.
- **Откат:** traffic stays/returns to previous compatible digest pair; disable
  deploy environment/WIF; DNS/Lockbox deletion requires separate destructive
  approval.

## Открытые вопросы

- Owner inputs settled for this draft: Timeweb owns `l1ttl3h0rse.ru`, Yandex
  Cloud DNS is the authoritative target, ACME uses an owner-side email and the
  first window is `2026-08-02 09:00–11:00 MSK`. The audit recommends mapping
  `munchkin.l1ttl3h0rse.ru` to reserved `81.26.187.230`, scoped deploy SSH,
  runtime-only secrets and ACME staging→production.
- Personal email, secret payloads and private keys are intentionally not
  recorded in this public plan; owner supplies them only through the runtime
  secret/configuration boundary.
- Remaining gates are evidence/mutation gates: current registrar delegation,
  authoritative NS/SOA/A responses, exact Terraform plans, GitHub environment
  protection, SSH serial/host-key proof and ACME staging smoke.
- Current DNS evidence is not ambiguous: Timeweb remains authoritative and the
  production hostname does not exist. Plan implementation must first obtain
  exact Yandex zone NS names, show the registrar NS mutation, wait propagation,
  verify via at least two recursive resolvers plus direct authoritative query,
  and only then request the production ACME certificate.

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
  Git, plan, chat или logs. Remote mutations, Terraform apply, изменение
  Timeweb NS, secret payload insertion, GitHub/Yandex settings, production VM
  bootstrap/deploy и платные/destructive actions не одобрены заранее:
  перед каждым таким этапом нужен sanitized exact mutation plan и отдельное
  approval. Owner email для ACME применяется только owner-side вне Git.

## Ход выполнения

- Base draft создан; remote mutation and evidence gates left explicit.
- 2026-08-01 owner decisions recorded without persisting email or secrets.
- 2026-08-01 public DNS audit recorded Timeweb delegation and production-host
  NXDOMAIN; no DNS/registrar mutation was performed.
- 2026-08-01 formal queue approval recorded with all remote-mutation gates
  above; implementation remains gated by readiness archive and separate
  mutation approvals.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
