# Подготовка Yandex Cloud к Terraform-развёртыванию

- **Назначение:** действия владельца проекта до первого infrastructure plan.
- **Платформа владельца:** Windows 10/11, PowerShell.
- **Проверено по официальной документации:** 2026-07-30.
- **Архитектурное решение:** [ADR-0009](../agents/decisions/0009-yandex-cloud-terraform-production.md).
- **Важно:** эта инструкция подготавливает доступы и решения. Она не создаёт
  production VM, сеть, registry, DNS-зону или database.

## Что должно получиться

После выполнения инструкции у вас будут:

- active Yandex Cloud billing;
- отдельные cloud и folder для production;
- budget notifications;
- выбранные zone, domain и monthly budget ceiling;
- рабочий локальный `yc` profile;
- установленный Terraform;
- отдельная SSH public key для initial human access;
- подтверждённый доступ к GitHub Actions;
- безопасный handoff из несекретных значений.

После этого Codex сможет подготовить отдельный согласуемый plan и начать
писать Terraform. До такого plan не создавайте платные runtime resources.

## Целевая стартовая схема

```text
GitHub Actions
  -> Yandex IAM Workload Identity Federation
  -> Container Registry
  -> controlled deploy

Cloud DNS
  -> static IPv4
  -> Compute VM
       -> Traefik
       -> Nuxt frontend
       -> Go backend
       -> PostgreSQL
       -> OpenTelemetry Collector

Object Storage
  -> Terraform state bucket
  -> PostgreSQL backup bucket

Lockbox
  -> runtime secret containers
```

Стартовый профиль намеренно не включает Managed PostgreSQL, Kubernetes,
Application Load Balancer, CDN, Valkey, Kafka или другие data clusters.

## Правила безопасности

Никогда не отправляйте в Git, issue, plan, chat, screenshot или command output:

- OAuth/IAM token;
- authorized-key JSON сервисного аккаунта;
- S3 access secret;
- private SSH key;
- GitHub PAT;
- password, DSN, `.env` или Lockbox payload;
- `.tfstate`, saved Terraform plan или содержимое `.terraform/`;
- содержимое `%USERPROFILE%\.config\yandex-cloud`.

Можно передавать:

- `cloud_id`, `folder_id` и выбранную zone;
- имя cloud/folder;
- domain/hostname;
- GitHub `owner/repository`;
- SSH **public** key из файла `.pub`;
- monthly budget ceiling и выбранные thresholds.

Если secret случайно появился в terminal log или сообщении, остановитесь:
не продолжайте provisioning и сначала отзовите/перевыпустите credential.

## Шаг 0. Зафиксировать решения

До открытия консоли заполните:

| Решение | Рекомендуемый default | Ваше значение |
|---|---|---|
| Cloud name | `munchkin-prod` | `munchkin` |
| Folder name | `munchkin-prod` | `munchkin-prod` |
| Zone | `ru-central1-d`, если доступна | `ru-central1-d` (`UP` на 2026-07-30) |
| Monthly budget ceiling | не меньше подтверждённого calculator estimate | `5000 RUB` |
| Budget thresholds | `50%`, `80%`, `100%` | `50%`, `80%`, `100%` |
| Database profile | `local-postgres` | `local-postgres` |
| Domain zone | существующий или новый domain | `l1ttl3h0rse.ru` |
| Root hostname | будущая визитка | `l1ttl3h0rse.ru` |
| Production hostname | один hostname, например `game.example.ru` | `munchkin.l1ttl3h0rse.ru` |
| Domain registrar | внешний registrar | Timeweb |
| Authoritative DNS | Yandex Cloud DNS после Terraform zone | Yandex Cloud DNS |
| GitHub repository | `L1TTL3H0rSE/munchkin` | `L1TTL3H0rSE/munchkin` |
| Human SSH access | отдельный ED25519 key с passphrase | создан; private key не передавался |
| OS Login | `not-now`; оценить в host-security plan | `not-now` |

Budget является notification boundary, а не hard limit: достижение порога само
по себе не останавливает VM или другие ресурсы. Если максимальная допустимая
сумма неизвестна, остановитесь и сначала определите её.

Этот runbook намеренно не задаёт универсальную сумму в рублях: до выбора
размера VM, дисков и retention она была бы невоспроизводимой. Перед фиксацией
ceiling сохраните датированный расчёт из актуального
[калькулятора Yandex Cloud](https://yandex.cloud/ru/prices) и запишите:

- vCPU, RAM и core fraction VM;
- тип и размер boot/data disks;
- static public IPv4;
- объём Container Registry и ожидаемый image egress;
- Object Storage state/backup объёмы, операции и egress;
- KMS/Lockbox usage;
- telemetry/log volume и retention;
- ожидаемый public traffic.

Monthly ceiling должен быть не ниже этого estimate и включать явно выбранный
reserve. Если хотя бы один параметр ещё неизвестен, используйте conservative
upper assumption и пометьте его для проверки в implementation plan.

### Зафиксированное состояние на 2026-07-30

- Calculator VM profile: `2 vCPU`, core fraction `50%`, `4 GB RAM`.
- Disks: network SSD boot `35 GB`, network SSD PostgreSQL data `20 GB`.
- Network: static public IPv4 и `100 GB/month` public outbound traffic.
- Object Storage: `1 GB` standard для state и `20 GB` cold для backup.
- KMS/Lockbox assumption: `2` keys и `10 000` operations.
- Calculator estimate: `3295.44 RUB/month`; вручную учтённые позиции:
  `312.44 RUB/month`; conservative estimate: около `3608 RUB/month`.
- Monthly budget ceiling: `5000 RUB`, то есть выше estimate с reserve.
- Платёжная карта привязана; внутренний баланс не пополнялся. Это не является
  hard spending limit: budget только отправляет уведомления, а списания
  зависят от billing model и привязанного способа оплаты.
- Budget создан для `munchkin` / `munchkin-prod` с thresholds
  `50%`, `80%`, `100%`.

## Шаг 1. Подготовить Yandex account, billing, cloud и folder

### 1.1 Account и billing

1. Откройте [Yandex Cloud Console](https://console.cloud.yandex.ru/) и войдите
   под account, которым будете владеть production.
2. Откройте [Yandex Cloud Billing](https://center.yandex.cloud/).
3. Создайте либо выберите платёжный аккаунт.
4. Убедитесь, что его статус — `ACTIVE` или `TRIAL_ACTIVE`.
5. Не отправляйте номер карты, payment details или billing account ID в handoff.

Если trial закончился, используйте официальную инструкцию
[активации платной версии](https://yandex.cloud/ru/docs/billing/operations/activate-commercial).

### 1.2 Отдельный cloud

Создайте отдельный cloud с выбранным именем, рекомендуемый default:
`munchkin-prod`.

Официальная инструкция:
[создать cloud](https://yandex.cloud/ru/docs/resource-manager/operations/cloud/create).

Привяжите cloud к active billing account. Cloud/folder должны принадлежать
тому же account/organization, доступ к которым вы сохраните после конкурса.

### 1.3 Отдельный folder

Внутри cloud создайте folder `munchkin-prod`.

**Снимите флаг «Создать сеть по умолчанию».** Default network создаёт сеть,
подсети и permissive default security group вне Terraform. Это сразу даёт
drift/import работу.

Официальная инструкция:
[создать folder](https://yandex.cloud/ru/docs/resource-manager/operations/folder/create).

Если default network уже появилась, не удаляйте её вслепую. Остановитесь и
сообщите её имя/ID без токенов: следующий plan решит, импортировать или
безопасно удалить её после проверки зависимостей.

### 1.4 Budget notifications

В Billing:

1. Откройте платёжный аккаунт.
2. Перейдите в **Бюджеты** и нажмите **Создать бюджет**.
3. Выберите тип **К оплате**.
4. Scope ограничьте cloud `munchkin` / folder `munchkin-prod`.
5. Укажите monthly budget ceiling из шага 0.
6. Добавьте основной account в recipients.
7. Создайте thresholds `50%`, `80%`, `100%`; при необходимости добавьте
   фиксированный денежный threshold ниже потолка.

Официальные материалы:

- [настройка budget notifications](https://yandex.cloud/ru/docs/billing/operations/budgets);
- [что такое budget](https://yandex.cloud/ru/docs/billing/concepts/budget).

После создания убедитесь, что scope не включает случайно все ваши clouds.

## Шаг 2. Подготовить domain

Yandex Cloud DNS размещает DNS zone, но domain регистрируется у внешнего
registrar.

Нужно:

1. Иметь domain и доступ к панели registrar либо записать domain как
   prerequisite, который будет куплен до public DNS/TLS slice.
2. Выбрать production hostname. Для проекта нужен один hostname для UI и API,
   например `game.example.ru`.
3. Записать текущие DNS records domain, особенно MX/TXT/CNAME, если domain уже
   используется.
4. Проверить доступ к изменению NS records.

Для текущего production зафиксировано:

- registrar: Timeweb;
- domain zone: `l1ttl3h0rse.ru`;
- root hostname будущей визитки: `l1ttl3h0rse.ru`;
- application hostname: `munchkin.l1ttl3h0rse.ru`;
- текущие NS остаются у Timeweb до создания public zone и records через
  Terraform;
- после Terraform apply domain будет делегирован на Yandex Cloud DNS.

Пока не:

- создавайте Cloud DNS zone вручную;
- меняйте NS у registrar;
- удаляйте существующие records;
- создавайте `AAAA`;
- заказывайте Certificate Manager.

Terraform сначала создаст public zone и records. После этого отдельный шаг
попросит делегировать domain на Yandex Cloud nameservers. Такой порядок не
оставляет domain делегированным в ещё не существующую zone.

Официальный материал:
[Cloud DNS zones](https://yandex.cloud/ru/docs/dns/concepts/dns-zone).

## Шаг 3. Проверить GitHub

Текущий remote проекта — `L1TTL3H0rSE/munchkin`. В локальном repository
проверьте:

```powershell
git remote get-url origin
git status --short --branch
```

В GitHub убедитесь, что ваш account:

- имеет administrative access к repository settings;
- может включать и запускать GitHub Actions;
- сможет создать environment `production`;
- сможет настроить environment approval и repository/environment secrets;
- может изменить branch protection после появления зелёного workflow.

На этом шаге не создавайте Yandex access keys и не добавляйте их в GitHub
Secrets. Основная Yandex API authentication будет настроена через OIDC
Workload Identity Federation.

Официальный пример:
[GitHub и Yandex WIF](https://yandex.cloud/ru/docs/iam/tutorials/wlif-github-integration).

## Шаг 4. Проверить локальные инструменты

Откройте новый PowerShell terminal и выполните:

```powershell
$PSVersionTable.PSVersion
git --version
ssh -V
```

Если `ssh`/`ssh-keygen` отсутствуют, установите Windows OpenSSH Client по
[официальной инструкции Microsoft](https://learn.microsoft.com/windows-server/administration/openssh/openssh-overview).

### 4.1 Установить Yandex Cloud CLI

Yandex публикует PowerShell installer. Безопаснее сначала сохранить и
просмотреть его, а затем выполнить:

```powershell
$munchkinYcInstaller = Join-Path ([IO.Path]::GetTempPath()) 'munchkin-yc-install.ps1'
Invoke-WebRequest `
  -Uri 'https://storage.yandexcloud.net/yandexcloud-yc/install.ps1' `
  -OutFile $munchkinYcInstaller
Get-FileHash -Algorithm SHA256 -LiteralPath $munchkinYcInstaller
notepad.exe $munchkinYcInstaller
```

После просмотра:

```powershell
& $munchkinYcInstaller
```

На вопрос о добавлении installation directory в `PATH` ответьте `Y`, затем
откройте новый terminal и проверьте:

```powershell
yc version
```

Если execution policy запрещает запуск script, не ослабляйте machine policy
без необходимости. Используйте manual ZIP installation из официальной
[инструкции Yandex Cloud CLI](https://yandex.cloud/ru/docs/cli/operations/install-cli).

### 4.2 Установить Terraform

Используйте официальный
[HashiCorp Terraform download](https://developer.hashicorp.com/terraform/install)
либо, если Chocolatey уже установлен:

```powershell
choco install terraform
```

Откройте новый terminal:

```powershell
terraform version
```

На подготовительном этапе не запускайте `terraform init`, `plan`, `apply`,
`destroy`, `import` или `force-unlock`. Следующий implementation plan закрепит
Terraform/provider versions и создаст `.terraform.lock.hcl`.

Yandex quickstart:
[Terraform в Yandex Cloud](https://yandex.cloud/ru/docs/terraform/quickstart).

## Шаг 5. Инициализировать человеческий `yc` profile

Выполните:

```powershell
yc init
```

CLI откроет browser authentication. В wizard выберите:

- cloud `munchkin`;
- folder `munchkin-prod`;
- доступную default zone; предпочтительно `ru-central1-d`.

Не копируйте browser/OAuth token в сообщение и не публикуйте local profile.

После `yc init` выполните только read-only проверки:

```powershell
yc version
yc config profile list
yc resource-manager cloud list
yc resource-manager folder list
yc compute zone list
```

Получите несекретные IDs текущего profile:

```powershell
$munchkinCloudId = yc config get cloud-id
$munchkinFolderId = yc config get folder-id

$munchkinCloudId
$munchkinFolderId
```

Убедитесь, что IDs относятся именно к cloud `munchkin` и folder
`munchkin-prod`:

```powershell
yc resource-manager cloud get $munchkinCloudId
yc resource-manager folder get $munchkinFolderId
```

Список зон должен содержать выбранную zone. На 2026-07-30 Yandex рекомендует
`ru-central1-d` для новых проектов, но source of truth — фактический
`yc compute zone list` и доступность ресурсов в вашем account.

Официальные материалы:

- [`yc init`](https://yandex.cloud/ru/docs/cli/quickstart);
- [availability zones](https://yandex.cloud/en/docs/overview/concepts/geo-scope).

Не запускайте `yc ... create`, `delete`, `update`, `set-access-bindings` или
`access-key create` по этой инструкции.

## Шаг 6. Создать отдельную SSH key pair

Используйте отдельный key для human bootstrap, не ваш повседневный GitHub key.
Private key защищается passphrase.

Сначала задайте безопасные пути и убедитесь, что key ещё не существует:

```powershell
$munchkinSshDirectory = Join-Path $env:USERPROFILE '.ssh'
$munchkinSshPrivate = Join-Path $munchkinSshDirectory 'yc_munchkin_prod_ed25519'
$munchkinSshPublic = $munchkinSshPrivate + '.pub'

New-Item -ItemType Directory -Force -Path $munchkinSshDirectory | Out-Null

if (
  (Test-Path -LiteralPath $munchkinSshPrivate) -or
  (Test-Path -LiteralPath $munchkinSshPublic)
) {
  throw "SSH key pair path already exists. Inspect both paths and do not overwrite either file."
}
```

Создайте key и введите сильную passphrase в интерактивном prompt:

```powershell
ssh-keygen `
  -t ed25519 `
  -a 100 `
  -f $munchkinSshPrivate `
  -C 'munchkin-prod'
```

Проверьте public key и fingerprint:

```powershell
Get-Content -Raw -LiteralPath $munchkinSshPublic
ssh-keygen -lf $munchkinSshPublic
```

Передавать можно только содержимое `$munchkinSshPublic`. Файл
`$munchkinSshPrivate`:

- не отправляется в chat;
- не коммитится;
- не становится Terraform variable;
- не помещается в GitHub Secrets;
- не копируется на VM или другой компьютер без отдельного защищённого backup.

Официальная инструкция:
[SSH к Linux VM](https://yandex.cloud/ru/docs/compute/operations/vm-connect/ssh).

OS Login может позже заменить long-lived human key на IAM-managed access.
Он не является prerequisite этого первого Terraform slice и будет отдельно
оценён в host-security plan. После создания VM первый SSH host fingerprint
обязательно сверяется с serial output до добавления в `known_hosts`.

## Шаг 7. Ничего лишнего не создавать

До следующего согласованного plan не создавайте вручную:

- VPC network, subnet, route table или security group;
- public/static IP;
- Compute VM, disk, image или snapshot;
- Container Registry;
- Object Storage bucket;
- KMS key;
- Lockbox secret;
- service account, IAM key или Workload Identity Federation;
- Cloud DNS zone/record и registrar NS delegation;
- Managed PostgreSQL;
- load balancer, CDN, Kubernetes, serverless container;
- Monitoring/Logging resources.

Почему: эти resources должны появиться через reviewable Terraform graph.
Ручное создание потребует import, создаст drift и усложнит безопасный rollback.

Исключение возможно только в отдельной bootstrap phase для Terraform state,
после нового plan и точного перечня commands/resources.

## Как будет защищён Terraform state

Это не действие владельца на текущем шаге, а зафиксированная следующая
реализация:

1. Backend prerequisites создаются отдельной bootstrap phase.
2. State хранится в отдельном private Object Storage bucket.
3. Bucket получает versioning и KMS encryption.
4. Runtime VM не имеет к нему доступа.
5. Provider/API authentication использует short-lived IAM/WIF.
6. S3 backend credential, если integration proof подтвердит его необходимость,
   принадлежит отдельному state service account и ограничен state bucket.
   Static key создаётся защищённой owner/bootstrap-процедурой вне Terraform:
   Terraform не управляет key resource, не импортирует secret и не сохраняет
   его в state.
7. Production apply сериализуется GitHub `concurrency` и manual approval.
8. S3 `use_lockfile` допускается только после concurrent-lock test на test
   state с pinned Terraform version.
9. YDB не создаётся только ради deprecated Document API locking.

Перед созданием GitHub federated credential следующий CI plan получает и
проверяет exact OIDC `sub` выбранного production job. Binding использует
конкретный environment либо protected ref subject form без wildcard и без
repository-wide доверия.

Terraform state может содержать sensitive values. Поэтому Lockbox payload не
будет передаваться через Terraform, даже как `sensitive` variable.

Подробнее:

- [Terraform state в Object Storage](https://yandex.cloud/ru/docs/terraform/tutorials/terraform-state-storage);
- [Yandex state locking warning](https://yandex.cloud/ru/docs/terraform/tutorials/terraform-state-lock);
- [HashiCorp S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3);
- [HashiCorp sensitive data](https://developer.hashicorp.com/terraform/language/manage-sensitive-data).

## Definition of Ready

Перед handoff все пункты должны быть истинны:

- [x] Billing account имеет статус `ACTIVE` или `TRIAL_ACTIVE`.
- [x] Cloud `munchkin` создан и привязан к billing.
- [x] Folder `munchkin-prod` создан без default network.
- [x] Budget ограничен этим cloud/folder и имеет thresholds.
- [x] Monthly budget ceiling записан числом.
- [x] Датированный calculator estimate сохранён вместе с VM/disk/IP,
  storage/KMS/Lockbox, telemetry retention и traffic assumptions.
- [x] Domain status зафиксирован; если domain уже куплен, registrar access
  проверен и текущие records сохранены.
- [x] Production hostname выбран либо явно отмечен как blocker только для
  public DNS/TLS slice.
- [x] Для существующего domain NS пока не менялись.
- [x] GitHub repository и Actions доступны владельцу.
- [x] `yc version` работает.
- [x] `yc init` указывает на правильные cloud/folder.
- [x] `yc compute zone list` показывает выбранную zone.
- [x] `terraform version` работает.
- [x] Отдельный ED25519 public key создан, private key защищён passphrase.
- [x] VM/network/IP/registry/buckets/IAM/DNS ещё не создавались вручную.
- [x] Ни один secret не передан в repository или handoff.

## Handoff для Codex

Подтверждённый owner handoff на 2026-07-30:

```text
YANDEX_CLOUD_READY

billing_status: ACTIVE
payment_method_linked: yes
internal_balance_funded: no
cloud_name: munchkin
cloud_id: b1gppf0332cb1uanlrqf
folder_name: munchkin-prod
folder_id: b1g55l8i2mtpv23b5ql7
default_network_created: no
default_zone: ru-central1-d
yc_cli_version: 1.22.0 windows/amd64
yc_profile: default

monthly_budget_ceiling_rub: 5000
calculator_checked_on: 2026-07-30
calculator_service_estimate_rub: 3295.44
calculator_manual_addons_rub: 312.44
calculator_estimate_rub: 3607.88
calculator_vm: 2 vCPU / 4 GB / 50%
calculator_disks: SSD boot 35 GB; SSD PostgreSQL 20 GB
calculator_network: static IPv4; 100 GB public egress
calculator_object_storage: state 1 GB standard; backup 20 GB cold
calculator_kms_lockbox: 2 keys; 10000 operations
budget_thresholds: 50%, 80%, 100%

domain_zone: l1ttl3h0rse.ru
root_hostname: l1ttl3h0rse.ru
production_hostname: munchkin.l1ttl3h0rse.ru
registrar: Timeweb
authoritative_dns_after_terraform: Yandex Cloud DNS
registrar_access_confirmed: yes
existing_dns_records_saved: yes
registrar_ns_changed: no

github_repository: L1TTL3H0rSE/munchkin
github_actions_admin: yes

ssh_key_pair_created: yes
ssh_public_key_details_stored_in_git: no
ssh_private_key_shared: no

database_profile: local-postgres
os_login: not-now

unexpected_existing_cloud_resources: none
```

Не добавляйте billing account ID, OAuth/IAM token, private key, `.env`,
password или state. Путь, значение и fingerprint SSH public key будут
переданы локально только тому implementation step, который создаёт VM; этот
owner readiness document намеренно не хранит их в Git.

## Stop conditions

Остановитесь и запросите проверку, если:

- billing не `ACTIVE`/`TRIAL_ACTIVE`;
- folder содержит неожиданную default network;
- `yc` показывает другой cloud/folder;
- `ru-central1-d` отсутствует и непонятно, какую zone выбрать;
- monthly budget ceiling не определён;
- domain уже делегирован, но текущие records не сохранены;
- у вас нет administrative access к GitHub Actions;
- SSH key path уже существовал и есть риск перезаписи;
- secret попал в command output, screenshot или сообщение;
- консоль предлагает создать платный resource, отсутствующий в этой
  инструкции.

Не удаляйте неожиданно найденный resource до проверки зависимостей и точного
target ID.

## Что будет реализовано дальше

После `YANDEX_CLOUD_READY` каждая фаза получает отдельный plan:

1. `yandex-cloud-terraform-bootstrap-and-state`
   - pinned Terraform/provider;
   - backend bootstrap;
   - private/versioned/KMS-encrypted state bucket;
   - IAM identities и tested state-lock strategy.
2. `yandex-cloud-network-registry-and-compute`
   - VPC/subnet/security groups/static IPv4;
   - Container Registry;
   - Compute VM/disks/cloud-init.
3. `github-actions-yandex-images`
   - CI parity;
   - GitHub OIDC/WIF;
   - immutable images в Container Registry.
4. `production-compose-traefik-and-deploy`
   - private application/data networks;
   - Traefik/ACME;
   - controlled SHA deploy, readiness, public smoke и rollback.
5. `postgres-backup-and-managed-telemetry`
   - encrypted Object Storage backup;
   - restore drill;
   - OTel export, dashboards и alerts.

Порядок может уточняться отдельным согласованием, но Terraform state и
identity boundary всегда создаются раньше production runtime.

## Официальные источники

- [Yandex Cloud: Terraform quickstart](https://yandex.cloud/ru/docs/terraform/quickstart)
- [Yandex Cloud: provider authentication](https://yandex.cloud/ru/docs/terraform/authentication)
- [Yandex Cloud: CLI installation](https://yandex.cloud/ru/docs/cli/operations/install-cli)
- [Yandex Cloud: billing budgets](https://yandex.cloud/ru/docs/billing/operations/budgets)
- [Yandex Cloud: cloud creation](https://yandex.cloud/ru/docs/resource-manager/operations/cloud/create)
- [Yandex Cloud: folder creation](https://yandex.cloud/ru/docs/resource-manager/operations/folder/create)
- [Yandex Cloud: availability zones](https://yandex.cloud/en/docs/overview/concepts/geo-scope)
- [Yandex Cloud: Workload Identity Federation](https://yandex.cloud/ru/docs/iam/concepts/workload-identity)
- [Yandex Cloud: GitHub WIF integration](https://yandex.cloud/ru/docs/iam/tutorials/wlif-github-integration)
- [Yandex Cloud: Object Storage state](https://yandex.cloud/ru/docs/terraform/tutorials/terraform-state-storage)
- [Yandex Cloud: Object Storage encryption](https://yandex.cloud/ru/docs/storage/concepts/encryption)
- [Yandex Cloud: Cloud DNS zones](https://yandex.cloud/ru/docs/dns/concepts/dns-zone)
- [Yandex Cloud: SSH to Linux VM](https://yandex.cloud/ru/docs/compute/operations/vm-connect/ssh)
- [HashiCorp: S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [HashiCorp: sensitive data](https://developer.hashicorp.com/terraform/language/manage-sensitive-data)
