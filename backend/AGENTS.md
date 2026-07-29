# Дополнительные правила для backend

Действуют вместе с корневым `AGENTS.md`. Для изменений используй repo skill
`backend-game-change`.

## Границы

- Go-команды запускаются из `backend/game`; общего `go.work` нет.
- `internal/game` — pure engine. Он принимает state + typed command и
  возвращает domain events. Запрещены HTTP types, DB, clock reads, global RNG,
  env, logging и network.
- `internal/application` владеет transaction, actor validation,
  idempotency/version checks, event envelope и realtime publication.
- Интерфейсы Store/Clock/Publisher находятся рядом с application consumer.
- `internal/repository` реализует memory/PostgreSQL adapters.
- `internal/transport/http` отвечает только за parsing, credential extraction,
  error mapping и actor-specific response.

## Authority, replay и privacy

- Actor извлекается из opaque bearer token; тело не выбирает actor.
- Credential хранится только как hash и привязан к game/player. Не логируй
  token, не помещай его в URL/realtime/events.
- Команда содержит exact expected version и idempotency key. Повтор с тем же
  fingerprint возвращает receipt; reuse с другим payload — conflict.
- Persisted event содержит реализованный случайный исход. Replay не вызывает
  RNG и не зависит от новой версии PRNG.
- Optimistic version append, events, snapshot и command receipt коммитятся
  атомарно.
- Internal State никогда не маршалится. `ProjectForActor` использует allowlist
  DTO. Чужие hand/decks/RNG/content internals отсутствуют даже при ошибке.
- Realtime payload — только `{game_id, version, reason}`. Полное состояние
  всегда повторно читается actor-specific HTTP endpoint.

## Content

Backend загружает только pack, прошедший schema и semantic validation. Game
сохраняет immutable set identity/version/digest. Unknown effect kind,
duplicate ID или digest drift — fail-closed до старта.

## Проверки

Минимум:

```bash
go test ./...
```

Для engine нужны transition/rejection/replay/golden/privacy tests. Для
application — duplicate/reused idempotency, stale version, transaction
rollback и concurrent expected-version race. PostgreSQL adapter проверяется
тем же repository contract suite на реальной БД, когда меняются migrations
или persistence.

После focused tests:

```bash
./leinoctl verify --paths backend/game/<changed-path>
```
