# PLAN: design responsive game ui ux

- **Plan ID:** `20260730T001013Z-717040-design-responsive-game-ui-ux`
- **Статус:** draft
- **Создан:** 2026-07-30 00:10:13 UTC
- **Обновлён:** 2026-07-30 00:13:24 UTC
- **Владелец:** Codex
- **Workspace:** shared / `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260729T234102Z-898ef6-frontend-engineering-spec`, `20260730T001008Z-74d4bb-map-multiplayer-interactions`.
- **Блокирует:** будущие implementation plans для player-facing responsive
  layout, interaction primitives, motion и visual/a11y tests.
- **Связанные ADR/handoff:** ADR-0002, ADR-0004, proposed ADR-0008,
  `docs/agents/FRONTEND_ENGINEERING_SPEC.md`, proposed
  `docs/agents/GAME_INTERACTION_PROTOCOL.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/GAME_UI_UX_SPEC.md",
    "docs/agents/README.md",
    "docs/agents/plans/active/20260730T001013Z-717040-design-responsive-game-ui-ux.md",
    "docs/agents/plans/archive/20260730T001013Z-717040-design-responsive-game-ui-ux.md"
  ],
  "components": [
    "repository-workflow",
    "frontend-workspace"
  ],
  "contracts": [],
  "dependsOn": [
    "20260729T234102Z-898ef6-frontend-engineering-spec",
    "20260730T001008Z-74d4bb-map-multiplayer-interactions"
  ],
  "sharedResources": [
    "frontend:game-ui-ux-design-v1"
  ]
}
```

## Цель

После принятия frontend engineering standard и multiplayer interaction
protocol создать конкретную product UI/UX-спеку для player-facing lobby и
game table. Она должна задать адаптивные layouts, Munchkin-owned breakpoint
contract, визуальное направление, interaction surfaces, motion,
accessibility, copy и проверяемую viewport/state matrix так, чтобы будущая
реализация не имела document-level overflow, не угадывала backend state и не
превращалась в набор несогласованных модалок и анимаций.

## Критерии приёмки

- [ ] `GAME_UI_UX_SPEC.md` отделяет product UX/visual rules от нормативной
  code architecture/style спеки `FRONTEND_ENGINEERING_SPEC.md` и не дублирует
  её placement/naming/TypeScript/CSS ownership правила.
- [ ] Для `/` и `/game/:id` есть screen/state inventory и wireflows:
  loading, empty/lobby, active turn, waiting, interaction request/response,
  combat, timeout/expired, reconnect/resync, stale command, error, victory и
  reduced-motion.
- [ ] Спека локально фиксирует Digiversity breakpoint source values
  `374/427/599/767/1023/1279/1439/1900` с именами
  `mobile/mobile_large/tablet_small/tablet/tablet_large/laptop/desktop/desktop_large`,
  но явно определяет их Munchkin semantics и не создаёт runtime dependency на
  `@digiversity/*`.
- [ ] Source values определены как canonical boundary tokens; для
  `max-width` и mobile-first `min-width` usage явно заданы
  inclusive/exclusive semantics без overlap либо off-by-one gaps. Компонент
  не обязан переключаться на каждом token: transition выбирается по
  content/layout.
- [ ] Viewport matrix включает минимум 320 px, все используемые boundary
  значения и just-below/at/just-above проверки. На каждом состоянии
  `document.documentElement.scrollWidth <= clientWidth`; ни control, ни
  critical content не выходит за safe viewport.
- [ ] Document-level horizontal scroll запрещён. Внутренний card rail/carousel
  допускается только как явный bounded pattern с keyboard/touch navigation,
  visible affordance, focus visibility и альтернативой для reduced motion;
  иначе cards переходят в grid/stack/sheet.
- [ ] Для desktop/tablet/mobile определены layout regions: turn/context
  header, opponents, encounter/combat, own board, hand и persistent action
  surface. Dense 1–6 player state остаётся читаемым.
- [ ] Multiplayer protocol отображается backend-owned descriptors:
  interaction inbox/queue, modal либо bottom sheet, eligible action form,
  helper/reward offer, accept/decline, countdown/grace, pass, closed/expired
  и reconnect state. UI не открывает и не продлевает окно локально.
- [ ] Для dialog/sheet/toast/live update заданы semantics: focus trap/return,
  initial focus, Escape/dismiss rules для mandatory choice, keyboard order,
  accessible name/description, `aria-live` strategy и non-color-only status.
- [ ] Motion map покрывает card play/intervention, combat-strength delta,
  phase/window transition, accepted/declined/expired offer и result. Motion
  interruptible, не скрывает server result, имеет static cue и
  `prefers-reduced-motion` equivalent; high-frequency actions не перегружены.
- [ ] Выбрано одно визуальное направление и token families для color,
  typography, spacing, radius, elevation, iconography и motion; изображения
  карт остаются presentation content, а UI сохраняет читаемость без них.
- [ ] UX writing задаёт короткие labels, status/error/retry/timeout copy и
  различает «команда отправляется», «сервер принял», «state обновлён» и
  «окно уже закрыто».
- [ ] Спека содержит component/surface inventory, phased implementation slices
  и browser visual/a11y verification plan. Playwright/axe/visual tooling
  выбирается отдельным implementation plan, если dependency ещё отсутствует.
- [ ] Внешний `jakubkrehel/skills` оценён как необязательный дополнительный
  review framework. Если он доступен после аудита/pinning,
  `better-interface` применяется вместе со всеми шестью owner skills; если
  нет — completion не блокируется, а coverage выполняется repository
  checklist и browser evidence с явной пометкой, что external pass не запущен.
- [ ] Production Vue/CSS/contracts/config, dependencies и assets в рамках
  этого docs-only design plan не меняются.

## Контекст и подтверждённое состояние

- Player-facing frontend состоит из lobby `/` и game `/game/:id`; Card Studio
  является отдельным development authoring surface.
- Game UI уже рендерит server-supplied `available_actions`, отправляет typed
  intent с expected version и умеет resync после stale version/SSE gap.
- Контракт пока не содержит interaction ID, responder state, target player,
  offer/reward, deadline или pass/accept/decline; поэтому UI/UX plan зависит
  от interaction protocol и не изобретает DTO.
- `ActionPanel` — inline horizontal list без dialogs/toasts/interaction queue.
  Общих modal/sheet/focus/live-region primitives нет.
- `main.css` содержит 638 строк global styles и один
  `@media (max-width: 720px)`. Action/hand/public-card rails используют
  `overflow-x: auto`, а game center сохраняет плотную layout structure.
- Текущие сильные стороны: semantic forms/buttons, disabled states, image
  alt/fallback, strict Zod decoding и unit tests для safe action payload и
  realtime resync.
- Не хватает browser E2E/visual/a11y tooling, focus-visible/reduced-motion
  policy, safe-area/dvh handling, named breakpoint set и проверяемой viewport
  matrix.
- Digiversity `breakpoints.json` содержит восемь boundary values и генерирует
  TS/SCSS tokens; живой код использует их и в max-width media queries, и через
  custom `greater(...)` breakpoint composable. Переносится только локально
  адаптированный числовой contract, не package/theme/source code.
- Existing plan `20260729T234102Z-898ef6-frontend-engineering-spec` должен
  первым определить Munchkin engineering culture и является hard dependency.
- Репозиторий `jakubkrehel/skills` содержит coordinator `better-interface` и
  owner skills для UI polish, typography, colors, accessibility, layout и UX
  writing. Это evidence-based review collection, а не game product designer
  либо implementation framework.

## Scope

### Входит

- `GAME_UI_UX_SPEC.md` для player-facing lobby/game flows.
- Breakpoint table и responsive layout/state matrix.
- Wireflows для interaction windows, dialogs/sheets/toasts и reconnect.
- Visual direction/tokens, motion map, accessibility и UX writing contract.
- Browser/visual/a11y verification matrix и future implementation slicing.
- Ссылка из agent docs index после завершения engineering-spec dependency.

### Не входит

- Vue components, composables, CSS, Zod contracts и production runtime.
- Port/copy Digiversity components, SCSS, fonts, assets, theme или
  `@digiversity/*` dependency.
- Установка внешних agent skills, package dependencies, Playwright или axe.
- Изменение backend interaction/gameplay rules.
- Redesign Card Studio либо будущей production admin console.
- Создание финальных card illustrations.
- Commit, push, deploy и публикация.

## Архитектурный подход

1. Сначала принять engineering spec и interaction protocol; product UX
   потребляет их как constraints, а не проектирует parallel architecture.
2. Проектировать от полного state matrix, а не от единственного happy-path
   screenshot. Loading/error/reconnect/timeout и 1–6 players имеют
   first-class layouts.
3. Зафиксировать source breakpoint values как Munchkin-owned tokens и
   отдельно определить semantic layout transitions. Не размножать media query
   на каждый token без content-driven причины.
4. Использовать stable page shell без viewport overflow; hand/opponents/actions
   получают responsive grid, stack, drawer/sheet или bounded rail по
   проверяемому правилу.
5. Разделить transient feedback и decision surfaces: toast/status для
   необязательного результата, modal/sheet для scoped interaction, persistent
   action dock для доступных server actions, live region для realtime status.
6. Связать motion с domain event/state delta. Optimistic animation может
   показывать только pending intent, но никогда не симулирует итог боя,
   deadline extension или принятую помощь.
7. Проверять визуальное качество реальным browser render на viewport/state
   matrix. Source-only audit не доказывает отсутствие overflow, clipping,
   focus loss или motion defects.
8. Применять полный `better-interface` collection как второй независимый
   review pass. Его findings проходят через repository spec, product
   constraints и browser evidence.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository-workflow | Product UI/UX spec и docs index | Runtime unchanged |
| frontend-workspace | Future layout/interaction/motion contract | No code or wire change in this plan |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/GAME_UI_UX_SPEC.md` | write | Нормативная player-facing UI/UX design spec |
| `docs/agents/README.md` | write | Обнаружимость UI/UX spec после engineering spec |
| `docs/agents/plans/active/20260730T001013Z-717040-design-responsive-game-ui-ux.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260730T001013Z-717040-design-responsive-game-ui-ux.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:game-ui-ux-design-v1` | будущие frontend implementation plans | этот plan | Engineering standard + interaction protocol сначала, затем product design |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 00:13:24 UTC через
  `leinoctl context --paths backend/game,frontend`.
- **Обнаруженные связи:** frontend engineering spec также пишет
  `docs/agents/README.md`, но не runtime; interaction plan определяет будущие
  UI surfaces/contracts. Storage/admin plans относятся к P2 control plane и
  не входят в player-facing scope.
- **Решение:** этот plan зависит от обоих design prerequisites; sequenced
  overlap с docs index допустим. Frontend runtime implementation выделяется
  после принятия UI/UX spec.

## План реализации

1. [ ] Дождаться завершения frontend engineering spec и interaction protocol.
2. [ ] Провести browser-аудит lobby/game во всех существующих состояниях и
   зафиксировать реальные overflow/focus/motion gaps.
3. [ ] Составить screen/state/wireflow map и responsive layout regions для
   1–6 players.
4. [ ] Зафиксировать локальный breakpoint contract, viewport matrix и
   overflow/container/rail policies.
5. [ ] Выбрать visual direction/tokens и описать interaction primitives,
   motion, accessibility и UX writing.
6. [ ] Создать wireflows для help/intervention/countdown/timeout/reconnect,
   опираясь только на server protocol descriptors.
7. [ ] Выполнить full cross-discipline review с полным `better-interface`
   collection, если skills отдельно проверены и доступны; иначе пройти те же
   repository-owned domain gates вручную и записать external review как not
   run. Все runtime-dependent claims подтвердить browser evidence.
8. [ ] Сформировать phased implementation backlog и verification gates,
   обновить docs index.
9. [ ] Выполнить canonical checks, scope-check, exact diff review и
   архивировать plan.

## Проверки

- [ ] `node .codex/hooks/plan-lint.mjs`.
- [ ] `./leinoctl text-check --changed`.
- [ ] `./leinoctl verify --changed` на repository Node 24 toolchain.
- [ ] `./leinoctl scope-check --plan 20260730T001013Z-717040-design-responsive-game-ui-ux`.
- [ ] `git diff --check` и read-only review dependency/scope/breakpoint tables.
- [ ] Browser viewport/state audit results записаны с exact dimensions;
  непроверенные states явно помечены.
- [ ] Production frontend tests не требуются, пока runtime code не меняется.

## Риски и откат

- **Риск:** внешний review skillset будет принят за замену product design.
  **Снижение:** interaction protocol, repository engineering spec и browser
  evidence первичны; skills дают только дополнительный review lens.
- **Риск:** слепой перенос восьми breakpoints создаст ненужные скачки и
  противоречие mobile-first подходу.
  **Снижение:** сохранить source values, формально определить max/min
  inclusive semantics и использовать только content-driven transitions.
- **Риск:** абсолютный запрет любого horizontal rail сделает большую руку
  либо список opponents непригодными на 320–427 px.
  **Снижение:** запретить document overflow; bounded rail допускается только
  после UX/a11y проверки либо заменяется grid/stack/sheet.
- **Риск:** анимации маскируют authoritative update, тормозят частые действия
  или мешают accessibility.
  **Снижение:** event-linked interruptible motion, static cue, reduced-motion
  equivalent и performance budget.
- **Риск:** client timer drift создаст ложное ощущение принятого действия.
  **Снижение:** absolute server deadline, visible resync state и server result
  как единственная authority.
- **Откат:** удалить UI/UX spec и её строку из docs index обычным revert;
  runtime/assets остаются неизменными.

## Открытые вопросы

- Какое визуальное направление развивать: текущий тёмный acid/road motif,
  более настольную tactile эстетику или гибрид.
- Допустим ли bounded horizontal hand rail на узких экранах либо нужен только
  fan/stack/grid с отдельным full-hand sheet.
- Нужны ли звук/haptics как отдельный optional feedback layer.
- Какие representative mocked states сохранить для будущих visual regression
  tests и как исключить platform-specific font noise.
- Устанавливать ли полный `jakubkrehel/skills` как personal Codex skills либо
  использовать pinned read-only references во время review.

## Согласование

- **Статус:** backlog draft; approval intentionally not requested yet
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** сначала завершить
  `20260729T234102Z-898ef6-frontend-engineering-spec`; затем сделать
  адаптивный UI без выезда за viewport, портировать breakpoint values из
  Digiversity, проработать interactions/animations и оценить достаточность
  `https://github.com/jakubkrehel/skills/tree/main`.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Выполнен read-only аудит current screens, contracts, action rendering,
  global CSS/responsive rule, tests, Digiversity breakpoint source/usage и
  внешнего interface review skillset.

## Итог

Заполняется после реализации.
