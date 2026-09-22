# PLAN: Figma frontend closed-set replacement and legacy removal

- **Plan ID:** `20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation`
- **Статус:** completed
- **Создан:** 2026-08-03 10:55:19 UTC
- **Обновлён:** 2026-08-03 16:38:42 UTC
- **Владелец:** Codex session `019fc7ae-ee88-7932-9588-a41aad2c59de`
- **Workspace:** shared
- **Ветка:** `codex/frontend-remaining-plans`
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260803T083541Z-26e9ab-frontend-compact-figma-handoff`.
- **Блокирует:** implementation и обновление visual baselines до revised approval

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/plans/active/20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation.md",
    "docs/agents/plans/archive/20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation.md",
    "frontend/applications/web/app/pages/index.vue",
    "frontend/applications/web/app/components/ActionPanel.vue",
    "frontend/applications/web/app/components/GameCard.vue",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/ui/SheetDialog.vue",
    "frontend/applications/web/app/assets/scss/pages/_game-desktop.scss",
    "frontend/applications/web/app/assets/scss/pages/_game-mobile.scss",
    "frontend/applications/web/app/assets/scss/pages/_lobby.scss",
    "frontend/applications/web/test/**",
    "frontend/test/browser/**"
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

## Execution gate

Предыдущее approval относилось к remediation существующей frontend-архитектуры.
Пользователь остановил реализацию и уточнил material intent: Figma является
исчерпывающим закрытым набором визуалов; старую вёрстку, экраны, подписи и
активные component paths нужно удалять, а не сохранять, встраивать или
переоформлять.

Поэтому:

- предыдущий implementation approval superseded новой редакцией;
- текущий partially implemented diff не считается основой, которую надо
  сохранить; каждый его фрагмент повторно проходит keep/delete проверку;
- revised approval получен; production/test writes снова разрешены только в
  manifest write set;
- visual baseline permission сохраняет условие: update только после
  side-by-side Figma review;
- push запрещён;
- dependency install и backend/contract changes не разрешены.

## Цель

Заменить активный lobby/game presentation tree точной реализацией закрытого
набора Figma components и state compositions. Удалить все legacy visuals и
active code paths, которым нельзя назначить конкретный Figma node owner.

Это replacement plan, не compatibility refactor:

- Figma определяет единственно допустимый состав экранов, компонентов, текстов,
  состояний, overlays и responsive compositions;
- существующий UI не является fallback или вторым источником истины;
- server projection остаётся authoritative по данным и действиям, но не
  разрешает придумывать новые presentation surfaces;
- если runtime state нельзя сопоставить существующему Figma state, root
  останавливается и запрашивает design/contract decision вместо нового visual.

## Закрытый Figma-каталог

Повторная root-инвентаризация выполнена через `get_design_context` и
`get_metadata`. Просмотрены все десять source pages, component boards, два
integrated mobile boards, mobile/desktop lobby boards, крупный screenshot
desktop board и каждый из 40 desktop state subframes отдельно.

### Правила и foundations

| Node | Единственная роль |
|---|---|
| `83:8` | approved hybrid — visual source of truth; compositions, не mega-variants; timer только для legal timed action |
| `83:15` | semantic colors, Inter/Literata, spacing 4/8/12/16/24/32, radii 8/12/14/16/20/24, четыре elevation roles |

### Разрешённые reusable components

| Figma owner | Разрешённый component contract |
|---|---|
| `89:35`, `152:19` | phase, turn/waiting/timed status, compact pager, strength |
| `91:31`, `92:32` | opponent chip idle/active и rows Count=1/2/3 |
| `96:30` | Encounter Card только Monster/Curse, строго `240x400` |
| `107:38`, `153:31` | Hand/Character/dock modes; compact dock `328x62` |
| `110:29` | Choice Card Default/Selected/Disabled |
| `112:66` | Hand и Mandatory bottom sheets |
| `167:42` | Card/Strength/Character/Opponent info sheets |
| `172:1719` | Door/PostDoor/RunAway/Reward turn decisions |
| `177:1772` | Help/Economy/Theft/DeathLoot interaction sheets |
| `179:1784` | Death/Victory terminal sheets |
| `214:149` | original Door/Treasure deck backs |

### Разрешённые complete compositions

- Mobile Selected-B lobby: `228:14`, `228:33`, `231:25`, `231:49`,
  `231:80`, `233:44`.
- Desktop Selected-B lobby: `240:53`, `242:290`, `242:343`, `242:392`,
  `242:446`, `242:501`.
- Mobile integrated states: `147:731`, `147:803`, `147:903`, `147:978`,
  `147:1082`, `147:1138`, `147:1203`, `180:1601`, `181:1634`,
  `182:1627`, `183:1671`, `184:1687`, `185:1742`, `188:1777`.
- Desktop: ровно 40 compositions из `259:708`:
  `248:5`, `253:96`, `254:221`, `256:316`, `257:447`, `258:2530`,
  `258:2674`, `271:791`, `271:3010`, `271:3216`, `285:1315`,
  `285:1388`, `285:1473`, `285:1566`, `293:1617`, `293:1706`,
  `293:1780`, `293:1866`, `293:1952`, `293:2026`, `294:1998`,
  `294:2072`, `294:2146`, `294:2235`, `294:2309`, `294:2384`,
  `295:2355`, `295:2444`, `295:2518`, `295:2592`, `295:2678`,
  `295:2764`, `296:2748`, `296:2837`, `296:2911`, `296:2985`,
  `296:3058`, `296:3133`, `297:3103`, `297:3177`.

Alternative lobby directions `197:2` и `205:6` присутствуют в Figma, но
явно исключены: production реализует только Selected-B. Mobile `360x800`,
landscape и отдельный tablet composition не входят.

## Clickable Figma source map

### Pages

| Page | Link |
|---|---|
| 01 · Getting Started | [82:3](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=82-3) |
| 02 · Foundations | [82:4](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=82-4) |
| 10 · Header | [89:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=89-2) |
| 11 · Opponents | [91:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=91-2) |
| 13 · Encounter Card | [96:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=96-2) |
| 15 · Player Dock | [105:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=105-2) |
| 17 · Sheets & Choices | [110:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=110-2) |
| 20 · Integrated States | [122:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=122-2) |
| 21 · Lobby Entry | [194:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=194-2) |
| 22 · Desktop Battle | [248:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=248-2) |

### Component boards

- [Getting Started 83:8](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=83-8),
  [Foundations 83:15](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=83-15),
  [Game Header 89:35](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=89-35),
  [Compact Header 152:19](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=152-19).
- [Opponent Chip 91:31](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=91-31),
  [Opponent Row 92:32](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=92-32),
  [Encounter Card 96:30](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=96-30).
- [Player Dock 107:38](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=107-38),
  [Compact Dock 153:31](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=153-31),
  [Choice Card 110:29](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=110-29),
  [Bottom Sheet 112:66](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=112-66).
- [Info Sheets 167:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=167-42),
  [Turn Decisions 172:1719](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=172-1719),
  [Interaction Sheets 177:1772](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=177-1772),
  [Game Results 179:1784](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=179-1784),
  [Deck Backs 214:149](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=214-149).

### Mobile and lobby boards

- [Mobile integrated board 147:671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-671),
  [Mobile core-loop board 160:1140](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=160-1140).
- [Mobile active 147:731](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-731),
  [Mobile hand 147:803](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-803),
  [Mobile timed response 147:903](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-903),
  [Mobile charity 147:978](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-978),
  [Mobile observer 147:1082](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1082),
  [Mobile reconnect 147:1138](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1138),
  [Mobile connection failed 147:1203](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1203).
- [Mobile character 180:1601](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=180-1601),
  [Mobile door 181:1634](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=181-1634),
  [Mobile post-door 182:1627](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=182-1627),
  [Mobile run-away 183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671),
  [Mobile reward 184:1687](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=184-1687),
  [Mobile info 185:1742](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=185-1742),
  [Mobile interaction 188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777).
- [Mobile lobby board 225:14](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=225-14),
  [Desktop lobby board 240:50](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=240-50),
  [Desktop lobby create idle 240:53](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=240-53).

### Desktop 40-state board

- [ActiveTurn 248:5](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=248-5),
  [HandExpanded 253:96](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=253-96),
  [RequiredResponse 254:221](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=254-221),
  [Charity 256:316](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=256-316).
- [Waiting 257:447](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=257-447),
  [Reconnecting 258:2530](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=258-2530),
  [ConnectionFailed 258:2674](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=258-2674),
  [CharacterOpen 271:791](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=271-791).
- [StrengthOpen 271:3010](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=271-3010),
  [OpponentOpen 271:3216](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=271-3216),
  [DoorReady 285:1315](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1315),
  [PostDoorChoice 285:1388](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1388).
- [RunAwayChoice 285:1473](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1473),
  [RewardReceived 285:1566](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1566),
  [Preparation 293:1617](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1617),
  [CurseEffect 293:1706](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1706).
- [HelpOffer 293:1780](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1780),
  [HelpIncoming 293:1866](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1866),
  [HelpAccepted 293:1952](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1952),
  [RunAwayPending 293:2026](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-2026).
- [RunAwaySuccess 294:1998](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-1998),
  [RunAwayFailure 294:2072](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2072),
  [RunAwayNextMonster 294:2146](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2146),
  [EndTurnReady 294:2235](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2235).
- [TurnPassed 294:2309](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2309),
  [Death 294:2384](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2384),
  [DeathLoot 295:2355](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2355),
  [DeathRecovery 295:2444](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2444).
- [Victory 295:2518](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2518),
  [Trade 295:2592](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2592),
  [Gift 295:2678](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2678),
  [TheftResponse 295:2764](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2764).
- [PrivateChoice 296:2748](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2748),
  [StaleChoice 296:2837](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2837),
  [ExpiredChoice 296:2911](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2911),
  [EmptyHand 296:2985](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2985).
- [InitialLoading 296:3058](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-3058),
  [SessionLost 296:3133](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-3133),
  [GameUnavailable 297:3103](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=297-3103),
  [GameFinished 297:3177](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=297-3177).

## Явно отсутствует в Figma

Следующие concepts запрещено сохранять как compatibility UI:

- `Зоны`, `ПУБЛИЧНЫЕ ЗОНЫ`, `ТВОЯ ЗОНА` и generic zone layout;
- visible projection `ВЕРСИЯ`;
- `Детали комнаты` и strength control, открывающий несуществующие room details;
- compact ellipsis/overflow menu;
- отдельный legacy board/loading mock с придуманными игроками и действиями;
- simultaneous reward/run-away/pending/resolving overlays;
- второй modal/dialog kernel, nested native dialogs и inert duplicate economy
  mount;
- любой новый fallback screen, не принадлежащий named System/Result Figma
  composition.

## Mandatory legacy delete ledger

| Existing owner/path | Решение |
|---|---|
| `game/GameContextPanel.vue` | delete; generic context panel не имеет Figma owner |
| `game/CardZone.vue` | delete; generic zones отсутствуют |
| `game/HandBrowser.vue` | delete; standalone duplicate dialog отсутствует |
| `game/sheets/SheetDialog.vue` | delete legacy wrapper; один runtime kernel |
| `game/sheets/HandSheet.vue` | delete old wrapper; replace exact `112:66` |
| `game/sheets/StrengthSheet.vue` | delete old wrapper; replace exact Strength composition |
| `game/sheets/CharacterSheet.vue` | delete old wrapper; replace exact Character composition |
| `game/sheets/CardDetailSheet.vue` | delete old wrapper; replace exact Card info composition |
| `game/OpponentRoster.vue` | replace completely; no old labels or zones sheet; room block rebuild only from `248:5` |
| `game/OwnBoard.vue` | replace completely with Figma player/hand/character owners |
| `game/mobile/MobileOwnState.vue` | remove `Открытые зоны` branch; rebuild dock/sheets from nodes |
| `game/mobile/MobileOpponentSummary.vue` | rebuild chip row; retain details only as exact Opponent sheet |
| `game/status/LoadingGameTable.vue` | replace fake board with `296:3058` |
| `interaction/core/InteractionDialog.vue` | remove duplicate kernel; exact interaction content uses shared modal owner |
| desktop/mobile `EconomySurface` duplicate mounts | remove; one active Figma-owned interaction surface |
| legacy browser selectors and fixtures | delete/replace; tests не должны вынуждать сохранять obsolete DOM |
| legacy visual baselines | не источник истины; replace only after reviewed Figma diff |
| unused `missing-art` fixture | delete |

`CardArtPlaceholder` разрешён только как exact Figma artwork placeholder из
`96:30`, с literal presentation `ИЛЛЮСТРАЦИЯ КАРТЫ`; он не разрешает generic
missing-art screen.

## Критерии приёмки

- [x] Каждый production-rendered visual component имеет recorded Figma
  node owner; unmapped active visual components отсутствуют.
- [x] Все строки из раздела «Явно отсутствует» отсутствуют в player UI DOM и
  production source presentation branches.
- [x] Files из delete ledger удалены либо, для replace rows, полностью
  переписаны без legacy template/style/controller branches.
- [x] Lobby реализует только Selected-B mobile/desktop states с exact text,
  hierarchy, deck art, geometry, validation/loading/focus behavior.
- [x] Mobile `360x640` использует exact fixed composition: header
  `(14,12) 332x32`, opponents `(14,52) 332x38`, rail
  `(0,98) 360x416`, dock `(16,554) 328x62` и bottom safe area `24px`.
- [x] Mobile presenter не создаёт ни одного alternate screen: все sheets и
  terminal/connection states принадлежат перечисленным mobile nodes.
- [x] Desktop `1440x900` shell соответствует `248:5`: header `1408x56`,
  opponents `248x796`, encounter `768x502`, hand `768x278`, player
  panel `360x796`.
- [x] Все 40 desktop fixture states рендерят одну соответствующую composition;
  mutually exclusive center/sheet/result surfaces не co-renderятся.
- [x] Opponent cards/chips используют Figma content hierarchy; `Зоны` и version
  metadata не подмешиваются; room block/ID control совпадает с `248:5`.
- [x] Monster/Curse, Choice Card, deck backs, Hand/Character dock,
  info/decision/interaction/result sheets повторяют только свои variant sets.
- [x] В runtime смонтирован один presenter и один modal kernel; второй hidden
  tree, nested dialogs и inert duplicate interactions отсутствуют.
- [x] Timers существуют только в legal timed actions и берут server deadline;
  untimed states не получают synthetic countdown.
- [x] Все действия остаются native controls; focus trap, Escape policy,
  mandatory nondismissal и return focus соответствуют surface semantics.
- [x] Long Russian card copy остаётся внутри fixed Figma card: line clamp с
  многоточием, без внутреннего scroll и изменения card geometry.
- [x] `1024x768`, `1280x720`, `1280x800`, `1366x768` используют ту же desktop
  composition и те же components, без нового tablet/compact visual.
- [x] Existing actor privacy сохраняется: чужая рука только count, никаких
  derived hidden cards и internal state.
- [x] Tests разделяют node mapping, semantic mapping, bounds/collision,
  accessibility и visual review; self-snapshot не считается Figma evidence.
- [x] Visual baselines обновляются только после финального side-by-side review
  direct nodes и actual screenshots.
- [x] Lint, typecheck, unit, browser, a11y, visual и canonical repository checks
  проходят.

## Dynamic-data boundary

Figma фиксирует visual hierarchy и exemplar copy; runtime identities, counts,
card names и legal actions приходят только из actor-specific projection.
Нельзя подменять отсутствующее поле `projection.version` или локальной
догадкой.

В повторном аудите обнаружены два точных contract gaps:

1. Desktop Figma header содержит ordinal вроде `ХОД 4`, а projection не
   содержит turn ordinal.
2. Desktop opponent card содержит public `СИЛА`, а `otherPlayerViewSchema`
   не содержит authoritative combat strength.

До resolution запрещено:

- выдавать `version` за номер хода;
- выдавать `level` за силу;
- вычислять authoritative opponent combat strength из неполного публичного
  набора;
- добавлять fallback labels/panels.

Рекомендуемое безопасное решение в рамках frontend-only plan: сохранить exact
Figma component geometry и labels, но не показывать выдуманное dynamic value;
эти два slots получают явное unavailable state только если такой variant уже
есть в Figma. Сейчас такого variant не найдено, поэтому оба gaps являются
hard pre-implementation design/contract decisions. Contract/backend expansion
не входит в этот plan.

## Scope

### Входит

- deletion/replacement всего legacy player UI из ledger;
- exact Selected-B lobby;
- exact mobile `360x640` components и compositions;
- exact desktop shell и все 40 compositions;
- один pure projection-to-Figma-state mapping;
- один presenter owner и один modal kernel;
- component-owned styles и semantic Figma tokens;
- replacement browser/unit/a11y/visual evidence;
- reviewed snapshot refresh и полный local lifecycle.

### Не входит

- backend, Zod/wire contracts, database, content mechanics и server authority;
- Card Studio UI и `_studio.scss`;
- alternative lobby directions;
- mobile landscape, `360x800` и новый tablet composition;
- новые тексты, icons, illustrations, screens или Figma edits;
- dependency install;
- push.

## Architecture after replacement

1. Projection mapper выбирает ровно один named Figma composition; он не
   моделирует presentation, которой нет в source file.
2. Responsive owner монтирует ровно mobile или desktop presenter. Оба используют
   одни Figma-owned primitives, data mapping и modal state.
3. Layout components владеют только placement Figma regions. Domain/controller
   logic не живёт в большой stage template.
4. `CardPresentation` — pure Monster/Curse/Choice/deck presentation. `GameCard`
   может оборачивать его legal action semantics, но не добавляет visual.
5. Все information/decision/interaction/result contents используют один modal
   kernel и named Figma variants. Generic sheet wrapper UI удаляется.
6. System, loading, offline и terminal states выбираются только из desktop
   System/Result/Empty modes и перечисленных mobile panels.
7. Intermediate desktop viewports меняют только fluid dimensions той же shell;
   composition и component inventory не меняются.

Новые production-файлы, уже созданные в частичном diff:

- `components/game/gamePresentationModel.ts`;
- `components/game/primitives/CardPresentation.vue`.

Они не имеют права на сохранение автоматически. Root оставляет их только если
после replacement они реализуют пункты 1 и 4 без legacy branches. Другие новые
production-файлы требуют reapproval.

## Координация с другими планами

### Write set

| Path/resource | Режим | Причина |
|---|---|---|
| `docs/agents/plans/active/20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation.md` | write | active lifecycle/evidence |
| `docs/agents/plans/archive/20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation.md` | write | archived lifecycle/evidence |
| `frontend/applications/web/app/pages/index.vue` | write | exact Selected-B replacement |
| `frontend/applications/web/app/components/ActionPanel.vue` | write | Figma action presentation |
| `frontend/applications/web/app/components/GameCard.vue` | write | Figma card/action boundary |
| `frontend/applications/web/app/components/game/**` | write | replacement and legacy deletion |
| `frontend/applications/web/app/components/interaction/**` | write | interaction replacement and legacy deletion |
| `frontend/applications/web/app/components/ui/SheetDialog.vue` | write | one modal kernel |
| `frontend/applications/web/app/assets/scss/pages/_game-desktop.scss` | write | desktop shell placement |
| `frontend/applications/web/app/assets/scss/pages/_game-mobile.scss` | write | mobile shell placement |
| `frontend/applications/web/app/assets/scss/pages/_lobby.scss` | write | lobby placement |
| `frontend/applications/web/test/**` | write | mapper/component and legacy-absence tests |
| `frontend/test/browser/**` | write | behavior, a11y, visual contracts and baselines |

`frontend/test/browser/**` и `components/interaction/**` расширяют старый write
set. Это material scope change и главная причина revised approval.

`./leinoctl context` подтвердил один eligible selected plan и не обнаружил
другого active frontend owner. Figma file и visual baselines остаются shared
resources этого plan.

## Delegation strategy

Classification: **large — planning and implementation-time read-only
delegation required**.

### Повторная planning delegation

1. Luna explorer для closed Figma inventory:
   - requested role `explorer`, read-only, empty write set;
   - orchestration снова вернул `Unknown model gpt-5.6-luna`;
   - fallback Terra explorer completed;
   - результат: закрытый component/state catalog, явное отсутствие Zones,
     compact ellipsis, landscape и simultaneous overlays.
2. Luna explorer для legacy visual audit:
   - Luna unavailable по той же причине;
   - fallback Terra explorer completed;
   - результат: path-backed delete/replace ledger и obsolete test selectors.

Root независимо повторил Figma traversal и repository evidence; explorer
findings не заменяли root review.

### После revised approval

- пока root удаляет legacy и пишет replacement, запустить bounded read-only
  explorer по projection-to-Figma mapping/privacy;
- параллельно запустить bounded read-only explorer по browser/a11y/responsive
  coverage;
- не давать агентам write set, не разрешать commits и не останавливать root;
- после интеграции main diff запустить отдельного Terra reviewer для
  adversarial review exact Figma ownership, deletion completeness, contracts,
  a11y и verification.

## План реализации

1. [x] **Stop and re-inventory.** Остановить implementation, повторно прочитать
   все Figma pages/component boards/mobile boards/lobby boards/40 desktop
   frames, независимо проаудировать legacy.
2. [x] **Rewrite plan.** Зафиксировать Figma closed set, delete ledger,
   expanded write set, dynamic-data gaps и superseded approval.
3. [x] **Resolve hard data gaps and obtain revised approval.** Пользователь
   согласовал exact revised plan. Frontend не подменяет turn ordinal версией и
   не выдаёт level/derived hidden state за authoritative opponent strength;
   отсутствующие dynamic values не синтезируются.
4. [x] **Remove legacy first.** Удалить dead files, active legacy labels,
   version/zone branches, duplicate modal/interaction/economy trees и obsolete
   tests. Room block не сохранять из legacy, а заново собрать по `248:5`.
5. [x] **Build exact Figma primitives.** Foundations, header, opponents,
   Encounter/Choice cards, deck backs, dock, buttons, one modal kernel и exact
   sheet contents.
6. [x] **Replace Selected-B lobby.** Реализовать все mobile/desktop states и
   удалить любое alternative production flow.
7. [x] **Replace mobile presenter.** Реализовать только named `360x640`
   integrated/core-loop compositions и exact safe-area/focus semantics.
8. [x] **Replace desktop presenter.** Собрать постоянную Figma shell и
   взаимоисключающие mappings для всех 40 states.
9. [x] **Delete residual generic presentation.** `rg`/component graph/test
   assertions подтверждают отсутствие unmapped visual owners и legacy strings.
10. [x] **Focused verification.** Lint/typecheck/unit, browser behavior,
    40-state mapping, geometry/collision, modal/focus, privacy and responsive
    checks.
11. [x] **Human visual gate.** Снять actual screenshots canonical states,
    side-by-side сравнить с direct Figma nodes и исправлять source до review.
12. [x] **Baseline refresh.** Только после side-by-side review выполнить
    explicit snapshot update и проверить PNG diff.
13. [x] **Independent Terra review.** Address all correctness/ownership/a11y/
    contract findings before canonical closeout.
14. [x] **Canonical closeout.** `./leinoctl verify --changed`,
    `scope-check`, final evidence, status completed, archive, release, один
    local commit; no push.

## Проверки

- [x] exact pnpm 10.8.0: `pnpm --filter @munchkin/web lint`
- [x] `pnpm --filter @munchkin/web typecheck`
- [x] `pnpm --filter @munchkin/web test`
- [x] focused model/component legacy-absence tests: 39/39 passed
- [x] browser: lobby, player UI, advanced interactions, economy, run-away,
  connection/system, keyboard/focus
- [x] a11y suite
- [x] visual suite без snapshot update: 24/24 passed after reviewed refresh;
  death terminal guard 2/2 passed
- [x] 40/40 desktop Figma nodes mapped и rendered
- [x] all named mobile/lobby states mapped и representative screenshots
- [x] exact `360x640` region bounds and sheet bounds
- [x] desktop `1024x768`, `1280x720`, `1280x800`, `1366x768`,
  `1440x900`: same inventory, no clipping/overlap/new composition
- [x] DOM/source absence checks для prohibited legacy labels/branches
- [x] one-presenter/one-modal-kernel structural tests
- [x] side-by-side direct nodes `240:53`, `147:731`, `181:1634`,
  `248:5`, `253:96`, `254:221`, `258:2674`, `285:1566`
- [x] explicit reviewed snapshot update: 19 canonical baselines refreshed
- [x] `./leinoctl verify --changed`: passed 2026-08-03 16:30 UTC
- [x] `./leinoctl scope-check --plan 20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation`:
  `ok`, no outside-write-set or unledgered paths

## Риски и ограничения

- **Partial diff bias:** уже написанный код может провоцировать сохранение
  неверной архитектуры. Mitigation: delete ledger и Figma ownership решают
  keep/delete; sunk cost не является аргументом.
- **Contract gap:** exact data slots отсутствуют в projection. Mitigation:
  hard stop, никакой подмены version/level/derived hidden state.
- **Large replacement:** временно красные tests после deletion. Mitigation:
  короткие replacement slices, focused checks после каждого named owner, без
  snapshot masking.
- **Visual self-reference:** старые baselines закрепляют legacy. Mitigation:
  Figma side-by-side до update; baseline green не является parity proof.
- **Privacy regression:** Figma exemplar может показывать данные, которых нет у
  actor. Mitigation: actor-specific projection сильнее exemplar data; visual
  slot блокируется, hidden data не синтезируется.
- **Intermediate widths:** нет отдельного Figma tablet source. Mitigation:
  сохранять тот же desktop component inventory и composition, менять только
  fluid sizing; новый breakpoint screen запрещён.
- **Rollback:** один final local commit позволяет обычный `git revert` после
  lifecycle; reset/stash/force checkout не используются.

## Согласование

- **Статус:** approved
- **Подтверждено:** 2026-08-03, пользователь согласовал revised exact plan и
  разрешил reviewed visual baseline update; push запрещён.
- **Предыдущее согласование:** superseded material clarification 2026-08-03.
- **Revised approval:** confirmed 2026-08-03 сообщением пользователя
  «даю аппрув, делай» для exact plan ID.
- **Сохраняющиеся ограничения пользователя:** Figma exhaustive; legacy
  удалить, не интегрировать; bounded read-only agents during implementation;
  separate Terra reviewer; baseline update only after side-by-side; one
  sequential lifecycle; no push.

## Ход выполнения

- Lifecycle owner и selected plan не менялись.
- До stop был создан partial implementation diff; baseline update не
  выполнялся.
- Пользователь остановил implementation после визуального review и потребовал
  closed-set replacement plan.
- Root заново вызвал Figma design context для all source component boards,
  integrated/lobby boards и всех 40 desktop nodes; крупный `259:708` screenshot
  просмотрен целиком.
- Повторный Luna spawn после обновления Codex всё ещё отклонён orchestrator;
  два bounded Terra fallback explorers завершили read-only inventory.
- Repository audit подтвердил active legacy labels `Зоны`/`ВЕРСИЯ`,
  duplicate interaction/modal paths и dead generic components.
- Этот plan amendment является единственной записью после stop.
- После показа exact revised plan пользователь дал explicit approval,
  подтвердил продолжение implementation и разрешил использовать read-only
  сабагентов там, где это нужно.
- Два bounded read-only Luna explorers независимо проверили shared
  presentation architecture и tests/Figma/responsive coverage, пока root
  продолжал implementation.
- Единый `gamePresentationModel` стал presentation boundary для desktop и
  mobile; старые desktop/mobile models, generic zone/context/hand components и
  duplicate sheet wrappers удалены.
- Direct Figma nodes и actual browser screenshots проверены side-by-side до
  обновления 19 visual baselines; последующий no-update control прошёл 24/24.
- Независимый Terra reviewer нашёл обязательный observer run-away, competing
  mobile dialogs, слабый mobile geometry fixture, остаточный desktop CSS и
  недостаточную runtime matrix assertion; все findings исправлены и повторно
  проверены.
- Финальный canonical `verify --changed` прошёл; `scope-check` подтвердил
  отсутствие outside-write-set и unledgered paths.

## Итог

Активная lobby/game presentation заменена закрытым Figma-каталогом. Legacy
экраны, подписи, presentation branches и компоненты без Figma owner удалены,
а не встроены в новую композицию. Desktop и mobile используют общий
actor-safe presentation model, один presenter и один modal kernel; terminal
death, reward и run-away surfaces взаимоисключающие.

40-node desktop catalog и named mobile/lobby states закреплены mapping,
semantic, responsive, accessibility и browser tests. Visual baselines
обновлены только после direct-node side-by-side проверки и затем подтверждены
no-update прогоном.

Frontend не выдумывает отсутствующие contract data: opponent strength, turn
ordinal и несуществующий card `bad_stuff` copy не подменяются version, level
или локальным текстом. Для них потребуется отдельное contract/design решение,
если соответствующие dynamic slots станут обязательными. Push не выполнялся.
