#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

all_paths=".leino/profile.json,backend/game,frontend,content,docker-compose.yml,scripts/dev.sh,.gitlab-ci.yml,README.md,docs/agents"
zero_sha="0000000000000000000000000000000000000000"
base="${LEINO_BASE_SHA:-${CI_MERGE_REQUEST_DIFF_BASE_SHA:-${CI_COMMIT_BEFORE_SHA:-}}}"

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "ci-impact requires a committed CI checkout" >&2
  exit 2
fi

if [[ -z "$base" || "$base" == "$zero_sha" ]]; then
  git diff-tree --check --root -r HEAD
  ./leinoctl text-check --paths "$all_paths"
  ./leinoctl verify --paths "$all_paths" --dry-run
  exit 0
fi

if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  echo "CI base commit is unavailable: $base" >&2
  exit 2
fi

git diff --check "${base}...HEAD"
./leinoctl text-check --base "$base"
./leinoctl verify --base "$base" --dry-run
