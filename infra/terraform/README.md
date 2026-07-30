# Terraform infrastructure

Этот каталог содержит Terraform foundation для production-инфраструктуры
Munchkin в Yandex Cloud. Сейчас разрешены только repository code и локальная
валидация. Ни один cloud resource этим изменением не создан.

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
| `environments/production` | S3 boundary, локальные проверки используют `-backend=false` | `environments/production/terraform.tfstate` | Следующие production infrastructure plans |
| `tests/state-lock` | S3 с `use_lockfile = true` | `tests/state-lock/terraform.tfstate` | Только isolated compatibility test |

Workspaces не используются. Каждый root владеет ровно одним state key.
Production и test roots всегда инициализируются как новые state; флаг
`-migrate-state` допустим только для bootstrap root.

Bootstrap намеренно не загружает remote backend: конфигурация хранится как
`bootstrap/backend.tf.example`. Копировать её в `backend.tf` можно только после
отдельно подтверждённых bootstrap apply, owner-only создания S3 key и
state-migration gate.

## State boundary

Ожидаемое имя bucket:
`munchkin-prod-tfstate-b1g55l8i2mtpv23b5ql7`.

Bootstrap graph задаёт:

- отдельный `munchkin-terraform-deployer` для short-lived provider
  authentication;
- отдельный `munchkin-terraform-state`, которому не выдаётся folder-wide role;
- KMS key с native deletion protection и Terraform `prevent_destroy`;
- private bucket с запрещённым anonymous access, versioning,
  KMS server-side encryption, `force_destroy = false` и Terraform
  `prevent_destroy`;
- bucket policy позволяет list/read/write только трёх зафиксированных state
  objects и их lock objects;
- прямой `kms.keys.encrypterDecrypter` для state service account.

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

Static S3 key принадлежит только `munchkin-terraform-state`, создаётся
владельцем вне Terraform после отдельного подтверждения и никогда не
импортируется в Terraform. Нельзя передавать его через `-backend-config`,
`.tfbackend`, HCL, tfvars, chat, screenshot или CI log.

`operator_subject` — несекретный explicit input вида `userAccount:<id>` или
`federatedUser:<id>`. Он разрешает только impersonation deployer service
account и не выдаёт state access.

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
- отклоняет tracked state/plan/tfvars/backend artifacts и inline credentials.

Скрипт может скачать pinned provider из Terraform Registry, но не обращается к
Yandex Cloud API и не создаёт resources.

Текущий GitLab harness выполняет только `leinoctl verify --dry-run`, поэтому
он проверяет impact graph, но не устанавливает Terraform и не исполняет этот
focused check. До отдельного CI/toolchain plan `terraform-check.sh` остаётся
обязательным локальным gate; полагаться на pipeline как на HCL/lockfile
валидацию нельзя.

## Закрытые owner gates

До отдельной явной команды владельца запрещены:

1. cloud-authenticated bootstrap `terraform plan`;
2. `terraform apply`;
3. создание static S3 access key;
4. копирование `backend.tf.example` в `backend.tf`;
5. `terraform init -migrate-state`;
6. инициализация production/test remote keys;
7. positive/negative access, recovery и concurrent-lock cloud tests.

Перед bootstrap apply владелец получает exact reviewed resource list и
marginal cost. Перед state migration отдельно подтверждаются bucket/KMS,
owner-only credential delivery и читаемый local state. После миграции remote
object проверяется до удаления любого local backup.

До успешного isolated concurrent-lock test production остаётся
single-operator/serialized и не включает `use_lockfile`.

## Запрещённые операции

- `terraform destroy`, `force-unlock`, `-lock=false`, `-auto-approve`;
- import или ручное исправление drift через Yandex console;
- application secrets и Lockbox payload через Terraform;
- commit `.terraform/`, `*.tfstate*`, `*.tfplan`, `*.tfvars*` или
  `*.tfbackend`;
- вывод credential либо state в terminal log.

Если secret появился в output или state оказался в Git, нужно остановиться,
отозвать credential и согласовать recovery; продолжать apply нельзя.
