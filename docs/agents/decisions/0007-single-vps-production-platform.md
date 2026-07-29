# ADR-0007: Single-VPS production platform and vendor-neutral observability

- **Статус:** accepted
- **Дата:** 2026-07-30

## Контекст

Проект должен получить публичный production deployment для инфраструктурного
конкурса ШРИ 2026. Текущий repository уже использует GitHub как `origin`, но
имеет только GitLab CI и local/dev Compose с PostgreSQL, Go backend и Nuxt
frontend. Registry delivery, reverse proxy, TLS, production secrets,
observability, off-host backup и rollback отсутствуют.

Архитектура остаётся modular monolith: один authoritative game backend, один
frontend и одна PostgreSQL consistency boundary. Добавление Kubernetes,
service mesh или message broker на одну VPS увеличило бы operational surface
без независимого scaling, SLA или data-owner требования.

## Решение

### Deployment boundary

Первой production platform является одна Linux VPS с Docker Engine и Docker
Compose. Traefik — единственный публичный ingress и публикует только `80/443`.
Frontend, backend, PostgreSQL, OpenTelemetry Collector и выбранные telemetry
backends работают во внутренних Docker networks.

Один hostname обслуживает:

- `/` — Nuxt web;
- `/api/v1` — Go game API, включая SSE;
- служебные endpoints не публикуются без отдельной защиты.

PostgreSQL, OTLP, Prometheus, Tempo и container management interfaces никогда
не получают public host ports. Traefik dashboard также не является публичным.

### Supply chain and delivery

GitHub Actions заменяет GitLab CI только после parity существующих policy,
content, Go, PostgreSQL contract, frontend и container checks. Production
images публикуются в GHCR с immutable full commit SHA. `latest` не является
deployment reference, а production images не собираются на VPS.

Production deploy:

1. получает один serialization/concurrency lock;
2. разрешает environment secrets только deployment job;
3. сохраняет предыдущий deployed SHA;
4. загружает exact target images;
5. выполняет отдельный migration step;
6. обновляет Compose services;
7. проходит readiness и public HTTPS smoke;
8. автоматически или оператором возвращается на предыдущий совместимый SHA
   при провале.

Database migration и image rollback проектируются вместе: необратимая migration
не может считаться совместимой с простым image rollback.

### Availability and routing

Backend различает:

- liveness — процесс способен обслужить HTTP;
- readiness — content pack загружен, PostgreSQL доступен и обязательные
  migration prerequisites выполнены.

Существующий graceful shutdown сохраняется. Traefik routing отдельно
проверяется длительным SSE соединением, чтобы proxy timeout или buffering не
ломали version invalidation.

Настоящий domain с `A` record является рекомендуемым production identifier:
он даёт стабильную конкурсную ссылку и прямой Traefik ACME workflow. IP
certificate остаётся fallback, а не основной путь. `AAAA` добавляется только
после доказанного end-to-end IPv6.

### Observability boundary

Application и ingress instrumentation отправляют OTLP в локальный
OpenTelemetry Collector. Приложение не зависит от API конкретного observability
vendor. Collector владеет batching, retry, filtering, sampling и exporter
configuration.

Destination выбирается deployment config:

- self-hosted Prometheus, Tempo и Grafana после измерения ресурсов VPS; либо
- managed OTLP-compatible backend для меньшей operational нагрузки.

Первый обязательный instrumentation scope — Go HTTP/application/PostgreSQL и
Traefik. Nitro server, Card Studio provider spans, logs aggregation и browser
RUM добавляются последующими планами.

Telemetry не содержит bearer credentials, hashes, database URLs, prompts,
request/response bodies, internal game state, hidden cards или personal
display names. Идентификаторы game/player/card/command/request не используются
как metric labels. Metric dimensions ограничены конечными enum: service,
environment, HTTP route/method/status, command type, outcome/error code и
provider.

`service.version`, instance ID, Git SHA и content version допустимы как
trace/log resource metadata, но не автоматически размножаются по всем metric
series. Версия представляется одной build-info metric либо deployment
annotation.

### Data recovery

PostgreSQL named volume является primary local persistence, но не backup.
Production требует scheduled `pg_dump` в custom format, шифрованную off-host
копию в S3-compatible storage, retention, checksum и наблюдаемый restore drill
во временную database.

Backup считается рабочим только после успешного восстановления и проверки
данных. Копия на той же VPS не считается off-host backup.

### Security and operations

VPS использует отдельного deploy user, SSH key authentication, pinned SSH host
key, firewall, security updates и закрытый Docker daemon. Членство в
`docker` group или прямой доступ к Docker socket признаётся root-equivalent, а
не least privilege. Предпочтительная automation boundary — root-owned fixed
deploy script/service с allowlisted arguments и узким `sudo` rule; выбранная
альтернатива документируется явно.

Production secrets хранятся вне Git и не попадают в image, logs, traces или
workflow output. Services получают resource limits, bounded log/telemetry
retention и restart/stop policy.

Card Studio и будущая admin console не становятся публичными в рамках этого
решения. Их auth, storage и audit boundaries принадлежат отдельным планам.

## Последствия

Получается одна понятная end-to-end история:

```text
commit -> CI -> immutable image -> controlled deploy -> HTTPS
       -> readiness/smoke -> telemetry -> backup/restore -> rollback
```

Compose на одной VPS остаётся single point of failure и не обещает high
availability. Это осознанный компромисс для pet project: воспроизводимость,
security, observability и recoverability важнее имитации multi-node platform.

Каждая implementation-фаза получает отдельный согласованный plan. Этот ADR не
доказывает, что GitHub Actions, VPS, Traefik, OpenTelemetry или backups уже
реализованы.

## Отклонённые альтернативы

- Kubernetes, Helm, ArgoCD и service mesh на одной VPS без scaling boundary.
- Сборка production images непосредственно на VPS.
- Deployment по mutable `latest`.
- Прямой vendor SDK вместо OTLP/Collector boundary.
- Публичные PostgreSQL, Collector, Prometheus, Tempo или dashboards.
- Backup только в volume или каталог той же VPS.
- Полная admin/account platform до завершения production delivery path.

## Связанные материалы

- [Infrastructure roadmap](../INFRASTRUCTURE_ROADMAP.md)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
- [GitHub: publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [GitHub: deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [Traefik ACME](https://doc.traefik.io/traefik/https/acme/)
- [Let's Encrypt IP certificates](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability.html)
