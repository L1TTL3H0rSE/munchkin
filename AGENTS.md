# Munchkin repository instructions

Read [docs/README.md](docs/README.md), then the nearest AGENTS.md and relevant
source/config/tests. Check git status first; never overwrite, stash or discard
user changes. Source and executable checks outrank ADRs, docs and historical notes.

## Work and verification

Implement the authorized scope with the smallest coherent change. Record long
work in one task document (this migration: docs/migrations/template-storybook.md).
No per-plan IDs or manual approval ledger are required. Run the ordinary commands
in [docs/conventions/checks.md](docs/conventions/checks.md), inspect the diff and
report actual failures/skips separately. Do not weaken tests to obtain a pass.
Generated files change through their source/generator; repeat generation must be
clean. Read/write strict UTF-8; stop on invalid bytes, U+FFFD or mojibake.

One root orchestrator owns integration and shared decisions. Independent writers
use separate Git worktrees/branches from a recorded SHA. Verify cwd, git root,
branch and HEAD before writing. Assign exact paths, contracts, checks and stop
conditions; no overlapping writes, no worker delegation. Root alone changes
manifests/lockfile/exports/config/tokens/CI/shared contracts and integrates commits.
Use native subagents and Git, never a new orchestration service. Serialize heavy
browser/Compose checks and assign isolated ports/output paths.

## Game and security invariants

- Backend is authoritative. Client sends intent; never actor/RNG/deck position or
  combat outcome. Actor derives only from a server-validated credential.
- backend/game/internal/game is deterministic and pure: no network, env, DB,
  global RNG or clock reads. Realized random outcomes are events; replay uses them.
- Immutable content identity/version/digest is bound to each game.
- Transport exposes actor-specific allowlisted projections only. Other hands are
  counts; no deck order, RNG, credentials or internal state. SSE is invalidation
  only; reconnect/gaps/conflicts refresh the actor projection.
- Idempotency is (game_id, actor_id, command_id) with canonical fingerprint and
  expected version; events/snapshot/receipt commit atomically.
- Content executes only the closed typed effect registry; no eval/scripts or
  arbitrary asset paths. Preserve content licensing/provenance.
- Studio is disabled by default and protected by its separate credential.

## Scope safety

Never expose secrets or touch production/user data/permanent volumes without
explicit scope. Do not change global tools or donor repositories. No reset/clean/
force checkout. Use scripts/dev.sh for local Compose; direct Compose invocations
have exactly one --parallel N (N >= 4). No volume deletion in dev scripts.
Historical documents in docs/history are evidence, not current instructions.
Changing instruction/hook files does not prove they loaded in an existing session;
verify in a fresh session and report this limitation when untested.
