# PLAN: short name

- **Plan ID:** `YYYYMMDDTHHMMSSZ-a1b2c3-short-name`
- **Статус:** draft
- **Создан:** YYYY-MM-DD HH:MM UTC
- **Обновлён:** YYYY-MM-DD HH:MM TZ
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** parallel / conditional / exclusive
- **Зависит от:** нет
- **Блокирует:** нет
- **Связанные ADR/handoff:** —

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/plans/{active,archive}/YYYYMMDDTHHMMSSZ-a1b2c3-short-name.md"
  ],
  "components": [],
  "contracts": [],
  "dependsOn": [],
  "sharedResources": []
}
```

## Цель

Наблюдаемый результат.

## Критерии приёмки

- [ ] Проверяемый product/technical result.
- [ ] Privacy/replay/content contract покрыт при необходимости.

## Контекст и подтверждённое состояние

- Read-only evidence.

## Scope

### Входит

- Изменения.

### Не входит

- Non-goals/follow-ups.

## Архитектурный подход

- Owner boundaries, contracts, compatibility.

## Затронутые компоненты и контракты

| Компонент | Изменение | Public contract/данные |
|---|---|---|
| — | — | — |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/plans/{active,archive}/<plan-id>.md` | write | Lifecycle |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок |
|---|---|---|---|
| Нет | — | — | — |

### Проверка конфликтов

- **Проверены active plans:** —
- **Пересечения:** —
- **Решение:** —

## Delegation strategy

- **Classification:** large — planning delegation required / small — not
  needed.
- **Причина:** risk и независимые workstreams; для small — конкретная причина,
  почему отдельный agent не даст полезного независимого evidence.
- **Root parallel work:** полезная работа root во время каждого package.
- **Write boundary:** delegated `write_set: []`; возможная запись — только
  `root-only pending worktree orchestration`.

### Preliminary work packages

Для каждого package до spawn заполни:

- **Package / role / model / effort:** — / explorer / Luna / high.
- **Bounded scope и context/history:** точный вопрос, пути и `fork_turns`.
- **Independent from:** чем package не дублирует root или другой package.
- **Access / write set:** `read-only` / `[]`.
- **Expected output:** evidence with paths.
- **Stop condition:** —.
- **Root parallel work:** —.
- **Expected savings:** —.

### Actual delegation evidence

| Package | Result | Evidence/findings | Влияние на plan |
|---|---|---|---|
| — | completed / stopped / not run | — | — |

- **Adversarial review:** результат и закрытие findings / `not needed` с
  причиной для small plan.

## План реализации

1. [ ] Шаг.

## Проверки

- [ ] Focused checks.
- [ ] `./leinoctl verify --paths ...`.
- [ ] `./leinoctl scope-check --plan <plan-id>`.

## Риски и откат

- **Риск:** —
- **Откат:** —

## Открытые вопросы

- Нет.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения:** —

## Ход выполнения

- Draft создан; реализация не начата.

## Итог

Заполняется после реализации.
