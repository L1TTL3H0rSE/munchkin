# PLAN: PostgreSQL off-host backup and restore

- **Plan ID:** `20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore`
- **Статус:** approved
- **Создан:** 2026-07-31 00:53:07 UTC
- **Обновлён:** 2026-08-01 15:15:14 UTC
- **Владелец:** Codex / `019fbde1-fd6a-79e3-8b47-9f217363607f`
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; отдельная ветка не создаётся по указанию владельца
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry`, `20260731T005306Z-3de45e-production-compose-traefik-and-deploy`, `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`.
- **Блокирует:**
  `20260731T005308Z-3beea1-production-security-and-supply-chain`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "compose.restore.yml",
    "infra/observability/monium/backup-alerts.yaml",
    "infra/terraform/environments/production/backup.tf",
    "infra/terraform/environments/production/iam.tf",
    "infra/terraform/environments/production/outputs.tf",
    "infra/terraform/environments/production/variables.tf",
    "infra/terraform/README.md",
    "scripts/production/backup-postgres.sh",
    "scripts/production/restore-postgres.sh",
    "scripts/production/backup-smoke.sh",
    "scripts/production/systemd/munchkin-postgres-backup.service",
    "scripts/production/systemd/munchkin-postgres-backup.timer",
    "scripts/terraform-check.sh",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/operations/POSTGRES_BACKUP_AND_RESTORE.md",
    "docs/agents/plans/active/20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore.md",
    "docs/agents/plans/archive/20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore.md"
  ],
  "components": [
    "repository-workflow",
    "terraform-infrastructure",
    "root-compose"
  ],
  "contracts": [
    "operations:postgres-backup-v1",
    "operations:postgres-restore-v1",
    "operations:backup-alert-v1"
  ],
  "dependsOn": [
    "20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry",
    "20260731T005306Z-3de45e-production-compose-traefik-and-deploy",
    "20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts"
  ],
  "sharedResources": [
    "infra:yandex-cloud-production-v1",
    "cloud:yandex-compute:fv4eule47h2vqo5ki48k",
    "cloud:yandex-object-storage:munchkin-production-backups",
    "cloud:yandex-kms:munchkin-production-backups",
    "database:production-postgres-v1",
    "observability:production-telemetry-v1"
  ]
}
```

## Цель

Закрыть INFRA-010: создавать проверяемые encrypted PostgreSQL backups вне VM,
автоматически контролировать freshness/retention/failure и доказать restore
drill в изолированную database без изменения production data. RPO/RTO и
monthly storage ceiling должны быть измерены, а не только задокументированы.

## Критерии приёмки

- [ ] До approval зафиксированы RPO `<=24h`, target RTO `<=60m`, измеряемый
  owner-observed isolated restore drill, retention `7 daily + 4 weekly`, first
  dump growth measurement и Object Storage/KMS/operations soft ceiling
  `300 RUB/month`; прогноз превышения требует нового owner decision.
- [ ] Dedicated private Yandex Object Storage bucket имеет public access
  disabled, server-side encryption with Yandex KMS, versioning/lifecycle and
  exact bucket-scoped least-privilege writer/reader/configuration boundary.
- [ ] Backup запускается ежедневно в `03:00 Europe/Moscow`; freshness alert
  срабатывает, когда newest verified backup старше `26h`, а также при failure.
- [ ] `infra/observability/monium/backup-alerts.yaml` is the desired-state
  source. After a separate remote-mutation approval, owner creates/updates the
  rule in the authenticated Monium console, records the non-secret rule ID and
  normalized exported settings, compares them with YAML and sends one test
  email. No admin/API credential is stored in Git, GitHub or the VM; Terraform
  or API automation is deferred until separately proven and re-approved.
- [ ] Backup job использует direct HTTPS S3-compatible API через `curl` с
  short-lived IAM token из Compute VM metadata. Existing VM runtime SA получает
  только bucket-scoped `storage.uploader` и minimum encrypt/decrypt permission
  на exact backup KMS key для upload/read-after-write verification; provisioning
  identity отдельно управляет bucket lifecycle/encryption, а operator restore
  использует отдельный interactive `storage.viewer` + KMS decrypt access.
  Static Yandex access/authorized/API keys, S3 key files и long-lived cloud
  credentials на VM/GitHub запрещены.
- [ ] Consistent `pg_dump`/archive includes schema/data and manifest with
  PostgreSQL version, migration/version, timestamp, checksum, size and release
  SHA; credentials/PII/sample rows в manifest/logs отсутствуют.
- [ ] Upload is atomic/fail-closed: incomplete objects не считаются backup,
  checksum verified after upload, local temporary archive securely removed
  only after remote verification.
- [ ] systemd timer/service or equivalent survives reboot, prevents concurrent
  runs, bounds CPU/I/O/time/disk usage and publishes freshness/success/failure
  telemetry/alert.
- [ ] Restore script refuses production DSN/database, verifies checksum/version,
  restores only into explicitly disposable isolated target and runs schema/
  row-count/application compatibility smoke.
- [ ] Owner-observed restore drill records actual RPO/RTO; backup younger than
  threshold and alert-on-stale/failure are proven.
- [ ] No raw dump is committed, uploaded as CI artifact or printed. Terraform,
  scripts, secret scan, restore drill, canonical verify and scope-check pass.

## Контекст и подтверждённое состояние

- PostgreSQL data resides only on the VM data disk; off-host backup is absent.
- Production Compose/Lockbox/deploy and base alerting are dependencies.
- Terraform state bucket is dedicated to Terraform and must not be reused for
  database backups.
- Yandex Object Storage S3 API с `Authorization: Bearer <IAM token>` из Compute
  metadata выбран как keyless contract. Implementation обязан доказать
  PUT/HEAD/download, checksum и exact bucket/KMS permissions до production
  mutation; no-static-key остаётся hard gate.

## Scope

### Входит

- Dedicated backup bucket/KMS/IAM metadata, backup/restore scripts, timer.
- Retention/freshness/checksum/telemetry and isolated restore drill.
- Runbook with RPO/RTO and disaster procedure.

### Не входит

- Continuous WAL/PITR, cross-region replica, Managed PostgreSQL or HA.
- Terraform state backup changes.
- Production data restore/destructive database replacement.
- Static cloud credentials as a shortcut.

## Архитектурный подход

1. Terraform creates dedicated Yandex Object Storage bucket, exact KMS key and
   bucket/key-scoped IAM graph after `300 RUB/month` soft-ceiling check.
2. At `03:00 MSK` root-owned job obtains short-lived IAM token from Compute
   metadata, creates a protected custom-format dump, checksum and manifest,
   then uploads through direct S3 HTTPS API using `curl`.
3. Object key is immutable/date+ID based; manifest uploads last as commit
   marker. Remote HEAD/size/checksum is verified before local temp removal;
   lifecycle retains `7 daily + 4 weekly`.
4. Restore uses separate operator IAM access and targets a disposable isolated
   Compose database with explicit production-name guard; no restore credential
   is installed on the production VM.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Terraform | Bucket/KMS/IAM | Private encrypted backup store |
| VM/systemd | Scheduled backup | Freshness + exit status |
| restore tooling | Isolated verification | Measured RTO/checksum |
| telemetry/alerts | Backup signals | No database contents |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `compose.restore.yml` | write | Disposable isolated restore boundary |
| `infra/observability/monium/backup-alerts.yaml` | write | Backup freshness/failure rule |
| `infra/terraform/environments/production/backup.tf` | write | Bucket/KMS resources |
| `infra/terraform/environments/production/iam.tf` | write | Backup access |
| `infra/terraform/environments/production/outputs.tf` | write | Non-secret backup outputs |
| `infra/terraform/environments/production/variables.tf` | write | Backup inputs |
| `infra/terraform/README.md` | write | Backup state/auth documentation |
| `scripts/production/backup-postgres.sh` | write | Backup operation |
| `scripts/production/restore-postgres.sh` | write | Restore operation |
| `scripts/production/backup-smoke.sh` | write | Backup/restore smoke |
| `scripts/production/systemd/munchkin-postgres-backup.service` | write | Root-owned bounded backup unit |
| `scripts/production/systemd/munchkin-postgres-backup.timer` | write | Daily 03:00 MSK schedule |
| `scripts/terraform-check.sh` | write | Bucket/KMS/IAM assertions |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | INFRA-010 status |
| `docs/operations/POSTGRES_BACKUP_AND_RESTORE.md` | write | Operator runbook |
| `docs/agents/plans/active/20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore.md` | write | Archived lifecycle |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| Backup Object Storage bucket | create/configure | Off-host archives |
| KMS key | create/configure | Server-side encryption |
| Runtime/provisioning/operator IAM + exact KMS key | exact additive | Split upload/configure/restore access |
| Production VM | install timer/scripts | Scheduled backup |
| Disposable restore DB | create/test/remove | Non-production drill |
| Monium backup alert rule | owner-mediated console create/configure after approval | Freshness/failure notification after metric exists; no persisted admin credential |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Production PostgreSQL | deploy plan | read-only dump | Host deploy lock coordinates restart |
| Base Monium alerting | telemetry plan | dependency | Extend only exact backup rule after archive |
| Bucket/KMS | security plan | this plan | Security later audits policy/retention |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 14:44:19 UTC.
- **Обнаруженные пересечения:** Compose/Terraform/alerting extend dependency
  resources; security plan audits same bucket/IAM later.
- **Решение:** strict chain. RPO/RTO/retention/schedule/soft ceiling,
  Yandex Object Storage/KMS, metadata-token `curl` and runtime-SA/operator
  restore split are settled for this draft. Approval still requires exact
  Terraform IAM/KMS assertions, non-production token probe and measured dump
  size/cost evidence.

## План реализации

1. [ ] Validate selected `03:00 MSK` metadata-token `curl` contract,
   bucket/KMS roles and `300 RUB/month` estimate with a non-production probe.
2. [ ] Update exact architecture/write/remote mutation set and request approval.
3. [ ] Implement Terraform bucket/KMS/IAM and local checks.
4. [ ] Obtain separate exact cloud-plan approval and apply; prove clean state.
5. [ ] Implement/install backup timer and telemetry; run first verified backup.
6. [ ] Perform isolated restore/application compatibility drill and record
   actual RPO/RTO.
7. [ ] Update runbook/roadmap, verify/scope-check and archive.

## Проверки

- [ ] Terraform fmt/validate/check + exact clean post-apply plan
- [ ] Public access/IAM/KMS/versioning/lifecycle inventory
- [ ] Static cloud key inventory and repository/host secret scan
- [ ] Backup lock/timeout/disk-full/upload-failure/checksum tests
- [ ] Fresh backup and stale/failure alert test
- [ ] Isolated restore guard, checksum, migration and app smoke
- [ ] Reboot timer recovery
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** metadata/S3 token contract or required bucket/KMS role differs in
  practice. **Снижение:** non-production PUT/HEAD/download proof before apply,
  exact-key IAM assertions and no static-key fallback; stop for architecture
  review if proof fails.
- **Риск:** corrupted/incomplete backup gives false confidence. **Снижение:**
  remote checksum plus real restore drill.
- **Риск:** retention deletes last usable copy or cost grows unbounded.
  **Снижение:** versioned generations, reviewed lifecycle, size/cost alert.
- **Откат:** disable timer/IAM write; retain verified objects. Bucket/object/KMS
  deletion is destructive and requires a separate explicit approval.

## Открытые вопросы

- Audit-recommended defaults for owner review: RPO `<=24h`, target RTO `<=60m`
  measured by restore drill, `7 daily + 4 weekly`, `03:00 MSK`, stale `>26h`,
  `300 RUB/month` soft ceiling, Yandex Object Storage + KMS, metadata IAM-token
  `curl`, existing runtime-SA uploader and separate operator restore access.
- Remaining gates are evidence-only: first-dump growth/cost, Terraform
  least-privilege/KMS role proof, non-production S3 token probe and
  owner-observed isolated restore drill.
- Plan remains draft/unapproved until its exact remote mutation set is
  reviewed after predecessor completion.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 15:15:14 UTC
- **Подтверждено:** 2026-08-01 15:15:14 UTC
- **Формулировка/ограничения пользователя:** пользователь формально одобрил
  последовательную очередь exact plans начиная с этого plan и разрешил
  approvals, select, implementation, verify, scope-check, archive/release,
  подготовительный local commit plan-файлов и отдельный local commit после
  каждого завершённого plan. Подтверждены audit defaults RPO `<=24h`, target
  RTO `<=60m`, retention `7 daily + 4 weekly`, daily `03:00 Europe/Moscow`,
  Yandex Object Storage + KMS, keyless metadata-token API, soft ceiling
  `300 RUB/month` и сокращённый Monium soak на 60 минут; ветка не создаётся.
  Разрешён обычный push в `origin/main` только после успешных проверок.
  PostgreSQL password и dedicated deploy SSH key разрешено безопасно
  сгенерировать и передать непосредственно в утверждённые secret stores без
  вывода или сохранения в Git, plan, chat или logs. Remote mutations,
  Terraform apply, secret payload insertion, GitHub/Yandex settings,
  production VM bootstrap/deploy, restore drill against any production data и
  платные/destructive actions не одобрены заранее: перед каждым таким этапом
  нужен sanitized exact mutation plan и отдельное approval. Owner email
  остаётся вне Git/plan.

## Ход выполнения

- Base draft created with hard keyless-auth, cost and restore gates.
- 2026-08-01 audit-recommended defaults recorded; owner/formal approval and
  implementation evidence remain open.
- 2026-08-01 formal queue approval recorded with the remote-mutation gates
  above; implementation remains dependency-gated.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
