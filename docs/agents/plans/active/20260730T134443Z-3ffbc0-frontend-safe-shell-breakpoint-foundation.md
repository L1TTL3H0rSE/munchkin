# PLAN: frontend safe shell breakpoint foundation

- **Plan ID:** `20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation`
- **Статус:** approved
- **Создан:** 2026-07-30 13:44:43 UTC
- **Обновлён:** 2026-07-30 14:12:52 UTC
- **Владелец:** отдельная Codex frontend-session после согласования
- **Workspace:** отдельный worktree
- **Ветка:** `codex/frontend-safe-shell-breakpoint-foundation`
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260729T234102Z-898ef6-frontend-engineering-spec`, `20260730T001013Z-717040-design-responsive-game-ui-ux`.
- **Блокирует:** дальнейшие responsive game-table/action-surface slices
- **Связанные ADR/handoff:** `FRONTEND_ENGINEERING_SPEC.md`,
  `GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/app.vue",
    "frontend/applications/web/app/assets/main.css",
    "docs/agents/plans/active/20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation.md",
    "docs/agents/plans/archive/20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [],
  "dependsOn": [
    "20260729T234102Z-898ef6-frontend-engineering-spec",
    "20260730T001013Z-717040-design-responsive-game-ui-ux"
  ],
  "sharedResources": [
    "frontend:global-shell-responsive-foundation-v1"
  ]
}
```

## Цель

Реализовать первый безопасный UI/UX slice из принятой responsive spec:
устранить подтверждённый document overflow на 320 px, добавить semantic skip
navigation, Munchkin-owned breakpoint foundation, keyboard focus,
reduced-motion, dynamic viewport и safe-area policy. Не менять game contracts,
компоненты стола, hand rails или server-authoritative action behavior.

## Критерии приёмки

- [ ] На странице ровно один semantic `main` с устойчивым target ID; skip link
  первым keyboard focus переводит пользователя к main content и видим при
  фокусе.
- [ ] На `320 × 568` выполняется
  `document.documentElement.scrollWidth <= clientWidth`; header/main/focused
  controls не выходят за safe viewport.
- [ ] Raw audit-only `@media (max-width: 720px)` удалён. Canonical boundaries
  `374/427/599/767/1023/1279/1439/1900` получают локальные names/semantics, но
  media queries добавляются только для реально нужных content-driven
  transitions.
- [ ] Каждый используемый breakpoint проверен на `N-1/N/N+1`; transition не
  создаёт overlap/gap, document overflow или потерю focus.
- [ ] `.app-shell` имеет `100vh` fallback и `100dvh` enhancement; safe-area
  insets добавляются к spacing без двойного padding.
- [ ] Общий `:focus-visible` cue различим не только цветом, переживает dark
  background и keyboard-only navigation; mouse click не получает навязчивый
  focus ring.
- [ ] `prefers-reduced-motion: reduce` отключает/сокращает non-essential
  transitions/scroll behavior, сохраняя static state cue.
- [ ] Disabled control больше не означает автоматически «ожидание» курсором:
  универсальный `cursor: wait` удалён. Отдельный pending/busy cue отложен до
  plan, который добавит явную state semantics в компоненты.
- [ ] Short landscape, zoom/reflow и safe-area не скрывают brand, main target
  или critical native controls.
- [ ] Существующая visual language сохраняется. Lobby/game business logic,
  available actions, server status, projection decoding и routes не меняются.
- [ ] Frontend lint/check/tests/build, canonical verify, browser matrix и
  scope-check проходят.

## Контекст и подтверждённое состояние

- `app.vue` сейчас содержит header и безымянный `main`, но не содержит skip
  link или focus target.
- `main.css` задаёт `body { min-width: 320px }`; live browser audit подтвердил
  `scrollWidth=320`, `clientWidth=305`, то есть overflow `15 px` на
  `320 × 568`.
- Единственный текущий switch — audit baseline
  `@media (max-width: 720px)`, которого нет в принятом canonical breakpoint
  contract.
- Custom `:focus-visible`, global reduced-motion, safe-area и `dvh` policy
  отсутствуют.
- Внутренние hand/action rails уже используют bounded horizontal overflow;
  их UX redesign относится к следующим slices и не нужен для исправления
  document root.
- Frontend строго декодирует backend projection через shared Zod contracts.
  Этот plan их не трогает и потому независим от backend kernel.

## Scope

### Входит

- Skip link, `main` landmark/target и keyboard focus behavior в `app.vue`.
- Root/shell CSS для 320 px containment, named breakpoint policy, dynamic
  viewport, safe area, focus-visible, reduced motion и честного disabled
  cursor.
- Content-driven замена существующего 720 px media query без redesign
  вложенных game components.
- Browser evidence на minimum, representative canonical widths, short
  landscape, keyboard-only и reduced-motion.

### Не входит

- `GameTable`, `ActionPanel`, hand/opponent rails, modal/sheet/toast,
  interaction inbox, countdown, combat/help UI или carousel redesign.
- Pages, composables, shared TypeScript/Zod contracts, API/SSE behavior,
  credentials, routes или server state.
- Новые dependencies, fonts, illustrations, icons, Playwright/axe setup либо
  snapshot fixtures.
- Card Studio/admin UI, backend, infrastructure, Compose и deploy.

## Архитектурный подход

1. Исправить root sizing contract, не скрывая overflow глобальным
   `overflow-x: hidden`.
2. Добавить semantic skip navigation и predictable focus target без runtime
   JavaScript.
3. Зафиксировать canonical boundary names рядом с global CSS; использовать
   только transitions, подтверждённые содержимым, с ясной max/min semantics.
4. Использовать progressive CSS: `100vh` fallback затем `100dvh`, safe-area
   через `env(..., 0px)`, focus/reduced-motion/forced-color friendly rules.
5. Не менять client authority: shell styles показывают состояние, но не
   придумывают pending/success или server result. Без component marker CSS
   только убирает ложный universal wait cue.
6. Подтвердить поведение browser evidence, а не только source review.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| `frontend-workspace` | Global app shell and responsive/a11y CSS foundation | No HTTP/realtime/schema change |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/app.vue` | write | Semantic skip link and main focus target |
| `frontend/applications/web/app/assets/main.css` | write | Root containment, responsive/a11y foundation |
| `docs/agents/plans/active/20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:global-shell-responsive-foundation-v1` | future table/action UI plans | этот plan | Foundation first; later components consume it |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 13:55:00 UTC.
- **Обнаруженные пересечения:** нет общих paths/contracts/shared resources с
  Terraform plan или pure backend kernel.
- **Решение:** не трогать frontend pages/components/contracts/config/lockfile.
  Выполнять в отдельном worktree.

## План реализации

1. [ ] Добавить skip link и единственный focusable `main` target.
2. [ ] Исправить 320 px root sizing без document-level clipping workaround.
3. [ ] Добавить named responsive, `dvh`, safe-area, focus-visible,
   reduced-motion foundation и убрать ложный universal disabled-wait cursor.
4. [ ] Заменить raw 720 px query на content-driven canonical boundary usage,
   сохранив current visual language.
5. [ ] Выполнить lint/check/build и browser matrix; исправить только findings
   внутри двух production files.
6. [ ] Повторить canonical verify/scope-check, записать evidence и
   архивировать plan.

## Проверки

- [ ] `pnpm lint` из `frontend`
- [ ] `pnpm check` из `frontend`
- [ ] `pnpm build` из `frontend`
- [ ] Browser: `320 × 568`, `374 × 812`, `427 × 926`, `599 × 960`,
  `667 × 375`, `768 × 1024`, `1024 × 768`, `1280 × 720`, `1440 × 900`,
  `1900 × 1080`; плюс `N-1/N/N+1` для каждого реально используемого switch
- [ ] Browser: keyboard-only skip/focus, reduced motion, short landscape,
  safe-area emulation и root overflow assertion
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** global CSS затронет Studio или вложенные game surfaces.
  **Снижение:** только root/shell selectors, full frontend checks и browser
  smoke representative routes.
- **Риск:** слепое использование всех восьми boundaries создаст лишние jumps.
  **Снижение:** names фиксируются один раз, query появляется только по
  content-driven evidence.
- **Риск:** скрытие overflow замаскирует реальный oversized child.
  **Снижение:** не использовать global clipping; измерять root/critical rects.
- **Риск:** reduced motion удалит feedback полностью.
  **Снижение:** отключать movement, но сохранять static state/focus cue.
- **Откат:** обычный revert двух production files; contracts, data и backend
  state не меняются.

## Открытые вопросы

- Нет scope-changing вопросов. Rails/carousel, interaction surfaces и полный
  table redesign намеренно остаются отдельными future plans.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-30 13:44:43 UTC
- **Подтверждено:** 2026-07-30 14:12:52 UTC
- **Формулировка/ограничения пользователя:** «Согласовываю все три плана.
  Разрешаю зафиксировать и запушить approved drafts». Пользователь запустит
  другой approved plan на другом устройстве; эта infra-session данный plan не
  выбирает и не реализует.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Read-only review accepted UI/UX spec и live audit зафиксировал точную 320 px
  причину, доступный narrow write set и отсутствие contract overlap.
- Exact plan ID согласован; implementation ожидает отдельную session/worktree.

## Итог

Заполняется после реализации.
