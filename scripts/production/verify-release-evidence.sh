#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PATH="/usr/bin:/bin:${PATH:-}"
export PATH

game_image=""
web_image=""
release_commit=""
release_manifest=""
security_evidence=""
github_repo=""
require_attestation=false

usage() {
  cat >&2 <<'USAGE'
usage: verify-release-evidence.sh --game-image REF@DIGEST --web-image REF@DIGEST \
  --commit SHA --release-manifest PATH --security-evidence PATH \
  --github-repo OWNER/REPO [--require-attestation]

Validates the immutable image pair, release SHA, SBOM evidence and (when
requested) GitHub keyless provenance/SBOM attestations. Missing or mismatched
evidence fails closed. No image or registry mutation is performed.
USAGE
}

die() {
  echo "verify-release-evidence: $*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --game-image|--web-image|--commit|--release-manifest|--security-evidence|--github-repo)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      case "$1" in
        --game-image) game_image="$2" ;;
        --web-image) web_image="$2" ;;
        --commit) release_commit="$2" ;;
        --release-manifest) release_manifest="$2" ;;
        --security-evidence) security_evidence="$2" ;;
        --github-repo) github_repo="$2" ;;
      esac
      shift 2
      ;;
    --require-attestation)
      require_attestation=true
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

command -v jq >/dev/null 2>&1 || die "jq is required"
[[ "$game_image" =~ ^cr\.yandex/crpdnmjudj1usiu90gdn/game@sha256:[0-9a-f]{64}$ ]] ||
  die "game image is not an approved immutable digest"
[[ "$web_image" =~ ^cr\.yandex/crpdnmjudj1usiu90gdn/web@sha256:[0-9a-f]{64}$ ]] ||
  die "web image is not an approved immutable digest"
[[ "$release_commit" =~ ^[0-9a-f]{40}$ ]] || die "release commit is not a full lowercase SHA"
[[ "$github_repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "GitHub repository is invalid"
[[ -f "$release_manifest" && -f "$security_evidence" ]] || die "release evidence files are missing"

game_digest="sha256:${game_image##*@sha256:}"
web_digest="sha256:${web_image##*@sha256:}"
game_release_ref="${game_image%@sha256:*}:$release_commit"
web_release_ref="${web_image%@sha256:*}:$release_commit"

jq -e \
  --arg commit "$release_commit" \
  --arg gameRef "$game_release_ref" \
  --arg gameDigest "$game_digest" \
  --arg webRef "$web_release_ref" \
  --arg webDigest "$web_digest" \
  '.schemaVersion == 1 and .commit == $commit and
   .images.game.ref == $gameRef and .images.game.digest == $gameDigest and
   .images.game.image == ($gameRef + "@" + $gameDigest) and
   .images.web.ref == $webRef and .images.web.digest == $webDigest and
   .images.web.image == ($webRef + "@" + $webDigest)' \
  "$release_manifest" >/dev/null || die "release manifest does not match requested SHA and image pair"

jq -e \
  --arg commit "$release_commit" \
  --arg game "$game_image" \
  --arg web "$web_image" \
  '.schemaVersion == 1 and .commit == $commit and
   .images.game.image == $game and .images.web.image == $web and
   .tools.gitleaks.version == "8.30.1" and .tools.trivy.version == "0.70.0" and
   .tools.osvScanner.version == "2.3.8" and .tools.syft.version == "1.44.0" and
   .tools.govulncheck.version == "v1.6.0" and
   .attestations.required == true and
   (.attestations.signerWorkflow == ".github/workflows/ci.yml")' \
  "$security_evidence" >/dev/null || die "security evidence contract does not match the approved policy"

evidence_dir="$(cd -- "$(dirname -- "$security_evidence")" && pwd -P)"
for sbom_path in \
  "$(jq -er '.images.game.sbomPath' "$security_evidence")" \
  "$(jq -er '.images.web.sbomPath' "$security_evidence")"; do
  [[ -f "$evidence_dir/$sbom_path" ]] || die "referenced SBOM is missing: $sbom_path"
done

verify_attestation() {
  local image_ref="$1"
  local bundle_path="$2"
  local predicate_type="${3:-slsaprovenance1}"
  local digest="${image_ref##*@sha256:}"
  if ! cosign verify-blob-attestation \
    --bundle "$evidence_dir/$bundle_path" \
    --digest "$digest" \
    --digestAlg sha256 \
    --type "$predicate_type" \
    --certificate-identity "https://github.com/$github_repo/.github/workflows/ci.yml@refs/heads/main" \
    --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
    --certificate-github-workflow-repository "$github_repo" \
    --certificate-github-workflow-ref "refs/heads/main" \
    --certificate-github-workflow-sha "$release_commit" \
    --certificate-github-workflow-name "Munchkin CI" \
    --certificate-github-workflow-trigger push \
    --check-claims=true \
    --new-bundle-format=true >/dev/null; then
    die "Sigstore attestation verification failed for $(basename "$image_ref")"
  fi
}

if [[ "$require_attestation" == true ]]; then
  command -v cosign >/dev/null 2>&1 || die "Cosign is required for attestation verification"
  game_provenance="$(jq -er '.attestations.game.provenanceBundle' "$security_evidence")"
  web_provenance="$(jq -er '.attestations.web.provenanceBundle' "$security_evidence")"
  game_sbom="$(jq -er '.attestations.game.sbomBundle' "$security_evidence")"
  web_sbom="$(jq -er '.attestations.web.sbomBundle' "$security_evidence")"
  for bundle in "$game_provenance" "$web_provenance" "$game_sbom" "$web_sbom"; do
    [[ -f "$evidence_dir/$bundle" ]] || die "referenced attestation bundle is missing: $bundle"
  done
  verify_attestation "$game_image" "$game_provenance"
  verify_attestation "$web_image" "$web_provenance"
  verify_attestation "$game_image" "$game_sbom" "https://spdx.dev/Document/v2.3"
  verify_attestation "$web_image" "$web_sbom" "https://spdx.dev/Document/v2.3"
fi

echo "verify-release-evidence: immutable pair, release SHA, SBOM policy and requested attestations passed"
