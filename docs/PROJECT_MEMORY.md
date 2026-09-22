# Долговечная память проекта

Только подтверждённые неочевидные факты/ловушки со ссылкой на source и датой.
Это не журнал задач.

## MEM-003 — realtime не переносит player state

- **Факт:** общий private room channel содержит только version invalidation.
  Любая player-specific projection читается через authenticated HTTP.
- **Источники:** `docs/decisions/0002-authoritative-deterministic-game-engine.md`,
  `backend/game/internal/game/projection.go`.
- **Проверено:** 2026-07-29.

## MEM-004 — production documentation separates local contracts from live evidence

- **Факт:** README and the production architecture/demo index must label
  repository-side implementation separately from unrun DNS/HTTPS, cloud, VM,
  WIF/registry, Monium and backup runtime evidence. The expected hostname is
  not a public URL claim until valid HTTPS smoke is recorded.
- **Источники:** `docs/architecture/PRODUCTION_INFRASTRUCTURE.md`,
  `docs/demo/CONTEST_DEMO.md`, archived plans
  `docs/history/leino/plans/archive/20260731T005308Z-3beea1-production-security-and-supply-chain.md`
  and `docs/history/leino/plans/archive/20260731T005307Z-5662b5-postgres-object-storage-backup-and-restore.md`.
- **Проверено:** 2026-08-01.
