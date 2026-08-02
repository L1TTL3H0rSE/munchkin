# Handoff: production CI and deploy continuation

## Current checkpoint

- Active plan: `20260802T164112Z-dfb164-production-live-wif-registry-evidence`.
- Branch: `main`; do not create a branch.
- The repository remediation is intended to be committed and pushed as one
  checkpoint after the checks listed below pass.
- VM, cloud, DNS, Lockbox payload, Registry contents, GitHub settings and
  secrets were not mutated by the remediation session.
- Because `tools/leinoctl`, `docs/agents/HARNESS.md` and lifecycle behavior were
  changed, the next task must be a new trusted Codex session. The current
  session proves the implementation through manual tests but cannot claim that
  newly changed hooks/instructions were loaded at SessionStart.

## What was fixed

- OSV findings: Go `1.25.12`, pgx `5.9.2`, OpenTelemetry `1.44.0`, x/net
  `0.56.0`, Playwright `1.55.1`.
- GitHub workflows and backend build image now use the patched Go toolchain.
- Actual `leinoctl` execution now uses the same profile-declared executable as
  toolchain inspection, preventing Windows PATH from selecting Node 18.5
  through a standalone `pnpm.exe`.
- Windows `.cmd` launch no longer emits Node `DEP0190`.
- Canonical Compose config evidence uses an empty process-local
  `DOCKER_CONFIG`; owner Docker credentials are neither read nor copied.
- A selected plan can now audit an in-plan fast-forward commit without
  resetting its baseline: every committed path remains scope-visible and HEAD
  remains part of the verification fingerprint.

## Local verification completed before the checkpoint commit

- Focused `git`/session/CLI/runner regression set: 44 passed, 0 failed, 1
  expected Windows symlink-permission skip.
- Full `tools/leinoctl` suite inside canonical verification: 80 passed, 0
  failed, 1 expected Windows symlink-permission skip.
- Codex harness: 42 passed, 0 failed.
- Frontend contracts: 18 passed; web tests: 154 passed; lint, typecheck and both
  Nuxt builds passed.
- Backend: `go test ./...` passed.
- Canonical `./leinoctl verify --changed`: all 16 checks passed in 146.3
  seconds with bundled Node 24, declared pnpm, Git Bash and an empty
  process-local Docker config.
- `scope-check`: `ok=true`, `outsideWriteSet=[]`, `unledgered=[]`, no missing
  required checks. The existing `0a3e9ef..7bf8966` transition was proven
  fast-forward and its two committed paths were audited.
- The pinned full security script is Linux-only. Ubuntu WSL is present but
  lacks `go` and `jq`; no host packages were installed. The authoritative full
  repository/image scan is therefore the GitHub Actions gate triggered by the
  checkpoint push.

## Evidence to read first

- Active plan and its detailed run/artifact evidence:
  `docs/agents/plans/active/20260802T164112Z-dfb164-production-live-wif-registry-evidence.md`.
- Failed pre-fix publish run: `30758535510`, job `91524998561`, artifact
  `8836749807`; Trivy SARIF was empty and OSV was the blocker.
- Earlier diagnostic workflow commit already on main: `7bf8966`.
- The 120-second observation was an outer timeout over sequential canonical
  checks. The Nuxt build itself took about 34 seconds; a complete successful
  canonical run took about 140.6 seconds.

## Exact next actions in the new trusted session

1. Confirm the previous task is stopped, fetch `origin/main`, verify a clean
   worktree and that local `HEAD` equals `origin/main`.
2. Read this handoff and the active plan, then take over only the exact active
   plan with `./leinoctl plan select
   20260802T164112Z-dfb164-production-live-wif-registry-evidence --takeover`.
3. Inspect the GitHub Actions runs for the new `origin/main` commit. Required
   checks and the image publish job must be terminal success. If security fails,
   download the retained `security-evidence-*` artifact and diagnose it before
   changing anything.
4. Read-only verify that private Registry repositories `game` and `web` contain
   immutable images for that commit; record both digests and the workflow
   release evidence. Do not delete or retag images.
5. Run the presence-only Yandex credential preflight and a sanitized Terraform
   plan for WIF/Registry. If the plan is non-empty, show the exact resource
   addresses and request explicit approval before apply; never print tokens or
   secret values.
6. When CI, WIF and digest evidence are complete, update the active plan, run
   canonical verify/scope-check, mark it completed, move it to archive, perform
   guarded release, and create/push its separate lifecycle commit.
7. Create/select a successor live-deploy plan for the existing VM. Before any
   VM/cloud/DNS mutation, show its exact sanitized action set and obtain the
   required explicit approval. Then deploy the immutable digest pair, configure
   DNS/HTTPS as declared by the production runbook, and record public readiness
   and authenticated smoke evidence. Lockbox payloads and secret values must
   never be pasted into chat or logs.

## User input expected

- Nothing is needed merely to inspect the new GitHub run.
- If Codex still lacks the owner credentialed Yandex process, the owner must
  provide that process context without pasting credentials; a presence-only
  result is sufficient.
- Any non-empty Terraform apply, VM deploy mutation or DNS mutation remains a
  separate exact-action approval gate even though repository fixes and push
  were approved.
