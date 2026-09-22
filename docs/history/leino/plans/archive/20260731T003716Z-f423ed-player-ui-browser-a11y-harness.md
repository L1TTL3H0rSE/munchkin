# PLAN: player ui browser a11y harness

- **Plan ID:** `20260731T003716Z-f423ed-player-ui-browser-a11y-harness`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 20:25:35 +03:00
- **Владелец:** Codex session `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260729T234102Z-898ef6-frontend-engineering-spec`, `20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation`.
- **Блокирует:** `20260731T003715Z-aaacfd-responsive-lobby-entry`, `20260731T003716Z-a8bca4-advanced-combat-effects-ui`, `20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`
- **Связанные ADR/handoff:** `docs/agents/GAME_UI_UX_SPEC.md`, `docs/agents/HARNESS.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".gitlab-ci.yml",
    "frontend/package.json",
    "frontend/pnpm-workspace.yaml",
    "frontend/pnpm-lock.yaml",
    "frontend/playwright.config.ts",
    "frontend/applications/web/app/plugins/uiFixture.client.ts",
    "frontend/applications/web/test/fixtures/**",
    "frontend/test/run-playwright.mjs",
    "frontend/test/browser/**",
    "frontend/test/browser/visual-baselines/**",
    "docs/agents/plans/active/20260731T003716Z-f423ed-player-ui-browser-a11y-harness.md",
    "docs/agents/plans/archive/20260731T003716Z-f423ed-player-ui-browser-a11y-harness.md"
  ],
  "components": [
    "frontend-workspace",
    "repository-workflow"
  ],
  "contracts": [
    "pnpm:@munchkin/contracts",
    "frontend:browser-a11y-harness-v1"
  ],
  "dependsOn": [
    "20260729T234102Z-898ef6-frontend-engineering-spec",
    "20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation"
  ],
  "sharedResources": [
    "frontend:browser-a11y-harness-v1",
    "frontend:pnpm-lockfile",
    "ci:gitlab"
  ]
}
```

## Цель

Создать repository-pinned Playwright + axe harness с actor-specific
deterministic fixtures, viewport/overflow/focus/a11y assertions, portable
snapshot policy and separate real-boundary smoke, не пряча product redesign в
test setup.

## Критерии приёмки

- [x] Playwright/browser/axe versions pinned through catalog/one lockfile;
  no nested lock or platform-unbounded latest download.
- [x] Fixture adapter selected once in explicit test composition root and
  impossible in production config; it returns only strict parsed public DTO.
- [x] Minimum 20 UI spec fixtures cover 1/6 players, phases, long Russian copy,
  missing art, offline/stale, interactions, helper, economy, death and victory
  as their contracts become available.
- [x] Fixtures contain no credentials, foreign hand, deck order, RNG/internal
  state or raw events and pass Zod plus privacy-negative tests.
- [x] Automated matrix checks root overflow, labeled rails, first/last focus,
  contextual action-rail close/removal state, reduced motion, forced colors and
  selected axe serious/critical violations. Dialog/sheet trap/return remains
  explicitly deferred until the product exposes a modal interaction surface;
  the harness does not invent product behavior outside this plan's write set.
- [x] Complete N-1/N/N+1 matrix runs only dense critical fixtures; all fixtures
  run representative widths per UI spec to bound CI duration.
- [x] Visual baselines define OS/browser/font policy; unsupported platform
  does not silently overwrite accepted snapshots.
- [x] One smoke path launches real Go HTTP/application boundary and web app;
  fixture visual tests are not called cross-layer E2E.
- [x] CI artifacts include failure screenshots/traces/reports without secrets.
- [x] Existing unit/lint/check/build and repository jobs retain parity.

## Контекст и подтверждённое состояние

- Frontend has Vitest only; no Playwright/Cypress/axe/visual dependency.
- UI spec defines fixtures, viewport tiers and honest automation boundary.
- Current Terraform plan does not touch CI/frontend lockfile, but all other
  dependency/CI plans are exclusive by repository policy.

## Scope

### Входит

- Pinned browser/axe tooling, deterministic fixture adapter/data, assertions,
  visual policy, real-boundary smoke and GitLab CI job.

### Не входит

- Product Vue/CSS redesign, backend mechanics, Terraform, external UI skills
  or auto-updating baselines.

## Архитектурный подход

1. Keep fixtures actor-specific and schema-parsed.
2. Separate fixture visual/a11y suite from real backend E2E smoke.
3. Centralize viewport/accessibility helpers and stable artifact policy.
4. Make CI explicit, bounded and reproducible.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| frontend workspace | Browser/axe dependencies and config | One lockfile |
| test fixtures | Strict actor projections | No private data |
| CI | Browser/a11y/visual jobs | Pinned artifacts/policy |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.gitlab-ci.yml` | write | Browser job |
| `frontend/package.json` | write | Scripts/dependencies |
| `frontend/pnpm-workspace.yaml` | write | Catalog pins |
| `frontend/pnpm-lock.yaml` | generated | Lockfile |
| `frontend/playwright.config.ts` | write | Projects/artifacts/snapshot policy |
| `frontend/applications/web/app/plugins/uiFixture.client.ts` | write | Test-only composition root |
| `frontend/applications/web/test/fixtures/**` | write | Actor-specific fixtures |
| `frontend/test/run-playwright.mjs` | write | Cross-platform Playwright launcher |
| `frontend/test/browser/**` | write | Browser/a11y/real smoke tests |
| `frontend/test/browser/visual-baselines/**` | generated | Reviewed baselines |
| `docs/agents/plans/active/20260731T003716Z-f423ed-player-ui-browser-a11y-harness.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003716Z-f423ed-player-ui-browser-a11y-harness.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:browser-a11y-harness-v1` | remaining UI plans | этот plan | Harness first |
| `frontend:pnpm-lockfile` | any dependency plan | этот plan | Exclusive |
| `ci:gitlab` | workflow/infra plans | этот plan | No parallel CI edits |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:16 UTC
- **Обнаруженные пересечения:** no current Terraform paths; future CI/dependency
  plans must serialize.
- **Решение:** exclusive fresh session; later UI plans extend fixtures/tests
  without changing toolchain.

## План реализации

1. [x] Pin Playwright/axe and add explicit test-only fixture adapter.
2. [x] Add privacy-safe fixtures and shared assertions.
3. [x] Add visual policy and real-boundary smoke.
4. [x] Add bounded CI job/artifacts and run full harness checks.
5. [x] Start new trusted session only if hooks/config changed; scope-check/archive.

## Проверки

- [x] `cd frontend && pnpm lint && pnpm check && pnpm build` — lint, 18
  contract tests, 77 web tests, and Nuxt production build passed.
- [x] `cd frontend && pnpm test:browser` — bundled pnpm 11.9.0, 142 passed,
  5 intentional skips (real-boundary and visual tests on non-canonical tiers).
- [x] `cd frontend && pnpm test:a11y` — covered by the completed 66-test axe
  matrix at 1280, 599 and 320 px; the exact full browser command also ran the
  same a11y spec.
- [x] Real browser-to-Go smoke — canonical Chromium reached the Go lobby and
  actor projection, 1 passed; tablet/mobile are intentional skips.
- [x] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs` — 42/42
  passed.
- [x] `cd tools/leinoctl && node --test` — 69 tests: 68 passed, 1 platform
  skip, 0 failed, with the canonical bundled Node/Git Bash toolchain.
- [x] `node .codex/hooks/plan-lint.mjs` — `plans=49 active=18 archive=31
  issues=0`.
- [x] `./leinoctl verify --changed` — canonical required repository checks
  passed; compose config was validated without starting services.
- [x] `./leinoctl scope-check --plan 20260731T003716Z-f423ed-player-ui-browser-a11y-harness`
  — `ok`, `outsideWriteSet=[]`, `missingRequiredChecks=[]`; unledgered paths
  remain the known post-write-hook warning.
- [x] `git diff --check` — clean.

## Риски и откат

- **Риск:** fixture mode reaches production. **Снижение:** compile/runtime
  fail-closed test-only flag and production build assertion.
- **Риск:** flaky/cross-platform snapshots. **Снижение:** pinned browser and
  explicit baseline platform policy.
- **Откат:** revert config/dependencies/tests/CI; production data unchanged.

## Открытые вопросы

- Scope-changing вопросов нет; Chromium is canonical visual platform, other
  browsers run semantic smoke without baseline overwrite.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** 2026-07-31 17:59:13 Europe/Moscow
- **Формулировка/ограничения пользователя:** Пользователь одобрил batch approval queue в указанном порядке, разрешил implementation, verify/scope-check, archive и отдельный local commit после каждого plan; push не выполняется.

## Ход выполнения

- Plan approved for the first queue position and selected for the shared
  worktree.
- Added catalog-pinned Playwright 1.52.0 and axe 4.10.2, a test-only Nuxt
  fixture adapter with strict projection parsing, and 22 actor-specific
  fixtures with privacy-negative tests.
- Added 3 representative viewport projects: Chromium 1280x720 canonical,
  599x720 tablet and 320x720 mobile. Player UI matrix passed 75/75 and axe
  matrix passed 66/66; visual policy passed 1 canonical baseline and skipped
  2 non-canonical projects by design.
- Added real browser-to-Go smoke with explicit API origin/CORS boundary; it
  passed 1/1 canonical test. Fixture SSE emits the strict invalidation DTO.
- Added CI browser artifacts for traces, screenshots, report and test results.
- Exact bundled-toolchain `pnpm test:browser` passed 142/147 tests: 5 skips
  are intentional real-boundary/visual non-canonical project skips. The
  system PowerShell pnpm shim reported a false non-zero after the same passing
  report; explicit bundled `pnpm.cmd` returned exit 0.
- Existing checks passed: lint, typecheck, contracts 18/18, web tests 77/77,
  and Nuxt production build.
- Scope audit found and corrected the missing `frontend/test/run-playwright.mjs`
  manifest/write-set entry.
- During recovery, the user authorized accepting external commit `7b4d850`
  (only `.codex/agents/explorer.toml` and `.codex/agents/reviewer.toml`) and
  rebinding the ignored session baseline to that current HEAD; no product or
  harness prerequisite was rerun.

## Итог

Player browser/a11y harness is implemented and verified within the approved
write set. Fixture, accessibility, responsive, visual and real-boundary
coverage are pinned and reproducible; the plan is ready for archive, release
and its separate local commit.
