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

## Lobby core rules profile

`first-edition-core-v1` — immutable rules profile version 1. Он разрешает 1–6
участников, раздаёт каждому 4 Door + 4 Treasure, задаёт hand limit 5, winning
Level 10 и базовую цель Run Away 5. Один участник нужен как preview того же
reducer: после конца хода очередь возвращается ему без отдельной solo-ветки.

Полный ход проходит через явные состояния:

```text
setup
  -> preparation
  -> door_choice
  -> combat | run_away | resolve_effect
  -> charity
  -> end_turn
  -> preparation следующего lobby player
```

Pack хранит definitions с количеством копий, а game state — уникальные card
instances. В каждый момент instance принадлежит ровно одной zone: Door или
Treasure deck/discard, hand, carried, equipped, traits, attachments,
persistent curses, encounter либо resolving effect.

`ActionWindow` содержит eligible actors, а tagged `PendingDecision` — только
разрешённые server-side варианты. В текущем профиле eligible всегда один
active actor. Это сознательная граница первой итерации: будущие помощь,
контрдействия и другие multiplayer choices расширят окно, но не authority или
instance model.

Текущий профиль материализует только definitions со scope `none`/`self`.
Карты с `interaction_scope: other_players` валидны как будущий content, но не
попадают в колоды и не превращаются в runtime no-op.

Legacy bootstrap state/events не угадываются и не мигрируют автоматически:
replay возвращает явную incompatible-state ошибку. Все shuffle orders и
Run Away rolls записываются в transition event; replay RNG не вызывает.

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
- собственные pending choices и available actions видит только actor;
- у других игроков только `hand_count` и public zones/stats;
- deck order, RNG, token hashes, full event payloads отсутствуют;
- active encounter содержит только публично разрешённую metadata;
- outsider получает deny, spectator mode отсутствует.

Frontend не выводит допустимость правил самостоятельно: он рендерит
server-supplied action descriptors и отправляет только intent с выбранными
видимыми instance IDs.

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

## Card Studio authoring boundary

Локальная Card Studio принадлежит Nuxt/Nitro server boundary и не входит ни в
pure game engine, ни в gameplay HTTP application. Browser отправляет только
typed authoring intent и отдельный bearer token. Provider credential,
filesystem paths, raw responses и staging metadata остаются на server.

Studio disabled by default и fail-closed: каждый endpoint сначала проверяет
feature flag и отдельный authoring credential. Guest game token не даёт прав
на генерацию. Generation оформляется как persisted async job; retry всегда
является новым явным действием, а request fingerprint не позволяет повторно
вызвать платный provider под тем же request ID.

AI provider создаёт только raster для illustration viewport. Original frame,
name, stats, rules и flavor остаются доступным HTML/CSS/SVG. Candidate
декодируется, ограничивается по bytes/pixels, нормализуется в WebP и только
после approve попадает в draft следующей content version вместе с безопасным
provenance sidecar. Published `(set_id, version, digest)` Studio не изменяет.

## Почему modular monolith

На старте один bounded context и одна транзакционная consistency boundary.
Отдельные services/NATS/gateway добавляются только при доказанной deploy/data
границе. Internal packages уже отделяют engine, application, transport,
persistence и public contracts, поэтому будущая extraction не требует ломать
правила игры.
