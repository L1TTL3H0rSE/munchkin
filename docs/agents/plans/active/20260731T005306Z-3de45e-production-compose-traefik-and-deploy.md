# PLAN: production Compose, Traefik, DNS, TLS and controlled deploy

- **Plan ID:** `20260731T005306Z-3de45e-production-compose-traefik-and-deploy`
- **Статус:** draft
- **Создан:** 2026-07-31 00:53:06 UTC
- **Обновлён:** 2026-07-31 01:02:00 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
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
    "infra/compose/**",
    "infra/terraform/bootstrap/github_actions.tf",
    "infra/terraform/bootstrap/outputs.tf",
    "infra/terraform/environments/production/dns.tf",
    "infra/terraform/environments/production/iam.tf",
    "infra/terraform/environments/production/lockbox.tf",
    "infra/terraform/environments/production/outputs.tf",
    "infra/terraform/environments/production/variables.tf",
    "infra/terraform/README.md",
    "scripts/production/**",
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
    "delivery:immutable-image-pair-v1"
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
  ownership и registrar mutation подтверждаются отдельно. TLS public smoke
  проверяет certificate chain, hostname и expiry.
- [ ] Lockbox metadata/ACL могут управляться Terraform, но secret payload,
  database password, deploy private key и ACME account data не попадают в
  Terraform state/Git. Payload создаётся/rotates owner-side через отдельный
  runbook.
- [ ] Host получает secrets через instance-attached keyless runtime identity
  либо другой заранее одобренный short-lived mechanism; static Yandex cloud
  keys на VM/GitHub запрещены.
- [ ] Automation deploy user не входит в `docker` group, не имеет general root
  shell и может через pinned SSH host key/sudo запустить только root-owned
  allowlisted deploy/status/rollback commands.
- [ ] GitHub deploy job работает только через protected
  `production-deploy`, main/full-SHA release pair and concurrency lock.
  Cloud access, если нужен registry verification, только через отдельный exact
  WIF subject/least-privilege SA; static cloud keys отсутствуют.
- [ ] Deploy state хранит current/previous digest pair atomically. Rollback не
  откатывает database schema вслепую и использует только совместимый previous
  image pair.
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
   authenticated serial evidence. Scoped SSH deploy credential is not a cloud
   key, but its storage/rotation requires explicit owner approval.
4. Terraform manages only non-secret DNS/Lockbox/IAM metadata. Secret payload
   and registrar changes are independent owner gates.

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
| `infra/compose/**` | write | Traefik/Compose runtime config |
| `infra/terraform/bootstrap/github_actions.tf` | write | Optional exact deploy WIF identity |
| `infra/terraform/bootstrap/outputs.tf` | write | Deploy identity outputs |
| `infra/terraform/environments/production/dns.tf` | write | DNS zone/records |
| `infra/terraform/environments/production/iam.tf` | write | Runtime/deploy least privilege |
| `infra/terraform/environments/production/lockbox.tf` | write | Secret metadata/access |
| `infra/terraform/environments/production/outputs.tf` | write | Non-secret deploy handoff |
| `infra/terraform/environments/production/variables.tf` | write | Non-secret/sensitive inputs |
| `infra/terraform/README.md` | write | Root/state/credential documentation |
| `scripts/production/**` | write | Host install/deploy/status/rollback/smoke |
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
| Production VM | controlled file/user/systemd/Compose change | First app deploy |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Image pair | WIF/images plan | dependency | Accept only verified digests |
| Health/migrations/Collector | readiness/OTel plan | dependency | Consume exact contracts |
| Production VM/data disk | foundation/backup/telemetry | this deploy plan | Root-owned serialized deploy lock |
| DNS/TLS/Traefik | security/P1 plans | this plan first | Later hardening extends after archive |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 01:02:00 UTC.
- **Обнаруженные пересечения:** later telemetry, backup, security and docs
  plans consume the same production Compose/Terraform/roadmap files.
- **Решение:** strict dependency chain; this plan starts only after readiness/
  OTel archive. Exact DNS, secret and SSH choices require scope revalidation
  before approval.

## План реализации

1. [ ] Resolve owner gates: hostname/zone/registrar, secret inventory,
   deploy identity/SSH rotation, ACME email/staging and rollback window.
2. [ ] Define production Compose/Traefik/file-provider/secrets contracts and
   config tests.
3. [ ] Implement root-owned host deploy boundary and idempotent bootstrap.
4. [ ] Implement Terraform DNS/Lockbox/IAM metadata; show exact plans and
   obtain separate approvals for each cloud/DNS mutation.
5. [ ] Implement protected GitHub deploy workflow using digest pair and pinned
   host identity.
6. [ ] Run first migration/deploy/TLS smoke only after separate owner approval.
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

- Final domain/zone authority and registrar workflow.
- Exact production secret list and owner-side payload insertion/rotation.
- Scoped deploy SSH credential vs an approved short-lived SSH mechanism.
- ACME email/rate-limit policy and maintenance window.
- These must be resolved and reflected in an updated exact plan before approval.

## Согласование

- **Статус:** not requested; prerequisite draft
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** заранее создать базовые plans по
  infrastructure roadmap; unfinished base is acceptable. No static cloud keys.
  Select/implementation/commit/push не разрешены.

## Ход выполнения

- Base draft создан; unresolved owner/cloud gates deliberately left explicit.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
