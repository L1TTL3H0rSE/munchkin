# Template / screen Storybook migration

Status: implementation complete; final acceptance has pre-existing browser gaps
(listed below). Owner: root orchestrator. Authorized in full by the user on
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
| Bootstrap and baseline | root | migration | bc79001 | workflow/docs/scripts/CI | complete f9a0acf |
| Donor boundary research | donor_boundaries, read-only | donor clones | above | docs/config/screens | complete |
| Screen/state inventory | screen_inventory, read-only | migration | bc79001 | frontend | complete |
| Workspace + first vertical slice | root | migration | f9a0acf | frontend | complete d9b93a6 |
| Independent screen families | native writers | table/interactions/entry | d9b93a6 | four story files | complete, integrated commits below |
| Integrated review and verification | root + reviewer | migration + verification + baseline | final integration / bc79001 | full diff | checks executed;45 baseline browser failures remain |

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

## Foundation checkpoint

- Bootstrap commit: f9a0acf4a97f721423b8ae7a2b132558bcfc57ef.
- A fresh read-only CLI session in this worktree actually read replacement
  instructions and found no local hook registration. Native worktree_probe wrote,
  read and removed its own temporary file in the clean probe worktree, without
  Leino. This does not assert reload of the original parent session's hooks.
- Baseline Chromium installed: original lobby 11/11 PASS before UI changes.
  Baseline public/_nuxt assets: 8,953,969 bytes; Nuxt output 24 MB (gzip 9.65 MB).
- Actual PostgreSQL contract PASS using a disposable tmpfs container named
  munchkin-migration-postgres-20260922. It was stopped after final checks; no
  permanent volume was attached or removed. postgres-contract.log.
- Workspace now uses pnpm 11.22.0, catalog Storybook 10.5.8/Vite 8.2.1/Vitest
  4.1.11 from donor stack, keeps Node >=24 and existing Nuxt/Vue/TypeScript versions.
  Contracts/shared/api/components expose built dist; shared owns countdown/types,
  api owns HTTP/SSE/errors, web keeps credential/session/route controllers.
- Product screens LobbyScreen and GameScreen are exported only by /screens.
  GameScreen reuses the original table/modal coordinator with typed required
  props and intent emits. No game transition moved to presentation.
- All original components/styles moved with their visual behavior intact. Lobby
  PNGs are local public assets, not inlined multi-megabyte module strings. Studio
  remains in Nuxt with its existing development/auth gates.
- Test fixtures moved to components/test/fixtures for shared Storybook/E2E usage;
  original privacy tests remain. Production imports never use this directory.
- First vertical proof: build:local PASS; lint/typecheck PASS; unit PASS
  (web 160 + shared countdown 3, preserving the original 163; added api 2 and
  generator 2); static Storybook PASS; Storybook Chromium 5/5 PASS; actual Nuxt
  dist consumer build PASS; migrated lobby browser 11/11 PASS, no changed
  assertions or snapshots. Logs foundation-*, lobby-story*, lobby-consumer-build,
  lobby-migrated-browser in the evidence directory.
- Intermediate browser launch failures were module resolution of direct contracts
  source imports after dist conversion. Tests now use the public package; root
  test tooling explicitly depends on contracts. No test skipped to resolve this.
- Foundation was pinned before the three disjoint story families were delegated.
  Root retained guards/config/exports/CI/docs and integration ownership.

## Parallel screen checkpoint (2026-09-22)

Foundation pinned at d9b93a64a5fdb827abe1fb85d1ed6a95d24c69f3. Native workers
verified separate worktrees/branches before writing; each owns only family story
files. Shared fixes remain root-owned and are cherry-picked by workers. Browser
slots are granted serially, never shared by running workers.

| Task | Owner | Worktree/branch | Base | Owned paths | Status |
| --- | --- | --- | --- | --- | --- |
| Table/hand/equipment | table_screens | munchkin-worktrees/table, codex/migration-table | d9b93a6 | TableScreen.stories.ts | 50 Chromium PASS; integrated 8e95fb9 |
| Interaction/dialog | interaction_screens | munchkin-worktrees/interactions, codex/migration-interactions | d9b93a6 | InteractionScreen.stories.ts | 56 Chromium PASS; integrated adea28b |
| Lobby/system | entry_screens | munchkin-worktrees/entry, codex/migration-entry | d9b93a6 | LobbyScreen.stories.ts, SystemScreen.stories.ts | 53 Chromium PASS; integrated f8780aa |
| Shared integration | root | migration | d9b93a6 | guards/config/CI/docs/exports | complete through23e21ab; final verification recorded below |

Root shared fixes: 2c14e6d forwards existing recovery retry and corrects event-spy
names; 8ce87e4/3bccca2 stop retained combat detail from displacing current end-turn
or finished presentation actions (available server actions unchanged; regression
assertions added); ff4197e preserves the original table focus target across an
optional Character -> Actions sheet chain. Native keyboard checks exposed these
issues; no baseline assertions/snapshots removed.

- Source production graph traverses 95 modules: PASS. Added negative reachable
  fixture imports from root, screens and application; empty graph negative case;
  built module guard rejects test/design-only dependencies. 7 guard/generator
  tests PASS. Guarded component build PASS. Final coverage guard results appear
  below:43 existing Figma states +13 lobby states at both viewports.
- Library/app builds use dist. Test fixture files retain all56 scenarios. Workers
  are adding extra existing scenario variants, not new product features.
- Current pre-existing compact terminal limitation: winner/result is shown, but
  detailed results toggle/list remains desktop-only; terminal Character/Hand dock
  does not mount optional coordinator. This migration preserves that layout;
  do not claim those compact dock actions are functional or Figma parity proven.
- Live Figma screenshot request for existing file bmxy6z3Z0bBLHLYryYJYrP node240:53
  succeeded (1440x900 original). Provider returned short-lived URL, not local image;
  web image fetch unavailable. Existing41 regression PNGs remain untouched.
  Source Figma IDs retained; full fresh visual parity is not claimed.
- Root updated Docker manifests for all built packages and pnpm11.22.0, CI for
  ordinary gates+Storybook/Chromium, docs for current ownership. No CI remote run,
  image publication or production action was invoked. Final integrated, Docker
  and clean checkout verification results appear below.

## Integrated acceptance checkpoint

Integrated worker commits:8e95fb9(table50), f8780aa(lobby/system53),
adea28b(interactions56). All56 original fixture scenarios now appear in real
screen stories. Source+built catalog check maps43 existing Figma states +13 lobby
states to159 stories and both viewport dimensions. The missing-state, missing
story, empty-catalog and forbidden-import negative tests fail as intended.

- Final frozen install, build:local, lint, typecheck, pnpm test PASS. Web27 files /
  161 tests (one additional action-priority regression); components10, API2,
  shared3 plus existing contracts suite. No original assertion removed.
- Final build:storybook PASS (159 actual catalog entries); integrated Chromium
  Storybook159/159 PASS. Static manager emits its existing nonfatal >500kB chunk
  warning; no invented budget/disabled threshold. Storybook browser compile emits
  Vue decodeEntities warning, no test failure.
- Actual Nuxt dist consumer build PASS:23.7MB/gzip9.59MB server+public output.
  public/_nuxt assets now588,213 bytes versus8,953,969 baseline; two original PNGs
  are served once at /munchkin instead of duplicated/inlined JS. Total image bytes
  are still part of the delivered site; this is no claimed performance budget.
- Product source boundary95 modules PASS; built Vite module graph PASS; no fixture
  marker/story import in production dist/_nuxt. Repeated component generator
  produces no diff against its committed generated index.
- Repository8 tests, runner6, content32, demo semantic digest PASS. Final Go
  build/vet/test all PASS; postgres package ran against the isolated tmpfs DB
  (not skipped). Compose config and Docker build/runtime smoke PASS.
- Independent reviewer found moved-doc relative links broken. Path-only fix
  applied to active docs; reviewer reran local-link scan:PASS. No observed
  authority/privacy or production fixture/dist regression in integrated review.
- Full original Chromium browser/visual suite:196 PASS,45 FAIL /241, log
  final-browser.log. Independent bc79001 baseline ran all49 tests in the four
  failing families:4 PASS,45 FAIL with exactly the same failure set. See
  baseline-browser-comparison.log and baseline-failure-comparison.json.
  Breakdown:5 death-loot,3 helper-offer,2 target-run-away,35 visual. Reviewer
  confirmed source/fixture drift predates migration; representative combat and
  mobile lobby actual PNGs are byte-identical between baseline and migration.
  All41 committed snapshots and original assertions remain unchanged.
- Clean worktree verification started at ed18b61, frozen install/build/lint PASS.
  Typecheck exposed GameFetch.method being wider than Nuxt's fetch method union;
  narrowed it to actual GET/POST usage in544e32b (verification cherry-pick020c163).
  Rebuilt API, then clean check (types+tests), static Storybook159 and web build
  PASS. Logs clean-*. Integration build:local/typecheck also rerun after this fix.
- A final fresh read-only CLI session actually read the five current instruction
  and config files at020c163. No per-plan Leino approval or local hook registration
  remains; session remained read-only. final-fresh-session.txt/jsonl. This does
  not assert inspection or unloading of global managed hooks.
- Real Go/Nuxt two-player suite:2/2 PASS, final-real-boundary-resync.log. The first
  test now additionally disconnects an observer browser, advances the other actor,
  restores the network, and asserts a newer actor-specific GET plus rendered
  data-phase. Existing complete-turn and multiplayer/privacy assertions remain.
  Initial invocation used an empty content environment by mistake (demo fallback);
  corrected to explicit moscow/v5. An initial reconnect probe expected an idle
  SSE stream to close before traffic; Chromium keeps it open, so the test now
  advances the real other actor before asserting disconnection and resync.
- Docker config/build PASS for isolated project munchkin-migration-20260922:
  final-docker-build.log. Built images were started without volumes; API health,
  Nuxt SSR, built CSS and both original PNG byte lengths PASS in
  docker-image-smoke.log. Both owned smoke containers were stopped and removed.
- Standalone static Storybook manager caught an iframe-resize race absent from
  Vitest. All four story families now wait for the exact same required width;
  assertions were not removed. Component lint/types, static159 coverage and all
  159 Chromium stories PASS again (story-viewport-*, final-stories-after-viewport-fix).
  Actual manager plus six wide/compact views PASS without backend requests,
  console/page errors or broken images. standalone-storybook-smoke.log and
  storybook-manager.png/screens-*.png; root visually inspected manager and compact
  preparation. Final reviewer found no remaining actionable migration regression.
- Coverage mapping is executable in frontend/packages/components/test/storyCoverage.ts:
  state/Figma node -> production screen -> story ID/viewport -> props/emits/actions
  -> behavioral and visual checks. All56 original scenario fixtures are represented.
- Final implementation commit:23e21ab9792d22a9b9df700542ddbc37c21a28da.
  Verification worktree090f1c060431077e06f4d9a947a3fcbf519b50a4 has an identical
  tracked tree. Repeated frozen install, build:local, lint, check (typecheck +195
  unit tests), static Storybook159 and actual Nuxt consumer build all PASS;
  final-clean-*.log. Generator left both worktrees clean; Leino absent from PATH.
- Final fresh read-only session at090f1c0 loaded the current five instruction/
  configuration files, including Storybook check commands. No Leino approvals or
  repository hook registrations; acceptance-fresh-session.txt/jsonl. It performed
  no writes, tests, installs, subagent launches or permission changes.
- All owned temporary servers and three disposable Docker containers are stopped;
  no labelled migration container remains. Local branches/worktrees and evidence
  are retained for continuation. No game backend/content behavior changed;
  original main remains bc79001 with the same two user-owned changes.

## Acceptance gaps and limits

- Acceptance is partial because the preserved legacy browser/visual suite is not
  green:45 independently reproduced baseline failures above. Do not update its
  snapshots or weaken assertions to hide them; repairing unrelated fixture and
  old-snapshot drift is separate work.
- Full fresh Figma parity was not established: screenshot provider returned an
  asset URL, but viewing it failed. Existing real node IDs/materials and baseline
  images were retained. Compact terminal limitations above remain unchanged.
- Remote CI/publication/production were not run; no push or remote-main merge.
  Fresh session verifies repository instructions only, not global managed hooks.
