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

## MEM-004 — production documentation separates local contracts from live evidence

- **Факт:** README and the production architecture/demo index must label
  repository-side implementation separately from unrun DNS/HTTPS, cloud, VM,
  WIF/registry, Monium and backup runtime evidence. The expected hostname is
  not a public URL claim until valid HTTPS smoke is recorded.
- **Источники:** `docs/architecture/PRODUCTION_INFRASTRUCTURE.md`,
  `docs/demo/CONTEST_DEMO.md`, archived plans
  `docs/agents/plans/archive/20260731T005308Z-3beea1-production-security-and-supply-chain.md`
  and `docs/agents/plans/archive/20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore.md`.
- **Проверено:** 2026-08-01.
