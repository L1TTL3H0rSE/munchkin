# PLAN: record contest infrastructure roadmap

- **Plan ID:** `20260729T230648Z-127dc2-record-contest-infrastructure-roadmap`
- **Статус:** completed
- **Создан:** 2026-07-29 23:06:48 UTC
- **Обновлён:** 2026-07-29 23:29:01 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** нет
- **Блокирует:** implementation plans конкурсного production deployment
- **Связанные ADR/handoff:** ADR-0001, ADR-0002, ADR-0005, proposed ADR-0007;
  draft plans `20260729T224707Z-7f21dd-record-card-art-object-storage` и
  `20260729T225611Z-bbcbc3-record-future-admin-control-plane`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/README.md",
    "docs/agents/INFRASTRUCTURE_ROADMAP.md",
    "docs/agents/decisions/README.md",
    "docs/agents/decisions/0007-single-vps-production-platform.md",
    "docs/agents/plans/active/20260729T230648Z-127dc2-record-contest-infrastructure-roadmap.md",
    "docs/agents/plans/archive/20260729T230648Z-127dc2-record-contest-infrastructure-roadmap.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [],
  "dependsOn": [],
  "sharedResources": [
    "production-platform:roadmap-v1",
    "docs:decision-index"
  ]
}
```

## Цель

Зафиксировать до реализации целевую production-инфраструктуру и
приоритизированный backlog для конкурсного деплоя pet project к
2026-08-02 23:59 Europe/Moscow. Связать GitHub Actions/GHCR, single-VPS
Docker Compose, Traefik, HTTPS/DNS, OpenTelemetry, backup/restore, security,
rollback и демонстрационный сценарий в одну проверяемую delivery story, не
выдавая roadmap за уже работающую инфраструктуру.

## Критерии приёмки

- [x] ADR фиксирует single-VPS production platform: Docker Compose остаётся
  deploy boundary, Traefik является единственным публичным ingress, а `web`,
  `game`, PostgreSQL и telemetry services работают во внутренних сетях.
- [x] Roadmap разделён на submission-critical P0-A, конкурсный P0-B, сильные
  бонусы и post-deadline задачи; каждый пункт имеет наблюдаемый результат или
  демонстрационную проверку.
- [x] GitHub migration описана по фактическому состоянию: remote уже GitHub,
  мигрировать нужно CI из GitLab в GitHub Actions, публикацию immutable images
  в GHCR и controlled deployment.
- [x] Production delivery включает SHA-pinned images, environment secrets,
  один concurrent deploy, readiness/smoke gate, сохранение предыдущей версии
  и документированный rollback.
- [x] Traefik boundary включает `80/443`, HTTP-to-HTTPS, ACME state persistence,
  same-origin `/` и `/api/v1`, private dashboard и отдельную проверку SSE.
- [x] OpenTelemetry использует vendor-neutral OTLP boundary через Collector;
  destination выбирается config, а local/self-hosted и managed варианты
  сравнены по ресурсам и надёжности.
- [x] Observability backlog включает structured logs, traces, RED/DB/domain
  metrics, dashboards, alerts, retention и privacy/cardinality ограничения.
- [x] Persistence backlog включает off-host encrypted PostgreSQL backup,
  retention, restore drill и переход от application auto-migrate к отдельному
  migration job.
- [x] VPS/security backlog включает reproducible bootstrap, deploy user,
  SSH-key-only, firewall, security updates, secret handling, resource/log
  limits и отсутствие публичных DB/telemetry ports.
- [x] Roadmap содержит выбор domain/DNS и отмечает, что domain рекомендован для
  понятной конкурсной ссылки, хотя Let’s Encrypt IP certificates доступны в
  2026 году и не делают домен технически обязательным.
- [x] Документы связывают отдельные будущие направления admin console и S3
  card assets, но не расширяют их draft plans и не ставят их перед Sunday MVP.
- [x] Ни runtime code, CI, Compose, deployment, cloud resource, DNS, account,
  secret или внешний сервис этим plan не меняются.

## Контекст и подтверждённое состояние

- `origin` и `origin/main` уже указывают на GitHub; текущий commit
  `1627a6f` совпадает с `origin/main`. GitHub Actions workflows отсутствуют.
- `.gitlab-ci.yml` уже проверяет harness, content, Go, PostgreSQL contract,
  frontend и Compose/build, но не публикует images и не выполняет deployment.
- Один dev `docker-compose.yml` поднимает PostgreSQL, `game` и `web`, публикуя
  наружу `5432`, `8080` и `3000`; production override/topology отсутствует.
- Backend и frontend images multi-stage и запускаются non-root, что является
  хорошей базой для registry deployment.
- Единственный `/healthz` подтверждает жизнь HTTP процесса, но не готовность
  PostgreSQL/content; graceful shutdown backend уже ограничен 10 секундами.
- Backend стартует с `AUTO_MIGRATE=true` и одним SQL-файлом без versioned
  migration table/tool. PostgreSQL хранится только в local named volume;
  backup/restore и off-host copy отсутствуют.
- Card Studio staging по умолчанию находится в `.card-studio`; production
  Compose не даёт ему persistent storage. Studio должен остаться выключенным
  до отдельной secure admin/storage реализации.
- Traefik, TLS/ACME, production DNS, IaC/bootstrap, OTel SDK/Collector,
  Prometheus/Tempo/Grafana/Loki, structured logging, alerting и uptime checks
  в repository пока отсутствуют.
- Realtime реализован как authenticated SSE; proxy path обязан сохранять
  streaming и пройти отдельный long-lived connection smoke.
- Пользователь строит проект для инфраструктурного конкурса ШРИ 2026, где
  оцениваются подходы, сложность deployment и архитектура; submission deadline
  — воскресенье 2026-08-02 23:59.

## Scope

### Входит

- ADR-0007 о production deployment/observability boundary.
- Один долговечный infrastructure roadmap с target diagram, приоритетами,
  sequencing, acceptance/demo checks, рисками и открытыми выборами.
- Ссылки на roadmap из agent navigation и новый ADR из decision index.
- Current-state inventory, чтобы будущие планы не считали отсутствующие
  capabilities уже реализованными.

### Не входит

- GitHub Actions, GHCR package, repository settings или GitLab CI removal.
- VPS purchase/provisioning, SSH access, firewall, DNS records и domain order.
- Production Compose/Traefik/ACME, container registry или actual deployment.
- OTel dependencies/instrumentation/collector/backend/dashboard/alerts.
- Database migration changes, backup jobs, S3 buckets и restore.
- Application/admin/content functionality.
- Commit, push, PR и contest submission.

## Архитектурный подход

- Сохранить coherent modular monolith и deploy его на одну VPS через Compose;
  не добавлять Kubernetes, service mesh или message broker без реальной
  deployment/data boundary.
- Использовать delivery chain:
  `GitHub Actions -> GHCR immutable SHA -> production Compose -> health/smoke
  gate -> rollback`.
- Открыть наружу только Traefik `80/443`; обслуживать UI и API на одном
  hostname, держать PostgreSQL, OTLP, Prometheus и Tempo private.
- Использовать OpenTelemetry SDK -> local Collector как стабильную boundary.
  Collector выполняет batch/retry/filter и экспортирует в self-hosted
  Prometheus/Tempo/Grafana либо managed OTLP destination без изменения
  приложений.
- Для Sunday MVP сначала инструментировать Go backend и ingress; Nitro server
  и browser/RUM tracing оставить следующим этапом.
- Считать recoverability частью deployment: off-host backup не завершён, пока
  не выполнен и не задокументирован restore drill.
- Считать security и operability частью demo: least privilege, no secrets in
  Git/logs/traces, bounded telemetry retention, dashboards, alerts, runbooks и
  visible deployed Git SHA.
- Рекомендовать настоящий domain для удобного URL/DNS/ACME demo. Вариант с
  IP certificate оставить fallback только после проверки поддержки выбранным
  ACME client/Traefik workflow.
- Приоритизировать полную цепочку commit-to-recovery выше количества
  инфраструктурных продуктов.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository-workflow | ADR, roadmap и agent navigation | Runtime contracts unchanged |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/README.md` | write | Добавить infrastructure roadmap в navigation |
| `docs/agents/INFRASTRUCTURE_ROADMAP.md` | write | Зафиксировать staged backlog и demo checks |
| `docs/agents/decisions/README.md` | write | Добавить ADR-0007 в index |
| `docs/agents/decisions/0007-single-vps-production-platform.md` | write | Зафиксировать target deployment boundary |
| `docs/agents/plans/active/20260729T230648Z-127dc2-record-contest-infrastructure-roadmap.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260729T230648Z-127dc2-record-contest-infrastructure-roadmap.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `production-platform:roadmap-v1` | Нет | этот plan | Exclusive docs update |
| `docs:decision-index` | future admin plan | этот plan при выборе | Plans выполнять последовательно |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 02:18 MSK через `leinoctl context`.
- **Обнаруженные пересечения:** admin draft также планирует изменить
  `docs/agents/decisions/README.md`; S3 draft затрагивает ADR-0005. Runtime и
  остальные write sets не пересекаются.
- **Решение:** выбирать планы последовательно. Этот roadmap только связывает
  будущие направления; не меняет их scope и не зависит от их реализации.

## План реализации

1. [x] Создать ADR-0007 с target topology, delivery, observability,
   recoverability и security boundaries.
2. [x] Создать `INFRASTRUCTURE_ROADMAP.md` с current inventory и Sunday MVP.
3. [x] Добавить strong-bonus и post-deadline backlog с demo/acceptance checks.
4. [x] Зафиксировать open decisions: VPS budget/size/provider, domain,
   telemetry backend, backup bucket и alert channel.
5. [x] Обновить agent navigation и ADR index.
6. [x] Выполнить canonical checks, scope-check и архивировать plan.

## Проверки

- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed` на repository Node 24 toolchain.
- [x] `./leinoctl scope-check --plan 20260729T230648Z-127dc2-record-contest-infrastructure-roadmap`.
- [x] `git diff --check` и финальный read-only diff review.

## Риски и откат

- **Риск:** roadmap превратится в wishlist, который невозможно закончить к
  дедлайну.
  **Снижение:** три уровня приоритета, явные stop conditions и end-to-end demo
  как критерий Sunday MVP.
- **Риск:** документация предрешит платного vendor до понимания бюджета/VPS.
  **Снижение:** OTLP/S3-compatible boundaries и отдельные open decisions.
- **Риск:** дополнительные dashboards/services сделают одну VPS нестабильной.
  **Снижение:** self-hosted LGTM только после resource measurement; managed
  telemetry fallback для небольшой VPS.
- **Риск:** TLS, telemetry или logs раскроют secrets/private game state.
  **Снижение:** private networks, least privilege и явный telemetry denylist.
- **Риск:** ADR-0007 появится раньше зарезервированного admin ADR-0006.
  **Снижение:** номер 0006 уже закреплён согласуемым admin draft; gap в index
  временный и будет заполнен только после отдельного approval.
- **Откат:** удалить roadmap/ADR и navigation/index строки обычным revert.

## Открытые вопросы

- Максимальный бюджет и выбранный VPS provider/region; нужен ли managed
  firewall/object storage.
- Размер VPS. Предварительная граница: self-hosted Grafana/Prometheus/Tempo
  требует измерения и заметно больше RAM, чем Collector -> managed backend.
- Настоящий domain либо временный IP/fallback DNS; registrar/DNS provider.
- Telemetry sink: self-hosted Tempo/Prometheus/Grafana или managed OTLP.
- Backup S3 provider, шифрование, retention и alert channel.
- GitHub repository visibility и доступность environment protection rules.
- Нужен ли полностью автоматический deploy на `main` или manual production
  approval до дедлайна.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-29 23:06:48 UTC
- **Подтверждено:** 2026-07-29 23:14:14 UTC
- **Формулировка/ограничения пользователя:** добавить OpenTelemetry traces и
  metrics без преждевременного выбора destination, использовать Traefik для
  deployment, перенести CI с GitLab на GitHub, арендовать VPS, решить
  DNS/domain и заранее записать максимально сильную инфраструктуру для
  конкурса ШРИ 2026. Точное подтверждение:
  «утверждаю 20260729T230648Z-127dc2-record-contest-infrastructure-roadmap».

## Ход выполнения

- Выполнена read-only инвентаризация Git/CI, Compose/images, health/migrations,
  persistence, SSE, logging/telemetry и current deployment gaps.
- Сверены актуальные официальные границы OpenTelemetry Collector, GitHub
  Actions environments/GHCR, Traefik ACME и Let’s Encrypt IP certificates.
- Получено точное пользовательское согласование plan ID; ADR/roadmap и runtime
  реализация ещё не начаты.
- Plan выбран этой session через `leinoctl plan select` в
  2026-07-29 23:14:46 UTC; начата docs-only реализация.
- Созданы ADR-0007 и подробный roadmap с target topology, двенадцатью
  work items, P0-A freeze gate, P0-B differentiators, bonus/post-deadline
  очередями, open decisions и пятиминутным demo.
- Adversarial review обнаружил и помог устранить пять рисков: несовместимый
  head/tail sampling, неявный root-equivalent Docker access, Grafana-specific
  DoD, растущие metric version labels и отсутствие submission-safe freeze
  gate. Повторный review завершён без findings.
- Canonical verify прошёл на Node 24.14.0, pnpm 11.9.0 и Bash 5.2:
  42/42 hooks tests, 63/63 исполнимых leinoctl tests; один
  platform-dependent symlink test штатно пропущен.
- Text-check, plan-lint, `git diff --check` и scope-check прошли;
  `outsideWriteSet: []`.

## Итог

Docs-only задача завершена:

- ADR-0007 зафиксировал single-VPS Compose/Traefik boundary, immutable
  GitHub/GHCR delivery, vendor-neutral OTel Collector, off-host recovery и
  честную root-equivalent Docker privilege model;
- `INFRASTRUCTURE_ROADMAP.md` отделяет stable public submission от конкурсных
  differentiators и последующего overengineering, содержит Definition of Done
  для GitHub Actions, GHCR, VPS, DNS/TLS, health/migrations, CD/rollback,
  OTel/dashboard, backup/restore, security и demo;
- agent navigation и ADR index обновлены;
- runtime code, CI, Compose, cloud/DNS и внешние системы не менялись.
