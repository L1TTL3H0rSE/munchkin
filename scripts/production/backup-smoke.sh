#!/usr/bin/env bash
set -Eeuo pipefail

script_path="${BASH_SOURCE[0]}"
script_dir="${script_path%/*}"
[[ "$script_dir" == "$script_path" ]] && script_dir='.'
script_dir="$(cd -- "$script_dir" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"
restore_compose="$repo_root/compose.restore.yml"
backup_script="$repo_root/scripts/production/backup-postgres.sh"
restore_script="$repo_root/scripts/production/restore-postgres.sh"
backup_tf="$repo_root/infra/terraform/environments/production/backup.tf"
backup_alerts="$repo_root/infra/observability/monium/backup-alerts.yaml"
service_file="$repo_root/scripts/production/systemd/munchkin-postgres-backup.service"
timer_file="$repo_root/scripts/production/systemd/munchkin-postgres-backup.timer"
bash_bin="${BASH:-bash}"

docker_config=false
live=false

usage() {
  cat >&2 <<'USAGE'
usage: backup-smoke.sh [--static] [--docker-config] [--live]

The default mode is a repository-only contract and privacy check. --docker-config
only validates the disposable Compose file. --live is an explicitly separate
remote/runtime mutation gate and is rejected unless an owner starts a dedicated
approved run outside this local smoke.
USAGE
}

while (($# > 0)); do
  case "$1" in
    --static)
      shift
      ;;
    --docker-config)
      docker_config=true
      shift
      ;;
    --live)
      live=true
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 64
      ;;
  esac
done

if [[ "$live" == true ]]; then
  echo 'live backup/restore smoke requires a separate sanitized mutation approval' >&2
  exit 77
fi

die() {
  echo "backup-smoke: $1" >&2
  exit 1
}

for required_file in \
  "$restore_compose" \
  "$backup_script" \
  "$restore_script" \
  "$backup_tf" \
  "$backup_alerts" \
  "$service_file" \
  "$timer_file"; do
  [[ -f "$required_file" ]] || die "required backup artifact is missing: $required_file"
done

for script_file in "$backup_script" "$restore_script"; do
  "$bash_bin" -n "$script_file" || die "Bash syntax failed: $script_file"
done

rg -q 'Metadata-Flavor: Google' "$backup_script" || die 'metadata IAM token header is missing'
rg -q '169\.254\.169\.254/computeMetadata' "$backup_script" || die 'Compute metadata token endpoint is missing'
rg -q 'Authorization: Bearer' "$backup_script" || die 'Bearer S3 authentication is missing'
rg -q -- '--format=custom' "$backup_script" || die 'custom-format pg_dump is missing'
rg -q 'manifest' "$backup_script" || die 'manifest commit marker is missing'
rg -q 'sha256sum' "$backup_script" || die 'checksum verification is missing'
rg -q 'flock' "$backup_script" || die 'concurrency lock is missing'
rg -q 'timeout' "$backup_script" || die 'bounded backup timeout is missing'
rg -q 'docker compose --parallel 8' "$backup_script" || die 'backup Compose calls must use the repository parallelism contract'
rg -q 'munchkin\.backup\.(verified_timestamp|failure)' "$backup_script" || die 'backup telemetry contract is missing'

rg -q -- '--confirm-isolated' "$restore_script" || die 'restore confirmation guard is missing'
rg -q 'DATABASE_URL.*forbidden|TARGET_DATABASE_URL.*forbidden' "$restore_script" || die 'production DSN guard is missing'
rg -q 'munchkin_restore' "$restore_script" || die 'fixed disposable restore target is missing'
rg -q 'pg_restore' "$restore_script" || die 'pg_restore execution is missing'
rg -q 'sha256sum' "$restore_script" || die 'restore checksum verification is missing'
rg -q 'restore-drill-evidence' "$restore_script" || die 'RPO/RTO evidence output is missing'
rg -q 'docker compose --parallel 8' "$restore_script" || die 'restore Compose calls must use the repository parallelism contract'

if rg -q '^\s*ports:' "$restore_compose" || ! rg -q 'internal: true' "$restore_compose" || rg -q 'compose\.production\.yml' "$restore_compose"; then
  die 'restore Compose must be private and independent from production Compose'
fi

rg -q 'disabled_statickey_auth\s*=\s*true' "$backup_tf" || die 'static Object Storage authentication is not disabled'
rg -q 'kms_master_key_id\s*=\s*yandex_kms_symmetric_key\.postgres_backup\.id' "$backup_tf" || die 'bucket KMS encryption is missing'
rg -q 'storage\.uploader' "$backup_tf" || die 'runtime uploader role is missing'
rg -q 'kms\.keys\.encrypter' "$backup_tf" || die 'runtime KMS encryption role is missing'
rg -q 'storage\.viewer' "$backup_tf" || die 'conditional operator viewer role is missing'
rg -q 'kms\.keys\.decrypter' "$backup_tf" || die 'conditional operator KMS decrypt role is missing'
if rg -q 'storage_access_key|storage_secret_key|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|service_account_key|secret_value' "$backup_tf"; then
  die 'static or payload credentials appeared in the backup Terraform graph'
fi

rg -q '03:00:00 Europe/Moscow' "$timer_file" || die 'backup timer is not scheduled at 03:00 Europe/Moscow'
rg -q 'Persistent=true' "$timer_file" || die 'backup timer is not reboot-persistent'
rg -q 'RuntimeMaxSec=55min|TimeoutStartSec=55min' "$service_file" || die 'backup service runtime bound is missing'
rg -q 'ProtectSystem=strict|NoNewPrivileges=yes' "$service_file" || die 'backup systemd hardening is missing'

rg -q 'backup-freshness-over-26h' "$backup_alerts" || die 'freshness alert is missing'
rg -q 'backup-job-failure' "$backup_alerts" || die 'failure alert is missing'
rg -q 'last\(backup_age_hours\) > 26' "$backup_alerts" || die 'freshness threshold is not 26 hours'
rg -q 'owner-only-email-outside-repository' "$backup_alerts" || die 'owner-only alert boundary is missing'

tracked_forbidden="$(git -C "$repo_root" ls-files | rg -i '\.(dump|dump\.gz|sql\.bak|tfstate|tfplan)$|(^|/)(backup|restore)-.*\.(tar|zip|gz)$' || true)"
[[ -z "$tracked_forbidden" ]] || die 'raw dump/state/plan artifact is tracked'

if [[ "$docker_config" == true ]]; then
  RESTORE_POSTGRES_PASSWORD=contract-only \
    docker compose --parallel 8 -f "$restore_compose" config --quiet
fi

echo 'backup-smoke: static backup/restore privacy and safety checks passed'
