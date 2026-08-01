#!/usr/bin/env bash
set -Eeuo pipefail

root_dir=/srv/munchkin
compose_file="$root_dir/compose/compose.production.yml"
run_internal=false
run_public=false
public_host="${MUNCHKIN_PUBLIC_HOST:-munchkin.l1ttl3h0rse.ru}"

usage() {
  cat >&2 <<'USAGE'
usage: smoke.sh [--internal] [--public] [--host HOSTNAME]
USAGE
}

while (($# > 0)); do
  case "$1" in
    --internal)
      run_internal=true
      shift
      ;;
    --public)
      run_public=true
      shift
      ;;
    --host)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      public_host="$2"
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

if ((EUID != 0)); then
  echo 'smoke.sh must run as root' >&2
  exit 77
fi
if [[ "$run_internal" == false && "$run_public" == false ]]; then
  usage
  exit 64
fi
if [[ ! "$public_host" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo 'public smoke host contains unsupported characters' >&2
  exit 64
fi
[[ -f "$compose_file" ]] || {
  echo 'production Compose file is missing' >&2
  exit 66
}

compose() {
  docker compose --parallel 8 -f "$compose_file" "$@"
}

if [[ "$run_internal" == true ]]; then
  compose exec -T game wget -q -O - http://127.0.0.1:8080/health/live >/dev/null
  compose exec -T game wget -q -O - http://127.0.0.1:8080/health/ready >/dev/null
  compose exec -T web wget -q -O - http://127.0.0.1:3000/ >/dev/null
fi

if [[ "$run_public" == true ]]; then
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
    --max-time 15 --output /dev/null "https://$public_host/"
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
    --max-time 15 --output /dev/null "https://$public_host/health/live"
fi

echo 'production smoke passed'
