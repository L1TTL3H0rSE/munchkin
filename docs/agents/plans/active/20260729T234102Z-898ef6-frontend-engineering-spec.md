# PLAN: frontend engineering spec

- **Plan ID:** `20260729T234102Z-898ef6-frontend-engineering-spec`
- **Статус:** awaiting_approval
- **Создан:** 2026-07-29 23:41:02 UTC
- **Обновлён:** 2026-07-30 02:41 MSK
- **Владелец:** Codex
- **Workspace:** shared / `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** нет
- **Блокирует:** будущие frontend implementation plans, которым нужен единый стандарт
- **Связанные ADR/handoff:** ADR-0002, ADR-0004, ADR-0005

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/FRONTEND_ENGINEERING_SPEC.md",
    "docs/agents/README.md",
    "frontend/AGENTS.md",
    "docs/agents/plans/active/20260729T234102Z-898ef6-frontend-engineering-spec.md",
    "docs/agents/plans/archive/20260729T234102Z-898ef6-frontend-engineering-spec.md"
  ],
  "components": [
    "repository-workflow",
    "frontend-workspace"
  ],
  "contracts": [],
  "dependsOn": [],
  "sharedResources": [
    "frontend:engineering-guidance-v1"
  ]
}
```

## Цель

Создать в `munchkin` нормативную, сразу обнаруживаемую агентами спецификацию
frontend-разработки на основе read-only аудита актуального Digiversity
frontend и текущего Munchkin UI. Спецификация должна охватывать архитектуру,
границы данных, TypeScript/Vue/Nuxt стиль, naming, разметку, CSS, дизайн-токены,
адаптивы, accessibility, состояния, тестирование и review gates, но быть
адаптирована к полностью независимому проекту без зависимости от
`@digiversity/*`, его component library или submodule-устройства.

## Критерии приёмки

- [ ] `docs/agents/FRONTEND_ENGINEERING_SPEC.md` различает нормативные правила,
      объяснение/примеры и датированный audit snapshot; живой Digiversity код
      не объявляется автоматически эталонным.
- [ ] Спека задаёт практические правила для workspace ownership, Nuxt app
      structure, contracts/adapters/providers, server authority, realtime
      resync, state ownership, typed mocks, ошибок и async lifecycle.
- [ ] Спека задаёт точные соглашения TypeScript/Vue: strict types, imports,
      naming файлов/типов/functions, Composition API, props/emits/models,
      composables/stores, pages/layouts/components и ограничения на `any`,
      assertions, side effects и monolithic components.
- [ ] Отдельный раздел покрывает семантическую разметку, forms, keyboard/focus,
      aria, loading/empty/error/disabled/offline states и безопасные
      интерактивные элементы.
- [ ] Отдельный раздел покрывает CSS architecture: local tokens, global reset,
      component ownership, BEM-like classes, scoped/global policy, units,
      layout primitives, overflow, stacking, animation/reduced-motion и
      запрет зависимости от Digiversity SCSS/component package.
- [ ] Responsive contract задаёт mobile-first/default behavior, именованный
      локальный breakpoint set, content-driven transitions, touch/hover
      capabilities, `dvh`/safe-area/overflow handling и обязательную
      viewport matrix для проверки.
- [ ] Включена таблица отличий текущего `munchkin` от нормализованного
      Digiversity-подхода с приоритетами; хорошие target-практики также
      сохранены, а код в рамках этого плана не меняется.
- [ ] `frontend/AGENTS.md` явно направляет любого frontend-агента к спеке до
      реализации; `docs/agents/README.md` добавляет её в индекс.
- [ ] Документ содержит Definition of Done и copy-ready checklist для нового
      frontend change; проверки документации и scope проходят.

## Контекст и подтверждённое состояние

- Digiversity frontend — pnpm workspace на Nuxt 4/Vue 3/Pinia/TypeScript с
  deployable `applications/*` и shared `packages/*`; несколько каталогов —
  отдельные Git submodules. Это устройство является source context, но не
  переносимым требованием для Munchkin.
- Устойчивые Digiversity-границы: UI primitives в components, headless state
  в shared, transport/generated API в api, Nuxt integration в extras; app
  contracts и real/mock adapters отделены от composition root.
- Общий Digiversity ESLint/Prettier contract использует double quotes,
  semicolons, trailing commas, width 80, один Vue attribute на строку и
  PascalCase component names. TypeScript base включает strict,
  `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` и isolated modules.
- Digiversity styles используют CSS custom properties для colors/spacing/
  effects, SCSS API для breakpoints, component-owned styles и responsive
  layout changes; интерактивные carousel/table/lobby примеры учитывают
  overflow, touch scrolling, hover capability и viewport height.
- Живой Digiversity код неоднороден: встречаются legacy `any`, unsafe
  assertions, кликабельные `div`, unscoped global selectors, raw pixel
  breakpoints, большие компоненты и комментарии вместо устойчивого контракта.
  Эти дефекты не должны быть канонизированы.
- Munchkin уже правильно хранит wire Zod schemas в
  `frontend/packages/contracts`, применяет strict TypeScript, server-owned
  action descriptors/projections, version-only realtime resync, semantic
  `article/header/form/label`, alt/fallback content и pure
  `actionModel.ts` с tests.
- Текущие расхождения Munchkin: только Nuxt default ESLint без единого
  formatting contract; 638-line global `main.css`; 489-line
  `CardStudioPanel.vue`; 333-line game page; gameplay HTTP/SSE/retry в одном
  `useGameApi.ts`; один 720px media query; смешанные global element,
  feature и component selectors; отдельные contracts уже охватывают две
  области в одном 366-line barrel.
- Munchkin worktree был чистым на `main`. Два active draft plan меняют только
  ADR-0005 либо новый ADR-0006/decision index; write set с этим plan не
  пересекается.

## Scope

### Входит

- Новый нормативный frontend engineering spec в `docs/agents`.
- Source audit Digiversity и dated drift audit текущего Munchkin frontend.
- Архитектура, naming, code style, Vue/Nuxt patterns, markup, styling,
  responsiveness, accessibility, tests, verification и review checklist.
- Явная адаптация к одному независимому Munchkin workspace без внешней UI
  library и без копирования `@digiversity/*`.
- Ссылки на спеку из frontend instructions и agent docs index.

### Не входит

- Любые изменения production/test/generated frontend code, CSS, contracts,
  package manifests, lockfile, ESLint/Prettier config или dependencies.
- Создание component library/design-system package, импорт Digiversity
  packages/assets/fonts/tokens или копирование его private product styling.
- Исправление найденных Munchkin отличий; это backlog для будущих отдельных
  implementation plans.
- Runtime/browser visual audit, screenshots, Docker, build и dependency
  installation.
- Commit, push и публикация.

## Архитектурный подход

1. Отделить подтверждённые repeatable patterns от monorepo-specific механики и
   legacy defects.
2. Сформулировать правила как Munchkin-owned contracts: существующий
   `packages/contracts`, app-local UI/state/adapters и backend authority.
3. Для каждого раздела дать decision rule: где размещать код, когда выделять
   компонент/composable/adapter, какие anti-patterns запрещены и чем проверить.
4. Для styling/responsive задать локальные tokens/breakpoints и проверяемое
   поведение, не предписывая внешнюю библиотеку или копию Digiversity theme.
5. Зафиксировать текущие target deviations как audit snapshot с приоритетом,
   но не превращать документационный plan в скрытый refactor.
6. Сделать спеку обязательной для frontend work ссылкой из ближайшего
   `frontend/AGENTS.md`.

## Затронутые компоненты и контракты

| Компонент | Изменение | Public contract/данные |
|---|---|---|
| `repository-workflow` | Agent docs index и нормативная спека | Runtime unchanged |
| `frontend-workspace` | Frontend agent instructions с обязательной ссылкой | Runtime/wire contracts unchanged |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/FRONTEND_ENGINEERING_SPEC.md` | write | Нормативная frontend-спека и audit snapshot |
| `docs/agents/README.md` | write | Обнаружимость спеки |
| `frontend/AGENTS.md` | write | Обязательное чтение спеки перед frontend writes |
| `docs/agents/plans/active/20260729T234102Z-898ef6-frontend-engineering-spec.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260729T234102Z-898ef6-frontend-engineering-spec.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок |
|---|---|---|---|
| `frontend:engineering-guidance-v1` | Нет | этот plan после approval | Exclusive docs/instruction update |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 02:41 MSK через target
  `leinoctl context --paths frontend,docs/agents` и полное чтение двух plans.
- **Пересечения:** path/shared-resource пересечений нет; оба существующих
  draft plan относятся к ADR-0005/ADR-0006.
- **Решение:** независимый docs-only plan; одна session выбирает только его.

## План реализации

1. [ ] Получить явное approval exact plan ID, записать формулировку, перевести
       plan в `in_progress` и выбрать его.
2. [ ] Написать `FRONTEND_ENGINEERING_SPEC.md`: source assessment,
       normative architecture/code/markup/style/responsive/accessibility/test
       contracts и Definition of Done.
3. [ ] Добавить датированную Munchkin gap matrix с приоритетами, не меняя код.
4. [ ] Добавить ссылки из `frontend/AGENTS.md` и `docs/agents/README.md`.
5. [ ] Выполнить text/plan/verify/scope checks, exact diff review, записать
       результаты, завершить и архивировать plan.

## Проверки

- [ ] `node .codex/hooks/plan-lint.mjs`.
- [ ] `./leinoctl text-check --changed`.
- [ ] `./leinoctl verify --changed`.
- [ ] `./leinoctl scope-check --plan 20260729T234102Z-898ef6-frontend-engineering-spec`.
- [ ] `git diff --check`, strict UTF-8 check и финальный read-only review
      только заявленных пяти lifecycle/docs paths.
- [ ] Docker, browser, build и frontend code tests не запускать: runtime code
      не меняется.

## Риски и откат

- **Риск:** монорепозиторные packages/submodules будут ошибочно перенесены как
  Munchkin requirement. **Снижение:** отдельные «переносим / не переносим»
  правила и запрет `@digiversity/*`.
- **Риск:** legacy-дефект Digiversity станет нормой. **Снижение:** normative
  rule опирается на повторяемые config/contract boundaries и явно перечисляет
  anti-patterns живого кода.
- **Риск:** слишком общая спека не поможет агенту принять решение.
  **Снижение:** placement matrix, naming table, responsive matrix, Definition
  of Done и concrete review checklist.
- **Риск:** audit snapshot устареет. **Снижение:** датировать comparison,
  отделить его от стабильных normative rules и требовать сверки executable
  contracts.
- **Риск:** агент не найдёт документ. **Снижение:** обязательная ссылка из
  ближайшего `frontend/AGENTS.md` и docs index.
- **Откат:** удалить новый spec, вернуть две индексные ссылки и lifecycle plan
  обычным revert; runtime/data не затрагиваются.

## Открытые вопросы

- Нет. Спека пишется по-русски с принятыми в repository English code terms.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-30 02:41 MSK
- **Подтверждено:** —
- **Формулировка/ограничения:** пользователь запросил аудит стиля кода,
  архитектуры, naming, подходов, вёрстки, стилей и адаптивов Digiversity
  frontend, переносимую спеку в `C:\Dev\_Personal\_Pet\munchkin`, сравнение с
  уже существующим Munchkin frontend, без написания frontend-кода и без
  зависимости от исходного монорепозитория или его библиотеки.

## Ход выполнения

- Выполнен read-only аудит root/frontend instructions, manifests, shared
  configs, representative applications, adapters/contracts/stores/pages,
  component/shared/API packages, CSS/SCSS tokens, layouts и responsive
  patterns Digiversity.
- Выполнен read-only аудит текущих Munchkin manifests, contracts, gameplay и
  Card Studio UI, global CSS, responsive rule, tests и architecture docs.
- Проверены target status/context и полностью прочитаны оба active draft plan;
  конфликтов write set не найдено.
- Draft создан и заполнен; implementation docs ещё не начата.

## Итог

Заполняется после согласования и завершения документации.
