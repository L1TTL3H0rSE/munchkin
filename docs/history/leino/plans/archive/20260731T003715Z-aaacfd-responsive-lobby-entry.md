# PLAN: responsive lobby entry

- **Plan ID:** `20260731T003715Z-aaacfd-responsive-lobby-entry`
- **Статус:** completed
- **Создан:** 2026-07-31 00:37:15 UTC
- **Обновлён:** 2026-07-31 23:40:20 +03:00
- **Владелец:** Codex queue session `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue3`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260731T001853Z-aae2bb-game-session-recovery-controller`, `20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock`, `20260731T003716Z-f423ed-player-ui-browser-a11y-harness`.
- **Блокирует:** `20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`
- **Связанные ADR/handoff:** `docs/agents/GAME_UI_UX_SPEC.md`, `docs/agents/FRONTEND_ENGINEERING_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/pages/index.vue",
    "frontend/applications/web/app/components/lobby/**",
    "frontend/applications/web/app/assets/main.css",
    "frontend/applications/web/test/lobbyEntry.test.ts",
    "frontend/test/browser/lobby.spec.ts",
    "frontend/test/browser/visual-baselines/chromium/lobby-entry.png",
    "docs/agents/plans/active/20260731T003715Z-aaacfd-responsive-lobby-entry.md",
    "docs/agents/plans/archive/20260731T003715Z-aaacfd-responsive-lobby-entry.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "pnpm:@munchkin/contracts",
    "frontend:browser-a11y-harness-v1"
  ],
  "dependsOn": [
    "20260731T001853Z-aae2bb-game-session-recovery-controller",
    "20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock",
    "20260731T003716Z-f423ed-player-ui-browser-a11y-harness"
  ],
  "sharedResources": [
    "frontend:responsive-lobby-entry-v1"
  ]
}
```

## Цель

Завершить responsive lobby entry: separate create/join forms, typed safe error
recovery, recent-session guidance and accessible mobile/tablet/desktop layout
without changing guest credential or backend lobby contract.

## Критерии приёмки

- [x] Create/join forms have independent pending/error states and never block
  each other through one global busy flag.
- [x] API errors use completed safe taxonomy; field errors linked/focused,
  auth/404/offline recovery copy contains no raw message/token.
- [x] Native labels/fieldset/autocomplete/input constraints and 44px targets
  support keyboard/touch; duplicate submit blocked per form.
- [x] Session credential remains sessionStorage-only and never appears in URL,
  SSR, log or visible error.
- [x] Mobile 320 single-column, tablet/desktop composition, long Russian copy
  and keyboard viewport have no root overflow.
- [x] Navigation after success is based on parsed server result; failed join
  preserves safe user input and allows retry.
- [x] Component/browser tests cover empty/validation/offline/not-found/success,
  keyboard, zoom, forced colors and reduced motion.
- [x] Gameplay/Studio styles are not affected; migrated lobby CSS leaves
  global sheet cleaner.

## Контекст и подтверждённое состояние

- Current index page has two forms, shared `busy` and raw `Error.message`.
- Shell/breakpoint foundation and browser harness are dependencies.
- Guest-only lobby is intentional; accounts/OIDC are P2 outside this plan.

## Scope

### Входит

- Lobby form decomposition/state/error UX, responsive/component CSS and tests.

### Не входит

- Backend contract, accounts, matchmaking, invite links, admin or game table.

## Архитектурный подход

1. Keep route as composition and forms as controlled feature components.
2. Use typed API/session adapters and independent operation states.
3. Migrate lobby styles to scoped owners and verify with harness.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| lobby page/components | Responsive create/join/recovery | Existing guest API |
| browser harness | Lobby fixtures/tests | No private data |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/pages/index.vue` | write | Route composition |
| `frontend/applications/web/app/components/lobby/**` | write | Forms/status |
| `frontend/applications/web/app/assets/main.css` | write | Remove migrated lobby styles |
| `frontend/applications/web/test/lobbyEntry.test.ts` | write | Component states |
| `frontend/test/browser/lobby.spec.ts` | write | Browser/a11y matrix |
| `frontend/test/browser/visual-baselines/chromium/lobby-entry.png` | generated | Reviewed snapshot |
| `docs/agents/plans/active/20260731T003715Z-aaacfd-responsive-lobby-entry.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003715Z-aaacfd-responsive-lobby-entry.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:responsive-lobby-entry-v1` | final UI coverage | этот plan | Lobby complete before final gate |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:15 UTC
- **Обнаруженные пересечения:** table plan owns global gameplay CSS first;
  harness owns tooling first; no Terraform overlap.
- **Решение:** dependencies serialize shared resources.

## План реализации

1. [x] Add create/join state tests and split components.
2. [x] Apply typed errors/session-safe navigation.
3. [x] Migrate scoped responsive styles.
4. [x] Run unit/browser/a11y/visual/full checks and archive.

## Проверки

- [x] Web ESLint — passed (`node node_modules/eslint/bin/eslint.js .`).
- [x] Lobby unit model tests — 3/3 passed (`vitest run test/lobbyEntry.test.ts`).
- [x] Nuxt typecheck — exit 0; emitted the existing optional Volar
  `vue-router/volar/sfc-route-blocks` resolution warning without diagnostics.
- [x] Nuxt production build — passed; client/server/Nitro artifacts generated.
- [x] Lobby browser semantic matrix — 12/12 passed on Chromium 1280, tablet
  599 and mobile 320; includes pending isolation, safe 404/503 recovery,
  keyboard, zoom, reduced-motion and forced-colors checks.
- [x] Lobby visual baseline — 1/1 passed after hiding the dynamic Nuxt
  DevTools frame; reviewed `frontend/test/browser/visual-baselines/chromium/lobby-entry.png`.
- [x] `node .codex/hooks/plan-lint.mjs` — `plans=49 active=16 archive=33 issues=0`.
- [x] `./leinoctl verify --changed` — passed with the declared Node 24
  toolchain and isolated Docker config; clean verify fingerprint contains no
  generated Playwright artifacts.
- [x] `./leinoctl scope-check --plan 20260731T003715Z-aaacfd-responsive-lobby-entry` — `ok: true`, no outside-write-set or stale checks.
- [x] `git diff --check`

## Риски и откат

- **Риск:** refactor changes credential/navigation behavior. **Снижение:**
  adapter fixtures and browser success/error tests.
- **Откат:** ordinary frontend revert; backend/data unchanged.

## Открытые вопросы

- Scope-changing вопросов нет; registered accounts remain separate P2.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:15 UTC
- **Подтверждено:** 2026-07-31 22:20:00 Europe/Moscow
- **Формулировка/ограничения пользователя:** Пользователь одобрил batch
  approval queue в указанном порядке и разрешил implementation,
  verify/scope-check, archive и отдельный local commit после каждого plan;
  push не выполняется.

## Ход выполнения

- Plan выбран следующим после завершённого responsive game table plan;
  implementation начинается в пределах lobby write set.

## Итог

Lobby entry decomposed into independently controlled create/join forms with
typed validation and safe API recovery. Credential handling remains delegated
to the existing sessionStorage-only adapter; navigation uses parsed server
results. Scoped responsive styles cover 320px, tablet and desktop layouts,
while the browser harness waits for Vue hydration and excludes the dynamic
DevTools frame from the visual baseline. Implementation and local checks are
complete; the plan is ready to archive and commit as the next lifecycle step.
