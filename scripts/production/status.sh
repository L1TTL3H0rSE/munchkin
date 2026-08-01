#!/usr/bin/env bash
set -Eeuo pipefail

root_dir=/srv/munchkin
compose_file="$root_dir/compose/compose.production.yml"
current_file="$root_dir/state/current-release.json"

if ((EUID != 0)); then
  echo 'status.sh must run as root' >&2
  exit 77
fi
command -v jq >/dev/null 2>&1 || { echo 'jq is required' >&2; exit 69; }
command -v docker >/dev/null 2>&1 || { echo 'docker is required' >&2; exit 69; }

if [[ "${1:-}" == '--evidence' ]]; then
  [[ $# -eq 1 ]] || { echo 'status --evidence accepts no additional arguments' >&2; exit 64; }
  [[ -f "$current_file" ]] || { echo 'no current release evidence is available' >&2; exit 66; }
  jq '.' "$current_file"
  exit 0
fi
[[ $# -eq 0 ]] || { echo 'unsupported status argument' >&2; exit 64; }

if [[ -f "$current_file" ]]; then
  jq -r '
    "result=\(.result)",
    "commit=\(.commit)",
    "game=\(.images.game.image)",
    "web=\(.images.web.image)",
    "completedAt=\(.completedAt)",
    "migration=\(.migration.result)",
    "readiness=\(.readiness.result)",
    "smoke=\(.smoke.result)"' "$current_file"
else
  echo 'result=none'
fi

docker compose --parallel 8 -f "$compose_file" ps
