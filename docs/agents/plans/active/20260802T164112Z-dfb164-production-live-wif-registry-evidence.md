# PLAN: production live WIF and registry evidence

- **Plan ID:** `20260802T164112Z-dfb164-production-live-wif-registry-evidence`
- **Статус:** in_progress
- **Создан:** 2026-08-02 16:41:12 UTC
- **Обновлён:** 2026-08-02 19:05:56 UTC
- **Владелец:** Codex
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; отдельная ветка не создаётся
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260731T005255Z-b3ea2b-github-actions-yandex-images`, `20260802T155600Z-ae2e70-security-scan-go-dependency-remediation`.
- **Блокирует:** production deploy and first public HTTPS smoke
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/operations/GITHUB_ACTIONS_YANDEX_IMAGES.md`,
  `docs/operations/PRODUCTION_DEPLOYMENT.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".leino/profile.json",
    ".github/workflows/security.yml",
    ".github/workflows/ci.yml",
    "scripts/ci/security-scan.sh",
    "backend/game/Dockerfile",
    "backend/game/go.mod",
    "backend/game/go.sum",
    "docs/agents/HARNESS.md",
    "docs/agents/handoffs/20260802-production-ci-deploy-continuation.md",
    "docs/agents/PROJECT_MEMORY.md",
    "docs/agents/STACK.md",
    "frontend/pnpm-workspace.yaml",
    "frontend/pnpm-lock.yaml",
    "tools/leinoctl/src/cli.mjs",
    "tools/leinoctl/src/git.mjs",
    "tools/leinoctl/src/runner.mjs",
    "tools/leinoctl/src/session.mjs",
    "tools/leinoctl/src/toolchain.mjs",
    "tools/leinoctl/test/cli.test.mjs",
    "tools/leinoctl/test/git.test.mjs",
    "tools/leinoctl/test/runner.test.mjs",
    "tools/leinoctl/test/session.test.mjs",
    "docs/agents/plans/active/20260802T164112Z-dfb164-production-live-wif-registry-evidence.md",
    "docs/agents/plans/archive/20260802T164112Z-dfb164-production-live-wif-registry-evidence.md"
  ],
  "components": ["repository-workflow", "terraform-infrastructure", "release-evidence"],
  "contracts": [],
  "dependsOn": [
    "20260731T005255Z-b3ea2b-github-actions-yandex-images",
    "20260802T155600Z-ae2e70-security-scan-go-dependency-remediation"
  ],
  "sharedResources": [
    "github:repo:L1TTL3H0rSE/munchkin",
    "github:commit:0a3e9ef",
    "github:commit:7bf8966",
    "github:environment:production-images",
    "cloud:yandex-folder:b1g55l8i2mtpv23b5ql7",
    "cloud:yandex-container-registry:crpdnmjudj1usiu90gdn",
    "cloud:yandex-iam:munchkin-github-images",
    "delivery:immutable-image-pair-v1"
  ]
}
```

## Цель

Зафиксировать live readiness цепочки GitHub push → pinned CI → Yandex Workload
Identity Federation → private Container Registry для latest approved `main`
remediation commit.
Если read-only preflight обнаружит drift в Terraform foundation/WIF, применить
только exact sanitized change set этого плана; секреты не печатаются и не
сохраняются.

## Критерии приёмки

- [ ] GitHub Actions run для latest approved remediation commit найден; required checks и Linux security
      wrapper имеют terminal success.
- [ ] Protected environment `production-images` имеет требуемые reviewers,
      variables и secret boundary; значения секретов не раскрываются.
- [ ] Yandex WIF trust ограничен exact repository/branch/commit claims и
      keyless publish service account; static credentials отсутствуют.
- [ ] `game` и `web` опубликованы в private registry по immutable digests;
      image manifests доступны read-only и совпадают с release evidence.
- [ ] Terraform read-only plan для WIF/registry либо empty, либо применён
      только после exact sanitized review; no unrelated cloud changes.
- [ ] Scope-check подтверждает, что локально изменены только lifecycle-файлы
      этого плана; VM, DNS, Lockbox payload, deploy и secrets не затронуты.

## Контекст и подтверждённое состояние

- Security remediation commit `0a3e9ef` pushed to `origin/main`.
- GitHub connector can read repository metadata and the owner-provided private
  Actions run URL. The public Actions API and unauthenticated browser cannot
  inspect this private repository.
- Current process has no `YC_TOKEN`/AWS/TF_VAR credentials; owner-managed
  credentialed PowerShell is required for Terraform/Yandex read-only evidence.
- Foundation/WIF source and prior implementation are archived in
  `20260731T005255Z-b3ea2b-github-actions-yandex-images`; live publication was
  not proven in the current session.
- Yandex read-only inventory at 2026-08-02 16:46 UTC: folder
  `b1g55l8i2mtpv23b5ql7`, registry `crpdnmjudj1usiu90gdn`, VM
  `fv4eule47h2vqo5ki48k` RUNNING at `81.26.187.230`.
- WIF federation `aje59lfbinrpposh9s9t` is enabled with issuer
  `https://token.actions.githubusercontent.com` and audience
  `https://github.com/L1TTL3H0rSE`; CI service account is
  `ajecee5up8ka9j3rk1k6` (`munchkin-github-images`).
- The only federated credential is `ajeco3uphqg05upkvsig` with exact external
  subject `repo:L1TTL3H0rSE@32160016/munchkin@1316069622:environment:production-images`.
- Registry bindings are exact: CI service account has
  `container-registry.images.pusher`; runtime service account has
  `container-registry.images.puller`. Repositories `game` and `web` exist.
- Current registry images are tagged only with old commit `6b461eb...`; no
  digest for `0a3e9ef` has been observed yet.
- GitHub Actions run `30757059688`, job `91521103366`, was inspected through
  the GitHub connector. All prerequisite jobs passed; WIF claim probe and
  registry login passed. The first run failed before diagnostics were
  retained, so commit `7bf8966` added a failure-only security artifact upload.
- GitHub Actions run `30758535510`, job `91524998561`, was inspected through
  the GitHub connector. All prerequisite jobs passed; WIF claim probe and
  registry login passed. `Build, scan and publish immutable images` failed
  after Trivy filesystem/config scanning and during the OSV scan. Artifact
  `8836749807` contains empty `trivy-fs.sarif` and `trivy-config.sarif`, plus
  `osv-scanner.json`; no image SBOMs or attestations were produced because
  publication stopped at the security gate.
- OSV findings are: `github.com/jackc/pgx/v5` `5.9.0` fixed in `5.9.2`,
  OpenTelemetry `1.43.0` fixed in `1.44.0`, `golang.org/x/net` `0.55.0`
  fixed in `0.56.0`, Go `1.25.1` standard-library findings requiring the
  patched `1.25.12` toolchain, and frontend `playwright`/`@playwright/test`
  `1.52.0` fixed in `1.55.1`. This is a dependency/toolchain remediation,
  not a WIF, environment-review, Trivy, VM, or Registry failure.
- Local canonical verification exposed a separate repository-runner defect:
  toolchain inspection honors `pnpm@env:LEINO_PNPM_EXECUTABLE`, but component
  execution passes the unqualified `pnpm` name to `child_process.spawn`.
  Windows therefore selects a standalone `pnpm.exe` with bundled Node 18.5
  instead of the declared Node 24 `pnpm.cmd`, causing sandbox `EPERM` and
  package-manager self-switch hangs. The 120-second interruption was an outer
  command timeout over all sequential canonical checks; the Nuxt build itself
  completed in about 34 seconds.
- After resolver remediation, canonical verification completed every frontend,
  Go, harness, leinoctl, plan-lint and shell check, then failed only because
  Docker attempted to read sandbox-denied user config at
  `C:\Users\Maks\.docker\config.json`. The read-only Compose check must use an
  empty process-local `DOCKER_CONFIG`. A Node `DEP0190` warning from the first
  `.cmd` launch implementation was removed by passing one quoted trusted
  Windows command line instead of `shell: true` plus separate argv.
- The first successful canonical run then exposed a lifecycle gap: this live
  evidence plan must commit and push an in-scope workflow change before remote
  CI can become terminal, while session scope represented the forward commit
  only as `.git/HEAD`. The fix must preserve the original baseline, enumerate
  every path touched by every fast-forward commit, keep the HEAD fingerprint in
  verification evidence, and fail closed for rewinds/divergent history or any
  committed path outside the approved write set.
- GitHub security run `30761504520` for commit `4383193` proved two independent
  CI configuration defects. The repository scanner used a relative
  `--output-dir`, then changed directory before redirecting govulncheck JSON,
  so the shell failed before govulncheck ran. Both CodeQL matrix jobs completed
  analysis but failed to upload because this personal private repository does
  not have GitHub Code Security enabled; their declared `security-events: write`
  permission was present. No scanner artifact was retained because the upload
  step was skipped after the scanner failure.

## Scope

### Входит

- Read-only GitHub commit/status/Actions/artifact evidence for `0a3e9ef`.
- Presence-only credential preflight in the owner-provided PowerShell process.
- Sanitized Terraform plan and, if necessary, exact WIF/registry repair within
  `munchkin-github-images` and the two private registry repositories.
- Immutable digest evidence suitable for the later deploy plan.

### Не входит

- VM bootstrap/deploy/rollback, Docker runtime or application secrets.
- DNS/NS delegation, ACME/TLS, Lockbox payloads, telemetry, backup/restore.
- GitHub workflow/settings mutation outside the narrowly scoped diagnostic
  upload, private-repository CodeQL eligibility gate and exact
  dependency/toolchain/scanner-path remediation described in this plan.
- Registry deletion, tag cleanup, force push, or broad Terraform apply.

## Архитектурный подход

- Treat GitHub Actions and Yandex WIF as a fail-closed identity chain. No
  static cloud credential may enter GitHub, repository, image, logs or chat.
- Prefer current pushed workflow result. Terraform is used only for a fresh
  sanitized plan against the declared WIF/registry resources; apply is allowed
  only for the exact reviewed drift and must record before/after resource
  addresses without secret values.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| GitHub Actions | inspect pushed verification/publish run | No new workflow contract |
| Yandex WIF/registry | prove or repair keyless publish boundary | immutable image pair |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.leino/profile.json` | write | Raise repository Go minimum to patched `1.25.12` |
| `.github/workflows/ci.yml` | write | Upload diagnostics and use patched Go toolchain |
| `.github/workflows/security.yml` | write | Use patched Go toolchain, retain scanner diagnostics and skip unavailable CodeQL upload for a private unlicensed repository |
| `scripts/ci/security-scan.sh` | write | Canonicalize a caller-provided relative evidence directory before changing working directory |
| `backend/game/Dockerfile` | write | Pin patched Go build image and digest |
| `backend/game/go.mod` | write | Remediate OSV Go module findings |
| `backend/game/go.sum` | write | Generated checksums for the remediated Go graph |
| `docs/agents/HARNESS.md` | write | Document resolved-executable execution contract and aggregate timeout evidence |
| `docs/agents/handoffs/20260802-production-ci-deploy-continuation.md` | write | Persist exact continuation steps for the next trusted session after push |
| `docs/agents/PROJECT_MEMORY.md` | write | Persist the confirmed Windows resolver/timeout trap |
| `docs/agents/STACK.md` | write | Keep declared Go toolchain documentation aligned |
| `frontend/pnpm-workspace.yaml` | write | Remediate Playwright OSV finding |
| `frontend/pnpm-lock.yaml` | write | Generated lockfile for the remediated Playwright graph |
| `tools/leinoctl/src/cli.mjs` | write | Apply profile executable resolution to actual checks/generators/Compose commands |
| `tools/leinoctl/src/git.mjs` | write | Enumerate fast-forward committed paths without resetting the selected-plan baseline |
| `tools/leinoctl/src/runner.mjs` | write | Launch the resolved executable while preserving canonical argv evidence |
| `tools/leinoctl/src/session.mjs` | write | Treat validated in-plan commits as auditable session deltas and fail closed on divergent HEAD transitions |
| `tools/leinoctl/src/toolchain.mjs` | write | Share platform launch options for resolved scripts |
| `tools/leinoctl/test/cli.test.mjs` | write | Regression test declared resolver use by canonical verify |
| `tools/leinoctl/test/git.test.mjs` | write | Regression test full commit-range path enumeration and non-forward rejection |
| `tools/leinoctl/test/runner.test.mjs` | write | Regression test resolved launch path and literal argv behavior |
| `tools/leinoctl/test/session.test.mjs` | write | Regression test scoped fast-forward commits and unauthorized committed paths |
| `docs/agents/plans/active/20260802T164112Z-dfb164-production-live-wif-registry-evidence.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260802T164112Z-dfb164-production-live-wif-registry-evidence.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `github:environment:production-images` | deploy plan | complete before deploy |
| `cloud:yandex-iam:munchkin-github-images` | deploy plan | exact claims only |
| `cloud:yandex-container-registry:crpdnmjudj1usiu90gdn` | deploy plan | publish before deploy |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-02 through `leinoctl plan relevant` and
  active registry inspection.
- **Обнаруженные пересечения:** P1/P2 infrastructure drafts are decision-only;
  frontend plans do not own WIF/registry resources.
- **Решение:** exclusive successor plan; no other plan may select or mutate
  the shared WIF/registry resources concurrently.

## План реализации

1. [x] Claim/select this exact plan and record owner approval.
2. [x] Capture available read-only Yandex WIF/registry evidence and inspect the
      GitHub push run for `0a3e9ef`; the publish gate is currently blocked by
      the Trivy config failure recorded above.
3. [ ] Run presence-only credential preflight and sanitized Terraform plan.
4. [ ] If drift exists, apply only the reviewed WIF/registry change set;
      otherwise record empty plan.
5. [x] Add failure-only SARIF artifact upload and retain the failed scan
      artifact for diagnosis.
6. [ ] Remediate the exact OSV dependency/toolchain findings, run focused
      backend/frontend checks, canonical verify and scope-check, then rerun CI.
   - Fix the confirmed Windows `leinoctl` executable-resolution defect and
     record regression evidence before accepting canonical verification.
   - Preserve and validate fast-forward commit paths in the selected session so
     the CI-triggering commit is checked by write set and canonical evidence;
     do not whitelist `.git/HEAD` or reset the original baseline.
   - Canonicalize the scanner evidence directory before the backend subshell,
     retain partial diagnostics with an always-running artifact step, and run
     CodeQL only when repository visibility makes GitHub code scanning
     available. Keep Gitleaks, Trivy, OSV and govulncheck fail-closed.
7. [ ] Verify immutable `game`/`web` digests and release evidence without
      exposing tokens or secret payloads.
8. [ ] Run canonical verify/scope-check, archive and guarded release before
      the local lifecycle commit and next deploy plan.

## Проверки

- [ ] `./leinoctl context --paths` and plan-lint — clean.
- [ ] GitHub Actions required checks and publish evidence — terminal success.
- [ ] OSV remediation evidence shows no vulnerable versions; Trivy SARIF is
      empty; focused Go/frontend checks pass.
- [ ] Relative scanner output survives the backend working-directory change;
      the private repository skips unavailable CodeQL without weakening the
      pinned scanner job, and failed scanner evidence is retained.
- [ ] Declared executable resolver is used by actual `leinoctl verify`
      execution; missing resolver fails closed; runner regression tests pass.
- [ ] Forward root commits enumerate every touched path, remain tied to the
      current HEAD fingerprint, and divergent/non-forward transitions fail
      closed as `.git/HEAD`.
- [ ] Sanitized Terraform plan/apply evidence — exact scope only.
- [ ] `./leinoctl verify --changed` and `./leinoctl scope-check --plan ...` —
      pass; no unexpected local files.

## Риски и откат

- **Риск:** missing owner-process credentials. **Снижение:** stop with an
  evidence gap; do not guess or print secrets.
- **Риск:** Terraform drift expands beyond WIF/registry. **Снижение:** fail
  closed and require a successor plan.
- **Откат:** do not mutate when plan is non-empty outside the exact addresses;
  if an approved WIF/registry apply changes state, use the provider's reviewed
  inverse plan before any deploy.

## Открытые вопросы

- Owner must run the Yandex credentialed PowerShell probe if the process-local
  variables are absent; no secret value should be pasted into chat.
- The publish job is not waiting for `production-images` review: it already
  ran, and no `Review deployments` control is expected for this failed run.
- Per the user's standing approval for plan changes, the write set is extended
  to the exact dependency/toolchain files listed above and to `.github/workflows`
  only for the declared Go version alignment and failure-only SARIF upload.
  This does not change VM, cloud, DNS, Registry, or secret resources.
- 2026-08-02: owner explicitly approved fixing the discovered verification
  problems now and recording all confirmed `leinoctl`/Node/timeout issues for
  later maintenance.
- 2026-08-02: owner explicitly approved this plan change after the canonical
  scope-check exposed the mid-plan CI commit lifecycle gap.
- 2026-08-02: owner explicitly approved the exact "free CI fix": add
  `scripts/ci/security-scan.sh` to the write set, fix relative evidence output,
  always retain scanner diagnostics, and gate CodeQL on supported public
  repository visibility without changing repository visibility or purchasing
  GitHub Code Security.

## Согласование

- **Статус:** approved; implementation in progress
- **Запрошено:** 2026-08-02 16:41:12 UTC
- **Подтверждено:** 2026-08-02; пользователь разрешил current plan changes,
  successor plans, commit/push and continuation toward deployment.
- **Формулировка/ограничения пользователя:** deploy ASAP; keep existing
  domain/IP/budget decisions; no secret values in chat/logs; remote work stays
  exact-plan and fail-closed.

## Ход выполнения

- Plan selected and read-only WIF/registry preflight completed. No remote
  mutation and no secret access occurred.
- GitHub connector inspection completed for run `30757059688` / job
  `91521103366`; no remote mutation, artifact download, or secret access
  occurred.
- GitHub connector inspection completed for run `30758535510` / job
  `91524998561`; diagnostic artifact `8836749807` was downloaded and parsed.
  It proves the current blocker is OSV dependency scanning: Trivy SARIF files
  are empty. Dependabot PR #14 was separately checked and only updates
  `@axe-core/playwright`; it does not fix `playwright` `1.52.0`.
- Canonical verification passed all 16 required checks in 140.6 seconds. The
  following scope-check had no missing/stale checks and no unledgered paths;
  its only failure was `.git/HEAD`, caused by the already pushed in-plan commit
  `7bf8966`. The approved lifecycle remediation above keeps this evidence
  visible and does not weaken the source write set.
- After implementing the lifecycle remediation, focused git/session/CLI/runner
  tests passed `44/44` with one expected Windows symlink skip. Final pre-commit
  canonical verification passed all 16 checks in 146.3 seconds; full leinoctl
  was `80 passed / 0 failed / 1 expected skip`, harness was `42/42`, frontend
  contract/web tests were `18 + 154`, and backend `go test ./...` passed.
  Final pre-commit scope-check returned `ok=true`, `outsideWriteSet=[]`,
  `unledgered=[]`, and no missing required checks.
- The pinned full security script was not executed under Windows Git Bash
  because it downloads Linux ELF tools. Ubuntu WSL exists but lacks `go` and
  `jq`; no host packages were installed. The pushed Linux GitHub Actions run
  remains the authoritative full repository/image security gate.
- GitHub connector inspection of run `30761504520` found scanner job
  `91532800665` failing at `security-evidence/govulncheck.json` after the
  backend `cd`, CodeQL jobs `91532800703` and `91532800710` failing only at the
  disabled private-repository code-scanning upload, and no retained artifacts.
  Full-SHA action policy job `91532800693` passed.
- The approved free CI fix canonicalizes caller-provided scanner output before
  the backend subshell, uploads partial scanner evidence with `if: always()`,
  and gates CodeQL on public repository visibility. Focused Git Bash syntax and
  scanner-contract checks, action-pin policy, plan-lint and `git diff --check`
  all passed locally. The authoritative full pinned scan remains the next Linux
  GitHub Actions run.
- Commit `192a09f` passed canonical verify in 155.3 seconds and scope-check with
  `outsideWriteSet=[]`, `unledgered=[]` and no missing checks, then was pushed.
  Security run `30762515463` correctly skipped unavailable private-repository
  CodeQL and started the pinned scanner. Parallel CI run `30762515454` exposed
  a Linux-only test-fixture mismatch in `tools/leinoctl/test/cli.test.mjs`: the
  fixture printed a hard-coded hyphenated value instead of its quoted first
  argument. Production resolver behavior and the Windows fixture were not at
  fault; the existing approved test write set covers the one-line portability
  correction.
- Security run `30762515463` reached terminal success for commit `192a09f`:
  full-SHA policy and pinned Gitleaks/Trivy/OSV/govulncheck scanners passed,
  CodeQL was intentionally skipped for private visibility, and artifact
  `8837905772` retained `security-evidence-192a09f0bfb5b90c3178c6dd346a0f7559652d1a`
  with digest `sha256:62b6ea9d0c04da5808e61f8d97e989fd0814719fbc47eef00734df884f096d5d`.
  The POSIX fixture now prints its quoted first argument; the focused resolver
  test, a direct Git Bash spaced-argument probe, plan-lint and diff checks pass.

## Итог

Заполняется после live WIF/registry evidence and lifecycle closure.
