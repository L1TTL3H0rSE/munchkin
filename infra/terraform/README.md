# Terraform infrastructure

Этот каталог содержит Terraform foundation для production-инфраструктуры
Munchkin в Yandex Cloud. Bootstrap apply от 2026-07-30 создал три service
account, KMS key и state bucket. Bootstrap state перенесён в private,
versioned и KMS-encrypted Yandex Object Storage; ignored local plaintext state
и backup удалены после повторной remote-проверки.
Владелец создал один static S3 key вне Terraform и передал его только через
process environment. Bucket-scoped `storage.configurer` remediation применена
ровно для state service account; полный follow-up plan чистый. Повторный
isolated backend plan всё ещё получил `403` на `PutObject` exact `.tflock`:
`storage.configurer` не даёт data access и не проходит начальный IAM/ACL gate.
Отдельно согласованный bucket-scoped `storage.editor` применён только для state
service account; полный follow-up plan чистый. После remediation isolated
Terraform plan подтвердил exact backend access и полный lock create/delete
cycle. Concurrent race дал `1 planned / 3 blocked`, а post-race plan завершился
exit `2`; `use_lockfile = true` поэтому закреплён во всех remote backend
definitions. Bootstrap S3 backend активирован и migration завершена clean
cloud-authenticated plan. Production backend инициализирован 2026-07-31 как
новый empty state без migration/copy flags; reviewed apply создал exact
production graph, а follow-up plan вернул `No changes`.

## Закреплённые версии

- Terraform: `1.15.8`;
- provider `yandex-cloud/yandex`: `0.220.0`;
- lock-файлы bootstrap и production содержат checksums для
  `windows_amd64` и `linux_amd64`.

Версии меняются только отдельным reviewed plan вместе с перегенерацией и
проверкой `.terraform.lock.hcl`.

## Roots и ownership state

| Root | Backend сейчас | State key | Назначение |
|---|---|---|---|
| `bootstrap` | S3 active, `use_lockfile = true`; local activation file ignored | `bootstrap/terraform.tfstate` | Deployer/state identities и state foundation; reviewed graph также добавляет keyless runtime identity |
| `environments/production` | S3 active, `use_lockfile = true`; локальные isolated проверки используют `-backend=false` | `environments/production/terraform.tfstate` | Applied network/registry/compute graph; следующие изменения отдельно gated |
| `tests/state-lock` | S3 с `use_lockfile = true` | `tests/state-lock/terraform.tfstate` | Только isolated compatibility test |

Workspaces не используются. Каждый root владеет ровно одним state key.
Production и test roots всегда инициализируются как новые state. Одноразовая
bootstrap migration уже выполнена; повторять `-migrate-state` без отдельного
recovery plan нельзя.

Bootstrap загружает remote backend из ignored `bootstrap/backend.tf`,
byte-for-byte созданного из reviewed `bootstrap/backend.tf.example`. В Git
остаётся только example; credential передаётся заново через process
environment. Migration создала допустимые для Terraform S3 fallback новую
lineage и serial `1`; exact semantic payload и девять resource addresses
совпали с исходным local backup. Последующий cloud-authenticated plan вернул
`No changes`, lock object освободился, а post-cleanup remote read повторно
подтвердил payload и addresses.

## State boundary

Ожидаемое имя bucket:
`munchkin-prod-tfstate-b1g55l8i2mtpv23b5ql7`.

Bootstrap graph задаёт:

- отдельный `munchkin-terraform-deployer` для short-lived provider
  authentication;
- отдельный `munchkin-terraform-state`, которому не выдаётся folder-wide role,
  но выдаётся `storage.configurer` только на dedicated state bucket как
  обязательный configuration prerequisite KMS-encrypted bucket; эта роль сама
  по себе не даёт object data access;
- KMS key с native deletion protection и Terraform `prevent_destroy`;
- private bucket с запрещённым anonymous access, versioning,
  KMS server-side encryption, `force_destroy = false` и Terraform
  `prevent_destroy`;
- bucket policy позволяет state service account list/read/write только трёх
  зафиксированных state objects и их lock objects после успешного базового
  IAM/ACL gate;
- bucket-scoped `storage.configurer` не расширяет object ARN текущей policy,
  но позволяет state service account менять policy, encryption, lifecycle и
  другую configuration bucket; это trusted control-plane boundary;
- отдельно согласованный bucket-scoped `storage.editor` проходит базовый
  data IAM gate для read/upload/delete; exact-key bucket policy остаётся вторым
  gate. Binding применён только для state service account;
- operator является trusted bucket administrator: current statement с `s3:*`
  только на bucket ARN напрямую не разрешает `GetObject`, `PutObject` или
  `DeleteObject`, но позволяет менять policy и destructive configuration,
  включая lifecycle, encryption и access settings;
- прямой `kms.keys.encrypterDecrypter` для state service account.

Live access retest после применения `storage.configurer` подтвердил, что
bucket policy не заменяет базовый IAM/ACL data grant: exact Terraform lock
`PutObject` снова вернул `403`, exact и foreign `ListBucket` также вернули
`403`. Отсутствующий `.tflock` и ответ `404` ранее не доказывали разрешённое
чтение. Live bucket policy, KMS binding и principal совпадают с HCL, а
`Bucket.ListAccessBindings` содержит только `storage.configurer` для state
service account. Поэтому access, concurrent-lock и recovery tests остановлены
до bucket-scoped data-role remediation. После применения `storage.editor`
isolated access test можно повторить только на exact test state/lock keys.

После применения `storage.editor` exact test backend успешно выполнил plan
`1 add / 0 change / 0 destroy` и удалил `.tflock`. Отдельный race через
`concurrent-lock-test.ps1` запустил четыре одновременных plan: один получил
lock, три завершились `Error acquiring the state lock`, затем контрольный plan
снова вернул exit `2`. Current test prefix после race пуст. Владелец остановил
дальнейшие cloud-тесты; previous-version recovery и state migration в этом
slice не выполняются.

`yandex_storage_bucket_iam_binding` является authoritative для одной роли:
каждый apply приводит полный список участников соответствующей роли к
`members` из HCL, а обычный plan не показывает удаление out-of-band
участников. Поэтому перед apply `storage.configurer` или `storage.editor`
обязателен read-only
`Bucket.ListAccessBindings` по `resource_id` bucket; при любом неожиданном
участнике apply останавливается, пока полный desired set не согласован.
Инвентаризация от 2026-07-30 вернула `0` текущих `storage.configurer`, поэтому
reviewed binding с единственным state service account никого не вытесняет.
Семантика resource описана в
[Terraform Registry](https://registry.terraform.io/providers/yandex-cloud/yandex/0.220.0/docs/resources/storage_bucket_iam_binding),
а `resourceId` и read-only API — в
[Yandex Object Storage API](https://yandex.cloud/en/docs/storage/api-ref/Bucket/listAccessBindings).

Runtime/VM identity и deployer не получают доступ к state bucket. Bucket не
имеет отдельной native deletion-protection настройки: его защита от случайного
удаления обеспечивается `prevent_destroy`, `force_destroy = false`,
versioning и обязательным review плана.

## Network, registry и Compute graph

Repository graph применён 2026-07-31 после отдельных owner approvals.
Bootstrap apply завершился exact `7 added / 0 changed / 0 destroyed`:

- один keyless `munchkin-runtime` service account без static/API/authorized
  keys;
- пять additive folder members для deployer:
  `compute.editor`, `container-registry.admin`, `vpc.privateAdmin`,
  `vpc.publicAdmin`, `vpc.securityGroups.admin`;
- прямой `iam.serviceAccounts.user` только на runtime service account.

Production apply завершился exact `10 added / 0 changed / 0 destroyed`:
dedicated network, subnet
`10.42.0.0/24`, normal security group, protected reserved IPv4, private
registry, repositories `game`/`web`, authoritative pull-only registry binding
с единственным runtime member, protected 20 GB data disk и одну VM. Provider
`0.220.0` не предоставляет additive
`yandex_container_registry_iam_member`, поэтому новый пустой registry
использует `yandex_container_registry_iam_binding` с exact единственным
member. Добавление другого puller вне Terraform будет вытеснено следующим
apply и требует отдельного HCL review.

Non-secret outputs и live IDs:

| Resource/output | Value |
|---|---|
| Runtime service account | `aje84i3qaj2dhkr9q28l` |
| Network | `enp09n6lb1l950ief4dt` |
| Subnet | `fl8o10ih9ftnqab0qrj5` |
| Security group | `enpc8ecqfqoh0puiu2ne` |
| Reserved address | `fl810u2k1qqnqmclgmhf`, `81.26.187.230` |
| Container Registry | `crpdnmjudj1usiu90gdn` |
| Repositories | `crpdnmjudj1usiu90gdn/game`, `crpdnmjudj1usiu90gdn/web` |
| Compute instance | `fv4eule47h2vqo5ki48k`, `munchkin.ru-central1.internal` |
| PostgreSQL data disk | `fv4e2cgc448a00vkhps8` |
| Ubuntu image | `fd83ergat2e815oohe7o` |

Remote state содержит exact десять managed resource addresses и два
ожидаемых data-source addresses. Signed S3 `HEAD` вернул `200` для state и
`404` для `.tflock`; полный authenticated production plan завершился exit `0`
и `No changes`.

### GitHub Actions WIF handoff (repository implementation, not applied)

This plan adds a separate keyless `munchkin-github-images` service account in
the bootstrap root, one GitHub OIDC federation and one exact federated
credential for:

`repo:L1TTL3H0rSE@32160016/munchkin@1316069622:environment:production-images`

The production root looks up that service account and adds one authoritative
registry-scoped `container-registry.images.pusher` binding. The existing
runtime binding remains `container-registry.images.puller` and keeps only the
runtime service account. No service-account key, authorized key, state access,
folder-wide role or cleanup binding is declared for CI.

The new HCL is intentionally not represented as a live apply result yet.
Owner gates still require a protected GitHub `production-images` environment,
an observed claim-probe with exact `iss`/`aud`/`sub`/repository IDs, separate
sanitized bootstrap and production plan review, and separate apply approval.
Non-secret handoff outputs include the CI service-account ID, federation ID,
exact subject/audience and image repository prefixes.

VM фиксирует `ru-central1-d`, current family `ubuntu-2404-lts`,
`standard-v3`, `2 vCPU`, core fraction `50%`, `4 GB RAM`, 35 GB
`network-ssd` boot disk и standalone 20 GB `network-ssd` data disk.
Data disk имеет `prevent_destroy`, подключается с
`device_name = "munchkin-data"` и `auto_delete = false`.

Security group публикует только TCP `80`/`443` в `0.0.0.0/0`; TCP `22`
принимает required process-only IPv4 CIDR set. IPv6 ingress и остальные
inbound ports отсутствуют, egress явно разрешён в `0.0.0.0/0`.

Versioned cloud-init создаёт только trusted human user `munchkin-admin` с
owner ED25519 key и sudo, но без membership в root-equivalent `docker` group.
Он отключает password/direct-root SSH, устанавливает Ubuntu `docker.io`,
Compose v2 и unattended upgrades, задаёт bounded `json-file` logs,
fail-closed форматирует только пустой `virtio-munchkin-data`, монтирует его в
`/srv/munchkin`, создаёт root-owned каталоги и success marker. Application
images, Compose/Traefik, DNS/TLS, Lockbox, backup и telemetry не входят в этот
slice.

Owner-side проверка после apply сверила три SSH host-key fingerprints и public
keys с authenticated serial output, затем выполнила подключение только с
`StrictHostKeyChecking=yes`. `cloud-init status --wait` вернул `done`;
success marker существует. Docker `29.1.3` и Compose `2.40.3` active/enabled,
data disk виден как `/dev/vdb`, смонтирован в `/srv/munchkin` как `ext4` с
`nosuid,nodev`. Effective `sshd -T` подтвердил password/keyboard-interactive
и direct root denial; отдельные attempts завершились exit `255`. Human admin
не входит в `docker` group. Wildcard TCP listeners содержат только SSH
`0.0.0.0:22`/`[::]:22`; остальные обнаруженные listeners loopback-only.

## Credential boundary

Provider/API authentication должна быть short-lived: локальный `YC_TOKEN`, а в
будущем — reviewed impersonation/WIF. Token нельзя записывать в HCL, tfvars,
saved plan, Git или command output.

S3 backend принимает credential только из process environment:

- `AWS_ACCESS_KEY_ID`;
- `AWS_SECRET_ACCESS_KEY`.

Production root дополнительно принимает только process-local sensitive
variables:

- `TF_VAR_ssh_public_key` — ровно один public ED25519 key; он попадёт в
  encrypted remote state и незашифрованный VM metadata `user-data`;
- `TF_VAR_ssh_ingress_cidrs` — JSON set/list owner IPv4 CIDRs; world-open
  `0.0.0.0/0` отклоняется validation.

Private key, password, token и runtime secret в Terraform не передаются.

Static S3 key принадлежит только `munchkin-terraform-state`, создан владельцем
вне Terraform после отдельного подтверждения и никогда не импортируется в
Terraform. Нельзя передавать его через `-backend-config`, `.tfbackend`, HCL,
tfvars, chat, screenshot или CI log.

Credential получает exact object actions из bucket policy и обязательный
bucket-level `storage.configurer` для KMS-encrypted bucket. Bucket policy
проверяется только после базового IAM/ACL gate; bucket-scoped `storage.editor`
теперь проходит этот gate. Компрометация key позволяет обратиться к
разрешённым exact object keys и изменить configuration/policy dedicated state
bucket. Это не неэскалируемая data-only изоляция: key требует owner-only
хранения, audit и немедленной rotation/revoke процедуры при подозрении на
утечку.

`operator_subject` — несекретный explicit input вида `userAccount:<id>` или
`federatedUser:<id>`. Он разрешает impersonation deployer service account и
bucket-level management, включая чтение/обновление configuration и policy.
Resource этого statement — только bucket ARN без `/*`: оператор может видеть
метаданные и имена ключей, но не читать, записывать или удалять state objects.
Object-level grant в текущей policy остаётся только у
`munchkin-terraform-state`. Это trusted control-plane boundary, а не
неэскалируемая изоляция: operator может переписать policy или configuration и
тем самым изменить будущий доступ либо доступность state. Такие действия
требуют отдельного review и cloud audit; прямой API вызов не защищён Terraform
`prevent_destroy`.

## Разрешённая локальная проверка

Из корня repository в PowerShell:

```powershell
terraform version
terraform fmt -check -recursive infra/terraform
& 'C:\Program Files\Git\bin\bash.exe' scripts/terraform-check.sh
```

`terraform-check.sh`:

- требует Terraform `1.15.8`;
- удаляет cloud/backend credentials из окружения проверки;
- использует отдельные временные configuration и `TF_DATA_DIR`;
- выполняет `init -backend=false` и `validate` для всех roots;
- перегенерирует lock-файлы в temp для Windows/Linux и сравнивает их;
- проверяет ровно три literal state keys, exact derived lock/prefix/object ARN
  locals и ровно пять policy statements с exact principals, actions,
  resources и prefix condition без дополнительных statements;
- требует ровно по одному bucket-scoped `storage.configurer` и
  `storage.editor` binding с exact единственным member — state service
  account — и запрещает folder-wide варианты этих roles;
- проверяет exact пять deployer roles, runtime-SA handoff, ровно `11`
  production resources, три data lookup, exact runtime puller plus CI pusher,
  sensitive SSH boundary,
  IPv4-only ingress, fixed VM/disk profile и cloud-init host baseline;
- отклоняет tracked state/plan/tfvars/backend artifacts и inline credentials.

Скрипт может скачать pinned provider из Terraform Registry, но не обращается к
Yandex Cloud API и не создаёт resources.

Текущий GitLab harness выполняет только `leinoctl verify --dry-run`, поэтому
он проверяет impact graph, но не устанавливает Terraform и не исполняет этот
focused check. До отдельного CI/toolchain plan `terraform-check.sh` остаётся
обязательным локальным gate; полагаться на pipeline как на HCL/lockfile
валидацию нельзя.

## Текущие owner gates

До отдельной явной команды владельца запрещены:

1. bootstrap apply новых IAM resources до review exact plan with only the
   keyless CI service account, federation and federated credential;
2. инициализация production remote key до доказанного отсутствия destination;
3. production apply до review exact additive registry pusher plan with no
   runtime binding replacement,
   повторного budget confirmation и отдельного owner approval;
4. повторная bootstrap migration, `state push`, ручная правка state или
   переключение bootstrap обратно на local backend;
5. создание второго static key, rotation/revoke текущего key без отдельной
   recovery-команды;
6. direct object mutations и операции вне exact bootstrap/production/test
   state и lock keys;
7. восстановление previous version: versioning включён, но recovery drill ещё
   не доказан.
8. GitHub environment mutation, OIDC claim-probe against the live repository,
   WIF exchange, registry login and first image publication remain separate
   owner gates for this repository-only implementation.

Authenticated bootstrap plan и reviewed apply уже были отдельно согласованы и
завершены. Владелец отдельно разрешил exact `storage.configurer` binding:
pre-apply inventory показал `0` существующих участников роли, targeted apply
завершился `1 added / 0 changed / 0 destroyed`, full follow-up plan — `0`.
Live binding содержит ровно
`serviceAccount:ajerqsno94ctbvgmlltf`.
Повторный isolated plan завершился до создания lock object: exact
`.tflock` `PutObject` снова вернул `403`. Поэтому разрешённые только на test key
access/recovery/concurrent-lock tests остаются остановлены до отдельного
согласования data-role apply. Владелец разрешил добавить exact
`yandex_storage_bucket_iam_binding.state_backend_editor` в repository и
выполнить cloud-authenticated plan. Preflight подтвердил
`storage.editor = 0`; полный plan без `-target` показал только этот create и
строго `1 add / 0 change / 0 destroy`. После отдельного approval интерактивный
targeted apply завершился `1 added / 0 changed / 0 destroyed`, полный follow-up
plan — `No changes`. Live IAM содержит ровно `storage.configurer` и
`storage.editor`, оба только для state service account. Последующий isolated
lock-cycle и concurrent race успешно подтвердили S3 lockfile compatibility.
После отдельного согласования bootstrap migration выполнена интерактивно без
`-force-copy`; remote semantic equality, clean plan, lock release и повторная
readability доказаны до и после exact удаления local state/backup.

Успешный isolated concurrent-lock test разрешает `use_lockfile = true` в
bootstrap example и production backend skeleton. Это не отменяет serialized
CI/manual-approval policy и само по себе не разрешает backend init, migration
или apply.

## Запрещённые операции

- `terraform destroy`, `force-unlock`, `-lock=false`, `-auto-approve`;
- import или ручное исправление drift через Yandex console;
- application secrets и Lockbox payload через Terraform;
- commit `.terraform/`, `*.tfstate*`, `*.tfplan`, `*.tfvars*` или
  `*.tfbackend`;
- вывод credential либо state в terminal log.

Если secret появился в output или state оказался в Git, нужно остановиться,
отозвать credential и согласовать recovery; продолжать apply нельзя.
