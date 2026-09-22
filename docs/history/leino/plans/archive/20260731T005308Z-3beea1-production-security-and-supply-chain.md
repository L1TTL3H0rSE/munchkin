# PLAN: production security and supply-chain baseline

- **Plan ID:** `20260731T005308Z-3beea1-production-security-and-supply-chain`
- **Статус:** completed
- **Создан:** 2026-07-31 00:53:08 UTC
- **Обновлён:** 2026-08-01 19:30:52 UTC
- **Владелец:** Codex / `e6afc969-9462-4343-aefc-a653b89dea87`
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; отдельная ветка не создаётся по указанию владельца
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry`, `20260731T005306Z-3de45e-production-compose-traefik-and-deploy`, `20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`, `20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore`.
- **Блокирует:** `20260731T005308Z-5ec80f-contest-readme-runbooks-and-demo`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".github/dependabot.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/deploy-production.yml",
    ".github/workflows/security.yml",
    "backend/game/Dockerfile",
    "frontend/Dockerfile",
    "compose.production.yml",
    "infra/compose/traefik-static.yml",
    "infra/compose/traefik-dynamic.yml",
    "infra/terraform/bootstrap/github_actions.tf",
    "infra/terraform/environments/production/cloud-init.yaml.tftpl",
    "infra/terraform/environments/production/compute.tf",
    "infra/terraform/environments/production/iam.tf",
    "infra/terraform/environments/production/network.tf",
    "infra/terraform/environments/production/registry.tf",
    "infra/terraform/README.md",
    "scripts/ci/security-scan.sh",
    "scripts/ci/verify-action-pins.mjs",
    "scripts/production/security-audit.sh",
    "scripts/production/verify-release-evidence.sh",
    "scripts/production/registry-retention-plan.sh",
    "scripts/terraform-check.sh",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/operations/PRODUCTION_SECURITY.md",
    "docs/operations/SUPPLY_CHAIN.md",
    "docs/agents/plans/active/20260731T005308Z-3beea1-production-security-and-supply-chain.md",
    "docs/agents/plans/archive/20260731T005308Z-3beea1-production-security-and-supply-chain.md"
  ],
  "components": [
    "repository-workflow",
    "terraform-infrastructure",
    "root-compose",
    "go:backend/game",
    "frontend-workspace"
  ],
  "contracts": [
    "security:production-baseline-v1",
    "security:image-evidence-v1",
    "security:least-privilege-audit-v1"
  ],
  "dependsOn": [
    "20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry",
    "20260731T005306Z-3de45e-production-compose-traefik-and-deploy",
    "20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts",
    "20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore"
  ],
  "sharedResources": [
    "github:repo:L1TTL3H0rSE/munchkin",
    "cloud:yandex-folder:b1g55l8i2mtpv23b5ql7",
    "cloud:yandex-container-registry:crpdnmjudj1usiu90gdn",
    "cloud:yandex-compute:fv4eule47h2vqo5ki48k",
    "delivery:immutable-image-pair-v1",
    "runtime:production-security-v1"
  ]
}
```

## Цель

Закрыть INFRA-011: доказать least-privilege identities/network/runtime,
добавить reproducible dependency/container/IaC/secret scanning и связать
release SHA с SBOM/provenance/scan evidence без постоянных signing/cloud keys.
Определить безопасную image retention policy, не уничтожая активный или
rollback digest.

## Критерии приёмки

- [x] Repository-side inventory and Terraform assertions cover only documented
  subject/role/resource edges; runtime, image publisher, deploy, backup,
  Terraform state/deployer identities разделены, and the static cloud-key
  count is `0`; live IAM/host inventory remains unrun.
- [x] GitHub workflow permissions are explicit/minimal, actions are pinned by full SHA,
  environments protected, WIF subjects exact, fork PR не получает privileged
  token/secrets by repository-side policy; branch/check/environment settings are
  documented, while live GitHub settings remain separately gated and unrun.
- [x] GitHub connector confirms repository `L1TTL3H0rSE/munchkin` is public and
  authenticated owner `L1TTL3H0rSE` has admin permission. GitHub Free public
  features are selected; exact protected-main, required-check and production-
  environment mutations remain separately gated and unrun.
- [x] Free pinned CI stack: Gitleaks `8.30.1` (secrets), Trivy CLI `0.70.0`
  (filesystem/image/IaC/Compose/Dockerfile), OSV-Scanner `2.3.8` and
  govulncheck `1.6.0` (dependencies/Go), Syft `1.44.0` (SPDX/CycloneDX SBOM),
  CodeQL Action release `v4.37.3` for Go + JavaScript/TypeScript pinned to full SHA
  `c54b30b7df092240050e69945842bc67aee0f0f4`. CLI binaries/images use verified
  checksum/digest; no mutable action tag or `latest` is executable authority.
  The repository contracts pass; full scanner downloads remain a CI/live gate.
- [x] Severity/SLA policy: Critical always blocks release and is fixed or
  explicitly waived within `24h`; High is fixed within `7d` and blocks when
  reachable/runtime-impacting; Medium within `30d`; Low at next maintenance.
  Exception owner is repository owner `L1TTL3H0rSE`; every exception records
  rationale, scope, compensating control and expiry no longer than `30d`.
- [x] Для каждого `game`/`web` digest Syft SBOM and GitHub Artifact Attestation
  are tied to full commit SHA. `actions/attest` release `v4.2.0` is pinned to full SHA
  `f7c74d28b9d84cb8768d0b8ca14a4bac6ef463e6`; GitHub OIDC is the selected
  keyless signing/provenance mechanism and static signing keys are forbidden;
  first publication/attestation remains unrun.
- [x] Deploy verifies digest belongs to expected registry/repository/SHA and
  satisfies evidence policy before rollout. Missing/mismatched evidence fails
  closed once enforcement is enabled; a production deployment remains unrun.
- [x] Image cleanup first produces dry-run protected set containing current,
  previous, pending release and minimum recovery generations. Destructive
  deletion and paid Yandex scanner require separate price/owner approval.
  This baseline has incremental security-tool budget `0 RUB/month`.
  The report-only retention proof passed; deletion and paid scanning remain
  separately gated and unrun.
- [x] The repository-side runtime audit contract requires public listeners only
  `80/443` plus CIDR-limited SSH, no Docker socket/API exposure, no deploy user
  in Docker group, root-only secrets, patched host and bounded logs; live host
  audit remains unrun.
- [x] Traefik baseline headers/rate/body/timeouts and TLS policy are
  application-compatible and tested; CSP/socket-proxy advanced hardening may
  remain deferred for a separate future plan if it needs product/browser work;
  local Compose/static checks passed.
- [x] Backup bucket/state bucket/Lockbox/registry public access and encryption/
  lifecycle/IAM policies have focused repository-side assertions; live
  read-only inventory remains unrun.
- [x] Clean repository-side scan contracts, canonical verify and scope-check
  pass; accepted risks are explicit, dated and owned. Live cloud/host inventory,
  deploy verification and first attestation remain separately gated and unrun.

## Контекст и подтверждённое состояние

- Previous plans establish WIF, immutable digests, production deploy, telemetry
  and backup; this plan is their cross-cutting security review/hardening pass.
- Current foundation already denies password/root SSH, limits SSH CIDR, avoids
  Docker-group admin and static runtime keys.
- `container-registry.images.pusher` is broader than append-only; no-overwrite
  workflow policy alone is not a cloud-enforced deny.
- GitHub connector confirms the repo is already public and the authenticated
  owner has admin permission; user confirms GitHub Free and access to required
  GitHub/Yandex settings. The free pins/SLA above are selected for this draft.
- Paid Yandex vulnerability scanner is deferred. Yandex-native keyless OCI
  signature support is not claimed; deploy consumes GitHub digest-bound
  attestation evidence unless a later approved integration proves otherwise.

## Scope

### Входит

- GitHub/Yandex/VM/network/secret/backup IAM audit and hardening.
- CI scanners, Dependabot, SBOM, keyless provenance/signing and deploy verify.
- Safe image retention dry-run/policy and security runbooks.
- Baseline ingress/TLS/container/host security checks.

### Не входит

- Feature authorization/admin console, DDoS service, WAF, SOC/SIEM.
- Guaranteed zero vulnerabilities without documented exception lifecycle.
- Full log/metrics/synthetic/load bonus stack, currently deferred with no
  implementation owner.
- Destructive key/resource/image cleanup without separate approval.

## Архитектурный подход

1. Inventory actual trust graph first; compare with machine-readable allowlist.
2. Run the selected free pinned scanners in unprivileged jobs, generate Syft
   SBOM, then use exact-SHA `actions/attest` with GitHub OIDC for each digest;
   privileged publish/deploy jobs only consume verified outputs.
3. Use policy-as-code checks with staged warn→enforce transition to avoid
   silently blocking production.
4. Cleanup computes protected digests from current/previous/pending state and
   only emits a dry-run until owner authorizes exact deletions.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| GitHub workflows | Scans/evidence/permissions | Required security checks |
| images | SBOM/provenance/keyless attest | Digest-bound evidence |
| deploy | Evidence verification | Fail-closed release policy |
| Terraform/host | IAM/network/secret hardening | Allowlisted trust graph |
| registry | Retention policy | Protected digest set |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.github/dependabot.yml` | write | Dependency updates |
| `.github/workflows/ci.yml` | write | Image evidence/security gates |
| `.github/workflows/deploy-production.yml` | write | Deploy verification |
| `.github/workflows/security.yml` | write | Scheduled/manual security audit |
| `backend/game/Dockerfile` | write | Backend image hardening |
| `frontend/Dockerfile` | write | Frontend image hardening |
| `compose.production.yml` | write | Runtime hardening |
| `infra/compose/traefik-static.yml` | write | Traefik provider/socket boundary hardening |
| `infra/compose/traefik-dynamic.yml` | write | Exact security headers/middleware |
| `infra/terraform/bootstrap/github_actions.tf` | write | Exact GitHub WIF subject/role hardening |
| `infra/terraform/environments/production/cloud-init.yaml.tftpl` | write | Host firewall, audit, sysctl and Docker baseline |
| `infra/terraform/environments/production/compute.tf` | write | VM metadata/runtime assertions |
| `infra/terraform/environments/production/iam.tf` | write | Production least privilege |
| `infra/terraform/environments/production/network.tf` | write | Listener/security-group assertions |
| `infra/terraform/environments/production/registry.tf` | write | Registry policy/retention inputs |
| `infra/terraform/README.md` | write | Security/auth documentation |
| `scripts/ci/security-scan.sh` | write | Pinned scanner orchestration |
| `scripts/ci/verify-action-pins.mjs` | write | Full-SHA action policy |
| `scripts/production/security-audit.sh` | write | Runtime/IAM/listener verification |
| `scripts/production/verify-release-evidence.sh` | write | Digest/SHA/attestation gate |
| `scripts/production/registry-retention-plan.sh` | write | Dry-run protected-digest retention plan |
| `scripts/terraform-check.sh` | write | IAM/network/storage assertions |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | INFRA-011 status |
| `docs/operations/PRODUCTION_SECURITY.md` | write | Production security runbook |
| `docs/operations/SUPPLY_CHAIN.md` | write | Supply-chain runbook |
| `docs/agents/plans/active/20260731T005308Z-3beea1-production-security-and-supply-chain.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T005308Z-3beea1-production-security-and-supply-chain.md` | write | Archived lifecycle |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| GitHub settings/environments/checks | update | Least-privilege enforcement |
| Yandex IAM/network/registry policies | exact update if drift found | Reduce privilege |
| Registry evidence/artifacts | append | SBOM/provenance |
| Registry images | dry-run only by default | Retention analysis |
| Production VM/Compose | controlled hardening rollout | Runtime boundary |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| All production identities/resources | all previous infra plans | this audit after them | No mutation before exact inventory |
| Image/deploy workflows | WIF/deploy plans | dependencies | Extend without changing digest contract |
| Deferred B04/B08/B10 ideas | none | no implementation owner | This plan delivers only its exact P0 security baseline |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 14:44:19 UTC.
- **Обнаруженные пересечения:** exact workflow/Compose/Traefik/Terraform files
  extend archived P0 predecessors; contest P1 has no implementation write set.
- **Решение:** runs only after backup plan archive; inventory may narrow write
  set. Any role removal, image deletion, provider/action/tool change or paid
  service needs updated exact plan and separate approval.

## План реализации

1. [x] Revalidated the recorded release versions/full SHAs and refreshed the
   repository-side IAM/network/secret/listener/image inventory. Live cloud,
   GitHub settings and host inventory remain separate unapproved gates.
2. [x] Recorded exact findings against the settled free-stack/SLA/exception
   policy; the queue approval and all remote-mutation restrictions remain in
   force.
3. [x] Implemented pinned CI scanners, SBOM/provenance/keyless evidence.
4. [x] Added deploy evidence verification and repository settings checks.
5. [x] Hardened Terraform/Compose/host desired state for the proven local
   gaps; apply/deploy remains separately approved.
6. [x] Implemented retention dry-run and recovery-set proof; no deletion was
   attempted.
7. [x] Added incident/revoke/credential-leak drill procedures and runbooks;
   live credential revocation and host drills were not run.
8. [x] Canonical verification and scope-check passed; plan is complete and
   ready for archive/release and its separate local commit.

## Проверки

- [x] Secret/dependency/SAST/IaC/Compose/Docker/image scan contracts are
  implemented with pinned tool downloads; live scanner execution is an
  environment/CI gate.
- [x] SBOM/provenance subject/revision/digest verification is implemented;
  first attestation publication remains unrun.
- [x] Fork PR/environment/WIF permission negative-check contracts are encoded;
  live GitHub settings and claim probe remain unrun.
- [x] Static cloud/signing key inventory assertion is implemented and local
  Terraform contains no managed key resources; live inventory remains unrun.
- [x] Yandex/GitHub IAM allowlist diff is documented and statically checked;
  live inventory remains unrun.
- [x] Host listeners/users/groups/permissions/patch/TLS audit is implemented;
  host execution remains unrun.
- [x] Bucket/Lockbox/registry public-access/encryption checks are implemented;
  live read-only inventory remains unrun.
- [x] Retention dry-run protects current/previous/pending/minimum generations
  and never deletes.
- [x] Revoke WIF/deploy credential and recovery procedures are documented;
  no live revoke or recovery mutation was attempted.
- [x] `node .codex/hooks/plan-lint.mjs` passed with `plans=50 active=4
  archive=46 issues=0`.
- [x] `./leinoctl verify --changed --session
  e6afc969-9462-4343-aefc-a653b89dea87` passed twice, including the final run
  after adding the owner-approved cloud-init template to the exact write set:
  frontend lint/typecheck/tests/build, Go tests, hook/leinoctl tests, plan
  lint, Compose config and Terraform local validation all completed. The
  final run used the approved read-only escalation because Windows Corepack
  could not access the existing user tool cache in the sandbox.
- [x] `./leinoctl scope-check --plan
  20260731T005308Z-3beea1-production-security-and-supply-chain` passed with
  `outsideWriteSet=[]` and `missingRequiredChecks=[]`; the tool reported only
  the non-blocking post-write-hook ledger warning for 26 changed paths.
- [x] `git diff --check` passed.

## Риски и откат

- **Риск:** scanner noise or compromised third-party action. **Снижение:**
  pinned SHAs, least permissions, allowlisted tools, staged enforcement.
- **Риск:** signing adds new long-lived secret. **Снижение:** keyless only;
  unsupported registry/attestation is explicit stop condition.
- **Риск:** IAM hardening breaks runtime/deploy/backup. **Снижение:** exact live
  graph, additive tests, one edge at a time and rollback inventory.
- **Риск:** retention deletes recovery image. **Снижение:** dry-run/protected
  set; no deletion in base approval.
- **Откат:** disable new enforcement checks/restore previous digest and IAM
  edge. Destructive reversal remains separately approved.

## Открытые вопросы

- Audit-selected tool releases, SLA and exception-owner policy are settled for
  review; implementation must revalidate binary checksums/digests and all
  remaining third-party action full SHAs before execution.
- GitHub public Free/admin capability is confirmed. Actual branch protection,
  required checks and environment enforcement remain implementation evidence;
  the connector does not expose those settings and local `gh` is unavailable.
- Yandex-native keyless OCI signature is not assumed. GitHub attestation to
  exact Yandex image digest verification is an implementation gate.
- Paid Yandex scanner is deferred; activation requires a new exact price and
  owner approval. Base incremental tool budget is `0 RUB/month`.
- Plan remains draft/unapproved until backup archive and exact live inventory/
  mutation set are reviewed.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 15:15:14 UTC
- **Подтверждено:** 2026-08-01 15:15:14 UTC
- **Формулировка/ограничения пользователя:** пользователь формально одобрил
  последовательную очередь exact plans начиная с этого plan и разрешил
  approvals, select, implementation, verify, scope-check, archive/release,
  подготовительный local commit plan-файлов и отдельный local commit после
  каждого завершённого plan. Подтверждены зафиксированные audit defaults,
  free security stack с базовым бюджетом `0 RUB/month` и сокращённый Monium
  soak на 60 минут; ветка не создаётся. Разрешён обычный push в `origin/main`
  только после успешных проверок. PostgreSQL password и dedicated deploy SSH
  key разрешено безопасно сгенерировать и передать непосредственно в
  утверждённые secret stores без вывода или сохранения в Git, plan, chat или
  logs. Remote mutations, Terraform apply, secret payload insertion,
  GitHub/Yandex settings, production VM bootstrap/deploy и любые
  платные/destructive actions не одобрены заранее: перед каждым таким этапом
  нужен sanitized exact mutation plan и отдельное approval. Owner email
  остаётся вне Git/plan.

## Ход выполнения

- Baseline cross-cut plan created; destructive/premium gates are explicit.
- 2026-08-01 GitHub connector verified public visibility and owner admin access;
  selected free versions and exception policy recorded.
- 2026-08-01 read-only `git ls-remote` verified CodeQL `v4.37.3` at
  `c54b30b7df092240050e69945842bc67aee0f0f4` and `actions/attest@v4.2.0` at
  `f7c74d28b9d84cb8768d0b8ca14a4bac6ef463e6`.
- 2026-08-01 formal queue approval recorded with the remote-mutation gates
  above; implementation remains dependency-gated.
- 2026-08-01 Plan5 selected in trusted session
  `e6afc969-9462-4343-aefc-a653b89dea87`; implementation started within the
  exact write set. No GitHub/Yandex settings mutation, Terraform apply,
  registry publish/delete, VM bootstrap/deploy, credential generation or
  secret insertion was attempted.
- 2026-08-01 read-only release revalidation confirmed the approved CodeQL and
  Attest full SHAs; official release asset digests for Gitleaks, Trivy,
  OSV-Scanner and Syft were recorded in the local scanner contract. Public
  Docker base-image manifest digests were recorded for the local pinning
  changes.
- 2026-08-01 local security gates passed: shell syntax, scanner contract,
  full-SHA action policy, static security audit, report-only retention probe,
  isolated production Compose config and Terraform fmt/init/validate/lockfile
  assertions. No scanner download, image publication, attestation, cloud or
  host mutation was attempted.
- 2026-08-01 owner approved the scope correction after scope-check identified
  the host cloud-init template in the implementation but not the original
  manifest/write-set table. The exact path was added; no other path, contract,
  dependency or queue order changed.
- 2026-08-01 final canonical verify and scope-check passed after the approved
  scope correction; no remote, cloud, host or destructive mutation was run.

## Итог

Локальный security/supply-chain baseline реализуется в exact write set:
workflow permissions and full-SHA action policy, verified scanner downloads,
SBOM/attestation evidence, digest-bound deploy verification, host/Traefik/
Compose hardening, Terraform assertions, retention dry-run and operator
runbooks. Live GitHub settings, Yandex IAM/network/registry mutation, first
image/attestation publication, VM audit and destructive/paid operations remain
separately gated and unrun. Canonical verify and scope-check passed; archive,
release and the separate local commit remain.
