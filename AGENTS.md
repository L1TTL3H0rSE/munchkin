# Правила для AI-агентов — munchkin

Правила действуют во всём repository. Ближайшие `AGENTS.md` дополняют их:
[`backend/AGENTS.md`](backend/AGENTS.md),
[`frontend/AGENTS.md`](frontend/AGENTS.md) и
[`content/AGENTS.md`](content/AGENTS.md).

## Старт нетривиальной задачи

1. Прочитай [`docs/agents/README.md`](docs/agents/README.md).
2. Проверь `git status --short`. Существующие изменения принадлежат
   пользователю: не очищай, не stash-ь и не перезаписывай их.
3. Получи impact/context:

   ```bash
   ./leinoctl context --paths <relative-path[,relative-path...]>
   ```

4. Прочитай полностью возвращённые active plans, ближайший `AGENTS.md`,
   manifests/config/schema/tests затронутого компонента.
5. При конфликте приоритет имеют code, manifests, migrations, schemas и tests,
   затем принятые ADR, затем обзорные документы.

## Обязательный plan lifecycle

Любая запись в production/test/generated code, docs, config, schema,
migrations, CI или поведение требует отдельного plan-файла.

```bash
./leinoctl plan create <short-kebab-name>
```

После read-only исследования заполни manifest, цель, критерии, scope/non-goals,
архитектуру, проверки, риски, зависимости, write set и shared resources.
Покажи точный plan-id пользователю и не начинай реализацию до явного
согласования. Затем запиши approval, поставь `approved`/`in_progress` и выбери:

```bash
./leinoctl plan select <plan-id>
```

В каждый момент session выбирает ровно один plan. Один диалог может выполнить
заранее согласованную очередь exact plan IDs последовательно, но прямой
`select` другого plan запрещён. Для перехода текущий plan должен пройти
verify/scope-check, стать `completed` и переместиться в archive; затем выполни
`plan release`, зафиксируй его отдельным локальным commit и только после этого
выбери следующий plan. Push между plans выполняется лишь при явном разрешении
пользователя. Material change scope, contracts, write set, shared resources,
dependencies, рисков или порядка очереди останавливает цепочку и требует
повторного согласования.

Перед завершением:

```bash
./leinoctl verify --changed
./leinoctl scope-check --plan <plan-id>
```

Запиши фактические результаты, поставь `completed` и перенеси тот же файл в
`docs/agents/plans/archive/`.

Первичный bootstrap этого repository выполнен из внешнего source plan
`20260729T100217Z-28342b-bootstrap-munchkin-repository`. Скопированные hooks
не считаются активными в bootstrap-session: их защита начинается только в
новой trusted session. После bootstrap исключений из target plan lifecycle нет.

## Архитектурные инварианты

- Backend авторитетен. Клиент отправляет намерение, но не выбирает RNG,
  deck position, чужой player ID или итог боя.
- `backend/game/internal/game` является pure deterministic engine: без сети,
  env, БД, глобального RNG и чтения часов.
- Случайные исходы фиксируются в событиях. Replay применяет события и не
  повторяет RNG.
- Каждая игра фиксирует immutable `content_set_id`, `version` и digest.
- Ни один transport не сериализует internal state. HTTP строит
  actor-specific projection; realtime публикует только version invalidation.
- Actor выводится только из server-validated credential. `player_id` из body
  не является authority.
- Idempotency уникальна по `(game_id, actor_id, command_id)` и включает
  canonical request fingerprint.
- Content исполняет только закрытый typed effect registry. Никаких `eval`,
  пользовательского JavaScript/Lua или произвольных asset paths.

## Content и права

В репозитории разрешено использовать оригинальные названия, тексты, изображения, логотипы,
шрифты или trade dress коммерческих наборов только для разработки, как референс при создании
пользовательских карточек и наборов. Механики реализуются отдельно от
presentation content.

## Запись и команды

- Используй strict UTF-8. При invalid bytes, `U+FFFD` или mojibake остановись;
  не угадывай кодировку.
- `apply_patch`/Edit/Write разрешены только write set выбранного eligible plan.
- Каждый прямой `docker compose`/`docker-compose` вызов содержит ровно один
  `--parallel N`, `N >= 4`. Предпочитай `./scripts/dev.sh` или
  `./leinoctl compose`.
- Не используй reset/stash/force checkout для обхода scope.
- Generated artifacts меняются только через source/schema/generator.

## Делегирование

Сабагент получает ограниченную независимую read-only задачу, пока root делает
другую полезную работу. Первая строка содержит `DELEGATION_META`, history
bounded, роль `explorer`/`reviewer`, пустой write set и stop condition.
Write-сабагенты в общем worktree запрещены.

## Где хранить знания

- task scope/progress — отдельный plan;
- долговечный подтверждённый факт — `docs/agents/PROJECT_MEMORY.md`;
- сквозное решение — ADR в `docs/agents/decisions/`;
- длинная прерванная задача — handoff;
- завершённая история — Git.

Не сохраняй secrets, `.env`, bearer tokens, персональные данные, большие логи
или догадки как факты.

## Harness checks

```bash
./leinoctl preflight
node --test --test-isolation=none .codex/hooks/test/*.test.mjs
(cd tools/leinoctl && node --test)
node .codex/hooks/plan-lint.mjs
```

После изменения `.codex`, `.leino`, `tools/leinoctl` или lifecycle-правил в
этом файле просмотри diff, запусти tests и начни новую trusted session.
Текущая session не доказывает загрузку новых hooks или инструкций.
