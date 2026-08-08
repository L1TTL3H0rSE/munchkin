# PLAN: frontend gameplay flow responsive figma remediation

- **Plan ID:** `20260805T000140Z-ef4dda-frontend-gameplay-flow-responsive-figma-remediation`
- **Статус:** completed
- **Создан:** 2026-08-05 00:01:40 UTC
- **Обновлён:** 2026-08-08 08:59:42 UTC
- **Владелец:** Codex session `019fc7ae-ee88-7932-9588-a41aad2c59de`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** нет
- **Блокирует:** утверждение frontend как playable/Figma-parity complete
- **Связанные ADR/handoff:**
  [`20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation`](../archive/20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation.md)

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/plans/active/20260805T000140Z-ef4dda-frontend-gameplay-flow-responsive-figma-remediation.md",
    "docs/agents/plans/archive/20260805T000140Z-ef4dda-frontend-gameplay-flow-responsive-figma-remediation.md",
    "backend/game/internal/game/model.go",
    "backend/game/internal/game/event.go",
    "backend/game/internal/game/engine.go",
    "backend/game/internal/game/rules.go",
    "backend/game/internal/game/projection.go",
    "backend/game/internal/game/*_test.go",
    "backend/game/internal/game/**",
    "backend/game/internal/application/**",
    "backend/game/internal/application/interaction_runtime_test.go",
    "backend/game/internal/transport/httpapi/**",
    "backend/game/internal/transport/httpapi/router_test.go",
    "backend/game/internal/transport/httpapi/testdata/**",
    "frontend/packages/contracts/src/index.ts",
    "frontend/packages/contracts/test/**",
    "frontend/packages/contracts/src/**",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/composables/useGamePresentation.ts",
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/components/ActionPanel.vue",
    "frontend/applications/web/app/components/GameCard.vue",
    "frontend/applications/web/app/components/studio/CardStudioPanel.vue",
    "frontend/applications/web/app/components/actionModel.ts",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/ui/SheetDialog.vue",
    "frontend/applications/web/app/assets/scss/pages/_game-mobile.scss",
    "frontend/applications/web/app/assets/scss/pages/_game-desktop.scss",
    "frontend/applications/web/app/**",
    "frontend/applications/web/test/**",
    "frontend/test/browser/**",
    "frontend/test/browser/visual-baselines/chromium/**"
  ],
  "components": [
    "go:backend/game",
    "pnpm:@munchkin/contracts",
    "pnpm:@munchkin/web",
    "frontend-workspace"
  ],
  "contracts": [
    "game:http-v1"
  ],
  "dependsOn": [],
  "sharedResources": [
    "game-http-v1-projection",
    "backend-game-engine",
    "frontend-game-presentation",
    "frontend-browser-baselines"
  ]
}
```

## Цель

Вернуть frontend в состояние, в котором полный авторитетный игровой цикл
проходим двумя игроками через реальный browser → frontend → HTTP backend
boundary, а каждый отображаемый desktop/mobile visual принадлежит закрытому
Figma-каталогу. Удалить legacy/fallback presentation, внутренние машинные
теги и generic controls, которых нет в Figma; исправить responsive как
непрерывный usable contract, а не композицию только для `360x640` и
`>=1024px`.

Этот plan заменяет ложный вывод предыдущего closeout о достигнутой parity.
Зелёные snapshot/harness результаты не считаются доказательством
playability или Figma parity без живого flow и прямой side-by-side проверки.

## Авторитетный игровой flow

1. Создать комнату → присоединить игроков → владелец начинает игру.
2. Каждый игрок получает ровно восемь стартовых карт — четыре Door и четыре
   Treasure — и по очереди выполняет setup: управляет только серверно
   разрешёнными картами и подтверждает `finish_setup`. Никаких отдельных
   «трёх карт на поле» в состоянии игры нет.
3. Активный игрок входит в preparation: экипировка/снятие, разрешённая
   экономика и способности, затем `open_door`.
4. Результат двери определяется только сервером:
   - monster → combat;
   - curse → resolve_effect/обязательный choice, затем door_choice;
   - иная карта → в руку, затем door_choice.
5. В door_choice игрок выбирает ровно один серверно доступный путь:
   `look_for_trouble` с монстром из руки либо `loot_room`.
6. В combat участники используют только projected card/ability/help/response
   actions. Активный игрок инициирует `request_combat_resolution` из
   `turn.combat.resolution_action`; сервер открывает combat-response window,
   принимает ответы/pass и сам завершает расчёт.
7. Победа → сервер выдаёт level/treasures и переводит в charity либо victory.
   Поражение → сервер закрывает combat и переводит в run-away sequence.
8. Run-away выполняется для текущего actor/monster: серверный бросок,
   projected modifiers/responses, success либо bad stuff/death/death-loot.
9. Charity закрывает превышение hand limit через один projected action и одну
   Figma-модалку. Если actor не является самым слабым и есть допустимые
   получатели, лишние карты передаются только им. Если actor имеет минимальный
   уровень (включая ничью по минимуму) либо после исключения игроков, у которых
   уже больше authoritative hand limit (обычно 5), допустимых получателей нет,
   те же exact excess cards сбрасываются без выбора получателя. Затем end_turn
   передаёт ход следующему игроку и возвращает его в preparation.
10. Ни presentation model, ни visual component не вычисляет RNG, победу,
    преследование, награду, следующего actor или допустимое действие.

## Критерии приёмки

### P0 — playability и actor authority

- [x] Двухпользовательский real-boundary browser flow проходит минимум один
  полный ход: create/join/start → setup обоих игроков → open door → combat →
  combat response/pass → reward либо run away → charity → end turn →
  preparation следующего игрока.
- [x] `turn.combat.resolution_action.type=request_combat_resolution`
  нормализуется в одно явное Figma-действие активного игрока; frontend не ждёт
  отсутствующий legacy `resolve_combat` в `turn.available_actions`.
- [x] Observer никогда не получает активное/mandatory действие текущего
  игрока: combat resolution, run away, effect choice и turn decisions actor
  gated по projection.
- [x] Один modal/sheet owner сохраняет обязательное server decision;
  параллельный info/interaction sheet не может нативно закрыть mandatory sheet
  и оставить реактивное `open=true`.
- [x] В каждом active state UI либо показывает исполнимое projected действие,
  либо честно указывает конкретного ожидаемого actor/window; невозможна пара
  «ТВОЙ ХОД» + «Ожидаем ход другого игрока».
- [x] Побег становится доступен только после закрытого проигранного боя и
  проходит до server result/bad stuff; UI не предлагает «смыться» до
  разрешения боя.
- [x] `run_away_response` interaction является единственным projected owner
  выбора смывки/pass/modifier: обычного `run_away` action frontend не
  изобретает и не отправляет через generic command endpoint.
- [x] Dead actor не теряет игровой стол, пока ему принадлежит обязательный
  `death_loot_priority` choice; death screen появляется только после
  завершения всех actor-required death/death-loot действий.
- [x] Победа показывает только фактически выданную сервером награду. Frontend
  не подставляет `you.hand.slice(...)`, static monster treasure potential или
  иной локально угаданный набор карт.
- [x] Reward-result privacy определена для всех участников: combat actor и
  helper получают exact card views только для карт, выданных именно этому
  viewer; `levels_gained` exact только для соответствующего получателя;
  остальные видят `public_rewards[]` с `player_id`, treasure count и public
  level delta без чужих card IDs/content. Non-recipient observer не получает
  `viewer_rewards`.
- [x] Setup projection и UI сохраняют инвариант стартовой руки `4 Door + 4
  Treasure = 8`: три cards, сейчас получаемые через объединение зон и
  `.slice(0, 3)`, не считаются отдельной зоной и удаляются. Desktop preparation
  `293:1670` показывает максимум три Choice Card только как server-bound legal
  preparation/equip candidates; полная рука остаётся в hand surface. Compact
  board не создаёт произвольное трёхкарточное «поле».
- [x] Charity eligibility вычисляет backend. Actor с минимальным уровнем,
  включая tie, получает `eligible_recipient_ids=[]`. Другой lowest-level
  recipient исключается, если его hand count уже больше server-owned hand
  limit; если кандидатов не осталось, projection также возвращает пустой
  список и тем самым однозначно включает discard-only mode.
- [x] В transfer mode все `excess` allocations имеют projected eligible
  recipient; в discard-only mode все `excess` allocations не имеют recipient.
  Смешанная передача/сброс при непустом eligible list запрещена engine tests и
  не предлагается UI.

### Closed-set Figma presentation

- [x] Каждый runtime state сопоставлен существующему Figma frame/component;
  unmapped state является explicit protocol/design stop, а не новым visual.
- [x] Generic `ActionPanel` checkbox/radio form не используется как gameplay
  fallback; selection/confirm surfaces реализованы только разрешёнными Figma
  Choice Card/Sheet contracts.
- [x] Отдельная discard modal не создаётся: её нет в Figma. `CharityTransfer`
  и `CharityDiscard` используют один и тот же desktop `256:316`, compact
  `147:978` и owner `game-modal:charity`. В discard mode сохраняется выбор
  ровно `excess` cards, но отсутствует recipient selector/step; меняются только
  title/instruction/primary action на discard semantics внутри того же shell.
- [x] Legacy `EconomySurface` charity form с native `<select>`, вариантами
  «Не выбрано»/«Сбросить»/raw player IDs и generic copy физически удалён из
  runtime charity path; его невозможные fixtures/tests также удалены либо
  заменены exact Choice Card contract.
- [x] Удалены старые тексты, empty panels, dead selectors и presentation
  branches, отсутствующие в Figma, включая `desktop-phase-card`, «Ждём
  следующую карту», «Текущая задача», «Текущий контекст», «Зоны» и сходные
  fallback. Они не скрыты CSS и не сохранены как compatibility branch, а
  удалены вместе с tests/selectors, которые их поддерживали.
- [x] Character/hand/opponent/info sheets используют Figma geometry; карточки
  не перекрываются, не выходят из sheet и не получают generic CTA поверх card.
- [x] Character/equipment modal реализован как отдельный Figma surface, а не
  generic card gallery. Desktop использует `Character & Equipment / Desktop`
  `267:708`: `940x620`, summary `280x488`, equipment panel `596x488`, fixed
  2x2 equipment grid и carried-items summary. Mobile использует
  `Info Sheet / Compact, Kind=Character` `165:42`: `360x470`, content
  `328x336`, fixed 2x2 slots `148x72`, carried summary `304x88` и `24px`
  safe-area.
- [x] В equipment modal нет `GameCard`, full encounter/choice card, artwork,
  rules body или card-level CTA. Каждый надетый item представлен только
  approved `EquipmentSlot` tile: slot label, short item name, bonus and
  filled/empty state. Carried items перечислены отдельным compact summary.
- [x] Desktop copy и states повторяют direct nodes: title «Персонаж и
  экипировка», subtitle «Класс, раса, бонусы и занятые слоты»; labels
  `ГОЛОВА`, `ТЕЛО`, `НОГИ`, `РУКИ · 2`; empty tile использует dashed border,
  bonus `—` и value «Свободно». Mobile labels — `ГОЛОВНЯК`, `БРОНЯ`,
  `ОБУВЬ`, `РУКИ`; empty tile использует solid border и value «Пусто».
  Эти различия не унифицируются общим CSS state.
- [x] Slot order фиксирован Figma: `headgear`, `armor`, `footgear`, `hands`;
  empty slot показывает `Пусто/Свободно`, hands учитывает `card.hands` и
  двуручный предмет. Class/race берутся из `you.traits[].trait_group`, escape
  badge — из authoritative `you.escape_bonus`; raw `character_tags` не
  рендерятся.
- [x] Desktop summary показывает пять exact rows: `Уровень`, `Базовая сила`,
  `Экипировка`, `Временные бонусы`, `Карт в руке`. Frontend не вычисляет их
  вычитанием из aggregate combat strength. Actor projection предоставляет
  `you.strength_breakdown={base_strength,equipment_bonus,temporary_bonus,
  total_strength,hand_count}`; `level` остаётся `you.level`. Breakdown
  учитывает только personal contributions: helper, monster и encounter-side
  modifiers исключены; backend typed rules единолично классифицируют
  persistent/conditional/active effects.
- [x] Тап/click по equipment slot открывает exact
  [Bottom Sheet/Equip 340:3475](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=340-3475),
  owner `game-modal:equip-slot`. Rail показывает только current equipped item
  и actor-visible owned items из `hand`/`carried` с тем же authoritative
  `item_slot`; item другого slot и non-item запрещены. `hands` объединяет
  одно-/двуручные вещи в один slot family. Видимость card не означает
  допустимость действия: кнопки по-прежнему требуют projected binding.
- [x] Exact equip sheet имеет `360x470`, title «Выбор карты», subtitle
  `{slot label} · {current item name} {signed bonus}`, horizontal Choice Card
  rail `332x218`, primary action `328x52`, safe area `24px`. «Снять» видна
  только при exact projected `unequip_item(source_instance_id=current)`;
  «Экипировать» — только для выбранной card с exact projected
  `equip_item(source_instance_id=selected)`. После server response sheet
  остаётся согласован с новой projection либо закрывается coordinator; UI не
  предполагает локально, что replacement разрешён.
- [x] Fast equip из hand использует exact
  [Bottom Sheet/Equip from hand 342:3574](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=342-3574),
  owner `game-modal:hand`. После тапа по hand item selected Choice Card
  получает state `Selected`, и кнопка «Экипировать» появляется только при
  projected `equip_item` binding для exact `instance_id`; non-item/illegal item
  не получает эту кнопку. Sheet остаётся `360x410`, header «Рука · N», close
  «Закрыть», rail `332x218`, action `328x52`, safe area `24px`.
- [x] `equip_item` является одной atomic server command и принимает legal item
  из `hand` либо `carried`: из hand server удаляет карту из hand и сразу
  помещает в equipped; из carried сохраняется существующее поведение. Никакой
  client-side цепочки `play_card → equip_item`, промежуточного fabricated state
  или optimistic slot mutation. Backend повторно проверяет phase, ownership,
  restrictions, slot/hands capacity и big-item allowance.
- [x] Desktop exact/fast equip используют `Game Flow Sheet / Desktop`
  `291:1587`, не mobile geometry: `768x502` modal, `720x64` header,
  `720x318` card row, `720x44` footer. Exact slot flow подставляет title/
  subtitle выбранного slot и только same-slot cards; fast hand flow следует
  integrated `293:1670`. На desktop projected equip/unequip action принадлежит
  соответствующей Choice Card/explicit text action внутри этого archetype;
  mobile-only bottom button/header control не добавляется в desktop shell.
- [x] Card primitive совпадает с Figma не только outer rectangle: проверяются
  border/radius, image/title/text/stat regions, typography, badges, internal
  padding and overflow на desktop/mobile и внутри каждого sheet/rail.
- [x] Default legacy branch `GameCard → CardPresentation → CardFrame` не
  используется как универсальная запасная карточка. Каждый call site обязан
  выбрать named Figma variant (`Encounter`, `Choice`, approved hand/info
  variant и т. п.); после миграции call-site inventory unsupported default
  branch, его CSS и obsolete tests удаляются физически.
- [x] Единственный найденный non-game caller default branch — preview в
  `CardStudioPanel.vue` — также переводится на explicit existing
  `Encounter`/`Choice` variant по card kind либо удаляет unsupported preview.
  Это узкая caller migration для физического удаления fallback; workflow и
  layout Card Studio не перерабатываются.
- [x] В user-visible copy не попадают `local`, `courier`, `class`, `race`,
  `cheat` и другие machine identifiers. Класс/раса/черта показываются именем
  соответствующей projected card/content presentation либо не показываются,
  если такого visual нет в Figma.
- [x] `projection.players` трактуется как полный публичный roster: текущий
  игрок исключён из opponent components, а room/player count не получает `+1`.
- [x] После non-monster door центральный surface отражает door-choice result,
  а не продолжает показывать deck/open-door prompt.

### Responsive и geometry

- [x] Layout implementation проходит структурный refactor, а не локальную
  подгонку screenshots: обычный document flow, intrinsic Grid/Flex,
  `minmax(0, 1fr)`, `clamp()`, container/content pressure и semantic max-width
  заменяют magic offsets/fixed tracks. Absolute positioning допустим только
  для настоящего overlay/decoration внутри явно positioned owner и не задаёт
  центрирование, responsive column placement, высоту stage или dock anchoring.
- [x] `360x640` — минимальный full-support viewport. На нём доступны весь
  legal flow, modal actions, keyboard focus и readable content без root
  horizontal overflow. Более узкие widths остаются safety-only и не входят в
  Figma pixel-parity обещание.
- [x] Encounter card центрируется layout-механизмом по доступной ширине;
  отсутствует `left: 52px` или иной coordinate, корректный только на 360px.
- [x] `mobile-game-header__strength` геометрически центрирован относительно
  header/viewport и не зависит от ширины phase/pager/turn copy.
- [x] Compact dock прижат к нижней safe boundary для разных высот, используя
  `max(design padding, env(safe-area-inset-bottom))`; лишняя высота уходит в
  центральную область, а не под dock.
- [x] Диапазон `600–1023px` имеет самостоятельную usable композицию либо
  доказанную fluid adaptation; desktop two-column minimums не делают игру
  неиграбельной сразу после 599px.
- [x] Обязательные user-width rows: `360x640`, `428x926`, `600x900`,
  `768x1024`, `1024x768`, `1280x720`, `1400x900`, `1920x1080`. Между ними
  проверяются representative widths `394`, `514`, `684`, `896`, `1152`,
  `1340`, `1660`; реально используемые CSS boundaries дополнительно проходят
  `N-1/N/N+1`. Figma canonical `1440x900`, short-height и `667x375` остаются
  отдельными checks. Нигде нет overlap, clipped critical action,
  horizontal/root overflow или потерянного keyboard focus.
- [x] Exact Figma checks сохраняют `Encounter Card 240x400` и compact dock
  `328x62` на canonical frame, но intermediate viewports не используют
  растянутую/обрезанную копию этого одного frame.

### Tests и evidence

- [x] Frontend fixtures воспроизводят реальные mutually-exclusive backend
  shapes: combat-response profile не добавляет одновременно
  `resolution_action` и legacy `resolve_combat`.
- [x] Setup fixture содержит восемь dealt hand cards, но не дублирует первые
  три как encounter/board cards. Preparation candidates строятся по exact
  projected bindings, а zero-candidate state использует существующий Figma
  Empty mode, не новый fallback visual.
- [x] `charity-transfer` fixture содержит только allocations с допустимыми
  recipients. Отдельный `charity-discard` projection имеет
  `eligible_recipient_ids=[]` и только recipient-less allocations; прежняя
  смешанная fixture удалена как невозможная для реального backend.
- [x] `single-door-choice` fixture содержит только реально допустимые
  `look_for_trouble`/`loot_room`; `action-coverage` не собирает несовместимые
  действия в одной preparation projection; actor/observer fixtures разделены.
- [x] Roster fixtures действительно покрывают public roster от 1 до 6 игроков;
  six-player fixture содержит шесть total players, а не три плюс отдельно
  дорисованный hero.
- [x] Pure presentation tests покрывают actor/observer, action ownership,
  combat request/response/complete, run-away, effect, charity, end-turn,
  death/death-loot и victory.
- [x] Browser tests используют реальный backend boundary для P0 core loop;
  page-route fixture smoke явно отделён и не называется E2E.
- [x] Все 43 строки frozen runtime mapping — 40 исходных desktop board states
  плюс `HandFastEquip`, `EquipmentSlotOpen` и data-mode `CharityDiscard` — и
  все разрешённые mobile integrated states проверяются на descriptor →
  rendered node/state reachability; screenshot coverage не ограничивается 9
  desktop cases.
- [x] Для каждого runtime descriptor записана одна строка mapping:
  `state → Figma node → desktop DOM owner → mobile DOM owner → primary sheet`;
  один state не может одновременно владеть двумя primary sheets.
- [x] Browser assertions для equipment проверяют не только open/focus:
  desktop/mobile DOM содержит четыре ordered slots и carried summary, не
  содержит `.game-card`, `.card-frame`, artwork или raw tags; canonical
  bounding boxes и overflow совпадают с direct Figma nodes.
- [x] Mobile ActiveTurn `147:731` проверяется настоящим full-roster state:
  три opponent chips, три encounter cards с left/right peek и выбранной
  центральной card; fixture `opponents-one` не считается доказательством этого
  frame.
- [x] Responsive browser matrix проверяет N-1/N/N+1, geometry ключевых
  children, root overflow, dock bottom gap, visible/enabled critical action,
  keyboard focus и long Russian copy.
- [x] Visual baselines обновляются только после прямой side-by-side проверки
  каждого изменённого Figma node и current screenshot. No-update rerun должен
  пройти после обновления. Baseline, созданный из текущего UI без Figma
  comparison, запрещён.
- [x] `pnpm lint`, `pnpm check`, `pnpm build`, focused browser/a11y/visual,
  `./leinoctl verify --changed` и `./leinoctl scope-check --plan ...` проходят
  с записанным evidence.
- [x] Push не выполняется.

## Контекст и подтверждённое состояние

### Browser evidence, 2026-08-04/05

- Root лично создал комнату, присоединил Алису и Бориса, начал игру, завершил
  setup обоих игроков, открыл non-monster door и выбрал «Искать
  неприятности» с монстром из руки.
- В реальном бою `1:1` активный игрок видел «ТВОЙ ХОД», но ни один visible
  control не отправлял combat resolution; единственная кнопка расчёта открыла
  read-only strength sheet. Оба клиента показывали ожидание другого игрока.
- Независимый single-player прогон открыл monster `1:7` и остановился тем же
  способом. Console error/warning отсутствовал: это presentation/action
  contract defect, а не runtime exception.
- Реальная двухпользовательская комната отображалась как «Соперники · 2» и
  «3 игрока»: `projection.players` уже содержит actor, но frontend считает
  массив только opponents и дополнительно прибавляет единицу.
- После non-monster door карта появилась в руке и server открыл door_choice,
  однако центральный visual продолжал показывать «Открытие двери».
- Победный reward visual в текущем mobile presenter берёт первые две карты
  руки, а не выданные сервером treasures; это fabricated state, который нельзя
  исправить одной CSS/Figma правкой.

### Подтверждённая причина P0 stop

- Backend при `CombatResponses` проецирует активному actor
  `turn.combat.resolution_action={type: request_combat_resolution}` и намеренно
  не кладёт `resolve_combat` в `turn.available_actions`.
- `useGamePresentation` и `GameTable` строят turn actions только из
  `projection.turn.available_actions`; nested resolution action нигде не
  потребляется.
- Test fixture `single-combat` содержит невозможную live-комбинацию:
  `resolution_action` плюс `[resolve_combat]`; поэтому unit/browser snapshots
  не воспроизвели настоящий stop.
- Generic controller отправляет `ActionDescriptor.type` в
  `/commands/{type}`, хотя отдельный `requestCombatResolution()` API уже есть и
  не используется. Нужен typed dispatch по источнику действия, а не cast
  nested action к legacy descriptor.
- После проигрыша обычного projected `run_away` action нет: переходом владеет
  `run_away_response` interaction. Текущая ActionPanel-centric модель не
  связывает этот обязательный decision с Figma run-away surface.
- Route скрывает death table, когда actor dead, а InteractionSurface также
  подавляет dead actor; projected `death_loot_priority` из-за этого может быть
  недоступен.
- SheetDialog закрывает предыдущий native dialog глобально; локальный open
  state InteractionSurface может остаться `true`, из-за чего mandatory sheet
  больше не откроется до смены surface key.

### Подтверждённый contract gap для reward/result

- При победе engine сразу выдаёт treasures/level, очищает encounter и
  переводит turn в charity/finished. Combat projection после этого исчезает.
- Текущий presenter выводит reward из static monster fields и
  `you.hand.slice(0, 2)`, поэтому не может доказать фактически выданные карты.
- Plan включает минимальный replay-deterministic actor-specific result
  projection: сервер сохраняет результат завершённого combat до успешного
  `end_turn`/начала следующего turn. DTO содержит `outcome`,
  `public_rewards[{player_id, treasure_count, levels_gained}]` и опциональный
  `viewer_rewards{cards, levels_gained}`. Combat actor и helper получают в
  `viewer_rewards` только свои фактически выданные карты; observer получает
  только public counts/deltas. Никаких hidden card identities другим игрокам,
  hand-diff inference или повторного RNG.

### Подтверждённые setup/charity defects

- Backend авторитетно раздаёт каждому игроку `4 Door + 4 Treasure = 8`, но
  `handleFinishSetup` сейчас без проверки hand limit помечает setup завершённым
  и после последнего игрока сразу переводит игру в preparation. Поэтому actor
  действительно может закончить setup с шестью картами; mandatory discard в
  этом transition сейчас не вызывается.
- Desktop и compact encounter stages независимо собирают
  `carried + equipped + hand` и вызывают `.slice(0, 3)`. Эти три карты не имеют
  отдельного server zone/state meaning: это произвольный legacy preview,
  поддержанный нереальной трёхкарточной setup fixture.
- End-turn charity существует, но в PlayerEconomy mode текущая
  `charityRecipientIDs` выбирает minimum только среди других игроков. Она не
  считает actor частью глобального minimum и не фильтрует recipients по их
  authoritative hand limit; discard-only mode поэтому возникает фактически
  только без живых recipients.
- Current `EconomySurface` показывает generic native `<select>` с вариантами
  «Не выбрано», «Сбросить» и raw recipient IDs. Это не Figma charity modal.
  Fixture `charity-transfer` смешивает recipient-less и recipient allocations,
  хотя engine при непустом `eligible_recipient_ids` требует recipient у каждой
  allocation; green browser smoke закрепляет невозможный live shape.
- Plan устраняет обе дыры одним server-owned contract: `finish_setup` с
  overflow открывает mandatory discard-only charity resolution и после exact
  discard продолжает setup sequence; end-turn charity выбирает mutually
  exclusive transfer/discard mode по authoritative eligibility. Оба пути
  используют один и тот же Figma Charity owner, без новой discard modal.

### Подтверждённые visual/responsive defects

- Selected mobile card wrapper имеет абсолютные `left: 52px`, `width: 256px`;
  это случайно центрируется только при ширине 360px. Внутренняя card остаётся
  `240x400` внутри 8px wrapper.
- Compact header использует `grid-template-columns: auto auto 1fr`, поэтому
  strength находится после context, а не в геометрическом центре.
- Mobile layout фиксирует rows `32px 38px 416px auto`; dock имеет
  `margin-top: 32px`. На 640px bottom gap 24px получается арифметически, на
  более высоком viewport dock висит над растущим пустым пространством.
- Mobile presenter заканчивается на 599px; с 600px включается desktop grid с
  боковой колонкой минимум 260px. Browser coverage перескакивает с 360px
  сразу на 1024px и не проверяет весь сломанный диапазон.
- Character sheet допускает auto-fill columns меньше фактической compact card
  width, из-за чего cards/CTA перекрываются и выходят из dialog.
- `character_tags.join(" · ")` выводит backend tags напрямую; observed
  `local` соответствует внутреннему content tag, а не пользовательскому copy.
- Desktop `OwnBoard.vue` собирает `equipped + carried + traits + attachments +
  persistent_curses` в `characterCards` и рендерит их через compact
  `GameCard`. `GameCard` без explicit Figma variant попадает в default
  `CardPresentation → CardFrame`; compact frame остаётся примерно `178x272` и
  добавляет generic CTA. Это и есть старая карточка, которой нет в equipment
  modal Figma.
- Mobile `MobileOwnState.vue` character sheet сейчас содержит только три
  generic stats и `character_tags`; equipment slots, traits-from-cards,
  carried summary и Figma geometry отсутствуют полностью.
- Browser `player-ui.spec.ts` проверяет у character sheet только открытие,
  `data-figma-node`, label и focus restore. Он не проверяет equipment content,
  отсутствие legacy card, размеры или mobile variant, поэтому green test не
  обнаружил расхождение.
- `320x568` отдельно проверяется на vertical/root overflow: из-за hidden root
  overflow critical action не может оказаться за недоступной областью.

### Предыдущий неверный verification contract

- Mobile visual cases запускались только на `360x640`; desktop responsive
  smoke начинался с `1024x768`.
- Geometry test проверял внешние header/opponents/stage/dock rectangles, но не
  центрирование strength/card, bottom anchoring или critical actions.
- Visual baseline был refreshed по собственной реализации и тем самым
  закрепил неверный результат. Green baseline доказывал стабильность текущего
  raster, не совпадение с Figma и не playability.

## Figma source of truth — closed set

### Live Figma integration evidence, 2026-08-05

Evidence ниже получен текущим live `get_design_context`, а не из repository
mapping или старых screenshots.

- [Sheets & Choices page 110:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=110-2)
  проверена целиком через live screenshot и read-only Plugin API inventory.
  Это canonical compact modal catalog, а не только родитель Choice Card:
  - [Choice Card 110:29](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=110-29):
    `Default 110:7`, `Selected 110:14`, `Disabled 110:22`, каждый `150x218`;
  - [Bottom Sheet 112:66](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=112-66):
    `Hand 112:2` (`360x410`) и `Mandatory 112:33` (`360x470`);
  - [Info Sheet / Compact 167:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=167-42):
    `Card 163:42`, `Strength 164:42`, `Character 165:42`,
    `Opponent 166:42`;
  - [Turn Decision / Compact 172:1719](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=172-1719):
    `Door 168:42`, `PostDoor 169:43`, `RunAway 170:57`, `Reward 172:71`;
  - [Interaction Sheet / Compact 177:1772](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=177-1772):
    `Help 174:85`, `Economy 174:1735`, `Theft 176:115`,
    `DeathLoot 177:130`;
  - [Game Result / Compact 179:1784](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=179-1784):
    `Death 178:145`, `Victory 179:146`.
  Все перечисленные compact sheets `360x470`, кроме Hand `360x410`, и
  содержат explicit `24px` safe-area. Это полный набор разрешённых compact
  modal families; implementation не сводит их к одному generic dialog body.

- Desktop state [271:791](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=271-791)
  реально содержит [Character & Equipment / Desktop 267:708](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=267-708),
  а не card gallery. Root `940x620`; header `64`; body `488`; left character
  summary `280`; right equipment panel `596`.
- Desktop equipment grid [268:2749](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=268-2749)
  состоит из двух rows по два slots. Filled slot
  [266:708](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=266-708)
  использует `112px` height, accent `2px` border, slot label `9/12`, bonus
  `14/18`, item `11/14`; empty state
  [266:713](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=266-713)
  использует default dashed border. Carried items — отдельный node
  [268:2772](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=268-2772).
- Mobile state [180:1601](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=180-1601)
  содержит direct component [Kind=Character 165:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-42).
  Equipment group [165:70](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-70)
  содержит slots [165:72](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-72),
  [165:75](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-75),
  [165:79](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-79),
  [165:82](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-82)
  и carried summary [165:85](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-85).
  Base component использует close copy «Закрыть», а integrated Preparation
  state `180:1601` переопределяет его в «Готово»; implementation и snapshots
  должны проверять state-specific copy, а не один hardcoded label.
- Дополнительные direct components на той же page `110:2` закрывают equipment
  interaction contract:
  - [Bottom Sheet/Equip 340:3475](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=340-3475)
    — component `360x470`; header `320x44`; title «Выбор карты»; secondary
    action «Снять» `70x40`; slot/current-item subtitle; rail `332x218` с
    `150x218` Choice Cards; primary «Экипировать» `328x52`; safe area `24`;
  - [Bottom Sheet/Equip from hand 342:3574](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=342-3574)
    — component `360x410`; header «Рука · 5»/«Закрыть»; selected centered
    Choice Card with side peeks in `332x218` rail; primary «Экипировать»
    `328x52`; safe area `24`.
  Live `get_design_context` и read-only ancestry inventory подтвердили, что
  обе ноды являются direct COMPONENT children page `17 · Sheets & Choices`,
  а не вложенными случайными mockups. Пользователь уточнил semantic binding:
  exact equip фильтрует только вещи выбранного slot; fast equip вызывается из
  выбранной вещи в hand.
- Desktop не растягивает compact sheets. Обе equip flows используют
  [Game Flow Sheet / Desktop, Mode=Cards3 291:1587](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=291-1587):
  `768x502`, padding `24x20`, header `720x64`, card row `720x318` с тремя
  `150x218` Choice Cards и gaps `58`, footer `720x44`. Пользователь уточнил,
  что меняется copy/data/action binding, но не desktop modal structure.
  Direct integrated example
  [Preparation game-flow-sheet 293:1670](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1670)
  подтверждает header «Подготовка персонажа», subtitle «Выбери карты, которые
  хочешь экипировать перед открытием двери» и footer «КАРТЫ МОЖНО
  ЭКИПИРОВАТЬ, ПРОДАТЬ ИЛИ ОСТАВИТЬ В РУКЕ». Component set
  [292:3656](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=292-3656)
  содержит `Cards3`, `Cards2Summary`, `Result`, `System`, `Empty`; equip flows
  используют именно `Cards3`.
- Full encounter card [96:30](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=96-30)
  — отдельный `240x400` visual с artwork/title/rules/rewards. Live comparison
  подтверждает, что перенос этого primitive в equipment modal запрещён.
- Успешные live request IDs: desktop state
  `d0b66ac1-7abc-44a7-b970-8cdd74354209`, mobile state
  `a2ddd2c5-702a-4f8f-bfce-266ad8708087`, desktop slot
  `b35f830f-ec55-4bf3-b39d-5a12980261f2`, compact sheet
  `12c2b717-29c8-49a4-bdb4-8833376a9751`, full card comparison
  `2bd6cd36-b748-4c3f-a245-e4651f4c5130`.
- Для page node `110:2` `get_design_context` не возвращает selection context,
  поэтому структура дополнительно подтверждена прямым page screenshot и
  read-only `getNodeByIdAsync("110:2")` inventory; это не догадка по соседнему
  node.

- File: [Munchkin](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin)
- Foundations: [83:8](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=83-8),
  [83:15](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=83-15).
- Header: [89:35](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=89-35),
  compact [152:19](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=152-19).
- Opponents: [91:31](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=91-31),
  Count rows [92:32](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=92-32).
- Encounter Card: [96:30](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=96-30),
  strict `240x400`.
- Player dock: [107:38](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=107-38),
  compact [153:31](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=153-31).
- Choices/sheets: [110:29](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=110-29),
  [112:66](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=112-66),
  [167:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=167-42),
  [172:1719](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=172-1719),
  [177:1772](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=177-1772),
  [179:1784](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=179-1784).
- Mobile boards: [147:671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-671),
  core loop [160:1140](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=160-1140),
  active [147:731](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-731),
  hand [147:803](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-803),
  timed response [147:903](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-903),
  charity [147:978](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-978),
  observer [147:1082](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1082),
  reconnect [147:1138](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1138),
  connection failed [147:1203](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1203),
  character [180:1601](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=180-1601),
  door [181:1634](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=181-1634),
  post-door [182:1627](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=182-1627),
  run-away [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671),
  reward [184:1687](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=184-1687),
  opponent info [185:1742](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=185-1742),
  interaction [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777).
- Figma не содержит отдельной modal/sheet для mandatory discard. Авторитетное
  design binding использует charity nodes `256:316`/`147:978` и один owner для
  transfer и discard-only data states; никакой второй node в mapping не
  добавляется.
- Desktop board and 40 named board states: [248:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=248-2),
  inventory board [259:708](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=259-708).
  Frozen runtime mapping ниже содержит 43 строки: к этим 40 board states
  добавлены live-verified `HandFastEquip`, `EquipmentSlotOpen` и
  `CharityDiscard` data-mode того же Charity visual.

### Frozen runtime → Figma → DOM-owner binding, v2 (live-verified equipment)

Эта таблица является immutable design binding для implementation lifecycle.
`primary owner` — единственный element с соответствующим
`data-figma-owner`; optional info не может вытеснить mandatory owner. Если
runtime shape не входит в таблицу, реализация останавливается для design/
contract decision. Dedicated compact node указан явно; `shared` означает
responsive composition тех же Figma primitives, а не новый visual.

| Runtime state | Desktop node | Compact source | Primary DOM owner |
|---|---|---|---|
| ActiveTurn | [248:5](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=248-5) | [147:731](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-731) | `game-board:active` |
| HandExpanded | [253:96](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=253-96) | [147:803](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-803) | `game-modal:hand` |
| HandFastEquip | [Mode=Cards3 291:1587](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=291-1587) / [integrated 293:1670](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1670) | [342:3574](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=342-3574) | `game-modal:hand` |
| RequiredResponse | [254:221](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=254-221) | [147:903](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-903) | `game-modal:mandatory-response` |
| CharityTransfer | [256:316](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=256-316) | [147:978](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-978) | `game-modal:charity` |
| CharityDiscard | same `256:316`; copy/action data override only | same `147:978`; no new node | `game-modal:charity` |
| Waiting | [257:447](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=257-447) | [147:1082](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1082) | `game-board:observer` |
| Reconnecting | [258:2530](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=258-2530) | [147:1138](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1138) | `game-route:reconnecting` |
| ConnectionFailed | [258:2674](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=258-2674) | [147:1203](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1203) | `game-route:connection-failed` |
| CharacterOpen | [271:791](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=271-791) → [267:708](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=267-708) | [180:1601](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=180-1601) → [165:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-42) | `game-modal:character-equipment` |
| EquipmentSlotOpen | [Mode=Cards3 291:1587](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=291-1587), equip copy override | [340:3475](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=340-3475) | `game-modal:equip-slot` |
| StrengthOpen | [271:3010](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=271-3010) | [Kind=Strength 164:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=164-42) | `game-modal:strength` |
| OpponentOpen | [271:3216](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=271-3216) | [185:1742](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=185-1742) | `game-modal:opponent` |
| DoorReady | [285:1315](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1315) | [181:1634](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=181-1634) | `game-modal:door` |
| PostDoorChoice | [285:1388](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1388) | [182:1627](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=182-1627) | `game-modal:post-door` |
| RunAwayChoice | [285:1473](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1473) | [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671) | `game-modal:run-away` |
| RewardReceived | [285:1566](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1566) | [184:1687](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=184-1687) | `game-modal:reward` |
| Preparation | [293:1617](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1617) | [147:731](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-731) | `game-board:preparation` |
| CurseEffect | [293:1706](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1706) | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) | `game-modal:mandatory-effect` |
| HelpOffer | [293:1780](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1780) | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) | `game-modal:help-offer` |
| HelpIncoming | [293:1866](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1866) | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) | `game-modal:help-incoming` |
| HelpAccepted | [293:1952](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1952) | shared | `game-board:help-accepted` |
| RunAwayPending | [293:2026](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-2026) | [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671) | `game-modal:run-away-response` |
| RunAwaySuccess | [294:1998](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-1998) | [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671) | `game-modal:run-away-result` |
| RunAwayFailure | [294:2072](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2072) | [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671) | `game-modal:run-away-result` |
| RunAwayNextMonster | [294:2146](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2146) | [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671) | `game-modal:run-away-next` |
| EndTurnReady | [294:2235](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2235) | shared | `game-board:end-turn` |
| TurnPassed | [294:2309](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2309) | [147:1082](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1082) | `game-board:observer` |
| Death | [294:2384](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2384) | shared | `game-route:death` |
| DeathLoot | [295:2355](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2355) | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) | `game-modal:death-loot` |
| DeathRecovery | [295:2444](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2444) | shared | `game-route:death-recovery` |
| Victory | [295:2518](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2518) | shared | `game-route:victory` |
| Trade | [295:2592](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2592) | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) | `game-modal:trade` |
| Gift | [295:2678](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2678) | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) | `game-modal:gift` |
| TheftResponse | [295:2764](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2764) | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) | `game-modal:theft-response` |
| PrivateChoice | [296:2748](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2748) | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) | `game-modal:private-choice` |
| StaleChoice | [296:2837](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2837) | [147:1138](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1138) | `game-route:stale-choice` |
| ExpiredChoice | [296:2911](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2911) | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) | `game-route:expired-choice` |
| EmptyHand | [296:2985](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2985) | [147:803](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-803) | `game-modal:hand-empty` |
| InitialLoading | [296:3058](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-3058) | shared | `game-route:loading` |
| SessionLost | [296:3133](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-3133) | shared | `game-route:session-lost` |
| GameUnavailable | [297:3103](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=297-3103) | shared | `game-route:unavailable` |
| GameFinished | [297:3177](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=297-3177) | shared | `game-route:finished` |

В target matrix legacy `resolve_combat`/`run_away` actions удаляются: bindings
`ActiveTurn`, `PostDoorChoice` и `RunAwayNextMonster` используют nested
`request_combat_resolution`; `RunAwayChoice/Pending` используют только
actor-owned `run_away_response`. Текущий `figmaStateMatrix.ts` обновляется до
этой таблицы и не является отдельным конкурирующим source of truth.

Figma — exhaustive visual set. Runtime state без существующего node не
получает новый fallback visual; implementation останавливается для
design/contract decision. Tablet/landscape могут компоновать существующие
approved primitives, но не изобретать новые visual components.

## Scope

### Входит

- Pure normalization server-projected actions, включая nested combat
  resolution, без локального вывода допустимости.
- Минимальный backend/HTTP contract для actor-safe последнего combat result,
  необходимого существующему Figma reward state; deterministic state/replay и
  privacy projection tests входят в scope.
- Actor-specific `you.strength_breakdown` projection для exact Character и
  Strength sheets. Backend классифицирует personal base/equipment/temporary
  contributions; frontend только отображает готовые значения и не включает
  helper/monster/encounter contribution в character breakdown.
- Минимальное authoritative расширение существующего `equip_item`: legal
  actor-owned item может быть источником из `hand` либо `carried`, а projection
  публикует exact `source_instance_id` только когда direct equip законен. Это
  необходимо fast-equip state `342:3574`; payload/endpoint/action type не
  меняются.
- Authoritative setup/charity hand-limit remediation: setup нельзя завершить с
  overflow без mandatory discard-only resolution; после exact discard engine
  продолжает незавершённую setup sequence. End-turn charity считает actor в
  global minimum и исключает lowest-level recipients, у которых hand count уже
  больше их server-calculated limit. Empty eligible list означает discard-only,
  non-empty list — transfer-only; существующий wire shape и одна Figma Charity
  modal сохраняются.
- Удаление произвольного setup/preparation `.slice(0, 3)`: simultaneous Cards3
  desktop shell содержит только projected legal candidates, а доступ ко всем
  восьми initial cards обеспечивается существующим Hand/Choice navigation.
- Единая actor-aware presentation model для desktop/mobile и один owner
  обязательных/info/interaction sheets.
- Исправление roster/opponents semantics и presentation copy из projected
  cards вместо raw tags.
- Удаление generic/legacy gameplay visuals и dead styles вне закрытого Figma
  set.
- Fluid responsive composition от full-support `360px` до `1920px`, explicit
  `320px`/tablet/narrow-landscape safety и safe-area anchoring.
- Structural refactor всей затронутой player-facing game layout внутри
  `frontend/applications/web/app/**`: удалить хрупкие fixed/absolute offsets,
  duplicated desktop/mobile geometry и component responsibilities, если они
  мешают Figma parity или continuous responsiveness. Новые shared primitives
  допустимы только с direct Figma/semantic owner и focused tests.
- Correct real-shape fixtures, unit/component/browser/a11y/visual coverage и
  controlled baseline refresh после side-by-side.
- Локальный lifecycle, canonical checks и отдельный local commit; no push.

### Не входит

- Изменение RNG algorithm, deck ordering, migrations или content semantics.
  Внутри `backend/game/internal/{game,application,transport/httpapi}/**`
  заранее разрешены только изменения, непосредственно необходимые для полного
  playable Figma flow: projection/action authority, deterministic replay,
  setup/charity continuation, reward/strength/equip contracts и их tests.
  Persistence schema/migration, content, dependency, infrastructure или иной
  продуктовый game-rule expansion остаются material stop/re-approval.
- Изменение content packs/card mechanics, перевод/переименование самих
  machine tags в backend либо создание новых card images.
- Card Studio workflow/layout, telemetry, infrastructure, deployment,
  dependency install, package-manager/lockfile update. Единственное разрешённое
  изменение Studio — narrow migration его `GameCard` preview caller на named
  Figma variants, необходимая для удаления global default fallback.
- Новые visual components, которых нет в перечисленном Figma closed set.
- Push, PR или remote/cloud mutation.

## Архитектурный подход

1. **Action normalization and dispatch.** Pure mapper принимает весь actor-specific
   projection и возвращает discriminated server action presentations из
   `available_actions`, `combat.resolution_action`, pending decision и
   interaction actions. Каждое действие сохраняет source/actor/window
   ownership; controller dispatches nested combat resolution через typed API,
   interaction responses через interaction boundary и обычные commands через
   generic endpoint. Component не угадывает action по phase.
2. **Shared presentation state machine.** Один exhaustive model определяет
   current approved Figma composition, primary surface, action surface,
   mandatory sheet и observer state для desktop/mobile. Второй конкурирующий
   presentation model удаляется либо превращается в тонкий consumer одного
   pure owner.
3. **Roster semantics.** `projection.players` остаётся полным public roster;
   `opponents = players.filter(player_id !== you.player_id)`, room count равен
   roster length. Никакой реконструкции hidden state.
4. **Authoritative result presentation.** Engine хранит минимальный
   deterministic recent combat result как часть event-applied state до
   следующей разрешённой boundary. Projection раскрывает exact reward cards
   только actor, public level/count summary — observers; frontend renderer
   никогда не вычисляет результат по hand slice или monster potential.
5. **Authoritative strength presentation.** Projection строит personal
   `strength_breakdown`; backend typed effects классифицируют permanent,
   equipment и active personal modifiers. `total_strength` — проверочная
   сумма personal breakdown, а `turn.combat.player_strength` остаётся отдельным
   combat aggregate и может включать helper/encounter effects. UI не
   декомпозирует aggregate вычитанием и не дублирует game rules.
6. **Content presentation.** Class/race/trait copy берётся из
   `projection.you.traits`/card names и approved content fields. Raw condition
   tags остаются internal semantics и не рендерятся.
7. **Character/equipment presentation.** Pure mapper строит fixed presentation
   model, не массив произвольных cards:
   `identity`, `traits`, `stats`, ordered `slots[headgear, armor, footgear,
   hands]`, `carriedSummary`. Slot связывается с exact equipped card по
   `item_slot`; `hands` дополнительно учитывает `hands=1|2`. Attachments,
   curses и carried cards не смешиваются с equipment grid. Desktop/mobile
   используют один mapper, но разные Figma geometry components.
8. **Authoritative equip actions.** Projector вызывает ту же server legality
   проверку, что command handler, и публикует `equip_item(source_instance_id)`
   для legal hand/carried items и `unequip_item(source_instance_id)` для legal
   equipped items. Handler атомарно удаляет item из его фактической source
   collection и добавляет в equipped. Slot/hand sheets фильтруют видимые cards
   по `item_slot`, но action enablement строят только пересечением с projected
   source IDs. Replacement остаётся последовательным server flow: `Снять` →
   новая projection/version → `Экипировать`; frontend не шлёт скрытую цепочку.
9. **Setup and charity authority.** `finish_setup` не может молча завершить
   actor setup при `len(hand) > handLimit`: engine открывает обязательное
   discard-only resolution на exact excess, сохраняет internal continuation и
   после resolution выбирает следующего незавершившего setup игрока либо first
   preparation actor. End-turn charity строит recipients из global minimum:
   actor at/tied for minimum получает empty list; другие lowest-level players
   с hand count выше собственного authoritative limit исключаются. UI получает
   только `excess`, exact instance IDs и eligible IDs; empty/non-empty list
   выбирает discard/transfer body одного Charity sheet. Произвольный Cards3
   preview не является state и удаляется.
10. **Named card variants only.** `GameCard` перестаёт быть fallback-router по
   boolean props/default branch. Call-site inventory явно связывает каждый
   owner с direct Figma component. Equipment использует `EquipmentSlot`, а не
   card primitive. После перевода call sites default `CardFrame` path и его
   legacy selectors удаляются, если у него нет отдельного live-verified node.
   Narrow `CardStudioPanel` preview migration выбирает существующий Encounter
   или Choice variant по card kind; это не сохраняет отдельную legacy card.
11. **Sheet coordinator.** На route/presentation-owner уровне вычисляется ровно
   один top sheet с
   приоритетом mandatory server decision над optional info. Native dialog
   close синхронизируется с owner state; mandatory sheet dismiss policy
   определяется только projected pass/cancel action.
   Compact owner является discriminated union exact families из page `110:2`:
   `Bottom`, `Info`, `TurnDecision`, `Interaction`, `GameResult`; общий shell
   допустим только для geometry/focus, body и actions остаются variant-specific.
12. **Death/death-loot continuity.** Dead status не размонтирует table и
   mandatory interaction, пока projection требует actor response; финальный
   death state — terminal presentation после завершения priority choices.
13. **Responsive composition.** Mobile-first intrinsic grid: header center
   использует symmetric tracks, encounter rail центрирует selected card,
   stage занимает remaining block space, dock выравнивается по safe bottom.
   Tablet range использует те же approved primitives с content-pressure
   switching, а desktop 3-column layout включается только когда реальные
   minimums помещаются. Pixel coordinates из canonical frames не становятся
   layout authority: absolute/fixed positioning проходит inventory и либо
   подтверждается как true overlay, либо заменяется normal-flow Grid/Flex.
   Verification widths `360/428/600/768/1024/1280/1400/1920` и midpoints
   подтверждают continuous behavior, не только отдельные screenshots.
14. **Closed-set deletion.** После переноса каждого mapped state удаляются
   old fallback branches, labels, selectors и tests. Неиспользуемый код не
   сохраняется как compatibility path.
15. **Evidence first.** Correct server-shaped fixture и core-loop browser test
   пишутся до baseline update. Raster refresh разрешён только после
   node-by-node side-by-side и semantic/interaction pass.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| `go:backend/game` result/strength/equip/charity authority | Persist/replay minimal recent result; project actor-safe reward/personal strength; allow atomic equip from legal hand/carried source; enforce setup overflow and end-turn charity eligibility | existing command/charity shapes plus projection extension; no new visual state |
| `pnpm:@munchkin/contracts` | Parse recent-result, strength-breakdown, nested combat and exact equip/unequip actions | `game:http-v1` Zod contract; action type unchanged |
| `pnpm:@munchkin/web` action/presentation | Consume every server-projected action; actor-aware exhaustive state and typed dispatch | consumes extended `game:http-v1` |
| Desktop/mobile game components | Only approved Figma surfaces; no generic fallback | `Projection`, `ActionDescriptor` |
| Interaction/sheet owner | Single mandatory/info modal coordinator | interaction projection, no wire change |
| Responsive SCSS | Fluid 320–1900 composition and safe area | viewport/layout only |
| Unit/browser/visual harness | Real shapes, full flow, reachability and responsive evidence | Go-owned HTTP projection fixtures |

Contract change is deliberately narrow: a replay-safe recent combat result
needed by the existing Figma reward state, an actor-specific personal strength
breakdown needed by existing Character/Strength sheets, existing `equip_item`
accepting a legal actor-owned hand or carried source without a new
payload/endpoint, and authoritative setup/end-turn hand-limit resolution using
the existing charity projection/modal shape, plus frontend parsing/consumption.
Any broader backend behavior, persistence format/migration, command or content
change is a material scope change and requires repeated approval.

## Делегирование

- **Классификация:** large — planning delegation required.
- **Причина:** независимы как минимум authoritative gameplay/action ownership,
  Figma/legacy presentation, responsive geometry и browser/test evidence;
  ошибка P0 блокирует основной цикл и пересекает несколько owners.
- Все delegated packages read-only, `write_set: []`; repository writes остаются
  root-only pending worktree orchestration. Root параллельно синтезирует
  architecture, scope, conflicts и verification matrix.

### Preliminary bounded packages

1. **Luna explorer — gameplay/contract architecture.** Scope:
   `backend/game/internal/game/{engine.go,projection.go}`,
   `frontend/packages/contracts/src/index.ts`,
   `useGamePresentation.ts`, `GameTable.vue`, presentation/action models и
   direct tests. Проверить полный flow, source/actor ownership, roster
   semantics, nested actions, mandatory sheet conflicts и raw tags. Stop:
   вернуть path-backed P0/P1 findings без edits/commands that mutate state.
2. **Luna explorer — tests/Figma/responsive coverage.** Scope: archived source
   map, Figma node IDs already stored in repository, mobile/desktop components,
   SCSS, fixtures, browser/a11y/visual tests and baselines. Проверить closed-set
   reachability, legacy branches, impossible fixtures, 320–1900 coverage,
   geometry and safe-area assertions. Stop: вернуть concrete gaps/proposed
   acceptance evidence без edits или snapshot refresh.
3. **Terra reviewer — adversarial plan review.** После synthesis проверить
   цельный draft на пропущенные gameplay transitions, scope/write-set
   conflicts, backend authority, Figma closed-set violations, insufficient
   tests and unsafe baseline refresh. Не повторять exploration и не писать.

### Actual delegation evidence

- **Gameplay/contract Luna explorer — completed, read-only.** Confirmed nested
  combat action is omitted by frontend; existing dedicated API is unused;
  death-loot becomes unreachable; generic dialog ownership can permanently
  hide a mandatory response; roster semantics are wrong; reward is fabricated;
  run-away belongs to `run_away_response`; completed attempts need actor-safe
  multi-participant tests.
- **Tests/Figma/responsive Luna explorer — completed, read-only.** Confirmed
  impossible combat/door/action-coverage fixtures, false six-player fixture,
  missing route/ActionPanel/InteractionDialog write owners, only 360/1024
  responsive evidence, missing per-state DOM-owner mapping and missing
  side-by-side evidence ledger.
- **Equipment modal/card-path explorer — completed, read-only.** Runtime не
  предоставил Luna model даже через fixed explorer role, поэтому bounded audit
  выполнен Terra без writes. Он подтвердил call chain
  `GameTable → DesktopGameTable → OwnBoard → GameCard → CardPresentation →
  CardFrame`, отсутствующий mobile equipment content, достаточность текущего
  `CardView.item_slot` contract и отсутствие отдельного `EquipmentSlot` в
  codebase. Global `GameCard` остаётся нужен named hand/encounter/choice
  owners; удаляется ошибочный equipment call site и unsupported default
  fallback после полного caller inventory.
- **Equipment strength/contract explorer — completed, read-only.** Confirmed
  current SelfView exposes only aggregate combat strength and cannot safely
  produce Figma rows by subtraction. Required narrow actor projection is
  `strength_breakdown`; helper must remain outside personal breakdown and only
  participate in combat total. Added Go privacy/replay, HTTP golden, Zod and
  Vue-consumption cases.
- **Exact/fast equip contract follow-up — completed, read-only.** Confirmed
  carried→equipped and equipped→carried already use projected exact
  `source_instance_id` plus existing `equip-item`/`unequip-item` routes. Found
  the material gap for `342:3574`: hand item currently receives only
  `play_card` and moves to carried. Recommended minimal change, now integrated,
  is existing `equip_item` accepting a legal hand/carried source atomically;
  no new payload/action type and no client-side `play_card → equip_item` chain.
- **Setup/charity follow-up — completed, read-only.** Confirmed authoritative
  initial `4+4` deal, duplicated desktop/mobile `.slice(0, 3)`, unrealistic
  three-card setup fixture and one existing Charity owner. Root independently
  checked engine validation: when eligible recipients exist every allocation
  must have one, so the explorer's suggested mixed transfer/discard case was
  rejected and the plan keeps mutually-exclusive live shapes.
- **Adversarial Terra reviewer — completed, read-only.** Initial review found
  missing `event.go`/HTTP strict test ownership, undefined helper reward
  privacy, missing generic run-away/death-loot owners and no frozen exhaustive
  state binding; these were integrated. Equipment follow-up then correctly
  reopened three issues: missing strength-breakdown authority, surviving
  Studio caller of default `CardFrame`, and absent direct Figma node for slot
  actions. Первые два включены в draft; третий записан как design stop, а не
  закрыт выдуманной modal. Follow-up также поймал ошибочную compact binding
  `StrengthOpen → Character 165:42`; mapping исправлен на direct
  `Kind=Strength 164:42`, повторная bounded проверка — pass.

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/plans/{active,archive}/20260805T000140Z-ef4dda-frontend-gameplay-flow-responsive-figma-remediation.md` | write | Lifecycle/evidence |
| `backend/game/internal/game/{model.go,event.go,engine.go,rules.go,projection.go,*_test.go}` | write | Event-applied recent result, authoritative strength, atomic hand/carried equip, setup overflow continuation, charity eligibility and privacy-safe action projection |
| `backend/game/internal/game/**` | write | Approved bounded expansion for pure authoritative gameplay fixes directly required by playable Figma flow; no content/persistence/infrastructure |
| `backend/game/internal/application/**` | write | Actor/version/idempotency/runtime continuation and focused tests when required by the approved flow |
| `backend/game/internal/transport/httpapi/**` | write | Strict HTTP contract, handler wiring and canonical real projection shapes when required |
| `frontend/packages/contracts/{src/index.ts,test/**}` | write | Zod result/nested-action DTO contract |
| `frontend/packages/contracts/src/**` | write | Bounded schema/type refactor required by authoritative projection changes; no package/dependency change |
| `frontend/applications/web/app/composables/{useGameApi,useGameSessionController}.ts` | write | Typed combat/action dispatch |
| `frontend/applications/web/app/composables/useGamePresentation.ts` | write | Authoritative action/state normalization |
| `frontend/applications/web/app/pages/game/[id].vue` | write | Single presentation/sheet owner and death continuity |
| `frontend/applications/web/app/components/ActionPanel.vue` | write | Remove generic gameplay fallback or reduce to approved non-game use |
| `frontend/applications/web/app/components/actionModel.ts` | write | Typed server-action binding if required |
| `frontend/applications/web/app/components/game/**` | write | Shared presentation and exact desktop/mobile Figma surfaces |
| `frontend/applications/web/app/components/game/OwnBoard.vue` | write | Remove legacy card gallery; mount exact desktop character/equipment sheet while preserving/integrating the user-owned dirty baseline |
| `frontend/applications/web/app/components/game/mobile/MobileOwnState.vue` | write | Build exact compact character/equipment sheet |
| `frontend/applications/web/app/components/game/primitives/EquipmentSlot.vue` (new) | write | Shared semantic slot model with separate desktop/compact geometry |
| `frontend/applications/web/app/components/GameCard.vue` | write | Require named Figma variants and remove generic fallback routing/CTA where unsupported |
| `frontend/applications/web/app/components/studio/CardStudioPanel.vue` | write | Narrowly migrate the last non-game default-card preview caller to existing named Figma variants; no Studio workflow/layout redesign |
| `frontend/applications/web/app/components/game/primitives/CardPresentation.vue` | write | Delete unsupported default presentation branch after caller migration |
| `frontend/applications/web/app/components/game/primitives/CardFrame.vue` | write | Delete legacy default frame/styles if no live-verified owner remains |
| `frontend/applications/web/app/components/interaction/**` | write | Coordinated mandatory sheet owner; replace/delete generic run-away, death-loot and EconomySurface charity radio/select/form fallbacks |
| `frontend/applications/web/app/components/ui/SheetDialog.vue` | write | Native dialog synchronization if required; no unrelated UI-kit refactor |
| `frontend/applications/web/app/assets/scss/pages/_game-{mobile,desktop}.scss` | write | Fluid responsive migration and legacy selector deletion |
| `frontend/applications/web/app/**` | write | Approved structural player-facing refactor: shared presentation/layout owners, lobby/game route consumers, components, composables and styles necessary for full parity/playability |
| `frontend/applications/web/test/**` | write | Pure model/component/real-shape regression tests |
| `frontend/test/browser/**` | write | Core-loop, responsive, a11y, Figma reachability tests |
| `frontend/test/browser/visual-baselines/chromium/**` | write | Conditional generated output only after approved side-by-side baseline review |

`frontend/applications/web/app/components/game/OwnBoard.vue` уже dirty до этого
plan и принадлежит пользователю. Текущий diff меняет strength button с grid на
flex и содержит `align-tiems` (невалидное имя property). До implementation root
обязан сохранить baseline, уточнить/интегрировать намерение без потери либо
остановиться для решения пользователя. Никаких reset/stash/overwrite.

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game-http-v1-projection` | none found by context | this plan after approval | Go projection → Zod fixture → UI consumer |
| `backend-game-engine` | none found by context | this plan after approval | exactly four authorized backend tracks: replay-safe recent result, actor-specific strength breakdown, atomic existing `equip_item` from legal hand/carried source, and setup/end-turn charity hand-limit authority |
| `frontend-game-presentation` | none found by context | this plan after approval | exclusive root writes |
| `frontend-browser-baselines` | none found by context | this plan after side-by-side | generated only at final visual stage |
| existing dev server/game rows | local diagnostic only | root | disposable test rooms; no production mutation |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-05 00:19 UTC через `leinoctl context`.
- **Обнаруженные пересечения:** selected plan отсутствует; active registry не
  сообщает frontend path owners. Есть pre-existing user dirty
  `frontend/applications/web/app/components/game/OwnBoard.vue`.
- **Решение:** plan не select/implement до approval; dirty baseline отдельно
  review before first implementation write. Any additional dirty path is a
  stop-and-report condition.

## План реализации

1. [x] Синтезировать bounded agent audits и закрыть reviewer findings; повторно
   проверить exact Figma links и current dirty baseline.
2. [ ] Зафиксировать Go projection/contract fixtures для nested combat action,
   run-away/death-loot, actor-safe recent combat result и personal
   `strength_breakdown`; добавить engine replay/privacy/classification tests до
   frontend consumption. Добавить hand/carried/equipped `equip_item`/
   `unequip_item` action fixtures и setup/end-turn charity branches. Helper,
   monster и encounter contribution должны быть доказанно исключены из
   character breakdown; setup overflow continuation и recipient eligibility
   фиксируются engine/application tests до UI changes.
3. [ ] Написать real-shape action/presentation tests, которые воспроизводят
   отсутствие legacy `resolve_combat` и наличие nested resolution action;
   добавить actor/observer, death-loot and true 1–6 roster invariants; удалить
   невозможные `single-door-choice`/`action-coverage` combinations. Заменить
   трёхкарточную setup fixture на exact 8-card deal и разделить impossible
   mixed `charity-transfer` на mutually-exclusive transfer/discard fixtures.
4. [ ] Ввести pure authoritative action normalization, typed controller
   dispatch и единый exhaustive
   presentation model; подключить combat resolution, response completion,
   run-away, effect, charity, end-turn, death, victory и exact equip/unequip
   without phase inference. Расширить backend `equip_item` atomic transition
   для legal hand source без изменения payload/endpoint.
5. [ ] Исправить backend setup/charity authority: overflow при
   `finish_setup` открывает mandatory discard-only resolution и затем
   продолжает setup; end-turn recipients учитывают global minimum и current
   hand limit. Реализовать один `CharityTransfer|CharityDiscard` presentation
   owner на `256:316`/`147:978`, удалить native select/generic EconomySurface
   path и arbitrary `.slice(0, 3)` field preview.
6. [ ] Исправить roster/opponent derivation и заменить machine tags/kinds
   projected card names or absence according to Figma.
7. [ ] Ввести pure `characterEquipmentModel`: trait cards by `trait_group`,
   fixed slot order, occupied/empty slot state, hands occupancy, carried
   summary, authoritative strength rows and exact card bindings. Добавить unit cases: empty equipment,
   all four slots, two-handed item, long Russian item name, class/race absent,
   attachments/curses excluded from equipment grid. Добавить
   `slotCandidates(slot)` из actor-visible hand/carried/equipped cards с exact
   `item_slot` и separate projected binding map по `source_instance_id`.
8. [ ] Заменить desktop character dialog в `OwnBoard.vue` на exact
   `267:708`: identity/trait/stats summary, `596px` equipment panel, 2x2
   desktop slots and carried summary. Полностью удалить `characterCards`,
   `.character-info__cards`, embedded `GameCard` and «Нет открытых карт
   персонажа» fallback. Slot click открывает `EquipmentSlotOpen` через
   `Mode=Cards3 291:1587`; fast hand selection использует тот же desktop shell
   и integrated copy/layout `293:1670`. Структура shell не меняется — только
   title/subtitle/footer/card data и projected action binding.
9. [ ] Пересобрать mobile character dialog в `MobileOwnState.vue` по
   `165:42`: title/close, authoritative level + trait names, trait chips,
   four `148x72` slots, carried summary and 24px safe area. Не выводить
   `character_tags` и не добавлять full-card carousel. Slot click открывает
   exact `340:3475`; tap по legal hand item переводит Hand sheet в selected
   fast-equip state `342:3574`. «Снять»/«Экипировать» dispatch only current
   projected source action; native close/focus state синхронизирован.
10. [ ] Провести call-site inventory `GameCard/CardPresentation/CardFrame`:
   закрепить каждому live caller direct Figma variant, перевести callers без
   owner или удалить их. Узко мигрировать preview caller в
   `CardStudioPanel.vue` на existing Encounter/Choice variants. После
   последнего caller удалить unsupported default branch/CSS/tests; не
   оставлять его «для совместимости».
11. [ ] Установить одного sheet owner на route/presentation boundary, сохранить
   mandatory death-loot/interaction при dead actor и удалить generic ActionPanel gameplay
   fallback; реализовать discriminated `Bottom/Info/TurnDecision/Interaction/
   GameResult` families и их exact variants с page `110:2`, включая direct
   `Bottom Sheet/Equip` и `Bottom Sheet/Equip from hand`; desktop variants
   используют `Game Flow Sheet / Desktop Cards3`.
12. [ ] Пересобрать mobile-first geometry: symmetric header, centered encounter,
   flexible stage, safe-bottom dock; добавить usable tablet/narrow landscape
   composition и только затем desktop breakpoint.
13. [ ] Удалить все legacy branches/text/selectors/screens вне Figma closed set,
   включая «Зоны»; проверить character/hand/opponent sheets и exact card
   primitive geometry.
14. [ ] Добавить browser core-loop с двумя actor sessions через real backend,
   breakpoint/height matrix, keyboard/a11y, long copy and 1–6 players.
15. [ ] Выполнить прямой side-by-side по каждому изменённому Figma node. Только
   после зафиксированного review обновить конкретные baselines и выполнить
   no-update visual control.
16. [ ] Выполнить focused tests, `pnpm lint`, `pnpm check`, `pnpm build`,
    canonical `./leinoctl verify --changed`, scope-check, diff review; записать
    evidence, archive/release and one local commit. Push не делать.

## Проверки

- [x] Unit: server action normalization and exhaustive presentation state
  matrix with correct live projection shapes.
- [x] Go engine/projection: recent result survives event replay, clears at the
  defined boundary, reports exact reward to actor and never leaks private card
  identities between combat actor, helper and observers; nested combat/
  run-away/death-loot actor gating.
- [x] Go projection strength: no-combat/equipped, persistent/conditional and
  active personal modifiers classify consistently; helper affects combat total
  but not personal breakdown; actor/observer privacy and HTTP golden fixtures
  freeze the DTO without exposing internal effect state.
- [x] Go equip authority: `equip_item` projects and succeeds atomically for a
  legal hand item and a legal carried item; rejects occupied slot, insufficient
  hands, restrictions, big-item overflow, wrong phase, foreign/forged instance
  and stale credential/version/idempotency violations. `unequip_item` targets
  only exact own equipped instance. Observer projection never exposes another
  player's hand candidates/actions.
- [x] Go setup overflow: exact 8-card deal is preserved; `finish_setup` at
  limit continues normally, while 6/7/8-card hands open discard-only exact
  excess and cannot reach preparation early. After resolution the next pending
  setup actor (or first preparation actor) is deterministic and replay-safe;
  wrong actor/card/count, stale version and duplicate command are rejected.
- [x] Go charity eligibility: actor strictly/tied global-lowest, all others
  dead, and all otherwise-lowest recipients already over their calculated hand
  limit each produce empty eligible IDs and discard-only allocations. A valid
  non-lowest actor transfers every excess card only to eligible lowest players;
  mixed/invalid recipient allocations fail. Actor/observer privacy, manual and
  timeout branches are covered in engine/application/HTTP tests.
- [x] Contracts: Zod schema parses active resolution, recent reward,
  `strength_breakdown`, open response, observer, run-away, effect, charity,
  death and victory projections; no private/internal fields.
- [x] Component: exact Figma surface, actor gating, modal priority/focus,
  card grid containment, no raw machine copy.
- [x] Charity component: transfer and setup/end-turn discard render the same
  `game-modal:charity` node/geometry. Discard has no recipient control or raw
  IDs, requires exactly excess selected Choice Cards and exposes one discard
  action; transfer exposes only eligible recipient choices. At most one
  Charity dialog exists in DOM.
- [x] Character/equipment unit/component: fixed slot derivation and order,
  empty/filled/two-handed states, traits from card names, carried summary,
  exact five desktop strength rows from projection, no client recomputation,
  same-slot candidate filtering across hand/carried/equipped, projected action
  binding by exact item ID,
  no attachment/curse leakage into slots and no `GameCard` subtree.
- [x] Compact modal family component tests freeze page `110:2` bindings and
  exact labels/actions: Hand/Mandatory, Card/Strength/Character/Opponent,
  Door/PostDoor/RunAway/Reward, Help/Economy/Theft/DeathLoot and Death/Victory.
  Generic checkbox/radio body cannot satisfy these tests.
- [x] Compact StrengthOpen отдельно проверяет owner `game-modal:strength`,
  node `164:42`, title «Сила», close copy «Закрыть», content `328x336`, summary
  `304x62`, personal rows и monster-side rows. Character `165:42` не может
  использоваться как fallback для strength state.
- [x] Character/equipment browser desktop `1440x900`: modal `940x620`, body
  columns `280/596`, four `276x112` slot tiles and carried block; mobile
  `360x640`: sheet `360x470`, content `328x336`, four `148x72` tiles, carried
  `304x88`, bottom safe-area `24`. Both assert no root/dialog overflow, long
  copy containment, exact desktop/mobile empty-slot copy/border differences,
  keyboard focus restore and zero generic card nodes.
- [x] Exact-equip browser: desktop uses `291:1587` `768x502` shell and mobile
  uses `340:3475` `360x470`; opening headgear never displays armor/footgear/
  non-item cards; `Снять` updates projection/version before a replacement can
  be equipped; illegal card has no action. Fast-equip: desktop integrated
  structure matches `293:1670`, mobile matches `342:3574` `360x410`, and one
  click/tap issues a single `equip_item` for the selected hand instance and
  results directly in `you.equipped` with no intermediate carried UI.
- [x] Setup/charity browser real-boundary: actor starts with eight cards,
  equips/plays legal cards, cannot silently complete setup with six remaining,
  resolves mandatory discard in the same Charity Figma shell, then continues
  setup/preparation. Separate end-turn cases verify transfer and discard-only
  modes with no generic select/checkbox UI or arbitrary first-three board rail.
- [x] Legacy-card deletion test inventories every `GameCard` caller, includes
  the narrow Studio preview caller, requires an explicit named variant and
  proves unsupported `CardFrame` default markup/selectors are absent.
- [x] Browser real-boundary: two separate actor credentials complete full core
  loop and next-player handoff; no browser interception of gameplay API.
- [x] Browser responsive: canonical matrix plus N-1/N/N+1, short/long height,
  landscape, 200% zoom, touch-sized actions, root overflow and dock anchoring.
  Mandatory rows are `360/428/600/768/1024/1280/1400/1920` plus the recorded
  midpoints; tests assert sibling/dialog/card intersections, not only document
  `scrollWidth`, so visually overlapping regions fail even without overflow.
- [x] Layout architecture test/source audit rejects unexplained absolute
  positioning/magic inline offsets in primary responsive owners and freezes
  centered header/card, fluid stage, capped desktop canvas and safe-bottom dock
  geometry across short and tall heights.
- [x] A11y: keyboard-only core action, focus-visible, mandatory dialog trap and
  return focus, status text not contradictory, reduced-motion equivalent.
- [x] Visual: direct Figma/current side-by-side log; targeted snapshot update;
  clean no-update rerun across all reachable desktop/mobile states.
- [x] Evidence ledger is complete for every refreshed baseline:

  | Figma node | Viewport | Fixture/real-flow step | Current screenshot | Figma screenshot/link | Reviewer result | Baseline file |
  |---|---:|---|---|---|---|---|
  | _fill during implementation_ | _exact_ | _state/actor_ | _artifact path_ | _direct node_ | pass/fail + note | _generated file_ |
- [x] `pnpm lint` from `frontend/` using pinned pnpm 10.8.0.
- [x] `pnpm check` from `frontend/`.
- [x] `pnpm build` from `frontend/`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260805T000140Z-ef4dda-frontend-gameplay-flow-responsive-figma-remediation`.
- [x] `node .codex/hooks/plan-lint.mjs` and final diff review.

## Риски и откат

- **P0 risk — action authority regression:** локальное phase inference может
  разрешить незаконное действие. Mitigation: map only explicit server fields,
  actor-shaped fixtures and live backend E2E.
- **P0 risk — mandatory decision loss:** multiple dialogs can hide a required
  choice. Mitigation: one modal owner, priority tests, Escape/backdrop policy.
- **P0 risk — user dirty file:** `OwnBoard.vue` contains pre-existing edits.
  Mitigation: preserve exact baseline, integrate surgically or stop.
- **P1 risk — closed-set drift:** generic fallback reappears for rare state.
  Mitigation: exhaustive state union, descriptor reachability and delete dead
  branch rather than hide it.
- **P1 risk — responsive regression:** exact 360 raster can conflict with fluid
  geometry. Mitigation: intrinsic constraints plus canonical exact checks and
  boundary matrix before baseline update.
- **P1 risk — self-referential snapshots:** current implementation can be
  frozen as expected. Mitigation: node-by-node side-by-side log is prerequisite
  for snapshot generation.
- **P0 risk — result privacy/replay:** persisting reward UI data can leak
  private cards or diverge on replay. Mitigation: event-applied minimal state,
  actor-specific projection, observer redaction, replay/privacy tests, clear
  boundary explicitly covered.
- **P0 risk — strength semantics duplication:** decomposing aggregate strength
  in Vue would duplicate backend rules and can count helper/encounter effects
  as character equipment. Mitigation: server-owned typed breakdown, HTTP/Zod
  fixture, helper-exclusion and effect-classification tests.
- **P0 risk — fast-equip semantic mismatch:** current backend `play_card` moves
  a hand item only to carried, while Figma `342:3574` promises
  «Экипировать». Mitigation: existing `equip_item` accepts legal hand/carried
  source atomically, projector and handler share legality checks, no
  client-side two-command chain, engine/HTTP/idempotency/browser tests.
- **P1 risk — desktop/compact shell conflation:** direct equip nodes are
  compact, but desktop owner is `291:1587`. Mitigation: separate geometry
  components over one semantic model; desktop `Cards3` structure never gains
  mobile header/button controls, exact breakpoint screenshots cover both.
- **P0 risk — setup continuation corruption:** inserting mandatory discard
  between setup actors can skip/duplicate an actor or enter preparation early.
  Mitigation: server-owned continuation, event replay tests for 1–6 players,
  exact actor/phase assertions before and after discard, no client inference.
- **P0 risk — charity mode ambiguity:** treating discard as a second visual or
  allowing mixed allocations can diverge from both Figma and engine authority.
  Mitigation: one owner/node, mutually-exclusive eligible-list semantics,
  backend validation and transfer/discard DOM uniqueness tests.
- **Откат:** revert only this plan's local commit after preserving user-owned
  dirty baseline. Do not reset/stash/checkout unrelated work. Since push is
  forbidden, rollback remains local and recoverable through Git.

## Открытые вопросы

- Figma/design вопросов больше нет: exact slot equip `340:3475`, fast hand
  equip `342:3574`, desktop shell `291:1587` и integrated preparation example
  `293:1670` live-verified и frozen в mapping.
- Отдельной discard modal в Figma нет и не требуется: setup-overflow и
  end-turn discard-only меняют data/copy/action внутри единственного Charity
  owner `256:316`/`147:978`. «Без выбора» зафиксировано как отсутствие выбора
  recipient; выбор ровно `excess` cards остаётся обязательным, иначе backend
  не может определить, какие карты сбросить.
- Material backend consequence explicit: fast hand equip расширяет existing
  `equip_item` source с carried-only до legal hand-or-carried, не меняя
  action type/payload/endpoint. Это и дополнительные engine/application/HTTP
  изменения, прямо необходимые полному playable flow, включены в расширенный
  approval и broad bounded manifest roots. Runtime visual без Figma owner,
  persistence/content/dependency/infra change остаётся material stop.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-05 01:39:26 UTC
- **Подтверждено:** 2026-08-05 02:00:49 UTC; пользователь явно согласовал exact
  current frontend plan, необходимые расширения его scope/write set и backend,
  physical legacy deletion, structural responsive refactor и завершение только
  при полном Figma parity плюс живой playability.
- **Формулировка/ограничения пользователя:** «в план себе это все запиши»;
  exact equip: «когда нажимаешь на слот и отображаются шмотки только из этого
  слота» (`340:3475`); fast equip: «из руки — когда тапаешь на экипировку
  появляется кнопка экипировать» (`342:3574`); desktop: использовать modal
  example `291:1587`, меняя text/data; setup overflow не игнорируется;
  обязательный discard использует ту же charity modal, а отдельной discard
  modal в Figma нет. Prior constraints retained: Figma is exhaustive, legacy
  visuals are deleted, visual baselines only after side-by-side, bounded
  read-only agents, no delegated writes, no push. Дополнительное approval:
  «Даю аппрув на текущий фронтенд план, также, на возможное расширение его
  скоупа и врайтсета»; minimum full-support `360x640`; обязательные widths
  `428/600/768/1024/1280/1400/1920` и промежутки; refactor неверного
  центрирования, absolute positioning и pixel-frame layout разрешён.

## Ход выполнения

- 2026-08-05: draft создан; recorded current browser playability evidence,
  authoritative flow, defect register, closed Figma links, responsive and
  verification contract. Реализация не начата.
- 2026-08-05: два bounded read-only Luna audit интегрированы; добавлены typed
  combat dispatch, run-away/death-loot ownership, authoritative reward result,
  реальные fixture invariants, missing write owners и evidence ledger.
- 2026-08-05: Terra adversarial review выполнен read-only; четыре найденных
  scope/privacy/mapping blockers исправлены. Equipment follow-up снова открыл
  strength authority, Studio fallback caller и absent slot-action node; draft
  дополнен, implementation по-прежнему не начата.
- 2026-08-05: live Figma integration проверила page `110:2` целиком и
  проинвентаризировала exact compact modal families/variants. Предыдущий вывод
  по одному `110:29` признан недостаточным. Plan остаётся `draft` до direct
  equipment action binding; generic replacement запрещён.
- 2026-08-05: bounded Terra follow-up проверил обновлённый modal mapping,
  обнаружил и после исправления подтвердил отдельный `StrengthOpen → 164:42`;
  итог повторной проверки — pass.
- 2026-08-05: пользователь предоставил exact/fast equip nodes `340:3475` и
  `342:3574`, затем desktop archetype `291:1587`. Live Figma context подтвердил
  compact geometry, copy/actions, desktop `Cards3 768x502` и integrated
  preparation `293:1670`. Read-only contract audit доказал existing
  carried/equipped action support и missing hand→equipped semantic; draft
  расширен минимальным atomic `equip_item` hand/carried contract и переведён в
  `awaiting_approval`. Реализация не начата.
- 2026-08-05: пользователь уточнил, что отдельной discard modal в Figma нет,
  и сообщил live defect: setup завершился с шестью картами без mandatory
  resolution. Root и bounded read-only audit подтвердили: backend
  `handleFinishSetup` не проверяет hand limit, desktop/mobile произвольно
  показывают `.slice(0, 3)`, current charity eligibility не учитывает actor как
  global minimum/recipient hand limit, а EconomySurface/fixture не соответствуют
  live engine. Draft расширен server-owned setup continuation и единым
  CharityTransfer/CharityDiscard owner; implementation не начата.
- 2026-08-05: пользователь согласовал exact plan и заранее разрешил bounded
  expansion внутри frontend player UI/contracts и backend game/application/
  HTTP authority, legacy deletion и structural responsive refactor. Manifest,
  write set, risks и matrix расширены до full-support `360–1920` с exact
  user-width rows и midpoint/overlap assertions. Plan готов к select; push
  остаётся запрещён.
- 2026-08-05 02:03:04 UTC: plan selected в session
  `019fc7ae-ee88-7932-9588-a41aad2c59de`; status `in_progress`.
- 2026-08-08: production implementation завершена root в одном lifecycle.
  Backend получил обязательный setup discard, authoritative charity/equip,
  turn number, strength/reward projection и playable combat/run-away
  continuation. Frontend сведён к одному responsive Figma presentation owner;
  legacy desktop/mobile tables, generic card/action/economy surfaces и dead
  composables physically удалены. Exact/fast equip, character, strength,
  opponent, charity и interaction sheets используют frozen direct nodes.
- 2026-08-08: ручной browser smoke через UI подтвердил 8 карт setup, отсутствие
  трёх случайных карт на столе, обязательный discard ровно 3 в Charity shell и
  переход в `ХОД 1` с пятью картами. Двухбраузерный real HTTP flow затем
  обнаружил и исправил death-turn deadlock: Figma death frame теперь
  автоматически отправляет единственный projected `end_turn`, не добавляя
  отсутствующую в дизайне кнопку.
- 2026-08-08: bounded read-only Terra review завершён без оставшихся P0/P1.
  Первичные подозрения по supplemental actions/private choice сняты после
  трассировки Character → actions sheet и server interaction → choose_effect.
  Reviewer также получил green focused Go tests и `git diff --check`.
- 2026-08-08: side-by-side выполнен по сохранённым live Figma direct-node
  screenshots/geometry и текущим browser captures до разрешённого обновления.
  Изменены только gameplay baselines; немедленный no-update rerun: 18/18.
  Повторный no-update после accessibility/death-flow исправлений: 18/18.

## Итог

Реализация готова к canonical lifecycle closure. Фактические evidence до
`verify/scope-check`:

- Backend: `go test ./...` — green; turn-number replay/rotation assertions
  включены в engine tests.
- Frontend: `pnpm lint`, `pnpm check`, `pnpm build` — green; contracts 18/18,
  web unit/component 160/160.
- Browser geometry: required `360/428/600/768/1024/1280/1400/1920`, boundary
  `N-1/N/N+1`, landscape/short-height, centered strength/card and safe-bottom
  dock checks — green.
- Accessibility: canonical Chromium serious/critical Axe matrix 48/48 green.
- Visual: no-update Chromium matrix 18/18 green after approved side-by-side.
- Playability: real two-context browser → Nuxt → HTTP Go backend flow green
  (`two browser actors complete one authoritative turn through the Figma UI`,
  6.0 s), including setup overflow, required interactions, combat/run-away,
  death continuation and next-player handoff.
- Figma integration: live direct-node evidence recorded above was used for
  implementation and side-by-side. A final repeat fetch required connector
  reauthentication; it did not replace or invalidate the recorded successful
  node requests.

### Visual evidence ledger

| Figma node/family | Viewport | Fixture/step | Current evidence | Direct source | Result | Baseline |
|---|---:|---|---|---|---|---|
| `293:1617`, `285:1315`, `248:5` | `1280x720` | preparation/door/combat | Playwright actual + manual browser | live links in frozen mapping | pass | `desktop-preparation`, `desktop-door`, `desktop-combat-*` |
| `285:1566`, `285:1473`, `257:447` | `1280x720` | reward/run-away/waiting | Playwright actual + manual browser | live links in frozen mapping | pass | `desktop-reward`, `desktop-run-away`, `desktop-waiting` |
| `294:2384`, `295:2518`, `295:2355` | `1280x720` | death/victory/death-loot | Playwright actual + retained real-flow capture | live links in frozen mapping | pass | `desktop-death`, `desktop-victory`, `death-loot-actor` |
| `147:731`, `181:1634`, `183:1671`, `184:1687` | `360x640` | setup/door/combat/run-away/reward/waiting | Playwright actual + responsive capture | live links in frozen mapping | pass | `mobile-*` gameplay baselines |

Canonical `./leinoctl verify --changed`, scope-check, plan-lint and final diff
review are recorded by the closing lifecycle commands below before archive.

### Canonical closure

- `LEINO_PNPM_EXECUTABLE=/Users/kolyalis/.nvm/versions/node/v24.18.0/bin/pnpm ./leinoctl verify --changed` — `ok`; resolver matched declared `pnpm@10.8.0`.
- `./leinoctl scope-check --plan 20260805T000140Z-ef4dda-frontend-gameplay-flow-responsive-figma-remediation` — `ok`; `outsideWriteSet=[]`, `unledgered=[]`, `missingRequiredChecks=[]`.
- `node .codex/hooks/plan-lint.mjs` — `plans=73 active=5 archive=68 issues=0` inside canonical verify.
- Final `git diff --check` and independent Terra review — green; push remains forbidden and was not performed.
