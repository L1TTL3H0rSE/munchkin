# ADR-0012: Screen-level UI verification, real-boundary-only app E2E

Status: accepted, 2026-09-30. Refines ADR-0011.

The former app-level Playwright suite rendered the Nuxt game route with fixture
projections injected through mocked HTTP/SSE. Once product screens moved into
`@munchkin/components`, it duplicated the screen stories, needed a dev server and
devtools workarounds, and its screenshots were tied to one platform's fonts. Its
expectations had drifted since the August Figma remediation: 45 of 241 cases were
red before and after the template migration.

UI states are verified where they are owned. Story play functions assert
behaviour, emitted intents, focus and dialog rules. The components `browser`
Vitest project asserts layout geometry over the viewport matrix, forced colors and
reduced motion, axe serious/critical violations and screenshot regression of the
product screens. `pnpm test:e2e` is the only app-level browser suite; it runs
against real Nuxt and Go servers (two-player flow, reconnect/resync, app shell,
dev-only Studio surface). The application never swaps HTTP for fixtures.

Screenshot references are per platform and captured on win32. Linux CI records
frames without comparing them, as in the donor, until a pinned Linux reference
environment exists. Fixture data stays test-only; production entries must not
reach it (public-surface check).
