#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

jobs="${MUNCHKIN_COMPOSE_PARALLEL:-8}"
if [[ ! "$jobs" =~ ^[0-9]+$ ]] || (( jobs < 4 )); then
  echo "MUNCHKIN_COMPOSE_PARALLEL must be an integer >= 4" >&2
  exit 2
fi

for argument in "$@"; do
  case "$argument" in
    --parallel|--parallel=*|-v|--volumes)
      echo "Use MUNCHKIN_COMPOSE_PARALLEL; volume deletion is unsupported" >&2
      exit 2
      ;;
  esac
done

case "${1:-}" in
  up|down|start|stop|restart|ps|logs|config|build) ;;
  *) set -- up --build "$@" ;;
esac

exec docker compose --parallel "$jobs" -f docker-compose.yml "$@"
