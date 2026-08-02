#!/usr/bin/env bash
set -Eeuo pipefail

PATH="/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"
export PATH
export LC_ALL=C

deploy_user="munchkin-deploy"
deploy_port="2222"
gateway_path="/usr/local/sbin/munchkin-deploy-gateway"
config_dir="/etc/ssh/sshd_config.d"
config_path="$config_dir/91-munchkin-deploy-port.conf"
socket_override_dir="/etc/systemd/system/ssh.socket.d"
socket_override_path="$socket_override_dir/91-munchkin-deploy-port.conf"

die() {
  echo "configure-deploy-ssh: $*" >&2
  exit 1
}

if [[ "$#" -ne 0 ]]; then
  die "this command does not accept arguments"
fi
((EUID == 0)) || die "must run as root"

for command_name in awk getent grep install mktemp mv rm ss sshd stat systemctl ufw; do
  command -v "$command_name" >/dev/null 2>&1 ||
    die "required command is missing: $command_name"
done
getent passwd "$deploy_user" >/dev/null || die "deploy user does not exist"
[[ -x "$gateway_path" && ! -L "$gateway_path" ]] ||
  die "deploy gateway is missing or unsafe"
[[ "$(stat -c '%U:%G:%a' "$gateway_path")" == "root:root:755" ]] ||
  die "deploy gateway must be root-owned mode 0755"
ufw status | grep -q '^Status: active$' || die "UFW must be active before adding the listener"

install -d -m 0755 -o root -g root "$config_dir"
install -d -m 0755 -o root -g root /run/sshd
temp_root="$(mktemp -d /run/munchkin-deploy-ssh.XXXXXX)"
candidate="$temp_root/sshd-candidate.conf"
backup="$temp_root/previous.conf"
socket_candidate="$temp_root/ssh-socket-candidate.conf"
socket_backup="$temp_root/previous-socket.conf"
staged_path=""
socket_staged_path=""
had_previous=false
socket_had_previous=false
socket_activation=false

cleanup() {
  if [[ -n "$staged_path" && -e "$staged_path" ]]; then
    rm -f -- "$staged_path"
  fi
  if [[ -n "$socket_staged_path" && -e "$socket_staged_path" ]]; then
    rm -f -- "$socket_staged_path"
  fi
  case "$temp_root" in
    /run/munchkin-deploy-ssh.*) rm -rf -- "$temp_root" ;;
    *) echo "configure-deploy-ssh: refused unsafe temporary cleanup" >&2 ;;
  esac
}
trap cleanup EXIT

cat >"$candidate" <<'SSHD_CONFIG'
# Managed by scripts/production/configure-deploy-ssh.sh.
# Explicitly retain the owner/admin listener when adding the deploy listener.
Port 22
Port 2222

Match LocalPort 22
    DenyUsers munchkin-deploy

Match LocalPort 2222
    AllowUsers munchkin-deploy
    AuthenticationMethods publickey
    PubkeyAuthentication yes
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    PermitEmptyPasswords no
    PermitRootLogin no
    PermitTTY no
    PermitUserRC no
    DisableForwarding yes
    AllowAgentForwarding no
    AllowTcpForwarding no
    AllowStreamLocalForwarding no
    GatewayPorts no
    X11Forwarding no
    PermitTunnel no
    PermitOpen none
    PermitListen none
    MaxSessions 1
    ForceCommand /usr/local/sbin/munchkin-deploy-gateway

Match all
SSHD_CONFIG
chmod 0644 "$candidate"

if systemctl is-active --quiet ssh.socket; then
  socket_activation=true
  command -v systemd-analyze >/dev/null 2>&1 ||
    die "systemd-analyze is required for active ssh.socket"
  cat >"$socket_candidate" <<'SSH_SOCKET_CONFIG'
# Managed by scripts/production/configure-deploy-ssh.sh.
[Socket]
ListenStream=0.0.0.0:2222
ListenStream=[::]:2222
SSH_SOCKET_CONFIG
  chmod 0644 "$socket_candidate"
fi

# First validate the isolated candidate syntax. The full assembled sshd config
# is validated again after atomic placement and before any service reload.
sshd -t -f "$candidate" || die "candidate sshd configuration is invalid"

if [[ -e "$config_path" || -L "$config_path" ]]; then
  [[ -f "$config_path" && ! -L "$config_path" ]] ||
    die "existing deploy SSH config is not a regular file"
  install -m 0644 -o root -g root "$config_path" "$backup"
  had_previous=true
fi
if [[ "$socket_activation" == true ]]; then
  install -d -m 0755 -o root -g root "$socket_override_dir"
  if [[ -e "$socket_override_path" || -L "$socket_override_path" ]]; then
    [[ -f "$socket_override_path" && ! -L "$socket_override_path" ]] ||
      die "existing SSH socket override is not a regular file"
    install -m 0644 -o root -g root "$socket_override_path" "$socket_backup"
    socket_had_previous=true
  fi
fi

restore_previous() {
  local restore_stage socket_restore_stage
  if [[ "$had_previous" == true ]]; then
    restore_stage="$(mktemp "$config_dir/.91-munchkin-deploy-restore.XXXXXX")"
    install -m 0644 -o root -g root "$backup" "$restore_stage"
    mv -f -- "$restore_stage" "$config_path"
  else
    rm -f -- "$config_path"
  fi
  sshd -t
  if [[ "$socket_activation" == true ]]; then
    if [[ "$socket_had_previous" == true ]]; then
      socket_restore_stage="$(mktemp "$socket_override_dir/.91-munchkin-deploy-restore.XXXXXX")"
      install -m 0644 -o root -g root "$socket_backup" "$socket_restore_stage"
      mv -f -- "$socket_restore_stage" "$socket_override_path"
    else
      rm -f -- "$socket_override_path"
    fi
    systemctl daemon-reload
    systemctl restart ssh.socket
  else
    systemctl reload ssh.service
  fi
}

staged_path="$(mktemp "$config_dir/.91-munchkin-deploy-port.XXXXXX")"
install -m 0644 -o root -g root "$candidate" "$staged_path"
mv -f -- "$staged_path" "$config_path"
staged_path=""

if [[ "$socket_activation" == true ]]; then
  socket_staged_path="$(mktemp "$socket_override_dir/.91-munchkin-deploy-port.XXXXXX")"
  install -m 0644 -o root -g root "$socket_candidate" "$socket_staged_path"
  mv -f -- "$socket_staged_path" "$socket_override_path"
  socket_staged_path=""
fi

if ! sshd -t; then
  restore_previous || true
  die "assembled sshd configuration is invalid; previous config restored"
fi
if [[ "$socket_activation" == true ]]; then
  systemctl daemon-reload
  if ! systemd-analyze verify ssh.socket >/dev/null ||
    ! systemctl restart ssh.socket; then
    restore_previous || true
    die "ssh.socket activation failed; previous config restored"
  fi
elif ! systemctl reload ssh.service; then
  restore_previous || true
  die "ssh reload failed; previous config restored"
fi

# Restarting the socket unit stops the main ssh.service process while existing
# sessions survive via KillMode=process. Recreate its ephemeral RuntimeDirectory
# before standalone effective-config checks in this still-established session.
install -d -m 0755 -o root -g root /run/sshd

effective_deploy="$(sshd -T -C "user=$deploy_user,host=localhost,addr=127.0.0.1,laddr=127.0.0.1,lport=$deploy_port")"
for expected_setting in \
  "allowusers $deploy_user" \
  "authenticationmethods publickey" \
  "pubkeyauthentication yes" \
  "passwordauthentication no" \
  "kbdinteractiveauthentication no" \
  "permitrootlogin no" \
  "permittty no" \
  "permituserrc no" \
  "disableforwarding yes" \
  "allowagentforwarding no" \
  "allowtcpforwarding no" \
  "allowstreamlocalforwarding no" \
  "x11forwarding no" \
  "permittunnel no" \
  "forcecommand $gateway_path"; do
  grep -qx -F "$expected_setting" <<<"$effective_deploy" || {
    restore_previous || true
    die "effective deploy SSH policy is missing: $expected_setting"
  }
done

effective_owner_on_deploy="$(sshd -T -C "user=munchkin-admin,host=localhost,addr=127.0.0.1,laddr=127.0.0.1,lport=$deploy_port")"
grep -qx -F "allowusers $deploy_user" <<<"$effective_owner_on_deploy" || {
  restore_previous || true
  die "deploy port is not restricted to the deploy user"
}
effective_deploy_on_owner="$(sshd -T -C "user=$deploy_user,host=localhost,addr=127.0.0.1,laddr=127.0.0.1,lport=22")"
grep -qx -F "denyusers $deploy_user" <<<"$effective_deploy_on_owner" || {
  restore_previous || true
  die "deploy user is not denied on the owner SSH port"
}

ss -lntH | awk -v port=":$deploy_port" '$4 ~ port "$" { found=1 } END { exit found ? 0 : 1 }' || {
  restore_previous || true
  die "deploy SSH listener did not bind TCP $deploy_port"
}

ufw limit "$deploy_port/tcp" >/dev/null
ufw status | awk -v port="$deploy_port/tcp" '$1 == port && $2 == "LIMIT" { found=1 } END { exit found ? 0 : 1 }' ||
  die "UFW rate-limit rule for TCP $deploy_port is missing"

echo "configure-deploy-ssh: owner TCP 22 retained; deploy-only TCP 2222 active"
