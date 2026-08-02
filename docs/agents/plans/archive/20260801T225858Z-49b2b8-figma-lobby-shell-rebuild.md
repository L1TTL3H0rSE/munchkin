# PLAN: figma lobby shell rebuild

- **Plan ID:** `20260801T225858Z-49b2b8-figma-lobby-shell-rebuild`
- **Статус:** completed
- **Создан:** 2026-08-01 22:58:58 UTC
- **Обновлён:** 2026-08-02 09:12:16 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260801T225856Z-b69a1a-frontend-scss-architecture-foundation`.
- **Блокирует:** `20260801T225859Z-5831ff-figma-game-primitives-view-models`, `20260801T225905Z-64608a-frontend-redesign-verification-cleanup`.
- **Связанные ADR/handoff:** approved Figma lobby Flow B, `docs/agents/GAME_UI_UX_SPEC.md`.

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/app.vue",
    "frontend/applications/web/app/pages/index.vue",
    "frontend/applications/web/app/components/lobby/**",
    "frontend/applications/web/app/assets/scss/pages/_lobby.scss",
    "frontend/applications/web/test/lobbyEntry.test.ts",
    "frontend/test/browser/lobby.spec.ts",
    "frontend/test/browser/visual.spec.ts",
    "frontend/test/browser/visual-baselines/chromium/lobby-*.png",
    "docs/agents/plans/active/20260801T225858Z-49b2b8-figma-lobby-shell-rebuild.md",
    "docs/agents/plans/archive/20260801T225858Z-49b2b8-figma-lobby-shell-rebuild.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "pnpm:@munchkin/contracts",
    "frontend:browser-a11y-harness-v1",
    "frontend:scss-foundation-v1"
  ],
  "dependsOn": [
    "20260801T225856Z-b69a1a-frontend-scss-architecture-foundation"
  ],
  "sharedResources": [
    "frontend:figma-lobby-flow-b-v1",
    "frontend:app-shell-v2"
  ]
}
```

## Цель

Реализовать утверждённый Figma Flow B для player-facing `/`: спокойный,
понятный вход в игру без инженерного sample-copy, с намеренно разной mobile и
desktop композицией, но с неизменным guest/session/API contract.

## Критерии приёмки

- [x] `/` визуально соответствует утверждённым mobile/desktop Figma frames и
  использует Munchkin SCSS foundation; старый acid/dark hero полностью удалён.
- [x] Mobile `360x640` реализует утверждённый Flow B без постоянного product
  header, лишнего скролла и технических пояснений; нижняя safe area учтена.
- [x] Desktop `1440x900` использует самостоятельную композицию, а не растянутую
  mobile column; create/join hierarchy и empty space остаются управляемыми.
- [x] Create и join имеют независимые pending/error/disabled states; двойной
  submit блокируется только в соответствующей форме.
- [x] Поля имеют native labels, autocomplete/inputmode, field-linked errors,
  44px targets, правильный focus order и submit по Enter.
- [x] UI не показывает тексты про sessionStorage, bearer, SSR, URL, API version
  или authoritative server. Recovery объясняется пользовательским языком.
- [x] Credential остаётся только в existing sessionStorage adapter; не попадает
  в URL, SSR, DOM, visible errors, telemetry или fixtures.
- [x] Create/join success использует только parsed server result и безопасную
  navigation; failure сохраняет non-secret input и предоставляет retry.
- [x] Long Russian names/errors, keyboard viewport, 200% zoom, forced colors и
  reduced motion не создают root horizontal overflow или недоступную кнопку.
- [x] `/game/:id` и dev-only Card Studio не получают визуальных/behavioral
  изменений из lobby selectors.
- [x] Canonical lobby captures in `visual.spec.ts` explicitly set `360x640`
  and `1440x900` before navigation; browser project defaults do not determine
  the approved comparison size.

## Контекст и подтверждённое состояние

- Current `/` содержит oversized slogan, two technical cards и recovery copy
  с деталями credential storage; пользователь явно отверг такой product tone.
- Existing `LobbyForm`/`lobbyModel` уже отделяют validation/submit, а
  `useGameApi` и `useGameSession` реализуют parsed result + session-only token.
- Ранее пользователь выбрал вариант B входа и отдельно утвердил его flow.
- Foundation plan предоставляет SCSS API и обновлённый app shell contract.

## Scope

### Входит

- Route composition `/`, app-shell variant for lobby, create/join/recovery
  components, product copy, scoped/page SCSS.
- Deterministic success, validation, offline, 404, conflict and retry states.
- Component, browser, a11y and canonical visual update for two target layouts.

### Не входит

- `/game/:id`, player table, Card Studio redesign, accounts/OIDC, invite links,
  matchmaking, lobby chat or backend lobby contract.
- Moving credential ownership out of `useGameSession`, raw transport error copy
  or adding analytics.

## Архитектурный подход

1. Page remains a thin composition root: invokes typed API/session/router and
   passes explicit props/callbacks to view-only lobby components.
2. Form model exposes discriminated idle/pending/error/success states; no
   component imports raw `$fetch` or parses unknown JSON.
3. Mobile/desktop use the same form contract but may reorder/present blocks
   differently through CSS grid and semantic source order.
4. Product copy uses progressive disclosure: only input, current task, safe
   recovery and result are visible.
5. Page SCSS owns large composition; each component owns internal geometry in
   `<style scoped lang="scss">` with explicit `@use`.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| app shell | route-aware lobby header/chrome | semantic HTML only |
| lobby page/forms | Figma Flow B + typed UI states | existing lobby API |
| session/navigation | consume unchanged adapter | credential remains private |
| tests/baseline | mobile/desktop and error states | deterministic safe fixtures |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/app.vue` | write | Lobby-specific shell composition |
| `frontend/applications/web/app/pages/index.vue` | write | Thin route orchestration |
| `frontend/applications/web/app/components/lobby/**` | write | Form/recovery presentational owners |
| `frontend/applications/web/app/assets/scss/pages/_lobby.scss` | write | Route-level composition |
| `frontend/applications/web/test/lobbyEntry.test.ts` | write | State and safe-copy regressions |
| `frontend/test/browser/lobby.spec.ts` | write | Browser/a11y/viewport behavior |
| `frontend/test/browser/visual.spec.ts` | write | Exact mobile/desktop lobby captures |
| `frontend/test/browser/visual-baselines/chromium/lobby-*.png` | generated | Reviewed canonical baselines |
| `docs/agents/plans/active/20260801T225858Z-49b2b8-figma-lobby-shell-rebuild.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260801T225858Z-49b2b8-figma-lobby-shell-rebuild.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:app-shell-v2` | game/system states | этот plan | Lobby variant first; game consumes contract |
| `frontend:figma-lobby-flow-b-v1` | final visual gate | этот plan | Freeze after reviewed baseline |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 23:00:21 UTC.
- **Обнаруженные пересечения:** foundation touches `app.vue` first; later
  system plan may consume shell. Infrastructure drafts do not overlap.
- **Решение:** strict queue after foundation commit; no parallel app-shell edit.

## План реализации

1. [x] Map approved Flow B Figma nodes to semantic page regions and existing
   create/join/recovery states before changing markup.
2. [x] Refine typed lobby view model/copy while preserving API/session owners.
3. [x] Implement mobile `360x640`, including keyboard and bottom safe area.
4. [x] Implement independent desktop `1440x900` composition and intermediate
   portrait/tablet reflow using the same semantic source order.
5. [x] Add focused unit/browser/a11y assertions and exact viewport cases to
   `visual.spec.ts`; review both regenerated visuals.
6. [x] Run canonical verify/scope-check; archive/release/local commit; no push.

## Проверки

- [x] Direct Vitest `lobbyEntry.test.ts` passed; the pnpm wrapper was blocked
  by the existing `@parcel/watcher` ignored-build policy guard.
- [x] `cd frontend && node test/run-playwright.mjs test lobby.spec.ts --project=chromium`
  passed: 6/6, including independent pending/error, Enter submit, axe and
  overflow/media assertions.
- [x] Target browser review at `360x640`, `390x844`, `427x926`, `768x1024`,
  `1440x900`; keyboard-open and 200% zoom scenarios included.
- [x] Direct visual harness with `--grep='lobby-'` created and reviewed
  `lobby-mobile.png` and `lobby-desktop.png` with explicit viewport overrides;
  both canonical lobby cases pass.
- [x] Axe serious/critical = 0; focus order, field error association and
  duplicate-submit assertions pass.
- [x] Credential-negative search in URL, rendered copy and captured artifacts.
- [x] Direct web lint, full Vitest (22 files / 123 tests), Nuxt typecheck
  (exit 0 with the known Volar module warning) and direct Nuxt build passed;
  the pnpm aggregate was blocked by the existing ignored-build policy.
- [x] `node .codex/hooks/plan-lint.mjs` passed with no plan issues.
- [x] `./leinoctl verify --changed` passed after lobby artifact cleanup.
- [x] `./leinoctl scope-check --plan 20260801T225858Z-49b2b8-figma-lobby-shell-rebuild` passed with no outside write-set paths.
- [x] `git diff --check`.

## Риски и откат

- **Риск:** visual refactor меняет guest credential/navigation semantics.
  **Снижение:** existing adapters untouched, success/error browser contracts.
- **Риск:** hiding technical copy removes useful recovery. **Снижение:** concise
  product-language recovery with progressive disclosure.
- **Риск:** route-aware shell causes hydration mismatch. **Снижение:** derive
  static route state through Nuxt router, no client-only width branching.
- **Откат:** revert lobby/app-shell commit; backend/session data unchanged.

## Открытые вопросы

- Scope-changing вопросов нет. Approved Flow B считается final visual source;
  material deviation requires a new Figma review and reapproval.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 23:00:21 UTC
- **Подтверждено:** 2026-08-02, user batch approval: exact queue in listed order; push запрещён
- **Формулировка/ограничения пользователя:** Пользователь выбрал lobby вариант
  B, утвердил flow и просит реализовать весь frontend в стиле организации кода
  Digiversity, но без отдельной библиотеки. Batch approval этой очереди:
  выполнять exact plan IDs в указанном порядке; push не выполнять.

## Ход выполнения

- Flow B mapped to semantic intro/forms/recovery regions; the route-aware shell
  now removes the permanent product header on `/` while preserving the game
  route shell.
- Lobby copy and error mapping were reduced to player language. Existing API,
  parsed result, session adapter and safe navigation remain the only owners of
  transport/session behavior.
- `_lobby.scss` and scoped component SCSS use the foundation tokens/mixins,
  safe-area padding, paper surfaces, muted green/rust roles, mobile stacking
  and independent desktop columns.
- Browser coverage now includes 6 lobby behavior/a11y cases plus exact
  `360x640` and `1440x900` visual captures. Generated browser artifacts were
  removed after each run.

## Итог

Lobby Flow B implemented and reviewed. The scoped lobby visual cases pass and
the canonical `lobby-mobile.png` / `lobby-desktop.png` baselines are stored.
The complete `visual.spec.ts` also includes the pre-existing game
`single-combat.png` comparison; that unrelated baseline still differs after
the foundation plan's global game styling change and was not modified because
it is outside this plan's write set. No credential, API/session owner, game
route or Card Studio code was changed by this plan. No push performed.
