#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

root_dir=/srv/munchkin
compose_file="$root_dir/compose/compose.production.yml"
script_dir="$root_dir/compose/scripts"
secret_dir="$root_dir/secrets"
state_dir="$root_dir/state"
current_file="$state_dir/current-release.json"
previous_file="$state_dir/previous-release.json"
evidence_file="$state_dir/release-evidence.json"
lock_file="$state_dir/deploy.lock"
public_host="${MUNCHKIN_PUBLIC_HOST:-munchkin.l1ttl3h0rse.ru}"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readiness_result=not_run
smoke_result=not_run
readiness_completed_at=''
smoke_completed_at=''
failure_message=''
docker_config_dir=''

if ((EUID != 0)); then
  echo 'rollback.sh must run as root' >&2
  exit 77
fi
for required_command in curl date docker flock jq mktemp stat; do
  command -v "$required_command" >/dev/null 2>&1 || {
    echo "required command is missing: $required_command" >&2
    exit 69
  }
done
if [[ ! "$public_host" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo 'public smoke host contains unsupported characters' >&2
  exit 64
fi
[[ -f "$current_file" && -f "$previous_file" ]] || {
  echo 'current and previous release evidence are required' >&2
  exit 66
}

jq -e '.result == "success" and .migrationContract == "health-migrations-v1"' \
  "$current_file" >/dev/null || {
  echo 'current release is not a compatible successful release' >&2
  exit 65
}
jq -e '. != null and .migrationContract == "health-migrations-v1"' \
  "$previous_file" >/dev/null || {
  echo 'previous release is absent or has an incompatible migration contract' >&2
  exit 65
}

current_contract="$(jq -er '.migrationContract' "$current_file")"
previous_contract="$(jq -er '.migrationContract' "$previous_file")"
[[ "$current_contract" == "$previous_contract" ]] || {
  echo 'current and previous migration contracts differ' >&2
  exit 65
}

current_game_image="$(jq -er '.images.game.image' "$current_file")"
current_web_image="$(jq -er '.images.web.image' "$current_file")"
rollback_commit="$(jq -er '.commit' "$previous_file")"
game_repo="${current_game_image%@sha256:*}"
web_repo="${current_web_image%@sha256:*}"
game_digest="$(jq -er '.gameDigest' "$previous_file")"
web_digest="$(jq -er '.webDigest' "$previous_file")"
game_image="$game_repo@$game_digest"
web_image="$web_repo@$web_digest"
repository="$(jq -er '.repository' "$current_file")"
run_id="$(jq -er '.workflow.runId' "$current_file")"
run_attempt="$(jq -er '.workflow.runAttempt' "$current_file")"
workflow_url="$(jq -er '.workflow.url' "$current_file")"
if [[ ! "$game_image" =~ ^cr\.yandex/crpdnmjudj1usiu90gdn/game@sha256:[0-9a-f]{64}$ || \
  ! "$web_image" =~ ^cr\.yandex/crpdnmjudj1usiu90gdn/web@sha256:[0-9a-f]{64}$ || \
  ! "$rollback_commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'previous release image or commit is not an approved immutable value' >&2
  exit 64
fi

[[ -f "$compose_file" ]] || { echo 'production Compose file is missing' >&2; exit 66; }
[[ -x "$script_dir/smoke.sh" ]] || { echo 'production smoke script is missing' >&2; exit 66; }
install -d -m 0750 -o root -g root "$state_dir"
exec 9>"$lock_file"
flock -n 9 || { echo 'another production operation is already running' >&2; exit 75; }

export COMPOSE_PROJECT_NAME=munchkin-production
export MUNCHKIN_GAME_IMAGE="$game_image"
export MUNCHKIN_WEB_IMAGE="$web_image"
export MUNCHKIN_RELEASE_COMMIT="$rollback_commit"
export MUNCHKIN_SECRETS_DIR="${MUNCHKIN_SECRETS_DIR:-$secret_dir}"
export MUNCHKIN_DATA_DIR="${MUNCHKIN_DATA_DIR:-$root_dir}"
runtime_secret_dir="$MUNCHKIN_SECRETS_DIR"
export ACME_EMAIL="$(awk -F= '$1 == "ACME_EMAIL" { print substr($0, index($0, "=") + 1); exit }' "$runtime_secret_dir/traefik.env" 2>/dev/null || true)"
export ACME_CA_SERVER="$(awk -F= '$1 == "ACME_CA_SERVER" { print substr($0, index($0, "=") + 1); exit }' "$runtime_secret_dir/traefik.env" 2>/dev/null || true)"

compose() {
  docker compose --parallel 8 -f "$compose_file" "$@"
}

cleanup_registry_auth() {
  if [[ -n "$docker_config_dir" && -d "$docker_config_dir" ]]; then
    rm -rf -- "$docker_config_dir"
  fi
}

registry_login() {
  local token_response token
  docker_config_dir="$(mktemp -d "$state_dir/docker-config.XXXXXX")"
  chmod 0700 "$docker_config_dir"
  export DOCKER_CONFIG="$docker_config_dir"
  token_response="$(curl --fail --silent --show-error --max-time 10 \
    --header 'Metadata-Flavor: Google' \
    http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token)"
  token="$(jq -er '.access_token' <<<"$token_response")"
  printf '%s' "$token" | docker login --username iam --password-stdin cr.yandex >/dev/null
  unset token token_response
}

write_stage() {
  local result="$1"
  local completed_at="$2"
  if [[ -n "$completed_at" ]]; then
    jq -cn --arg result "$result" --arg completedAt "$completed_at" \
      '{result:$result,completedAt:$completedAt}'
  else
    jq -cn --arg result "$result" '{result:$result}'
  fi
}

write_evidence() {
  local result="$1"
  local error_value="${2:-}"
  local completed_at migration_json readiness_json smoke_json previous_json tmp_file
  completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  migration_json="$(write_stage not_run '')"
  readiness_json="$(write_stage "$readiness_result" "$readiness_completed_at")"
  smoke_json="$(write_stage "$smoke_result" "$smoke_completed_at")"
  previous_json="$(jq -c '{commit,migrationContract,gameDigest:.images.game.digest,webDigest:.images.web.digest,completedAt}' "$current_file")"
  tmp_file="$(mktemp "$state_dir/release-evidence.XXXXXX")"
  jq -n \
    --arg operation rollback \
    --arg result "$result" \
    --arg repository "$repository" \
    --arg commit "$rollback_commit" \
    --arg game_ref "${game_image%@sha256:*}:$rollback_commit" \
    --arg game_digest "$game_digest" \
    --arg game_image "$game_image" \
    --arg web_ref "${web_image%@sha256:*}:$rollback_commit" \
    --arg web_digest "$web_digest" \
    --arg web_image "$web_image" \
    --arg run_id "$run_id" \
    --arg run_attempt "$run_attempt" \
    --arg workflow_url "$workflow_url" \
    --arg started_at "$started_at" \
    --arg completed_at "$completed_at" \
    --arg error "$error_value" \
    --argjson migration "$migration_json" \
    --argjson readiness "$readiness_json" \
    --argjson smoke "$smoke_json" \
    --argjson previousRelease "$previous_json" \
    '{schemaVersion:1,operation:$operation,result:$result,repository:$repository,
      commit:$commit,migrationContract:"health-migrations-v1",
      images:{game:{ref:$game_ref,digest:$game_digest,image:$game_image},
      web:{ref:$web_ref,digest:$web_digest,image:$web_image}},
      workflow:{runId:$run_id,runAttempt:$run_attempt,url:$workflow_url},
      startedAt:$started_at,completedAt:$completed_at,migration:$migration,
      readiness:$readiness,smoke:$smoke,previousRelease:$previousRelease,
      error:(if $error == "" then null else $error end)}' >"$tmp_file"
  chmod 0600 "$tmp_file"
  mv -f "$tmp_file" "$evidence_file"
}

on_error() {
  local exit_code="$?"
  if [[ -z "$failure_message" ]]; then
    failure_message="production rollback failed at line ${BASH_LINENO[0]:-unknown}"
  fi
  write_evidence failed "$failure_message" || true
  echo "$failure_message" >&2
  exit "$exit_code"
}
trap on_error ERR

compose config --quiet
trap cleanup_registry_auth EXIT
registry_login
compose pull game web
compose up -d postgres
compose up -d --no-deps game web traefik

for attempt in {1..150}; do
  if compose exec -T game wget -q -O - http://127.0.0.1:8080/health/ready >/dev/null \
    && compose exec -T web wget -q -O - http://127.0.0.1:3000/ >/dev/null \
    && compose exec -T traefik traefik healthcheck --ping >/dev/null 2>&1; then
    readiness_result=passed
    readiness_completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    break
  fi
  sleep 2
done
[[ "$readiness_result" == passed ]] || {
  failure_message='rollback services did not become ready'
  false
}

"$script_dir/smoke.sh" --internal --public --host "$public_host"
smoke_result=passed
smoke_completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

old_current="$(jq -c '{commit,migrationContract,gameDigest:.images.game.digest,webDigest:.images.web.digest,completedAt}' "$current_file")"
write_evidence success ''
previous_temp="$(mktemp "$state_dir/previous-release.XXXXXX")"
printf '%s\n' "$old_current" | jq '.' >"$previous_temp"
chmod 0600 "$previous_temp"
mv -f "$previous_temp" "$previous_file"
current_temp="$(mktemp "$state_dir/current-release.XXXXXX")"
jq '.' "$evidence_file" >"$current_temp"
chmod 0600 "$current_temp"
mv -f "$current_temp" "$current_file"
trap - ERR
echo "production rollback completed for commit $rollback_commit"
