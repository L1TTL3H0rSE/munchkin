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

## Queue preflight до approval

Для batch approval сначала собери exact plan IDs в заданном порядке и проверь
их read-only. Preflight обязан показать:

1. объявленный count и фактический count IDs;
2. каждый manifest, active/archive placement, status/eligibility и owner/session;
3. direct `dependsOn` и то, что порядок очереди удовлетворяет dependency graph;
4. пересечения write set и `sharedResources` между соседними plans;
5. `./leinoctl context --paths ...` для совокупного impact.

Пример обязательной остановки: если в сообщении написано `7 plans`, но после
разбора перечислено 8 IDs, checkpoint должен вернуть mismatch и ждать решения
пользователя. Нельзя молча отбросить восьмой ID, «починить» count, поменять
порядок или переписать dependency metadata. `plan-lint` проверяет registry и
manifest health, но не является approval.

После explicit approval каждый ID и порядок считаются частью authorization.
Изменение IDs, dependencies, write set, shared resources, risk или order —
material scope change: очередь останавливается и требует повторного approval.

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
10. Выполнить `verify`/recorded ledger и `scope-check`, затем поставить
    `completed` и переместить тот же файл в archive.
11. Выполнить `plan release <plan-id> --session <session-id>`.
12. Создать отдельный local commit; push выполнять только при явном
    разрешении пользователя.

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
# focused/manual checks are evidence only; they do not replace the ledger
./leinoctl verify --changed
./leinoctl scope-check --plan <current-plan-id>
# отметить completed и перенести current plan в archive
./leinoctl plan release <current-plan-id> --session <session-id>
# создать отдельный local commit; push только если явно разрешён
# только если next ID был заранее approved: plan claim next, записать status
./leinoctl plan select <next-plan-id>
```

Selected release отличается от draft handoff: он разрешён только для
lint-clean completed archived plan со свежими scope/check evidence и сохраняет
rotation checkpoint. Следующий select требует отдельный commit завершённого
plan, сохраняет предсуществующий dirty baseline и создаёт новый пустой ledger.
Material scope/contract/risk/dependency/order change, failed check или новый
unexpected dirty path останавливают очередь и требуют пользователя.

`verify` должен быть именно canonical: он запускает required component checks и
записывает успешные exit code/fingerprint в текущий session ledger. Прямые
`node --test`, `pnpm lint`, `plan-lint` или browser/manual smoke могут быть
полезны, но сами по себе не закрывают `missingRequiredChecks`. `scope-check`
отдельно доказывает write-set/unledgered paths и свежесть ledger; release не
является commit, а commit не является push.

Для frontend browser evidence используй bundled Node 24/Git Bash, declared
`pnpm@10.8.0`, cwd-agnostic runner, serial/bounded workers и unique temp output
вне worktree. Успешный browser run чистит temp, failed run сохраняет и печатает
evidence path. `frontend/test/browser/artifacts/` и ignore rules — только
legacy defense-in-depth. `pnpm install`, `--lockfile-only` и автоматический
`--update-snapshots` не являются verification setup и требуют отдельного
разрешения/write set.

Если меняются hooks, config или эти lifecycle/runbook rules, текущая session не
доказывает, что новая policy уже активна: после diff/tests нужен новый trusted
session с SessionStart evidence. Запиши это ограничение в handoff и не
расширяй его до разрешения push/cloud/dependency mutation.

## Команды

```bash
./leinoctl context --paths <paths>
./leinoctl plan relevant --paths <paths>
./leinoctl plan claim <plan-id>
./leinoctl plan release <plan-id> --session <session-id>
./leinoctl plan select <plan-id>
./leinoctl scope-check --plan <plan-id>
node .codex/hooks/plan-lint.mjs
```
