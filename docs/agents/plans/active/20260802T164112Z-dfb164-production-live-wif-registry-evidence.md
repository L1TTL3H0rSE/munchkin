# PLAN: production live WIF and registry evidence

- **Plan ID:** `20260802T164112Z-dfb164-production-live-wif-registry-evidence`
- **Статус:** in_progress
- **Создан:** 2026-08-02 16:41:12 UTC
- **Обновлён:** 2026-08-02 16:55:00 UTC
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
    ".github/workflows/ci.yml",
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
Identity Federation → private Container Registry для commit `0a3e9ef`.
Если read-only preflight обнаружит drift в Terraform foundation/WIF, применить
только exact sanitized change set этого плана; секреты не печатаются и не
сохраняются.

## Критерии приёмки

- [ ] GitHub Actions run для `0a3e9ef` найден; required checks и Linux security
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
  registry login passed. `Build, scan and publish immutable images` failed in
  `scripts/ci/security-scan.sh` at the repository `trivy config` invocation
  with exit code 1, before OSV/image scans, pushes, attestations, or evidence
  upload. The run has no artifacts. The exact finding is not present in the
  log because Trivy writes SARIF output and the failed step has no upload-on-
  failure path; this is a security-scan remediation evidence gap, not a WIF or
  environment-review failure.

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
- GitHub workflow/settings mutation outside the narrowly scoped failure-only
  SARIF diagnostic upload described in this plan.
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
| `.github/workflows/ci.yml` | write | Upload failed security SARIF for exact Trivy diagnosis |
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
5. [ ] Add failure-only SARIF artifact upload, rerun CI, then verify immutable
      `game`/`web` digests and release evidence without exposing tokens or
      secret payloads.
6. [ ] Run canonical verify/scope-check, archive and guarded release before
      the local lifecycle commit and next deploy plan.

## Проверки

- [ ] `./leinoctl context --paths` and plan-lint — clean.
- [ ] GitHub Actions required checks and publish evidence — terminal success.
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
  to `.github/workflows/ci.yml` for failure-only SARIF upload. This does not
  change VM, cloud, DNS, Registry, or secret resources.

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

## Итог

Заполняется после live WIF/registry evidence and lifecycle closure.
