# PostgreSQL backup and restore

This runbook defines the local contract for `INFRA-010`. It is intentionally
keyless on the production VM: the backup job obtains a short-lived IAM token
from the Compute metadata service and talks to the dedicated Yandex Object
Storage bucket over HTTPS. No static S3 key, API key, database password or
production DSN is part of the backup graph, scripts, plan or logs.

The current repository state is local-only. No bucket, KMS key, IAM binding,
VM timer, backup object, restore database, alert rule or owner email was
created by this plan.

## Approved contract

- RPO target: `<=24h`.
- Restore target: `<=60m`, measured by the isolated drill rather than inferred
  from script duration.
- Schedule: daily at `03:00 Europe/Moscow`, persistent across reboot.
- Retention: `7 daily + 4 weekly`. Terraform uses an 8-day daily expiration
  and 35-day weekly expiration so seven/four complete generations remain
  available during normal daily execution.
- Stale threshold: newest verified manifest older than `26h`.
- Monthly Object Storage/KMS/operations soft ceiling: `300 RUB`; review at 70%
  and stop/review before a forecast over 100%.
- Bucket: `munchkin-production-backups-b1g55l8i2mtpv23b5ql7`, private,
  versioned, static-key authentication disabled, default SSE-KMS encryption.
- Object layout:

  ```text
  munchkin/postgres/daily/<Moscow-date>-<run-id>.dump
  munchkin/postgres/weekly/<Moscow-date>-<run-id>.dump
  munchkin/postgres/manifests/<Moscow-date>-<run-id>.json
  ```

  The manifest is the commit marker. An archive without a verified manifest is
  not a backup and must not be selected for restore.

## Identity boundary

The existing VM runtime service account receives only bucket-scoped
`storage.uploader` and KMS `kms.keys.encrypter`. `storage.uploader` is used for
upload and read-after-write checksum verification; the job cannot delete or
configure the bucket. The optional owner-supplied `backup_operator_subject`
receives bucket-scoped `storage.viewer` and KMS `kms.keys.decrypter` only when
that input is explicitly present. The Terraform/provider identity is the
separate provisioning/configuration actor.

The IAM token is kept in a mode `0600` transient curl config and is removed on
exit. It is never written to a repository file, Terraform variable, state,
systemd environment file, dump manifest or status output. A restore operator
enters a separate short-lived token interactively; restore access is not
installed on the production VM.

## Local validation

From the repository root:

```bash
bash scripts/production/backup-smoke.sh
terraform fmt -check -recursive infra/terraform
bash scripts/terraform-check.sh
docker compose --parallel 8 -f compose.restore.yml config --quiet
```

The static smoke checks include shell syntax, the metadata-token/Bearer
contract, custom-format `pg_dump`, manifest/checksum commit behavior, the
production-DSN restore guard, private restore networking, systemd bounds,
retention/alert thresholds and the absence of tracked raw dumps or static
credentials. Docker execution is not implied; an unavailable daemon is a
runtime limitation, not a successful restore drill.

## Sanitized remote mutation gate

Before any cloud or VM mutation, show and approve this exact additive sequence:

1. Read-only inventory of the target folder, the proposed bucket name, existing
   bucket IAM bindings and KMS key bindings. Stop on any unexpected member.
2. Terraform plan for `backup.tf` only. With the default empty operator input,
   the graph contains the KMS key, bucket, runtime uploader binding and runtime
   KMS encrypter member. The two operator resources remain at `count = 0`.
   Supplying `backup_operator_subject` adds only the bucket viewer and KMS
   decrypter member for that exact subject.
3. Separate approval for Terraform apply. Never use `-auto-approve`, state
   edits, static S3 credentials or a broad folder-wide storage role.
4. Separate approval for installing the four scripts/configuration artifacts,
   timer and service on `/srv/munchkin`; validate root ownership and modes
   before enabling the timer.
5. Separate owner-mediated Monium alert import, normalized rule comparison and
   one owner-only test email. The email address and any console/API credential
   remain outside Git and this runbook.

The first non-production probe must perform only PUT, HEAD and GET for a
synthetic object under the dedicated bucket, verify the response size/checksum,
then remove that synthetic object only after the owner approves the cleanup.
It must not use the Terraform state bucket or production PostgreSQL data.

## Installing the scheduled job after approval

Copy the approved scripts to the root-owned Compose script directory and the
two unit files to `/etc/systemd/system`. Create a root-owned mode `0640`
`/etc/munchkin/postgres-backup.env` containing only non-secret settings:

```text
BACKUP_BUCKET=munchkin-production-backups-b1g55l8i2mtpv23b5ql7
BACKUP_PREFIX=munchkin/postgres
BACKUP_S3_ENDPOINT=https://storage.yandexcloud.net
```

The service uses `EnvironmentFile=-/etc/munchkin/postgres-backup.env`, obtains
its token from metadata and runs:

```text
/srv/munchkin/compose/scripts/backup-postgres.sh
```

Enable the timer only after the exact host mutation approval:

```bash
systemctl daemon-reload
systemctl enable --now munchkin-postgres-backup.timer
systemctl status munchkin-postgres-backup.timer --no-pager
```

The service is root-owned, locked with `flock`, bounded to 55 minutes/75% CPU/
768 MiB, uses a private temporary area and `ProtectSystem=strict`, and removes
local dump/verification files only after the manifest has been uploaded and
read-after-write verified. A failed run writes only a bounded status record
with `failure_stage`; it does not publish a manifest or delete remote history.

## Backup evidence

After a separately approved first run, inspect only non-secret metadata:

```bash
systemctl show munchkin-postgres-backup.service -p Result -p ExecMainStatus
jq '{result, failure_stage, observed_at, verified_timestamp, manifest_key, release_sha, size_bytes}' \
  /srv/munchkin/state/postgres-backup-status.json
```

The manifest records PostgreSQL major version, migration ledger version,
creation time, checksum algorithm, archive size, release SHA and object
checksums. It never records credentials, DSNs, player/game/card IDs or sample
rows. The custom-format archive itself is never a CI artifact and never printed.

## Isolated restore drill

The operator must select a specific committed manifest and confirm that the
target is disposable. The restore script rejects production DSNs, fixes the
database/user names to `munchkin_restore`, uses `compose.restore.yml` with no
published ports and removes its named data volume on exit.

Run after separate operator-access and restore approvals:

```bash
sudo BACKUP_BUCKET=munchkin-production-backups-b1g55l8i2mtpv23b5ql7 \
  /srv/munchkin/compose/scripts/restore-postgres.sh \
  --bucket munchkin-production-backups-b1g55l8i2mtpv23b5ql7 \
  --manifest-key munchkin/postgres/manifests/<approved-manifest>.json \
  --confirm-isolated
```

The script prompts for the short-lived operator IAM token without echo. It
downloads and validates the manifest, downloads the daily archive, checks
size/SHA-256, runs `pg_restore --list`, restores with `--exit-on-error`, checks
`munchkin_schema_migrations`, `games`, `game_events` and a bounded game row
count, then writes only:

```text
/srv/munchkin/state/restore-drill-evidence.json
```

That evidence contains the manifest/object keys, actual elapsed seconds, RPO
hours and restored row count, but no database values or credentials. The drill
fails if elapsed time exceeds 60 minutes or the selected backup age exceeds
24 hours. The disposable Compose database is removed even on failure.

## Alerts and incidents

`infra/observability/monium/backup-alerts.yaml` is the desired-state source for
two owner-only rules: verified backup age over `26h` and a reported backup
failure. Both have `for`, severity, deduplication, manual silence and runbook
links. Import, normalized export comparison and test delivery remain separate
owner-approved operations.

### Stale or missing backup

Do not delete old objects or overwrite a verified manifest. Check the status
file, systemd result, metadata token availability, PostgreSQL readiness, disk
space and the last safe release. Run a non-production PUT/HEAD/GET probe only
after approval. If the bucket or KMS is unavailable, preserve the last known
verified object and escalate before changing IAM.

### Backup failure

Use `failure_stage` to distinguish metadata, dump, upload, checksum and
manifest-commit failures. Never print the curl config, token, DSN or dump. A
checksum mismatch is fail-closed: the manifest is not committed and the local
temporary object is removed by the script. Remote versioning/lifecycle cleanup
is handled only by the approved bucket policy.

### Restore failure

Keep production untouched. Preserve the non-secret drill error and manifest
reference, remove only the disposable restore project, and stop if any command
mentions a production DSN or production Compose file. A new drill requires a
new exact manifest selection and operator approval.

## Current evidence boundary

Implemented locally: Terraform graph, private restore Compose, keyless backup
and isolated-restore scripts, systemd schedule/hardening, retention/failure
alerts and this runbook. Not run in this workspace: non-production Object
Storage probe, first dump/growth measurement, Terraform apply, KMS/IAM/bucket
mutation, VM installation, first verified backup, Monium import/test email,
isolated restore drill, reboot recovery and account-specific cost measurement.
