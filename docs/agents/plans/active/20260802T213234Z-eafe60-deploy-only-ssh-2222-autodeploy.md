# PLAN: deploy-only SSH 2222 autodeploy

- **Plan ID:** `20260802T213234Z-eafe60-deploy-only-ssh-2222-autodeploy`
- **Статус:** in_progress
- **Создан:** 2026-08-02 21:32:34 UTC
- **Обновлён:** 2026-08-02 21:43:20 UTC
- **Владелец:** Codex
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; отдельная ветка не создаётся
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260802T200453Z-135717-first-production-deploy-https-smoke`.
- **Блокирует:** unattended production transport
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/operations/PRODUCTION_DEPLOYMENT.md`,
  `docs/operations/PRODUCTION_SECURITY.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".github/workflows/ci.yml",
    ".github/workflows/deploy-production.yml",
    "infra/terraform/README.md",
    "infra/terraform/environments/production/network.tf",
    "scripts/ci/verify-action-pins.mjs",
    "scripts/production/bootstrap-host.sh",
    "scripts/production/configure-deploy-ssh.sh",
    "scripts/production/security-audit.sh",
    "scripts/terraform-check.sh",
    "docs/operations/GITHUB_ACTIONS_YANDEX_IMAGES.md",
    "docs/operations/PRODUCTION_DEPLOYMENT.md",
    "docs/operations/PRODUCTION_SECURITY.md",
    "docs/agents/plans/active/20260802T213234Z-eafe60-deploy-only-ssh-2222-autodeploy.md",
    "docs/agents/plans/archive/20260802T213234Z-eafe60-deploy-only-ssh-2222-autodeploy.md"
  ],
  "components": ["repository-workflow", "terraform-infrastructure"],
  "contracts": [
    "delivery:production-deploy-transport-v2",
    "production-release-evidence-v1"
  ],
  "dependsOn": [
    "20260802T200453Z-135717-first-production-deploy-https-smoke"
  ],
  "sharedResources": [
    "github:workflow:ci",
    "github:workflow:deploy-production",
    "github:environment:production-images",
    "github:environment:production-deploy",
    "cloud:yandex-vpc-security-group:munchkin-prod",
    "cloud:yandex-compute:fv4eule47h2vqo5ki48k",
    "host:ssh:tcp-22-owner-only",
    "host:ssh:tcp-2222-deploy-only",
    "host:ufw",
    "delivery:production-deploy-lock"
  ]
}
```

## Цель

После успешной проверки и публикации immutable image pair автоматически
передавать production deploy workflow, сохранив существующий ручной GitHub
environment approval. GitHub-hosted runner достигает VM через отдельный
public TCP `2222`, где разрешён только key-only forced-command пользователь
`munchkin-deploy`; owner/admin SSH на TCP `22` остаётся ограниченным текущими
owner CIDR.

## Критерии приёмки

- [ ] Yandex security group и UFW сохраняют TCP `22` только для
      `ssh_ingress_cidrs`, а TCP `2222` публикуют в IPv4 Internet только как
      deploy transport; `80/443` и остальные port invariants не меняются.
- [ ] OpenSSH на `2222` допускает только `munchkin-deploy` с public-key auth и
      forced command; admin/root/password/interactive shell/PTY/agent, TCP,
      X11 and tunnel forwarding fail closed. Existing owner SSH on `22`
      продолжает работать.
- [ ] Host configuration is idempotent and validates `sshd -t` before reload;
      failure leaves the existing port-22 owner path available.
- [ ] `deploy-production` remains manual-dispatch capable, additionally
      supports a reusable call, connects on port `2222` and reuses the already
      pinned host key through `HostKeyAlias`; no SSH secret value is read or
      replaced.
- [ ] Successful `publish` on `main` passes its exact digest pair, full SHA and
      current CI run ID to the reusable deploy workflow. Current
      `production-images`/`production-deploy` environment approvals remain
      unchanged and still gate access to protected values.
- [ ] GitHub-hosted live run passes release/SBOM/attestation verification,
      SSH deploy, host evidence upload and public HTTPS smoke for the exact
      immutable pair.
- [ ] No application source, DNS, Lockbox payload, PostgreSQL data/credential,
      Registry retention/content outside the normal immutable publish, or
      GitHub environment protection setting changes; canonical scope clean.

## Контекст и подтверждённое состояние

- The first production deploy is healthy at
  `https://munchkin.l1ttl3h0rse.ru/`; host evidence reports success for commit
  `f76b152be0513f68b3d4053916c2e35455d4e36e`.
- GitHub deploy run `30765986050` passed every immutable release gate and then
  timed out twice on VM TCP `22`; no remote command ran from the hosted runner.
- Owner-workstation SSH reached the same VM and completed the deployment
  through the existing root-owned allowlist, proving the issue is transport,
  not release verification or host rollout.
- Terraform currently binds TCP `22` to sensitive `ssh_ingress_cidrs`; its
  validation rejects `0.0.0.0/0`. Cloud-init mirrors the same CIDRs into UFW.
- The deploy key already has `command=...`, `no-agent-forwarding`,
  `no-port-forwarding`, `no-pty`, `no-user-rc` and `no-X11-forwarding`; the
  deploy user is not in the Docker group and can sudo only the exact root-owned
  allowlist.
- Current CI run `30767389169` passed all verification jobs and is waiting at
  `Publish immutable Yandex image pair`, confirming the existing manual
  `production-images` environment approval remains active.
- Read-only live inventory on 2026-08-03 confirmed `sshd -t`, active owner
  access on TCP `22`, listeners `22/80/443`, no `2222` drop-in/listener and an
  exact one-CIDR owner SG rule matching the current authenticated source as a
  `/32`. It also found material drift: the `ufw.service` unit is active and
  enabled, but `ufw status` is inactive and `ufw show added` contains no saved
  rules. No host or cloud mutation was made during this inventory.
- GitHub documents that hosted-runner IP ranges are broad/dynamic and should
  not be used as an internal-resource allowlist. A self-hosted runner is not
  selected because this repository is public and GitHub warns that public PRs
  can compromise persistent self-hosted runner state.

## Scope

### Входит

- Fixed public TCP `2222` ingress in the production Yandex security group;
  owner-only TCP `22` remains untouched.
- Idempotent host configurator for the second OpenSSH listener, UFW rate limit,
  deploy-user-only Match policy, syntax/effective-config validation and safe
  reload. Bootstrap installs/runs the same source for future hosts.
- Existing-host UFW baseline recovery before the configurator: reconstruct
  owner TCP `22` from the currently authenticated source `/32` only after it
  matches the single live owner SG CIDR, add public `80/443`, enable default-
  deny UFW while retaining the established owner session, then add rate-
  limited `2222`. This newly discovered live mutation is included in the
  separate remote approval checkpoint below.
- Reusable/manual dual trigger for `deploy-production`, fixed deploy port
  `2222`, strict host-key pinning via the existing known-host alias, and exact
  immutable inputs.
- Automatic CI handoff after successful `publish`; protected environments,
  approvals and concurrency remain in force.
- Focused policy/static host/Terraform/workflow tests, canonical verify,
  scope-check, live transport/deploy evidence and public HTTPS smoke.
- Reviewed additive SG mutation, existing-VM SSH/UFW update and one GitHub
  deploy run only after their sanitized exact mutations receive a separate
  approval. Because the current process lacks the process-local S3 backend
  credential needed for a saved Terraform plan, the proposed live fallback is
  the narrow `yc vpc security-group update-rules --add-rule` operation. HCL
  remains authoritative and a later credentialed Terraform refresh must be
  clean; no rule replacement/deletion is permitted.

### Не входит

- Opening owner/admin TCP `22` to `0.0.0.0/0` or changing owner CIDRs/key.
- Self-hosted runner, GitHub larger runner, VPN/overlay network, dynamic
  GitHub IP allowlisting or a new paid service/VM.
- Removing required reviewers, environment branch restrictions or any other
  GitHub environment/repository setting change.
- Reading/replacing deploy private key or secret values; the existing host key
  is reused without exposing it.
- DNS/ACME/Lockbox/application/DB/telemetry/backup changes, destructive
  cleanup, rollback rehearsal or unrelated infrastructure backlog.

## Архитектурный подход

1. Keep the network boundary asymmetric: owner administration on restricted
   `22`, machine deploy on public `2222`.
2. Add a second listener to the existing patched sshd, but constrain it by
   `Match LocalPort 2222` to `AllowUsers munchkin-deploy`, public-key-only
   authentication, forced command and disabled forwarding/TTY/tunnel.
3. Validate a temporary sshd config before atomic install/reload; add
   rate-limited UFW access for `2222`. Do not restart the VM or interrupt the
   established owner `22` path.
4. Keep all build/scan/attestation work on ephemeral GitHub-hosted runners.
   Reuse the existing deploy workflow after `publish`, preserving manual
   environment approval and serialized production deploy concurrency.
5. Use `HostKeyAlias=$DEPLOY_HOST` on the non-standard port so the existing
   pinned known-host value remains authoritative and no GitHub secret rewrite
   is needed.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Terraform network | Add public deploy-only TCP `2222`; retain owner-only `22` | `infra:yandex-cloud-production-v1` |
| Production host | Second sshd listener and UFW rate limit | `delivery:production-deploy-transport-v2` |
| GitHub CI/CD | Publish outputs call reusable deploy workflow | Exact SHA/digest/run evidence |
| Security policy | Assert separate admin/deploy boundaries | No shell/root/Docker-group expansion |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.github/workflows/ci.yml` | write | Pass verified publish outputs into reusable deploy |
| `.github/workflows/deploy-production.yml` | write | Add workflow call and fixed port-2222 pinned SSH transport |
| `infra/terraform/README.md` | write | Document asymmetric SSH ingress |
| `infra/terraform/environments/production/network.tf` | write | Add exact public TCP 2222 SG rule |
| `scripts/ci/verify-action-pins.mjs` | write | Preserve workflow policy assertions for the new call path |
| `scripts/production/bootstrap-host.sh` | write | Install/run the idempotent deploy listener configurator |
| `scripts/production/configure-deploy-ssh.sh` | write | Validate and install sshd/UFW deploy-only boundary |
| `scripts/production/security-audit.sh` | write | Permit and verify only the intended fourth public listener |
| `scripts/terraform-check.sh` | write | Assert owner 22/public 2222/HTTP/HTTPS Terraform contract |
| `docs/operations/GITHUB_ACTIONS_YANDEX_IMAGES.md` | write | Document automatic post-publish handoff and retained approval |
| `docs/operations/PRODUCTION_DEPLOYMENT.md` | write | Document port, live mutation and evidence sequence |
| `docs/operations/PRODUCTION_SECURITY.md` | write | Record deploy-only public SSH threat boundary |
| `docs/agents/plans/active/20260802T213234Z-eafe60-deploy-only-ssh-2222-autodeploy.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260802T213234Z-eafe60-deploy-only-ssh-2222-autodeploy.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| Production SG/VM/port 22 | archived foundation/deploy plans | this plan for narrow extension | Add 2222 only; prove 22 unchanged before/after |
| CI/publish/deploy workflows | archived WIF/security/deploy plans | this plan | Preserve all existing release gates and manual approvals |
| P1/P2 infrastructure drafts | active drafts | no ownership | No overlap with their docs or runtime resources |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-02 21:32:34 UTC
- **Обнаруженные пересечения:** P1/P2 drafts mention the production VM and
  delivery evidence read-only; three Figma plans do not own CI/network/VM.
- **Решение:** exclusive narrow transport plan after completed first-deploy
  dependency; no P1/P2 selection or resource mutation.

## План реализации

1. [x] Record exact approval, select the plan and confirm clean `main`.
2. [x] Implement the fixed Terraform, sshd/UFW configurator, bootstrap/audit
      assertions and run focused static tests.
3. [x] Make `deploy-production` reusable/manual and connect on `2222`; expose
      exact publish outputs from CI and add the post-publish reusable call
      without changing environment approvals.
4. [x] Run action policy, host static audit, Terraform fmt/validate/check,
      canonical verify and scope-check; review the full diff.
5. [x] Show sanitized exact additive SG/VM commands, prove `22` remains
      reachable, and request the separate cloud/VM mutation approval. A saved
      Terraform plan remains preferred when backend credentials are restored;
      otherwise the exact additive `yc update-rules --add-rule` fallback must
      be named explicitly in the approval.
6. [ ] Restore the existing-host UFW baseline, install/reload the validated
      host config, prove a second owner TCP-22 connection, then add only SG TCP
      `2222` and prove deploy-only negative/positive paths.
7. [ ] Complete the waiting/new image publication approval, allow the automatic
      deploy handoff, inspect terminal workflow/evidence and verify public TLS.
8. [ ] Record results, final verify/scope-check, archive/release, commit and
      push to `main` under the owner's existing publication instruction.

## Проверки

- [x] `bash -n scripts/production/configure-deploy-ssh.sh scripts/production/bootstrap-host.sh scripts/production/security-audit.sh`
- [x] Static sshd fixture/effective-config checks prove only
      `munchkin-deploy` is eligible on `2222` and forced command/forwarding
      restrictions remain.
- [x] `node scripts/ci/verify-action-pins.mjs`
- [x] Terraform fmt/init/validate plus `bash scripts/terraform-check.sh`
- [x] Sanitized saved `terraform plan`, or separately approved additive `yc`
      fallback: exact one SG ingress addition, no replace/destroy/delete or
      unrelated cloud change.
- [ ] Live `sshd -t`, UFW/listener audit, owner SSH 22 continuity and GitHub
      hosted-runner deploy on 2222.
- [ ] Host release evidence and external DNS/TLS `/` + `/health/live` smoke.
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260802T213234Z-eafe60-deploy-only-ssh-2222-autodeploy`
- [x] `git diff --check`

## Риски и откат

- **Риск:** public sshd listener attracts scans or exploits. **Снижение:**
  patched host, key-only deploy user, no owner/root eligibility on 2222,
  forced command, disabled forwarding/TTY/tunnel, UFW rate limit, audit and no
  Docker-group access.
- **Риск:** bad sshd config interrupts owner access. **Снижение:** validate
  temporary/effective config before atomic install and reload, never restart;
  keep the established port-22 session/access while applying.
- **Риск:** enabling the unexpectedly inactive UFW could lock out the owner or
  edge. **Снижение:** hard stop unless the current authenticated source is the
  exact single SG owner `/32`; install `22/80/443` rules before enable, retain
  the established owner session, prove a second TCP-22 connection, and only
  then configure `2222`.
- **Риск:** CI recursively triggers or deploys unverified inputs. **Снижение:**
  same-run `needs: publish`, reusable exact inputs, main-only condition,
  protected environments, attestations and serialized deploy lock.
- **Риск:** cloud update unexpectedly replaces/deletes existing SG rules or
  VM/network. **Снижение:** prefer a saved Terraform plan; with credentials
  unavailable, permit only `yc ... update-rules --add-rule` for one fixed TCP
  `2222` IPv4 rule and compare the sanitized post-inventory to the four-rule
  pre-inventory plus that one addition.
- **Откат:** remove/block SG TCP `2222` first, then remove UFW rule/drop-in and
  reload sshd; owner TCP `22` remains the recovery path. Revert automatic call
  while preserving manual dispatch. No data/image/secret deletion.

## Открытые вопросы

- No unresolved design choice: user selected deploy-only `2222` and retained
  manual approval. The exact reviewer configuration is not changed by this
  plan; the live waiting `production-images` job is sufficient evidence that
  at least that gate is active.
- Terraform/cloud credentials may exist only in a separate owner process. If
  unavailable to this session, implementation can finish locally but live
  apply stops for the owner credentialed step; no credential is pasted into
  chat, files or logs.
- The current process has a usable read-only `yc` profile but no process-local
  Terraform S3 backend credentials or sensitive Terraform variables. It can
  prove the live SG inventory, but cannot produce or apply the authoritative
  saved Terraform plan until those process-local values are re-established.
  `yc vpc security-group update-rules` supports an additive `--add-rule`
  operation, so the owner may separately approve that exact non-replacing
  fallback to avoid moving backend credentials into this session.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-02 21:32:34 UTC
- **Подтверждено:** 2026-08-03; exact plan ID approved by owner.
- **Формулировка/ограничения пользователя:** «Делай 2222 deploy only, ручной
  approve пока оставляем». This fixes the design choice but lifecycle still
  received explicit approval for this exact plan ID before implementation.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- 2026-08-03: owner approved exact plan ID; plan-lint passed and the plan was
  selected in session `019fc31d-f7f5-7f72-8020-aabe8a6f22cb` from clean
  `main` at `aa0cda5` (the plan file itself is the declared baseline draft).
- 2026-08-03: implemented deploy-only SSH `2222`, reusable post-publish
  handoff and static policy assertions. Shell syntax, repository security
  audit, action pin policy, Terraform fmt/validate/provider-lock checks,
  canonical verify and scope-check passed. One earlier canonical attempt was
  interrupted only by sandbox denial of `registry.terraform.io`; the
  authorized rerun passed and supersedes that failed environment attempt.
- 2026-08-03: sanitized live inventory found UFW inactive with no saved rules;
  SSH/SG remained unchanged. Remote apply is paused for the amended exact
  UFW/sshd/SG mutation approval and credentialed Terraform saved plan.
- 2026-08-03: owner separately approved UFW baseline activation, deploy-only
  SSH `2222`, exact additive SG mutation and commit/push. UFW was rebuilt with
  the currently authenticated owner `/32` on TCP `22`, public `80/443` and
  default-deny incoming; a second owner SSH connection and public HTTPS health
  both passed.
- 2026-08-03: Ubuntu 24.04 uses active `ssh.socket`, so the first validated
  configurator run restored its sshd drop-in after a reload could not create
  listener `2222`. The configurator now installs a dedicated socket drop-in,
  preserves vendor TCP `22`, restarts only `ssh.socket` and restores both
  sshd/socket files on failure. Installed live state listens on `22/2222`,
  owner SSH `22` passes, admin SSH on `2222` is denied, and the full sanitized
  live security audit passed after installed-layout/loopback/base-tool fixes.
- 2026-08-03: additive Yandex SG operation added exactly rule
  `enpk0vbt420gq27a18ia` (`INGRESS TCP 2222`, `0.0.0.0/0`). Rule count changed
  `4 -> 5`; no existing rule ID was removed. TCP `2222` became reachable and
  `/health/live` remained healthy.
- 2026-08-03: SHA-verified final `configure-deploy-ssh.sh`, including
  `/run/sshd` recreation after `ssh.socket` restart, was installed on the VM.
  Its idempotent rerun passed, full live security audit passed, a fresh owner
  TCP-22 connection passed, and temporary uploads were removed. Host/SG work
  is complete; the remaining positive deploy-user proof comes from the
  GitHub-hosted automatic deploy after environment approvals.
- **Continuation checkpoint:** commit `4711557` is already on `origin/main`.
  Continue with post-commit canonical verify/scope-check, inspect the CI run,
  approve `production-images` and `production-deploy`, verify exact release
  evidence/HTTPS, then complete/archive/release the plan and push the final
  lifecycle commit.

## Итог

Заполняется после реализации.
