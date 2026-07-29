# Codex harness и leinoctl

Harness механически закрепляет выбранный plan, strict UTF-8, Compose policy и
bounded delegation. `leinoctl` даёт один deterministic component/plan/session
core людям, hooks и CI. Это guardrail, не security boundary.

## Состав

| Путь | Назначение |
|---|---|
| `.codex/config.toml` | hooks/multi-agent limits |
| `.codex/hooks.json` | lifecycle dispatchers |
| `.codex/hooks/` | policy adapters и tests |
| `tools/leinoctl/` | generic profile/graph/plan/Git/session runner |
| `.leino/` | Munchkin profile/components |
| `.leino/runtime/` | ignored local baseline/ledger/ownership |
| `.agents/skills/` | тонкие domain workflow routers |

## Доверие

После clone или изменения hooks/config:

1. Просмотри diff.
2. Запусти harness/leinoctl tests.
3. Начни новую trusted Codex session.
4. Убедись, что SessionStart сообщает `Munchkin harness is active`.

Текущая session могла загрузить предыдущую версию. Поэтому bootstrap-session,
которая впервые копирует hooks, проверяет их вручную, но не заявляет
PreToolUse/Stop enforcement target repository.

## Selected plan и baseline

После approval:

```bash
./leinoctl plan select <plan-id>
```

Selection разрешает только active `approved|in_progress` plan без lint issues,
получает lifecycle ownership и сохраняет repository identity, session ID,
root HEAD (включая unborn `null`), status/fingerprints и ledger.

Повторный select того же ID идемпотентен. Смена plan/baseline в одной session
запрещена. Draft ownership передаётся через `plan release`/`plan claim`;
`--takeover` используется только после проверки, что прежняя session
остановлена.

## Pre/Post/Stop

PreToolUse:

- write target должен принадлежать write set выбранного eligible plan;
- text additions проверяются на high-confidence mojibake;
- direct Compose требует ровно один `--parallel N`, `N >= 4`;
- delegated agent требует bounded read-only `DELEGATION_META`.

PostToolUse записывает patch targets в ledger и повторно декодирует text как
strict UTF-8. Shell/generator paths может увидеть только финальный baseline
diff; `scope-check` помечает их `unledgered`.

Stop рассматривает только plan выбранной session. Он fail-closed при path вне
scope, stale/missing required checks или незавершённом checklist.

## Проверки

```bash
node --test --test-isolation=none .codex/hooks/test/*.test.mjs
(cd tools/leinoctl && node --test)
node .codex/hooks/plan-lint.mjs
./leinoctl preflight
./leinoctl text-check --changed
./leinoctl verify --changed
./leinoctl scope-check --plan <plan-id>
```

CI для root commit строит dry-run impact plan по explicit all-component paths,
а component jobs исполняют все canonical checks. У root commit нет parent
diff, поэтому сравнение с `HEAD` запрещено. Последующие commits используют
changed impact graph от доступного base SHA.

## Границы

- Hooks не защищают от намеренного отключения владельцем машины.
- Shell parser не является полным interpreter.
- Detector не определяет произвольную кодировку.
- Tool payloads могут измениться после Codex upgrade.
- Runtime ledger локален и не является shared registry.
- `sync` generic, но repository без submodules/remote не рекламирует его как
  основной workflow.
