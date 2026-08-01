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
  TF_VAR_ssh_ingress_cidrs \
  TF_VAR_ssh_public_key \
  TF_WORKSPACE

export TF_IN_AUTOMATION=1
export TF_INPUT=0

bootstrap_backend="$terraform_root/bootstrap/backend.tf"
bootstrap_backend_example="$terraform_root/bootstrap/backend.tf.example"
bootstrap_backend_relative="infra/terraform/bootstrap/backend.tf"

if [[ -e "$bootstrap_backend" ]]; then
  if ! cmp -s -- "$bootstrap_backend_example" "$bootstrap_backend"; then
    echo "bootstrap/backend.tf must match the reviewed backend.tf.example byte-for-byte" >&2
    exit 1
  fi
  if ! git -C "$repo_root" check-ignore -q -- "$bootstrap_backend_relative"; then
    echo "bootstrap/backend.tf must remain ignored" >&2
    exit 1
  fi
  if git -C "$repo_root" ls-files --error-unmatch -- "$bootstrap_backend_relative" >/dev/null 2>&1; then
    echo "bootstrap/backend.tf must remain untracked" >&2
    exit 1
  fi
fi

for lock_backend in \
  "$terraform_root/bootstrap/backend.tf.example" \
  "$terraform_root/environments/production/backend.tf" \
  "$terraform_root/tests/state-lock/backend.tf"; do
  lock_setting_count="$(
    rg -c 'use_lockfile[[:space:]]*=' "$lock_backend" || true
  )"
  if [[ "$lock_setting_count" != "1" ]] ||
    ! rg -q 'use_lockfile[[:space:]]*=[[:space:]]*true' "$lock_backend"; then
    echo "all remote backend definitions must enable proven S3 lockfiles exactly once: $lock_backend" >&2
    exit 1
  fi
done

terraform fmt -check -recursive "$terraform_root"

policy_source="$terraform_root/bootstrap/main.tf"
bootstrap_github_actions="$terraform_root/bootstrap/github_actions.tf"

extract_policy_statement() {
  local sid="$1"
  awk -v sid="$sid" '
    index($0, "Sid    = \"" sid "\"") {
      in_statement = 1
    }
    in_statement {
      print
    }
    in_statement && /^      },[[:space:]]*$/ {
      exit
    }
  ' "$policy_source"
}

extract_resource_block() {
  local resource_type="$1"
  local resource_name="$2"
  local source_file="$3"
  awk -v signature="resource \"${resource_type}\" \"${resource_name}\"" '
    index($0, signature) {
      in_resource = 1
    }
    in_resource {
      print
    }
    in_resource && /^}$/ {
      exit
    }
  ' "$source_file"
}

require_assignment_count() {
  local label="$1"
  local block="$2"
  local expected_count="$3"
  local actual_count

  actual_count="$(
    printf '%s\n' "$block" |
      awk '
        /^[[:space:]]*#/ {
          next
        }
        index($0, "=") {
          count += 1
        }
        END {
          print count + 0
        }
      '
  )"
  if [[ "$actual_count" != "$expected_count" ]]; then
    echo "$label must contain exactly $expected_count assignments; got $actual_count" >&2
    exit 1
  fi
}

require_exact_scalar_attribute() {
  local label="$1"
  local block="$2"
  local attribute="$3"
  local expected_value="$4"
  local actual_values

  actual_values="$(
    printf '%s\n' "$block" |
      awk -v attribute="$attribute" '
        index($0, "=") {
          line = $0
          sub(/^[[:space:]]*/, "", line)
          equals = index(line, "=")
          name = substr(line, 1, equals - 1)
          value = substr(line, equals + 1)
          sub(/[[:space:]]*$/, "", name)
          sub(/^[[:space:]]*/, "", value)
          sub(/[[:space:]]*$/, "", value)
          if (name == attribute) {
            print value
          }
        }
      '
  )"
  if [[ "$actual_values" != "$expected_value" ]]; then
    echo "$label must set only $attribute = $expected_value" >&2
    exit 1
  fi
}

require_exact_hcl_list() {
  local label="$1"
  local block="$2"
  local attribute="$3"
  shift 3
  local expected_values
  local actual_values

  expected_values="$(printf '%s\n' "$@")"
  if ! actual_values="$(
    printf '%s\n' "$block" |
      awk -v attribute="$attribute" '
        {
          line = $0
          sub(/^[[:space:]]*/, "", line)
        }
        !in_list && index(line, "=") {
          equals = index(line, "=")
          name = substr(line, 1, equals - 1)
          value = substr(line, equals + 1)
          sub(/[[:space:]]*$/, "", name)
          sub(/^[[:space:]]*/, "", value)
          sub(/[[:space:]]*$/, "", value)
          if (name == attribute) {
            seen += 1
            if (value != "[") {
              invalid = 1
            }
            in_list = 1
            next
          }
        }
        in_list && line == "]" {
          closed = 1
          in_list = 0
          next
        }
        in_list {
          if (line ~ /^"[^"]+",?$/) {
            sub(/^"/, "", line)
            sub(/",?$/, "", line)
            print line
            next
          }
          if (line != "") {
            invalid = 1
          }
        }
        END {
          if (seen != 1 || !closed || invalid) {
            exit 2
          }
        }
      '
  )"; then
    echo "$label must contain one literal $attribute list" >&2
    exit 1
  fi
  if [[ "$actual_values" != "$expected_values" ]]; then
    echo "$label has unexpected $attribute values" >&2
    exit 1
  fi
}

require_unique_policy_statement() {
  local sid="$1"
  local statement="$2"

  if [[ -z "$statement" ]] ||
    [[ "$(rg -c -F "Sid    = \"$sid\"" "$policy_source")" != "1" ]]; then
    echo "bucket policy must contain exactly one $sid statement" >&2
    exit 1
  fi
}

locals_signature="locals {"
bootstrap_locals="$(
  awk -v signature="$locals_signature" '
    $0 == signature {
      in_locals = 1
    }
    in_locals {
      print
    }
    in_locals && /^}$/ {
      exit
    }
  ' "$policy_source"
)"
if [[ -z "$bootstrap_locals" ]] ||
  [[ "$(rg -c -F "$locals_signature" "$policy_source")" != "1" ]]; then
  echo "bootstrap must contain exactly one reviewed locals block" >&2
  exit 1
fi
require_assignment_count "bootstrap locals" "$bootstrap_locals" 11
require_exact_scalar_attribute \
  "bootstrap locals" \
  "$bootstrap_locals" \
  "state_bucket_name" \
  '"munchkin-prod-tfstate-b1g55l8i2mtpv23b5ql7"'
require_exact_scalar_attribute \
  "bootstrap locals" \
  "$bootstrap_locals" \
  "operator_principal_id" \
  'split(":", var.operator_subject)[1]'
deployer_roles_definition="$(
  printf '%s\n' "$bootstrap_locals" |
    awk '
      /^  deployer_folder_roles = toset\(\[$/ {
        in_definition = 1
      }
      in_definition {
        print
      }
      in_definition && /^  \]\)$/ {
        exit
      }
    '
)"
expected_deployer_roles_definition='  deployer_folder_roles = toset([
    "compute.editor",
    "container-registry.admin",
    "vpc.privateAdmin",
    "vpc.publicAdmin",
    "vpc.securityGroups.admin",
  ])'
if [[ "$deployer_roles_definition" != "$expected_deployer_roles_definition" ]]; then
  echo "deployer folder roles must contain only the five reviewed service roles" >&2
  exit 1
fi
require_exact_hcl_list \
  "bootstrap locals" \
  "$bootstrap_locals" \
  "state_keys" \
  "bootstrap/terraform.tfstate" \
  "environments/production/terraform.tfstate" \
  "tests/state-lock/terraform.tfstate"
require_exact_scalar_attribute \
  "bootstrap locals" \
  "$bootstrap_locals" \
  "lock_keys" \
  '[for key in local.state_keys : "${key}.tflock"]'
require_exact_scalar_attribute \
  "bootstrap locals" \
  "$bootstrap_locals" \
  "list_prefixes" \
  "concat(local.state_keys, local.lock_keys)"

state_object_arns_definition="$(
  printf '%s\n' "$bootstrap_locals" |
    awk '
      /^  state_object_arns = \[$/ {
        in_definition = 1
      }
      in_definition {
        print
      }
      in_definition && /^  \]$/ {
        exit
      }
    '
)"
expected_state_object_arns_definition='  state_object_arns = [
    for key in local.state_keys :
    "arn:aws:s3:::${local.state_bucket_name}/${key}"
  ]'
if [[ "$state_object_arns_definition" != "$expected_state_object_arns_definition" ]]; then
  echo "state object ARNs must derive only from the three reviewed state keys" >&2
  exit 1
fi

lock_object_arns_definition="$(
  printf '%s\n' "$bootstrap_locals" |
    awk '
      /^  lock_object_arns = \[$/ {
        in_definition = 1
      }
      in_definition {
        print
      }
      in_definition && /^  \]$/ {
        exit
      }
    '
)"
expected_lock_object_arns_definition='  lock_object_arns = [
    for key in local.lock_keys :
    "arn:aws:s3:::${local.state_bucket_name}/${key}"
  ]'
if [[ "$lock_object_arns_definition" != "$expected_lock_object_arns_definition" ]]; then
  echo "lock object ARNs must derive only from the three reviewed lock keys" >&2
  exit 1
fi

configurer_signature='resource "yandex_storage_bucket_iam_binding" "state_backend_configurer" {'
configurer_binding="$(
  awk -v signature="$configurer_signature" '
    $0 == signature {
      in_resource = 1
    }
    in_resource {
      print
    }
    in_resource && /^}$/ {
      exit
    }
  ' "$policy_source"
)"
if [[ -z "$configurer_binding" ]] ||
  [[ "$(rg -c -F "$configurer_signature" "$policy_source")" != "1" ]]; then
  echo "bootstrap must contain exactly one bucket-scoped state backend configurer binding" >&2
  exit 1
fi
require_assignment_count "state backend configurer binding" "$configurer_binding" 3
require_exact_scalar_attribute \
  "state backend configurer binding" \
  "$configurer_binding" \
  "bucket" \
  "yandex_storage_bucket.terraform_state.bucket"
require_exact_scalar_attribute \
  "state backend configurer binding" \
  "$configurer_binding" \
  "role" \
  '"storage.configurer"'
require_exact_hcl_list \
  "state backend configurer binding" \
  "$configurer_binding" \
  "members" \
  'serviceAccount:${yandex_iam_service_account.state_backend.id}'
if printf '%s\n' "$configurer_binding" |
  rg -q 'folder_id|cloud_id|terraform_deployer|operator'; then
  echo "state backend configurer must not be folder-wide or target another identity" >&2
  exit 1
fi
if [[ "$(
  rg -c '^[[:space:]]*role[[:space:]]*=[[:space:]]*"storage\.configurer"$' \
    "$policy_source"
)" != "1" ]]; then
  echo "storage.configurer must have exactly one bucket-scoped declaration" >&2
  exit 1
fi

editor_signature='resource "yandex_storage_bucket_iam_binding" "state_backend_editor" {'
editor_binding="$(
  awk -v signature="$editor_signature" '
    $0 == signature {
      in_resource = 1
    }
    in_resource {
      print
    }
    in_resource && /^}$/ {
      exit
    }
  ' "$policy_source"
)"
if [[ -z "$editor_binding" ]] ||
  [[ "$(rg -c -F "$editor_signature" "$policy_source")" != "1" ]]; then
  echo "bootstrap must contain exactly one bucket-scoped state backend editor binding" >&2
  exit 1
fi
require_assignment_count "state backend editor binding" "$editor_binding" 3
require_exact_scalar_attribute \
  "state backend editor binding" \
  "$editor_binding" \
  "bucket" \
  "yandex_storage_bucket.terraform_state.bucket"
require_exact_scalar_attribute \
  "state backend editor binding" \
  "$editor_binding" \
  "role" \
  '"storage.editor"'
require_exact_hcl_list \
  "state backend editor binding" \
  "$editor_binding" \
  "members" \
  'serviceAccount:${yandex_iam_service_account.state_backend.id}'
if printf '%s\n' "$editor_binding" |
  rg -q 'folder_id|cloud_id|terraform_deployer|operator'; then
  echo "state backend editor must not be folder-wide or target another identity" >&2
  exit 1
fi
if [[ "$(
  rg -c '^[[:space:]]*role[[:space:]]*=[[:space:]]*"storage\.editor"$' \
    "$policy_source"
)" != "1" ]]; then
  echo "storage.editor must have exactly one bucket-scoped declaration" >&2
  exit 1
fi
if [[ "$(
  rg -c '^resource "yandex_storage_bucket_iam_binding"' "$policy_source"
)" != "2" ]]; then
  echo "bootstrap must contain only the reviewed configurer and editor bucket IAM bindings" >&2
  exit 1
fi

if [[ "$(rg -c '^      \{$' "$policy_source")" != "5" ]] ||
  [[ "$(rg -c '^[[:space:]]*Sid[[:space:]]*=' "$policy_source")" != "5" ]]; then
  echo "bucket policy must contain exactly the five reviewed statements" >&2
  exit 1
fi

operator_sid="ManageBucketConfigurationWithoutObjectAccess"
operator_statement="$(extract_policy_statement "$operator_sid")"
require_unique_policy_statement "$operator_sid" "$operator_statement"
require_assignment_count "$operator_sid statement" "$operator_statement" 6
require_exact_scalar_attribute \
  "$operator_sid statement" "$operator_statement" "Sid" "\"$operator_sid\""
require_exact_scalar_attribute \
  "$operator_sid statement" "$operator_statement" "Effect" '"Allow"'
require_exact_scalar_attribute \
  "$operator_sid statement" "$operator_statement" "Principal" "{"
require_exact_scalar_attribute \
  "$operator_sid" \
  "$operator_statement" \
  "CanonicalUser" \
  "local.operator_principal_id"
require_exact_scalar_attribute \
  "$operator_sid statement" "$operator_statement" "Action" '"s3:*"'
require_exact_scalar_attribute \
  "$operator_sid statement" \
  "$operator_statement" \
  "Resource" \
  '"arn:aws:s3:::${local.state_bucket_name}"'
if printf '%s\n' "$operator_statement" |
  rg -q 'state_object_arns|lock_object_arns|arn:aws:s3:::[^"]+/|/\*'; then
  echo "operator bucket policy statement must not contain an object ARN" >&2
  exit 1
fi

location_sid="ReadBucketLocation"
location_statement="$(extract_policy_statement "$location_sid")"
require_unique_policy_statement "$location_sid" "$location_statement"
require_assignment_count "$location_sid statement" "$location_statement" 6
require_exact_scalar_attribute \
  "$location_sid statement" "$location_statement" "Sid" "\"$location_sid\""
require_exact_scalar_attribute \
  "$location_sid statement" "$location_statement" "Effect" '"Allow"'
require_exact_scalar_attribute \
  "$location_sid statement" "$location_statement" "Principal" "{"
require_exact_scalar_attribute \
  "$location_sid statement" \
  "$location_statement" \
  "CanonicalUser" \
  "yandex_iam_service_account.state_backend.id"
require_exact_scalar_attribute \
  "$location_sid statement" \
  "$location_statement" \
  "Action" \
  '"s3:GetBucketLocation"'
require_exact_scalar_attribute \
  "$location_sid statement" \
  "$location_statement" \
  "Resource" \
  '"arn:aws:s3:::${local.state_bucket_name}"'

list_sid="ListOnlyStatePrefixes"
list_statement="$(extract_policy_statement "$list_sid")"
require_unique_policy_statement "$list_sid" "$list_statement"
require_assignment_count "$list_sid statement" "$list_statement" 9
require_exact_scalar_attribute \
  "$list_sid statement" "$list_statement" "Sid" "\"$list_sid\""
require_exact_scalar_attribute \
  "$list_sid statement" "$list_statement" "Effect" '"Allow"'
require_exact_scalar_attribute \
  "$list_sid statement" "$list_statement" "Principal" "{"
require_exact_scalar_attribute \
  "$list_sid statement" \
  "$list_statement" \
  "CanonicalUser" \
  "yandex_iam_service_account.state_backend.id"
require_exact_scalar_attribute \
  "$list_sid statement" "$list_statement" "Action" '"s3:ListBucket"'
require_exact_scalar_attribute \
  "$list_sid statement" \
  "$list_statement" \
  "Resource" \
  '"arn:aws:s3:::${local.state_bucket_name}"'
require_exact_scalar_attribute \
  "$list_sid statement" "$list_statement" "Condition" "{"
require_exact_scalar_attribute \
  "$list_sid statement" "$list_statement" "StringEquals" "{"
require_exact_scalar_attribute \
  "$list_sid statement" \
  "$list_statement" \
  '"s3:prefix"' \
  "local.list_prefixes"

state_sid="ReadWriteExactStateObjects"
state_statement="$(extract_policy_statement "ReadWriteExactStateObjects")"
require_unique_policy_statement "$state_sid" "$state_statement"
require_assignment_count "$state_sid statement" "$state_statement" 6
require_exact_scalar_attribute \
  "$state_sid statement" "$state_statement" "Sid" "\"$state_sid\""
require_exact_scalar_attribute \
  "$state_sid statement" "$state_statement" "Effect" '"Allow"'
require_exact_scalar_attribute \
  "$state_sid statement" "$state_statement" "Principal" "{"
require_exact_scalar_attribute \
  "$state_sid statement" \
  "$state_statement" \
  "CanonicalUser" \
  "yandex_iam_service_account.state_backend.id"
require_exact_hcl_list \
  "$state_sid statement" \
  "$state_statement" \
  "Action" \
  "s3:GetObject" \
  "s3:GetObjectVersion" \
  "s3:PutObject"
require_exact_scalar_attribute \
  "$state_sid statement" "$state_statement" "Resource" "local.state_object_arns"

lock_sid="ManageExactLockObjects"
lock_statement="$(extract_policy_statement "ManageExactLockObjects")"
require_unique_policy_statement "$lock_sid" "$lock_statement"
require_assignment_count "$lock_sid statement" "$lock_statement" 6
require_exact_scalar_attribute \
  "$lock_sid statement" "$lock_statement" "Sid" "\"$lock_sid\""
require_exact_scalar_attribute \
  "$lock_sid statement" "$lock_statement" "Effect" '"Allow"'
require_exact_scalar_attribute \
  "$lock_sid statement" "$lock_statement" "Principal" "{"
require_exact_scalar_attribute \
  "$lock_sid statement" \
  "$lock_statement" \
  "CanonicalUser" \
  "yandex_iam_service_account.state_backend.id"
require_exact_hcl_list \
  "$lock_sid statement" \
  "$lock_statement" \
  "Action" \
  "s3:DeleteObject" \
  "s3:GetObject" \
  "s3:PutObject"
require_exact_scalar_attribute \
  "$lock_sid statement" "$lock_statement" "Resource" "local.lock_object_arns"

policy_statement_body="$(
  awk '
    /^    Statement = \[$/ {
      in_statements = 1
      next
    }
    in_statements && /^    \]$/ {
      exit
    }
    in_statements {
      print
    }
  ' "$policy_source" |
    sed -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d'
)"
reviewed_statement_body="$(
  printf '      {\n%s\n' "$operator_statement"
  printf '      {\n%s\n' "$location_statement"
  printf '      {\n%s\n' "$list_statement"
  printf '      {\n%s\n' "$state_statement"
  printf '      {\n%s\n' "$lock_statement"
)"
if [[ "$policy_statement_body" != "$reviewed_statement_body" ]]; then
  echo "bucket policy statement list must contain only the five reviewed statements" >&2
  exit 1
fi

if [[ "$(
  rg -c '^resource "yandex_iam_service_account"' "$policy_source"
)" != "3" ]]; then
  echo "bootstrap must manage exactly deployer, state backend and runtime service accounts" >&2
  exit 1
fi
if [[ "$(
  rg -c '^resource "yandex_resourcemanager_folder_iam_member" "terraform_deployer"' \
    "$policy_source"
)" != "1" ]] ||
  ! rg -q '^[[:space:]]*for_each[[:space:]]*=[[:space:]]*local\.deployer_folder_roles$' \
    "$policy_source"; then
  echo "deployer folder IAM must derive only from the reviewed role set" >&2
  exit 1
fi
if [[ "$(
  rg -c '^resource "yandex_iam_service_account_iam_member"' "$policy_source"
)" != "2" ]] ||
  ! rg -q '^[[:space:]]*service_account_id[[:space:]]*=[[:space:]]*yandex_iam_service_account\.runtime\.id$' \
    "$policy_source" ||
  ! rg -q '^[[:space:]]*role[[:space:]]*=[[:space:]]*"iam\.serviceAccounts\.user"$' \
    "$policy_source"; then
  echo "bootstrap runtime impersonation boundary is incomplete or broader than reviewed" >&2
  exit 1
fi

if [[ ! -f "$bootstrap_github_actions" ]] ||
  [[ "$(rg -c '^resource "yandex_iam_service_account"' "$bootstrap_github_actions")" != "1" ]] ||
  [[ "$(rg -c '^resource "yandex_iam_workload_identity_oidc_federation"' "$bootstrap_github_actions")" != "1" ]] ||
  [[ "$(rg -c '^resource "yandex_iam_workload_identity_federated_credential"' "$bootstrap_github_actions")" != "1" ]] ||
  ! rg -q 'name[[:space:]]*=[[:space:]]*"munchkin-github-images"' "$bootstrap_github_actions" ||
  ! rg -q 'issuer[[:space:]]*=[[:space:]]*local\.github_oidc_issuer' "$bootstrap_github_actions" ||
  ! rg -q 'jwks_url[[:space:]]*=[[:space:]]*local\.github_oidc_jwks_url' "$bootstrap_github_actions" ||
  ! rg -q 'audiences[[:space:]]*=[[:space:]]*\[local\.github_oidc_audience\]' "$bootstrap_github_actions" ||
  ! rg -q 'external_subject_id[[:space:]]*=[[:space:]]*local\.github_oidc_subject' "$bootstrap_github_actions" ||
  rg -q 'yandex_iam_service_account_(key|authorized_key)|access_key|secret_key|YC_TOKEN|AWS_' \
    "$bootstrap_github_actions" ||
  rg -q '\*' "$bootstrap_github_actions"; then
  echo "bootstrap GitHub Actions trust must be exactly one keyless SA, federation and credential" >&2
  exit 1
fi
for expected_github_claim in \
  'https://token.actions.githubusercontent.com' \
  'https://token.actions.githubusercontent.com/.well-known/jwks' \
  'https://github.com/L1TTL3H0rSE' \
  'repo:L1TTL3H0rSE@32160016/munchkin@1316069622:environment:production-images'; do
  if ! rg -q -F "$expected_github_claim" "$bootstrap_github_actions"; then
    echo "bootstrap GitHub trust is missing exact claim: $expected_github_claim" >&2
    exit 1
  fi
done

production_root="$terraform_root/environments/production"
production_variables="$production_root/variables.tf"
production_iam="$production_root/iam.tf"
production_dns="$production_root/dns.tf"
production_lockbox="$production_root/lockbox.tf"
production_network="$production_root/network.tf"
production_registry="$production_root/registry.tf"
production_compute="$production_root/compute.tf"
production_cloud_init="$production_root/cloud-init.yaml.tftpl"
production_telemetry="$production_root/telemetry.tf"
production_dashboard="$repo_root/infra/observability/monium/production-dashboard.json"
production_alerts="$repo_root/infra/observability/monium/production-alerts.yaml"

for required_file in \
  "$production_variables" \
  "$production_iam" \
  "$production_dns" \
  "$production_lockbox" \
  "$production_network" \
  "$production_registry" \
  "$production_compute" \
  "$production_cloud_init" \
  "$production_telemetry" \
  "$production_dashboard" \
  "$production_alerts" \
  "$production_root/outputs.tf"; do
  if [[ ! -f "$required_file" ]]; then
    echo "production graph is missing required file: $required_file" >&2
    exit 1
  fi
done

production_resource_count="$(
  rg --no-filename '^resource "' "$production_root" --glob '*.tf' |
    wc -l |
    tr -d '[:space:]'
)"
if [[ "$production_resource_count" != "19" ]]; then
  echo "production graph must contain exactly 19 managed resources; got $production_resource_count" >&2
  exit 1
fi

declare -A expected_production_resource_counts=(
  [yandex_vpc_network]=1
  [yandex_vpc_subnet]=1
  [yandex_vpc_security_group]=1
  [yandex_vpc_address]=1
  [yandex_container_registry]=1
  [yandex_container_repository]=2
  [yandex_container_registry_iam_binding]=2
  [yandex_iam_service_account]=1
  [yandex_resourcemanager_folder_iam_member]=2
  [yandex_monitoring_dashboard]=1
  [yandex_dns_zone]=1
  [yandex_dns_recordset]=1
  [yandex_lockbox_secret]=1
  [yandex_lockbox_secret_iam_member]=1
  [yandex_compute_disk]=1
  [yandex_compute_instance]=1
)
for resource_type in "${!expected_production_resource_counts[@]}"; do
  actual_count="$(
    rg --no-filename "^resource \"$resource_type\"" "$production_root" --glob '*.tf' |
      wc -l |
      tr -d '[:space:]'
  )"
  if [[ "$actual_count" != "${expected_production_resource_counts[$resource_type]}" ]]; then
    echo "production graph has unexpected $resource_type count: $actual_count" >&2
    exit 1
  fi
done

production_data_count="$(
  rg --no-filename '^data "' "$production_root" --glob '*.tf' |
    wc -l |
    tr -d '[:space:]'
)"
if [[ "$production_data_count" != "3" ]] ||
  ! rg -q '^data "yandex_iam_service_account" "runtime"' "$production_iam" ||
  ! rg -q '^data "yandex_iam_service_account" "github_images"' "$production_iam" ||
  ! rg -q '^data "yandex_compute_image" "ubuntu"' "$production_compute"; then
  echo "production graph must contain only runtime, GitHub CI and Ubuntu lookups" >&2
  exit 1
fi

if ! rg -q '^resource "yandex_dns_zone" "production"' "$production_dns" ||
  ! rg -q '^[[:space:]]*zone[[:space:]]*=[[:space:]]*"\$\{trimsuffix\(var\.domain_zone, "\."\)\}\."$' "$production_dns" ||
  ! rg -q '^[[:space:]]*public[[:space:]]*=[[:space:]]*true$' "$production_dns" ||
  ! rg -q '^[[:space:]]*deletion_protection[[:space:]]*=[[:space:]]*true$' "$production_dns" ||
  ! rg -q '^resource "yandex_dns_recordset" "production"' "$production_dns" ||
  ! rg -q '^[[:space:]]*name[[:space:]]*=[[:space:]]*"\$\{trimsuffix\(var\.production_hostname, "\."\)\}\."$' "$production_dns" ||
  ! rg -q '^[[:space:]]*type[[:space:]]*=[[:space:]]*"A"$' "$production_dns" ||
  ! rg -q '^[[:space:]]*ttl[[:space:]]*=[[:space:]]*300$' "$production_dns" ||
  ! rg -q 'yandex_vpc_address\.production\.external_ipv4_address' "$production_dns"; then
  echo "production DNS graph must manage one public exact-hostname A record" >&2
  exit 1
fi

if ! rg -q '^resource "yandex_lockbox_secret" "production"' "$production_lockbox" ||
  ! rg -q '^[[:space:]]*deletion_protection[[:space:]]*=[[:space:]]*true$' "$production_lockbox" ||
  ! rg -q '^resource "yandex_lockbox_secret_iam_member" "runtime_viewer"' "$production_lockbox" ||
  ! rg -q '^[[:space:]]*role[[:space:]]*=[[:space:]]*"viewer"$' "$production_lockbox" ||
  ! rg -q 'serviceAccount:\$\{data\.yandex_iam_service_account\.runtime\.id\}' "$production_lockbox" ||
  rg -q 'password_payload_specification|yandex_lockbox_secret_version|text_value|secret_value' "$production_root"; then
  echo "Lockbox graph must be metadata-only with exact runtime viewer access" >&2
  exit 1
fi

if ! rg -q '^[[:space:]]*sensitive[[:space:]]*=[[:space:]]*true$' \
  "$production_variables" ||
  [[ "$(rg -c '^[[:space:]]*sensitive[[:space:]]*=[[:space:]]*true$' "$production_variables")" != "2" ]] ||
  ! rg -q 'cidr[[:space:]]*!=[[:space:]]*"0\.0\.0\.0/0"' "$production_variables"; then
  echo "owner SSH inputs must remain sensitive and reject world-open SSH" >&2
  exit 1
fi

if ! rg -q '^resource "yandex_iam_service_account" "monium_writer"' "$production_telemetry" ||
  ! rg -q 'name[[:space:]]*=[[:space:]]*"munchkin-monium-writer"' "$production_telemetry" ||
  [[ "$(rg -c 'prevent_destroy[[:space:]]*=[[:space:]]*true' "$production_telemetry")" != "1" ]]; then
  echo "Monium writer identity must be one dedicated protected service account" >&2
  exit 1
fi

for expected_monium_role in monium.metrics.writer monium.traces.writer; do
  if [[ "$(rg -c "role[[:space:]]*=[[:space:]]*\"$expected_monium_role\"" "$production_telemetry")" != "1" ]]; then
    echo "Monium writer identity must have exactly one $expected_monium_role binding" >&2
    exit 1
  fi
done
if ! rg -q 'yc\.monium\.metrics\.write' "$production_telemetry" ||
  ! rg -q 'yc\.monium\.traces\.write' "$production_telemetry" ||
  rg -q 'yc\.monium\.logs\.write|static_access_key|service_account_key' "$production_root"; then
  echo "Monium auth must be metrics/traces-only and keyless in Terraform" >&2
  exit 1
fi

if ! rg -q 'monium_api_key_expiry_days' "$production_root/variables.tf" ||
  ! rg -q 'var\.monium_api_key_expiry_days <= 90' "$production_root/variables.tf" ||
  ! rg -qi 'owner-managed' "$production_root/variables.tf" ||
  ! rg -q 'resource "yandex_monitoring_dashboard" "production"' "$production_telemetry" ||
  ! rg -q -F 'munchkin-production-telemetry' "$production_dashboard" ||
  ! rg -q 'readiness|http\.server\.request|game\.interaction' "$production_dashboard" ||
  ! rg -q 'readiness-unavailable|sustained-http-5xx|disk-free-low|http-p95-above-baseline' "$production_alerts" ||
  ! rg -q 'owner-only-email-outside-repository|address_is_not_stored_here' "$production_alerts" ||
  ! rg -q 'for:' "$production_alerts"; then
  echo "Monium dashboard/alert contract or owner-only delivery boundary is incomplete" >&2
  exit 1
fi

runtime_registry_binding="$(extract_resource_block yandex_container_registry_iam_binding runtime_puller "$production_iam")"
github_registry_binding="$(extract_resource_block yandex_container_registry_iam_binding github_images_pusher "$production_iam")"
if [[ -z "$runtime_registry_binding" ]] ||
  ! rg -q '^[[:space:]]*role[[:space:]]*=[[:space:]]*"container-registry\.images\.puller"$' <<< "$runtime_registry_binding" ||
  ! rg -q 'serviceAccount:\$\{data\.yandex_iam_service_account\.runtime\.id\}' <<< "$runtime_registry_binding" ||
  [[ -z "$github_registry_binding" ]] ||
  ! rg -q '^[[:space:]]*role[[:space:]]*=[[:space:]]*"container-registry\.images\.pusher"$' <<< "$github_registry_binding" ||
  ! rg -q 'serviceAccount:\$\{data\.yandex_iam_service_account\.github_images\.id\}' <<< "$github_registry_binding" ||
  rg -q 'pusher|scanner|editor|admin' <<< "$runtime_registry_binding"; then
  echo "registry access must preserve runtime pull-only and add one exact CI pusher binding" >&2
  exit 1
fi

if [[ "$(rg -c '^[[:space:]]*ingress[[:space:]]*\{' "$production_network")" != "3" ]] ||
  [[ "$(rg -c '^[[:space:]]*egress[[:space:]]*\{' "$production_network")" != "1" ]] ||
  [[ "$(rg -c '^[[:space:]]*port[[:space:]]*=[[:space:]]*(22|80|443)$' "$production_network")" != "3" ]] ||
  [[ "$(rg -c '"0\.0\.0\.0/0"' "$production_network")" != "3" ]] ||
  ! rg -q '^[[:space:]]*v4_cidr_blocks[[:space:]]*=[[:space:]]*var\.ssh_ingress_cidrs$' \
    "$production_network" ||
  rg -q 'v6_cidr_blocks|ipv6' "$production_network"; then
  echo "production security group must expose only owner SSH and public HTTP/HTTPS over IPv4" >&2
  exit 1
fi

for expected_compute_setting in \
  'family    = "ubuntu-2404-lts"' \
  'platform_id               = "standard-v3"' \
  'cores         = 2' \
  'core_fraction = 50' \
  'memory        = 4' \
  'size     = 35' \
  'size        = 20' \
  'device_name = "munchkin-data"' \
  'auto_delete = false'; do
  if ! rg -q -F "$expected_compute_setting" "$production_compute"; then
    echo "production compute graph is missing reviewed setting: $expected_compute_setting" >&2
    exit 1
  fi
done
if [[ "$(rg -c 'prevent_destroy[[:space:]]*=[[:space:]]*true' "$production_compute")" != "1" ]]; then
  echo "only the standalone PostgreSQL data disk must have Terraform prevent_destroy" >&2
  exit 1
fi

for expected_cloud_init_setting in \
  'ssh_pwauth: false' \
  'PermitRootLogin no' \
  '"max-size": "10m"' \
  '"max-file": "3"' \
  '/dev/disk/by-id/virtio-munchkin-data' \
  'var/lib/munchkin/bootstrap-success'; do
  if ! rg -q -F "$expected_cloud_init_setting" "$production_cloud_init"; then
    echo "cloud-init is missing reviewed host baseline: $expected_cloud_init_setting" >&2
    exit 1
  fi
done
if rg -q '^[[:space:]]*-[[:space:]]+docker[[:space:]]*$' "$production_cloud_init"; then
  echo "bootstrap user must not receive root-equivalent Docker group membership" >&2
  exit 1
fi

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
  if [[ -f "$source_root/cloud-init.yaml.tftpl" ]]; then
    cp -- "$source_root/cloud-init.yaml.tftpl" "$destination_root/"
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
