# PLAN: frontend engineering spec

- **Plan ID:** `20260729T234102Z-898ef6-frontend-engineering-spec`
- **Статус:** completed
- **Создан:** 2026-07-29 23:41:02 UTC
- **Обновлён:** 2026-07-30 04:09 MSK
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

- [x] `docs/agents/FRONTEND_ENGINEERING_SPEC.md` различает нормативные правила,
      объяснение/примеры и датированный audit snapshot; живой Digiversity код
      не объявляется автоматически эталонным.
- [x] Спека задаёт практические правила для workspace ownership, Nuxt app
      structure, contracts/adapters/providers, server authority, realtime
      resync, state ownership, typed mocks, ошибок и async lifecycle.
- [x] Спека задаёт точные соглашения TypeScript/Vue: strict types, imports,
      naming файлов/типов/functions, Composition API, props/emits/models,
      composables/stores, pages/layouts/components и ограничения на `any`,
      assertions, side effects и monolithic components.
- [x] Отдельный раздел покрывает семантическую разметку, forms, keyboard/focus,
      aria, loading/empty/error/disabled/offline states и безопасные
      интерактивные элементы.
- [x] Отдельный раздел покрывает CSS architecture: local tokens, global reset,
      component ownership, BEM-like classes, scoped/global policy, units,
      layout primitives, overflow, stacking, animation/reduced-motion и
      запрет зависимости от Digiversity SCSS/component package.
- [x] Responsive contract задаёт mobile-first/default behavior, именованный
      локальный breakpoint set, content-driven transitions, touch/hover
      capabilities, `dvh`/safe-area/overflow handling и обязательную
      viewport matrix для проверки.
- [x] Включена таблица отличий текущего `munchkin` от нормализованного
      Digiversity-подхода с приоритетами; хорошие target-практики также
      сохранены, а код в рамках этого плана не меняется.
- [x] `frontend/AGENTS.md` явно направляет любого frontend-агента к спеке до
      реализации; `docs/agents/README.md` добавляет её в индекс.
- [x] Документ содержит Definition of Done и copy-ready checklist для нового
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
- Runtime/browser visual audit, screenshots, dependency installation и запуск
  Docker/services. Canonical impact verify может выполнять существующие
  frontend lint/check/tests/build и
  `docker compose --parallel 8 config`, не поднимая сервисы.
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

1. [x] Получить явное approval exact plan ID, записать формулировку, перевести
       plan в `in_progress` и выбрать его.
2. [x] Написать `FRONTEND_ENGINEERING_SPEC.md`: source assessment,
       normative architecture/code/markup/style/responsive/accessibility/test
       contracts и Definition of Done.
3. [x] Добавить датированную Munchkin gap matrix с приоритетами, не меняя код.
4. [x] Добавить ссылки из `frontend/AGENTS.md` и `docs/agents/README.md`.
5. [x] Выполнить text/plan/verify/scope checks, exact diff review, записать
       результаты, завершить и архивировать plan.

## Проверки

- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260729T234102Z-898ef6-frontend-engineering-spec`.
- [x] `git diff --check`, strict UTF-8 check и финальный read-only review
      только заявленных пяти lifecycle/docs paths.
- [x] Canonical impact verify включает существующие frontend lint/check/tests/
      build и `docker compose --parallel 8 config`; browser, dependency
      installation и запуск сервисов не выполняются.

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
- **Риск:** изменение `frontend/AGENTS.md` расширяет canonical impact до всего
  frontend workspace и Compose config, хотя runtime code не меняется.
  **Снижение:** пользователь явно разрешил полный existing gate на Node 24 и
  `docker compose --parallel 8 config`; frontend manifest остаётся источником
  истины с `packageManager: pnpm@10.8.0`. Фактическая версия доступного runner
  записывается в результаты и не канонизируется; сервисы не запускаются, а
  найденный baseline failure не маскируется изменением production scope.
- **Откат:** удалить новый spec, вернуть две индексные ссылки и lifecycle plan
  обычным revert; runtime/data не затрагиваются.

## Открытые вопросы

- Нет. Спека пишется по-русски с принятыми в repository English code terms.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-30 02:41 MSK
- **Подтверждено:** 2026-07-30 03:40 MSK
- **Формулировка согласования:** пользователь явно согласовал exact plan ID
  `20260729T234102Z-898ef6-frontend-engineering-spec` вторым из четырёх
  последовательных планов.
- **Формулировка/ограничения:** пользователь запросил аудит стиля кода,
  архитектуры, naming, подходов, вёрстки, стилей и адаптивов Digiversity
  frontend, переносимую спеку в `C:\Dev\_Personal\_Pet\munchkin`, сравнение с
  уже существующим Munchkin frontend, без написания frontend-кода и без
  зависимости от исходного монорепозитория или его библиотеки. Дополнительно:
  «Для frontend-spec разрешаю полный canonical verify, включая
  lint/check/tests/build и `docker compose --parallel 8 config`, но без запуска
  сервисов». После полного завершения разрешены отдельный commit/push, release
  и select следующего плана.

## Ход выполнения

- Выполнен read-only аудит root/frontend instructions, manifests, shared
  configs, representative applications, adapters/contracts/stores/pages,
  component/shared/API packages, CSS/SCSS tokens, layouts и responsive
  patterns Digiversity.
- Выполнен read-only аудит текущих Munchkin manifests, contracts, gameplay и
  Card Studio UI, global CSS, responsive rule, tests и architecture docs.
- Проверены target status/context и полностью прочитаны оба active draft plan;
  конфликтов write set не найдено.
- Draft создан и заполнен; после select написана нормативная спецификация без
  изменений production/test/config code.
- Получено явное согласование exact plan и full canonical impact verify.
  Lifecycle передан текущей execution-session через проверенный
  `plan claim --takeover`; прежняя planning-session остановлена и writes не
  начинала.
- Plan выбран session `019fb06a-77eb-7c53-b1ae-fb95d21f81fa` командой
  `leinoctl plan select`; docs implementation начата.
- Добавлены обязательные entry points из `frontend/AGENTS.md` и
  `docs/agents/README.md`; датированный audit сохраняет сильные стороны и
  приоритизирует найденные Munchkin gaps.
- Три независимых read-only аудита покрыли architecture/data, TypeScript/Vue/
  tests и CSS/responsive/accessibility. Финальный adversarial review подтвердил
  все девять acceptance criteria; его единственное замечание о pnpm исправлено
  сверкой с executable manifest.
- `./leinoctl text-check --changed`: 4 файла, issues `[]`; strict UTF-8:
  4 файла; `git diff --check`: без замечаний; plan-lint: 11 plans,
  4 active до архивации, 7 archive, 0 issues.
- Canonical `./leinoctl verify --changed` прошёл на Node 24.14.0. Доступный
  runner сообщил pnpm 11.9.0 при manifest contract `pnpm@10.8.0`; зависимости
  не устанавливались, версия runner не канонизирована. Frontend: contracts
  7/7 tests, web 41/41 tests, lint/typecheck и оба Nuxt production build
  прошли. Harness: 42/42; leinoctl: 63 passed, 1 platform skip; Bash syntax и
  `docker compose --parallel 8 config` прошли. Сервисы и browser не запускались.
- Build вывел non-blocking Vue exports deprecation warning. Ошибок проверки
  нет.
- `scope-check`: `ok: true`, `outsideWriteSet: []`,
  `missingRequiredChecks: []`; 4 exact write-set paths остались в
  diagnostic `unledgered`, потому что desktop PostToolUse ledger их не записал.

## Итог

Добавлена Munchkin-owned нормативная frontend engineering specification:
workspace/data authority, strict TypeScript/Vue/Nuxt rules, async lifecycle,
semantic/accessibility contract, CSS ownership/tokens, named responsive
boundaries, testing/review gates и copy-ready Definition of Done. Digiversity
использован только как read-only source context; его topology, private
packages, theme и legacy-дефекты не стали зависимостью. Текущие target gaps
зафиксированы как датированный backlog без изменения runtime code.
