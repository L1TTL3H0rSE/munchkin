# Munchkin-like online game

Новый самостоятельный repository для онлайн-карточной игры в духе раннего
Munchkin: с авторитетным сервером, закрытыми руками игроков, детерминированным
replay и данными карт, отделёнными от правил.

Сейчас реализован проверяемый вертикальный срез: создать комнату, войти вторым
игроком, начать игру, открыть дверь, сразиться или сбежать, получить добычу и
передать ход. Это фундамент для дальнейшего добавления полного набора правил,
а не заявление о полной совместимости со всеми исключениями первой редакции.

Demo pack использует придуманные CC0-заглушки.

## Быстрый старт

Требуются Docker и Docker Compose v2:

```bash
cp .env.example .env
./scripts/dev.sh
```

После healthchecks:

- web: <http://localhost:3000>
- game API: <http://localhost:8080>
- health: <http://localhost:8080/healthz>

Откройте web в двух разных browser profiles или обычном и приватном окне.
Первый игрок создаёт комнату и передаёт её ID второму. Guest credential
хранится только в `sessionStorage` соответствующего browser profile.

Остановить стек:

```bash
./leinoctl compose --jobs 8 -- down
```

Данные PostgreSQL сохраняются в named volume `munchkin_postgres-data`.
Удаление volume намеренно не включено в dev script.

## Локальный запуск без Compose

Backend использует in-memory adapter, если `DATABASE_URL` пуст:

```bash
cd backend/game
GAME_CONTENT_PATH=../../content/sets/demo/cards.json go run ./cmd/server
```

Во втором terminal:

```bash
cd frontend
corepack pnpm install
corepack pnpm dev
```

Для PostgreSQL задайте `DATABASE_URL` и `AUTO_MIGRATE=true`; полный набор
переменных показан в `.env.example` и `docker-compose.yml`.

## Архитектура

```text
Nuxt/Vue client
  -> HTTP intent + bearer credential + Idempotency-Key + expected_version
  -> application transaction
  -> pure deterministic Go engine
  -> events + snapshot + receipt in PostgreSQL
  -> version-only authenticated SSE invalidation
  -> actor-specific HTTP projection
```

Ключевые границы:

- backend является единственным source of truth;
- engine не читает сеть, БД, env, global RNG или часы;
- случайные результаты записываются в события и не вычисляются при replay;
- чужая рука, порядок колод, credential hashes и RNG state не входят в DTO;
- client-generated join credential и server-generated owner credential
  хранятся на сервере только как SHA-256 hashes;
- realtime не передаёт состояние — только новую version и причину resync;
- card pack — immutable data с canonical digest, а не исполняемый script.

Подробности: `docs/agents/ARCHITECTURE.md` и ADR в
`docs/agents/decisions/`.

## Подготовка production infrastructure

Первый production environment планируется в Yandex Cloud и управляется через
Terraform. Прежде чем создавать VM, сеть, registry, buckets или DNS, владелец
готовит account/billing, отдельные cloud+folder, budget, domain, локальный
`yc` profile и SSH public key по инструкции:

[`docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md`](docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md).

Документ является prerequisite runbook, а не утверждением, что production
resources уже созданы.

## Карты, тексты и изображения

Формат описан в `content/schema/card-set.schema.json`, а пошаговый workflow —
в `content/README.md`. Поддерживаются локальные безопасные image paths,
`rules_text`, `flavor_text`, `alt_text` и закрытые typed mechanical fields.

```bash
node content/tools/digest.mjs content/sets/my-set/cards.json --write
node content/tools/validate.mjs content/sets/my-set/cards.json
```

Каждый pack самостоятельно объявляет `author`, `license`, `source`, version
и digest.

## Основные API routes

```text
POST /api/v1/lobbies
GET  /api/v1/lobbies/{gameID}
POST /api/v1/games/{gameID}/players
GET  /api/v1/games/{gameID}
GET  /api/v1/games/{gameID}/events
POST /api/v1/games/{gameID}/start
POST /api/v1/games/{gameID}/commands/{open-door|fight|run-away|loot|end-turn}
GET  /api/v1/content/{setID}/assets/{path...}
```

Join и все gameplay commands требуют `Idempotency-Key`; actor определяется
только из bearer credential. В случае `409 version_conflict` клиент перечитывает
свою projection.

## Проверки

```bash
./leinoctl preflight --require-toolchain
node --test --test-isolation=none .codex/hooks/test/*.test.mjs
node --test tools/leinoctl/test/*.test.mjs
node --test content/tools/validate.test.mjs
node content/tools/validate.mjs content/sets/demo/cards.json
cd backend/game && go test ./...
cd frontend && corepack pnpm install --frozen-lockfile
cd frontend && corepack pnpm lint && corepack pnpm check && corepack pnpm build
./leinoctl compose --jobs 8 -- config
```

PostgreSQL contract suite запускается при наличии `TEST_DATABASE_URL`.
GitLab CI поднимает реальный PostgreSQL и отдельно собирает оба container
images.

## AI-assisted workflow

`AGENTS.md`, `.agents/skills`, `.codex`, `.leino` и vendored
`tools/leinoctl` образуют repository harness. Любое изменение сначала получает
отдельный согласованный plan; `leinoctl` строит impact graph, запускает
canonical checks и сверяет финальный write set.

Первичная bootstrap-session создала hooks, поэтому их runtime enforcement
начинается со следующей trusted Codex session. Их код и tests уже проверены
вручную.

## License

The source code in this repository is licensed under the
[MIT License](LICENSE.md).

Original card content under `content/sets/demo` is released separately
under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

Third-party dependencies remain subject to their respective licenses.
