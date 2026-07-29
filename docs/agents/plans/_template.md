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
