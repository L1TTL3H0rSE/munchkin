#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PATH="/usr/bin:/bin:${PATH:-}"
export PATH

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
output_dir="$repo_root/release/security"
game_image=""
web_image=""
release_commit=""
contract_only=false

gitleaks_version="8.30.1"
gitleaks_sha256="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
trivy_version="0.70.0"
trivy_sha256="8b4376d5d6befe5c24d503f10ff136d9e0c49f9127a4279fd110b727929a5aa9"
osv_version="2.3.8"
osv_sha256="bc98e15319ed0d515e3f9235287ba53cdc5535d576d24fd573978ecfe9ab92dc"
syft_version="1.44.0"
syft_sha256="0e91737aee2b5baf1d255b959630194a302335d848ff97bb07921eb6205b5f5a"
govulncheck_version="v1.6.0"

usage() {
  cat >&2 <<'USAGE'
usage: security-scan.sh [options]

Download and verify the approved free security tools, run repository scans and
optionally scan the two locally-built immutable images. Every tool archive is
checked against a repository-pinned SHA-256 before execution.

options:
  --output-dir PATH       Evidence directory (default: release/security)
  --game-image REF@DIGEST Scan the local game image and emit its SBOM
  --web-image REF@DIGEST  Scan the local web image and emit its SBOM
  --release-commit SHA    Full commit SHA recorded in evidence
  --contract              Print the pinned tool contract without downloading
  --help
USAGE
}

die() {
  echo "security-scan: $*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --output-dir)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      output_dir="$2"
      shift 2
      ;;
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
    --release-commit)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      release_commit="$2"
      shift 2
      ;;
    --contract)
      contract_only=true
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

if [[ "$contract_only" == true ]]; then
  printf 'gitleaks=%s sha256:%s\n' "$gitleaks_version" "$gitleaks_sha256"
  printf 'trivy=%s sha256:%s\n' "$trivy_version" "$trivy_sha256"
  printf 'osv-scanner=%s sha256:%s\n' "$osv_version" "$osv_sha256"
  printf 'syft=%s sha256:%s\n' "$syft_version" "$syft_sha256"
  printf 'govulncheck=%s go-module-sumdb\n' "$govulncheck_version"
  exit 0
fi

for command_name in curl sha256sum tar jq go; do
  command -v "$command_name" >/dev/null 2>&1 || die "required command is missing: $command_name"
done
if [[ -n "$release_commit" && ! "$release_commit" =~ ^[0-9a-f]{40}$ ]]; then
  die "release commit must be a full lowercase SHA"
fi
for image_ref in "$game_image" "$web_image"; do
  [[ -z "$image_ref" || "$image_ref" =~ ^cr\.yandex/crpdnmjudj1usiu90gdn/(game|web)(:[0-9a-f]{40}|@sha256:[0-9a-f]{64})$ ]] ||
    die "image reference must be an approved Yandex repository tag or digest"
done

mkdir -p -- "$output_dir"
output_dir="$(cd -- "$output_dir" && pwd -P)"
download_dir="$(mktemp -d "${TMPDIR:-/tmp}/munchkin-security-tools.XXXXXX")"
cleanup() {
  rm -rf -- "$download_dir"
}
trap cleanup EXIT

download_verified() {
  local name="$1"
  local url="$2"
  local expected_sha="$3"
  local target="$download_dir/$name"
  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --silent --show-error \
    --output "$target" "$url"
  printf '%s  %s\n' "$expected_sha" "$target" | sha256sum --check --status - ||
    die "SHA-256 verification failed for $name"
  printf '%s\n' "$target"
}

extract_binary() {
  local archive="$1"
  local binary_name="$2"
  local directory="$download_dir/$binary_name"
  mkdir -p -- "$directory"
  tar --extract --gzip --file "$archive" --directory "$directory"
  local binary_path
  binary_path="$(find "$directory" -maxdepth 2 -type f -name "$binary_name" -print -quit)"
  [[ -n "$binary_path" && -x "$binary_path" ]] || die "verified archive did not contain executable $binary_name"
  printf '%s\n' "$binary_path"
}

gitleaks_archive="$(download_verified \
  "gitleaks-${gitleaks_version}.tar.gz" \
  "https://github.com/gitleaks/gitleaks/releases/download/v${gitleaks_version}/gitleaks_${gitleaks_version}_linux_x64.tar.gz" \
  "$gitleaks_sha256")"
trivy_archive="$(download_verified \
  "trivy-${trivy_version}.tar.gz" \
  "https://github.com/aquasecurity/trivy/releases/download/v${trivy_version}/trivy_${trivy_version}_Linux-64bit.tar.gz" \
  "$trivy_sha256")"
osv_binary="$(download_verified \
  "osv-scanner-${osv_version}" \
  "https://github.com/google/osv-scanner/releases/download/v${osv_version}/osv-scanner_linux_amd64" \
  "$osv_sha256")"
syft_archive="$(download_verified \
  "syft-${syft_version}.tar.gz" \
  "https://github.com/anchore/syft/releases/download/v${syft_version}/syft_${syft_version}_linux_amd64.tar.gz" \
  "$syft_sha256")"

gitleaks_bin="$(extract_binary "$gitleaks_archive" gitleaks)"
trivy_bin="$(extract_binary "$trivy_archive" trivy)"
syft_bin="$(extract_binary "$syft_archive" syft)"
chmod 0755 "$osv_binary"

"$gitleaks_bin" dir --redact --no-banner --report-format sarif \
  --report-path "$output_dir/gitleaks.sarif" "$repo_root"
"$trivy_bin" fs --scanners vuln,misconfig,secret --severity CRITICAL,HIGH \
  --format sarif --output "$output_dir/trivy-fs.sarif" --exit-code 1 --no-progress "$repo_root"
"$trivy_bin" config --severity CRITICAL,HIGH --format sarif \
  --output "$output_dir/trivy-config.sarif" --exit-code 1 "$repo_root"
"$osv_binary" scan source -r "$repo_root" --format json \
  --output "$output_dir/osv-scanner.json"

govulncheck_bin="$download_dir/go-bin/govulncheck"
mkdir -p -- "$(dirname -- "$govulncheck_bin")"
GOBIN="$(dirname -- "$govulncheck_bin")" go install "golang.org/x/vuln/cmd/govulncheck@${govulncheck_version}"
(
  cd "$repo_root/backend/game"
  "$govulncheck_bin" -json ./... >"$output_dir/govulncheck.json"
)

emit_image_evidence() {
  local image_ref="$1"
  local image_name="$2"
  [[ -n "$image_ref" ]] || return 0
  "$trivy_bin" image --scanners vuln,misconfig,secret --severity CRITICAL,HIGH \
    --format sarif --output "$output_dir/${image_name}.trivy.sarif" \
    --exit-code 1 --no-progress "$image_ref"
  "$syft_bin" "$image_ref" -o spdx-json >"$output_dir/${image_name}.sbom.spdx.json"
}

emit_image_evidence "$game_image" game
emit_image_evidence "$web_image" web

game_sbom_path=""
web_sbom_path=""
[[ -z "$game_image" ]] || game_sbom_path="$(basename "$output_dir/game.sbom.spdx.json")"
[[ -z "$web_image" ]] || web_sbom_path="$(basename "$output_dir/web.sbom.spdx.json")"
jq -n \
  --arg commit "$release_commit" \
  --arg gitleaks "$gitleaks_version" \
  --arg trivy "$trivy_version" \
  --arg osv "$osv_version" \
  --arg syft "$syft_version" \
  --arg govulncheck "$govulncheck_version" \
  --arg gameImage "$game_image" \
  --arg webImage "$web_image" \
  --arg gameSbom "$game_sbom_path" \
  --arg webSbom "$web_sbom_path" \
  '{schemaVersion:1,kind:"munchkin-security-evidence",commit:$commit,
    images:{game:{image:$gameImage,sbomPath:$gameSbom},web:{image:$webImage,sbomPath:$webSbom}},
    tools:{gitleaks:{version:$gitleaks,verification:"pinned-sha256"},
      trivy:{version:$trivy,verification:"pinned-sha256"},
      osvScanner:{version:$osv,verification:"pinned-sha256"},
      syft:{version:$syft,verification:"pinned-sha256"},
      govulncheck:{version:$govulncheck,verification:"Go checksum database"}},
    policy:{critical:"block",high:"block when reachable or runtime-impacting",medium:"30d",low:"next-maintenance",exceptionsMaxDays:30},
    attestations:{required:true,provider:"GitHub Artifact Attestations",signerWorkflow:".github/workflows/ci.yml"}}' \
  >"$output_dir/security-evidence-${release_commit:-local}.json"

echo "security-scan: verified pinned tools and completed repository/image evidence"
