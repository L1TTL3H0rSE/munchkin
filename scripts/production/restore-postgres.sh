#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

root_dir="${MUNCHKIN_DATA_DIR:-/srv/munchkin}"
restore_compose="${RESTORE_COMPOSE_FILE:-$root_dir/compose/compose.restore.yml}"
state_dir="${RESTORE_STATE_DIR:-$root_dir/state}"
work_dir=''
bucket="${BACKUP_BUCKET:-}"
manifest_key=''
s3_endpoint="${BACKUP_S3_ENDPOINT:-https://storage.yandexcloud.net}"
iam_token=''
restore_project=''
restore_started=false
restore_postgres_db="${RESTORE_POSTGRES_DB:-munchkin_restore}"
restore_postgres_user="${RESTORE_POSTGRES_USER:-munchkin_restore}"
restore_password=''
manifest_file=''
archive_file=''
curl_config=''
drill_started_at=''
failure_stage='startup'

usage() {
  cat >&2 <<'USAGE'
usage: restore-postgres.sh --bucket BUCKET --manifest-key KEY --confirm-isolated

Downloads one committed manifest through an operator-supplied short-lived IAM
token and restores its PostgreSQL custom-format archive into a disposable,
private Compose database. A production DSN or production Compose file is
always rejected. The IAM token may be supplied in BACKUP_IAM_TOKEN for a
single process or entered interactively without echo.
USAGE
}

confirm_isolated=false
while (($# > 0)); do
  case "$1" in
    --bucket)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      bucket="$2"
      shift 2
      ;;
    --manifest-key)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      manifest_key="$2"
      shift 2
      ;;
    --confirm-isolated)
      confirm_isolated=true
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

if ((EUID != 0)); then
  echo 'restore-postgres.sh must run as root inside the approved operator boundary' >&2
  exit 77
fi
[[ "$confirm_isolated" == true ]] || {
  echo 'restore requires --confirm-isolated and never accepts a production target' >&2
  exit 64
}
[[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" =~ ^postgres ]] && {
  echo 'DATABASE_URL is forbidden for restore; use only the disposable Compose target' >&2
  exit 64
}
[[ -n "${TARGET_DATABASE_URL:-}" ]] && {
  echo 'TARGET_DATABASE_URL is forbidden for restore' >&2
  exit 64
}
[[ "$restore_postgres_db" == 'munchkin_restore' && "$restore_postgres_user" == 'munchkin_restore' ]] || {
  echo 'restore target database and user are fixed disposable names' >&2
  exit 64
}
[[ "$bucket" =~ ^[a-z0-9][a-z0-9.-]{2,62}[a-z0-9]$ ]] || {
  echo 'BACKUP_BUCKET must be an exact Object Storage bucket name' >&2
  exit 64
}
[[ "$manifest_key" =~ ^munchkin/postgres/manifests/[A-Za-z0-9_.-]+\.json$ ]] || {
  echo 'manifest key must be an exact committed PostgreSQL backup key' >&2
  exit 64
}
[[ "$s3_endpoint" =~ ^https://[A-Za-z0-9.-]+$ ]] || {
  echo 'BACKUP_S3_ENDPOINT must be an HTTPS origin without a path' >&2
  exit 64
}
[[ -f "$restore_compose" ]] || {
  echo 'isolated restore Compose file is missing' >&2
  exit 66
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "required command is missing: $1" >&2
    exit 69
  }
}

for command_name in awk curl date docker jq mktemp readlink sha256sum stat timeout tr; do
  require_command "$command_name"
done
require_command openssl

if [[ -n "${BACKUP_IAM_TOKEN:-}" ]]; then
  iam_token="$BACKUP_IAM_TOKEN"
else
  read -r -s -p 'Object Storage IAM token (input is not echoed): ' iam_token
  printf '\n' >&2
fi
unset BACKUP_IAM_TOKEN
[[ "$iam_token" =~ ^[A-Za-z0-9._-]+$ ]] || {
  echo 'operator IAM token has an invalid shape' >&2
  exit 65
}

state_dir="$(readlink -f "$state_dir")"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/munchkin-restore.XXXXXX")"
chmod 0700 "$work_dir"
restore_project="munchkin-restore-$(date -u +%Y%m%d%H%M%S)-$$"
restore_project="${restore_project//[^a-zA-Z0-9_-]/-}"
drill_started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cleanup() {
  local exit_code=$?
  if [[ "$restore_started" == true ]]; then
    docker compose --parallel 8 -p "$restore_project" -f "$restore_compose" \
      down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  [[ -z "$curl_config" ]] || rm -f -- "$curl_config"
  [[ -z "$manifest_file" ]] || rm -f -- "$manifest_file"
  [[ -z "$archive_file" ]] || rm -f -- "$archive_file"
  [[ -z "$work_dir" ]] || rm -rf -- "$work_dir"
  unset iam_token restore_password
  exit "$exit_code"
}
trap cleanup EXIT

curl_config="$(mktemp "$work_dir/curl-config.XXXXXX")"
chmod 0600 "$curl_config"
printf 'header = "Authorization: Bearer %s"\n' "$iam_token" >"$curl_config"
unset iam_token

object_url() {
  printf '%s/%s/%s' "$s3_endpoint" "$bucket" "$1"
}

manifest_file="$work_dir/manifest.json"
archive_file="$work_dir/postgres.dump"

failure_stage='manifest-download'
curl --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 60 \
  --config "$curl_config" --request GET --output "$manifest_file" \
  "$(object_url "$manifest_key")"

failure_stage='manifest-validation'
jq -e '
  .schemaVersion == 1 and
  .kind == "munchkin.postgres.backup" and
  .status == "verified" and
  (.checksumAlgorithm == "SHA-256") and
  (.postgres.format == "custom") and
  (.postgres.schemaAndData == true) and
  (.objects | type == "array" and length >= 1) and
  ((.objects | map(select(.role == "daily")) | length) == 1) and
  ((.objects | map(select(.key | test("^munchkin/postgres/(daily|weekly)/[A-Za-z0-9_.-]+\\.dump$"))) | length) == (.objects | length)) and
  ((.objects | map(select(.sha256 | test("^[0-9a-f]{64}$"))) | length) == (.objects | length))
' "$manifest_file" >/dev/null

archive_key="$(jq -er '[.objects[] | select(.role == "daily")][0].key' "$manifest_file")"
expected_sha256="$(jq -er '[.objects[] | select(.role == "daily")][0].sha256' "$manifest_file")"
expected_size="$(jq -er '[.objects[] | select(.role == "daily")][0].size_bytes' "$manifest_file")"
[[ "$expected_size" =~ ^[1-9][0-9]*$ ]] || {
  echo 'manifest archive size is invalid' >&2
  exit 65
}

failure_stage='archive-download'
curl --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 180 \
  --config "$curl_config" --request GET --output "$archive_file" \
  "$(object_url "$archive_key")"
actual_size="$(stat -c '%s' "$archive_file")"
actual_sha256="$(sha256sum "$archive_file" | awk '{print $1}')"
[[ "$actual_size" == "$expected_size" && "$actual_sha256" == "$expected_sha256" ]] || {
  echo 'downloaded archive failed manifest size/checksum verification' >&2
  exit 65
}

failure_stage='restore-start'
restore_password="$(openssl rand -hex 24)"
export RESTORE_POSTGRES_DB="$restore_postgres_db"
export RESTORE_POSTGRES_USER="$restore_postgres_user"
export RESTORE_POSTGRES_PASSWORD="$restore_password"
export RESTORE_WORK_DIR="$work_dir"
restore_started=true
docker compose --parallel 8 -p "$restore_project" -f "$restore_compose" up -d postgres-restore >/dev/null

failure_stage='restore-health'
for attempt in {1..60}; do
  if docker compose --parallel 8 -p "$restore_project" -f "$restore_compose" \
    exec -T postgres-restore pg_isready -U "$restore_postgres_user" -d "$restore_postgres_db" >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 60 ]]; then
    echo 'isolated restore database did not become healthy' >&2
    exit 75
  fi
  sleep 2
done

failure_stage='archive-list'
docker compose --parallel 8 -p "$restore_project" -f "$restore_compose" \
  exec -T postgres-restore pg_restore --list /restore/postgres.dump >/dev/null

failure_stage='archive-restore'
timeout --signal=TERM --kill-after=30s 2700s \
  docker compose --parallel 8 -p "$restore_project" -f "$restore_compose" \
  exec -T postgres-restore pg_restore --clean --if-exists --no-owner --no-privileges \
  --exit-on-error --dbname="$restore_postgres_db" /restore/postgres.dump >/dev/null

failure_stage='compatibility-smoke'
schema_ok="$(docker compose --parallel 8 -p "$restore_project" -f "$restore_compose" \
  exec -T postgres-restore psql -XAtqc \
  "SELECT CASE WHEN to_regclass('public.munchkin_schema_migrations') IS NOT NULL AND to_regclass('public.games') IS NOT NULL AND to_regclass('public.game_events') IS NOT NULL THEN 1 ELSE 0 END" \
  | tr -d '\r\n')"
[[ "$schema_ok" == '1' ]] || {
  echo 'isolated restore is missing the application schema contract' >&2
  exit 65
}
row_count="$(docker compose --parallel 8 -p "$restore_project" -f "$restore_compose" \
  exec -T postgres-restore psql -XAtqc 'SELECT count(*) FROM games' | tr -d '\r\n')"
[[ "$row_count" =~ ^[0-9]+$ ]] || {
  echo 'isolated restore row-count smoke returned an invalid value' >&2
  exit 65
}

completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
started_epoch="$(date -d "$drill_started_at" +%s)"
completed_epoch="$(date -d "$completed_at" +%s)"
backup_created_at="$(jq -er '.createdAt' "$manifest_file")"
backup_created_epoch="$(date -d "$backup_created_at" +%s)"
elapsed_seconds=$((completed_epoch - started_epoch))
rpo_hours=$(( (completed_epoch - backup_created_epoch) / 3600 ))
[[ "$elapsed_seconds" -le 3600 && "$rpo_hours" -le 24 ]] || {
  echo 'isolated restore exceeded the approved RTO/RPO targets' >&2
  exit 65
}

install -d -m 0750 -o root -g root "$state_dir"
evidence_tmp="$(mktemp "$state_dir/restore-drill-evidence.XXXXXX")"
jq -n \
  --arg manifest_key "$manifest_key" \
  --arg archive_key "$archive_key" \
  --arg started_at "$drill_started_at" \
  --arg completed_at "$completed_at" \
  --argjson elapsed_seconds "$elapsed_seconds" \
  --argjson rpo_hours "$rpo_hours" \
  --argjson restored_game_rows "$row_count" \
  '{schemaVersion:1,kind:"munchkin.postgres.restore.drill",result:"success",
    target:"isolated-disposable-compose-database",manifest_key:$manifest_key,
    archive_key:$archive_key,startedAt:$started_at,completedAt:$completed_at,
    elapsed_seconds:$elapsed_seconds,rpo_hours:$rpo_hours,
    restored_game_rows:$restored_game_rows}' >"$evidence_tmp"
chmod 0640 "$evidence_tmp"
mv -f -- "$evidence_tmp" "$state_dir/restore-drill-evidence.json"
echo "isolated PostgreSQL restore passed: elapsed=${elapsed_seconds}s rpo_hours=${rpo_hours}"
