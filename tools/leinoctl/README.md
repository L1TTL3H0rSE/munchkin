# leinoctl

`leinoctl` — deterministic repository control plane. Он не содержит LLM,
daemon или сетевой registry: package читает versioned repository profile,
строит component/impact graph и запускает только проверенные `argv` без shell
interpolation.

В Munchkin используется root wrapper:

```sh
./leinoctl preflight
./leinoctl context --paths .codex/hooks/lib/plans.mjs
./leinoctl plan create short-task-name
./leinoctl plan select <approved-plan-id>
./leinoctl verify --changed --dry-run
./leinoctl text-check --changed
./leinoctl compose --dry-run -- config
```

Generic package находится в `tools/leinoctl`, а repository-specific profile —
в `.leino`. JSON output включается флагом `--json`; все envelopes имеют
`schemaVersion: 1`.
Общий envelope опубликован в `schema/output.schema.json`; структура
`verify.data`, которую читает CI, отдельно закреплена
`schema/verify-data.schema.json`.

Для human workflow без Codex session ID можно передать один и тот же
`--session <id>` в `plan select`, `verify` и `scope-check`. `verify` записывает
в ledger только фактически завершённые команды; dry-run не закрывает required
checks. Результат проверки привязан к covered paths и fingerprint, поэтому
последующая правка требует повторного полного `verify --changed`.

Lifecycle ownership не захватывается молча:

```sh
./leinoctl plan release <plan-id>                    # штатный handoff
./leinoctl plan claim <plan-id>                      # новый owner
./leinoctl plan select <plan-id> --takeover          # recovery после проверки
```

`compose` — явный execution adapter: profile задаёт Compose files, CLI владеет
единственным `--parallel`, а аргументы после `--` передаются буквально без
shell interpolation.

Новые plans получают collision-resistant sortable ID вида
`YYYYMMDDTHHMMSSZ-<6hex>-short-name`; legacy `NNNN-short-name` продолжает
разбираться. `context` читает полные документы только для relevant manifest
matches и dependency/shared-resource closure.

`preflight` проверяет repository/profile/Git contracts, показывает доступность
всех executable/capabilities из component graph и не вызывает `codex doctor`.
`toolchain.versionProbes` задаёт literal argv после executable для нестандартной
команды версии (например, `"go": ["version"]`); без записи остаётся совместимый
default `["--version"]`.
С `--require-toolchain` отсутствие или слишком старая версия инструмента
становится ошибкой; без флага это диагностическое warning. `codex doctor`
остаётся отдельной диагностикой установки Codex, поэтому CLI одинаково
работает у человека и в CI без Codex.

Exit codes:

- `0` — success;
- `2` — usage error;
- `3` — repository policy violation;
- `4` — dirty state запрещает mutation;
- `5` — canonical check/command failed;
- `10` — unexpected internal failure.

Локальные tests не требуют install:

```sh
node --test
```
