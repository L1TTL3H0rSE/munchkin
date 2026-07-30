# ADR-0009: Yandex Cloud production provider and Terraform boundary

- **Статус:** accepted
- **Дата:** 2026-07-30
- **Проверка provider-specific источников:** 2026-07-30

## Контекст

ADR-0007 выбрал portable production topology: одна Linux VPS, Docker Compose,
Traefik, PostgreSQL, OpenTelemetry Collector, immutable OCI images и off-host
S3-compatible backup. Provider, registry, DNS, secrets backend, telemetry
destination и способ воспроизводимого provisioning оставались открытыми.

Владелец проекта решил разместить первый production environment в Yandex
Cloud и использовать Terraform. Проект небольшой: один Nuxt frontend, один Go
backend, PostgreSQL и authenticated SSE. Сейчас нет независимых scaling,
multi-zone SLA или data boundaries, которые оправдывали бы Kubernetes,
message broker, load balancer либо отдельный managed database cluster.

Это решение выбирает deployment provider и infrastructure-as-code boundary,
но не доказывает существование облачных ресурсов. Их создание принадлежит
отдельным implementation plans.

## Решение

### Первый production environment

Стартовый production environment использует:

| Потребность | Yandex Cloud resource | Первый slice |
|---|---|---|
| Linux host | Compute Cloud VM с Ubuntu LTS | да |
| Private network и firewall | Virtual Private Cloud, subnet, security groups | да |
| Stable ingress address | Один static public IPv4 | да |
| Container images | Container Registry | да |
| Terraform state и PostgreSQL backup | Раздельные private Object Storage buckets | да |
| Public records | Cloud DNS public zone и `A` record | да |
| Runtime secret containers | Lockbox | да |
| Encryption keys | Key Management Service для state/backup buckets | да |
| Metrics/traces | Local OpenTelemetry Collector с configurable managed export | staged |
| Application/container logs | Cloud Logging либо выбранный managed sink | staged |
| Transaction database | PostgreSQL на private VM volume | да |

Стартовая схема:

```text
GitHub Actions
  -> short-lived Yandex IAM via Workload Identity Federation
  -> immutable game/web images in Yandex Container Registry
  -> serialized controlled deploy

Browser
  -> registrar delegates zone to Cloud DNS
  -> A record
  -> static public IPv4
  -> Compute VM
       -> Traefik :80/:443
       -> Nuxt web :3000 private
       -> Go game :8080 private
       -> PostgreSQL private
       -> OpenTelemetry Collector private

PostgreSQL pg_dump -> encrypted Object Storage backup bucket
Terraform         -> encrypted Object Storage state bucket
```

На первом этапе не создаются Managed PostgreSQL, Application/Network Load
Balancer, Kubernetes, CDN, Valkey, Kafka, ClickHouse, OpenSearch, API Gateway
или Serverless Containers. Managed PostgreSQL становится отдельным upgrade
только после появления измеренной нагрузки, SLA или recovery требования,
которое нельзя честно закрыть single-VM PostgreSQL.

### Portable application boundary

Provider-specific names остаются в infrastructure/deployment layer. Runtime
сохраняет portable interfaces:

- OCI/Docker images;
- Linux + Docker Compose;
- PostgreSQL protocol и migrations;
- S3-compatible object storage;
- OTLP через локальный OpenTelemetry Collector;
- DNS/HTTPS и обычный HTTP/SSE.

Frontend, backend и content не импортируют Yandex SDK только ради deployment.
Переезд к другому provider потребует заменить Terraform resources/exporters,
но не переписать game engine или public HTTP contracts.

### Terraform boundary

Terraform управляет:

- VPC, subnet, security groups, public IP, VM и disks;
- service accounts и минимальными IAM assignments, кроме secret-bearing
  static backend key;
- Container Registry;
- Object Storage buckets, versioning, encryption и retention policy;
- Cloud DNS zone/records после подтверждения домена;
- Lockbox secret metadata, KMS association и per-secret access;
- telemetry resources, когда их scope согласован.

Terraform не:

- собирает или разворачивает application image;
- выполняет database migration;
- записывает Lockbox payload;
- запускает public smoke или rollback;
- регистрирует домен;
- управляет billing account либо платёжными данными.

Host bootstrap принадлежит versioned cloud-init/host configuration.
Application delivery принадлежит GitHub Actions и fixed host-side deploy
boundary, использует exact image digest/full Git SHA и проходит
readiness/public smoke отдельно от `terraform apply`.

Для первого environment достаточно одного понятного production root. Глубокая
module hierarchy, Terraform workspaces и общий multi-environment framework не
создаются до появления второго реального environment.

### Manual bootstrap boundary

Владелец вручную подготавливает только:

1. Yandex account/organization и active billing account;
2. отдельные cloud и folder для `munchkin-prod`;
3. billing budget с уведомлениями;
4. доступ к domain registrar и выбранный production hostname;
5. локальный `yc` profile и Terraform executable;
6. отдельную passphrase-protected SSH key pair для human bootstrap;
7. подтверждённые права на GitHub repository и Actions.

Default network при создании folder выключается. VM, subnet, security groups,
IP, registry, buckets, KMS keys, service accounts, WIF, Lockbox и Cloud DNS
zone вручную до соответствующего implementation plan не создаются.

Полный owner workflow находится в
[`docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md`](../../operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md).

### Identity and CI

Разделяются как минимум human bootstrap, infrastructure deployer, runtime и
state-backend access. Folder-wide `editor` не становится постоянным runtime
role.

Локальный Terraform provider получает short-lived IAM token через service
account impersonation. GitHub Actions получает short-lived IAM token через
Yandex Workload Identity Federation и минимальный service account. До создания
federated credential implementation plan фиксирует и проверяет фактический
GitHub OIDC `sub` выбранного production job: environment и protected ref дают
разные subject forms и не считаются автоматически объединённым ограничением.
Wildcard/repository-wide binding запрещён. Persistent authorized-key JSON не
хранится в GitHub Secrets.

S3 backend является отдельной authentication boundary. Официальный Yandex
Object Storage Terraform flow использует static S3 access key; найденные
официальные материалы не доказывают, что GitHub WIF token может напрямую
аутентифицировать Terraform S3 backend. До отдельного integration proof
допускается один rotatable static key отдельного state service account:

- доступ только к state bucket/prefix и необходимому KMS key;
- key создаётся только отдельной защищённой owner/bootstrap-процедурой вне
  Terraform; resource с secret value не импортируется и не управляется
  Terraform;
- значение передаётся только runtime environment/защищённым GitHub environment
  secret;
- значение отсутствует в HCL, `.tfvars`, plan files, saved backend config,
  logs и handoff;
- initial delivery в protected environment secret, rotation и revocation
  выполняются без `terraform apply` по отдельному runbook.

### Terraform state

Backend prerequisites получают отдельную короткую bootstrap phase, потому что
main Terraform root не может создать bucket, необходимый уже во время
`terraform init`.

Production state хранится в отдельном Object Storage bucket:

- public access запрещён;
- versioning включён;
- server-side encryption использует отдельный KMS key;
- application VM и runtime service account не имеют доступа;
- lifecycle не удаляет current state или прошлые версии без отдельной
  recovery policy;
- state рассматривается как secret-bearing artifact и никогда не коммитится.

Одновременные production apply запрещены. GitHub workflow использует один
`concurrency` group, protected environment/manual approval и
`cancel-in-progress: false` для apply.

Yandex tutorial с YDB Document API locking не принимается default: его
собственная документация предупреждает о deprecation для Terraform 1.11+.
Terraform S3 `use_lockfile` рассматривается как preferred target, но Yandex
Object Storage является S3-compatible, а не AWS S3. Совместимость обязательно
проверяется concurrent-lock test на отдельном non-production state и pinned
Terraform version. До доказательства сериализация CI и single operator
обязательны; `-lock=false` запрещён.

### Secrets

Terraform создаёт Lockbox container, KMS association и per-secret IAM, но не
создаёт secret version с production payload. Значения database password,
deploy token, API key и прочих secrets вводятся отдельной интерактивной
процедурой и не проходят через HCL, variables, outputs, CLI arguments либо
Terraform state.

Маркер `sensitive` скрывает значение из части CLI output, но не исключает его
из state. Поэтому он не считается достаточной защитой.

Runtime service account получает `lockbox.payloadViewer` только на конкретные
secret resources. Infrastructure deployer не получает payload read без
обоснованной необходимости.

### DNS and TLS

Domain покупается у внешнего registrar. Terraform сначала создаёт Cloud DNS
public zone и records. Только после этого владелец вручную меняет NS у
registrar, сохраняя существующие MX/TXT/CNAME records.

При прямом ingress на VM TLS терминирует Traefik и автоматически управляет
ACME state. Certificate Manager не добавляется только ради VM: он становится
целевым certificate boundary при будущем Application Load Balancer, CDN или
API Gateway.

### Cost and availability

Стартовый environment имеет одну Compute VM и остаётся single point of
failure. Это осознанно: бюджет, воспроизводимость, backup/restore и controlled
rollback важнее имитации HA.

Billing budget отправляет уведомления, но не является hard spending cap.
Перед каждым plan, создающим новый платный класс ресурсов, проверяются
актуальный calculator estimate, budget ceiling, retention и delete path.

## Последствия

- Инфраструктура воспроизводима и reviewable через `terraform plan`.
- Yandex Cloud становится первым provider, но application contracts остаются
  переносимыми.
- GitHub остаётся source/CI surface; перенос repository в Managed GitLab не
  требуется ради размещения runtime в Yandex Cloud.
- Container Registry заменяет GHCR как production image destination.
- Terraform state и S3 backend credential становятся отдельными
  high-sensitivity assets с собственным bootstrap/rotation lifecycle.
- Console drift запрещён после Terraform adoption, кроме documented
  break-glass recovery с последующим import/reconciliation.
- Один host не обещает HA; Managed PostgreSQL/multi-zone platform остаются
  последующим решением.

## Отклонённые альтернативы

- Создать всю инфраструктуру вручную через console и документировать
  screenshots.
- Управлять application deploy, migrations и smoke через Terraform provisioner.
- Хранить local production state в Git или только на одном workstation.
- Передавать production secret payload через Terraform variables.
- Использовать один folder-wide `editor` service account для state, CI,
  runtime и backup.
- Хранить persistent Yandex authorized-key JSON в GitHub Secrets, когда
  доступна Workload Identity Federation.
- Добавить YDB только ради deprecated Document API locking без compatibility
  proof.
- Перенести GitHub repository в Managed GitLab только ради provider purity.
- Начать с Kubernetes, load balancer либо Managed PostgreSQL без измеренной
  scaling/SLA boundary.

## Связанные материалы

- [ADR-0007: Single-VPS production platform](0007-single-vps-production-platform.md)
- [Infrastructure roadmap](../INFRASTRUCTURE_ROADMAP.md)
- [Owner bootstrap runbook](../../operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md)
- [Yandex Cloud: Terraform quickstart](https://yandex.cloud/ru/docs/terraform/quickstart)
- [Yandex Cloud: Terraform provider authentication](https://yandex.cloud/ru/docs/terraform/authentication)
- [Yandex Cloud: Terraform state in Object Storage](https://yandex.cloud/ru/docs/terraform/tutorials/terraform-state-storage)
- [Yandex Cloud: state locking tutorial and compatibility warning](https://yandex.cloud/ru/docs/terraform/tutorials/terraform-state-lock)
- [Yandex Cloud: Workload Identity Federation](https://yandex.cloud/ru/docs/iam/concepts/workload-identity)
- [Yandex Cloud: GitHub WIF integration](https://yandex.cloud/ru/docs/iam/tutorials/wlif-github-integration)
- [Yandex Cloud: Object Storage encryption](https://yandex.cloud/ru/docs/storage/concepts/encryption)
- [HashiCorp: S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [HashiCorp: sensitive data](https://developer.hashicorp.com/terraform/language/manage-sensitive-data)
