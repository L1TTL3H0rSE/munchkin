# PLAN: yandex cloud network registry and compute

- **Plan ID:** `20260730T220518Z-84ffe4-yandex-cloud-network-registry-and-compute`
- **Статус:** completed
- **Создан:** 2026-07-30 22:05:18 UTC
- **Обновлён:** 2026-07-31 00:42:52 UTC
- **Владелец:** Codex `/root`
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; по указанию владельца отдельная ветка не создаётся
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260730T202601Z-070c10-yandex-cloud-terraform-state-migration-and-backend-activation`.
- **Блокирует:** `github-actions-yandex-images`,
  `production-compose-traefik-and-deploy`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`,
  Yandex Cloud Terraform bootstrap runbook

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "infra/terraform/bootstrap/main.tf",
    "infra/terraform/bootstrap/outputs.tf",
    "infra/terraform/bootstrap/.terraform/**",
    "infra/terraform/environments/production/main.tf",
    "infra/terraform/environments/production/variables.tf",
    "infra/terraform/environments/production/iam.tf",
    "infra/terraform/environments/production/network.tf",
    "infra/terraform/environments/production/registry.tf",
    "infra/terraform/environments/production/compute.tf",
    "infra/terraform/environments/production/cloud-init.yaml.tftpl",
    "infra/terraform/environments/production/outputs.tf",
    "infra/terraform/environments/production/.terraform/**",
    "infra/terraform/README.md",
    "scripts/terraform-check.sh",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md",
    "docs/agents/plans/active/20260730T220518Z-84ffe4-yandex-cloud-network-registry-and-compute.md",
    "docs/agents/plans/archive/20260730T220518Z-84ffe4-yandex-cloud-network-registry-and-compute.md"
  ],
  "components": [
    "repository-workflow",
    "terraform-infrastructure"
  ],
  "contracts": [],
  "dependsOn": [
    "20260730T202601Z-070c10-yandex-cloud-terraform-state-migration-and-backend-activation"
  ],
  "sharedResources": [
    "infra:yandex-cloud-production-v1",
    "cloud:yandex-folder:b1g55l8i2mtpv23b5ql7",
    "cloud:yandex-iam:munchkin-terraform-deployer",
    "cloud:yandex-iam:munchkin-runtime",
    "cloud:yandex-vpc:munchkin-prod",
    "cloud:yandex-container-registry:munchkin-prod",
    "cloud:yandex-compute:munchkin-prod",
    "cloud:yandex-object-storage:munchkin-prod-tfstate-b1g55l8i2mtpv23b5ql7/environments/production/terraform.tfstate"
  ]
}
```

## Цель

Без изменения application runtime создать первый production infrastructure
slice в Yandex Cloud: least-privilege identity boundary для Terraform/runtime,
VPC/subnet/security group/static IPv4, private Container Registry с
repositories `game`/`web`, одну Ubuntu 24.04 LTS Compute VM с отдельным
PostgreSQL data disk и versioned cloud-init host baseline. Production state
должен использовать уже подготовленный remote S3 backend и после apply давать
clean cloud-authenticated plan.

## Критерии приёмки

- [x] До mutation подтверждены clean `main`, отсутствие active plans/другого
  writer, zone `ru-central1-d` в статусе `UP`, ready Ubuntu 24.04 LTS image и
  отсутствие существующих network/subnet/security group/address/registry/
  instance/disk в production folder.
- [ ] Bootstrap root создаёт ровно один `munchkin-runtime` service account без
  static/authorized/API keys; existing deployer получает только
  `compute.editor`, `vpc.privateAdmin`, `vpc.publicAdmin`,
  `vpc.securityGroups.admin`, `container-registry.admin` на production folder
  и `iam.serviceAccounts.user` только на runtime service account.
- [ ] Bootstrap IAM apply выполняется только после отдельного review exact
  Terraform plan; follow-up bootstrap plan сообщает `No changes`, а existing
  state backend/IAM/KMS/bucket resources не меняются.
- [ ] Production backend инициализируется как новый empty remote state по exact
  key `environments/production/terraform.tfstate`: destination absence
  доказана до init, `-migrate-state`/`-force-copy` не используются,
  `use_lockfile = true`, credentials остаются только в process environment.
- [ ] Production graph создаёт ровно одну network, subnet
  `10.42.0.0/24`, normal security group, reserved IPv4, registry, repositories
  `game`/`web`, 20 GB `network-ssd` data disk и одну VM в
  `ru-central1-d`; unexpected pre-existing resource является stop condition.
- [ ] Ingress security group разрешает TCP `80`/`443` из `0.0.0.0/0` и TCP
  `22` только из explicit process-only owner CIDR list; `0.0.0.0/0` для SSH,
  IPv6 ingress, database/application/management ports и Docker API запрещены.
  Egress остаётся explicit `ANY` в `0.0.0.0/0`.
- [ ] Registry private; runtime service account получает только
  `container-registry.images.puller` на exact registry. Созданы два explicit
  repositories; image push/WIF, vulnerability scans и active lifecycle
  deletion policy остаются следующему plan после отдельной тарификации.
- [ ] VM использует current ready `ubuntu-2404-lts`, `standard-v3`,
  `2 vCPU`, core fraction `50%`, `4 GB RAM`, 35 GB `network-ssd` boot disk,
  attached non-auto-delete 20 GB data disk, reserved IPv4 и runtime service
  account; data disk защищён Terraform `prevent_destroy`.
- [ ] Cloud-init получает только sensitive process-only SSH public key,
  отключает SSH password/direct root login, не добавляет human/deploy user в
  root-equivalent Docker group, устанавливает Docker Engine/Compose plugin и
  unattended security updates, включает bounded Docker logs, idempotently
  форматирует/mонтирует data disk в `/srv/munchkin`, создаёт root-owned
  directories и success marker. Secret payload в metadata отсутствует.
- [x] Production apply запускается только после отдельного owner approval
  точного plan summary и повторного подтверждения estimate/budget; никакие
  `destroy`, import, `-target`, saved plan, `-auto-approve`, `-lock=false` или
  `force-unlock` не используются.
- [x] Post-apply проверены exact live inventory, remote state/address set,
  отсутствие stale `.tflock`, clean production plan и owner-side SSH evidence:
  `cloud-init status --wait`, Docker/Compose versions, mounted data disk,
  SSH/root/password boundary и отсутствие unexpected listeners.
- [x] README/runbook/roadmap отражают фактические resource IDs/outputs только
  если они несекретны, остающиеся gates и то, что CI/WIF/images,
  Compose/Traefik/DNS/Lockbox/backup/telemetry ещё не реализованы.
- [x] Focused Terraform checks, canonical verify, plan-lint, strict UTF-8,
  secret/artifact scan, diff review и scope-check проходят. Commit/push
  выполняются только по отдельной команде владельца.

## Контекст и подтверждённое состояние

- `main` clean и совпадает с `origin/main` merge commit `fb6125c` (PR #5).
  Active plans отсутствуют; отдельную ветку владелец попросил не создавать.
- Предыдущий completed plan активировал bootstrap S3 backend. Remote bootstrap
  state читается, clean plan доказан, local plaintext state/backup удалены.
  Production backend skeleton существует, но ещё не инициализирован.
- Production root пока содержит только pinned Terraform/provider, S3 backend и
  immutable cloud/folder/zone locals; production state/resource graph
  отсутствует.
- Live sanitized inventory от 2026-07-30 22:00 UTC: `ru-central1-d` имеет
  status `UP`; `ubuntu-2404-lts` image имеет status `READY` и minimum disk
  `10 GB`; network/subnet/security-group/address/registry/instance/disk counts
  равны `0`.
- Folder содержит только два service account: existing
  `munchkin-terraform-deployer` и `munchkin-terraform-state`.
  `munchkin-runtime` отсутствует. Deployer имеет direct
  `iam.serviceAccounts.tokenCreator` trust от operator, но folder roles `0`.
- Owner readiness фиксирует `2 vCPU / 4 GB / 50%`, SSD boot `35 GB`, SSD data
  `20 GB`, static IPv4, estimate около `3608 RUB/month` при ceiling
  `5000 RUB`, hostname `munchkin.l1ttl3h0rse.ru`, ready ED25519 key pair и
  `ru-central1-d`.
- Официальные Yandex Cloud docs подтверждают:
  `compute.editor` управляет VM/disks и включает `vpc.user`;
  public address требует `vpc.publicAdmin`; network/subnet —
  `vpc.privateAdmin`; normal security group —
  `vpc.securityGroups.admin`; registry IAM management —
  `container-registry.admin`; runtime pull —
  `container-registry.images.puller`; VM с service account требует
  `iam.serviceAccounts.user`.
- `standard-v3` поддерживает выбранные `2 vCPU`, `4 GB` и core fraction `50%`.
  Cloud-init metadata не шифруется, поэтому туда попадает только public key,
  но не private key, token, password, tfvars или runtime secret.

## Scope

### Входит

- Bootstrap runtime service account и exact additive deployer IAM members.
- Production VPC/subnet/security group/reserved IPv4.
- Private Container Registry, explicit `game`/`web` repositories и exact
  runtime pull member.
- Ubuntu Compute VM, boot/data disks, runtime service-account attachment.
- Sensitive variables для SSH public key и owner SSH CIDRs без committed
  values/tfvars.
- Versioned cloud-init template для host baseline и data-disk mount.
- Outputs, local deterministic Terraform validation, documentation и remote
  state/backend activation.
- Read-only inventories, exact plans, отдельно согласованные interactive
  bootstrap/production applies и post-apply verification.

### Не входит

- GitHub Actions parity, OIDC/WIF credential, image build/push/scan и CI IAM.
- Registry vulnerability scanner, active deletion/retention policy или image
  cleanup до отдельной pricing/rollback policy.
- Production Compose, Traefik, application images, database migration,
  readiness/public smoke и deploy/rollback script.
- DNS zone/records, registrar NS change, TLS/ACME.
- Lockbox containers/payload, backup bucket/KMS, telemetry resources.
- OS Login, automated deploy SSH credential, arbitrary Docker-group access или
  final root-owned deploy command boundary.
- IPv6, load balancer, NAT gateway, Managed PostgreSQL, Kubernetes,
  multi-zone/HA.
- Commit, push или PR.

## Архитектурный подход

### Два state/root этапа

1. **Bootstrap identity stage.** Existing operator-authenticated bootstrap root
   создаёт runtime identity и выдаёт existing deployer только роли, необходимые
   для следующего production graph. Это устраняет self-grant chicken-and-egg:
   deployer не назначает роли самому себе и не получает primitive folder-wide
   `editor`/`admin`.
2. **Production resource stage.** После clean bootstrap follow-up owner
   выпускает short-lived impersonated deployer token. Production root
   инициализирует новый remote S3 state без migration и создаёт только network,
   registry и compute graph.

Оба apply интерактивны, без saved plan и требуют отдельного owner approval
после показа sanitized exact add/change/destroy summary и address list.

### Identity boundary

- `munchkin-terraform-state` остаётся только backend identity.
- `munchkin-terraform-deployer` получает пять additive folder service roles и
  direct `iam.serviceAccounts.user` на exact runtime account.
- `munchkin-runtime` не получает static keys и attached к VM. На registry ему
  выдаётся единственный non-authoritative member
  `container-registry.images.puller`.
- CI pusher/scanner identities не создаются в этом plan.

### Network boundary

- Dedicated `munchkin-prod` network и one-zone subnet `10.42.0.0/24`.
- Normal security group, не takeover provider-created default group.
- Public TCP `80`/`443`; SSH только из sensitive explicit owner CIDRs.
- No IPv6, no public database/app/management ports. Egress explicit для package
  install, registry pull и будущего ACME.
- Reserved public address привязан к единственной VM network interface.

### Compute и cloud-init

- Public Ubuntu 24.04 LTS image выбирается data source по immutable family
  resolution на момент plan.
- Boot disk auto-delete вместе с VM; data disk отдельно управляется,
  `auto_delete = false`, `prevent_destroy = true`, deterministic
  `device_name = "munchkin-data"`.
- Cloud-init создаёт trusted human bootstrap user с owner public key и sudo,
  но не Docker-group membership; future automation deploy user/allowlisted
  root script принадлежит отдельному deployment plan.
- Root bootstrap script ожидает `/dev/disk/by-id/virtio-munchkin-data`,
  форматирует только диск без filesystem, монтирует по UUID и fail-closed при
  неожиданном existing filesystem/mount state. Docker daemon log rotation и
  unattended upgrades задаются declaratively.

### State и credential boundary

- Backend credential: existing
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` только process environment.
- Provider credential: fresh `YC_TOKEN`; bootstrap — operator, production —
  short-lived deployer impersonation.
- `TF_VAR_ssh_public_key` и `TF_VAR_ssh_ingress_cidrs` передаются только в
  owner process environment, помечены sensitive и не сохраняются в Git/tfvars/
  transcript. Public key неизбежно хранится в encrypted remote Terraform state
  и unencrypted VM metadata; private key никогда не передаётся Terraform.
- Raw state, full plan с sensitive values и cloud-init rendered payload не
  выводятся в transcript.

## Затронутые компоненты и контракты

| Компонент | Изменение | Public contract/данные |
|---|---|---|
| repository-workflow | Plan/docs и canonical Terraform assertions | Lifecycle/verification only |
| terraform-infrastructure | Bootstrap IAM и production network/registry/compute graph | Non-secret outputs для следующих plans |
| Yandex IAM | Deployer roles + runtime identity | No keys; exact role/member graph |
| Yandex VPC | Network/subnet/SG/address | Public ingress `22` restricted, `80/443` public |
| Container Registry | Registry + `game`/`web` repositories | Runtime pull only; CI push deferred |
| Compute Cloud | Ubuntu VM + boot/data disks + cloud-init | Static IPv4, SSH owner boundary |
| Object Storage backend | Новый production state/lock object | Exact key only; no bootstrap state change |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `infra/terraform/bootstrap/main.tf` | write | Runtime SA и deployer roles |
| `infra/terraform/bootstrap/outputs.tf` | write | Runtime/deployer handoff IDs |
| `infra/terraform/bootstrap/.terraform/**` | generated | Existing ignored backend/provider metadata |
| `infra/terraform/environments/production/main.tf` | write | Immutable locals/labels |
| `infra/terraform/environments/production/variables.tf` | write | Sensitive owner-only inputs |
| `infra/terraform/environments/production/iam.tf` | write | Runtime lookup и registry pull member |
| `infra/terraform/environments/production/network.tf` | write | VPC/subnet/SG/address |
| `infra/terraform/environments/production/registry.tf` | write | Registry/repositories |
| `infra/terraform/environments/production/compute.tf` | write | Image/disk/VM graph |
| `infra/terraform/environments/production/cloud-init.yaml.tftpl` | write | Versioned host baseline |
| `infra/terraform/environments/production/outputs.tf` | write | Non-secret downstream handoff |
| `infra/terraform/environments/production/.terraform/**` | generated | Ignored production backend/provider metadata |
| `scripts/terraform-check.sh` | write | Exact IAM/network/registry/compute/cloud-init assertions |
| `infra/terraform/README.md` | write | Resource/state/credential boundary |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | Actual INFRA-003 status/non-goals |
| `docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md` | write | Owner commands/evidence/next gates |
| `docs/agents/plans/active/20260730T220518Z-84ffe4-yandex-cloud-network-registry-and-compute.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260730T220518Z-84ffe4-yandex-cloud-network-registry-and-compute.md` | write | Archived lifecycle |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| Existing bootstrap remote state | update | Записать runtime SA и deployer IAM resources |
| Production state key/lock | create/read/ephemeral lock | Новый authoritative production state |
| Production folder IAM | additive members | Exact deployer service roles |
| Runtime service account | create | VM identity without keys |
| VPC/subnet/SG/address | create | Single-host network boundary |
| Registry/repositories/IAM member | create | Future immutable images + runtime pull |
| VM/boot disk/data disk | create | Paid production host foundation |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Terraform deployer/state bucket | completed bootstrap/migration plans | bootstrap root | Bootstrap IAM first; backend graph unchanged |
| Production state key | future all production Terraform plans | production root | Empty init once, then serialized locked plans |
| Registry/repositories | `github-actions-yandex-images` | this plan | Create foundation first; CI later adds pusher/scanner |
| VM/static IP/data disk | Compose/deploy/backup/telemetry plans | this plan | Create stable host first; later plans consume outputs |
| Public ports | Compose/Traefik plan | this plan owns SG | Open only 80/443/owner SSH; app ports stay private |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 22:05:18 UTC через `leinoctl context`;
  active plans отсутствуют.
- **Обнаруженные пересечения:** только completed migration plan и future
  roadmap consumers.
- **Решение:** plan exclusive; отдельная ветка не создаётся по указанию
  владельца. Следующие plans начинаются после archive этого plan.

## План реализации

1. [x] Получить exact approval этого plan, записать формулировку, перевести в
   `in_progress` и выбрать через `leinoctl plan select`.
2. [x] Добавить runtime SA, exact deployer folder roles и direct runtime-SA
   user member в bootstrap root; расширить deterministic checks.
3. [x] Реализовать production variables, runtime lookup, VPC/subnet/SG/static
   IP, private registry/repositories/puller, Ubuntu VM/data disk/cloud-init и
   non-secret outputs.
4. [x] Обновить README/runbook/roadmap ожидаемым graph и staged mutation gates;
   выполнить fmt, validate, plan-lint, tests и secret/artifact scan.
5. [x] Повторить sanitized live absence/IAM/zone/image inventory. Получить
   process-only operator/provider/backend credentials и owner SSH inputs.
6. [x] Выполнить bootstrap cloud plan без `-target`, показать exact summary/
   addresses и отдельно получить approval на interactive bootstrap apply.
7. [x] Выполнить approved bootstrap apply, post-apply IAM inventory и
   обязательный full clean bootstrap plan.
8. [x] Доказать absence exact production state key; выполнить production
   `terraform init` без migration flags и проверить backend metadata без
   credentials.
9. [x] Выполнить production plan с impersonated deployer token, lock timeout и
   sensitive process-only inputs; показать exact summary/addresses, проверить
   estimate/budget и отдельно получить approval на interactive apply.
10. [x] Выполнить approved production apply. При partial/error не destroy и не
    повторять вслепую: сохранить remote state, собрать sanitized inventory и
    отдельно согласовать recovery.
11. [x] Проверить live resource graph, remote state/lock, clean production plan
    и owner-side SSH/cloud-init/Docker/disk/security evidence.
12. [x] Записать фактические IDs/результаты без secrets, обновить docs,
    выполнить canonical verify/diff/text/scope-check.
13. [x] Поставить `completed`, перенести plan в archive. Commit/push — только по
    отдельной команде владельца.

## Проверки

- [x] `git status --short`, `git diff --check`, strict UTF-8/mojibake scan.
- [x] `terraform version` = `1.15.8`.
- [x] `terraform fmt -check -recursive infra/terraform`.
- [x] `scripts/terraform-check.sh`: isolated `init -backend=false`, validate,
  multi-platform lockfiles и exact new IAM/network/registry/compute/cloud-init
  assertions.
- [x] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs`.
- [x] `(cd tools/leinoctl && node --test)`.
- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl preflight` с declared Node 24/Git Bash toolchain.
- [x] Read-only live preflight: zone/image ready; exact conflicting resource
  counts `0`; deployer current folder roles `0`; runtime SA absent.
- [x] Bootstrap plan: ожидается только `7 add / 0 change / 0 destroy`:
  runtime SA, five folder IAM members, one runtime-SA user member.
- [x] Bootstrap post-apply inventory/clean plan; existing 9 bootstrap resource
  addresses unchanged plus exact 7 new addresses.
- [x] Production destination HEAD/remote probe подтверждает отсутствие state
  до init; `.tflock` отсутствует после каждой команды.
- [x] Production plan: ожидается только `10 add / 0 change / 0 destroy`:
  network, subnet, SG, address, registry, 2 repositories, pull member, data
  disk, VM.
- [x] Production post-apply remote state содержит exact 10 managed resource
  addresses и 2 ожидаемых data-source addresses; plan возвращает
  `0`/`No changes`.
- [x] Live Yandex inventory совпадает с HCL; runtime SA не имеет keys и имеет
  только exact registry pull access.
- [x] Owner SSH verification: host-key сверка с serial output, key login,
  `cloud-init status --wait`, root/password denial, Docker/Compose versions,
  `/srv/munchkin` on separate disk, daemon log limits, expected listeners.
- [x] High-confidence credential/state/artifact scan: `0`; backend/state/
  tfvars/saved plan не tracked.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260730T220518Z-84ffe4-yandex-cloud-network-registry-and-compute`.

## Риски и откат

- **Риск:** платные VM/disks/static IP/registry создаются при неверном budget.
  **Снижение:** текущий estimate `~3608 RUB/month` ниже ceiling `5000`, но
  owner повторно подтверждает calculator/budget непосредственно перед apply;
  scanner/telemetry/backup classes не добавляются.
- **Риск:** deployer получает лишние полномочия. **Снижение:** service roles
  перечислены exact; primitive `editor/admin`, folder IAM admin, keys и runtime
  secret access запрещены. Bootstrap plan обязан содержать только 7 adds.
- **Риск:** IAM propagation даст partial apply. **Снижение:** bootstrap и
  production разделены clean follow-up plan; после ошибки state не правится и
  ресурсы не удаляются вручную.
- **Риск:** existing out-of-band resource будет принят за новый. **Снижение:**
  preflight inventory требует zero counts; любое совпадение имени/класса
  останавливает plan до import/adoption decision.
- **Риск:** broad SSH ingress или leaked owner IP/key. **Снижение:** SSH CIDRs
  required+sensitive и запрещают `0.0.0.0/0`; public key sensitive, process-only
  и не коммитится. Private key никогда не передаётся.
- **Риск:** cloud-init failure оставит оплачиваемую, но неготовую VM.
  **Снижение:** success marker, serial/cloud-init evidence и fail-closed disk
  script; no app deploy. При failure VM/state сохраняются, новый plan решает
  repair/recreate.
- **Риск:** data disk потерян при VM replacement/destroy. **Снижение:**
  standalone disk, `auto_delete=false`, `prevent_destroy`; destructive recovery
  только отдельным plan.
- **Риск:** registry retention удалит rollback image. **Снижение:** lifecycle
  deletion/scanning deferred; repositories initially empty.
- **Риск:** production backend перезапишет state. **Снижение:** exact absence
  probe, init без migration/force, process-only S3 credential, lock timeout.
- **Откат до apply:** удалить repository draft changes в рамках этого plan.
- **Откат после apply:** автоматический destroy запрещён. Остановиться, снять
  sanitized inventory/plan; additive IAM можно отдельно revoke, paid stateless
  resources — удалить только reviewed recovery plan, data disk/static IP
  сохранять до явного решения.

## Открытые вопросы и owner gates

- До cloud plan владелец задаёт в credentialed PowerShell, не в chat/Git:
  `TF_VAR_ssh_public_key` из existing `.pub` и
  `TF_VAR_ssh_ingress_cidrs` как exact current owner CIDR list.
- Перед bootstrap apply нужен отдельный approval exact `7 add` plan.
- Перед production apply нужен отдельный approval exact `10 add` plan и
  подтверждение, что estimate/ceiling всё ещё приемлемы.
- Если `ru-central1-d`, Ubuntu family или VM platform/quota drift обнаружатся
  на plan, zone/image/platform не подменяются автоматически: scope/risk
  повторно согласуются.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-30 22:06:56 UTC
- **Подтверждено:** 2026-07-30 22:23:30 UTC
- **Формулировка/ограничения пользователя:** после показа exact plan
  `20260730T220518Z-84ffe4-yandex-cloud-network-registry-and-compute`
  пользователь ответил: «Делай». Ранее указано: «ветку можешь не создавать».
  Это разрешает repository implementation на `main`. Каждый cloud apply
  остаётся отдельным owner gate после показа exact Terraform plan.
  Commit/push не разрешены.

## Ход выполнения

- Repository clean на `main` `fb6125c`; active plans отсутствуют.
- `repository-workflow-change` skill, `docs/agents/README.md`,
  `docs/agents/HARNESS.md`, ADR-0009, infrastructure roadmap, bootstrap
  runbook, current Terraform roots/component checks и completed dependency
  plan прочитаны.
- Live read-only inventory и official provider/service docs проверены; secrets
  и raw state не выводились.
- Draft создан и заполнен после исследования; HCL/cloud mutation не начаты,
  отдельная branch не создавалась.
- Exact plan согласован пользователем 2026-07-30 22:23:30 UTC; status
  переведён в `in_progress`.
- Новая trusted session 2026-07-30 приняла lifecycle через explicit
  `plan select --takeover`; baseline остался на `main` `fb6125c`, branch не
  создавалась.
- Bootstrap root реализует runtime SA, exact пять deployer folder roles и
  direct runtime-SA user member. Production root содержит exact десять
  resources, sensitive SSH inputs, Ubuntu 24.04 LTS VM/data disk и versioned
  cloud-init. Provider `0.220.0` использует authoritative
  `yandex_container_registry_iam_binding`, потому что additive registry member
  resource отсутствует; binding содержит только runtime puller.
- `terraform-check.sh` прошёл: три roots valid, Windows/Linux lockfiles
  reproducible, exact IAM/network/registry/compute/cloud-init assertions
  зелёные. `terraform fmt -check`, `git diff --check`, text-check и plan-lint
  прошли.
- Declared Node `24.14.0`/Git Bash `5.2.37` проверки прошли:
  hooks `42/42`, leinoctl `63 passed / 1 platform-permission skip`.
  `leinoctl preflight` вернул `ok`; warnings о pnpm probe и неактивном Docker
  Desktop не входят в Terraform component gate.
- Sanitized live preflight 2026-07-30 22:44 UTC подтвердил:
  `ru-central1-d=UP`, `ubuntu-2404-lts=READY`
  (`fd83ergat2e815oohe7o`), network/subnet/security-group/address/registry/
  instance/disk counts `0`, runtime SA absent, deployer folder roles `0`.
- В новой session отсутствуют process-only `YC_TOKEN`,
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, `TF_VAR_ssh_public_key` и
  `TF_VAR_ssh_ingress_cidrs`. Cloud init/plan/apply не запускались; следующий
  шаг остановлен до безопасной повторной передачи owner inputs.
- Canonical `leinoctl verify --changed` прошёл для
  `repository-workflow`/`terraform-infrastructure`; high-confidence secret
  scan вернул `0`, финальный scope snapshot содержит `outsideWriteSet: []`,
  required checks без missing/stale.
- Владелец передал credentials/SSH inputs только в собственное PowerShell
  process environment и не раскрывал значения в chat/Git/files. Bootstrap
  plan выполнен владельцем без saved plan/`-target`: exit `2`, exact
  `7 add / 0 change / 0 destroy`. Address list содержит только runtime SA,
  runtime-SA user member и пять reviewed deployer folder members. Clipboard
  после команды очищен; apply не запускался.
- После показа exact bootstrap plan владелец 2026-07-30 23:23 UTC ответил
  «да», отдельно разрешив interactive bootstrap apply только этих семи
  additions. Production apply этим approval не разрешён.
- Interactive bootstrap apply завершился exit `0`:
  `7 added / 0 changed / 0 destroyed`. Runtime service account получил
  non-secret ID `aje84i3qaj2dhkr9q28l`; existing deployer/state/KMS/bucket
  outputs не изменились.
- Sanitized post-apply IAM inventory подтвердил три service accounts, exact
  пять deployer folder roles, один direct
  `iam.serviceAccounts.user` binding на runtime SA и `0` runtime static access
  keys, API keys и authorized keys. Полный clean bootstrap plan ещё требуется
  до закрытия шага 7.
- Обязательный post-apply bootstrap plan завершился exit `0` и
  `No changes. Your infrastructure matches the configuration.` Bootstrap
  `.tflock` освобождён штатным завершением команды; шаг 7 закрыт.
- До production init owner-side S3 `HeadObject` вернул exact absence для
  `environments/production/terraform.tfstate` и соответствующего `.tflock`:
  обе команды exit `1`, `NotFound=True`. Init/migration/copy к этому моменту
  не выполнялись.
- Первый production `terraform init` завершился exit `0` и успешно
  сконфигурировал S3 backend без migration/copy/reconfigure flags. Ignored
  local backend metadata совпадает с exact bucket/key/region,
  `use_lockfile=true`; non-empty credential fields отсутствуют.
- Production plan выполнен с fresh impersonated deployer token, sensitive
  owner inputs и lock timeout, без saved plan/`-target`: exit `2`, exact
  `10 add / 0 change / 0 destroy`. Address list совпал с approved network,
  registry/repositories/puller, data disk и VM graph.
- Непосредственный read-only pre-apply inventory повторно подтвердил
  `ru-central1-d=UP`, тот же READY Ubuntu image
  `fd83ergat2e815oohe7o` и zero counts для network/subnet/SG/address/registry/
  instance/disk. Production apply ещё не разрешён.
- После показа exact production plan владелец 2026-07-30 23:53 UTC отдельно
  подтвердил estimate `3607.88 RUB/month` при ceiling `5000` и разрешил
  interactive production apply exact `10 add / 0 change / 0 destroy`.
  Approval не разрешает drift, destroy, recovery retry или дальнейшие
  production slices.
- Interactive production apply завершился exit `0`:
  `10 added / 0 changed / 0 destroyed`. Non-secret outputs:
  registry `crpdnmjudj1usiu90gdn`, VM `fv4eule47h2vqo5ki48k`,
  network `enp09n6lb1l950ief4dt`, subnet `fl8o10ih9ftnqab0qrj5`,
  security group `enpc8ecqfqoh0puiu2ne`, reserved IPv4
  `81.26.187.230`, data disk `fv4e2cgc448a00vkhps8` и runtime SA
  `aje84i3qaj2dhkr9q28l`.
- Sanitized post-apply inventory подтвердил exact HCL graph: network/subnet
  в `ru-central1-d`, security group и registry `ACTIVE`, reserved address
  `fl810u2k1qqnqmclgmhf` reserved/used, VM `RUNNING` на `standard-v3`
  (`2 vCPU`, `50%`, `4 GB`) с exact runtime SA, static IPv4, subnet/SG,
  boot auto-delete и одним secondary disk; data disk `READY`,
  `network-ssd`, `20 GB`.
- Security group содержит только explicit IPv4 rules: egress `ANY` в
  `0.0.0.0/0`, ingress TCP `80`/`443` в `0.0.0.0/0` и TCP `22` в одном
  owner CIDR; world-open SSH и IPv6 rules отсутствуют. Runtime SA имеет
  `0` static/API/authorized keys; registry binding содержит только
  `container-registry.images.puller` для runtime SA.
- Exact repository reads подтвердили
  `crpdnmjudj1usiu90gdn/game` (`crp2tm85r10u9b14u2c7`) и
  `crpdnmjudj1usiu90gdn/web` (`crprdveen1lmpb6vfb0q`). Empty registry list
  не использовался как доказательство отсутствия repositories.
- Full post-apply production plan под fresh impersonated deployer token
  завершился exit `0`:
  `No changes. Your infrastructure matches the configuration.`
  Remote state list содержит exact десять managed resource addresses и два
  ожидаемых data-source addresses:
  `data.yandex_compute_image.ubuntu` и
  `data.yandex_iam_service_account.runtime`.
- Signed S3 `HEAD` после clean plan вернул `200` для
  `environments/production/terraform.tfstate` и `404` для соответствующего
  `.tflock`; state существует, stale lock отсутствует, содержимое state не
  читалось и credentials не выводились.
- Owner-side SSH verification сверила три fingerprints и три public host keys
  с authenticated serial output, создала temporary `known_hosts` и сохранила
  `StrictHostKeyChecking=yes`. Windows OpenSSH `ssh-keyscan` оказался
  несовместим с выбранным KEX; это не меняло server/network state, а
  authenticated serial keys затем проверялись самим SSH transport.
- Key login под `munchkin-admin` прошёл через Git OpenSSH с интерактивным
  passphrase для owner private key. `cloud-init=done`, success marker есть,
  Docker `29.1.3` и Compose `2.40.3` active/enabled, `/dev/vdb` смонтирован
  как `ext4` в `/srv/munchkin` с `nosuid,nodev`; log limits и root-owned
  directory permissions совпали с template.
- Effective SSH hardening подтверждён. Admin groups:
  `munchkin-admin adm`, без `docker`; direct root и password-only attempts
  завершились exit `255`/`Permission denied (publickey)`. Wildcard TCP
  listeners — только `0.0.0.0:22` и `[::]:22`; остальные listeners
  loopback-only.

## Итог

План завершён: bootstrap IAM apply создал exact `7` resources, production
apply — exact `10` resources без changes/destroy. Созданы keyless runtime
identity, reviewed deployer roles, VPC/subnet/security group/reserved IPv4,
private Container Registry с repositories `game`/`web`, Ubuntu production VM
и защищённый standalone data disk. Production remote state активен,
содержит десять managed resources и два ожидаемых data sources; post-apply
plan вернул `No changes`, stale `.tflock` отсутствует.

Live inventory совпал с Terraform. Owner-side SSH evidence подтвердил pinned
host keys, key login, `cloud-init=done`, active Docker/Compose, отдельный
`ext4` mount `/srv/munchkin` с `nosuid,nodev`, bounded Docker logs,
root/password denial, отсутствие membership в `docker` group и отсутствие
externally bound TCP listeners кроме SSH. Credentials, private key, raw state
и saved plans в repository не записывались.

Focused Terraform checks и canonical verify прошли: hooks `42/42`, leinoctl
`63 passed / 1 platform-permission skip`, plan-lint без issues,
`terraform-check: ok`, strict text/diff/secret checks чистые. README, runbook и
roadmap содержат non-secret outputs и явно оставляют CI/WIF/images,
Compose/Traefik, DNS/TLS, Lockbox, backup, reboot recovery и telemetry
следующим отдельным plans. План имеет статус `completed` и находится в
archive. Repository implementation ранее закоммичена владельцем в `14790f6`;
эта финальная правка plan-файла остаётся незакоммиченной по прямому указанию
владельца.
