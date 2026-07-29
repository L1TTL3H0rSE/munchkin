# PLAN: record card art object storage

- **Plan ID:** `20260729T224707Z-7f21dd-record-card-art-object-storage`
- **Статус:** draft
- **Создан:** 2026-07-29 22:47:07 UTC
- **Обновлён:** 2026-07-29 22:47:07 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260729T161635Z-c08a8a-moscow-card-art-studio`.
- **Блокирует:** нет
- **Связанные ADR/handoff:** ADR-0005

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
    "20260729T161635Z-c08a8a-moscow-card-art-studio"
  ],
  "sharedResources": [
    "card-studio:storage-direction-v1"
  ]
}
```

## Цель

Зафиксировать в ADR-0005 будущую production storage boundary для Card Studio:
текущий local filesystem остаётся local/dev authoring реализацией, а перед
shared или multi-instance production бинарные illustration assets и candidates
должны быть вынесены в S3-compatible object storage. Не выдавать это направление
за уже реализованную инфраструктуру.

## Критерии приёмки

- [ ] ADR явно разделяет текущий local/dev storage и будущий shared production
  object storage.
- [ ] Будущее направление называет S3-compatible storage для binary candidates
  и published illustrations, сохраняя требования immutable content version,
  digest и provenance.
- [ ] Текст явно оставляет bucket/key layout, lifecycle/retention, CDN,
  signed access, credentials, migration и конкретного vendor будущему
  implementation plan/ADR.
- [ ] Ни production code, ни config/schema/infra, ни текущий Card Studio
  contract и local workflow не меняются.

## Контекст и подтверждённое состояние

- Card Studio сейчас пишет jobs/candidates в ignored `.card-studio/`, а approve
  атомарно добавляет `assets/<card-id>.webp` в versioned content pack.
- ADR-0005 прямо относит cloud queue/storage к текущим non-goals, но не
  фиксирует желаемую production boundary.
- Пользователь подтвердил, что это направление нужно сохранить на будущее.
- Worktree чистый; предыдущий Card Studio/master-prompt plan завершён,
  архивирован и находится в `main`.

## Scope

### Входит

- Один короткий раздел `Future production storage` в ADR-0005.
- Явная маркировка направления как будущего, не реализованного состояния.

### Не входит

- S3 client, bucket provisioning, credentials, IAM, presigned URLs и CDN.
- Изменение storage adapter, API/wire schema, content pack или deployment.
- Выбор AWS либо другого конкретного S3-compatible vendor.
- Commit, push и публикация.

## Архитектурный подход

- Хранить устойчивое сквозное решение рядом с исходным Card Studio ADR.
- Зафиксировать только boundary: local filesystem для текущего local/dev
  authoring; object storage до shared production.
- Не предрешать implementation contracts. Будущий plan должен отдельно
  определить object keys, privacy, retention, cache/CDN, migration,
  idempotency и failure recovery.

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
| `card-studio:storage-direction-v1` | Нет | этот plan | Exclusive ADR update |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 01:47 MSK через `leinoctl context`;
  релевантных active plans не было.
- **Обнаруженные пересечения:** нет.
- **Решение:** отдельный узкий docs-only plan.

## План реализации

1. [ ] Добавить в ADR-0005 раздел о future production object storage.
2. [ ] Проверить, что формулировка не заявляет S3 уже реализованным и не
   предрешает vendor/implementation.
3. [ ] Выполнить canonical checks, scope-check и архивировать plan.

## Проверки

- [ ] `node .codex/hooks/plan-lint.mjs`.
- [ ] `./leinoctl text-check --changed`.
- [ ] `./leinoctl verify --changed` на repository Node 24 toolchain.
- [ ] `./leinoctl scope-check --plan 20260729T224707Z-7f21dd-record-card-art-object-storage`.
- [ ] `git diff --check` и финальный read-only diff review.

## Риски и откат

- **Риск:** future direction воспримут как уже действующий production
  contract.
  **Снижение:** явно назвать current и future состояния и перечислить
  нерешённые implementation вопросы.
- **Откат:** удалить один добавленный ADR-раздел обычным revert.

## Открытые вопросы

- Конкретный vendor, bucket/key layout, retention, CDN, access model и
  migration намеренно остаются открытыми до implementation plan.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-29 22:47:07 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** «Надо где-то это записать на
  будущее» после уточнения, что текущая реализация не использует S3.

## Ход выполнения

- Draft создан атомарно; реализация не начата.

## Итог

Заполняется после реализации.
