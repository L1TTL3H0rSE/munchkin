# Стек

Обновлено 2026-09-22. Перед update сверяй manifest/lock конкретного
компонента.

## Backend

- Go directive: 1.25.12.
- Один module `backend/game`.
- Standard `net/http` transport.
- PostgreSQL через pgx v5.
- SQL migrations принадлежат game service.
- Pure deterministic engine не импортирует infrastructure.
- JSON HTTP/realtime contracts versioned.

## Frontend

- Node.js >=24 для одинаковых local/CI проверок.
- pnpm 11.22.0 из packageManager.
- Nuxt 4, Vue 3, TypeScript, Zod; Pinia не установлен без потребителя.
- Storybook 10.5.8, Vite 8.2.1, Vitest 4.1.11, Chromium через Playwright.
- Один workspace lockfile в `frontend/pnpm-lock.yaml`.
- `applications/web` — deployable UI.
- `packages/contracts` — wire schemas; `api` — HTTP/SSE transport.
- `packages/shared` — независимые типы/countdown; `components` — presentation.
- Product screens доступны через `@munchkin/components/screens` и dist exports.
- Fixtures живут отдельно в `components/test/fixtures`, не в production exports.

## Content

- JSON Schema + semantic validator на Node standard library.
- Packs — immutable versioned data, не code.
- Demo pack содержит только original placeholders.

## Local runtime

- PostgreSQL для authoritative snapshots/events/receipts.
- Authenticated in-process SSE hub передаёт только version invalidation.
- Backend остаётся source of truth; reconnect/gap лечится HTTP resync.
- Root `docker-compose.yml` и `scripts/dev.sh`.
