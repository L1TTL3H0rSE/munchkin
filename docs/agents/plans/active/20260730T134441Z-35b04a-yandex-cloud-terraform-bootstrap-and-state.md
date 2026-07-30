# PLAN: yandex cloud terraform bootstrap and state

- **Plan ID:** `20260730T134441Z-35b04a-yandex-cloud-terraform-bootstrap-and-state`
- **Статус:** approved
- **Создан:** 2026-07-30 13:44:41 UTC
- **Обновлён:** 2026-07-30 14:12:52 UTC
- **Владелец:** отдельная Codex infra-session после согласования
- **Workspace:** отдельный worktree
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

- [ ] `.gitignore` до первого `terraform init` исключает `.terraform`,
  `*.tfstate*`, saved plans, `*.tfvars*`, backend config и crash artifacts,
  но не исключает `.terraform.lock.hcl`.
- [ ] Terraform version pin соответствует проверенной локальной версии
  `1.15.8`; Yandex provider получает точный совместимый pin, а lockfiles
  содержат checksums для `windows_amd64` и `linux_amd64`.
- [ ] Новый Leino component запускает focused Terraform checks только при
  impact на Terraform paths; Terraform не становится глобальной обязательной
  зависимостью для unrelated backend/frontend plans.
- [ ] Bootstrap root описывает только два service account
  (`terraform_deployer`, `state_backend`), один KMS key, один state bucket и
  минимальные scoped IAM bindings. State backend не получает folder-wide
  `editor`, а runtime/VM identity не получает доступа к state.
- [ ] State bucket private, versioned и KMS-encrypted; public access и
  `force_destroy` выключены, bucket и KMS key защищены от случайного удаления.
- [ ] Production root содержит S3-compatible backend boundary без credentials
  в HCL, tfvars, command arguments, saved plan или Git.
- [ ] Backend keys не пересекаются:
  `bootstrap/terraform.tfstate` принадлежит bootstrap root,
  `environments/production/terraform.tfstate` — production root,
  `tests/state-lock/terraform.tfstate` — только compatibility fixture. Только
  bootstrap local state мигрируется; production/test roots не используют
  `-migrate-state`.
- [ ] Static S3 access key создаётся владельцем вне Terraform и передаётся
  только через `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`; агент не создаёт,
  не читает и не печатает secret.
- [ ] `use_lockfile` включается только после успешного concurrent-lock test на
  отдельном non-production key. До этого production apply остаётся
  single-operator/serialized; `-lock=false` запрещён.
- [ ] До cloud mutation владелец отдельно подтверждает exact reviewed plan,
  marginal cost и ожидаемый resource list. До миграции state владелец отдельно
  подтверждает готовность bucket/KMS и защищённой backend credential.
- [ ] После разрешённого apply повторный `terraform plan
  -detailed-exitcode` возвращает `0`, а remote state, encryption, versioning,
  scoped positive/negative access и recovery из предыдущей object version
  проверены без изменения production state.
- [ ] Canonical verify, focused Terraform checks и scope-check проходят; в Git
  и tracked diff нет state, plan, credentials или secret values.
- [ ] После изменения `.leino` текущая session просматривает diff и запускает
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
- В repository сейчас нет `infra/terraform`, Terraform component и защиты
  Terraform artifacts в `.gitignore`.
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
- После отдельных owner approvals: bootstrap apply, state migration и
  non-production concurrency/access/recovery verification.

### Не входит

- VPC, subnet, security groups, public IP, VM/disks, Container Registry,
  backup bucket, Cloud DNS, Lockbox, WIF, GitHub workflow или deploy.
- Application images, Compose rollout, database migration, smoke test и DNS
  delegation у Timeweb.
- Secret payload, authorized-key JSON, S3 key resource/import или credentials
  в Terraform/state/plan/log/chat.
- `terraform destroy`, `force-unlock`, `-lock=false`, `-auto-approve`, import
  и console drift.
- Изменения backend/frontend/content/Compose contracts.

## Архитектурный подход

1. Сначала защитить repository от local Terraform artifacts и добавить
   impact-aware checks.
2. Pin Terraform/provider and commit multi-platform dependency lockfiles.
3. Применить bootstrap root с local state и short-lived `YC_TOKEN` только
   после review exact plan.
4. Владелец создаёт единственный rotatable S3 key для `state_backend` вне
   Terraform и передаёт его через process environment без отображения.
5. Мигрировать только bootstrap local state в
   `bootstrap/terraform.tfstate`. Production root и lock fixture
   инициализируются fresh на своих keys без `-migrate-state`; проверить exact
   remote object before local cleanup.
6. Проверить locking на отдельном key. При несовместимости не имитировать
   lock: сохранить serialized single-operator policy до отдельного решения.
7. Следующий infra plan потребляет готовый remote backend и только тогда
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

1. [ ] Добавить ignore policy и Terraform component/check script.
2. [ ] Создать pinned bootstrap, production backend и state-lock roots.
3. [ ] Обновить owner runbook безопасной staged procedure без secrets.
4. [ ] Выполнить local fmt/init-without-backend/validate, lockfile,
   ignore/secret и canonical checks.
5. [ ] После `.leino` diff/tests остановиться, release/handoff того же plan в
   том же worktree новой trusted session; повторить preflight и доказать, что
   новый Terraform component участвует в focused verification.
6. [ ] Сформировать exact Terraform plan; остановиться перед mutation и
   получить owner approval resource list/cost.
7. [ ] После approval применить bootstrap graph; проверить bucket/KMS/IAM и
   получить clean follow-up plan.
8. [ ] Остановиться для owner-only создания/передачи S3 key; после отдельного
   migration approval мигрировать только bootstrap state в
   `bootstrap/terraform.tfstate`, fresh-initialize production/test keys и
   проверить remote/local boundary.
9. [ ] Выполнить isolated access, version recovery и concurrent-lock tests;
   зафиксировать `use_lockfile` либо serialization fallback.
10. [ ] Повторить canonical verify/scope-check в новой trusted session,
   записать факты и архивировать
   plan. Commit/push выполняются только после полного завершения.

## Проверки

- [ ] `terraform version`
- [ ] `terraform fmt -check -recursive infra/terraform`
- [ ] `scripts/terraform-check.sh`
- [ ] New trusted session: `./leinoctl preflight` и focused verify реально
  выбирают `terraform-infrastructure`
- [ ] `terraform init -backend=false` и `terraform validate` для applicable
  roots
- [ ] Multi-platform `.terraform.lock.hcl` checksum check
- [ ] `git check-ignore` для state/tfvars/plan/backend artifacts и negative
  check для `.terraform.lock.hcl`
- [ ] Secret/artifact scan tracked diff без печати найденных значений
- [ ] Reviewed bootstrap `terraform plan` с exact expected resources
- [ ] Post-apply `terraform plan -detailed-exitcode` возвращает `0`
- [ ] Bucket public access/versioning/KMS/deletion-protection assertions
- [ ] Scoped positive state access и negative foreign-prefix access
- [ ] Isolated concurrent-lock and previous-version recovery tests
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260730T134441Z-35b04a-yandex-cloud-terraform-bootstrap-and-state`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** static backend key или state попадут в Git/log/tool transcript.
  **Снижение:** owner-only creation, environment-only delivery, ignore/scan
  gates; Terraform никогда не управляет secret-bearing key resource.
- **Риск:** S3 `use_lockfile` несовместим с Yandex Object Storage.
  **Снижение:** isolated concurrency proof; иначе single operator и внешняя
  serialization.
- **Риск:** KMS deletion сделает state нечитаемым, а migration оставит local
  backup. **Снижение:** deletion protection, version-recovery proof и
  verified cleanup только после remote read.
- **Риск:** billable resources либо excess IAM появятся раньше review.
  **Снижение:** plan-only first, explicit resource/cost gate, no auto-approve.
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

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-30 13:44:41 UTC
- **Подтверждено:** 2026-07-30 14:12:52 UTC
- **Формулировка/ограничения пользователя:** «Согласовываю все три плана.
  Разрешаю зафиксировать и запушить approved drafts. Для infra пока разрешаю
  код и локальную валидацию; cloud apply, S3 key и миграцию state подтвержду
  отдельно». В этой session пользователь поручил запустить именно этот infra
  plan; все внешние cloud mutation gates остаются закрыты.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Read-only review подтвердил ADR-0009, owner bootstrap facts, Terraform
  `1.15.8`, отсутствие `infra/terraform` и непересечение с двумя parallel
  runtime plans.
- Пользователь явно согласовал exact plan ID и ограничил текущую реализацию
  repository code и локальной валидацией без cloud apply/key/migration.

## Итог

Заполняется после реализации.
