# Планы

Каждая задача с repository writes получает отдельный plan. Registry —
`active/*.md` и `archive/*.md`; общего изменяемого индекса нет.

## Создание

```bash
./leinoctl plan create <short-kebab-name>
```

Новый ID:

```text
YYYYMMDDTHHMMSSZ-<6hex>-short-kebab-name
```

Timestamp сортирует, entropy устраняет общий allocator, exclusive create
защищает worktree collision.

## Manifest

В начале plan:

```json
{
  "schemaVersion": 1,
  "paths": ["backend/game/**"],
  "components": ["go:backend/game"],
  "contracts": ["game:http-v1"],
  "dependsOn": [],
  "sharedResources": []
}
```

Manifest нужен relevance scan. Таблица Write set нужна write authorization.
Они описывают один scope, но не заменяют друг друга.

## Lifecycle

1. Read-only research + `./leinoctl context --paths ...`.
2. `plan create`.
3. Заполнить criteria/scope/architecture/checks/risks/dependencies/write set.
4. `node .codex/hooks/plan-lint.mjs`.
5. Показать точный ID и получить явное approval.
6. Записать формулировку, поставить `approved|in_progress`.
7. `./leinoctl plan select <plan-id>`.
8. Выполнить только выбранный plan.
9. При material scope/risk/contract change повторно согласовать.
10. Verify, scope-check, `completed`, move в archive.

Статусы: `draft`, `awaiting_approval`, `approved`, `in_progress`, `blocked`,
`completed`, `cancelled`. Completed/cancelled лежат только в archive.

## Coordination

Параллельны только plans с непересекающимися write set. Migrations, public
contracts/generated consumers, lockfiles, CI, Compose, `AGENTS.md` и shared
config exclusive по умолчанию.

Lifecycle ownership передаётся `plan release` → `plan claim`. `--takeover`
используется только для recovery после проверки остановки прежней session.

## Команды

```bash
./leinoctl context --paths <paths>
./leinoctl plan relevant --paths <paths>
./leinoctl plan claim <plan-id>
./leinoctl plan release <plan-id>
./leinoctl plan select <plan-id>
./leinoctl scope-check --plan <plan-id>
node .codex/hooks/plan-lint.mjs
```
