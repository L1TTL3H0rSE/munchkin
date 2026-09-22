# PLAN: yandex cloud terraform bootstrap and state

- **Plan ID:** `20260730T134441Z-35b04a-yandex-cloud-terraform-bootstrap-and-state`
- **Статус:** completed
- **Создан:** 2026-07-30 13:44:41 UTC
- **Обновлён:** 2026-07-30 20:09:24 UTC
- **Владелец:** Codex `/root`
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `codex/yandex-cloud-terraform-bootstrap-and-state`
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260730T132310Z-0ce347-record-yandex-cloud-bootstrap-facts`.
- **Блокирует:** будущие `yandex-cloud-network-registry-compute` и production
  deploy plans
- **Связанные ADR/handoff:** ADR-0009, infrastructure roadmap, Yandex Cloud
  Terraform bootstrap runbook

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".gitignore",
    ".leino/components/terraform-infrastructure.json",
    "scripts/ci-impact.sh",
    "scripts/terraform-check.sh",
    "infra/terraform/README.md",
    "infra/terraform/bootstrap/**",
    "infra/terraform/environments/production/**",
    "infra/terraform/tests/state-lock/**",
    "docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md",
    "docs/agents/plans/active/20260730T134441Z-35b04a-yandex-cloud-terraform-bootstrap-and-state.md",
    "docs/agents/plans/archive/20260730T134441Z-35b04a-yandex-cloud-terraform-bootstrap-and-state.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [],
  "dependsOn": [
    "20260730T132310Z-0ce347-record-yandex-cloud-bootstrap-facts"
  ],
  "sharedResources": [
    "infra:yandex-cloud-terraform-state-v1"
  ]
}
```

## Цель

Создать воспроизводимую Terraform foundation для Yandex Cloud и безопасно
подготовить первый production remote state: private/versioned/KMS-encrypted
Object Storage bucket, разделённые deployer/state identities, pinned toolchain,
локальные/canonical проверки и проверяемую процедуру миграции state. Не
создавать в этом slice сеть, VM, registry, DNS или application deploy.

## Критерии приёмки

- [x] `.gitignore` до первого `terraform init` исключает `.terraform`,
  `*.tfstate*`, saved plans, `*.tfvars*`, backend config и crash artifacts,
  но не исключает `.terraform.lock.hcl`.
- [x] Terraform version pin соответствует проверенной локальной версии
  `1.15.8`; Yandex provider получает точный совместимый pin, а lockfiles
  содержат checksums для `windows_amd64` и `linux_amd64`.
- [x] Новый Leino component запускает focused Terraform checks только при
  impact на Terraform paths; Terraform не становится глобальной обязательной
  зависимостью для unrelated backend/frontend plans.
- [x] Bootstrap root описывает только два service account
  (`terraform_deployer`, `state_backend`), один KMS key, один state bucket и
  минимальные scoped IAM bindings. State backend не получает folder-wide
  `storage.editor`/`storage.configurer`, но получает обязательный для
  KMS-encrypted bucket `storage.configurer` только на state bucket и
  согласованный bucket-scoped `storage.editor` только для exact state service
  account; runtime/VM identity не получает доступа к state. Bucket-level roles
  считаются trusted boundary, а не hard isolation.
- [x] State bucket private, versioned и KMS-encrypted; public access и
  `force_destroy` выключены. KMS key имеет native deletion protection и
  `prevent_destroy`; bucket защищён `prevent_destroy`, `force_destroy = false`
  и versioning.
- [x] Production root содержит S3-compatible backend boundary без credentials
  в HCL, tfvars, command arguments, saved plan или Git.
- [x] Backend keys не пересекаются:
  `bootstrap/terraform.tfstate` принадлежит bootstrap root,
  `environments/production/terraform.tfstate` — production root,
  `tests/state-lock/terraform.tfstate` — только compatibility fixture. Только
  bootstrap local state мигрируется; production/test roots не используют
  `-migrate-state`.
- [x] Static S3 access key создаётся владельцем вне Terraform и передаётся
  только через `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`; агент не создаёт,
  не читает и не печатает secret.
- [x] `use_lockfile` включён в bootstrap example и production skeleton только
  после успешного concurrent-lock race на отдельном non-production key:
  `1 planned / 3 blocked`, затем release-plan exit `2`. Serialized
  CI/manual-approval policy сохраняется; `-lock=false` запрещён.
- [x] До cloud mutation владелец отдельно подтверждает exact reviewed plan,
  marginal cost и ожидаемый resource list. До миграции state владелец отдельно
  подтверждает готовность bucket/KMS и защищённой backend credential.
- [x] После разрешённого apply повторный full `terraform plan
  -detailed-exitcode` вернул `0`; bucket encryption/versioning и exact test
  backend access проверены, concurrent locking доказан без изменения
  production state. Previous-version recovery и state migration исключены из
  финального scope прямой командой владельца.
- [x] Canonical verify, focused Terraform checks и scope-check проходят; в Git
  и tracked diff нет state, plan, credentials или secret values.
- [x] После изменения `.leino` текущая session просматривает diff и запускает
  tests, затем передаёт тот же plan/worktree новой trusted session. Только
  новая session доказывает загрузку component и может продолжить cloud stage.

## Контекст и подтверждённое состояние

- Cloud `munchkin`: `b1gppf0332cb1uanlrqf`; folder `munchkin-prod`:
  `b1g55l8i2mtpv23b5ql7`; zone `ru-central1-d`.
- Domain `l1ttl3h0rse.ru` куплен у Timeweb; production hostname
  `munchkin.l1ttl3h0rse.ru`. DNS delegation относится к следующему plan.
- Budget notification boundary создан на `5000 RUB`; он не является hard
  spending cap. Карта привязана, баланс пока не пополнялся.
- Yandex Cloud CLI `1.22.0` настроен на правильные cloud/folder. Локально
  доступен Terraform `1.15.8`.
- До начала этого plan в repository не было `infra/terraform`, Terraform
  component и защиты Terraform artifacts в `.gitignore`.
- ADR-0009 требует отдельный state service account/static S3 boundary,
  encrypted/versioned bucket, отсутствие runtime access и доказательство
  `use_lockfile` compatibility до concurrent production use.

## Scope

### Входит

- Terraform/component/tooling foundation и pinned provider lockfiles.
- Local-state bootstrap root для state bucket, KMS, двух service accounts и
  минимальных IAM bindings.
- Production backend skeleton и isolated state-lock compatibility fixture.
- Owner runbook для plan review, apply, owner-only key delivery, state
  migration, validation, rotation/recovery и cleanup local artifacts.
- После отдельных owner approvals: bootstrap apply и non-production
  access/concurrent-lock verification.

### Не входит

- VPC, subnet, security groups, public IP, VM/disks, Container Registry,
  backup bucket, Cloud DNS, Lockbox, WIF, GitHub workflow или deploy.
- Application images, Compose rollout, database migration, smoke test и DNS
  delegation у Timeweb.
- Secret payload, authorized-key JSON, S3 key resource/import или credentials
  в Terraform/state/plan/log/chat.
- `terraform destroy`, `force-unlock`, `-lock=false`, `-auto-approve`, import
  и console drift.
- State migration и previous-version recovery: владелец завершил этот plan на
  доказанном concurrent locking result; оба действия требуют будущего
  отдельного plan/approval.
- Изменения backend/frontend/content/Compose contracts.

## Архитектурный подход

1. Сначала защитить repository от local Terraform artifacts и добавить
   impact-aware checks.
2. Pin Terraform/provider and commit multi-platform dependency lockfiles.
3. Применить bootstrap root с local state и short-lived `YC_TOKEN` только
   после review exact plan.
4. Владелец создаёт единственный rotatable S3 key для `state_backend` вне
   Terraform и передаёт его через process environment без отображения.
5. Выдать `state_backend` документированный Yandex prerequisite
   `storage.configurer` только на state bucket. Exact state/lock object
   allowlist остаётся в bucket policy, но bucket configuration authority
   фиксируется как осознанный control-plane риск static backend identity.
6. Мигрировать только bootstrap local state в
   `bootstrap/terraform.tfstate`. Production root и lock fixture
   инициализируются fresh на своих keys без `-migrate-state`; проверить exact
   remote object before local cleanup.
7. Проверить locking на отдельном key. При несовместимости не имитировать
   lock: сохранить serialized single-operator policy до отдельного решения.
8. Следующий infra plan потребляет готовый remote backend и только тогда
   добавляет network/registry/compute graph.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository-workflow | Terraform component, CI impact, ignore/runbook policy | Application contracts unchanged |
| terraform-infrastructure (new) | Bootstrap/state roots and validation script | Yandex Cloud state boundary only |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.gitignore` | write | Исключить secret-bearing/generated Terraform artifacts |
| `.leino/components/terraform-infrastructure.json` | write | Зарегистрировать impact-aware Terraform component |
| `scripts/ci-impact.sh` | write | Включить Terraform root в zero-base CI impact |
| `scripts/terraform-check.sh` | write | Pinned fmt/init/validate/lockfile checks без cloud mutation |
| `infra/terraform/README.md` | write | Границы roots, credentials и owner workflow |
| `infra/terraform/bootstrap/**` | write | Local-state bootstrap graph и provider lockfile |
| `infra/terraform/environments/production/**` | write | Production provider/backend skeleton и lockfile |
| `infra/terraform/tests/state-lock/**` | write | Изолированный compatibility test state |
| `docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md` | write | Exact apply/migration/verification handoff |
| `docs/agents/plans/active/20260730T134441Z-35b04a-yandex-cloud-terraform-bootstrap-and-state.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260730T134441Z-35b04a-yandex-cloud-terraform-bootstrap-and-state.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `infra:yandex-cloud-terraform-state-v1` | будущие infra/deploy plans | этот plan | Единственный bootstrap writer; downstream только после completion |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 13:55:00 UTC.
- **Обнаруженные пересечения:** с backend kernel и frontend shell нет общих
  paths/contracts/shared resources. Этот plan один пишет `.leino`, infra
  scripts и owner runbook.
- **Решение:** выполнять в отдельном worktree. Backend plan не меняет workflow
  или projection; frontend plan ограничен двумя frontend files.

## План реализации

1. [x] Добавить ignore policy и Terraform component/check script.
2. [x] Создать pinned bootstrap, production backend и state-lock roots.
3. [x] Обновить owner runbook безопасной staged procedure без secrets.
4. [x] Выполнить local fmt/init-without-backend/validate, lockfile,
   ignore/secret и canonical checks.
5. [x] После `.leino` diff/tests остановиться, release/handoff того же plan в
   том же worktree новой trusted session; повторить preflight и доказать, что
   новый Terraform component участвует в focused verification.
6. [x] Сформировать exact Terraform plan; остановиться перед mutation и
   получить owner approval resource list/cost.
7. [x] После approval применить bootstrap graph; проверить bucket/KMS/IAM и
   получить clean follow-up plan.
8. [x] Добавить bucket-scoped `storage.configurer` binding для state backend,
   получить exact authenticated plan, отдельный apply approval, применить
   только binding и подтвердить clean full follow-up plan.
9. [x] Добавить bucket-scoped `storage.editor` binding только для state
   service account, выполнить authoritative inventory и exact authenticated
   plan, получить отдельный apply approval, применить только binding и
   подтвердить clean full follow-up plan.
10. [x] Остановиться без migration: владелец сохранил запрет и перенёс
    bootstrap state migration в будущий отдельный plan.
11. [x] Выполнить isolated exact backend access и concurrent-lock race;
    зафиксировать `use_lockfile = true`. Previous-version recovery остановлен
    владельцем и исключён из финального scope.
12. [x] Повторить canonical verify/scope-check в новой trusted session,
   записать факты и архивировать plan. Canonical verify: hooks `42/42`,
   leinoctl `63 passed / 1 platform skip`, plan lint `0 issues`,
   `terraform-check: ok`; scope-check: `ok`, `outsideWriteSet: []`,
   `missingRequiredChecks: []`. `git diff --check` и tracked secret scan
   чистые. Commit/push не выполнялись.

## Проверки

- [x] `terraform version`
- [x] `terraform fmt -check -recursive infra/terraform`
- [x] `scripts/terraform-check.sh`
- [x] New trusted session: `./leinoctl preflight` и focused verify реально
  выбирают `terraform-infrastructure`
- [x] `terraform init -backend=false` и `terraform validate` для applicable
  roots
- [x] Multi-platform `.terraform.lock.hcl` checksum check
- [x] `git check-ignore` для state/tfvars/plan/backend artifacts и negative
  check для `.terraform.lock.hcl`
- [x] Secret/artifact scan tracked diff без печати найденных значений
- [x] Reviewed bootstrap `terraform plan` с exact expected resources
- [x] После initial bootstrap/operator-policy apply
  `terraform plan -detailed-exitcode` вернул `0`
- [x] После KMS backend remediation apply
  `terraform plan -detailed-exitcode` возвращает `0`
- [x] Reviewed data-plane remediation plan содержит только exact
  `yandex_storage_bucket_iam_binding.state_backend_editor`
- [x] После data-plane remediation apply полный
  `terraform plan -detailed-exitcode` вернул `0`
- [x] Bucket public access/versioning/KMS/deletion-protection assertions
- [x] Exact test backend plan/lock access; foreign-prefix ListObjectsV2
  сохранил `403`, при этом bucket-level roles документированы как trusted
  boundary, а не hard isolation
- [x] Isolated concurrent-lock race: `1 planned / 3 blocked`, release-plan
  exit `2`
- [x] Previous-version recovery: deferred прямой командой владельца; первый
  operator PutObject получил `403` до создания state version
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260730T134441Z-35b04a-yandex-cloud-terraform-bootstrap-and-state`
- [x] `git diff --check`

## Риски и откат

- **Риск:** static backend key или state попадут в Git/log/tool transcript.
  **Снижение:** owner-only creation, environment-only delivery, ignore/scan
  gates; Terraform никогда не управляет secret-bearing key resource.
- **Риск:** S3 `use_lockfile` несовместим с Yandex Object Storage.
  **Снижение:** isolated concurrency proof; иначе single operator и внешняя
  serialization.
- **Риск:** KMS deletion сделает state нечитаемым, а будущая migration оставит
  local backup. **Снижение:** deletion protection, bucket versioning и
  обязательный recovery/migration gate в будущем отдельном plan; runtime
  recovery proof владелец исключил из текущего scope.
- **Риск:** billable resources либо excess IAM появятся раньше review.
  **Снижение:** plan-only first, explicit resource/cost gate, no auto-approve.
- **Риск:** trusted operator с `s3:*` на bucket ARN может переписать policy или
  destructive configuration и тем самым изменить доступ/доступность state,
  хотя current statement не содержит object ARN.
  **Снижение:** считать identity control-plane administrator, требовать
  отдельный review/audit для policy/config actions и не полагаться на
  `prevent_destroy` против direct API calls.
- **Риск:** обязательный для KMS-encrypted bucket `storage.configurer`
  позволяет static-key identity менять policy, encryption,
  lifecycle и другую configuration state bucket, хотя data statements текущей
  policy остаются exact-key.
  **Снижение:** не выдавать folder-wide role, держать отдельный state-only
  bucket, единственный owner-managed key, audit/rotation procedure и считать
  state identity trusted control-plane principal, а не неэскалируемой data-only
  boundary.
- **Риск:** built-in bucket-scoped `storage.editor` шире exact Terraform
  state/lock actions и включает bucket/object management.
  **Снижение:** не выдавать folder-wide role, оставить exact-key bucket policy
  вторым обязательным gate, один state-only principal и отдельный apply/access
  test approval. Учитывать, что уже выданный `storage.configurer` позволяет
  этому principal изменить policy, поэтому это trusted boundary.
- **Риск:** `yandex_storage_bucket_iam_binding` authoritative для указанной
  роли; apply может удалить out-of-band `storage.configurer` или
  `storage.editor`, причём обычный plan не показывает таких участников.
  **Снижение:** перед каждым apply выполнять read-only
  `Bucket.ListAccessBindings` по bucket `resource_id`, сравнивать полный member
  set и останавливать apply при неожиданном участнике. Перед configurer apply
  inventory вернула `0` existing `storage.configurer`; editor inventory
  обязательна до plan/apply.
- **Откат:** до apply удалить только created repository files обычным revert.
  После apply не использовать destroy автоматически: сначала сохранить
  читаемый state/versions, отозвать key по owner runbook и согласовать exact
  cloud cleanup отдельным действием.

## Открытые вопросы

- Exact globally unique bucket name будет показан в reviewed plan до apply.
- State key ownership зафиксирован и не является open choice:
  `bootstrap/terraform.tfstate`, `environments/production/terraform.tfstate`,
  `tests/state-lock/terraform.tfstate`.
- Поддержка `use_lockfile` считается неизвестной до isolated test; отрицательный
  результат не блокирует state bootstrap, но оставляет serialized policy.
- Cloud mutation и migration не считаются согласованными самим фактом
  согласования draft: для каждого gate нужна явная owner-команда.
- GitLab harness сейчас только dry-run проверяет Terraform impact и не содержит
  Terraform executable. Исполнение focused check в CI требует отдельного
  plan/write set для `.gitlab-ci.yml`; до него это обязательный local gate.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-30 13:44:41 UTC
- **Подтверждено:** 2026-07-30 14:12:52 UTC
- **Формулировка/ограничения пользователя:** «Согласовываю все три плана.
  Разрешаю зафиксировать и запушить approved drafts. Для infra пока разрешаю
  код и локальную валидацию; cloud apply, S3 key и миграцию state подтвержду
  отдельно». В этой session пользователь поручил запустить именно этот infra
  plan; затем отдельно разрешил: «Разрешаю cloud-authenticated terraform plan,
  но не apply, не создание S3 key и не миграцию state». После review результата
  `7 add / 0 change / 0 destroy` и marginal-cost оценки владелец ответил:
  «Ну получается делай». Это открывает только reviewed bootstrap apply;
  создание S3 key и state migration остаются закрыты.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Read-only review подтвердил ADR-0009, owner bootstrap facts, Terraform
  `1.15.8`, отсутствие `infra/terraform` и непересечение с двумя parallel
  runtime plans.
- Пользователь явно согласовал exact plan ID и ограничил текущую реализацию
  repository code и локальной валидацией без cloud apply/key/migration.
- Approved drafts зафиксированы commit `ffd6438` и успешно pushed в
  `origin/main`; plan выбран session
  `019fb06a-77eb-7c53-b1ae-fb95d21f81fa`, реализация начата в отдельной
  ветке `codex/yandex-cloud-terraform-bootstrap-and-state`.
- Добавлены pinned Terraform roots, scoped state IAM/bucket policy, локальный
  check script, Leino component, ignore/CI impact policy и owner runbook.
  Bootstrap backend остаётся local-first; production не включает
  `use_lockfile`, test fixture использует отдельный non-production key.
- Сгенерированы одинаковые provider lockfiles с checksums для
  `windows_amd64` и `linux_amd64`: Terraform `1.15.8`, Yandex provider
  `0.220.0`.
- Локально прошли `fmt`, Git Bash syntax, `init -backend=false`, `validate`
  всех трёх roots, lockfile regeneration/compare, ignore и secret/artifact
  checks. Canonical `verify --changed` прошёл: hooks `42/42`, leinoctl
  `63 passed / 1 platform skip`, plan lint `0 issues`,
  `terraform-check: ok`; выбраны `repository-workflow` и
  `terraform-infrastructure`.
- Cloud plan/apply, S3 key, state migration и access/recovery/concurrency
  tests не запускались. Ни один Yandex Cloud resource не создан. Следующий
  обязательный шаг — handoff новой trusted session из-за изменения `.leino`;
  owner cloud gates остаются закрыты.
- Read-only adversarial review не нашёл P0 и подтвердил отсутствие
  cloud-mutation/credential leakage. Два P1 устранены: прямой PowerShell →
  Git Bash запуск теперь сам добавляет coreutils в `PATH`, а `ListBucket`
  ограничен `StringEquals` только exact state/lock keys без
  `ListBucketVersions`. Exact команда из owner README после исправления
  завершилась `terraform-check: ok`.
- P2 review про отсутствие исполняемого Terraform gate в текущем GitLab CI
  зафиксирован явно и не скрыт: CI сейчас делает только impact dry-run.
  Исправление `.gitlab-ci.yml` находится вне согласованного write set и должно
  получить отдельный plan; локальный/canonical gate этого slice остаётся
  обязательным.
- Новая trusted session `019fb3ab-c880-72f0-8e44-e96a7f892e55` выбрала тот же
  plan. `preflight` прошёл; context загрузил новый
  `terraform-infrastructure` component. Focused
  `./leinoctl verify --base origin/main` реально выбрал
  `repository-workflow` и `terraform-infrastructure`: hooks `42/42`,
  leinoctl `63 passed / 1 platform skip`, plan lint `0 issues`,
  `terraform-check: ok`.
- Текущий Yandex Cloud profile read-only подтверждён для cloud
  `b1gppf0332cb1uanlrqf`, folder `b1g55l8i2mtpv23b5ql7`; actor
  `ajev4fni8ho7r2l666g4` подтверждён как `userAccount`. Short-lived
  `YC_TOKEN` использован только в process environment и очищен после команды.
- Разрешённый bootstrap `terraform plan -detailed-exitcode` выполнен с
  `init -backend=false`, отдельным временным `TF_DATA_DIR`, без saved plan и
  при подтверждённом отсутствии `backend.tf`/local state. Результат:
  `7 add / 0 change / 0 destroy`, exit code `2`.
- Exact create list: два service account, impersonation IAM member,
  один KMS symmetric key, KMS IAM member, private/versioned/KMS-encrypted
  state bucket и exact-key bucket policy. Bucket:
  `munchkin-prod-tfstate-b1g55l8i2mtpv23b5ql7`.
- Marginal estimate по актуальным тарифам: одна active symmetric KMS key
  version около `3.1608 RUB/month` при 720 часах плюс `3.16 RUB` за каждые
  `10 000` cryptographic operations. State bucket при объёме до `1 GB` и
  стандартных free-tier лимитах операций ожидаемо не тарифицируется; превышение
  оплачивается по фактическому storage/operations/egress.
- `apply`, создание S3 key, копирование backend config, state migration и
  access/recovery/concurrent-lock tests не выполнялись. Cloud resources,
  local/remote state и saved plan не созданы. Следующий gate — отдельное
  явное разрешение владельца на reviewed bootstrap apply.
- Владелец явно разрешил применить reviewed bootstrap plan
  `7 add / 0 change / 0 destroy`. Разрешение не распространяется на создание
  S3 key, копирование backend config и state migration.
- Reviewed bootstrap apply выполнен интерактивно без `-auto-approve`:
  `7 added / 0 changed / 0 destroyed`. Созданы:
  `munchkin-terraform-deployer` (`ajef60b0lhepf3g7tlub`),
  `munchkin-terraform-state` (`ajerqsno94ctbvgmlltf`), KMS key
  `abjd5cqjv60jidfvncok`, bucket
  `munchkin-prod-tfstate-b1g55l8i2mtpv23b5ql7` и два scoped IAM/policy
  bindings. Игнорируемый local bootstrap state сохранён в
  `infra/terraform/bootstrap/terraform.tfstate`.
- Обязательный follow-up plan дважды завершился exit code `1`: provider
  получил `403 Forbidden` при basic S3 read созданного bucket. Это не
  propagation: management API успешно читает bucket и подтверждает
  `VERSIONING_ENABLED`; KMS key имеет `ACTIVE` и deletion protection.
- Root cause подтверждён официальным policy contract и source provider
  `0.220.0`: bucket policy отклоняет запрос, если principal не попал в `Allow`,
  а `yandex_storage_bucket` basic read использует S3 client с IAM token.
  Текущая policy разрешает только state-backend principal и поэтому
  самоблокирует Terraform operator после первого apply.
- Предложенный remediation требует повторного owner approval: добавить
  human operator отдельный policy statement с `s3:*` только на bucket ARN,
  без object ARN и без `s3:GetObject`/`s3:PutObject`; затем один раз применить
  exact policy через `yc storage bucket update --policy-from-file`, потому что
  Terraform уже не может прочитать текущую policy. После этого повторить
  Terraform refresh/plan и ожидать `0`. S3 key, backend config и state
  migration остаются закрыты.

## Повторное согласование remediation

- **Статус:** approved
- **Подтверждено:** 2026-07-30 16:07:54 UTC
- **Формулировка пользователя:** «Разрешаю».
- **Причина:** созданная exact-key policy не включает Terraform operator и
  делает post-apply refresh невозможным.
- **Repository change:** operator получает management только на bucket ARN;
  direct state object ARNs остаются выданы исключительно state-backend
  account.
- **Одноразовая cloud mutation:** control-plane update той же bucket policy
  из временного non-secret JSON-файла с немедленным Terraform reconciliation.
- **Не разрешает:** создание static S3 key, direct object operations в current
  policy, backend migration, production/test init, locking/recovery tests.
  Operator остаётся trusted policy/config administrator и технически может
  изменить эту boundary; это не hard isolation.
- **Результат:** policy обновлена через control plane; operator statement имеет
  только bucket ARN и `0` object ARNs, а state backend сохраняет три state и
  три lock ARNs. Первый reconciliation plan выявил только JSON-нормализацию
  одноэлементных `Action`/`Resource` (`0 add / 1 change / 0 destroy`) и был
  остановлен без apply. После канонизации HCL повторный
  `terraform plan -detailed-exitcode` завершился exit code `0`: `No changes`.
- **Read-only assertions:** bucket остаётся private с
  `VERSIONING_ENABLED`; live policy совпадает с ограничениями выше. KMS key
  `abjd5cqjv60jidfvncok` имеет `ACTIVE`, `AES_256`, rotation `31536000s` и
  deletion protection. Обе service account существуют в ожидаемом folder.
- **Repository gates:** focused `verify --changed` выбрал
  `repository-workflow` и `terraform-infrastructure`; hooks `42/42`, leinoctl
  `63 passed / 1 platform skip`, plan lint `0 issues`,
  `terraform-check: ok`. Scope-check завершился `ok`, `outsideWriteSet: []`.
  Tracked state/plan/backend artifacts и credential-like values не найдены;
  local bootstrap state подтверждён как ignored.
- **Adversarial review:** подтверждено отсутствие direct operator object ARN,
  но wildcard bucket management признан trusted control-plane boundary, из
  которой operator может изменить policy/config и будущий доступ. README,
  runbook и risk section теперь фиксируют этот bypass; устаревшие pre-apply
  gates удалены. `terraform-check.sh` получил regression guard для operator,
  state и lock policy statements.

## Повторное согласование KMS backend remediation

- **Статус:** approved
- **Подтверждено:** 2026-07-30 17:24:17 UTC
- **Формулировка пользователя:** «Да».
- **Причина:** owner-created static key подтверждён как credential именно
  `munchkin-terraform-state`; live exact lock policy и
  `kms.keys.encrypterDecrypter` корректны. Access preflight получил
  авторизованный `GetObject` exact `.tflock` с ожидаемым `404`, но
  `PutObject` того же lock key завершился `403`.
- **Первоначальная гипотеза:** у state account нет ни folder-, ни bucket-level
  Object Storage role. Yandex требует `storage.configurer` вместе с KMS
  encrypter/decrypter role для работы с KMS-encrypted bucket. Позднейший
  post-apply test доказал, что это необходимый configuration prerequisite, но
  не достаточный data grant.
- **Repository change:** один
  `yandex_storage_bucket_iam_binding.state_backend_configurer` на exact state
  bucket, только для state service account; exact state/lock object policy и
  отсутствие folder-wide role сохраняются. README, runbook, risk и local
  regression gate фиксируют, что это trusted control-plane authority.
- **Разрешено сейчас:** repository changes и cloud-authenticated Terraform
  plan exact IAM binding remediation.
- **Результат plan:** exit code `2`, строго
  `1 add / 0 change / 0 destroy`; единственный create —
  `yandex_storage_bucket_iam_binding.state_backend_configurer` с role
  `storage.configurer` на exact state bucket. Apply и migration не запускались.
- **Authoritative binding preflight:** Yandex provider разрешает имя bucket в
  отдельный `resource_id` и управляет полным member set выбранной роли.
  Read-only `Bucket.ListAccessBindings` по
  `e3e78pmu1f66ldcmhct5` завершился `200`: всего один bucket binding,
  `storage.configurer = 0`. Следовательно, reviewed apply не вытеснит
  out-of-band участника этой роли; предыдущий `404/code 5` был вызван
  подстановкой bucket name вместо `resource_id`.
- **Adversarial follow-up:** local regression guard усилен до exact одного
  configurer member, ровно трёх literal state keys, exact derived
  lock/prefix/object ARN locals и полного списка из пяти reviewed policy
  statements с exact principals, actions, resources и prefix condition.
  Runbook разделяет уже applied foundation и только planned binding; checklist
  отдельно отмечает завершённый initial post-apply plan и ещё не выполненный
  KMS-remediation post-apply plan.
- **Не разрешено сейчас:** remediation apply, state migration, новый static
  key, production object operations либо расширение exact object policy.
  Ранее разрешённые isolated access/recovery/concurrent-lock tests остаются
  ограничены `tests/state-lock/terraform.tfstate` и `.tflock`, но продолжатся
  только после отдельного apply approval и успешного remediation.
- **Apply approval:** approved 2026-07-30 18:10:26 UTC точной формулировкой
  владельца: «Разрешаю apply только
  yandex_storage_bucket_iam_binding.state_backend_configurer, без миграции».
  Разрешение охватывает ровно один reviewed bucket IAM binding и обязательный
  clean follow-up plan; state migration, backend activation, static-key
  mutation и любые другие cloud changes остаются закрыты.
- **Apply result:** непосредственно перед apply повторный authoritative
  inventory подтвердил `storage.configurer = 0`, а fresh targeted plan —
  `1 add / 0 change / 0 destroy` только для approved address. Интерактивный
  apply без `-auto-approve` завершился `1 added / 0 changed / 0 destroyed`.
  Полный follow-up plan без `-target` вернул exit `0` и `No changes`; live
  inventory содержит ровно один binding:
  `storage.configurer` → `serviceAccount:ajerqsno94ctbvgmlltf`.
  `backend.tf` отсутствует, migration и object operations не запускались.
- **Post-apply access retest:** isolated backend `init -reconfigure` успешен,
  но `terraform plan` завершился exit `1`: `GetObject` отсутствующего exact
  `.tflock` вернул `404`, после чего exact lock `PutObject` вернул `403
  AccessDenied`. Direct ListObjectsV2 ранее вернул `403` как для exact test
  prefix, так и для foreign prefix. Последующий read-only operator inventory
  подтвердил `test_prefix_object_count = 0`: lock/state objects не созданы.
- **Подтверждённая причина:** live bucket policy содержит exact
  `GetObject`/`PutObject`/`DeleteObject` для test `.tflock`, KMS binding
  содержит exact state service account, static key принадлежит тому же
  account, а live bucket IAM содержит только `storage.configurer`.
  `storage.configurer` не предоставляет bucket data access. Yandex сначала
  проверяет IAM/bucket ACL и только затем bucket policy, поэтому exact policy
  не заменяет базовый data grant. Yandex документирует `If-None-Match: *` для
  `PutObject`, так что текущий `403` не доказывает несовместимость conditional
  lock write.

## Повторное согласование data-plane IAM remediation

- **Статус:** applied; migration forbidden.
- **Подтверждено:** 2026-07-30 18:49:42 UTC.
- **Формулировка пользователя:** «Разрешаю расширить plan: добавить
  bucket-scoped yandex_storage_bucket_iam_binding.state_backend_editor только
  для state service account и выполнить cloud-authenticated Terraform plan.
  Apply и миграция запрещены».
- **Repository change:** добавить второй authoritative
  `yandex_storage_bucket_iam_binding.state_backend_editor` с role
  `storage.editor` только на exact state bucket и только для state service
  account. Folder-wide role и расширение bucket policy до wildcard object ARN
  запрещены.
- **Почему не `storage.uploader`:** роль разрешает read/upload, но не delete;
  HashiCorp `use_lockfile` требует `GetObject`, `PutObject` и `DeleteObject`
  exact `.tflock`.
- **Ограничение:** `storage.editor` — широкий built-in data/config role.
  Текущая exact-key bucket policy остаётся вторым обязательным gate, но static
  key уже имеет `storage.configurer` и считается trusted principal, способным
  изменить policy/configuration. Material IAM/risk expansion отдельно
  согласована; exact-key policy и bucket-only scope сохранены.
- **Разрешено сейчас:** ранее согласованные isolated access/recovery/lock tests
  только на exact test state/lock keys. State migration, backend activation и
  static-key mutation остаются запрещены.
- **Authoritative preflight:** live bucket IAM содержит всего один binding:
  `storage.configurer` для exact state service account.
  `storage.editor = 0`, поэтому planned authoritative binding не вытесняет
  out-of-band участника этой роли.
- **Результат plan:** bootstrap `backend.tf` отсутствует, local state остаётся
  ignored, временный `TF_DATA_DIR` удалён. Полный plan без `-target` и без
  saved plan завершился exit `2`: единственный create —
  `yandex_storage_bucket_iam_binding.state_backend_editor`; summary строго
  `1 add / 0 change / 0 destroy`. Apply, migration и object operations не
  запускались.
- **Repository verification:** canonical verify завершился `ok`: hooks
  `42/42`, leinoctl `63 passed / 1 platform skip`, plan lint `0 issues`,
  `terraform-check: ok`. Scope-check завершился `ok`,
  `outsideWriteSet: []`; `git diff --check` чистый.
- **Apply approval:** approved 2026-07-30 19:11:01 UTC точной формулировкой
  владельца: «даю разрешение на
  yandex_storage_bucket_iam_binding.state_backend_editor». В контексте
  предыдущего отдельного apply gate разрешение охватывает только интерактивный
  apply exact resource после fresh inventory/plan, полный read-only follow-up
  plan и post-apply inventory. `-auto-approve`, migration, backend activation,
  static-key mutation и object operations остаются запрещены.
- **Apply result:** непосредственно перед apply повторный authoritative
  inventory подтвердил `storage.editor = 0`, а fresh full plan — единственный
  create и `1 add / 0 change / 0 destroy`. Интерактивный targeted apply после
  показа exact prompt завершился `1 added / 0 changed / 0 destroyed`.
  Обязательный полный follow-up plan без `-target` вернул exit `0` и
  `No changes`. Post-apply inventory содержит ровно два binding:
  `storage.configurer` и `storage.editor`, оба только для exact state service
  account. Test prefix остаётся пустым; migration, backend activation и object
  operations не запускались.
- **Lock compatibility result:** после `storage.editor` exact isolated plan
  вернул exit `2` и `1 add / 0 change / 0 destroy`; `.tflock` create/delete
  cycle завершился `ok`. Четыре одновременных plan дали
  `1 planned / 3 blocked`; post-race plan снова вернул exit `2`, current test
  prefix пуст.
- **Final owner scope decision:** «Всё, хватит тогда с тестами, фиксируем
  успешный локинг и все». Previous-version recovery и state migration не
  выполняются; rejected operator `PutObject` получил `403` до создания версии.
  Непроверенный recovery helper удалён. Проверенный `use_lockfile = true`
  закреплён в bootstrap example, production skeleton и test fixture.

## Итог

Bootstrap, operator policy, KMS prerequisite и bucket-scoped data-plane binding
применены; владелец создал один static S3 key без раскрытия secret. Полный
cloud follow-up plan чистый, live IAM exact, test prefix пуст. Scoped access,
lock create/delete и реальный concurrent race подтверждены. `use_lockfile`
закреплён во всех remote backend definitions. Previous-version recovery и
state migration исключены владельцем из финального scope; production/bootstrap
backend init не выполнялся. Canonical verify и scope-check прошли; plan
завершён и архивирован без stage, commit или push.
