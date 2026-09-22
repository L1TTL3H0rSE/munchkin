# PLAN: document yandex cloud terraform bootstrap

- **Plan ID:** `20260730T110202Z-08e477-document-yandex-cloud-terraform-bootstrap`
- **Статус:** completed
- **Создан:** 2026-07-30 11:02:02 UTC
- **Обновлён:** 2026-07-30 11:37:28 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** ADR-0007 и `docs/agents/INFRASTRUCTURE_ROADMAP.md`
- **Блокирует:** первый Yandex Cloud/Terraform implementation plan
- **Связанные ADR/handoff:** ADR-0007; proposed ADR-0009

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "README.md",
    "docs/agents/README.md",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/agents/decisions/README.md",
    "docs/agents/decisions/0007-single-vps-production-platform.md",
    "docs/agents/decisions/0009-yandex-cloud-terraform-production.md",
    "docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md",
    "docs/agents/plans/active/20260730T110202Z-08e477-document-yandex-cloud-terraform-bootstrap.md",
    "docs/agents/plans/archive/20260730T110202Z-08e477-document-yandex-cloud-terraform-bootstrap.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [],
  "dependsOn": [],
  "sharedResources": [
    "production-platform:provider-selection",
    "production-platform:roadmap-v1",
    "docs:decision-index",
    "operations:yandex-cloud-bootstrap"
  ]
}
```

## Цель

До создания платных ресурсов зафиксировать Yandex Cloud как первый production
provider, Terraform как boundary управления облачной инфраструктурой и
подготовить для владельца проекта полную русскоязычную инструкцию: какие
аккаунты, решения, локальные инструменты, не-секретные идентификаторы и
security prerequisites нужно подготовить, чтобы следующий согласованный plan
мог начать реализацию инфраструктуры без ручного угадывания и преждевременного
создания VM, сети или базы данных.

## Критерии приёмки

- [x] ADR-0009 явно выбирает Yandex Cloud для первого production environment:
  Compute Cloud, VPC/security groups/static IPv4, Container Registry, Object
  Storage, Cloud DNS, Lockbox и managed telemetry; PostgreSQL на одной VM
  остаётся стартовым default, Managed PostgreSQL — отдельным upgrade.
- [x] ADR-0009 выбирает Terraform для cloud resources, но отделяет его от
  application delivery: Terraform создаёт infrastructure/IAM, cloud-init
  готовит host, GitHub Actions публикует immutable images и controlled deploy
  обновляет production Compose.
- [x] ADR-0007 и roadmap больше не требуют GHCR как production registry:
  generic boundary остаётся OCI-compatible, а provider-specific default
  становится Yandex Container Registry без изменения GitHub remote.
- [x] Решение сохраняет vendor-neutral application boundaries: Docker/OCI,
  PostgreSQL, S3-compatible backup и OTLP; отказ от Yandex Cloud не требует
  переписывать game/frontend code.
- [x] Runbook содержит пошаговую подготовку Yandex account, billing/cloud/folder,
  budget guardrails, zone, domain, SSH public key, GitHub repository/environment
  и локальных `yc`/Terraform/Git инструментов на Windows/PowerShell.
- [x] Runbook разделяет обязательные ручные bootstrap-действия и ресурсы,
  которые пользователь не должен создавать в консоли до Terraform apply.
- [x] Runbook содержит copy-ready безопасные команды для проверки `yc`,
  Terraform, Git и SSH public key, но не просит вставлять в Git, issue, plan,
  chat или terminal output OAuth/IAM tokens, static access keys, private SSH
  keys, passwords, Lockbox payload или `.tfstate`.
- [x] Runbook задаёт форму handoff с минимальным набором несекретных входов:
  cloud/folder IDs, выбранная zone, production hostname/domain, месячный
  budget ceiling, GitHub repository и подтверждение стартового database
  profile.
- [x] Remote state bootstrap описан без ложной безопасности: первоначальный
  bootstrap, private/versioned Object Storage state bucket, чувствительность
  state, serialized one-writer apply и отдельная ограниченная backend
  credential strategy; deprecated YDB Document API locking не выдаётся за
  долгосрочный default.
- [x] Provider/CI authentication использует short-lived IAM через Workload
  Identity Federation там, где это поддерживается; возможный S3 backend static
  key имеет отдельный минимальный scope, не попадает в Terraform source/state
  и получает rotation/revocation procedure.
- [x] Runbook содержит Definition of Ready, cost/security stop conditions,
  официальный source list и следующий plan boundary; ни один cloud, billing,
  DNS, GitHub или secret resource этим docs-only plan не создаётся и не
  изменяется.

## Контекст и подтверждённое состояние

- Worktree `main` чист и совпадает с `origin/main`; active plans отсутствуют.
- Runtime состоит из Nuxt frontend, Go backend и PostgreSQL; dev Compose
  публикует `3000`, `8080`, `5432`, production topology ещё не существует.
- ADR-0007 принимает single-VPS Docker Compose + Traefik platform, GitHub
  Actions, immutable images, OTLP Collector и off-host S3 backup, но оставляет
  provider открытым и сейчас называет GHCR.
- Infrastructure roadmap оставляет VPS provider/region, domain, telemetry sink
  и backup provider открытыми; Kubernetes и Managed PostgreSQL отложены до
  появления реальной scaling/SLA boundary.
- Пользователь выбрал полный runtime в Yandex Cloud и согласился использовать
  Terraform; рекомендован lean start без Kubernetes, load balancer, CDN,
  BareMetal, Valkey/Kafka/ClickHouse и Managed PostgreSQL.
- Актуальная документация Yandex Cloud подтверждает Terraform provider,
  Object Storage S3 backend, Workload Identity Federation, VM access к
  Lockbox, Container Registry, private VPC connectivity и OTel/managed
  telemetry integrations.
- Официальный Yandex state-lock tutorial всё ещё предлагает YDB Document API,
  но предупреждает о deprecation этого механизма в Terraform 1.11+; поэтому
  runbook не должен добавлять YDB только ради locking без отдельной проверки
  pinned Terraform/backend compatibility.

## Scope

### Входит

- Новый ADR-0009 с provider/IaC/state/secrets/CI boundary и отклонёнными
  альтернативами.
- Provider-specific уточнения ADR-0007 и infrastructure roadmap.
- Полный human runbook `docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md`.
- Навигационные ссылки из root README, agent README и ADR index.
- Official Yandex Cloud/HashiCorp source links и дата проверки изменяемых
  provider-specific фактов.

### Не входит

- `infra/`, `.tf`, `.tfvars`, `.terraform.lock.hcl`, cloud-init, Ansible,
  production Compose, CI workflow и deploy scripts.
- Создание или изменение cloud, folder, billing account, service account,
  federation, IAM binding, VM, disk, IP, network, DNS, domain, bucket,
  registry, Lockbox, KMS, monitoring или database.
- Создание GitHub environment/secrets/settings либо передача credentials.
- Выбор Managed PostgreSQL, ALB, Kubernetes, CDN или multi-zone HA.
- Runtime/backend/frontend/content/schema/API изменения.
- Commit, push и release без отдельного разрешения пользователя.

## Архитектурный подход

- Наслоить provider-specific ADR-0009 на topology ADR-0007, не смешивая
  portable application architecture с Yandex resource names.
- Выбрать минимальный старт:
  `Cloud DNS -> static IPv4 -> Compute VM -> Traefik/web/game/PostgreSQL`,
  Container Registry для images, Object Storage для backup/state, Lockbox для
  runtime secrets и local OTel Collector -> managed telemetry.
- Управлять cloud graph через один понятный Terraform root для production;
  не строить преждевременно глубокую module/workspace hierarchy.
- Сохранить отдельные lifecycle:
  `terraform plan/apply` для infrastructure и SHA-pinned deployment для
  application; Terraform не выполняет database migrations или public smoke.
- Bootstrap state выполнить как явную короткую фазу, после которой state
  хранится в отдельном private/versioned bucket. Одновременные apply запрещены
  до доказанного supported locking; GitHub concurrency остаётся обязательной.
- Terraform создаёт Lockbox containers и IAM, но secret payload не проходит
  через HCL/variables/outputs/state. Все чувствительные значения вводятся
  отдельным документированным channel и никогда не печатаются в handoff.
- Runbook заканчивается машинно проверяемой Definition of Ready и точным
  handoff-шаблоном, после которого можно создавать первый implementation plan.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository-workflow | ADR, roadmap, runbook и navigation | Runtime contracts unchanged |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `README.md` | write | Добавить ссылку на production bootstrap runbook |
| `docs/agents/README.md` | write | Добавить provider/runbook navigation |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | Закрыть provider/IaC defaults и уточнить plan sequence |
| `docs/agents/decisions/README.md` | write | Зарегистрировать ADR-0009 |
| `docs/agents/decisions/0007-single-vps-production-platform.md` | write | Сделать registry boundary OCI-generic и сослаться на provider ADR |
| `docs/agents/decisions/0009-yandex-cloud-terraform-production.md` | write | Зафиксировать Yandex Cloud/Terraform решение |
| `docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md` | write | Полная инструкция владельцу проекта |
| `docs/agents/plans/active/20260730T110202Z-08e477-document-yandex-cloud-terraform-bootstrap.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260730T110202Z-08e477-document-yandex-cloud-terraform-bootstrap.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `production-platform:provider-selection` | Нет active plans | этот plan | Exclusive decision |
| `production-platform:roadmap-v1` | Нет active plans | этот plan | Update provider defaults only |
| `docs:decision-index` | Нет active plans | этот plan | Sequential ADR registration |
| `operations:yandex-cloud-bootstrap` | Нет active plans | этот plan | One canonical runbook |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 11:02:02 UTC
- **Обнаруженные пересечения:** active plans отсутствуют; worktree clean.
- **Решение:** plan остаётся exclusive, поскольку меняет принятый production
  roadmap, decision index и provider default.

## План реализации

1. [x] Создать ADR-0009 с Yandex Cloud service map, Terraform/application
   boundary, state/auth/secrets policy, portability и rejected alternatives.
2. [x] Уточнить ADR-0007: OCI registry вместо GHCR-specific invariant и ссылка
   на provider-specific ADR-0009.
3. [x] Обновить infrastructure roadmap: Yandex Cloud/Terraform defaults,
   Container Registry delivery и отдельные implementation slices.
4. [x] Создать полный Windows/PowerShell bootstrap runbook с prerequisites,
   ручными действиями, безопасными проверками, запретами, Definition of Ready,
   handoff template и официальными ссылками.
5. [x] Добавить runbook/ADR в root, agent и decision navigation.
6. [x] Выполнить adversarial docs/security review: secret leakage, destructive
   Terraform paths, bootstrap/state circularity, stale provider claims,
   accidental paid-resource instructions и противоречия ADR-0007.
7. [x] Выполнить canonical checks, scope-check и lifecycle archive.

## Проверки

- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed` на repository Node 24 toolchain.
- [x] `./leinoctl scope-check --plan 20260730T110202Z-08e477-document-yandex-cloud-terraform-bootstrap`.
- [x] `git diff --check` и финальный read-only diff/navigation/link review.
- [x] Ручная acceptance mapping для каждого шага Definition of Ready и
  подтверждение, что runbook не содержит secret values или утверждений о
  реально созданных cloud resources.

## Риски и откат

- **Риск:** runbook заставит пользователя вручную создать ресурсы, которые
  затем должен импортировать Terraform.
  **Снижение:** явный список «создать вручную» и отдельный список «не создавать
  до implementation apply».
- **Риск:** static backend credential или secret payload попадёт в Git/state.
  **Снижение:** least-privilege backend identity, out-of-band payload,
  redaction checklist и запрет секретных Terraform variables/outputs.
- **Риск:** provider-specific ADR разрушит portable application boundary.
  **Снижение:** Docker/OCI, PostgreSQL, S3 и OTLP остаются архитектурными
  интерфейсами; Yandex resource names ограничены deployment layer.
- **Риск:** инструкция устареет вместе с зонами, тарифами, provider/backend
  поведением.
  **Снижение:** official links, checked-on date, команды discovery вместо
  жёстких ID и обязательная повторная проверка перед apply.
- **Риск:** `terraform destroy` или replacement затронет state/data.
  **Снижение:** runbook запрещает blind apply/destroy; будущий plan обязан
  включить plan review, backup и `prevent_destroy`/retention decisions.
- **Откат:** revert docs/ADR/navigation update; внешних ресурсов и
  credentials этот plan не создаёт.

## Открытые вопросы

- Блокирующих вопросов для docs plan нет. Runbook попросит пользователя
  подтвердить перед implementation: budget ceiling, доступную zone,
  production domain/hostname и возможность управлять GitHub repository.
- Консервативные defaults: одна VM, local PostgreSQL, один production
  environment, Yandex Container Registry, Object Storage, Cloud DNS, Lockbox,
  managed telemetry, GitHub Actions, manual approval перед production apply.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-30 11:02:02 UTC
- **Подтверждено:** 2026-07-30 11:16:29 UTC
- **Формулировка/ограничения пользователя:** «Хорошо. Давай это как-то
  закрепим и ты напишешь полную инструкцию для меня, что мне сделать, чтобы мы
  могли начать реализацию нашей инфры». Точное согласование:
  «Согласовываю
  20260730T110202Z-08e477-document-yandex-cloud-terraform-bootstrap».

## Ход выполнения

- Выполнена read-only проверка current ADR/roadmap, repository navigation,
  active plans и чистоты worktree.
- Сверены актуальные официальные Yandex Cloud материалы по Terraform provider,
  Object Storage state, Workload Identity Federation, state locking,
  Compute/VPC, Container Registry, DNS, Lockbox и managed telemetry.
- Draft создан и полностью заполнен; ADR/runbook реализация не начата до
  явного approval точного plan ID.
- Пользователь явно согласовал точный plan ID в 2026-07-30 11:16:29 UTC.
- Plan выбран этой session через `leinoctl plan select` в
  2026-07-30 11:16:54 UTC; начата docs-only реализация.
- Созданы ADR-0009 и owner bootstrap runbook; ADR-0007, infrastructure
  roadmap и три navigation entry обновлены в пределах write set.
- Независимый security review обнаружил и помог устранить две неоднозначности:
  S3 backend static key теперь явно создаётся вне Terraform и никогда не
  импортируется в state, а GitHub WIF trust привязывается к фактическому exact
  OIDC `sub` без wildcard/repository-wide binding.
- Независимый usability review подтвердил, что handoff содержит actual
  однострочный SSH public key вместе с path/fingerprint, а optional domain не
  блокирует core Terraform slice и остаётся gate для последующего DNS/TLS.
- `plan-lint`, `text-check --changed`, local Markdown link review,
  `git diff --check` и canonical `leinoctl verify --changed` на Node 24
  прошли; hook tests: 42/42, leinoctl tests: 63 passed, 1
  platform-dependent symlink test skipped, failures: 0.
- Базовый `leinoctl preflight` прошёл с ожидаемым dirty-worktree warning.
  Строгий `preflight --require-toolchain` не является зелёным доказательством:
  системный Go 1.24 ниже repository minimum 1.25.1, pnpm version в preflight
  не распознана и Docker Compose capability в текущей среде недоступна.
  Docs-only canonical verify использовал объявленные Node 24, pnpm 11.9.0 и
  Git Bash 5.2.37; Docker services не запускались.
- Финальный независимый review обнаружил telemetry wording conflict между
  ADR-0007/ADR-0009, неполную проверку SSH keypair и невоспроизводимый
  денежный baseline. ADR теперь различает self-hosted и managed telemetry,
  SSH guard проверяет private и `.pub`, а budget требует датированный
  calculator estimate с exact assumptions в runbook, Definition of Ready и
  handoff. Повторный review подтвердил устранение всех трёх findings.
- `scope-check` подтвердил отсутствие путей вне write set; план переведён в
  `completed` и перенесён в archive.

## Итог

- Yandex Cloud выбран первым production provider, а Terraform — boundary для
  cloud resources/IAM/state без смешивания с application delivery.
- Создан полный owner runbook: manual prerequisites, запрет преждевременного
  создания Terraform-owned ресурсов, безопасные PowerShell checks,
  state/WIF/secrets policy, Definition of Ready и copy-ready handoff.
- ADR-0007 и infrastructure roadmap сохраняют portable OCI/PostgreSQL/S3/OTLP
  contracts, но задают Yandex Container Registry, Compute VM, Object Storage,
  Cloud DNS, Lockbox и managed telemetry как первый provider default.
- Ни один cloud, billing, DNS, GitHub, secret или paid resource этим plan не
  создан и не изменён. Runtime, dependencies и deployment code не менялись.
- До archive прошли plan-lint, text-check, Markdown link review,
  `git diff --check`, canonical Node 24 verify и scope-check; финальные checks
  повторяются на archived lifecycle path.
