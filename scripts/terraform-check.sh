#!/usr/bin/env bash
set -euo pipefail

# A direct Git Bash invocation from PowerShell does not always prepend its
# coreutils directories. Keep the script deterministic on Windows and retain
# the caller PATH for Terraform, Git and ripgrep.
PATH="/usr/bin:/bin:${PATH:-}"
export PATH

if [[ "$#" -ne 0 ]]; then
  echo "terraform-check does not accept arguments" >&2
  exit 2
fi

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
terraform_root="$repo_root/infra/terraform"
expected_terraform_version="1.15.8"

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform-check requires Terraform ${expected_terraform_version}" >&2
  exit 2
fi

version_output="$(terraform version)"
version_line="${version_output%%$'\n'*}"
if [[ "$version_line" != "Terraform v${expected_terraform_version}" ]]; then
  echo "terraform-check requires Terraform ${expected_terraform_version}; got ${version_line}" >&2
  exit 2
fi

# Validation must never reuse caller credentials or implicit CLI actions.
unset \
  ACCESS_KEY \
  SECRET_KEY \
  AWS_ACCESS_KEY_ID \
  AWS_CONFIG_FILE \
  AWS_CONTAINER_CREDENTIALS_FULL_URI \
  AWS_CONTAINER_CREDENTIALS_RELATIVE_URI \
  AWS_ROLE_ARN \
  AWS_SECRET_ACCESS_KEY \
  AWS_SESSION_TOKEN \
  AWS_PROFILE \
  AWS_SHARED_CREDENTIALS_FILE \
  AWS_WEB_IDENTITY_TOKEN_FILE \
  YC_TOKEN \
  YC_SERVICE_ACCOUNT_KEY_FILE \
  YC_STORAGE_ACCESS_KEY \
  YC_STORAGE_SECRET_KEY \
  TF_CLI_ARGS \
  TF_CLI_ARGS_fmt \
  TF_CLI_ARGS_init \
  TF_CLI_ARGS_plan \
  TF_CLI_ARGS_apply \
  TF_CLI_ARGS_providers \
  TF_CLI_ARGS_validate \
  TF_CLI_CONFIG_FILE \
  TF_LOG \
  TF_LOG_CORE \
  TF_LOG_PATH \
  TF_LOG_PROVIDER \
  TF_PLUGIN_CACHE_DIR \
  TF_PLUGIN_CACHE_MAY_BREAK_DEPENDENCY_LOCK_FILE \
  TF_VAR_operator_subject \
  TF_WORKSPACE

export TF_IN_AUTOMATION=1
export TF_INPUT=0

if [[ -e "$terraform_root/bootstrap/backend.tf" ]]; then
  echo "bootstrap/backend.tf must remain absent until the approved state migration" >&2
  exit 1
fi

if rg -q 'use_lockfile[[:space:]]*=' \
  "$terraform_root/environments/production/backend.tf"; then
  echo "production use_lockfile requires a successful isolated compatibility test" >&2
  exit 1
fi

if ! rg -q 'use_lockfile[[:space:]]*=[[:space:]]*true' \
  "$terraform_root/tests/state-lock/backend.tf"; then
  echo "state-lock fixture must remain the isolated use_lockfile probe" >&2
  exit 1
fi

terraform fmt -check -recursive "$terraform_root"

temp_parent="${TMPDIR:-/tmp}"
mkdir -p -- "$temp_parent"
temp_parent="$(cd -- "$temp_parent" && pwd -P)"
temp_root="$(mktemp -d "$temp_parent/munchkin-terraform-check.XXXXXX")"
temp_root="$(cd -- "$temp_root" && pwd -P)"

case "$temp_root" in
  "$temp_parent"/munchkin-terraform-check.*) ;;
  *)
    echo "terraform-check received an unsafe temporary path" >&2
    exit 2
    ;;
esac

cleanup() {
  case "$temp_root" in
    "$temp_parent"/munchkin-terraform-check.*)
      rm -rf -- "$temp_root"
      ;;
    *)
      echo "terraform-check refused unsafe temporary cleanup" >&2
      return 1
      ;;
  esac
}
trap cleanup EXIT

native_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s\n' "$1"
  fi
}

cli_config="$temp_root/terraformrc"
printf 'disable_checkpoint = true\n' >"$cli_config"
export TF_CLI_CONFIG_FILE
TF_CLI_CONFIG_FILE="$(native_path "$cli_config")"

copy_configuration() {
  local source_root="$1"
  local destination_root="$2"
  local source_file

  mkdir -p -- "$destination_root"
  for source_file in "$source_root"/*.tf; do
    cp -- "$source_file" "$destination_root/"
  done
  if [[ -f "$source_root/backend.tf.example" ]]; then
    cp -- "$source_root/backend.tf.example" "$destination_root/backend.tf"
  fi
  if [[ -f "$source_root/.terraform.lock.hcl" ]]; then
    cp -- "$source_root/.terraform.lock.hcl" "$destination_root/"
  fi
}

validate_root() {
  local name="$1"
  local source_root="$2"
  local validation_root="$temp_root/validate-$name"
  local data_root="$temp_root/data-$name"

  copy_configuration "$source_root" "$validation_root"
  mkdir -p -- "$data_root"

  terraform -chdir="$(native_path "$validation_root")" fmt -check
  TF_DATA_DIR="$(native_path "$data_root")" \
    terraform -chdir="$(native_path "$validation_root")" \
      init -backend=false -input=false -lockfile=readonly -no-color
  TF_DATA_DIR="$(native_path "$data_root")" \
    terraform -chdir="$(native_path "$validation_root")" \
      validate -no-color
}

verify_lockfile() {
  local name="$1"
  local source_root="$2"
  local lock_root="$temp_root/lock-$name"

  copy_configuration "$source_root" "$lock_root"
  terraform -chdir="$(native_path "$lock_root")" providers lock \
    -platform=windows_amd64 \
    -platform=linux_amd64

  if ! cmp -s \
    "$source_root/.terraform.lock.hcl" \
    "$lock_root/.terraform.lock.hcl"; then
    echo "$name provider lock is not reproducible for windows_amd64 and linux_amd64" >&2
    exit 1
  fi
}

validate_root "bootstrap" "$terraform_root/bootstrap"
validate_root "production" "$terraform_root/environments/production"
validate_root "state-lock" "$terraform_root/tests/state-lock"

verify_lockfile "bootstrap" "$terraform_root/bootstrap"
verify_lockfile "production" "$terraform_root/environments/production"

tracked_artifact_found=false
while IFS= read -r tracked_path; do
  case "$tracked_path" in
    *.tfstate|*.tfstate.*|*.tfplan|*.tfvars|*.tfvars.json|*.tfbackend|.terraform/*|*/.terraform/*)
      tracked_artifact_found=true
      ;;
  esac
done < <(git -C "$repo_root" ls-files)

if [[ "$tracked_artifact_found" == true ]]; then
  echo "tracked Terraform runtime artifacts are forbidden" >&2
  exit 1
fi

if rg -l \
  --glob '*.tf' \
  --glob '*.tf.example' \
  '(access_key|secret_key|service_account_key_file|storage_access_key|storage_secret_key|token)[[:space:]]*=' \
  "$terraform_root" >/dev/null; then
  echo "Terraform configuration contains an inline credential assignment" >&2
  exit 1
fi

if rg -l \
  --glob '*.tf' \
  --glob '*.tf.example' \
  'resource[[:space:]]+"yandex_iam_service_account_(static_access_)?key"' \
  "$terraform_root" >/dev/null; then
  echo "Terraform must not manage secret-bearing service account keys" >&2
  exit 1
fi

echo "terraform-check: ok"
