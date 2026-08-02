# PLAN: frontend scss architecture foundation

- **Plan ID:** `20260801T225856Z-b69a1a-frontend-scss-architecture-foundation`
- **Статус:** completed
- **Создан:** 2026-08-01 22:58:56 UTC
- **Обновлён:** 2026-08-02 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260729T234102Z-898ef6-frontend-engineering-spec`, `20260730T001013Z-717040-design-responsive-game-ui-ux`, `20260731T003716Z-f423ed-player-ui-browser-a11y-harness`.
- **Блокирует:** `20260801T225858Z-49b2b8-figma-lobby-shell-rebuild`, `20260801T225859Z-5831ff-figma-game-primitives-view-models`.
- **Связанные ADR/handoff:** `docs/agents/FRONTEND_ENGINEERING_SPEC.md`, `docs/agents/GAME_UI_UX_SPEC.md`, approved Figma file `bmxy6z3Z0bBLHLYryYJYrP`.

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/package.json",
    "frontend/pnpm-workspace.yaml",
    "frontend/pnpm-lock.yaml",
    "frontend/applications/web/nuxt.config.ts",
    "frontend/applications/web/app/app.vue",
    "frontend/applications/web/app/assets/main.css",
    "frontend/applications/web/app/assets/scss/**",
    "frontend/test/browser/style-foundation.spec.ts",
    "docs/agents/FRONTEND_ENGINEERING_SPEC.md",
    "docs/agents/GAME_UI_UX_SPEC.md",
    "docs/agents/plans/active/20260801T225856Z-b69a1a-frontend-scss-architecture-foundation.md",
    "docs/agents/plans/archive/20260801T225856Z-b69a1a-frontend-scss-architecture-foundation.md"
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
    "20260730T001013Z-717040-design-responsive-game-ui-ux",
    "20260731T003716Z-f423ed-player-ui-browser-a11y-harness"
  ],
  "sharedResources": [
    "frontend:pnpm-lockfile",
    "frontend:scss-foundation-v1",
    "frontend:player-ui-design-contract-v2",
    "frontend:app-shell-v2"
  ]
}
```

## Цель

Подготовить воспроизводимый SCSS- и layout-фундамент для полного Figma-driven
редизайна player-facing frontend. Перенести из Digiversity только инженерный
подход — явный global entry, Sass modules, semantic tokens, component-owned
styles, тонкие typed Vue components и headless view models — без отдельной UI
библиотеки, `@digiversity/*`, чужой темы, шрифтов, ассетов или domain-кода.

## Критерии приёмки

- [x] `sass-embedded` объявлен прямой devDependency web-приложения через
  workspace catalog и зафиксирован единственным `frontend/pnpm-lock.yaml`;
  не добавлены Stylelint, UI-kit, CSS framework или второй lockfile.
- [x] `nuxt.config.ts` подключает один `app/assets/scss/main.scss`; старый
  `main.css` удалён после эквивалентной миграции всех global rules.
- [x] SCSS API использует только `@use`/`@forward`: semantic CSS custom
  properties, Munchkin-owned breakpoints, typography, focus/safe-area/motion
  mixins и минимальный reset. Sass values не дублируют runtime game state.
- [x] Global entry владеет только document/reset/tokens/app-shell и отдельно
  импортированной compatibility-частью Card Studio. Page/component geometry
  остаётся scoped или feature-owned, без generic `.active`, deep global
  selectors и `!important`.
- [x] Engineering spec фиксирует app-local ownership: route/page только
  композирует, typed components render/emit, composables владеют view models и
  ephemeral UI, existing API/session/controller — integration lifecycle,
  `packages/contracts` — wire schema. Механический перенос всей Digiversity
  folder tree или переписывание работающего transport layer не требуется.
- [x] Naming/markup conventions закреплены: `<script setup lang="ts">`, typed
  props/emits, semantic native controls, BEM-like component classes, явные
  async states, feature-local tests и никаких width branches в templates.
- [x] Digiversity-код используется как read-only reference: отсутствуют
  `@digiversity/*`, copied SCSS/theme/fonts/images, generated indexes,
  LiveKit/Centrifuge/Keycloak/API provider infrastructure и новая package.
- [x] Нормативные specs отражают принятый Figma-контракт: светлая paper-like
  палитра с muted green/rust accents, mobile `360x640`, desktop `1440x900`,
  разные mobile/desktop compositions, нижняя safe area, техническая информация
  скрыта из primary UI.
- [x] Specs явно различают full visual support и fail-safe fallback: portrait
  mobile от `360x640` и desktop являются целями; short-height/phone landscape
  не получают pixel-parity, но не должны терять credential/action или создавать
  необратимую ловушку фокуса.
- [x] Устаревшие утверждения specs о dark/acid direction и отсутствии
  Playwright/axe/visual tooling исправлены по фактическому repository state.
- [x] App shell сохраняет skip link, `viewport-fit=cover`, semantic main,
  focus-visible, reduced-motion и forced-colors foundations; Card Studio
  остаётся визуально и функционально совместимым.
- [x] `pnpm lint`, `pnpm check`, `pnpm build`, focused browser shell checks,
  canonical verify и scope-check проходят с Node 24.

## Контекст и подтверждённое состояние

- Munchkin уже является отдельным pnpm workspace: `applications/web` и
  `packages/contracts`; создавать ещё один components package нет ownership-
  причины и пользователь это запретил.
- Web package не объявляет Sass implementation. `nuxt.config.ts` подключает
  `~/assets/main.css`; 467-line sheet смешивает tokens/reset/shell и полный
  Card Studio styling.
- Компоненты используют scoped CSS, но повторяют raw breakpoints и large style
  blocks. Existing safe-area/dvh/focus/reduced-motion rules полезны и должны
  быть перенесены, а не потеряны.
- Digiversity VKS подтверждает portable pattern: direct `sass-embedded`, один
  `assets/scss/main.scss`, `@use`/`@forward`, feature-local scoped SCSS,
  typed props/emits и view-model composables. Его legacy `--vh` workaround и
  clickable div patterns не переносятся.
- Current wire/API/session/realtime boundaries уже server-authoritative и в
  этом plan не реорганизуются.
- В worktree до этой очереди изменены только два user-owned infrastructure
  draft plan; пересечений с данным write set нет.

## Scope

### Входит

- Прямое подключение `sass-embedded` версии, совместимой с Node 24/Nuxt,
  первоначальный pin — catalog range `^1.92.0` из проверенного Digiversity
  workspace; lockfile генерируется pnpm, не редактируется вручную.
- Локальные SCSS layers: `api` (tokens/breakpoints/mixins), `base`
  (reset/document/a11y/motion), `pages` (Studio compatibility), `main.scss`.
- Миграция existing global styles без редизайна product screens.
- Фиксация Figma/design/responsive/SCSS contracts в двух specs.
- Небольшой browser smoke для cascade, focus, safe-area, reduced motion и
  Studio compatibility.

### Не входит

- Новый визуальный lobby/game UI, новые product components или изменение
  поведения API/session/controller.
- Редизайн `/studio/cards`; допускается только изоляция и сохранение текущих
  правил при удалении `main.css`.
- Изменение `packages/contracts`, backend/content, команды, privacy projection,
  realtime protocol или credential storage.
- Sass `additionalData`, глобальное инжектирование всех mixins в каждый SFC,
  CSS Modules/Tailwind/UnoCSS/Storybook/Stylelint.

## Архитектурный подход

1. CSS custom properties остаются runtime semantic tokens; Sass используется
   для module boundaries, mixins и compile-time media queries.
2. `main.scss` импортирует layers в фиксированном порядке: tokens → reset →
   document/a11y/motion → app shell → isolated Studio compatibility.
3. Компонент, которому нужен mixin/breakpoint, явно делает
   `@use "@/assets/scss/api" as *`; скрытого global namespace нет.
4. Breakpoints принадлежат Munchkin. CSS решает layout; TypeScript не зеркалит
   viewport widths и не вычисляет legality.
5. Mobile-first правила используют intrinsic grid/flex, `min-width: 0`,
   `min-height: 0`, `100svh`/`100dvh` и `env(safe-area-inset-*)`.
6. Figma является visual/layout source, `@munchkin/contracts` — единственным
   behavioral/data authority; расхождение останавливает последующий slice.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| web toolchain | direct Sass compiler + global entry | lockfile only; no runtime API |
| SCSS foundation | local tokens/reset/mixins/Studio isolation | Munchkin-owned visual contract |
| app shell | equivalent semantic/safe-area styling | no credential or navigation change |
| UI/engineering specs | accepted Figma and support matrix | design contract v2 |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/package.json` | write | Direct `sass-embedded` devDependency |
| `frontend/pnpm-workspace.yaml` | write | Catalog version |
| `frontend/pnpm-lock.yaml` | generated | Reproducible dependency graph |
| `frontend/applications/web/nuxt.config.ts` | write | Switch global CSS entry to SCSS |
| `frontend/applications/web/app/app.vue` | write | App-shell class/style ownership only |
| `frontend/applications/web/app/assets/main.css` | delete | Replaced after rule-by-rule migration |
| `frontend/applications/web/app/assets/scss/**` | write | Local SCSS API/base/Studio compatibility |
| `frontend/test/browser/style-foundation.spec.ts` | write | Cascade/focus/safe-area compatibility smoke |
| `docs/agents/FRONTEND_ENGINEERING_SPEC.md` | write | SCSS/code-style and current-state correction |
| `docs/agents/GAME_UI_UX_SPEC.md` | write | Accepted Figma/support contract v2 |
| `docs/agents/plans/active/20260801T225856Z-b69a1a-frontend-scss-architecture-foundation.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260801T225856Z-b69a1a-frontend-scss-architecture-foundation.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:pnpm-lockfile` | любые dependency plans | этот plan | Exclusive; finish and commit before next plan |
| `frontend:scss-foundation-v1` | все следующие UI plans | этот plan | Stable API first; later plans consume it |
| `frontend:player-ui-design-contract-v2` | вся очередь | этот plan | Specs align before production markup |
| `frontend:app-shell-v2` | lobby/system plans | этот plan | Foundation owns base; route variants extend it sequentially |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 23:00:21 UTC.
- **Обнаруженные пересечения:** только два user-owned infrastructure drafts;
  их paths не пересекаются. Lockfile и docs являются exclusive resources.
- **Решение:** первый plan очереди выполняется отдельно; существующие drafts
  не изменяются, не stash-ятся и не включаются в commit.

## План реализации

1. [x] Зафиксировать в specs Figma source-of-truth, новый visual language,
   route scope, code ownership/naming и full-support/fallback viewport policy.
2. [x] Добавить `sass-embedded` в catalog/web package и обновить lockfile
   только через pnpm с bundled Node 24.
3. [x] Создать SCSS API/base structure и перенести tokens/reset/a11y/motion.
4. [x] Изолировать current Studio rules и переключить Nuxt на `main.scss`.
5. [x] Сравнить computed cascade на `/`, `/game/:id`, `/studio/cards`; удалить
   `main.css` только после подтверждённого parity.
6. [x] Добавить focused shell/style browser test, выполнить checks.
7. [x] Canonical verify, scope-check, archive, release и отдельный local commit;
   push не выполнять без нового разрешения.

## Проверки

- [x] `cd frontend && pnpm install --lockfile-only` после manifest changes.
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`.
- [x] `cd frontend && node test/run-playwright.mjs test style-foundation.spec.ts --project=chromium`.
- [x] Manual computed-style review: `/`, fixture `/game/:id`, dev-only
  `/studio/cards`; focus, safe-area and reduced-motion preserved.
- [x] `rg -n "@digiversity|@import|!important" frontend/applications/web/app frontend/applications/web/package.json` — no imported library/theme or legacy Sass import in new scope.
- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260801T225856Z-b69a1a-frontend-scss-architecture-foundation`.
- [x] `git diff --check`.

## Риски и откат

- **Риск:** изменение cascade ломает Studio или hydration. **Снижение:**
  preserve import order, route smoke и удаление CSS только после parity.
- **Риск:** Sass dependency конфликтует с Node/Nuxt. **Снижение:** direct pin,
  clean install/build under Node 24, one generated lockfile.
- **Риск:** SCSS API превращается в скрытый UI kit. **Снижение:** только tokens,
  mixins и base; product primitives принадлежат отдельному plan.
- **Риск:** обновление spec случайно расширяет поддерживаемые viewports.
  **Снижение:** таблица full support vs safety-only и явная owner decision.
- **Откат:** обычный revert manifest/lock/config/SCSS/spec commit; backend,
  wire contracts и persisted data не меняются.

## Открытые вопросы

- Для approval требуется подтвердить трактовку `весь frontend`: очередь полностью
  redesign-ит player-facing `/` и `/game/:id`, а dev-only `/studio/cards` только
  сохраняет совместимость и не получает новый visual design. Approval exact
  queue одновременно подтверждает этот non-goal; иначе до implementation нужен
  отдельный Card Studio plan. Новая dependency сверх Sass требует reapproval.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 23:00:21 UTC
- **Подтверждено:** 2026-08-02, user batch approval: exact queue in listed order; push запрещён
- **Формулировка/ограничения пользователя:** Взять переносимый стиль frontend-
  кода и вёрстки из `C:\Dev\_Work\_Other\digiversity-monorepo`, не создавать
  отдельную библиотеку, добавить SCSS и подготовить максимально подробный план
  всей вёрстки/frontend до реализации. Batch approval этой очереди: выполнять
  exact plan IDs в указанном порядке; push не выполнять.

## Ход выполнения

- Read-only аудит Munchkin/Digiversity/Figma context завершён; exact batch
  approval записан, plan выбран session
  `019fbfba-a53c-7f50-9587-aecd4f5e98fc` и выполнен первым в очереди.
- Добавлены direct `sass-embedded` catalog/package entries, regenerated lockfile,
  SCSS API/base/document/app-shell layers, isolated Card Studio compatibility
  layer и Nuxt `main.scss` entry; legacy `main.css` удалён.
- Added focused style foundation browser coverage for 360x640 root shell,
  Card Studio and `single-combat` game fixture. All three Chromium checks passed;
  generated Playwright `.last-run.json` was removed before final scope evidence.
- Specs фиксируют paper-like visual contract, SCSS ownership, mobile/desktop
  support matrix и safety-only fallback policy; no Digiversity dependency or
  transport/contract/gameplay code was introduced.
- `pnpm install --lockfile-only`, `pnpm lint`, `pnpm check`, `pnpm build` and
  canonical impact checks passed with Node `24.14.0`/pnpm `11.9.0`/Bash
  `5.2.37`; the build emitted only the existing Node DEP0155 deprecation
  warning. Full dependency install also surfaced the existing pnpm ignored
  `@parcel/watcher` build-script policy, while Sass install and production
  build completed successfully.
- Canonical verify completed with frontend checks, hooks `42/42`, leinoctl
  `68 passed / 1 skipped`, plan-lint `issues=0`, Bash syntax and Compose config;
  final scope-check reported `ok: true`, `outsideWriteSet: []`,
  `unledgered: []`, and no missing required checks.

## Итог

SCSS и layout foundation реализованы и зафиксированы в отдельном локальном
commit после canonical verify/scope-check. Plan перенесён в archive; push не
выполнялся. Следующий plan очереди может быть выбран только после release этого
плана и отдельного commit.
