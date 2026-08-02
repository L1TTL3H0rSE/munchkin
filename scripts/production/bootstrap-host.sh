#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="/srv/munchkin"
compose_dir="$root_dir/compose"
script_dir="$compose_dir/scripts"
secret_dir="$root_dir/secrets"
state_dir="$root_dir/state"
acme_dir="$root_dir/traefik/acme"
postgres_dir="$root_dir/postgres"
deploy_user="munchkin-deploy"
deploy_public_key_file=""
source_root=""

usage() {
  cat >&2 <<'USAGE'
usage: bootstrap-host.sh --deploy-public-key-file PATH [--source-root PATH]

The public key is installed with a forced command. Private keys and secret
payloads are never accepted by this script.
USAGE
}

while (($# > 0)); do
  case "$1" in
    --deploy-public-key-file)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      deploy_public_key_file="$2"
      shift 2
      ;;
    --source-root)
      [[ $# -ge 2 ]] || { usage; exit 64; }
      source_root="$2"
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
  echo "bootstrap-host.sh must run as root" >&2
  exit 77
fi
if [[ -z "$deploy_public_key_file" || ! -f "$deploy_public_key_file" ]]; then
  echo "a deploy public key file is required" >&2
  exit 64
fi

public_key="$(<"$deploy_public_key_file")"
if [[ ! "$public_key" =~ ^ssh-ed25519[[:space:]]+[A-Za-z0-9+/]+={0,3}([[:space:]]+[^[:cntrl:]]+)?$ ]]; then
  echo "deploy public key must be one OpenSSH ED25519 key" >&2
  exit 64
fi
if [[ "$public_key" == *$'\n'* || "$public_key" == *$'\r'* ]]; then
  echo "deploy public key must be a single line" >&2
  exit 64
fi

if ! id -u "$deploy_user" >/dev/null 2>&1; then
  useradd --system --user-group --create-home --home-dir "/var/lib/$deploy_user" \
    --shell /usr/sbin/nologin "$deploy_user"
fi
usermod --shell /usr/sbin/nologin "$deploy_user"
if id -nG "$deploy_user" | tr ' ' '\n' | grep -qx docker; then
  gpasswd --delete "$deploy_user" docker >/dev/null 2>&1 || true
fi

install -d -m 0750 -o root -g root \
  "$root_dir" "$compose_dir" "$script_dir" "$state_dir"
install -d -m 0700 -o root -g root "$secret_dir" "$acme_dir"
install -d -m 0700 -o 70 -g 70 "$postgres_dir"
install -d -m 0700 -o root -g root "$root_dir/backups"

ensure_protected_file() {
  local file_path="$1"
  if [[ -e "$file_path" || -L "$file_path" ]]; then
    [[ -f "$file_path" && ! -L "$file_path" ]] || {
      echo "protected path is not a regular file: $file_path" >&2
      exit 66
    }
    chown root:root "$file_path"
    chmod 0600 "$file_path"
  else
    install -m 0600 -o root -g root /dev/null "$file_path"
  fi
}

ensure_protected_file "$secret_dir/postgres.env"
ensure_protected_file "$secret_dir/game.env"
ensure_protected_file "$secret_dir/traefik.env"
ensure_protected_file "$acme_dir/acme.json"

if [[ -n "$source_root" ]]; then
  [[ -d "$source_root" ]] || { echo "source root is not a directory" >&2; exit 66; }
  for source_file in \
    compose.production.yml \
    infra/compose/traefik-static.yml \
    infra/compose/traefik-dynamic.yml \
    infra/otel/collector.production.yaml \
    scripts/production/deploy.sh \
    scripts/production/rollback.sh \
    scripts/production/status.sh \
    scripts/production/smoke.sh; do
    [[ -f "$source_root/$source_file" ]] || {
      echo "source artifact is missing: $source_file" >&2
      exit 66
    }
  done
  install -m 0640 -o root -g root "$source_root/compose.production.yml" "$compose_dir/compose.production.yml"
  install -m 0640 -o root -g root "$source_root/infra/compose/traefik-static.yml" "$compose_dir/traefik-static.yml"
  install -m 0640 -o root -g root "$source_root/infra/compose/traefik-dynamic.yml" "$compose_dir/traefik-dynamic.yml"
  install -m 0640 -o root -g root "$source_root/infra/otel/collector.production.yaml" "$compose_dir/collector.production.yml"
  for script_name in deploy rollback status smoke; do
    install -m 0750 -o root -g root "$source_root/scripts/production/$script_name.sh" "$script_dir/$script_name.sh"
  done
fi

[[ -f "$compose_dir/compose.production.yml" ]] || {
  echo "production Compose has not been installed" >&2
  exit 66
}

gateway_path=/usr/local/sbin/munchkin-deploy-gateway
allowlist_path=/usr/local/sbin/munchkin-deploy-allowlist
install -m 0750 -o root -g root /dev/null "$allowlist_path"
cat >"$allowlist_path" <<'ALLOWLIST'
#!/usr/bin/env bash
set -Eeuo pipefail
script_dir=/srv/munchkin/compose/scripts
command_name="${1:-}"
shift || true
case "$command_name" in
  deploy) exec "$script_dir/deploy.sh" "$@" ;;
  rollback) exec "$script_dir/rollback.sh" "$@" ;;
  status) exec "$script_dir/status.sh" "$@" ;;
  smoke) exec "$script_dir/smoke.sh" "$@" ;;
  recover) exec "$script_dir/deploy.sh" --recover "$@" ;;
  *) echo "unsupported production command" >&2; exit 64 ;;
esac
ALLOWLIST
chmod 0750 "$allowlist_path"

install -m 0755 -o root -g root /dev/null "$gateway_path"
cat >"$gateway_path" <<'GATEWAY'
#!/usr/bin/env bash
set -Eeuo pipefail
read -r command_name rest <<<"${SSH_ORIGINAL_COMMAND:-}"
case "$command_name" in
  deploy|rollback|status|smoke|recover)
    exec sudo -n /usr/local/sbin/munchkin-deploy-allowlist "$command_name" $rest
    ;;
  *)
    echo "unsupported SSH command" >&2
    exit 64
    ;;
esac
GATEWAY
chmod 0755 "$gateway_path"
usermod --shell "$gateway_path" "$deploy_user"

ssh_dir="/var/lib/$deploy_user/.ssh"
install -d -m 0700 -o "$deploy_user" -g "$deploy_user" "$ssh_dir"
key_tmp="$(mktemp "$ssh_dir/authorized_keys.XXXXXX")"
chmod 0600 "$key_tmp"
printf 'command="%s",no-agent-forwarding,no-port-forwarding,no-pty,no-user-rc,no-X11-forwarding %s\n' \
  "$gateway_path" "$public_key" >"$key_tmp"
chown "$deploy_user:$deploy_user" "$key_tmp"
mv -f "$key_tmp" "$ssh_dir/authorized_keys"

cat >/etc/sudoers.d/munchkin-deploy <<SUDOERS
Defaults:$deploy_user !setenv
$deploy_user ALL=(root) NOPASSWD: $allowlist_path
SUDOERS
chown root:root /etc/sudoers.d/munchkin-deploy
chmod 0440 /etc/sudoers.d/munchkin-deploy
visudo -cf /etc/sudoers.d/munchkin-deploy >/dev/null

if [[ -n "$source_root" && -f "$source_root/scripts/production/systemd/munchkin-compose.service" ]]; then
  install -m 0644 -o root -g root \
    "$source_root/scripts/production/systemd/munchkin-compose.service" \
    /etc/systemd/system/munchkin-compose.service
  systemctl daemon-reload
  systemctl enable munchkin-compose.service
fi

echo "production host boundary prepared"
