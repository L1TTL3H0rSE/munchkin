# Terraform infrastructure

Этот каталог содержит Terraform foundation для production-инфраструктуры
Munchkin в Yandex Cloud. Bootstrap apply от 2026-07-30 создал два service
account, KMS key и state bucket; ignored bootstrap state пока остаётся local.
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
definitions. Remote backend не инициализировался для bootstrap/production,
state migration не выполнялась.

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
| `bootstrap` | local | `bootstrap/terraform.tfstate` после отдельно согласованной миграции | Два service account, KMS key, state bucket и scoped access |
| `environments/production` | S3 boundary с `use_lockfile = true`; локальные проверки используют `-backend=false` | `environments/production/terraform.tfstate` | Следующие production infrastructure plans |
| `tests/state-lock` | S3 с `use_lockfile = true` | `tests/state-lock/terraform.tfstate` | Только isolated compatibility test |

Workspaces не используются. Каждый root владеет ровно одним state key.
Production и test roots всегда инициализируются как новые state; флаг
`-migrate-state` допустим только для bootstrap root.

Bootstrap намеренно не загружает remote backend: конфигурация хранится как
`bootstrap/backend.tf.example`. Копировать её в `backend.tf` можно только после
отдельно подтверждённых bootstrap apply, owner-only создания S3 key и
state-migration gate. Пример уже содержит проверенный `use_lockfile = true`.

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

## Credential boundary

Provider/API authentication должна быть short-lived: локальный `YC_TOKEN`, а в
будущем — reviewed impersonation/WIF. Token нельзя записывать в HCL, tfvars,
saved plan, Git или command output.

S3 backend принимает credential только из process environment:

- `AWS_ACCESS_KEY_ID`;
- `AWS_SECRET_ACCESS_KEY`.

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

1. копирование `backend.tf.example` в `backend.tf`;
2. `terraform init -migrate-state`;
3. инициализация production remote key;
4. создание второго static key, rotation/revoke текущего key без отдельной
   recovery-команды;
5. любые object operations вне
   `tests/state-lock/terraform.tfstate` и его `.tflock`.

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
`storage.editor`, оба только для state service account. Migration остаётся
запрещена. Последующий isolated lock-cycle и concurrent race успешно
подтвердили S3 lockfile compatibility.
Перед state migration отдельно подтверждаются bucket/KMS, owner-only
credential delivery и читаемый local state. После миграции remote object
проверяется до удаления любого local backup.

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
