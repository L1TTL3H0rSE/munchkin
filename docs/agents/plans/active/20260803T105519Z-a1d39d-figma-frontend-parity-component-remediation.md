# PLAN: Figma frontend parity and component remediation

- **Plan ID:** `20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation`
- **Статус:** draft
- **Создан:** 2026-08-03 10:55:19 UTC
- **Обновлён:** 2026-08-03 11:14:42 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** `codex/frontend-remaining-plans`
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260803T083541Z-26e9ab-frontend-compact-figma-handoff`.
- **Блокирует:** дальнейшее обновление frontend visual baselines без Figma-parity evidence
- **Связанные ADR/handoff:** `docs/agents/FRONTEND_ENGINEERING_SPEC.md`, `docs/agents/GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/plans/active/20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation.md",
    "docs/agents/plans/archive/20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation.md",
    "frontend/applications/web/app/pages/index.vue",
    "frontend/applications/web/app/components/GameCard.vue",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/app/components/ui/SheetDialog.vue",
    "frontend/applications/web/app/assets/scss/pages/_game-desktop.scss",
    "frontend/applications/web/app/assets/scss/pages/_game-mobile.scss",
    "frontend/applications/web/app/assets/scss/pages/_lobby.scss",
    "frontend/applications/web/test/**",
    "frontend/test/browser/figmaStateMatrix.ts",
    "frontend/test/browser/lobby.spec.ts",
    "frontend/test/browser/player-ui.spec.ts",
    "frontend/test/browser/visual.spec.ts",
    "frontend/test/browser/visual-baselines/**"
  ],
  "components": [
    "frontend-workspace",
    "pnpm:@munchkin/web"
  ],
  "contracts": [],
  "dependsOn": [
    "20260803T083541Z-26e9ab-frontend-compact-figma-handoff"
  ],
  "sharedResources": [
    "figma:bmxy6z3Z0bBLHLYryYJYrP",
    "frontend:test-browser-visual-baselines"
  ]
}
```

## Цель

Привести lobby и game UI к утверждённому Figma hybrid-source, устранить уже
зафиксированные в green visual baselines наложения, обрезание и лишний текст,
а затем восстановить компонентные границы так, чтобы mobile/desktop были двумя
presentation одного состояния, а не двумя независимо живущими приложениями.

План объединяет remediation в одну последовательную работу по явному запросу
пользователя. Он не является разрешением на немедленную реализацию: сначала
нужны review этого exact plan, явное approval и новый eligible session после
закрытия предыдущего frontend plan lifecycle.

## Критерии приёмки

- [ ] На `360x640` и `1440x900` lobby совпадает по составу текста, иерархии,
  цвету, положению и размерам с Figma `225:14`/`240:53`; отсутствует eyebrow
  `ИГРА НАЧИНАЕТСЯ ЗА СТОЛОМ`, которого нет в Figma.
- [ ] На `360x640` активный стол совпадает с `147:731`: header `332x32` в
  `(14,12)`, opponent row `332x38` в `(14,52)`, encounter rail `360x416` в
  `(0,98)`, dock `328x62` в `(16,554)` и нижняя safe-area `24px`.
- [ ] Door decision соответствует sheet-composition `181:1634`, а не белой
  dashed-заглушке/placeholder deck текущего baseline.
- [ ] Desktop active state соответствует `248:5`; Hand/Required/Connection
  surfaces соответствуют `253:96`, `254:221`, `258:2674`.
- [ ] Reward/run-away/pending/resolving отображаются как взаимоисключающие
  композиции; ни один текстовый блок не лежит поверх карты или другого блока.
- [ ] Все обязательные controls Figma присутствуют и доступны; лишняя кнопка
  `···` в compact header удалена либо отдельно согласована в Figma.
- [ ] Timed/required states показывают предусмотренные Figma timer/indicator;
  timer не появляется в состояниях без законного timed action.
- [ ] Long Russian copy не выходит за `240x400` card boundary: текст
  line-clamp-ится и завершается многоточием; внутреннего scroll и изменения
  геометрии карточки нет, поведение покрыто stress fixture.
- [ ] `1024x768`, `1280x720`, `1280x800`, `1366x768`, `1440x900` показывают все
  три desktop regions без nested clipping; active `240x400` card и right-side
  controls полностью доступны.
- [ ] Минимальный поддерживаемый viewport — `360x640`; dock, primary action и
  safe area полностью доступны без document/nested clipping.
- [ ] На mobile варианты opponent count `1`, `2`, `3` соответствуют `92:5`,
  `92:10`, `92:19`; при большем количестве используется та же карусель и тот
  же внешний вид трёх видимых chips, без отдельного layout.
- [ ] Pager в mobile header показывает индекс текущей encounter-карты и общее
  количество encounter-карт в текущем бою; он не является pager оппонентов.
- [ ] В каждый момент смонтирован один responsive presenter либо один общий DOM
  tree; скрытые watchers, timers и dialogs второго presenter отсутствуют.
- [ ] Encounter state нормализуется одним pure view model с явной precedence;
  template не складывает независимые truthy server fields в одну координату.
- [ ] Desktop/mobile model duplication устранено; общие player, encounter,
  finished, countdown и sheet semantics имеют по одному owner.
- [ ] В runtime остаётся один modal/sheet kernel с согласованными
  `showModal`/Escape/focus-trap/return-focus semantics; nested native dialogs нет.
- [ ] Нет duplicate IDs, clickable `div role=group` вместо native control,
  глобальных `document.querySelector` для локального компонента и nested `main`.
- [ ] Все 40 desktop Figma states сохраняют fixture/semantic coverage; для всех
  добавлены collision/bounds checks, для визуально различных states — curated
  screenshots. Compact integrated/core states получают direct node traceability.
- [ ] Visual baseline нельзя обновить до side-by-side review с указанным Figma
  node; green self-snapshot сам по себе не считается Figma evidence.
- [ ] Frontend lint, typecheck, unit, browser, a11y, visual и repository canonical
  checks проходят; snapshot update выполняется только после отдельного просмотра
  diff изображений.

## Figma source map

У файла видны все десять переданных страниц. `82:2` — cover, не UI source.

| Источник | Роль | Основные implementation anchors |
|---|---|---|
| [01 · Getting Started — 82:3](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=82-3) | Правила source-of-truth: approved hybrid, screens из instances, timer только при legal action | все UI phases |
| [02 · Foundations — 82:4](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=82-4) | Inter/Literata, spacing `4/8/12/16/24/32`, radii, semantic colors/shadows | tokens и component styles |
| [10 · Header — 89:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=89-2) | phase, turn status, timed variants, desktop/compact header | `DesktopGameHeader`, `MobileGameHeader` |
| [11 · Opponents — 91:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=91-2) | chips `91:7…91:27`, rows `92:5/10/19` | desktop/mobile player summary |
| [13 · Encounter Card — 96:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=96-2) | Monster `96:7`, Curse `96:23`, canonical `240x400` | pure card presentation |
| [15 · Player Dock — 105:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=105-2) | hand/character/dock modes, compact `153:31` | HandTab, own state, action slot |
| [17 · Sheets & Choices — 110:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=110-2) | choice, hand/info/decision/interaction/death/victory sheets | unified sheet and interaction surfaces |
| [20 · Integrated States — 122:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=122-2) | compact boards `147:671`, `160:1140` | full `360x640` composition |
| [21 · Lobby Entry — 194:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=194-2) | Selected-B mobile `225:14`, desktop `240:50` | index/LobbyForm/lobby styles |
| [22 · Desktop Battle — 248:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=248-2) | 40 desktop states board `259:708` + flow sheets | desktop table and state matrix |

Ключевые direct frames для side-by-side acceptance:

- [Lobby desktop create idle — 240:53](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=240-53)
- [Compact active turn — 147:731](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-731)
- [Compact door choice — 181:1634](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=181-1634)
- [Desktop active turn — 248:5](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=248-5)
- [Desktop hand expanded — 253:96](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=253-96)
- [Desktop required response — 254:221](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=254-221)
- [Desktop connection failed — 258:2674](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=258-2674)
- [Desktop reward received — 285:1566](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1566)

## Контекст и подтверждённое состояние

### P0 — визуальная композиция сломана, но baseline зелёный

1. `DesktopEncounterStage.vue` независимо рендерит `run_away`,
   `pending_decision` и resolving rail, а desktop CSS помещает все три блока в
   одинаковый absolute rectangle. В `desktop-reward.png` текстовые слои лежат
   друг на друге и на картах; right result выходит за доступную область.
2. Mobile stage делает тот же независимый рендер. `mobile-reward.png` обрезает
   результат ниже viewport, `mobile-run-away.png` перекрывает encounter.
3. Запущенный на текущем HEAD visual suite завершился `18 passed (34.2s)`,
   включая `desktop-reward`, `desktop-run-away`, `mobile-reward` и
   `mobile-run-away`. Это доказывает, что current baseline закрепил дефект.
4. `figmaStateMatrix.test.ts` проверяет количество node IDs, fixture existence
   и semantic coverage, но не получает Figma context/image. `visual.spec.ts`
   сравнивает с repo PNG, а не с Figma. Из 40 desktop states screenshots есть
   только у 9; mobile — 7 representative states.

### P0 — responsive bounds маскируются nested overflow

1. Desktop grid задаёт `248px 768px 360px` и gaps: около `1408px` внутри
   viewport от `1024px`. Родитель скрывает overflow, поэтому right-side
   обрезается, а root overflow assertion остаётся зелёным.
2. На `1280x720`/`1366x768` center row ниже фиксированной encounter card
   `416px`; rail с `top:83px` физически не помещается и обрезает карту.
3. Lobby desktop grid `520 + 480 + 24` шире content area viewport `1024` после
   page padding; отдельной `1024` lobby проверки нет.

### P1 — конкретные расхождения с Figma

| Область | Сейчас в проекте | В Figma | Решение |
|---|---|---|---|
| Desktop lobby | Лишний green eyebrow; `Начни игру.` выделено rust через `<em>` | `240:53`: eyebrow отсутствует, обе строки одного dark tone | удалить лишний copy/semantic emphasis, восстановить exact hierarchy |
| Mobile door | dashed white stage и упрощённый green deck placeholder | `181:1634`: dimmed table + полноценный bottom sheet, real Deck Back, heading/copy/action | собрать из approved sheet/deck/button instances |
| Compact header | дополнительная кнопка `···`; strength-trigger открывает `Детали комнаты` | compact headers показывают phase, pager текущей encounter-карты/общего числа карт в бою, strength и turn; timed variant содержит timer | развести Strength и Room Details, удалить лишний trigger, закрепить card-pager semantics |
| Dock | при пустой hand остаётся пустая beige grid-cell; action висит отдельно | `153:31`: character + meaningful hand state + contextual action + safe area | явные dock modes и collapse policy, без пустого slot |
| Encounter copy | fixed card + `overflow:visible`, длинный текст режется/вылезает | `96:7/96:23`: содержимое остаётся в `240x400` | line-clamp с многоточием без внутреннего scroll |
| Waiting/reward | большие пустоты, clipping и несколько summary layers | integrated/desktop state — одна читаемая primary composition | один state-family owner и precedence |
| Timer/required | compact timer/interaction indicator скрывается CSS | Header и sheet variants содержат status/timer | показывать только в legal timed states, но не скрывать обязательный status |
| Monster/Curse | CardFrame в основном различает deck, не explicit semantic kind | отдельные variants `96:7` и `96:23` | explicit presentation variant/token mapping |

### Компонентный подход: итог аудита

Основа частично хорошая, но текущую реализацию нельзя считать нормально
компонентированной.

Сильные стороны:

- route `/game/:id` тонкий, transport/session вынесен в
  `useGameSessionController`;
- `useGamePresentation` и `gameTableViewModel` дают typed pure mapping и не
  нарушают backend authority/privacy;
- `ActionPanel`, interaction domains и primitives (`CardFrame`, `HandTab`,
  `CardRail`) уже задают полезные границы;
- fixture matrix покрывает 40 server-driven states и является хорошей основой
  для regression suite.

Критические архитектурные долги:

1. `DesktopEncounterStage.vue` — около 996 строк: projection mapping, DOM
   mutation/focus, все encounter/combat/run-away/victory states и две radically
   different responsive CSS layouts. Это выше review-signal `250–300` строк и
   не имеет одной ответственности.
2. `GameTable` одновременно монтирует desktop и mobile trees и скрывает один
   CSS. Оба дерева запускают watchers, querySelector, dialogs и countdowns;
   breakpoint resize не сохраняет единый interaction/focus state.
3. `desktopGameModel.ts` и `mobileGameModel.ts` механически дублируют state
   family, encounter mapping и opponent labels. Roster/own/encounter surfaces
   также реализованы дважды.
4. Page SCSS глубоко стилизует internals child components и `:deep` selectors,
   поэтому geometry owner размазан между component-scoped и global styles.
5. В runtime существуют несовместимые `ui/SheetDialog`,
   `game/sheets/SheetDialog`, `HandSheet` dialog и `InteractionDialog` kernel;
   есть nested native dialogs и непоследовательный return-focus.
6. `EconomySurface` смонтирован в desktop/mobile без `force-dialog` и потому
   эти instances inert; рабочий path идёт через `InteractionSurface`. Это
   дублирующая/неясная integration boundary.
7. Есть semantic defects: clickable `div role=group`, duplicate heading ID в
   CardRail, global `document.querySelector`, wrong sheet открывается из
   strength control, nested `<main>` в loading surface.

## Scope

### Входит

- exact parity для Selected-B lobby, canonical compact `360x640` и desktop
  battle states;
- responsive containment от canonical minimum `360x640` и выше;
- единый state normalization/view model и устранение parallel overlay owners;
- компонентный refactor только там, где он нужен для parity, responsive и
  accessibility;
- унификация modal/sheet semantics и focus behavior;
- тестовый контракт, который различает fixture coverage, geometry/collision
  coverage и reviewed Figma visual parity;
- controlled refresh visual baselines после side-by-side approval.

### Не входит

- backend, contracts, realtime protocol, content schema и game mechanics;
- Card Studio decomposition, кроме общего `GameCard` presentation boundary;
- новые gameplay flows, новые тексты/иллюстрации и изменение Figma;
- Lobby направления `197:2 ChoiceFirst` и `205:6 InviteFirst`: альтернативные
  flows явно не нужны и не реализуются;
- board `122:3` (`360x800`) окончательно исключён из canonical scope;
- mobile landscape layout и orientation-specific mobile behavior;
- dependency install и snapshot update без отдельного разрешения пользователя.

## Архитектурный подход

1. Сформировать `gamePresentationModel.ts`: один pure normalized state family,
   явная precedence и mutually-exclusive primary surface. Server projection
   остаётся authoritative; UI только выбирает presentation из существующих
   actor-visible полей.
2. Не держать два активных application trees. Предпочтительно собрать один
   semantic DOM с responsive layout regions. Если layout divergence требует
   двух presenters — монтировать ровно выбранный presenter через один owner и
   хранить dialog/selection/countdown state выше presenter boundary.
3. Выделить controlled pure `CardPresentation` из action-aware `GameCard`;
   semantic kind и density — explicit props/variants, действия — feature owner.
4. Использовать общие player/own/encounter models; mobile/desktop components
   отвечают только за placement, не повторяют domain labels/state selection.
5. Оставить один `SheetDialog` kernel и тонкие content surfaces. Никаких nested
   dialogs; opener/return-focus — часть общего controlled contract.
6. Перенести component variants/tokens в scoped owner styles/CSS variables;
   page SCSS владеет только page grid/breakpoints и не лезет в child internals.
7. Сделать layout fluid через `minmax`, `clamp`, доступную высоту и explicit
   scroll owners. `overflow:hidden` не используется для маскировки ошибок.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Lobby page | exact Figma copy/layout | route/form behavior без изменения |
| Game presentation model | shared state family/precedence/countdown | новый internal typed UI model |
| GameTable/presenters | один mounted responsive owner | existing command intents сохраняются |
| Encounter/Card | exclusive surfaces, long-copy rule, explicit kind | actor projection не расширяется |
| Opponent/Own/Dock | shared semantic models, layout variants | privacy-safe public/own fields only |
| Sheet/Dialog | один controlled modal kernel | open/close/focus contract унифицируется |
| Economy/Interaction | удалить inert duplicate mount, один surface router | существующие typed submit events |
| Figma matrix/tests | source traceability + bounds/collision/visual layers | test-only metadata |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/pages/index.vue` | write | exact Selected-B lobby copy/composition |
| `frontend/applications/web/app/components/GameCard.vue` | write | split pure card presentation from game action owner |
| `frontend/applications/web/app/components/game/**` | write | shared model, responsive presenters, encounter/player/dock/sheet/status remediation |
| `frontend/applications/web/app/components/ui/SheetDialog.vue` | write | single controlled modal kernel |
| `frontend/applications/web/app/assets/scss/pages/_game-desktop.scss` | write | desktop page grid only; remove deep child ownership |
| `frontend/applications/web/app/assets/scss/pages/_game-mobile.scss` | write | compact page grid only; remove fixed clipping/deep child ownership |
| `frontend/applications/web/app/assets/scss/pages/_lobby.scss` | write | exact lobby composition and 1024 containment |
| `frontend/applications/web/test/**` | write | normalized model and Figma traceability tests |
| `frontend/test/browser/figmaStateMatrix.ts` | write | supplied source pages/direct node evidence |
| `frontend/test/browser/lobby.spec.ts` | write | lobby text/viewport/keyboard contract |
| `frontend/test/browser/player-ui.spec.ts` | write | per-region bounds/collision/focus contract |
| `frontend/test/browser/visual.spec.ts` | write | state visual gate without self-referential claims |
| `frontend/test/browser/visual-baselines/**` | generated | individually reviewed snapshots after approval |
| `docs/agents/plans/active/20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation.md` | write | active lifecycle and recorded evidence |
| `docs/agents/plans/archive/20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation.md` | write | archived lifecycle |

Новые production-файлы внутри `components/game/**` должны быть перечислены в
ходе выполнения до первой записи. Любые paths за пределами таблицы, dependency
changes или contract changes являются material scope change и требуют
повторного согласования.

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| Figma file `bmxy6z3Z0bBLHLYryYJYrP` | design source | designer/product | read-only, node links frozen in this plan |
| browser visual baselines | compact Figma handoff plan | этот plan после approval | не обновлять до reviewed parity diff |

### Проверка конфликтов

- **Проверены active plans:** `./leinoctl context --paths frontend/applications/web/app,frontend/applications/web/test,frontend/test/browser`, 2026-08-03.
- **Обнаруженные пересечения:** `20260803T083541Z-26e9ab-frontend-compact-figma-handoff`
  имеет статус `completed`, остаётся в active и отмечен selected; paths и visual
  baselines пересекаются почти полностью.
- **Решение:** не claim/select/implement этот draft в текущем lifecycle. Сначала
  исправить archive/release предыдущего plan штатным guarded workflow, затем в
  новой trusted session повторить context/preflight и запросить approval exact
  write set. Никакого takeover.

## План реализации

1. [ ] **Lifecycle preflight.** Подтвердить clean user worktree, закрыть
   completed-but-active predecessor, повторить `leinoctl context`, проверить
   write-set/shared-resource conflicts, показать пользователю exact plan ID и
   получить approval.
2. [ ] **Freeze reference matrix.** Добавить supplied page IDs, direct frame
   IDs, viewport, state family и acceptance regions в test manifest. Разделить
   `source mapped`, `semantic fixture covered`, `geometry covered`, `visual
   reviewed`; не называть первое визуальным соответствием.
3. [ ] **Lobby parity.** Удалить лишний eyebrow/rust emphasis, выровнять
   typography/grid/art по `225:14`/`240:53`; добавить `1024` containment и
   mobile keyboard-viewport check.
4. [ ] **Shared state model.** Объединить desktop/mobile duplicated models,
   ввести exclusive primary-surface precedence и один countdown result.
   Зафиксировать unit tests для неоднозначных projections (`run_away` +
   `pending_decision` + resolving cards).
5. [ ] **Responsive ownership.** Перестать одновременно монтировать два trees;
   сделать fluid desktop columns/short-height encounter layout и canonical
   `360x640` dock. Добавить per-region bounding/intersection assertions,
   а не только root scrollWidth.
6. [ ] **Encounter and card parity.** Разделить state controller, card/rail и
   state surfaces; собрать `147:731`, `181:1634`, `248:5`, `285:1566`; ввести
   explicit Monster/Curse variants и line-clamp с многоточием для long copy.
7. [ ] **Header/opponents/dock.** Удалить лишние controls/copy, восстановить
   timer/required indication, закрепить encounter-card pager `current/total`,
   корректные 1/2/3 opponent rows и ту же карусель для `>3`, а также dock modes
   без пустых slots.
8. [ ] **Sheets/interactions.** Унифицировать modal kernel, развести Strength и
   Room Details, удалить inert Economy mounts/duplicate run-away owner, убрать
   nested dialogs и обеспечить Escape/trap/return-focus.
9. [ ] **Component/style cleanup.** Перенести deep child styling к owners,
   удалить дублированные model/style blocks в заявленном write set, заменить
   local/global DOM queries на refs и native controls; устранить nested `main` в
   loading state.
10. [ ] **State verification.** Прогнать все 40 desktop fixtures и compact
    sources; добавить collision/bounds assertions для каждого state family,
    visual snapshots для действительно разных compositions и focus tests для
    sheets/responsive switch.
11. [ ] **Human visual gate.** Сгенерировать side-by-side Figma/current images
    на canonical viewports, отдельно показать пользователю diff и только после
    approval обновить repository baselines.
12. [ ] **Canonical closeout.** Запустить focused + full checks, review diff,
    `verify --changed`, `scope-check`, записать evidence, archive/release и
    сделать отдельный local commit; push только по явному разрешению.

## Проверки

- [ ] `pnpm --filter @munchkin/web lint`
- [ ] `pnpm --filter @munchkin/web typecheck`
- [ ] `pnpm --filter @munchkin/web test`
- [ ] `pnpm --dir frontend test:browser`
- [ ] `pnpm --dir frontend test:a11y`
- [ ] `pnpm --dir frontend test:visual` без `--update-snapshots`
- [ ] viewport matrix: mobile portrait минимум `360x640`, затем `768x1024`;
  desktop `1024x768`, `1280x720`, `1280x800`, `1366x768`, `1440x900`
- [ ] automated no-overlap/no-clipping checks для center/right/dock/dialog и
  state-exclusive surfaces
- [ ] keyboard checks: native activation, focus trap, Escape, return focus,
  responsive resize with an open surface
- [ ] reviewed Figma side-by-side evidence для direct frames из source map
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation`

## Риски и откат

- **Риск:** большой refactor одновременно меняет layout и state composition.
  **Снижение:** выполнять этапами в одном plan, после каждого этапа держать
  fixtures/typecheck/browser checks зелёными и не смешивать snapshot refresh с
  logic change.
- **Риск:** pure normalized model выберет неверную precedence для редкой server
  projection. **Снижение:** зафиксировать observed combined projections как
  unit fixtures; не менять backend contract и не синтезировать скрытые данные.
- **Риск:** один DOM tree окажется недостаточен для radically different layout.
  **Снижение:** допускается один-at-a-time presenter, но state/focus/timer owner
  остаётся общим и скрытый presenter не монтируется.
- **Риск:** line-clamp может скрыть критический gameplay text. **Снижение:**
  authoritative текст остаётся в projection/data, stress fixture проверяет
  многоточие и отсутствие overflow; новый detail-flow не добавляется этим plan.
- **Откат:** отдельные local commits по фазам после зелёных checks; откат
  конкретной фазы обычным revert, без reset/stash и без перезаписи user changes.

## Нужны ли дополнительные экраны Figma

Для исправления уже видимых дефектов — **нет**: supplied pages содержат
достаточные component sources, compact integrated states, Selected-B lobby и
все 40 desktop states.

Дополнительные экраны для уточнённых случаев также не нужны:

- long card copy line-clamp-ится с многоточием внутри `240x400`;
- opponent row при `>3` использует ту же карусель с тем же видом трёх видимых
  chips; отдельный pager оппонентов не добавляется;
- mobile header pager показывает `current/total` encounter-карт в бою;
- альтернативные lobby flows не нужны;
- `122:3` (`360x800`) исключён окончательно.

Tablet/laptop mockup не является обязательным: промежуточная адаптивность
должна корректно интерполироваться из canonical sources и проверяться bounds-
контрактом. Отдельный `768x1024` frame нужен только если дизайнер хочет иной
composition, а не fluid adaptation.

## Открытые вопросы перед approval

- Разрешает ли пользователь после side-by-side review обновить snapshots; само
  approval plan не даёт такого разрешения автоматически.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-08-03 после read-only аудита
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** один большой plan; ссылки на
  Figma nodes; аудит лишнего текста/верстки/frontend component approach; явно
  перечислить действительно недостающие design decisions; read-only сабагенты
  `gpt-5.6-luna` с максимальным reasoning разрешены; minimum viewport
  `360x640`; mobile landscape не реализуется и не проверяется; `360x800` и
  alternative lobby flows исключены; long card copy line-clamp-ится с
  многоточием; opponents `>3` используют ту же карусель; mobile header pager —
  это `current/total` encounter-карт текущего боя.

## Ход выполнения

- Draft создан после read-only repository/Figma/baseline audit.
- Три read-only сабагента независимо проверили component architecture,
  responsive/tests и Figma coverage; production/test code не менялся.
- Current visual suite запущен без snapshot update: `18 passed (34.2s)`.
- По уточнению пользователя minimum viewport изменён на `360x640`; проверки
  `320x568` и mobile landscape удалены из scope до approval.
- Закрыты design questions по `360x800`, long card copy, alternative lobby,
  opponent carousel и mobile encounter-card pager; новые Figma frames не нужны.
- Реализация, approval, claim/select, baseline update, commit и push не
  выполнялись.

## Итог

Заполняется после реализации и human visual gate.
