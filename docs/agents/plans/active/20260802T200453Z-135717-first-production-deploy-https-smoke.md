# PLAN: first production deploy https smoke

- **Plan ID:** `20260802T200453Z-135717-first-production-deploy-https-smoke`
- **Статус:** in_progress
- **Создан:** 2026-08-02 20:04:53 UTC
- **Обновлён:** 2026-08-02 20:30:09 UTC
- **Владелец:** Codex
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; отдельная ветка не создаётся
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260802T164112Z-dfb164-production-live-wif-registry-evidence`.
- **Блокирует:** public contest URL handoff
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/operations/PRODUCTION_DEPLOYMENT.md`,
  `docs/operations/PRODUCTION_ROLLBACK.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".github/workflows/deploy-production.yml",
    "scripts/production/verify-release-evidence.sh",
    "docs/agents/plans/active/20260802T200453Z-135717-first-production-deploy-https-smoke.md",
    "docs/agents/plans/archive/20260802T200453Z-135717-first-production-deploy-https-smoke.md"
  ],
  "components": ["repository-workflow", "release-evidence"],
  "contracts": ["production-release-evidence-v1", "health-migrations-v1"],
  "dependsOn": [
    "20260802T164112Z-dfb164-production-live-wif-registry-evidence"
  ],
  "sharedResources": [
    "github:workflow:deploy-production",
    "github:environment:production-deploy",
    "github:actions-run:30764183366",
    "cloud:yandex-vm:fv4eule47h2vqo5ki48k",
    "cloud:yandex-address:81.26.187.230",
    "cloud:yandex-container-registry:crpdnmjudj1usiu90gdn",
    "dns:munchkin.l1ttl3h0rse.ru",
    "host:/srv/munchkin",
    "delivery:production-deploy-lock"
  ]
}
```

## Цель

Выполнить первый production rollout уже проверенной immutable image pair через
единственный защищённый workflow/forced-command SSH boundary, получить valid
public HTTPS и зафиксировать machine-readable release evidence без раскрытия
секретов и без ad-hoc SSH-команд.

## Критерии приёмки

- [ ] `deploy-production` запущен с exact game/web digest refs, commit
      `f76b152be0513f68b3d4053916c2e35455d4e36e` и release run `30764183366`.
- [ ] Workflow повторно проверяет manifest, SBOM и все четыре GitHub
      attestations с `--require-attestation` до SSH.
- [ ] Forced-command host rollout успешно выполняет secret-file validation,
      Registry pull, PostgreSQL start, one-shot migration, game/web/Traefik
      readiness и internal/public smoke.
- [ ] Production evidence имеет `result=success`, exact commit/digests и
      `migration/readiness/smoke=passed`; artifact загружен в GitHub Actions.
- [ ] `https://munchkin.l1ttl3h0rse.ru/` и `/health/live` доступны с валидным
      TLS; браузерный smoke подтверждает загрузку публичной страницы.
- [ ] Не изменены Terraform/cloud/DNS/NS, GitHub settings, Registry contents
      кроме pull, Lockbox payloads или secret values; lifecycle scope clean.

## Контекст и подтверждённое состояние

- Repository public; full 88-commit Gitleaks audit returned zero findings.
- Security run `30764183357` passed pinned scanners and both CodeQL languages.
- CI run `30764183366`, job `91539977912`, passed WIF claim/login, image scans,
  immutable pushes and all four attestation steps.
- Exact images:
  `cr.yandex/crpdnmjudj1usiu90gdn/game@sha256:7d86e704275c8f16e360a52ccd857615e1737bdf6da4b05ccbb51b8d71a49af2`
  and
  `cr.yandex/crpdnmjudj1usiu90gdn/web@sha256:a45bef5793ff4ee75226fdf812c56aa0ddefaab05e259dccc61fbe6f2a2b72d3`.
- Release artifact `8838476788` has digest
  `sha256:9a27ce51dd7f575a127b6861125eda950ea318ab1359b0e1927422039df36240`.
- `production-deploy` is main-only and has all three required secret names:
  `PRODUCTION_DEPLOY_HOST`, `PRODUCTION_DEPLOY_KNOWN_HOSTS` and
  `PRODUCTION_DEPLOY_SSH_PRIVATE_KEY`; values were not read.
- Public DNS currently resolves `munchkin.l1ttl3h0rse.ru` to reserved IPv4
  `81.26.187.230` with TTL 600. HTTPS currently fails closed with
  `ERR_CONNECTION_REFUSED`, consistent with the production stack not running.

## Scope

### Входит

- Dispatch the existing `.github/workflows/deploy-production.yml` from `main`
  with the exact immutable release inputs above.
- The one allowlisted `deploy` command may mutate only the existing VM runtime
  under `/srv/munchkin`: pull images, start Compose services, run migration,
  readiness and smoke, and atomically record current/previous release evidence.
- Read-only inspection of workflow status/artifact and public DNS/HTTPS.
- Exact one-line Linux runner portability fix in
  `.github/workflows/deploy-production.yml`: invoke the existing verifier via
  `bash`; no verification policy or arguments change.
- Exact manifest serialization fix in
  `scripts/production/verify-release-evidence.sh`; security evidence and all
  four attestations remain mandatory and unchanged.
- Exact registry-free attestation fix confirmed by run `30765399436`: install
  pinned Cosign v3.0.6 and verify each local Sigstore bundle against the exact
  image digest plus GitHub workflow identity/ref/SHA before SSH.
- Lifecycle evidence in this plan, archive, local commit and push to `main`.

### Не входит

- Any repository source/config/workflow change except the three exact pre-SSH
  release-gate fixes confirmed by runs `30764956972`, `30765108163` and
  `30765399436`: invoke the verifier through `bash`; compare the manifest's
  exact `repo:commit`, digest and combined `repo:commit@digest` fields; and use
  pinned Cosign digest-only verification for the already downloaded local
  Sigstore bundles without requiring Registry credentials on the runner.
- Terraform apply, Yandex resource mutation, DNS/NS edit, firewall change,
  Registry delete/retag/push, GitHub settings/environment/secret mutation.
- Reading, printing or rotating SSH/application/ACME/Lockbox secret values.
- Ad-hoc admin SSH or direct Docker/Compose commands outside the workflow.
- Rollback or destructive cleanup; a failed rollout stops for diagnosis.

## Архитектурный подход

- Use the existing fail-closed chain: release evidence verification first,
  including registry-free cryptographic Sigstore bundle verification with
  pinned Cosign, protected SSH material second, then one forced-command host
  operation.
- Trust only immutable digest refs and the exact public commit/run pair.
- Treat workflow `success` plus host evidence and independent public HTTPS
  checks as completion; no UI inference substitutes for recorded evidence.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| GitHub Actions | explicit Bash invocation, pinned Cosign install and dispatch/read | exact inputs plus registry-free cryptographic bundle verification |
| Existing VM runtime | controlled rollout through gateway | `production-release-evidence-v1` |
| Public edge | read-only HTTPS validation | hostname/TLS/health availability |
| Repository | lifecycle, workflow launcher and manifest contract fix | no attestation-policy weakening |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.github/workflows/deploy-production.yml` | write | Invoke verifier through Bash and install pinned Cosign v3.0.6 |
| `scripts/production/verify-release-evidence.sh` | write | Verify exact manifest serialization and local bundle identity/digest |
| `docs/agents/plans/active/20260802T200453Z-135717-first-production-deploy-https-smoke.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260802T200453Z-135717-first-production-deploy-https-smoke.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `github:environment:production-deploy` | archived production deploy plan | Codex/owner | existing config; no mutation |
| `github:actions-run:30764183366` | archived WIF evidence plan | completed dependency | read-only artifact input |
| `cloud:yandex-vm:fv4eule47h2vqo5ki48k` | P1/P2 drafts | this plan for rollout | no concurrent VM operation |
| `host:/srv/munchkin` | production runbooks | forced-command gateway | serialized deploy lock |
| `dns:munchkin.l1ttl3h0rse.ru` | P1 draft | read-only | no DNS mutation |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-02 20:04:53 UTC
- **Обнаруженные пересечения:** P1/P2 are ineligible drafts; three Figma plans
  do not own production VM/workflow/DNS resources. The completed dependency
  owns only the already published release pair.
- **Решение:** exclusive deploy plan; no concurrent cloud/VM operation.

## План реализации

1. [x] Select this exact plan and confirm clean `main`/release inputs.
2. [x] Dispatch `deploy-production` with the exact two digests, full SHA and
      release run ID; do not change workflow/environment/secrets.
3. [x] Fix the confirmed pre-SSH workflow portability and manifest
      serialization failures; run focused fail-closed fixture/policy checks,
      canonical verify/scope-check, commit/push and dispatch the same exact
      release inputs again.
4. [ ] Wait for terminal workflow result and inspect every step plus uploaded
      production evidence without exposing protected values.
5. [ ] Independently verify DNS, TLS, page load and public health; perform a
      minimal browser smoke if the workflow succeeded.
6. [ ] Record actual results, run canonical lifecycle verify/scope-check,
      archive, guarded release, commit and push.

## Проверки

- [ ] `node .codex/hooks/plan-lint.mjs` before dispatch.
- [ ] GitHub deploy workflow and evidence artifact — terminal success.
- [ ] `Resolve-DnsName` exact A record; HTTPS page and `/health/live` succeed.
- [ ] Browser smoke: public page loads without certificate/connection error.
- [ ] `./leinoctl verify --changed` and
      `./leinoctl scope-check --plan 20260802T200453Z-135717-first-production-deploy-https-smoke`.

## Риски и откат

- **Риск:** VM bootstrap, root-only secret files, deploy SSH key or host key may
  be incomplete. **Снижение:** workflow fails before accepting a release;
  retain evidence and fix only under a new exact plan.
- **Риск:** ACME is still staging/misconfigured or port 80/443 is unavailable.
  **Снижение:** never bypass TLS verification; stop on public smoke failure and
  request the exact owner-side secret/network repair without printing values.
- **Риск:** migration/readiness failure. **Снижение:** current release evidence
  is updated atomically only after all gates pass; no blind retry.
- **Откат:** no automatic destructive rollback. If a previous successful
  release exists and rollback is needed, use the documented controlled
  rollback under separate exact approval.

## Открытые вопросы

- No blocking user input before dispatch. If protected VM/ACME values are
  missing or invalid, report only the failed contract and ask the owner to
  repair them through the protected channel; never paste values into chat.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-02 20:04:53 UTC
- **Подтверждено:** 2026-08-02; owner explicitly approved successor plans,
  plan changes, commit/push and continuation to deployment, then requested the
  public site before midnight.
- **Формулировка/ограничения пользователя:** deploy ASAP; no secret values in
  chat/logs; keep existing domain/IP/budget decisions; publish everything when
  finished.

## Ход выполнения

- Draft created after guarded release and separate pushed lifecycle commit
  `35ec8e9`; read-only context and exact remote preflight completed.
- Plan-lint passed with `plans=65 active=6 archive=59 issues=0`; exact plan
  selected in session `019fc31d-f7f5-7f72-8020-aabe8a6f22cb`.
- GitHub `deploy-production` run `30764956972` dispatched from `main` at
  workflow commit `35ec8e9` with exact game/web digests, release commit
  `f76b152be0513f68b3d4053916c2e35455d4e36e` and release run `30764183366`.
- Run `30764956972`, job `91541895798`, failed closed before protected SSH:
  immutable inputs passed, then the runner returned
  `scripts/production/verify-release-evidence.sh: Permission denied` (exit
  126). SSH preparation/deploy were skipped and evidence upload ran. Per the
  owner's standing approval for plan/fix changes, write scope expands only to
  `.github/workflows/deploy-production.yml` for a one-line explicit Bash
  invocation; no script behavior, VM, secrets or environment settings change.
- Focused Git Bash verifier entrypoint, full-SHA action policy, plan-lint,
  canonical repository-workflow verify (`42/42` harness and `80/0/1`
  leinoctl) and scope-check all passed. Fix commit `670cbc1` was pushed; exact
  retry run `30765108163` dispatched with unchanged release inputs.
- Retry `30765108163`, job `91542289246`, passed explicit Bash launch and then
  failed closed before SSH because the release manifest stores
  `repo:commit@digest` while the approved workflow input is immutable
  `repo@digest`. Direct artifact inspection confirmed the same commit and
  digests in manifest/security evidence; the scoped verifier fix requires the
  exact manifest ref, digest and recomposed image instead of weakening string
  matching.
- Real artifact fixture passed the corrected verifier, while a tampered game
  digest was rejected. Git Bash syntax, action-pin policy, canonical
  repository-workflow verify and scope-check passed. Fix commit `bb4fe34` was
  pushed and exact retry run `30765399436` dispatched with unchanged release
  inputs.
- Retry `30765399436`, job `91543078239`, passed manifest/SBOM validation and
  failed closed before SSH because `gh attestation verify oci://... --bundle`
  still authenticates to the private Registry even when the local bundle and
  immutable digest are supplied. No VM step ran. The approved scoped repair
  pins Cosign v3.0.6 and verifies the four local Sigstore v0.3 bundles directly
  by digest while enforcing the exact GitHub Actions issuer, repository,
  workflow identity/name, main ref, push trigger and release SHA.
- All four real release bundles passed that Cosign policy locally without
  Registry credentials; a tampered game digest was rejected.

## Итог

Заполняется после реализации.
