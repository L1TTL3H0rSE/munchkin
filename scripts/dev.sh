#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

jobs="${LEINO_COMPOSE_PARALLEL:-8}"
if [[ ! "$jobs" =~ ^[0-9]+$ ]] || (( jobs < 4 )); then
  echo "LEINO_COMPOSE_PARALLEL must be an integer >= 4" >&2
  exit 2
fi

for argument in "$@"; do
  case "$argument" in
    --parallel|--parallel=*)
      echo "Do not pass --parallel directly; leinoctl owns Compose parallelism" >&2
      exit 2
      ;;
  esac
done

exec ./leinoctl compose \
  --jobs "$jobs" \
  -- \
  up \
  --build \
  "$@"
