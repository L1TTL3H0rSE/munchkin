# Стек

Снимок создан 2026-07-29. Перед update сверяй manifest/lock конкретного
компонента.

## Backend

- Go directive: 1.25.1.
- Один module `backend/game`.
- Standard `net/http` transport.
- PostgreSQL через pgx v5.
- SQL migrations принадлежат game service.
- Pure deterministic engine не импортирует infrastructure.
- JSON HTTP/realtime contracts versioned.

## Frontend

- Node.js 24 для одинакового local/CI harness.
- pnpm 10.8+.
- Nuxt 4, Vue 3, Pinia, TypeScript, Zod.
- Один workspace lockfile в `frontend/pnpm-lock.yaml`.
- `applications/web` — deployable UI.
- `packages/contracts` — wire schemas/fixtures.

## Content

- JSON Schema + semantic validator на Node standard library.
- Packs — immutable versioned data, не code.
- Demo pack содержит только original placeholders.

## Local runtime

- PostgreSQL для authoritative snapshots/events/receipts.
- Authenticated in-process SSE hub передаёт только version invalidation.
- Backend остаётся source of truth; reconnect/gap лечится HTTP resync.
- Root `docker-compose.yml` и `scripts/dev.sh`.

## Agent tooling

- Vendored snapshot `tools/leinoctl`, Node >=20, runtime dependencies отсутствуют.
- Munchkin facts находятся в `.leino`.
- Session runtime находится в ignored `.leino/runtime`.
