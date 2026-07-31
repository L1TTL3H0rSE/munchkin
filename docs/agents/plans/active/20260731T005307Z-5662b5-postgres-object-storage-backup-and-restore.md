# PLAN: PostgreSQL off-host backup and restore

- **Plan ID:** `20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore`
- **Статус:** draft
- **Создан:** 2026-07-31 00:53:07 UTC
- **Обновлён:** 2026-07-31 01:04:00 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`.
- **Блокирует:**
  `20260731T005308Z-3beea1-production-security-and-supply-chain`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "compose.production.yml",
    "infra/compose/**",
    "infra/terraform/environments/production/backup.tf",
    "infra/terraform/environments/production/iam.tf",
    "infra/terraform/environments/production/outputs.tf",
    "infra/terraform/environments/production/variables.tf",
    "infra/terraform/README.md",
    "scripts/production/backup-postgres.sh",
    "scripts/production/restore-postgres.sh",
    "scripts/production/backup-smoke.sh",
    "scripts/production/systemd/**",
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
    "20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts"
  ],
  "sharedResources": [
    "infra:yandex-cloud-production-v1",
    "cloud:yandex-compute:fv4eule47h2vqo5ki48k",
    "cloud:yandex-object-storage:munchkin-production-backups",
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

- [ ] До approval зафиксированы RPO, target RTO, retention generations,
  expected data growth, bucket/KMS/operations monthly estimate and ceiling.
- [ ] Dedicated private Object Storage bucket имеет public access disabled,
  server-side encryption/KMS, versioning/lifecycle where supported and exact
  least-privilege writer/reader boundary.
- [ ] Backup job получает short-lived identity from VM/runtime workload
  boundary. Static Yandex access/authorized/API keys, S3 key files and
  long-lived cloud credentials на VM/GitHub запрещены; если выбранный
  Object Storage API не поддерживает этот contract, plan останавливается и
  возвращается на архитектурное согласование.
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
- Yandex S3-compatible authentication details can change; no-static-key
  requirement is a hard implementation gate, not an assumption.

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

1. Terraform creates non-secret bucket/KMS/IAM graph after price review.
2. Root-owned job gets ephemeral IAM from instance metadata/runtime identity,
   creates a custom-format dump in protected temporary storage, checksums and
   uploads with a native IAM-token-capable API/CLI.
3. Remote object key is immutable/date+ID based; lifecycle deletes only after
   separately reviewed retention policy.
4. Restore always targets a disposable Compose project/database with network
   isolation and explicit production-name guard.

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
| `compose.production.yml` | write | Disposable restore/job boundary |
| `infra/compose/**` | write | Backup/restore Compose config |
| `infra/terraform/environments/production/backup.tf` | write | Bucket/KMS resources |
| `infra/terraform/environments/production/iam.tf` | write | Backup access |
| `infra/terraform/environments/production/outputs.tf` | write | Non-secret backup outputs |
| `infra/terraform/environments/production/variables.tf` | write | Backup inputs |
| `infra/terraform/README.md` | write | Backup state/auth documentation |
| `scripts/production/backup-postgres.sh` | write | Backup operation |
| `scripts/production/restore-postgres.sh` | write | Restore operation |
| `scripts/production/backup-smoke.sh` | write | Backup/restore smoke |
| `scripts/production/systemd/**` | write | Timer/service units |
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
| Runtime/backup IAM | exact additive | Ephemeral upload/read |
| Production VM | install timer/scripts | Scheduled backup |
| Disposable restore DB | create/test/remove | Non-production drill |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Production PostgreSQL | deploy plan | read-only dump | Host deploy lock coordinates restart |
| Alerting | telemetry plan | dependency | Add backup freshness/failure rules |
| Bucket/KMS | security plan | this plan | Security later audits policy/retention |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 01:04:00 UTC.
- **Обнаруженные пересечения:** Compose/Terraform/alerting extend dependency
  resources; security plan audits same bucket/IAM later.
- **Решение:** strict chain. Authentication feasibility, price, RPO/RTO and
  exact lifecycle must be resolved before this draft can be approved.

## План реализации

1. [ ] Choose RPO/RTO/retention/budget and verify official keyless Object
   Storage upload/download mechanism from Compute runtime identity.
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

- **Риск:** keyless Object Storage upload unsupported. **Снижение:** official
  contract proof before implementation; no fallback static keys.
- **Риск:** corrupted/incomplete backup gives false confidence. **Снижение:**
  remote checksum plus real restore drill.
- **Риск:** retention deletes last usable copy or cost grows unbounded.
  **Снижение:** versioned generations, reviewed lifecycle, size/cost alert.
- **Откат:** disable timer/IAM write; retain verified objects. Bucket/object/KMS
  deletion is destructive and requires a separate explicit approval.

## Открытые вопросы

- RPO, RTO, retention and budget ceiling.
- Exact IAM-token-capable Object Storage client/API for Ubuntu host.
- Whether backup uses existing runtime SA with bucket-scoped role or a
  separately impersonated keyless backup identity.
- Plan remains incomplete/not approvable until these are resolved.

## Согласование

- **Статус:** not requested; incomplete prerequisite draft
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** заранее создать все infra roadmap
  plans; incomplete base permitted. No static cloud keys.

## Ход выполнения

- Base draft created with hard keyless-auth, cost and restore gates.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
