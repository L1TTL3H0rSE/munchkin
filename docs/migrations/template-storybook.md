# Template / screen Storybook migration

Status: in progress. Owner: root orchestrator. Authorized in full by the user on
2026-09-22 and `C:/Dev/_Personal/munchkin/munchkin-migration-mandate.md`.
That authorization replaces the repository's former per-plan approval and
single-checkout writer restrictions for this migration. No remote push, production
changes, donor writes, global tooling changes or permanent-volume deletion.

## Reproducible bases and work

- Munchkin: `bc79001b436b1b8beb52abcca7ea24e5717a58dd`, matches remote HEAD.
- Template local clean HEAD: `858dfe1a1bae54e2d832bf5f1f96a0ced1e6fdfd`;
  remote HEAD: `370f1ecf6d6a8c2010b8c941148890a1c8d1cbeb`. The donor was updated
  externally during initial reading; its now-clean HEAD and remote agree at
  `370f1ec`. Freeze this ref. Reviewed 858..370: no frontend toolchain/export
  changes; template-only runner/identity improvements and one demo CSS fix.
- Roleplay committed HEAD: `ed71a133a5977178d5db5f019d5be114992b769f`, matches
  remote HEAD. Its dirty backend work is unrelated and must remain untouched.
- Integration branch: `codex/template-storybook-migration`.
- Integration worktree: `C:/Dev/_Personal/munchkin-worktrees/migration`.
- Original checkout remains on `main`, with the user's `.codex/config.toml`
  changes and untracked mandate untouched. Uncommitted files were not copied.
- Evidence directory: `C:/Users/shelo/AppData/Local/Temp/munchkin-migration-20260922`.

## Execution boundaries

Root owns bootstrap, manifests/catalog/lockfile, shared contracts/exports/config,
tokens, generators, CI, instructions, coverage matrix and this journal. First
prove one product screen in app + Storybook before assigning independent screen
families. Each writer gets its own branch/worktree and must verify root/branch/HEAD.
Only root integrates, with sequential checks and commits. Workers cannot delegate.
Use native agents and Git; do not introduce an orchestration framework.

Preserve server authority, credential-derived actor, actor-specific projections,
event-recorded randomness, deterministic replay, immutable content identity,
idempotency fingerprint and expected version. Keep HTTP/SSE and existing Go module
paths. The components package owns presentation only; fixture/story code is not
part of the production entry. Studio remains dev-only and disabled by default.

## Task table

| Task | Owner | Worktree | Base | Paths | Status |
| --- | --- | --- | --- | --- | --- |
| Bootstrap and baseline | root | migration | bc79001 | workflow/docs/scripts/CI | running |
| Donor boundary research | donor_boundaries, read-only | donor clones | above | docs/config/screens | running |
| Screen/state inventory | screen_inventory, read-only | migration | bc79001 | frontend | running |
| Workspace + first vertical slice | root | migration | after bootstrap | frontend | pending |
| Independent screen families | native writers | separate worktrees | fixed integration commit | assigned later | pending |
| Integrated review and verification | root + reviewer | migration | final integration | full diff | pending |

## Initial evidence

- Git metadata and `.codex` allow a temporary write/remove probe in the integration
  worktree. Worktree creation succeeded; native explorer agents actually started.
- CLI `codex-cli 0.153.0` exposes `--approve-for-me`, sandbox/approval modes and
  `-C`. This running task's provided permission policy is unchanged. No nested
  orchestrator or sandbox bypass was started.
- Node `24.19.0`; frontend package-selected pnpm `10.8.0`; host Go `1.25.7`
  downloads module-required `1.25.12`; Docker server `29.4.1` reachable.
- The original user config has hooks disabled. This does not prove a future
  worktree session has loaded replacement instructions; fresh-session verification
  remains outstanding until explicitly tested.
- Baseline frozen install, Go build/vet/test, content checks and Compose config
  started before implementation; results to be recorded below.

## Remaining acceptance work

Bootstrap removal; package builds/exports and consumer; full story/state mapping;
positive and negative public-surface/coverage checks; deterministic Chromium
stories and interactions; existing unit/contract/browser/privacy/real-PostgreSQL
checks; visual baseline comparison; Docker config/build and real two-player smoke;
fresh checkout and fresh-session checks; final reviewer and evidence report.

Resume by reading this file and `git status` in the integration worktree. Do not
restart completed research or alter the original checkout.

## Bootstrap evidence and decisions

- Baseline frozen install PASS (pnpm 10.8.0); lint/check/build PASS. Web unit
  suite: 28 files, 163 tests; see baseline-*.log in the evidence directory.
- Baseline Go build/vet/test PASS; PostgreSQL is skipped without its test URL
  and is still a separate required real-database check. Content/schema 32/32 PASS;
  demo semantic validation and Docker Compose config PASS.
- Baseline lobby browser: 11 failures before execution because pinned Chromium
  was absent. Installing the matching Chromium and rerunning before UI changes.
- Removed project hook registrations, implementations, vendored CLI, registry
  and retired lifecycle tests. Preserved UTF-8 validation and its 7 tests as
  scripts/lib/text.mjs + scripts/test/text.test.mjs. Playwright runner unchanged,
  6/6 runner safety tests PASS. Plain Compose config and text check PASS.
- Archived former plans/handoffs without modifying their content. Useful game
  memory remains; ADR-0011 explicitly replaces the former harness decision.
- Source state inventory complete: 43 Figma matrix states, 56 test scenarios;
  first vertical slice will be lobby. Root keeps modal coordination/shared types.
- Tool policy rejected a combined recursive directory-removal shell command.
  Removed only verified tracked retired files with ordinary git rm instead;
  no permission or sandbox changes, no untracked/user files removed.
