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

### Последовательная очередь в одном диалоге

Пользователь может одним сообщением согласовать exact plan IDs и их порядок.
Approval каждого plan всё равно записывается в его lifecycle section. В один
момент выбран только один plan; прямой `select B` при selected `A` запрещён.

После полного завершения текущего plan:

```bash
./leinoctl verify --changed
./leinoctl scope-check --plan <current-plan-id>
# отметить completed и перенести current plan в archive
./leinoctl plan release <current-plan-id>
# создать отдельный local commit; push только если явно разрешён
# при необходимости: plan claim next и записать его approval/status
./leinoctl plan select <next-plan-id>
```

Selected release отличается от draft handoff: он разрешён только для
lint-clean completed archived plan со свежими scope/check evidence и сохраняет
rotation checkpoint. Следующий select требует отдельный commit завершённого
plan, сохраняет предсуществующий dirty baseline и создаёт новый пустой ledger.
Material scope/contract/risk/dependency/order change, failed check или новый
unexpected dirty path останавливают очередь и требуют пользователя.

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
