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

## MEM-005 — canonical runner must execute the declared tool path

- **Факт:** toolchain inspection and actual component execution must share the
  profile resolver. Before the 2026-08-02 fix, Windows verification inspected
  `pnpm@env:LEINO_PNPM_EXECUTABLE` but spawned unqualified `pnpm`, which could
  select a standalone `pnpm.exe` with embedded Node 18.5 instead of bundled
  Node 24 and cause sandbox `EPERM`/self-switch hangs. Also, an external
  command timeout covers the whole sequential canonical verify; it is not the
  duration of the last displayed build.
- **Источники:** `.leino/profile.json`, `tools/leinoctl/src/cli.mjs`,
  `tools/leinoctl/src/runner.mjs`, `tools/leinoctl/test/cli.test.mjs`,
  `docs/agents/HARNESS.md`.
- **Проверено:** 2026-08-02.

## MEM-006 — Windows entrypoint tests require Git Bash resolution

- **Факт:** `tools/leinoctl/test/entrypoints.test.mjs` intentionally spawns
  `bash`. Running the whole Node suite from a default PowerShell `PATH` may
  produce two false entrypoint failures when Git Bash is not the resolved
  executable. Put bundled Node 24 and `C:\Program Files\Git\bin` first in the
  process-local `PATH`; the focused entrypoint suite then passes 3/3. This is
  toolchain evidence, not a Compose/product regression.
- **Источники:** `tools/leinoctl/test/entrypoints.test.mjs`,
  `docs/agents/HARNESS.md`.
- **Проверено:** 2026-08-02.

## MEM-007 — Compose config in sandbox must not read owner Docker credentials

- **Факт:** the canonical `docker compose --parallel 8 config` check is
  read-only but Docker still attempts to read the user-level
  `C:\Users\Maks\.docker\config.json`. A restricted session can fail with
  `Access is denied` after every prior canonical check passes. Use an empty
  process-local `DOCKER_CONFIG` directory for this verification; do not expose
  or copy the owner's Docker config. This does not log in, pull, push or change
  Registry state.
- **Источники:** `.leino/components/repository-workflow.json`,
  `docs/agents/HARNESS.md`.
- **Проверено:** 2026-08-02.

## MEM-008 — selected live-evidence plan may contain an audited forward commit

- **Факт:** plan, которому нужен push для terminal CI evidence, не должен
  сбрасывать session baseline или добавлять `.git/HEAD` в source write set.
  `leinoctl` принимает только fast-forward от baseline, перечисляет объединение
  путей каждого commit в диапазоне и разрешает HEAD transition лишь когда все
  эти пути находятся в lifecycle/write set. Rewind/divergent/unverified HEAD
  остаётся fail-closed; HEAD входит в verification fingerprint, поэтому новый
  commit делает прежнее evidence stale.
- **Источники:** `tools/leinoctl/src/git.mjs`,
  `tools/leinoctl/src/session.mjs`, `tools/leinoctl/test/git.test.mjs`,
  `tools/leinoctl/test/session.test.mjs`, `docs/agents/HARNESS.md`.
- **Проверено:** 2026-08-02.
