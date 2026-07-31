# PLAN: GitHub Actions, Yandex Cloud WIF and immutable images

- **Plan ID:** `20260731T005255Z-b3ea2b-github-actions-yandex-images`
- **Статус:** completed
- **Создан:** 2026-07-31 00:52:55 UTC
- **Обновлён:** 2026-07-31 13:02:17 UTC
- **Владелец:** Codex / `019fb760-1241-7b61-b9ce-217108b8b38e`
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`; отдельная ветка не создаётся по указанию владельца
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260730T220518Z-84ffe4-yandex-cloud-network-registry-and-compute`.
- **Блокирует:**
  `20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry`
- **Связанные ADR/handoff:** ADR-0007, ADR-0009,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`,
  `docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".github/workflows/ci.yml",
    "backend/game/Dockerfile",
    "frontend/Dockerfile",
    "infra/terraform/bootstrap/github_actions.tf",
    "infra/terraform/bootstrap/outputs.tf",
    "infra/terraform/environments/production/iam.tf",
    "infra/terraform/environments/production/registry.tf",
    "infra/terraform/environments/production/outputs.tf",
    "infra/terraform/README.md",
    "scripts/ci/yandex-wif-token.sh",
    "scripts/terraform-check.sh",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/operations/GITHUB_ACTIONS_YANDEX_IMAGES.md",
    "docs/agents/plans/active/20260731T005255Z-b3ea2b-github-actions-yandex-images.md",
    "docs/agents/plans/archive/20260731T005255Z-b3ea2b-github-actions-yandex-images.md"
  ],
  "components": [
    "repository-workflow",
    "terraform-infrastructure",
    "go:backend/game",
    "frontend-workspace"
  ],
  "contracts": [
    "ci:github-parity-v1",
    "delivery:immutable-image-pair-v1",
    "identity:github-yandex-wif-v1"
  ],
  "dependsOn": [
    "20260730T220518Z-84ffe4-yandex-cloud-network-registry-and-compute"
  ],
  "sharedResources": [
    "infra:yandex-cloud-production-v1",
    "cloud:yandex-folder:b1g55l8i2mtpv23b5ql7",
    "cloud:yandex-container-registry:crpdnmjudj1usiu90gdn",
    "cloud:yandex-iam:munchkin-github-images",
    "github:repo:L1TTL3H0rSE/munchkin",
    "github:environment:production-images"
  ]
}
```

## Цель

Создать GitHub Actions parity для обязательных repository checks и после их
успеха собирать/push-ить `game` и `web` в private Yandex Container Registry
`crpdnmjudj1usiu90gdn`. GitHub получает краткоживущий Yandex IAM token только
через GitHub OIDC и Yandex Cloud Workload Identity Federation; static access
keys, authorized keys, service-account JSON, `YC_TOKEN`,
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` и иные постоянные cloud credentials
в GitHub Secrets запрещены. Результат публикации — проверенная пара image
references по digest, а не плавающий production tag.

## Критерии приёмки

- [ ] `.github/workflows/ci.yml` воспроизводит актуальные обязательные
  GitLab/repository gates: harness/hooks/leinoctl/plan-lint/preflight/
  `ci-impact`, content validator, Go unit, real PostgreSQL contract,
  frontend lint/check/build, Compose config и Docker build smoke.
- [ ] Pull request jobs и обычные verification jobs имеют только
  `contents: read`; `id-token: write` существует только у publish jobs.
  Workflow не получает `packages: write`, cloud token или environment на PR.
- [ ] Publish запускается только для trusted `push` в `main` или отдельно
  подтверждённого `workflow_dispatch`, после всех checks, через protected
  GitHub environment `production-images`; fork PR и arbitrary branch не могут
  получить WIF token или push access.
- [ ] GitHub Actions и third-party actions pinned на full commit SHA.
  Reusable workflow privilege escalation, unsafe `pull_request_target`,
  untrusted `workflow_run`, mutable action tags и shell interpolation
  attacker-controlled context отсутствуют.
- [ ] Bootstrap Terraform создаёт отдельный keyless service account
  `munchkin-github-images`, GitHub OIDC workload identity federation и ровно
  одну federated credential для exact external subject. Ни один static/API/
  authorized key для CI account не создаётся.
- [ ] Trust использует issuer
  `https://token.actions.githubusercontent.com`, exact audience и observed
  subject. Для созданного 2026-07-29 repository ожидается immutable subject
  `repo:L1TTL3H0rSE@32160016/munchkin@1316069622:environment:production-images`;
  Terraform apply запрещён, пока claim-probe не подтвердит точные
  `iss`/`aud`/`sub`, `repository_id=1316069622`,
  `repository_owner_id=32160016` и environment.
- [ ] Claim-probe никогда не печатает/сохраняет raw JWT или token: в evidence
  разрешены только decoded non-secret claims. После создания federation
  отдельный smoke обменивает JWT на short-lived IAM token и не логирует его.
- [ ] CI service account получает только
  `container-registry.images.pusher` на exact registry
  `crpdnmjudj1usiu90gdn`; folder-wide editor/admin, runtime-SA access,
  Terraform state access, Compute/VPC/Lockbox roles и puller binding не
  добавляются. Authoritative registry bindings инвентаризируются до apply.
- [ ] `game` и `web` строятся из repository Dockerfiles после checks, получают
  OCI labels `source`, `revision`, `created` и `licenses`, push-ятся только в
  `cr.yandex/crpdnmjudj1usiu90gdn/game` и
  `cr.yandex/crpdnmjudj1usiu90gdn/web`.
- [ ] SHA tag равен полному lowercase Git commit SHA и никогда не
  перезаписывается: существующий tag является stop condition. Authoritative
  handoff содержит две digest-pinned ссылки
  `cr.yandex/.../game@sha256:...` и `cr.yandex/.../web@sha256:...`,
  commit SHA, workflow run/attempt и build timestamps.
- [ ] Частично опубликованный image не считается release: pair manifest
  появляется только после успешных push/remote digest verification обоих
  images. Следующий deploy plan принимает только эту verified pair.
- [ ] WIF exchange и `docker login` используют masked ephemeral process
  values/`--password-stdin`; OIDC JWT, IAM token и Docker auth не попадают в
  command trace, artifacts, cache, workflow summary или repository.
- [ ] Registry cache/CI artifacts ограничены по размеру и retention; никакой
  paid vulnerability scanning или destructive image cleanup не включается без
  отдельной тарификации и security plan.
- [ ] Bootstrap и production Terraform applies каждый выполняются только
  после отдельного owner approval exact sanitized plan. Unexpected
  add/change/destroy, provider upgrade, IAM replacement или изменение
  runtime puller binding останавливают работу.
- [ ] После apply доказаны clean Terraform plans, exact WIF/federated
  credential/SA/registry IAM inventory, `0` static keys и успешная первая
  publication. Repository docs содержат runbook revoke/diagnose/rotate trust.
- [x] Focused checks, canonical `./leinoctl verify --changed`, plan-lint,
  strict UTF-8/secret scan, diff review и scope-check проходят. Commit/push,
  GitHub environment mutation и cloud apply не выполняются без отдельных
  разрешений владельца.

## Контекст и подтверждённое состояние

- Completed foundation plan создал private registry
  `crpdnmjudj1usiu90gdn` с explicit repositories
  `crpdnmjudj1usiu90gdn/game` и `crpdnmjudj1usiu90gdn/web`.
  Runtime SA `aje84i3qaj2dhkr9q28l` имеет только puller binding; registry
  images ещё не опубликованы.
- Production Terraform remote state активен и clean; apply foundation дал
  `10 added / 0 changed / 0 destroyed`, post-apply plan — no changes.
- `.github/` отсутствует. Current `.gitlab-ci.yml` является parity source и
  уже содержит repository, Go/PostgreSQL, frontend, Compose и image-build
  jobs. GitLab pipeline не удаляется этим plan.
- `backend/game/Dockerfile` и `frontend/Dockerfile` multi-stage и запускают
  runtime не от root, но пока не имеют полного provenance label contract.
- GitHub remote — public repository `L1TTL3H0rSE/munchkin`, default branch
  `main`, repository ID `1316069622`, owner ID `32160016`, creation time
  `2026-07-29T11:47:50Z`. Он попадает под immutable default OIDC subject
  rollout GitHub от 2026-07-15.
- GitHub OIDC current contract: `id-token: write` позволяет job запросить OIDC
  token, но само по себе не даёт доступ к Yandex. Yandex WIF связывает exact
  external subject с service account через federated credential и меняет
  проверенный JWT на short-lived IAM token.
- `container-registry.images.pusher` — минимальная штатная service role для
  push, но она шире append-only: может управлять images и repositories.
  Поэтому binding ограничивается exact registry, publish не перезаписывает
  tags, а destructive cleanup вынесен из этого plan.
- Provider lock — `yandex-cloud/yandex v0.220.0`. До implementation
  изолированно проверяется поддержка
  `yandex_iam_workload_identity_oidc_federation` и
  `yandex_iam_workload_identity_federated_credential`; upgrade provider не
  подразумевается данным approval.
- В worktree присутствует незакоммиченная owner-правка archived foundation
  plan и другие user-created draft plans. Они не очищаются, не stage-ятся и
  не входят в реализацию.

## Scope

### Входит

- GitHub Actions parity и trusted main-only image publication.
- Full-SHA tags, digest verification и non-secret image-pair handoff.
- Dedicated keyless CI service account, OIDC federation, exact federated
  credential и registry-scoped pusher binding.
- Minimal Dockerfile provenance hardening, WIF exchange helper, Terraform
  assertions, runbook и roadmap status.
- Read-only GitHub/Yandex inventories, claim-probe, exact Terraform plans,
  separately approved applies и post-apply smoke.

### Не входит

- Static Yandex access/authorized/API keys, service-account JSON или permanent
  `YC_TOKEN`/S3 credentials в GitHub.
- Production Compose/Traefik, SSH deploy, DNS/TLS, Lockbox payload, database
  migration, readiness, runtime rollout/rollback или public application.
- GitHub-hosted Terraform apply; state backend credentials и Terraform
  deployer identity остаются owner-side.
- Image signing/attestation/SBOM enforcement, paid vulnerability scan,
  lifecycle deletion/retention cleanup; это следующий security plan.
- Изменение `.gitlab-ci.yml`, удаление GitLab CI или browser/UI test ownership.
- Provider upgrade, broad IAM, registry recreation/import, existing tag
  overwrite, image deletion, destroy, force-unlock, commit, push или PR.

## Архитектурный подход

### GitHub verification and privilege boundary

Один workflow содержит verification DAG и privileged publish tail. На
`pull_request`/обычном `push` jobs используют read-only token. Publish job
имеет `needs` на полный parity set, condition для `main`, environment
`production-images`, `permissions: { contents: read, id-token: write }` и
`concurrency` без cancel действующей публикации. Это исключает привилегированный
`workflow_run` переход и не запускает untrusted PR code с cloud identity.

Если до implementation завершится draft
`20260731T003716Z-f423ed-player-ui-browser-a11y-harness`, GitHub parity
принимает его финальные canonical browser jobs как source of truth; текущий
plan не пишет его `.gitlab-ci.yml` paths.

### Exact workload identity

1. До Yandex mutation owner создаёт protected environment
   `production-images` с allowed branch `main`; external change отдельно
   подтверждается.
2. Временный claim-probe job с `id-token: write` запрашивает JWT для exact
   planned audience, декодирует только allowlisted claims и маскирует raw
   value. Job не имеет Yandex trust и push permission.
3. Owner сравнивает observed claim set с expected immutable subject. Любое
   отличие меняет security boundary и требует обновления/re-approval plan.
4. Bootstrap root создаёт `munchkin-github-images`, federation и exact
   federated credential. Production root добавляет pusher binding на registry.
5. WIF smoke обменивает GitHub JWT на short-lived IAM token, делает
   non-destructive registry read/login и немедленно завершает session.

Federation не доверяет wildcard subject, owner/repository name без immutable
IDs, generic branch, произвольный environment или reusable workflow из другого
repository.

### Immutable image pair

- BuildKit строит оба Dockerfile из clean checked-out full SHA.
- Remote preflight убеждается, что `<full-sha>` tags отсутствуют.
- Push создаёт full-SHA tag; workflow считывает remote digest и проверяет
  repository/name/revision labels.
- Final job принимает два verified digests и выпускает non-secret JSON artifact
  `munchkin-images-<full-sha>.json`. Ни tag, ни `latest`, ни artifact сами по
  себе не являются deploy authority: downstream использует `@sha256`.
- Если один push завершился, а второй нет, orphan image остаётся невыбранным;
  автоматическое удаление не выполняется. Повтор требует owner diagnosis,
  потому что перезапись SHA tag запрещена.

### Terraform and mutation gates

- Bootstrap plan содержит только CI SA/federation/federated credential и
  non-secret outputs; authoritative existing IAM graph сначала читается.
- Production plan содержит только SA lookup и exact registry pusher binding;
  runtime puller binding обязан остаться неизменным.
- Для каждого root: fresh short-lived owner credential, locked remote state,
  `terraform plan -detailed-exitcode`, sanitized address/summary review и
  отдельный approval до interactive apply. Saved plan, `-target`,
  `-auto-approve`, `-lock=false`, import/destroy/replacement запрещены.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository-workflow | GitHub parity/publish DAG | Required checks и image-pair artifact |
| terraform-infrastructure | CI SA, WIF, federated credential, registry IAM | Exact subject-to-SA trust без keys |
| backend image | OCI provenance labels | `game:<full-sha>` + digest |
| frontend image | OCI provenance labels | `web:<full-sha>` + digest |
| GitHub environment | Trusted publication boundary | `production-images`, main only |
| Yandex Container Registry | CI pusher access и immutable outputs | Existing runtime puller preserved |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.github/workflows/ci.yml` | write | Parity checks, WIF and image publication |
| `backend/game/Dockerfile` | write | Backend OCI provenance contract |
| `frontend/Dockerfile` | write | Frontend OCI provenance contract |
| `infra/terraform/bootstrap/github_actions.tf` | write | CI SA, federation and credential |
| `infra/terraform/bootstrap/outputs.tf` | write | Non-secret WIF/SA handoff |
| `infra/terraform/environments/production/iam.tf` | write | CI SA lookup |
| `infra/terraform/environments/production/registry.tf` | write | Exact pusher binding |
| `infra/terraform/environments/production/outputs.tf` | write | Registry/CI identity outputs |
| `infra/terraform/README.md` | write | Root/state/credential boundary |
| `scripts/ci/yandex-wif-token.sh` | write | Fail-closed token exchange helper |
| `scripts/terraform-check.sh` | write | WIF/IAM/registry assertions |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | INFRA-001/002 evidence/status |
| `docs/operations/GITHUB_ACTIONS_YANDEX_IMAGES.md` | write | Owner setup, revoke and diagnose runbook |
| `docs/agents/plans/active/20260731T005255Z-b3ea2b-github-actions-yandex-images.md` | write | Active lifecycle этого plan |
| `docs/agents/plans/archive/20260731T005255Z-b3ea2b-github-actions-yandex-images.md` | write | Archived lifecycle этого plan |

### Remote mutation set

| Resource | Режим | Причина |
|---|---|---|
| GitHub environment `production-images` | create/configure | Protected OIDC subject boundary |
| Bootstrap remote state | update | CI SA/federation/federated credential |
| Production remote state | update | Registry pusher binding |
| Yandex CI service account | create, no keys | Ephemeral publish identity |
| Yandex workload federation/credential | create | Exact GitHub OIDC trust |
| Registry IAM | additive exact role binding | Push only to `crpdnmjudj1usiu90gdn` |
| Registry `game`/`web` | append images | First full-SHA images, no deletion |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| Bootstrap/production state | completed foundation + all future infra | Terraform roots | Serialized locked owner applies |
| Registry/runtime puller | foundation and deploy plan | production Terraform | Inventory first; puller unchanged |
| `observability:otel-foundation-v1` | next backend/OTel plan | next plan | Images first, runtime contract later |
| `.gitlab-ci.yml` | UI/browser harness draft | other plan | Read-only parity source |
| GitHub `main` checks | all future workflow plans | this plan first | Later plans extend after dependency |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:59:00 UTC через
  `leinoctl context`, manifests и direct reads.
- **Обнаруженные пересечения:** UI/browser harness draft владеет
  `.gitlab-ci.yml`; multiplayer telemetry draft владеет backend OTel paths.
  Этот plan не пишет эти paths. Все новые infra plans, созданные вместе с ним,
  выстроены dependency chain из-за общих roadmap/Terraform/workflow ресурсов.
- **Решение:** exclusive implementation только после archive completed
  foundation; `.gitlab-ci.yml` read-only. Следующий infra plan зависит от этого
  exact ID. Existing owner changes не stage/revert/overwrite.

## План реализации

1. [x] Повторить `git status`, `leinoctl context`, active-plan conflict scan и
   прочитать актуальные GitLab/Docker/Terraform contracts.
2. [x] Изолированно проверить provider `0.220.0` schemas для WIF resources и
   официальные token-exchange/registry-login contracts; mismatch остановить
   без provider upgrade.
3. [x] Подготовить GitHub parity workflow без OIDC use; pin actions by commit,
   запустить local-equivalent checks и проверить fork/PR permissions.
4. [x] По отдельному owner approval создать/configure GitHub environment и
   выполнить безопасный claim-probe; записать только allowlisted claims.
5. [x] Реализовать Terraform CI SA/federation/credential и registry pusher
   binding с exact immutable subject/assertions.
6. [x] Выполнить local Terraform fmt/init-readonly/validate/tests и показать
   отдельно bootstrap/production plan summaries/addresses. Для каждого apply
   получить отдельный owner approval.
7. [x] После approved applies доказать clean plans, exact live IAM/WIF/registry
   graph и `0` static/API/authorized keys.
8. [x] Добавить fail-closed WIF exchange, masked Docker login, full-SHA
   no-overwrite checks, dual image build/push и digest-pair artifact.
9. [x] Запустить first trusted main publication только по отдельному разрешению;
   проверить remote labels/tags/digests и отсутствие leaked credentials.
10. [x] Обновить runbook/roadmap, выполнить canonical verify/scope-check,
    зафиксировать evidence и перенести тот же plan в archive.

## Проверки

- [x] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs`
- [x] `(cd tools/leinoctl && node --test)`
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl preflight`
- [x] `./scripts/ci-impact.sh`
- [x] `node content/tools/validate.mjs content/sets/demo/cards.json`
- [x] `cd backend/game && go test ./...`
- [x] Real PostgreSQL contract job equivalent
- [x] `cd frontend && pnpm lint`
- [x] `cd frontend && pnpm check`
- [x] `cd frontend && pnpm build`
- [x] `docker compose --parallel 8 -f docker-compose.yml config`
- [x] Local `game`/`web` Docker image build smoke
- [x] `terraform fmt -check` and validation for bootstrap/production roots
- [x] `scripts/terraform-check.sh`
- [x] OIDC claim allowlist/exact-subject test; raw JWT absent from logs
- [x] WIF exchange + masked registry login/read smoke; static-key inventory `0`
- [x] GitHub PR permission test: no environment, OIDC exchange or push
- [x] Full-SHA no-overwrite test and remote digest/OCI-label verification
- [x] Image-pair artifact schema test with two `@sha256` references
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260731T005255Z-b3ea2b-github-actions-yandex-images`
- [x] `git diff --check`, strict UTF-8/text check and focused secret scan

## Риски и откат

- **Риск:** слишком широкий GitHub subject выдаёт cloud identity чужому
  workflow/branch/repository. **Снижение:** immutable owner/repo IDs, exact
  environment subject, observed claims before apply, protected main-only
  environment.
- **Риск:** OIDC/JWT/IAM token попадает в logs. **Снижение:** masked process
  values, no shell tracing, allowlisted decoded claims, negative log scan.
- **Риск:** registry pusher role позволяет destructive operations.
  **Снижение:** exact registry scope, no cleanup code, no-overwrite policy,
  remote inventory and future supply-chain hardening.
- **Риск:** GitHub CI расход/дублирование GitLab jobs.
  **Снижение:** explicit matrix/cache limits, current parity source, measured
  duration before making checks required.
- **Риск:** два image push не атомарны. **Снижение:** deployable pair manifest
  создаётся только после обоих verified digests; partial images не deploy-ятся.
- **Откат repository:** disable workflow, revert GitHub/Docker/helper changes;
  previously published digests remain inert and are not deleted автоматически.
- **Откат trust:** disable/delete federated credential, remove registry pusher
  binding, then remove federation/CI SA only по отдельному destructive approval.

## Открытые вопросы

- Owner должен подтвердить exact plan до implementation.
- GitHub environment creation/protection, claim-probe, два Terraform applies и
  first image publication остаются отдельными mutation gates.
- Required-check policy и сохранение GitLab CI определяются после первого
  green GitHub run; данный plan GitLab CI не удаляет.
- Paid scanner, retention deletion и cryptographic signing решаются в plan
  `20260731T005308Z-3beea1-production-security-and-supply-chain`.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:59:00 UTC
- **Подтверждено:** 2026-07-31 08:55:11 UTC
- **Формулировка/ограничения пользователя:** «Approve plan
  20260731T005255Z-b3ea2b-github-actions-yandex-images». Это разрешает
  implementation только в пределах exact plan scope; commit/push, GitHub
  environment mutation, cloud apply и first image publication остаются
  отдельными owner gates, явно указанными в плане.
  Составить plan для GitHub
  Actions + Yandex Cloud WIF и build/push immutable `game`/`web` images в
  registry `crpdnmjudj1usiu90gdn`; никаких static cloud keys; после plan ждать
  approval. Одновременно разрешено создать остальные infra plans заранее, но
  не выбирать и не реализовывать их.

## Ход выполнения

- Read-only исследование roadmap, current CI/Docker/Terraform contracts,
  completed foundation evidence, active plan manifests, public GitHub metadata
  и актуальных official GitHub/Yandex WIF contracts выполнено.
- Plan approved, claimed/taken over by the current session and selected.
- Repository implementation completed inside the write set: GitHub parity and
  gated publish workflow, fail-closed WIF helper, Docker provenance labels,
  keyless Terraform trust graph, exact registry pusher assertions, runbook and
  roadmap evidence.
- Focused Terraform check passed with provider `0.220.0`; canonical
  `verify --changed`, hooks, leinoctl, plan-lint, preflight, ci-impact, real
  PostgreSQL contract, frontend gates, Compose config and Docker image smoke
  passed; strict text/secret scan, diff review and scope-check also passed.
- GitHub environment `production-images` was configured as protected for
  `main`; the allowlisted OIDC claim probe matched the exact issuer, audience,
  subject, repository IDs and environment without exposing a raw token.
- Bootstrap apply completed with `3 added / 0 changed / 0 destroyed`; outputs
  created CI service account `ajecee5up8ka9j3rk1k6`, federation
  `aje59lfbinrpposh9s9t` and federated credential `ajeco3uphqg05upkvsig`.
  Bootstrap follow-up plan returned `No changes`.
- Production apply completed with `1 added / 0 changed / 0 destroyed` for the
  exact registry-scoped pusher binding; production follow-up plan returned
  `No changes` and preserved the runtime puller.
- First trusted publication succeeded in workflow run `30626403355`, attempt
  `1`, for commit `6b461ebdb3742d2511f908e193417cea1407ef14`. The pair artifact
  contains both full-SHA references, remote digests and digest-pinned images:
  `game@sha256:519ad993f644f30c380f415049f465a8059e23afaa7a0503aeb286624b35e99f`
  and
  `web@sha256:e79531e3dfa1e642b7f8d4f029bde2f5d048382dd0c5aa80c8da271ea03444bb`.
- No `latest` tag, cleanup, tag overwrite or token-bearing artifact was
  reported. The plan's implementation and all remote acceptance gates are
  complete; future deployment consumes only the verified digest pair.

## Итог

Заполняется после реализации.
