# PLAN: player ui browser a11y harness

- **Plan ID:** `20260731T003716Z-f423ed-player-ui-browser-a11y-harness`
- **Статус:** draft
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 00:37:16 UTC
- **Владелец:** —
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

- [ ] Playwright/browser/axe versions pinned through catalog/one lockfile;
  no nested lock or platform-unbounded latest download.
- [ ] Fixture adapter selected once in explicit test composition root and
  impossible in production config; it returns only strict parsed public DTO.
- [ ] Minimum 20 UI spec fixtures cover 1/6 players, phases, long Russian copy,
  missing art, offline/stale, interactions, helper, economy, death and victory
  as their contracts become available.
- [ ] Fixtures contain no credentials, foreign hand, deck order, RNG/internal
  state or raw events and pass Zod plus privacy-negative tests.
- [ ] Automated matrix checks root overflow, labeled rails, first/last focus,
  dialog/sheet trap/return, reduced motion, forced colors and selected axe
  serious/critical violations.
- [ ] Complete N-1/N/N+1 matrix runs only dense critical fixtures; all fixtures
  run representative widths per UI spec to bound CI duration.
- [ ] Visual baselines define OS/browser/font policy; unsupported platform
  does not silently overwrite accepted snapshots.
- [ ] One smoke path launches real Go HTTP/application boundary and web app;
  fixture visual tests are not called cross-layer E2E.
- [ ] CI artifacts include failure screenshots/traces/reports without secrets.
- [ ] Existing unit/lint/check/build and repository jobs retain parity.

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

1. [ ] Pin Playwright/axe and add explicit test-only fixture adapter.
2. [ ] Add privacy-safe fixtures and shared assertions.
3. [ ] Add visual policy and real-boundary smoke.
4. [ ] Add bounded CI job/artifacts and run full harness checks.
5. [ ] Start new trusted session only if hooks/config changed; scope-check/archive.

## Проверки

- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `cd frontend && pnpm test:browser`
- [ ] `cd frontend && pnpm test:a11y`
- [ ] Real browser-to-Go smoke
- [ ] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs`
- [ ] `cd tools/leinoctl && node --test`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T003716Z-f423ed-player-ui-browser-a11y-harness`
- [ ] `git diff --check`

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

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Подготовить оставшиеся планы;
  implementation/select/commit/push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.

## Итог

Заполняется после реализации.
