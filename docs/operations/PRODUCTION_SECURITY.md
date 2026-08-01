# Production security runbook

This runbook is the repository-side security contract for the single
Munchkin production VM. It documents the intended boundary; it does not
authorize Terraform apply, GitHub/Yandex settings changes, secret insertion,
VM bootstrap, DNS/NS changes, or a production deploy.

## Fixed security boundary

- The public edge is Traefik on TCP `80/443`. PostgreSQL, game, web, OTLP,
  Collector and management ports are private.
- SSH is TCP `22` only from the owner-supplied IPv4 CIDR set. IPv6 ingress is
  not part of the baseline.
- `munchkin-runtime` pulls images and reads the metadata-only Lockbox
  definition. It does not receive Terraform state, CI publishing, backup
  administration or signing keys.
- `munchkin-github-images` is the keyless GitHub WIF publisher for the exact
  `production-images` environment subject. No service-account key is managed.
- Backup, telemetry writer, Terraform state and deployment identities remain
  separate. The runtime user and deploy gateway are not members of the Docker
  group.
- Production env files and ACME state are root-owned mode `0600`; values never
  enter Git, Terraform plans, evidence, chat or logs.
- Compose services use non-root images, dropped capabilities,
  `no-new-privileges`, read-only roots and bounded logs. Traefik has security
  headers, request-size/rate limits, forwarding timeouts and a production TLS
  option.

The source-of-truth assertions are `scripts/terraform-check.sh`,
`scripts/production/security-audit.sh` and the exact files in the Plan5 write
set. A local pass is not evidence that the live cloud or VM has converged.

## Local checks

Run with credentials removed from the process:

```powershell
terraform fmt -check -recursive infra/terraform
& 'C:\Program Files\Git\bin\bash.exe' scripts/terraform-check.sh
& 'C:\Program Files\Git\usr\bin\bash.exe' scripts/production/security-audit.sh
docker compose --parallel 8 -f compose.production.yml config --quiet
```

The last command requires a Docker daemon and validates configuration only; it
does not start containers. The live audit is deliberately separate:

```bash
sudo /srv/munchkin/compose/scripts/security-audit.sh --live
```

Live mode checks only sanitized metadata: listeners, SSH policy, Docker
socket mode, deploy-user group membership, root-only secret modes,
unattended-upgrades, UFW and Docker seccomp. It never prints a secret value.
Expected listeners are `22` (CIDR-limited), `80` and `443`; any other
non-loopback listener is a stop condition.

## Remote mutation gate

Before every remote action, produce a sanitized exact plan with:

1. target account, resource IDs and current read-only inventory;
2. exact add/change/destroy counts and policy/member diff;
3. DNS/NS, environment, secret-store and VM consequences;
4. rollback/recovery command and whether the action is paid or destructive;
5. evidence to collect and the next separate approval required.

The following remain owner-gated and are not implied by a local check:

- GitHub protected `main`, required checks and `production-images` environment;
- Yandex WIF/IAM/network/registry/Lockbox/Terraform mutation;
- secret payload insertion, PostgreSQL password or deploy-key delivery;
- VM bootstrap, host hardening installation and first production deploy;
- Timeweb NS/DNS changes, paid scanners and registry deletion.

## Incident procedures

### Suspected credential leak

Stop publication and deployment. Do not paste the value into an issue or
log. Preserve only the workflow run, commit and sanitized path. Disable the
affected GitHub environment or deployment credential, revoke the corresponding
Yandex/WIF edge through an owner-approved exact mutation, rotate the secret in
its approved store, and rerun secret/dependency/image evidence. A new release
must use a new immutable digest and fresh attestation evidence.

### WIF or publisher compromise

Disable the exact GitHub environment subject first, then inspect recent image
digests and attestations. Keep the current and previous compatible releases;
do not delete images during containment. Reconcile the WIF federation,
publisher binding and required-check settings from read-only inventory before
any re-enable approval.

### Host compromise or unexpected listener

Stop the deploy gateway and public rollout. Preserve non-secret system/audit
metadata, isolate the VM according to the owner-approved cloud procedure and
keep the last known-good immutable release. Never repair by adding a broad
firewall rule or Docker-group membership. Rebuild/bootstrap requires a new
sanitized mutation plan.

### Release rollback

Use the recorded `previous` immutable game/web pair only after verifying its
release SHA, SBOM and attestation evidence. The production deploy workflow and
host gateway perform the serialized rollback; do not issue an ad-hoc SSH shell.

### Registry cleanup

Run `scripts/production/registry-retention-plan.sh` in report-only mode. The
protected set must include current, previous, pending and the approved minimum
recovery generations. The script has no deletion mode. Any deletion requires
an exact digest list, recovery proof, destructive-action warning and a new
owner approval.

## Accepted limitations

The baseline uses one VM and no WAF/SOC/SIEM. Paid Yandex vulnerability
scanning is deferred; the CI free scanner stack and 30-day exception policy
are the selected controls. Live cloud inventory, GitHub settings, host audit,
credential revocation drills and first production rollout remain unrun until
their separate approvals are granted.
