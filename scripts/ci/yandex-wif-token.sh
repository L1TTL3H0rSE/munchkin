#!/usr/bin/env bash
set -euo pipefail

die() {
  printf 'yandex-wif-token: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command is missing: $1"
}

require_env() {
  [[ -n "${!1:-}" ]] || die "required environment variable is missing: $1"
}

decode_base64url() {
  local value="$1"
  local remainder
  value="${value//-/+}"
  value="${value//_//}"
  remainder=$(( ${#value} % 4 ))
  case "$remainder" in
    0) ;;
    2) value+="==" ;;
    3) value+="=" ;;
    *) die "invalid base64url JWT segment" ;;
  esac
  printf '%s' "$value" | base64 --decode 2>/dev/null || die "invalid JWT encoding"
}

request_github_jwt() {
  require_env ACTIONS_ID_TOKEN_REQUEST_URL
  require_env ACTIONS_ID_TOKEN_REQUEST_TOKEN
  require_env WIF_AUDIENCE

  curl --fail-with-body --silent --show-error --retry 2 \
    --get \
    --header "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
    --data-urlencode "audience=${WIF_AUDIENCE}" \
    "${ACTIONS_ID_TOKEN_REQUEST_URL}" \
    | jq --exit-status --raw-output '.value // empty' \
    || die "GitHub OIDC token request failed"
}

read_claims() {
  local jwt="$1"
  local header payload signature
  IFS='.' read -r header payload signature <<< "$jwt"
  [[ -n "$header" && -n "$payload" && -n "$signature" ]] || die "GitHub response was not a JWT"
  decode_base64url "$payload" | jq --exit-status -c 'if type == "object" then . else error("JWT claims are not an object") end'
}

validate_claims() {
  local claims="$1"
  require_env WIF_EXPECTED_ISSUER
  require_env WIF_EXPECTED_AUDIENCE
  require_env WIF_EXPECTED_SUBJECT
  require_env WIF_EXPECTED_REPOSITORY_ID
  require_env WIF_EXPECTED_REPOSITORY_OWNER_ID
  require_env WIF_EXPECTED_ENVIRONMENT

  jq --exit-status \
    --arg issuer "$WIF_EXPECTED_ISSUER" \
    --arg audience "$WIF_EXPECTED_AUDIENCE" \
    --arg subject "$WIF_EXPECTED_SUBJECT" \
    --arg repository_id "$WIF_EXPECTED_REPOSITORY_ID" \
    --arg repository_owner_id "$WIF_EXPECTED_REPOSITORY_OWNER_ID" \
    --arg environment "$WIF_EXPECTED_ENVIRONMENT" \
    '(.iss == $issuer)
     and (.aud == $audience)
     and (.sub == $subject)
     and ((.repository_id | tostring) == $repository_id)
     and ((.repository_owner_id | tostring) == $repository_owner_id)
     and (.environment == $environment)' \
    <<< "$claims" >/dev/null \
    || die "GitHub OIDC claims do not match the exact Yandex trust boundary"
}

main() {
  local mode="${1:-}"
  [[ "$mode" == "claims" || "$mode" == "exchange" ]] || die "usage: $0 claims|exchange"
  require_command curl
  require_command jq
  require_command base64

  local jwt claims
  jwt="$(request_github_jwt)"
  claims="$(read_claims "$jwt")"
  validate_claims "$claims"

  if [[ "$mode" == "claims" ]]; then
    jq -c '{iss, aud, sub, repository_id, repository_owner_id, environment}' <<< "$claims"
    return 0
  fi

  require_env WIF_SERVICE_ACCOUNT_ID
  local exchange_url="${WIF_EXCHANGE_URL:-https://auth.yandex.cloud/oauth/token}"
  local access_token
  access_token="$(curl --fail-with-body --silent --show-error --retry 2 \
    --request POST \
    --header 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:token-exchange' \
    --data-urlencode 'requested_token_type=urn:ietf:params:oauth:token-type:access_token' \
    --data-urlencode "audience=${WIF_SERVICE_ACCOUNT_ID}" \
    --data-urlencode "subject_token=${jwt}" \
    --data-urlencode 'subject_token_type=urn:ietf:params:oauth:token-type:id_token' \
    "$exchange_url" \
    | jq --exit-status --raw-output '.access_token // empty')" \
    || die "Yandex WIF token exchange failed"
  [[ -n "$access_token" ]] || die "Yandex WIF response did not contain an access token"
  printf '::add-mask::%s\n' "$access_token" >&2
  printf '%s\n' "$access_token"
}

main "$@"
