# Reproducible checks

Use Node >=24 and the pnpm version declared by frontend/package.json. Install
through Corepack or an equivalent version-pinned local command; no global tool
replacement is required. Go selects the version in backend/game/go.mod.

From the repository root:

```sh
node scripts/check-text.mjs
node --test scripts/test/*.test.mjs
node --test frontend/test/run-playwright.test.mjs
node --test content/tools/validate.test.mjs
node content/tools/validate.mjs content/sets/demo/cards.json
git diff --check
./scripts/dev.sh config --quiet
```

From backend/game:

```sh
go build ./...
go vet ./...
go test ./...
```

The PostgreSQL service contract needs a real disposable database:
`TEST_DATABASE_URL=... go test ./internal/repository/postgres -run TestPostgresServiceContract -count=1`.
A skipped database test is not a pass. Never point this suite at user/production data.

From frontend:

```sh
pnpm install --frozen-lockfile
pnpm build:local
pnpm lint
pnpm typecheck
pnpm test
pnpm build:storybook
pnpm --filter @munchkin/components exec playwright install chromium
pnpm --filter @munchkin/components test:stories
pnpm --filter @munchkin/web build
node test/run-playwright.mjs test --workers=1
```

Use `MUNCHKIN_REAL_E2E=1` with the real-boundary browser suite for the two-player
HTTP/SSE flow. The browser runner owns temporary artifacts and bounded cleanup;
failed artifacts remain at its printed OS-temp path. Run heavy browser checks
serially on assigned free ports. The runner is independent of the calling cwd.

New checks need positive and representative negative cases. Missing files, empty
story catalogs or skipped suites are not successful verification. Keep existing
assertions and visual baselines; review justified snapshot changes explicitly.
Rebuild packages from sources, repeat generators to prove determinism, then build
the actual consumer using dist exports. No `--if-present` proof for required gates.

For local Docker use `./scripts/dev.sh` (up/build), `./scripts/dev.sh config`,
`./scripts/dev.sh down`, and `./scripts/dev.sh build game web`. No volume deletion.
Integration verification uses its own Compose project and disposable storage.

Changing instructions or hook registrations requires a fresh-session read check;
current-session success proves only filesystem changes and direct checks. Record
unavailable checks separately from regressions and from pre-existing failures.
