# Карта архитектуры

## Главная граница

```text
Nuxt client
  -> HTTP command with bearer credential + Idempotency-Key + expected_version
  -> application transaction
  -> pure game engine
  -> events + snapshot + receipt atomically persisted
  -> version-only realtime invalidation (best effort)
  -> actor-specific HTTP projection
```

Backend авторитетен. Клиент никогда не выбирает actor, RNG outcome, deck
position или итог правила.

## Game engine

`internal/game` содержит State, Commands, DomainEvents, reducer, content
registry, deterministic RNG и projector. `Handle` возвращает события, `Apply`
строит state. Ошибка команды не создаёт events.

RNG используется только при command handling. События сохраняют уже
реализованный shuffle/die result, поэтому replay не зависит от будущей версии
PRNG или порядка вызовов.

Game фиксирует:

```text
content_set_id + content_version + content_digest
```

Pack с той же identity и другим digest отклоняется.

## Application transaction

1. Из bearer token hash определяется actor в exact game.
2. По `(game_id, actor_id, command_id)` ищется receipt.
3. Canonical request fingerprint должен совпасть для replay.
4. Exact expected version сравнивается с current version.
5. Engine авторизует actor/phase и создаёт domain events.
6. Events получают sequence/time, применяются к snapshot.
7. Optimistic version, events, snapshot и receipt сохраняются атомарно.
8. После commit публикуется version invalidation. Publish failure не откатывает
   игру.

## Guest credential

Create выдаёт server-generated random opaque token. Для идемпотентного join
клиент заранее создаёт random 256-bit token и сохраняет его до ответа; сервер
никогда не принимает client-supplied player ID. БД хранит только SHA-256 hash,
привязанный к `(game_id, player_id)`. Token передаётся только bearer header,
не попадает в URL, logs, events или realtime. Повтор join с теми же token,
command ID и fingerprint возвращает сохранённый результат.

Production OIDC заменит credential resolver, а engine/application contract
actor ID не изменится.

## Private projections

Internal State не сериализуется. Projector возвращает allowlist:

- `you.hand` — только actor;
- у других игроков только `hand_count`/public stats;
- deck order, RNG, token hashes, full event payloads отсутствуют;
- active encounter содержит только публично разрешённую metadata;
- outsider получает deny, spectator mode отсутствует.

Realtime room channel общий, поэтому payload содержит только `game_id`,
`version` и `reason`. После reconnect, gap или invalid envelope клиент читает
свою projection через HTTP.

## Persistence

PostgreSQL владеет:

- games/current version/snapshot;
- players + credential hashes;
- append-only events с unique `(game_id, sequence)`;
- command receipts с unique `(game_id, actor_id, command_id)`.

Memory adapter реализует тот же Store contract для fast tests. Migration и
optimistic concurrency проверяются на real PostgreSQL.

## Content

`content/schema` описывает closed versioned pack. Semantic validator проверяет
unique IDs, effect registry, license/source, local safe asset paths, symlink
escape и canonical cross-runtime digest. Presentation metadata включает
локальные images и тексты, но механика остаётся typed.
Engine получает validated immutable registry. Content не выполняет code.

## Почему modular monolith

На старте один bounded context и одна транзакционная consistency boundary.
Отдельные services/NATS/gateway добавляются только при доказанной deploy/data
границе. Internal packages уже отделяют engine, application, transport,
persistence и public contracts, поэтому будущая extraction не требует ломать
правила игры.
