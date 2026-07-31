# PLAN: production security and supply-chain baseline

- **Plan ID:** `20260731T005308Z-3beea1-production-security-and-supply-chain`
- **Статус:** draft
- **Создан:** 2026-07-31 00:53:08 UTC
- **Обновлён:** 2026-07-31 01:05:00 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore`.
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
    "infra/compose/**",
    "infra/terraform/bootstrap/**",
    "infra/terraform/environments/production/**",
    "infra/terraform/README.md",
    "scripts/ci/**",
    "scripts/production/**",
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

- [ ] Полный Yandex/GitHub/host IAM inventory показывает только documented
  subject/role/resource edges; runtime, image publisher, deploy, backup,
  Terraform state/deployer identities разделены. Static cloud key counts `0`.
- [ ] GitHub workflow permissions explicit/minimal, actions pinned by full SHA,
  environments protected, WIF subjects exact, fork PR не получает privileged
  token/secrets. Branch/check/environment settings documented and tested.
- [ ] CI выполняет pinned secret, dependency, SAST/IaC/Compose/Dockerfile and
  container vulnerability scans with owner-approved severity/exception/SLA
  policy. Findings never print secrets or upload source outside approved tools.
- [ ] Для каждого `game`/`web` digest создаётся SBOM and provenance/attestation
  tied to full commit SHA. Signing/attestation keyless through GitHub OIDC or
  another approved short-lived identity; static signing key запрещён.
- [ ] Deploy verifies digest belongs to expected registry/repository/SHA and
  satisfies evidence policy before rollout. Missing/mismatched evidence fails
  closed once enforcement is enabled.
- [ ] Image cleanup first produces dry-run protected set containing current,
  previous, pending release and minimum recovery generations. Destructive
  deletion and paid Yandex scanner require separate price/owner approval.
- [ ] Runtime audit confirms public listeners only `80/443` plus CIDR-limited
  SSH, no Docker socket/API exposure, no deploy user in Docker group, root-only
  secrets, patched host and bounded logs.
- [ ] Traefik baseline headers/rate/body/timeouts and TLS policy are
  application-compatible and tested; CSP/socket-proxy advanced hardening may
  remain P1 if it needs product/browser work.
- [ ] Backup bucket/state bucket/Lockbox/registry public access and encryption/
  lifecycle/IAM policies pass focused assertions.
- [ ] Clean scans, host/cloud inventory, deploy verification, canonical verify
  and scope-check pass; accepted risks are explicit, dated and owned.

## Контекст и подтверждённое состояние

- Previous plans establish WIF, immutable digests, production deploy, telemetry
  and backup; this plan is their cross-cutting security review/hardening pass.
- Current foundation already denies password/root SSH, limits SSH CIDR, avoids
  Docker-group admin and static runtime keys.
- `container-registry.images.pusher` is broader than append-only; no-overwrite
  workflow policy alone is not a cloud-enforced deny.
- Paid scan/retention/signing compatibility and current action/tool versions
  are time-sensitive and must be re-priced/researched before approval.

## Scope

### Входит

- GitHub/Yandex/VM/network/secret/backup IAM audit and hardening.
- CI scanners, Dependabot, SBOM, keyless provenance/signing and deploy verify.
- Safe image retention dry-run/policy and security runbooks.
- Baseline ingress/TLS/container/host security checks.

### Не входит

- Feature authorization/admin console, DDoS service, WAF, SOC/SIEM.
- Guaranteed zero vulnerabilities without documented exception lifecycle.
- P1 full log/metrics/synthetic/load stack.
- Destructive key/resource/image cleanup without separate approval.

## Архитектурный подход

1. Inventory actual trust graph first; compare with machine-readable allowlist.
2. Generate evidence in unprivileged build jobs, then keylessly attest exact
   digest; privileged publish/deploy jobs only consume verified outputs.
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
| `infra/compose/**` | write | Traefik/container security config |
| `infra/terraform/bootstrap/**` | write | WIF/IAM hardening |
| `infra/terraform/environments/production/**` | write | Production IAM/security assertions |
| `infra/terraform/README.md` | write | Security/auth documentation |
| `scripts/ci/**` | write | Scan/evidence helpers |
| `scripts/production/**` | write | Verification/retention audit |
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
| P1 B04/B08/B10 | P1 bonus plan | baseline here | P1 adds advanced evidence/headers/socket proxy |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 01:05:00 UTC.
- **Обнаруженные пересечения:** intentionally cross-cuts all prior infra files
  and future P1 hardening.
- **Решение:** runs only after backup plan archive; inventory may narrow write
  set. Any role removal, image deletion, provider/action/tool change or paid
  service needs updated exact plan and separate approval.

## План реализации

1. [ ] Refresh official threat/tool/pricing contracts and actual IAM/network/
   secret/listener/image inventory.
2. [ ] Update exact findings, exceptions, scanner/attestation tools and budget;
   request owner approval.
3. [ ] Implement pinned CI scanners, SBOM/provenance/keyless evidence.
4. [ ] Add deploy evidence verification and repository settings checks.
5. [ ] Harden Terraform/Compose/host only for proven gaps; apply/deploy through
   separate exact approvals.
6. [ ] Run retention dry-run and recovery-set proof; do not delete.
7. [ ] Execute incident/revoke/credential-leak drills and update runbooks.
8. [ ] Verify/scope-check and archive.

## Проверки

- [ ] Secret/dependency/SAST/IaC/Compose/Docker/image scans
- [ ] SBOM/provenance subject/revision/digest verification
- [ ] Fork PR/environment/WIF permission negative tests
- [ ] Static cloud/signing key inventory `0`
- [ ] Yandex/GitHub IAM allowlist diff
- [ ] Host listeners/users/groups/permissions/patch/TLS audit
- [ ] Bucket/Lockbox/registry public-access/encryption checks
- [ ] Retention dry-run protects current/previous/pending/min generations
- [ ] Revoke WIF/deploy credential and recovery drill
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T005308Z-3beea1-production-security-and-supply-chain`
- [ ] `git diff --check`

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

- Exact scanners/versions, severity SLA and exception owner.
- Yandex registry OCI attestation/signature support and keyless verifier.
- Paid Yandex vulnerability scan and retention pricing.
- Required GitHub settings available for public personal repository.
- Plan is base draft; decisions must be refreshed before approval.

## Согласование

- **Статус:** not requested; prerequisite draft
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** заранее создать все infra plans;
  no static cloud keys; no select/implementation/commit/push.

## Ход выполнения

- Baseline cross-cut plan created; destructive/premium gates are explicit.
- Implementation не начата, plan не selected.

## Итог

Заполняется после реализации.
