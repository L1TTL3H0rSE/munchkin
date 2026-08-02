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

После clone или изменения hooks/config, `tools/leinoctl`, `AGENTS.md` либо
lifecycle/runbook documentation:

1. Просмотри diff.
2. Запусти harness/leinoctl tests.
3. Начни новую trusted Codex session.
4. Убедись, что SessionStart сообщает `Munchkin harness is active`.

Текущая session могла загрузить предыдущую версию. Поэтому bootstrap-session,
которая впервые копирует hooks, проверяет их вручную, но не заявляет
PreToolUse/Stop enforcement target repository. После изменения этих правил
текущая session также не заявляет, что новые instructions/hooks уже активны;
новая trusted session и SessionStart evidence — отдельный handoff checkpoint.

## Selected plan и baseline

После approval:

```bash
./leinoctl plan select <plan-id>
```

Selection разрешает только active `approved|in_progress` plan без lint issues,
получает lifecycle ownership и сохраняет repository identity, session ID,
root HEAD (включая unborn `null`), status/fingerprints и ledger.

Повторный select того же ID идемпотентен. Пока plan выбран, прямой select
другого ID запрещён. Draft ownership без selected plan передаётся через
`plan release`/`plan claim`; `--takeover` используется только после проверки,
что прежняя session остановлена.

## Queue preflight и stale-owner recovery

До batch approval зафиксируй exact IDs и порядок очереди, затем read-only
сверь count, active/archive placement, direct `dependsOn`, eligibility,
write-set/shared-resource overlap и текущие owner/session records. Если
объявлено 7 plans, а перечислено 8 IDs, это mismatch и hard stop: нельзя
молча удалять ID, менять порядок или чинить dependency metadata. `plan-lint`
не является approval и не заменяет этот checkpoint.

Для stale owner действуй точечно:

1. Прочитай ошибку `plan claim` и проверь repository identity, owner record и
   наличие session state; отсутствие state не доказывает, что живой owner
   остановлен, пока это не подтверждено read-only проверкой.
2. Если прежняя session действительно остановлена, выполни только
   `./leinoctl plan claim <exact-plan-id> --takeover` и запиши, кого и почему
   заменили.
3. Если session жива или состояние неоднозначно, остановись и запроси
   handoff; не удаляй весь `.leino/runtime/plan-owners`, не очищай ledger и
   не выбирай новый plan поверх selected plan.

Любой material change IDs, order, dependency, write set, shared resource или
risk после approval требует остановки и повторного согласования.

Один диалог/session может последовательно выполнить несколько заранее
согласованных exact plan IDs. Переход является отдельным fail-closed state
transition:

1. Выполнить current plan и все required checks.
2. Запустить `verify --changed` и `scope-check --plan <current>`.
3. Поставить `completed` и перенести тот же plan в archive.
4. Выполнить `plan release <current> --session <session-id>`. Для selected plan команда повторно
   проверяет completed/archive, checklist, lint, scope и verification.
5. Release удаляет active session/ownership, но сохраняет bounded rotation
   checkpoint. Обычные repository writes после этого не авторизованы.
6. Зафиксировать завершённый plan отдельным локальным commit; push делать
   только при явном разрешении пользователя.
7. Если approval следующего exact plan не записан заранее, выполнить
   `plan claim <next>`, записать approval/status и затем `plan select <next>`.
   Select требует новый commit, отсутствие нового dirty delta относительно
   исходного baseline и обычную eligibility/dependency проверку.

Новый select создаёт свежий baseline и пустой ledger, сохраняя bounded history
завершённых plan IDs. Failed release не меняет session/ownership. Failed select
не поглощает незакоммиченные изменения старого plan. Material scope/contract/
risk/order change или failed check останавливает согласованную очередь.

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

## Evidence taxonomy

| Слой | Что доказывает | Что не доказывает |
|---|---|---|
| focused test / unit test | конкретную функцию или failure path | полный component impact или lifecycle ledger |
| browser assertion / manual smoke | один видимый сценарий и его assertion | visual/a11y matrix, canonical verify или release |
| visual/a11y matrix | выбранные viewport, raster или accessibility checks | product-wide accessibility или current ledger |
| canonical `verify` | required component checks и записанный exit/fingerprint в session ledger | scope placement и archive/release |
| `scope-check` | write-set, unledgered paths и свежесть required checks | correctness незапущенного browser слоя |
| `plan release` ledger | completed archived plan, checklist и rotation guard | Git commit или push |
| local commit | сохранённый Git snapshot | remote push, cloud apply или новая approval |

Прямые hooks, `leinoctl` tests, `plan-lint` или manual smoke могут быть зелёными
и всё равно оставить `missingRequiredChecks`; штатная регистрация выполняется
через canonical `verify`, а не ручным внутренним helper.

Frontend browser evidence использует bundled Node 24/Git Bash, declared
`pnpm@10.8.0`, serial/bounded workers и output вне worktree. `pnpm install`,
`--lockfile-only` и implicit snapshot refresh не являются бесплатной
verification подготовкой; lockfile/node_modules mutation требует отдельного
declared write set и approval. Ignore rules лишь защищают legacy paths и не
заменяют outside-worktree temp boundary.

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
- Rotation checkpoint локален/ignored, не является approval следующего plan и
  не доказывает push в remote.
- `sync` generic, но repository без submodules/remote не рекламирует его как
  основной workflow.
