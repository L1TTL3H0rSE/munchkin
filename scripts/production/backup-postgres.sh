#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

root_dir="${MUNCHKIN_DATA_DIR:-/srv/munchkin}"
compose_file="${COMPOSE_FILE:-$root_dir/compose/compose.production.yml}"
state_dir="${BACKUP_STATE_DIR:-$root_dir/state}"
work_dir="${BACKUP_WORK_DIR:-$root_dir/backup-work}"
bucket="${BACKUP_BUCKET:-}"
prefix="${BACKUP_PREFIX:-munchkin/postgres}"
s3_endpoint="${BACKUP_S3_ENDPOINT:-https://storage.yandexcloud.net}"
release_file="${RELEASE_EVIDENCE_FILE:-$state_dir/current-release.json}"
status_file="${BACKUP_STATUS_FILE:-$state_dir/postgres-backup-status.json}"
dump_timeout_seconds="${BACKUP_DUMP_TIMEOUT_SECONDS:-3300}"
publish_metrics="${BACKUP_PUBLISH_METRICS:-true}"

run_id=''
created_at=''
local_date=''
daily_key=''
weekly_key=''
manifest_key=''
release_sha='unknown'
migration_version='unknown'
pg_version='unknown'
dump_file=''
verify_file=''
manifest_file=''
curl_config=''
iam_token=''
lock_file=''
failure_stage='startup'
last_sha256=''
last_size_bytes='0'
archive_size_bytes='0'

usage() {
  cat >&2 <<'USAGE'
usage: backup-postgres.sh

Runs one root-owned, keyless PostgreSQL custom-format backup. The bucket name
must be supplied as BACKUP_BUCKET. The script obtains a short-lived IAM token
from Compute metadata, uploads immutable objects through the HTTPS S3 API, and
publishes the manifest only after read-after-write checksum verification.
USAGE
}

if [[ "${1:-}" == '--help' ]]; then
  usage
  exit 0
fi
[[ $# -eq 0 ]] || { usage; exit 64; }

if ((EUID != 0)); then
  echo 'backup-postgres.sh must run as root' >&2
  exit 77
fi

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "required command is missing: $1" >&2
    exit 69
  }
}

for command_name in date curl docker flock jq mktemp sha256sum stat timeout tr awk tail; do
  require_command "$command_name"
done

[[ -n "$bucket" && "$bucket" =~ ^[a-z0-9][a-z0-9.-]{2,62}[a-z0-9]$ ]] || {
  echo 'BACKUP_BUCKET must be an exact Object Storage bucket name' >&2
  exit 64
}
[[ "$prefix" =~ ^[A-Za-z0-9/_-]+$ ]] || {
  echo 'BACKUP_PREFIX contains unsupported characters' >&2
  exit 64
}
[[ "$s3_endpoint" =~ ^https://[A-Za-z0-9.-]+$ ]] || {
  echo 'BACKUP_S3_ENDPOINT must be an HTTPS origin without a path' >&2
  exit 64
}
[[ "$dump_timeout_seconds" =~ ^[1-9][0-9]{2,4}$ ]] || {
  echo 'BACKUP_DUMP_TIMEOUT_SECONDS must be a bounded number of seconds' >&2
  exit 64
}
[[ -f "$compose_file" ]] || {
  echo 'production Compose file is missing' >&2
  exit 66
}

install -d -m 0750 -o root -g root "$state_dir" "$work_dir"
lock_file="$state_dir/postgres-backup.lock"
exec 9>"$lock_file"
flock -n 9 || {
  echo 'another PostgreSQL backup is already running' >&2
  exit 75
}

compose() {
  docker compose --parallel 8 -f "$compose_file" "$@"
}

cleanup_files() {
  [[ -z "$dump_file" ]] || rm -f -- "$dump_file"
  [[ -z "$verify_file" ]] || rm -f -- "$verify_file"
  [[ -z "$manifest_file" ]] || rm -f -- "$manifest_file"
  [[ -z "$curl_config" ]] || rm -f -- "$curl_config"
  unset iam_token
}

publish_metric() {
  local result="$1"
  local verified_timestamp="$2"
  local failure_value='0'
  local success_value='0'
  local payload

  [[ "$publish_metrics" == 'false' ]] && return 0
  [[ -f "$compose_file" ]] || return 0
  [[ "$result" == 'failure' ]] && failure_value='1'
  [[ "$result" == 'success' ]] && success_value='1'

  payload="$(jq -cn \
    --argjson verified_timestamp "${verified_timestamp:-0}" \
    --argjson success "$success_value" \
    --argjson failure "$failure_value" \
    --argjson size "${archive_size_bytes:-0}" \
    '{resourceMetrics:[{resource:{attributes:[
      {key:"service.name",value:{stringValue:"munchkin-backup"}},
      {key:"deployment.environment",value:{stringValue:"production"}},
      {key:"backup.kind",value:{stringValue:"postgres"}}
    ]},scopeMetrics:[{scope:{name:"munchkin.backup"},metrics:[
      {name:"munchkin.backup.verified_timestamp",unit:"s",gauge:{dataPoints:[{asDouble:$verified_timestamp}]}},
      {name:"munchkin.backup.success",unit:"1",gauge:{dataPoints:[{asDouble:$success}]}},
      {name:"munchkin.backup.failure",unit:"1",gauge:{dataPoints:[{asDouble:$failure}]}},
      {name:"munchkin.backup.archive_size_bytes",unit:"By",gauge:{dataPoints:[{asDouble:$size}]}}
    ]}]}]}')"

  # The game container shares the private observability network with the
  # Collector. Metric publication is best-effort and never makes a verified
  # archive look failed; the root-owned status file remains the local source.
  compose exec -T -e BACKUP_METRIC_PAYLOAD="$payload" game sh -ceu '
    endpoint="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://collector:4318}"
    case "$endpoint" in
      http://collector:4318|http://collector:4318/)
        ;;
      *)
        exit 0
        ;;
    esac
    wget -q -O /dev/null \
      --header="Content-Type: application/json" \
      --post-data="${BACKUP_METRIC_PAYLOAD:?}" \
      "$endpoint/v1/metrics"
  ' >/dev/null 2>&1 || true
}

write_status() {
  local result="$1"
  local stage="$2"
  local verified_timestamp="${3:-0}"
  local observed_at
  local status_tmp

  observed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  status_tmp="$(mktemp "$state_dir/postgres-backup-status.XXXXXX")"
  jq -n \
    --arg result "$result" \
    --arg stage "$stage" \
    --arg verified_at "$observed_at" \
    --arg manifest_key "$manifest_key" \
    --arg release_sha "$release_sha" \
    --argjson verified_timestamp "$verified_timestamp" \
    --argjson size_bytes "${last_size_bytes:-0}" \
    '{schemaVersion:1,kind:"munchkin.postgres.backup.status",result:$result,
      failure_stage:($stage | if . == "" then null else . end),
      observed_at:$verified_at,verified_timestamp:$verified_timestamp,
      manifest_key:($manifest_key | if . == "" then null else . end),
      release_sha:$release_sha,size_bytes:$size_bytes}' >"$status_tmp"
  chmod 0640 "$status_tmp"
  mv -f -- "$status_tmp" "$status_file"
  publish_metric "$result" "$verified_timestamp"
}

on_exit() {
  local exit_code=$?
  local now_epoch='0'
  if [[ "$exit_code" -eq 0 ]]; then
    now_epoch="$(date -u +%s)"
    write_status success '' "$now_epoch" || true
  else
    write_status failure "$failure_stage" 0 || true
    echo "postgres backup failed at $failure_stage" >&2
  fi
  cleanup_files
  exit "$exit_code"
}
trap on_exit EXIT

failure_stage='metadata-token'
token_response="$(curl --fail --silent --show-error --proto '=http' --max-time 10 \
  --header 'Metadata-Flavor: Google' \
  http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token)"
iam_token="$(jq -er '.access_token' <<<"$token_response")"
unset token_response
[[ "$iam_token" =~ ^[A-Za-z0-9._-]+$ ]] || {
  echo 'metadata service returned an invalid IAM token shape' >&2
  exit 65
}

failure_stage='curl-auth-config'
curl_config="$(mktemp "$work_dir/curl-config.XXXXXX")"
chmod 0600 "$curl_config"
printf 'header = "Authorization: Bearer %s"\n' "$iam_token" >"$curl_config"
unset iam_token

failure_stage='database-metadata'
pg_version="$(compose exec -T postgres sh -ceu 'pg_dump --version' | awk '{print $3}' | tr -d '\r')"
[[ "$pg_version" =~ ^17\.[0-9]+$ ]] || {
  echo 'the production pg_dump major version is not the approved PostgreSQL 17 line' >&2
  exit 65
}
migration_version="$(compose exec -T postgres sh -ceu \
  'PGUSER="${POSTGRES_USER:?}" PGDATABASE="${POSTGRES_DB:?}" psql -XAtqc "SELECT COALESCE(max(version), '\''unknown'\'') FROM munchkin_schema_migrations"' \
  | tr -d '\r\n')"
[[ -n "$migration_version" && "$migration_version" =~ ^[A-Za-z0-9_.-]+$ ]] || {
  echo 'migration ledger returned an unsupported version shape' >&2
  exit 65
}

run_id="$(TZ=Europe/Moscow date +%Y%m%dT%H%M%SZ)-$$"
created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
local_date="$(TZ=Europe/Moscow date +%Y-%m-%d)"
daily_key="$prefix/daily/$local_date-$run_id.dump"
manifest_key="$prefix/manifests/$local_date-$run_id.json"
if [[ "$(TZ=Europe/Moscow date -u +%u)" == '7' ]]; then
  weekly_key="$prefix/weekly/$local_date-$run_id.dump"
fi

if [[ -f "$release_file" ]]; then
  release_sha="$(jq -er '.commit // "unknown"' "$release_file" 2>/dev/null || printf 'unknown')"
fi
[[ "$release_sha" == 'unknown' || "$release_sha" =~ ^[0-9a-f]{40}$ ]] || release_sha='unknown'

dump_file="$work_dir/$run_id.dump"
verify_file="$work_dir/$run_id.verify"
manifest_file="$work_dir/$run_id.manifest.json"

failure_stage='pg-dump'
timeout --signal=TERM --kill-after=30s "${dump_timeout_seconds}s" \
  docker compose --parallel 8 -f "$compose_file" exec -T postgres sh -ceu \
  'exec pg_dump --format=custom --no-owner --no-privileges --file=- -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  >"$dump_file"
chmod 0600 "$dump_file"
last_size_bytes="$(stat -c '%s' "$dump_file")"
archive_size_bytes="$last_size_bytes"
[[ "$last_size_bytes" =~ ^[1-9][0-9]*$ ]] || {
  echo 'pg_dump produced an empty archive' >&2
  exit 65
}
last_sha256="$(sha256sum "$dump_file" | awk '{print $1}')"

object_url() {
  local object_key="$1"
  printf '%s/%s/%s' "$s3_endpoint" "$bucket" "$object_key"
}

upload_and_verify() {
  local source_file="$1"
  local object_key="$2"
  local expected_sha256 expected_size remote_size downloaded_sha256
  local header_file

  expected_sha256="$(sha256sum "$source_file" | awk '{print $1}')"
  expected_size="$(stat -c '%s' "$source_file")"
  header_file="$(mktemp "$work_dir/head.XXXXXX")"
  failure_stage="upload:$object_key"
  curl --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 120 \
    --config "$curl_config" --request PUT --upload-file "$source_file" \
    --header 'Content-Type: application/octet-stream' \
    "$(object_url "$object_key")" >/dev/null
  curl --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 30 \
    --config "$curl_config" --request HEAD --dump-header "$header_file" \
    --output /dev/null "$(object_url "$object_key")"
  remote_size="$(awk 'tolower($1) == "content-length:" {print $2}' "$header_file" | tr -d '\r' | tail -n 1)"
  rm -f -- "$header_file"
  [[ "$remote_size" == "$expected_size" ]] || {
    echo "remote object size mismatch for role $object_key" >&2
    exit 65
  }
  rm -f -- "$verify_file"
  curl --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 180 \
    --config "$curl_config" --request GET --output "$verify_file" \
    "$(object_url "$object_key")"
  downloaded_sha256="$(sha256sum "$verify_file" | awk '{print $1}')"
  rm -f -- "$verify_file"
  [[ "$downloaded_sha256" == "$expected_sha256" ]] || {
    echo "remote object checksum mismatch for role $object_key" >&2
    exit 65
  }
  last_sha256="$expected_sha256"
  last_size_bytes="$expected_size"
}

failure_stage='daily-upload'
upload_and_verify "$dump_file" "$daily_key"
objects_json="$(jq -cn \
  --arg role daily --arg key "$daily_key" --arg sha256 "$last_sha256" \
  --argjson size_bytes "$last_size_bytes" \
  '[{role:$role,key:$key,sha256:$sha256,size_bytes:$size_bytes}]')"

if [[ -n "$weekly_key" ]]; then
  failure_stage='weekly-upload'
  upload_and_verify "$dump_file" "$weekly_key"
  objects_json="$(jq -cn \
    --argjson objects "$objects_json" --arg role weekly --arg key "$weekly_key" \
    --arg sha256 "$last_sha256" --argjson size_bytes "$last_size_bytes" \
    '$objects + [{role:$role,key:$key,sha256:$sha256,size_bytes:$size_bytes}]')"
fi

failure_stage='manifest-build'
jq -n \
  --arg created_at "$created_at" \
  --arg local_date "$local_date" \
  --arg pg_version "$pg_version" \
  --arg migration_version "$migration_version" \
  --arg release_sha "$release_sha" \
  --argjson objects "$objects_json" \
  '{schemaVersion:1,kind:"munchkin.postgres.backup",status:"verified",
    createdAt:$created_at,backupDate:$local_date,checksumAlgorithm:"SHA-256",
    postgres:{version:$pg_version,format:"custom",schemaAndData:true},
    migration:{version:$migration_version},release:{sha:$release_sha},
    retention:{daily:7,weekly:4},objects:$objects}' >"$manifest_file"
chmod 0600 "$manifest_file"

failure_stage='manifest-commit'
upload_and_verify "$manifest_file" "$manifest_key"
failure_stage='complete'
exit 0
