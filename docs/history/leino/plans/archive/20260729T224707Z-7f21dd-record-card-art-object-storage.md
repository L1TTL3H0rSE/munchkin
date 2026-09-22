# PLAN: record card art object storage

- **Plan ID:** `20260729T224707Z-7f21dd-record-card-art-object-storage`
- **Статус:** completed
- **Создан:** 2026-07-29 22:47:07 UTC
- **Обновлён:** 2026-07-30 00:48:00 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260729T161635Z-c08a8a-moscow-card-art-studio`, `20260729T230648Z-127dc2-record-contest-infrastructure-roadmap`.
- **Блокирует:** plan
  `20260729T225611Z-bbcbc3-record-future-admin-control-plane`.
- **Связанные ADR/handoff:** ADR-0005, ADR-0007,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/decisions/0005-original-card-art-studio.md",
    "docs/agents/plans/active/20260729T224707Z-7f21dd-record-card-art-object-storage.md",
    "docs/agents/plans/archive/20260729T224707Z-7f21dd-record-card-art-object-storage.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [],
  "dependsOn": [
    "20260729T161635Z-c08a8a-moscow-card-art-studio",
    "20260729T230648Z-127dc2-record-contest-infrastructure-roadmap"
  ],
  "sharedResources": [
    "card-studio:storage-direction-v1"
  ]
}
```

## Цель

Зафиксировать в ADR-0005 будущую P2 production storage boundary для Card
Studio и admin asset workflow: текущий local filesystem остаётся local/dev
authoring реализацией, а перед включением shared production workflow бинарные
illustration candidates и published assets должны быть вынесены в
S3-compatible object storage. Отделить этот data plane от P0-B off-host
PostgreSQL backups из ADR-0007 и не выдавать направление за уже реализованную
инфраструктуру или условие первого single-VPS deployment игры.

## Критерии приёмки

- [x] ADR явно разделяет текущий local/dev storage и будущий shared production
  object storage и относит последний к P2 после конкурсного P0-A/P0-B.
- [x] Будущее направление называет S3-compatible storage для binary candidates
  и published illustrations, сохраняя требования immutable content version,
  digest и provenance.
- [x] Illustration assets и PostgreSQL backups определены как разные data
  classes: по умолчанию используются отдельные buckets и IAM credentials, а
  namespace, retention/lifecycle, encryption и recovery policy не
  переиспользуются неявно.
- [x] Candidates остаются private и выдаются только через backend-authorized
  temporary signed access; опубликованные immutable illustrations могут
  получить digest-addressed cache/CDN policy без открытия Card Studio.
- [x] Текст оставляет конкретного vendor, exact key layout, signed URL TTL,
  lifecycle values, CDN provider, migration и failure-recovery mechanics
  будущему implementation plan/ADR.
- [x] Ни production code, ни config/schema/infra, ни текущий Card Studio
  contract и local workflow не меняются.

## Контекст и подтверждённое состояние

- Card Studio сейчас пишет jobs/candidates в ignored `.card-studio/`, а approve
  атомарно добавляет `assets/<card-id>.webp` в versioned content pack.
- ADR-0005 прямо относит cloud queue/storage к текущим non-goals, но не
  фиксирует желаемую production boundary.
- ADR-0007 требует отдельную off-host S3-compatible копию PostgreSQL и прямо
  запрещает публиковать Card Studio/admin в рамках первого production
  deployment.
- Infrastructure roadmap относит backup/restore к P0-B, а production Card
  Studio asset storage/CDN — к P2 после конкурса.
- Пользователь подтвердил, что это направление нужно сохранить на будущее.
- Предыдущие Card Studio и infrastructure-roadmap plans завершены,
  архивированы и находятся в `main`; отдельный frontend-spec draft не
  пересекается с этим write set и остаётся нетронутым.

## Scope

### Входит

- Один короткий раздел `Future production storage` в ADR-0005.
- Явная маркировка направления как будущего P2, не реализованного состояния.
- Ссылка на ADR-0007 и граница между asset storage и database backup storage.

### Не входит

- Реализация S3 client, provisioning buckets/IAM/credentials и exact
  presigned URL/CDN configuration.
- Изменение storage adapter, API/wire schema, content pack или deployment.
- Реализация P0-B PostgreSQL backup bucket, retention или restore drill.
- Публикация Card Studio/admin через Traefik либо создание их auth boundary.
- Выбор AWS либо другого конкретного S3-compatible vendor.
- Commit, push и публикация.

## Архитектурный подход

- Хранить устойчивое сквозное решение рядом с исходным Card Studio ADR.
- Зафиксировать только boundary: local filesystem для текущего local/dev
  authoring; отдельный S3-compatible asset data plane до shared production
  Card Studio/admin workflow, но не до первого production deployment игры.
- Считать candidates private authoring artifacts; доступ к ним проходит через
  backend authorization и временные signed URLs. Published art связывается с
  immutable content identity/digest/provenance и только затем может
  кэшироваться либо раздаваться через CDN.
- Не использовать backup bucket/credentials как неявный asset repository.
  Asset и backup data classes получают отдельные permissions, retention,
  encryption и recovery contracts, чтобы ограничить blast radius.
- Не предрешать implementation contracts. Будущий plan должен отдельно
  определить vendor, exact object keys, signed URL TTL, cache/CDN, migration,
  idempotency и failure recovery.
- ADR-0006 для admin control plane должен потреблять эту storage boundary, а
  не проектировать прямой доступ frontend к object storage.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository-workflow | Дополнение accepted ADR | Runtime contracts unchanged |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/decisions/0005-original-card-art-studio.md` | write | Зафиксировать future production storage boundary |
| `docs/agents/plans/active/20260729T224707Z-7f21dd-record-card-art-object-storage.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260729T224707Z-7f21dd-record-card-art-object-storage.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `card-studio:storage-direction-v1` | admin-control-plane draft | этот plan | Infrastructure roadmap завершён; storage ADR принимается до admin ADR |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 02:48 MSK через `leinoctl context`.
- **Обнаруженные связи:** infrastructure-roadmap plan завершён; admin-control
  draft использует эту storage boundary и теперь зависит от данного plan.
  Frontend engineering spec имеет отдельный write set.
- **Решение:** сначала выполнить этот узкий docs-only plan в отдельной
  selected session, затем согласовать и выполнить admin-control-plane plan.

## План реализации

1. [x] Добавить в ADR-0005 раздел о future P2 production object storage.
2. [x] Связать его с ADR-0007 и явно отделить assets/candidates от P0-B
   PostgreSQL backup bucket, credentials и lifecycle.
3. [x] Зафиксировать private candidate access, immutable published art и
   запрет незащищённой публикации Card Studio.
4. [x] Проверить, что формулировка не заявляет S3 уже реализованным и не
   предрешает vendor/exact implementation.
5. [x] Выполнить canonical checks, scope-check и архивировать plan.

## Проверки

- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed` на repository Node 24 toolchain.
- [x] `./leinoctl scope-check --plan 20260729T224707Z-7f21dd-record-card-art-object-storage`.
- [x] `git diff --check` и финальный read-only diff review.

## Риски и откат

- **Риск:** future direction воспримут как уже действующий production
  contract.
  **Снижение:** явно назвать current и future состояния и перечислить
  нерешённые implementation вопросы.
- **Риск:** database backups и card-art objects окажутся в одном bucket либо
  будут использовать общие credentials/lifecycle.
  **Снижение:** закрепить раздельные data classes, permissions и retention;
  любое исключение требует отдельного явного решения и проверки blast radius.
- **Риск:** наличие object storage будет понято как разрешение сделать Card
  Studio или candidates публичными.
  **Снижение:** private-by-default candidates, backend-authorized temporary
  access и сохранение запрета ADR-0007 на публичный Studio без отдельной auth.
- **Откат:** удалить один добавленный ADR-раздел обычным revert.

## Открытые вопросы

- Конкретный vendor, asset bucket/key layout, retention values, CDN, signed
  URL TTL и migration намеренно остаются открытыми до implementation plan.
- Backup bucket/provider может совпасть по vendor, но не по credential/data
  boundary без отдельного согласованного решения.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-29 23:48:05 UTC
- **Подтверждено:** 2026-07-30 03:40 MSK
- **Формулировка согласования:** пользователь явно согласовал четыре плана в
  предложенном порядке, начиная с точного plan ID
  `20260729T224707Z-7f21dd-record-card-art-object-storage`.
- **Формулировка/ограничения пользователя:** «После полного завершения,
  отдельного commit и успешного push каждого плана разрешаю release и select
  следующего». Исходное направление: «Надо где-то это записать на будущее»
  после уточнения, что текущая реализация не использует S3; infrastructure
  roadmap и разделение asset/backup storage обязательны.

## Ход выполнения

- Draft создан атомарно.
- После принятия ADR-0007 обновлены зависимости, P2 sequencing, storage data
  classes, privacy и coordination; реализация ADR-0005 не начата.
- Получено повторное явное согласование exact plan ID. Lifecycle передан
  текущей execution-session через проверенный `plan claim --takeover`; прежняя
  planning-session остановлена, implementation writes отсутствовали.
- Plan выбран session `019fb06a-77eb-7c53-b1ae-fb95d21f81fa` командой
  `leinoctl plan select`; реализация начата.
- ADR-0005 дополнен future P2 storage boundary: local/dev filesystem отделён
  от S3-compatible production asset data plane, а illustration objects — от
  P0-B PostgreSQL backup data class.
- Read-only review обнаружил противоречие со старой фразой о `cloud storage`;
  последствия уточнены так, что вне ADR остаются implementation/provisioning,
  а принятая future boundary сохраняется.
- Финальный `text-check`, `git diff --check` и plan-lint прошли.
  Canonical verify на Node 24.14.0 / pnpm 11.9.0 / Git Bash 5.2: hooks
  `42/42`, leinoctl `63 passed / 1 platform skip`, plan-lint `0 issues`.
- `scope-check` завершился `ok: true`, `outsideWriteSet: []`,
  `missingRequiredChecks: []`. После архивации он сохранил non-blocking warning
  о трёх `unledgered` lifecycle/content paths из desktop PostToolUse
  integration; все exact paths входят в write set, а content input полностью
  покрыт current-fingerprint canonical checks.

## Итог

ADR-0005 теперь фиксирует не реализованный P2 object-storage boundary для
private Card Studio candidates и immutable published art. Asset и database
backup storage разделены по buckets/credentials/policy; vendor, key layout,
TTL, lifecycle, CDN и migration оставлены будущему implementation plan.
Production code, config, API, content packs и deployment не менялись.
