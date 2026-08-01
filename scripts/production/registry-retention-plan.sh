#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PATH="/usr/bin:/bin:${PATH:-}"
export PATH

output_file=""
current_ref=""
previous_ref=""
pending_ref=""
minimum_refs=()
available_refs=()

usage() {
  cat >&2 <<'USAGE'
usage: registry-retention-plan.sh --output PATH --current REF --previous REF \
  --pending REF [--minimum REF]... [--available REF]...

Builds a report-only protected digest set. This command never deletes images,
calls a registry mutation API, or accepts a deletion flag.
USAGE
}

die() {
  echo "registry-retention-plan: $*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --output)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      output_file="$2"
      shift 2
      ;;
    --current)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      current_ref="$2"
      shift 2
      ;;
    --previous)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      previous_ref="$2"
      shift 2
      ;;
    --pending)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      pending_ref="$2"
      shift 2
      ;;
    --minimum)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      minimum_refs+=("$2")
      shift 2
      ;;
    --available)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      available_refs+=("$2")
      shift 2
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

command -v jq >/dev/null 2>&1 || die "jq is required"
[[ -n "$output_file" && -n "$current_ref" && -n "$previous_ref" && -n "$pending_ref" ]] || {
  usage
  exit 64
}

validate_ref() {
  local value="$1"
  [[ "$value" =~ ^cr\.yandex/crpdnmjudj1usiu90gdn/(game|web)@sha256:[0-9a-f]{64}$ ]] ||
    die "every image reference must be an immutable approved registry digest: $value"
}

validate_ref "$current_ref"
validate_ref "$previous_ref"
validate_ref "$pending_ref"
for value in "${minimum_refs[@]}" "${available_refs[@]}"; do
  validate_ref "$value"
done

protected_refs=("$current_ref" "$previous_ref" "$pending_ref" "${minimum_refs[@]}")
protected_json="$(printf '%s\n' "${protected_refs[@]}" | jq -Rsc 'split("\n") | map(select(length > 0)) | unique')"
available_json="$(printf '%s\n' "${available_refs[@]}" | jq -Rsc 'split("\n") | map(select(length > 0)) | unique')"
delete_candidates_json="$(jq -n --argjson available "$available_json" --argjson protected "$protected_json" \
  '$available - $protected')"

mkdir -p -- "$(dirname -- "$output_file")"
jq -n \
  --arg current "$current_ref" \
  --arg previous "$previous_ref" \
  --arg pending "$pending_ref" \
  --argjson protected "$protected_json" \
  --argjson available "$available_json" \
  --argjson candidates "$delete_candidates_json" \
  '{schemaVersion:1,kind:"munchkin-registry-retention-dry-run",mode:"report-only",
    current:$current,previous:$previous,pending:$pending,protected:$protected,
    available:$available,deleteCandidates:$candidates,
    deletion:{enabled:false,requiresSeparateOwnerApproval:true,paidScanner:false}}' \
  >"$output_file"
chmod 0600 "$output_file"
echo "registry-retention-plan: wrote report-only protected digest set to $output_file"
