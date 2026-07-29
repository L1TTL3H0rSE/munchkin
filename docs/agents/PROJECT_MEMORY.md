# Долговечная память проекта

Только подтверждённые неочевидные факты/ловушки со ссылкой на source и датой.
Это не журнал задач.

## MEM-001 — target hooks требуют новую trusted session

- **Факт:** session, которая впервые создала `.codex`, не доказывает, что эти
  hooks загружены. Bootstrap проверяет их вручную; enforcement начинается в
  следующей trusted session.
- **Источники:** `docs/agents/HARNESS.md`, `.codex/hooks.json`.
- **Проверено:** 2026-07-29.

## MEM-002 — repository может иметь unborn HEAD

- **Факт:** initial bootstrap не создаёт commit. `leinoctl` snapshot хранит
  `head: null` и обязан поддерживать preflight/plan baseline до первого commit.
- **Источники:** `tools/leinoctl/src/git.mjs`,
  `tools/leinoctl/test/git.test.mjs`.
- **Проверено:** 2026-07-29.

## MEM-003 — realtime не переносит player state

- **Факт:** общий private room channel содержит только version invalidation.
  Любая player-specific projection читается через authenticated HTTP.
- **Источники:** `docs/agents/decisions/0002-authoritative-deterministic-game-engine.md`,
  `backend/game/internal/game/projection.go`.
- **Проверено:** 2026-07-29.
