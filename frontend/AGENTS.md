# Frontend

Read ../docs/frontend/engineering.md and ../docs/frontend/ui.md. Run commands
from frontend. One workspace/lockfile; shared versions use catalog and internal
packages workspace:*. Node >=24; packageManager in package.json selects pnpm.

applications/web owns Nuxt routes, session, controllers and adapters. components
owns presentation (including product screens), typed props/slots and intent emits;
no HTTP, Nuxt router, app stores or authoritative transitions. shared owns only
independent reused utilities; api owns transport; contracts owns wire schemas.
Packages export built dist and are verified by the actual web consumer. Product
screens have their own screens subpath. Story data/design-only compositions never
reach production exports or defaults. Use explicit Vue imports outside Nuxt.
Preserve Munchkin visuals, tokens, assets, accessibility and all existing states.

Preserve validated credentials, expected version/idempotency, private hands and
invalidation-only realtime. Parse unknown transport/storage payloads. No any/raw
JSON escape hatch or optimistic authoritative result. Reconnect/gap refreshes the
actor projection. Studio remains opt-in and separately authenticated.

Use pnpm build:local, pnpm lint, pnpm typecheck, pnpm test, pnpm build:storybook,
pnpm test:browser, pnpm test:e2e and pnpm --filter @munchkin/web build. See
../docs/conventions/checks.md. Each package tests what it owns: component models
and screen states in components (unit, story play functions, test/browser), app
controllers/adapters in web. New UI states get a screen story; there is no
fixture-mocked app suite. test:e2e is the real browser -> Nuxt -> Go flow only.
Compare existing screenshots; do not bulk-update references to hide a regression.
