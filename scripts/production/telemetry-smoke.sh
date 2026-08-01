#!/usr/bin/env bash
set -Eeuo pipefail
PATH="/usr/bin:/bin:${PATH:-}"
export PATH

root_dir="${MUNCHKIN_DATA_DIR:-/srv/munchkin}"
compose_file="$root_dir/compose/compose.production.yml"
secret_dir="${MUNCHKIN_SECRETS_DIR:-$root_dir/secrets}"
telemetry_env="$secret_dir/telemetry.env"
public_url="${MUNCHKIN_SMOKE_URL:-https://munchkin.l1ttl3h0rse.ru}"
release_sha="${MUNCHKIN_RELEASE_COMMIT:-}"
live=false
outage_test=false
soak_minutes=60

usage() {
  cat >&2 <<'USAGE'
usage: telemetry-smoke.sh [--live] [--outage-test] [--soak-minutes N]

Without --live the script performs repository-local privacy and configuration
checks only. Live mode requires an already approved host update and a root-owned
telemetry.env; it never prints secret values.
USAGE
}

die() {
  echo "telemetry-smoke: $*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --live)
      live=true
      shift
      ;;
    --outage-test)
      outage_test=true
      shift
      ;;
    --soak-minutes)
      [[ $# -ge 2 && "$2" =~ ^[0-9]+$ ]] || {
        usage
        exit 64
      }
      soak_minutes="$2"
      ((soak_minutes <= 120)) || die "soak duration is capped at 120 minutes"
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

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
collector_config="$repo_root/infra/otel/collector.production.yaml"
dashboard_file="$repo_root/infra/observability/monium/production-dashboard.json"
alerts_file="$repo_root/infra/observability/monium/production-alerts.yaml"

[[ -f "$collector_config" && -f "$dashboard_file" && -f "$alerts_file" ]] ||
  die "telemetry contract files are incomplete"

if rg -n \
  '(^|[[:space:]])(game_id|player_id|card_id|command_id|request_id|source_instance_id|DATABASE_URL|MONIUM_API_KEY)[[:space:]]*[:=]' \
  "$dashboard_file" "$alerts_file" >/dev/null; then
  die "dashboard or alert definitions contain a forbidden identifier or secret assignment"
fi
if rg -n 'MONIUM_API_KEY[[:space:]]*=[[:space:]]*[^$[:space:]]' \
  "$collector_config" "$repo_root/compose.production.yml" >/dev/null; then
  die "repository telemetry wiring contains a literal API-key value"
fi
if rg -n '^[[:space:]]+logs:' "$collector_config" >/dev/null; then
  die "production Collector must not contain a logs pipeline"
fi
for required_setting in \
  'tail_sampling:' \
  'attributes/privacy:' \
  'retry_on_failure:' \
  'sending_queue:' \
  'x-monium-project:' \
  'x-monium-cluster:' \
  'otlp/monium:'; do
  rg -q -F "$required_setting" "$collector_config" ||
    die "Collector is missing required bounded setting: $required_setting"
done

if [[ "$live" == false ]]; then
  echo "telemetry-smoke: static privacy/config checks passed"
  exit 0
fi

((EUID == 0)) || die "live mode must run as root"
[[ -f "$compose_file" ]] || die "production Compose file is missing"
[[ -f "$telemetry_env" && ! -L "$telemetry_env" ]] ||
  die "telemetry.env must be a regular file in the protected secret directory"

secret_mode="$(stat -c '%a' "$telemetry_env")"
secret_owner="$(stat -c '%u:%g' "$telemetry_env")"
[[ "$secret_mode" == "600" && "$secret_owner" == "0:0" ]] ||
  die "telemetry.env must be root-owned with mode 0600"
rg -q '^MONIUM_API_KEY=[^[:space:]].*$' "$telemetry_env" ||
  die "telemetry.env is missing a non-empty Monium API key"
rg -q '^MONIUM_PROJECT=folder__[a-z0-9]+$' "$telemetry_env" ||
  die "telemetry.env has an invalid Monium project label"

[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] ||
  die "MUNCHKIN_RELEASE_COMMIT must be a full 40-character release SHA in live mode"
[[ "$public_url" =~ ^https://[A-Za-z0-9.-]+$ ]] ||
  die "MUNCHKIN_SMOKE_URL must be an HTTPS origin without a path"
[[ -n "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]] ||
  die "OTEL_EXPORTER_OTLP_ENDPOINT must point the applications at the private Collector"

compose() {
  docker compose --parallel 8 -f "$compose_file" "$@"
}

compose --profile telemetry config --quiet
compose --profile telemetry up -d collector game web
compose --profile telemetry exec -T collector wget -q -O - \
  http://127.0.0.1:13133/ >/dev/null
compose --profile telemetry exec -T game wget -q -O - \
  http://127.0.0.1:8080/health/live >/dev/null
compose --profile telemetry exec -T game wget -q -O - \
  http://127.0.0.1:8080/health/ready >/dev/null
compose --profile telemetry exec -T web wget -q -O - \
  http://127.0.0.1:3000/ >/dev/null

curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
  --max-time 15 --output /dev/null \
  -H 'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' \
  "$public_url/health/live"

if [[ "$outage_test" == true ]]; then
  compose --profile telemetry stop collector
  compose --profile telemetry exec -T game wget -q -O - \
    http://127.0.0.1:8080/health/live >/dev/null
  compose --profile telemetry exec -T game wget -q -O - \
    http://127.0.0.1:8080/health/ready >/dev/null
  compose --profile telemetry start collector
  compose --profile telemetry exec -T collector wget -q -O - \
    http://127.0.0.1:13133/ >/dev/null
fi

for ((minute = 1; minute <= soak_minutes; minute += 1)); do
  sleep 60
  compose --profile telemetry exec -T collector wget -q -O - \
    http://127.0.0.1:13133/ >/dev/null
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
    --max-time 15 --output /dev/null "$public_url/health/live"
done

echo "telemetry-smoke: live path passed for release $release_sha; soak minutes=$soak_minutes"
