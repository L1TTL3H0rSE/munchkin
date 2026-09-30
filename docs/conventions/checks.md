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
pnpm --filter @munchkin/web build
pnpm --filter @munchkin/components exec playwright install chromium
pnpm test:browser
pnpm test:e2e
```

`pnpm test:browser` runs every Storybook story in Chromium plus the components
`browser` project: layout geometry, axe (serious/critical) and screenshot
regression of the product screens. Screenshot references are per platform
(`*-chromium-win32.png`); review new or changed frames before committing them and
never bulk-update to hide a regression. CI on Linux sets `UPDATE_SNAPSHOT=all`, so
there it records frames without comparing them. Pass `STORYBOOK_TEST_PORT` /
`BROWSER_TEST_PORT` for parallel runs.

`pnpm test:e2e` is the real two-player browser -> Nuxt -> Go HTTP/SSE flow
(`frontend/test/browser`). It needs Go; the runner starts both servers, owns
temporary artifacts and bounded cleanup, and is independent of the calling cwd.
Failed artifacts remain at its printed OS-temp path. Presentation states are not
tested here: they live in screen stories.

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
