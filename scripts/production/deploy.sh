#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

root_dir=/srv/munchkin
compose_dir="$root_dir/compose"
script_dir="$compose_dir/scripts"
secret_dir="$root_dir/secrets"
state_dir="$root_dir/state"
compose_file="$compose_dir/compose.production.yml"
lock_file="$state_dir/deploy.lock"
current_file="$state_dir/current-release.json"
previous_file="$state_dir/previous-release.json"
evidence_file="$state_dir/release-evidence.json"

default_game_image='cr.yandex/crpdnmjudj1usiu90gdn/game@sha256:519ad993f644f30c380f415049f465a8059e23afaa7a0503aeb286624b35e99f'
default_web_image='cr.yandex/crpdnmjudj1usiu90gdn/web@sha256:e79531e3dfa1e642b7f8d4f029bde2f5d048382dd0c5aa80c8da271ea03444bb'
game_image="${MUNCHKIN_GAME_IMAGE:-$default_game_image}"
web_image="${MUNCHKIN_WEB_IMAGE:-$default_web_image}"
commit_sha="${MUNCHKIN_RELEASE_COMMIT:-}"
run_id="${GITHUB_RUN_ID:-0}"
run_attempt="${GITHUB_RUN_ATTEMPT:-0}"
workflow_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-local/munchkin}/actions/runs/${run_id}"
repository="${GITHUB_REPOSITORY:-local/munchkin}"
recover=false
operation=deploy

migration_result=not_run
readiness_result=not_run
smoke_result=not_run
migration_completed_at=''
readiness_completed_at=''
smoke_completed_at=''
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
failure_message=''
docker_config_dir=''

usage() {
  cat >&2 <<'USAGE'
usage: deploy.sh [options]

Deploy an immutable game/web pair through the root-owned production Compose
boundary. --recover loads the last successful pair and only restores it.

options:
  --game-image REF@sha256:DIGEST
  --web-image REF@sha256:DIGEST
  --commit FULL_COMMIT_SHA
  --run-id NUMBER
  --run-attempt NUMBER
  --workflow-url URL
  --recover
USAGE
}

while (($# > 0)); do
  case "$1" in
    --game-image)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      game_image="$2"
      shift 2
      ;;
    --web-image)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      web_image="$2"
      shift 2
      ;;
    --commit)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      commit_sha="$2"
      shift 2
      ;;
    --run-id)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      run_id="$2"
      shift 2
      ;;
    --run-attempt)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      run_attempt="$2"
      shift 2
      ;;
    --workflow-url)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      workflow_url="$2"
      shift 2
      ;;
    --recover)
      recover=true
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
  echo 'deploy.sh must run as root' >&2
  exit 77
fi

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "required command is missing: $1" >&2
    exit 69
  }
}

require_command date
require_command docker
require_command curl
require_command flock
require_command jq
require_command stat
require_command mktemp

if [[ ! -f "$compose_file" ]]; then
  echo 'production Compose file is missing' >&2
  exit 66
fi
install -d -m 0750 -o root -g root "$state_dir"
exec 9>"$lock_file"
flock -n 9 || {
  echo 'another production operation is already running' >&2
  exit 75
}

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

validate_secret_file() {
  local file_path="$1"
  [[ -f "$file_path" ]] || {
    echo "required secret file is missing: $(basename "$file_path")" >&2
    return 1
  }
  [[ "$(stat -c '%u:%a' "$file_path")" == '0:600' ]] || {
    echo "secret file must be root-owned mode 0600: $(basename "$file_path")" >&2
    return 1
  }
}

validate_secret_files() {
  local runtime_secret_dir="${MUNCHKIN_SECRETS_DIR:-$secret_dir}"
  validate_secret_file "$runtime_secret_dir/postgres.env"
  validate_secret_file "$runtime_secret_dir/game.env"
  validate_secret_file "$runtime_secret_dir/traefik.env"
  grep -Eq '^POSTGRES_PASSWORD=[^[:space:]]+$' "$runtime_secret_dir/postgres.env" || {
    echo 'postgres secret file must contain a non-empty POSTGRES_PASSWORD' >&2
    return 1
  }
  grep -Eq '^DATABASE_URL=postgres://[^[:space:]]+$' "$runtime_secret_dir/game.env" || {
    echo 'game secret file must contain a postgres DATABASE_URL' >&2
    return 1
  }
  grep -Eq '^ACME_EMAIL=[^[:space:]]+@[^[:space:]]+$' "$runtime_secret_dir/traefik.env" || {
    echo 'Traefik secret file must contain ACME_EMAIL' >&2
    return 1
  }
  grep -Eq '^ACME_CA_SERVER=https://[^[:space:]]+$' "$runtime_secret_dir/traefik.env" || {
    echo 'Traefik secret file must contain an HTTPS ACME_CA_SERVER' >&2
    return 1
  }
}

stage_json() {
  local stage_result="$1"
  local stage_time="$2"
  if [[ -n "$stage_time" ]]; then
    jq -cn --arg result "$stage_result" --arg completedAt "$stage_time" \
      '{result:$result,completedAt:$completedAt}'
  else
    jq -cn --arg result "$stage_result" '{result:$result}'
  fi
}

previous_release_json() {
  if [[ -f "$current_file" ]] && jq -e '.result == "success"' "$current_file" >/dev/null 2>&1; then
    jq -c '{commit,migrationContract,gameDigest:.images.game.digest,webDigest:.images.web.digest,completedAt}' \
      "$current_file"
  else
    printf 'null\n'
  fi
}

write_evidence() {
  local result="$1"
  local error_value="${2:-}"
  local completed_at
  completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local migration_json readiness_json smoke_json previous_json tmp_file
  migration_json="$(stage_json "$migration_result" "$migration_completed_at")"
  readiness_json="$(stage_json "$readiness_result" "$readiness_completed_at")"
  smoke_json="$(stage_json "$smoke_result" "$smoke_completed_at")"
  previous_json="$(previous_release_json)"
  tmp_file="$(mktemp "$state_dir/release-evidence.XXXXXX")"
  jq -n \
    --arg operation "$operation" \
    --arg result "$result" \
    --arg repository "$repository" \
    --arg commit "$commit_sha" \
    --arg game_ref "${game_image%@sha256:*}:$commit_sha" \
    --arg game_digest "sha256:${game_image##*@sha256:}" \
    --arg game_image "$game_image" \
    --arg web_ref "${web_image%@sha256:*}:$commit_sha" \
    --arg web_digest "sha256:${web_image##*@sha256:}" \
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
      commit:$commit,migrationContract:"health-migrations-v1",images:{game:{ref:$game_ref,digest:$game_digest,image:$game_image},
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
    failure_message="production deploy failed at line ${BASH_LINENO[0]:-unknown}"
  fi
  migration_result=failed
  write_evidence failed "$failure_message" || true
  echo "$failure_message" >&2
  exit "$exit_code"
}
trap on_error ERR

load_current_release() {
  [[ -f "$current_file" ]] || {
    echo 'no successful release is available for recovery' >&2
    return 1
  }
  jq -e '.result == "success" and .images.game.image and .images.web.image' \
    "$current_file" >/dev/null || {
    echo 'current release evidence is invalid for recovery' >&2
    return 1
  }
  game_image="$(jq -er '.images.game.image' "$current_file")"
  web_image="$(jq -er '.images.web.image' "$current_file")"
  commit_sha="$(jq -er '.commit' "$current_file")"
  repository="$(jq -er '.repository' "$current_file")"
  run_id="$(jq -er '.workflow.runId' "$current_file")"
  run_attempt="$(jq -er '.workflow.runAttempt' "$current_file")"
  workflow_url="$(jq -er '.workflow.url' "$current_file")"
}

validate_release_inputs() {
  if [[ ! "$game_image" =~ ^cr\.yandex/crpdnmjudj1usiu90gdn/game@sha256:[0-9a-f]{64}$ ]]; then
    echo 'game image must be the approved Yandex Container Registry digest form' >&2
    return 1
  fi
  if [[ ! "$web_image" =~ ^cr\.yandex/crpdnmjudj1usiu90gdn/web@sha256:[0-9a-f]{64}$ ]]; then
    echo 'web image must be the approved Yandex Container Registry digest form' >&2
    return 1
  fi
  if [[ ! "$commit_sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo 'a full lowercase commit SHA is required' >&2
    return 1
  fi
  if [[ ! "$run_id" =~ ^[0-9]+$ || ! "$run_attempt" =~ ^[0-9]+$ ]]; then
    echo 'workflow run identifiers must be numeric' >&2
    return 1
  fi
  if [[ ! "$repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    echo 'repository must have owner/name form' >&2
    return 1
  fi
  if [[ ! "$workflow_url" =~ ^https://[^[:space:]]+$ ]]; then
    echo 'workflow URL must be an HTTPS URL' >&2
    return 1
  fi
}

configure_environment() {
  local runtime_secret_dir="${MUNCHKIN_SECRETS_DIR:-$secret_dir}"
  local acme_email acme_ca_server
  acme_email="$(awk -F= '$1 == "ACME_EMAIL" { print substr($0, index($0, "=") + 1); exit }' "$runtime_secret_dir/traefik.env" 2>/dev/null || true)"
  acme_ca_server="$(awk -F= '$1 == "ACME_CA_SERVER" { print substr($0, index($0, "=") + 1); exit }' "$runtime_secret_dir/traefik.env" 2>/dev/null || true)"
  export COMPOSE_PROJECT_NAME=munchkin-production
  export MUNCHKIN_GAME_IMAGE="$game_image"
  export MUNCHKIN_WEB_IMAGE="$web_image"
  export MUNCHKIN_RELEASE_COMMIT="$commit_sha"
  export MUNCHKIN_SECRETS_DIR="${MUNCHKIN_SECRETS_DIR:-$secret_dir}"
  export MUNCHKIN_DATA_DIR="${MUNCHKIN_DATA_DIR:-$root_dir}"
  export ACME_EMAIL="$acme_email"
  export ACME_CA_SERVER="$acme_ca_server"
}

wait_for_readiness() {
  local attempt
  for attempt in {1..150}; do
    if compose exec -T game wget -q -O - http://127.0.0.1:8080/health/ready >/dev/null \
      && compose exec -T web wget -q -O - http://127.0.0.1:3000/ >/dev/null \
      && compose exec -T traefik traefik healthcheck --ping >/dev/null 2>&1; then
      readiness_result=passed
      readiness_completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      return 0
    fi
    sleep 2
  done
  failure_message='production services did not become ready'
  return 1
}

atomic_json_copy() {
  local source_file="$1"
  local target_file="$2"
  local temp_file
  temp_file="$(mktemp "$state_dir/atomic-json.XXXXXX")"
  jq '.' "$source_file" >"$temp_file"
  chmod 0600 "$temp_file"
  mv -f "$temp_file" "$target_file"
}

finalize_success() {
  local old_previous_json previous_temp current_temp
  old_previous_json="$(previous_release_json)"
  write_evidence success ''

  previous_temp="$(mktemp "$state_dir/previous-release.XXXXXX")"
  printf '%s\n' "$old_previous_json" | jq '.' >"$previous_temp"
  chmod 0600 "$previous_temp"
  mv -f "$previous_temp" "$previous_file"

  current_temp="$(mktemp "$state_dir/current-release.XXXXXX")"
  jq '.' "$evidence_file" >"$current_temp"
  chmod 0600 "$current_temp"
  mv -f "$current_temp" "$current_file"
}

if [[ "$recover" == true ]]; then
  load_current_release
fi
validate_release_inputs

configure_environment
validate_secret_files
compose config --quiet

trap cleanup_registry_auth EXIT
registry_login
compose pull postgres game web traefik
compose up -d postgres
compose run --rm migrate
migration_result=passed
migration_completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

compose up -d game web traefik
wait_for_readiness

if [[ ! -x "$script_dir/smoke.sh" ]]; then
  failure_message='production smoke script is missing or not executable'
  false
fi
"$script_dir/smoke.sh" --internal --public --host "${MUNCHKIN_PUBLIC_HOST:-munchkin.l1ttl3h0rse.ru}"
smoke_result=passed
smoke_completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

finalize_success
trap - ERR
echo "production deploy completed for commit $commit_sha"
