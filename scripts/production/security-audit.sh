#!/usr/bin/env bash
set -Eeuo pipefail

PATH="/usr/bin:/bin:${PATH:-}"
export PATH

root_dir="${MUNCHKIN_DATA_DIR:-/srv/munchkin}"
secret_dir="${MUNCHKIN_SECRETS_DIR:-$root_dir/secrets}"
live=false

usage() {
  cat >&2 <<'USAGE'
usage: security-audit.sh [--live]

Without --live, verify only the repository-side audit contract. Live mode is a
root-only host read and emits sanitized listener, identity, permission,
firewall, patch and Docker-boundary results; it never prints secret values.
USAGE
}

die() {
  echo "security-audit: $*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --live)
      live=true
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

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
for contract_file in \
  "$repo_root/compose.production.yml" \
  "$repo_root/infra/compose/traefik-static.yml" \
  "$repo_root/infra/compose/traefik-dynamic.yml" \
  "$repo_root/scripts/production/deploy.sh"; do
  [[ -f "$contract_file" ]] || die "missing security contract: $contract_file"
done

if rg -n 'docker\.sock|2375|2376|privileged:[[:space:]]*true|network_mode:[[:space:]]*host' \
  "$repo_root/compose.production.yml" "$repo_root/infra/compose" >/dev/null; then
  die "repository security contract contains Docker API or host escape exposure"
fi
published_port_count=0
while IFS= read -r port_mapping; do
  case "$port_mapping" in
    80:8080|443:8443)
      published_port_count=$((published_port_count + 1))
      ;;
    *)
      die "production Compose exposes a non-edge port: $port_mapping"
      ;;
  esac
done < <(sed -nE 's/^[[:space:]]*-[[:space:]]*"([0-9]+:[0-9]+)"[[:space:]]*$/\1/p' \
  "$repo_root/compose.production.yml")
[[ "$published_port_count" -eq 2 ]] || die "production Compose must publish exactly the HTTP and HTTPS edge ports"
for setting in \
  'no-new-privileges:true' \
  'cap_drop:' \
  'read_only: true' \
  'max-size: 10m' \
  'max-file: "3"' \
  'forwardingTimeouts:' \
  'production-security-headers'; do
  rg -q -F "$setting" "$repo_root/compose.production.yml" "$repo_root/infra/compose" ||
    die "missing repository security setting: $setting"
done

if [[ "$live" == false ]]; then
  echo "security-audit: repository security contract passed; live host audit not requested"
  exit 0
fi

((EUID == 0)) || die "live mode must run as root"
for command_name in awk cat cut docker find getent grep ss stat systemctl ufw; do
  command -v "$command_name" >/dev/null 2>&1 || die "required live command is missing: $command_name"
done

while read -r _ local_address _; do
  [[ "$local_address" =~ :([0-9]+)$ ]] || continue
  port="${BASH_REMATCH[1]}"
  [[ "$port" == 22 || "$port" == 80 || "$port" == 443 ]] ||
    die "unexpected public listener on port $port"
done < <(ss -lntH)

deploy_user="munchkin-deploy"
if getent group docker | awk -F: -v user="$deploy_user" '$4 ~ "(^|,)" user "(,|$)" { found=1 } END { exit found ? 0 : 1 }'; then
  die "deploy user is a member of the Docker group"
fi
if [[ -S /var/run/docker.sock && "$(stat -c '%u:%a' /var/run/docker.sock)" != "0:660" ]]; then
  die "Docker socket permissions are broader than root/docker 0660"
fi

for secret_file in "$secret_dir"/*.env "$root_dir/traefik/acme/acme.json"; do
  [[ -e "$secret_file" ]] || continue
  [[ -f "$secret_file" && ! -L "$secret_file" ]] || die "secret path is not a regular file"
  [[ "$(stat -c '%u:%a' "$secret_file")" == '0:600' ]] ||
    die "secret path is not root-owned mode 0600: $(basename "$secret_file")"
done

grep -RqsE '^[[:space:]]*PermitRootLogin[[:space:]]+no' /etc/ssh/sshd_config /etc/ssh/sshd_config.d ||
  die "root SSH login is not explicitly disabled"
systemctl is-enabled --quiet unattended-upgrades || die "unattended-upgrades is not enabled"
ufw status | grep -q 'Status: active' || die "UFW is not active"
docker info --format '{{json .SecurityOptions}}' | grep -q 'seccomp' ||
  die "Docker seccomp security option is not active"

echo "security-audit: live host listener, identity, secret-mode, patch, firewall and Docker checks passed"
