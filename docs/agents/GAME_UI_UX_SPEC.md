# Player-facing Game UI/UX Specification

Статус: normative product design target для lobby `/` и game table
`/game/:id`. Документ описывает желаемое пользовательское поведение и
визуальный контракт, но сам по себе не доказывает runtime-реализацию.

## Как читать документ

В этом документе используются три метки:

- **CURRENT** — поведение подтверждено текущими contracts/code либо живым
  browser-аудитом;
- **TARGET** — обязательный product UX для будущей реализации;
- **FUTURE** — зависит от ещё не реализованного server descriptor/contract и
  не может быть выведено клиентом заранее.

Нормативные frontend architecture, placement, naming, TypeScript, CSS
ownership и review rules находятся в
[`FRONTEND_ENGINEERING_SPEC.md`](FRONTEND_ENGINEERING_SPEC.md). Здесь они не
дублируются. Authoritative multiplayer timing, privacy, CAS и replay rules
находятся в
[`GAME_INTERACTION_PROTOCOL.md`](GAME_INTERACTION_PROTOCOL.md). Product UI
потребляет эти правила и не создаёт параллельный протокол.

Слова «должен», «запрещён» и «обязателен» задают TARGET. Конкретные имена
будущих transport-полей появляются в клиенте только после принятия backend
schema и Zod contract отдельным implementation plan.

## Product principles

1. **Сервер сообщает истину, интерфейс объясняет её.** Клиент отправляет
   intent, показывает pending delivery и ждёт новую actor-specific projection.
   Он не предсказывает RNG, исход боя, принятие помощи, продление deadline или
   победителя.
2. **Главное действие видно без охоты за кнопкой.** Текущий ход, причина
   ожидания, открытые взаимодействия и доступные server actions образуют
   устойчивую иерархию на любом поддерживаемом viewport.
3. **Плотность не означает тесноту.** Игра с 1–6 участниками остаётся
   сканируемой: краткие opponent summaries всегда доступны, подробности
   раскрываются по запросу.
4. **Один layout, разные ёмкости.** Mobile не является урезанным desktop:
   порядок регионов сохраняет смысл, а presentation меняется между grid,
   stack, sheet и bounded rail по доступному месту.
5. **Каждый realtime переход оставляет статический след.** Цвет, motion и
   toast никогда не являются единственным объяснением изменения.
6. **Privacy видна в модели интерфейса.** UI рендерит только actor projection,
   не оставляет слотов под скрытые server данные и не пытается вычислить чужую
   руку, eligible actors или скрытый исход.
7. **Карты работают без иллюстраций.** Название, тип, правила, числовые
   параметры и доступность действия читаемы при missing/disabled image.
8. **320 CSS px — настоящий нижний предел.** Горизонтальный scroll всего
   документа, clipped critical content и controls за safe viewport запрещены.

## Подтверждённая runtime-граница

### CURRENT surfaces

- `/` содержит создание комнаты и вход по game ID.
- `/game/:id` загружает actor-specific projection, хранит credential только
  в текущей browser session, подписывается на version-only invalidation и
  делает полную повторную загрузку projection при новой версии.
- Status уже различает `lobby`, `active`, `finished`.
- Phase уже различает `setup`, `preparation`, `door_choice`, `combat`,
  `run_away`, `resolve_effect`, `charity`, `end_turn`.
- Клиент рендерит только `turn.available_actions`, а при их отсутствии
  показывает ожидание текущего игрока.
- CURRENT action descriptors не содержат interaction identity, responder
  state, target player, offer/reward, deadline, pass, accept или decline.
- CURRENT realtime UI различает `connecting`, `connected`, `resyncing`,
  `offline`, но ещё не имеет общей live-region и recovery surface.

### Browser-аудит 2026-07-30

Аудит выполнен локально на in-memory Go backend и Nuxt dev server без Docker
и без изменения production code. Созданы два browser actor-а; проверены
create/join/start, owner setup, waiting peer и version invalidation → resync.
После аудита оба сервера и тестовые вкладки остановлены.

| Evidence | Exact viewport / widths | Результат |
|---|---|---|
| Lobby, game lobby, active setup owner | `320 × 568` | Critical controls доступны, но document `scrollWidth=320`, `clientWidth=305`: горизонтальный overflow `15 px` |
| Narrow landscape | `667 × 375` | Document overflow не обнаружен; vertical capacity остаётся отдельным future gate |
| Boundary sweep | `373/374/375`, `426/427/428`, `598/599/600`, `719/720/721`, `766/767/768`, `1022/1023/1024`, `1278/1279/1280`, `1438/1439/1440`, `1899/1900/1901` CSS px | Для lobby, waiting peer и active setup document overflow обнаружен только при отдельной проверке `320 × 568` |
| CURRENT layout switch | `720 → 721` CSS px | Lobby переходит с одной колонки на две; game side columns меняются с `70px` на `130px`. Это audit baseline, не TARGET breakpoint contract |
| Active setup action rail | `320 × 568` | `clientWidth=254`, `scrollWidth=1360`, внутренний overflow `1106 px` |
| Active setup hand rail | `320 × 568` | `clientWidth=288`, `scrollWidth=1508`, внутренний overflow `1220 px` |
| Large viewport rails | width `1900` CSS px | Даже при большой ширине action rail имеет `142 px`, hand rail `68 px` внутреннего overflow |
| Keyboard reveal in action rail | `320 × 568` | Focus на четвёртой кнопке прокрутил rail до `scrollLeft=818`; focused rect остался внутри viewport, root `scrollX=0` |
| Semantics snapshot | `320 × 568` | Native link/buttons доступны; dialog и `aria-live`/`role=status`/`role=alert` отсутствуют; custom `:focus-visible` rule не найден |
| Realtime | два actor-а | Join дал version `v2`, start дал `v3`; оба клиента получили invalidation и перезагрузили projection |

Причина 320 px дефекта подтверждена source-аудитом: `body { min-width:
320px }` конфликтует с шириной, занятой vertical scrollbar. Исправление
принадлежит будущему implementation plan; этот docs-only plan CSS не меняет.

Живьём не проверялись и не выдаются за проверенные:

- `preparation`, `door_choice`, полный `combat`, `run_away`,
  `resolve_effect`, `charity`, `end_turn`, death и victory;
- offline/reconnect во время команды, stale CAS response и server timeout;
- FUTURE generic interaction, intervention, help/reward и opaque window;
- coarse pointer, 200%/400% zoom, forced colors и reduced-motion emulation;
- полный Tab/Shift+Tab порядок: in-app browser не дал устойчивого synthetic
  keyboard traversal, поэтому подтверждён только focused-control reveal.

Source-аудит подтверждает наличие CURRENT phase/error/reconnect branches, но
не доказывает их визуальную и accessibility корректность. Эти состояния
остаются обязательными future fixtures.

## Screen and state inventory

### `/` — lobby entry

| State | Marker | Primary content | Primary action | Recovery / note |
|---|---|---|---|---|
| Initial | CURRENT | Product intro, create form, join form | «Создать комнату» / «Войти» | Две независимые native forms |
| Submitting create | TARGET | Create form сохраняет введённое имя | «Создаём…» disabled | Не утверждать, что room уже создана |
| Submitting join | TARGET | Join form сохраняет game ID и имя | «Входим…» disabled | Не очищать поля при transport error |
| Validation error | TARGET | Inline message рядом с полем + summary | «Исправить данные» | Focus на первое invalid field |
| Server error | CURRENT → TARGET | Понятное сообщение без raw internal detail | «Повторить» | `role=alert`; введённые данные сохранены |
| Credential unavailable | TARGET | Объяснить session-scoped credential | «Вернуться» | Не запрашивать чужой player ID |
| Room created | CURRENT | Переход на `/game/:id` | — | Credential сохраняется до navigation |

### `/game/:id` — loading and connection

| State | Marker | Stable layout | Action |
|---|---|---|---|
| Initial loading | CURRENT → TARGET | Table skeleton сохраняет будущие regions | Нет game actions |
| Projection unavailable | CURRENT → TARGET | Error panel внутри page shell | «Повторить» и «Вернуться в лобби» |
| Connecting | CURRENT → TARGET | Последняя projection остаётся видимой | Actions разрешены только согласно выбранной recovery policy |
| Resyncing | CURRENT → TARGET | Последняя projection dimmed, не очищается | Команды временно блокируются; status объясняет причину |
| Offline | CURRENT → TARGET | Последняя подтверждённая projection read-only | «Повторить подключение» |
| Stale command | TARGET | Серверная projection заменяет stale UI | «Состояние изменилось. Проверьте действие» |
| Session lost | TARGET | Не показывать game state без credential | Вернуться в lobby; не предлагать ввести player ID |

### `/game/:id` — lobby

| State | Marker | Что видно |
|---|---|---|
| Empty room / owner only | CURRENT | Game ID, rules/content identity, участник, owner start action |
| 2–6 players | CURRENT | Stable ordered roster, readiness/status, owner/non-owner distinction |
| Non-owner waiting | CURRENT | Кто может начать и что ожидается |
| Start pending | TARGET | Только delivery pending; roster остаётся интерактивно стабильным |
| Start accepted | TARGET | Projection version обновилась; переход к setup подтверждён сервером |

### `/game/:id` — active and finished

| State | Marker | Required emphasis |
|---|---|---|
| Setup: actor active | CURRENT | Own hand/board, server actions, setup progress |
| Setup: waiting peer | CURRENT | Чей setup ожидается, own read-only state |
| Preparation | CURRENT contract / source | Turn owner, equipment/traits, legal preparation actions |
| Door choice | CURRENT contract / source | Encounter zone и server choice |
| Combat | CURRENT contract / source | Monster/player strengths, confirmed delta and legal actions; helper appears only in FUTURE projection |
| Run away | CURRENT contract / source | От чего бежит actor и только legal escape intents |
| Resolve effect | CURRENT contract / source | Mandatory decision surface и consequences summary |
| Charity | CURRENT contract / source | CURRENT self-discard choice; player targets/transfers appear only in FUTURE projection |
| End turn | CURRENT contract / source | Turn result and next player |
| Waiting | CURRENT | Current actor, phase, reason no actor action is available |
| Victory | CURRENT contract / source | Winner, final state, no active actions |
| Death / temporarily inactive | CURRENT source | Status and when participation resumes |

### FUTURE multiplayer interaction states

Эти states появляются только после implementation server projection из
`GAME_INTERACTION_PROTOCOL.md`.

| State | Surface | Required information |
|---|---|---|
| Inbox empty | Compact persistent indicator | «Открытых взаимодействий нет» не занимает primary action space |
| Inbox has items | Interaction inbox/queue | Count, kind, subject, urgency, actor-specific eligibility |
| Window awaiting actor | Dialog on large layout, bottom sheet on compact layout | Server-projected prompt, eligible actions, authoritative deadline |
| Response sending | Same surface | Selected intent locked locally; «Отправляем…» |
| Response accepted | Same surface until new projection | «Ответ принят сервером»; итог ещё не придуман |
| Window updated | Same interaction identity | New projection replaces options atomically |
| Pass | Eligible action form | Explicit «Пас» only when server descriptor allows it |
| Closed / expired | Static result + polite live update | Why no action can be sent; no local reopening |
| Opaque pending | Privacy-safe status | Existence/progress only to the detail allowed by actor projection |
| Deadline extended by a late material action | Countdown/status | Updated absolute deadline when the actor projection exposes it; never a client extension |
| Reconnected | Inbox reconstructed from projection | No reliance on old local modal state |

### Cross-cutting accessibility modes

| Route/state | Marker | Required behavior |
|---|---|---|
| `/`, reduced motion | TARGET | Submission, validation and navigation remain understandable without transition/scroll animation |
| `/game/:id`, reduced motion | TARGET | Same projection, action order and focus; confirmed deltas use immediate static cues |
| `/game/:id`, forced colors / zoom | TARGET | Regions, selected/disabled/focus states and mandatory choices remain distinguishable and reflow without document overflow |

## Information hierarchy and layout regions

Page order in DOM and keyboard navigation:

1. skip link;
2. product/game header;
3. connection and authoritative status;
4. turn/context header;
5. open interaction inbox;
6. encounter/combat region;
7. opponents;
8. own board;
9. own hand;
10. persistent action surface;
11. transient status container.

Visual reordering may not produce a contradictory keyboard order.

### Region responsibilities

| Region | Always answers | Never does |
|---|---|---|
| Turn/context header | whose turn, phase, projection version context, waiting reason | Invent local phase or winner |
| Opponents | name, public level/strength/status, public board summary | Render hidden hand/deck/RNG placeholders |
| Encounter/combat | current public encounter, strengths and confirmed deltas | Animate predicted combat result |
| Own board | actor public equipment/traits/carried state | Mix hidden hand with public opponent data |
| Hand | full actor-visible hand, selection and legal-action affordance | Make card image the only readable content |
| Persistent action surface | only current server-projected legal actions | Reconstruct legality from phase alone |
| Interaction inbox | actor-visible FUTURE windows and urgency | Leak eligible/responder details absent from projection |
| Status/live updates | pending, accepted, refreshed, closed, error | Replace durable result content with a toast |

### Density for 1–6 players

- One-player preview retains the shared lobby/table core cycle; it is not a
  separate «solo mode».
- At 1–3 players, opponent summaries may be full cards where space allows.
- At 4–6 players, summaries use equal-height compact rows/cards with name,
  level, public strength, status and at most two most important public badges.
- Detail opens from a semantic button into a non-modal disclosure on wide
  layouts or a sheet on compact layouts.
- No opponent is hidden behind an unlabeled carousel dot. If summaries become
  scrollable, the region exposes count, current position and next/previous
  controls.
- Turn owner and actor are not indicated by color alone: use text and icon
  plus `aria-current` or equivalent semantics selected in implementation.

## Canonical responsive contract

### Munchkin-owned boundaries

Числа адаптированы из Digiversity как начальные source values, но становятся
локальным Munchkin contract. Runtime dependency на `@digiversity/*`, его
theme, SCSS, fonts или components запрещена.

| Token | Boundary, CSS px | Munchkin meaning |
|---|---:|---|
| `mobile` | 374 | Самая узкая single-column композиция; controls не мельче touch target |
| `mobile_large` | 427 | Дополнительная inline capacity, но всё ещё compact mobile |
| `tablet_small` | 599 | Верхняя граница mobile stacking и bottom action dock |
| `tablet` | 767 | Compact tablet / portrait; первая возможная split composition |
| `tablet_large` | 1023 | Full tablet / small landscape; two-region table |
| `laptop` | 1279 | Compact desktop table; three-region composition возможна |
| `desktop` | 1439 | Standard wide table and richer opponent summaries |
| `desktop_large` | 1900 | Upper content-density boundary, не unlimited stretch |

Boundary token — закрытая верхняя граница, а не готовая команда переключить
каждый component.

- `atMost(mobile)` означает `(width <= 374px)` и включает `374`.
- Mobile-first counterpart `above(mobile)` означает `(width > 374px)` и не
  включает `374`.
- `between(mobile, mobile_large)` означает
  `(374px < width <= 427px)`.
- Для CSS следует предпочитать Media Queries Level 4 range syntax, чтобы
  fractional CSS pixels не создавали overlap/gap.
- API, поддерживающий только `min-width`, обязан генерировать отдельный
  derived threshold для следующего integer test band (`375px`, `428px`,
  `600px`, …), а не использовать boundary как inclusive minimum.
- В одном component нельзя смешивать `max-width: N` и `min-width: N` как
  противоположные ветви: обе включат `N`.
- Container query выбирается по inline capacity компонента, но boundary
  semantics и verification cases остаются теми же.

### Content-driven layout transitions

Не каждый canonical token обязан иметь media query.

| Capacity | Default composition | Typical transition |
|---|---|---|
| `320–374` | Single column; compact header; bottom action dock; hand rail + full-hand sheet | Base |
| `>374–599` | Single column; larger card preview; paired secondary actions where they fit | Content, not token count |
| `>599–767` | Stacked table with optional two-column own-board details | `above(tablet_small)` |
| `>767–1023` | Two-region table: context/encounter + player area; action dock remains persistent | `above(tablet)` |
| `>1023–1279` | Three-region table: opponents / encounter / own state | `above(tablet_large)` |
| `>1279–1439` | Wider encounter and full action labels; opponent details expand | `above(laptop)` if measured need exists |
| `>1439–1900` | Stable max-width table, extra gutters, no unbounded card stretching | `above(desktop)` |
| `>1900` | Same density, centered content and capped line/card widths | `above(desktop_large)` |

### Viewport and boundary matrix

Every future layout implementation must run the complete width sweep below on
all three dense boundary fixtures: six long-named players, a multi-action hand,
and an open full-hand/interaction sheet. Fixed `900px` height makes runs
reproducible; additional short-height rows cover vertical pressure.

| Boundary | Just below | At | Just above |
|---|---|---|---|
| minimum | — | `320 × 900` | `321 × 900` |
| `mobile` | `373 × 900` | `374 × 900` | `375 × 900` |
| `mobile_large` | `426 × 900` | `427 × 900` | `428 × 900` |
| `tablet_small` | `598 × 900` | `599 × 900` | `600 × 900` |
| `tablet` | `766 × 900` | `767 × 900` | `768 × 900` |
| `tablet_large` | `1022 × 900` | `1023 × 900` | `1024 × 900` |
| `laptop` | `1278 × 900` | `1279 × 900` | `1280 × 900` |
| `desktop` | `1438 × 900` | `1439 × 900` | `1440 × 900` |
| `desktop_large` | `1899 × 900` | `1900 × 900` | `1901 × 900` |

Additional mandatory rows:

- `320 × 568`: minimum portrait and scrollbar interaction;
- `375 × 667`: compact portrait;
- `390 × 844` and `427 × 926`: common tall mobile capacities;
- `667 × 375` and `844 × 390`: short landscape;
- `768 × 1024`: portrait tablet;
- `1024 × 768`: compact landscape;
- `1280 × 720`, `1366 × 768`, `1440 × 900`, `1920 × 1080`;
- 200% zoom at `1280 × 720` and 400% text/viewport reflow gate where
  applicable;
- `prefers-reduced-motion: reduce`, coarse pointer, keyboard-only and forced
  colors on representative compact and wide rows.

At every row and tested state:

```text
document.documentElement.scrollWidth <=
document.documentElement.clientWidth
```

The assertion must be evaluated after content/fonts settle, after opening and
closing every sheet/dialog, after focusing first and last control, and after
the longest supported Russian copy is rendered.

## Overflow, cards and rails

### Document invariant

- `html`, `body`, page shell, sticky action surface and dialogs may not create
  document-level horizontal scroll.
- Safe-area insets participate in width and padding calculations.
- `100vw` is not used where vertical scrollbar width would overflow the
  document.
- Unbroken IDs, version digests and long translated copy wrap or truncate with
  an accessible full value.
- Fixed/sticky surfaces remain within logical inline bounds at zoom.

### Bounded rail contract

A horizontal rail is allowed only for peer items, never as an accidental
overflow fix. Every rail must have:

- an accessible region name and item count;
- visible clipped-edge/fade cue that does not rely on motion;
- previous/next buttons when fine pointer or keyboard is present;
- native touch/pointer scroll and scroll snapping that can be disabled;
- roving focus or normal DOM order that reveals focused content;
- `scroll-padding` so focus ring is never flush-clipped;
- start/end status available without color alone;
- no auto-advance;
- a non-animated equivalent under reduced motion;
- a «Показать всё» grid/sheet alternative when content is decision-critical.

### Hand decision

TARGET uses a bounded hand rail on compact layouts plus a semantic
«Открыть всю руку» sheet. This preserves card legibility without a very tall
page and provides a complete non-rail alternative. A decorative fan stack is
not the primary interaction because overlapping text and unpredictable focus
order harm scanning and accessibility.

- Up to three cards may switch to a grid when measured width permits.
- Four or more cards use bounded rail on compact layouts.
- Selection is reflected in the persistent action surface and remains visible
  when the card scrolls out of view.
- The full-hand sheet uses the same card/action state, not a divergent local
  copy.
- Wide layouts may use a wrapping grid only when it does not push the action
  surface outside the initial context; otherwise the same rail remains valid.

Opponents use compact wrapping grid/stack by default, not a rail. Encounter
and mandatory choices never hide their only legal action in a rail.

## Responsive compositions

### Compact mobile (`320–599`)

- Turn/context header is sticky at top only if it does not consume more than
  roughly one quarter of short landscape height.
- Encounter/combat comes before own board because it explains the current
  decision.
- Opponents collapse to summary list with a clearly labeled detail sheet.
- Hand is a bounded rail with full-hand sheet.
- Primary server actions live in a bottom action dock above safe-area inset.
- More than two actions become a labeled list/sheet. A single action may remain
  directly exposed only when its order/priority is explicit in a future server
  descriptor; otherwise all projected actions stay in one visible labeled
  list/sheet and the client does not rank them.
- FUTURE interaction sheet appears above the action dock and owns focus.

### Tablet (`600–1023`)

- Portrait uses stacked encounter and player regions; opponent summaries may
  form a two-column grid.
- At content-measured capacity above `767`, encounter and own board may sit in
  two columns.
- Persistent actions remain visible beside or below encounter; they do not
  migrate between unrelated DOM positions during a pending command.
- FUTURE interaction uses bottom sheet in portrait and centered dialog only
  when width and height both support it.

### Desktop (`>1023`)

- Default table is three regions: opponents, encounter/combat, own state.
- Hand occupies a bounded lower region; action surface is persistent next to
  the encounter or lower-right, never beyond capped content width.
- A desktop dialog does not cover the full context needed to answer it;
  background remains visually available but inert.
- Above `1900`, card/text widths are capped and extra space becomes gutters,
  not longer lines or oversized controls.

### Short landscape

- Sticky header and action dock reduce padding before hiding any content.
- Interaction surface may become a side sheet to preserve vertical capacity.
- No sheet relies on `100vh`; use dynamic viewport capacity and safe areas.
- Encounter, mandatory choice and confirmation remain reachable without
  rotating the device.

## Wireflows

### Create and join

```text
Initial form
  → local validation
  → sending (fields retained, submit disabled)
  → server response
      → credential + room accepted → navigate to /game/:id
      → validation/conflict → inline error + focused correction
      → transport failure → durable error + retry
```

«Sending» does not use success copy. Navigation happens only after credential
and server response are accepted.

### Load, reconnect and stale state

```text
Open /game/:id
  → read session credential
      → absent → credential-unavailable recovery
      → present → load projection
          → render projection → connect invalidation stream
          → failed → durable load error + retry

Newer invalidation or suspected gap
  → status: resyncing
  → disable conflicting command submission
  → fetch full actor projection
      → replace state atomically → status: connected
      → fail → retain last confirmed state read-only → offline recovery

Command rejected as stale
  → fetch/accept authoritative projection
  → announce “Состояние изменилось”
  → do not silently replay the old intent
```

### Current turn

```text
Projection arrives
  → identify phase/current actor from projection
  → render available_actions exactly
      → none → waiting explanation
      → one or more → persistent action surface
  → actor chooses valid descriptor inputs
  → sending state
  → command transport accepted
  → wait for command result/new projection
  → render confirmed state delta
```

No optimistic state moves a card, changes strength or closes a phase before
the authoritative update.

### FUTURE generic interaction

```text
Projection contains actor-visible open window
  → add/update item in interaction inbox
  → urgent eligible item opens or highlights decision surface
  → render only server-projected legal responses and deadline
      → choose response/pass
      → sending
      → server accepted command
      → await updated projection
          → still open/changed → replace options
          → closed/resolved → show durable result
          → expired → show timeout/auto-pass outcome
```

Disconnect closes only the local presentation. Reconnect reconstructs inbox,
surface and deadline from projection. The client never opens, extends or
resolves a window locally.

### FUTURE help and reward

```text
Combatant chooses exactly one server-projected legal helper and integer reward
  → server validates helper, reward terms and current window
  → invited helper sees actor-safe offer
      → accept / decline only if projected
  → server closes or updates window
  → accepted helper appears in combat context
  → enforced reward settlement appears as confirmed result
```

Privacy-first presentation does not reveal hidden eligible actors, declined
private choices or reward detail absent from the viewer projection.

### Combat, runaway and result

```text
Combat projection
  → public strengths + confirmed modifiers
  → FUTURE intervention/help windows through inbox
  → server closes legal windows
  → server resolves combat
      → win → confirmed rewards/result
      → lose → server-projected runaway choices
          → response → confirmed escape/consequence
  → next confirmed phase
```

### Victory

```text
Finished projection
  → disable/remove active command surface
  → winner heading + final public summary
  → announce once in polite live region
  → offer navigation/copy game ID only; no invented rematch protocol
```

### Reduced motion

```text
Page loads or preference changes to prefers-reduced-motion: reduce
  → keep the same DOM order, projection and legal actions
  → remove spatial travel, pulse and smooth autoscroll
  → render immediate state plus static border/icon/text cue
  → preserve focus and every live-region announcement
```

Reduced motion changes presentation only. It never changes timer authority,
action availability, interaction ordering or result timing.

## Action and interaction surfaces

### Persistent action dock

- Shows CURRENT/FUTURE server-projected legal actions only.
- Primary label describes intent, not predicted result: «Попытаться
  сбежать», not «Сбежать успешно».
- Pending state is scoped to submitted intent. Unrelated read-only inspection
  remains available.
- If descriptors change during selection, invalid selection is cleared with a
  polite explanation, not submitted against a new action.
- Dangerous/irreversible actions require product-specific confirmation only
  where repeated accidental activation is plausible; generic confirmation for
  every move is prohibited.

### Interaction inbox

- Persistent, compact and reachable before the action dock in keyboard order.
- Sort order is server/domain order; urgency may elevate an eligible expiring
  item but never exposes hidden priority.
- Each item has kind, subject, state and time status in text.
- Opening one item does not discard other windows.
- Closed items leave the active inbox and may appear briefly in a local
  activity summary only if the projection permits it.

### Dialog and sheet

Dialog and bottom sheet are two responsive presentations of one semantic
decision surface.

- `role="dialog"`/native dialog semantics, accessible name and concise
  description are mandatory.
- Initial focus goes to a programmatically focusable heading/static summary
  (for example, `tabindex="-1"` focused on open) or to the first safe control,
  never automatically to a destructive choice.
- Focus is trapped while modal; background is inert.
- On close, focus returns to opener. If opener vanished after resync, focus
  moves to interaction inbox heading; otherwise to turn/context heading.
- Escape closes optional information. Escape does not dismiss a mandatory
  server choice.
- A mandatory choice exposes «Пас» only if the server descriptor permits it.
  If no pass is legal, close affordance is absent and the description explains
  that the server will resolve at deadline.
- Swipe-to-dismiss is prohibited for mandatory choices and never the only
  dismiss mechanism.
- Resizing across a breakpoint preserves focus, selection and interaction
  identity.

### Toast and durable feedback

- Toast is limited to transient, non-decision confirmation.
- Error, offline, stale, expired and result states remain in a durable region.
- Toast never contains the only retry action.
- Maximum one assertive message at a time; repeated realtime updates are
  coalesced.

### Live update strategy

| Update | Semantics | Announcement |
|---|---|---|
| Connection/resync | `role=status`, polite, atomic | On state transition only |
| Command sending | Status associated with action | «Отправляем…» once |
| Projection updated | Polite status | Meaningful delta, not raw version spam |
| Validation/server error | `role=alert` when immediate correction needed | Concise error + next action |
| Window opens | Polite by default; assertive only for short mandatory deadline | Kind, subject and action availability |
| Countdown | Visible text; polite threshold messages | At meaningful thresholds such as 30, 10 and 0, never every second |
| Window closed/expired | Polite durable result | Reason and whether auto-pass/result occurred |
| Victory | Polite once | Winner and finished state |

Status is never encoded by color alone. Icons have adjacent text or accessible
names; decorative icons are hidden from accessibility APIs.

## Timer and authority presentation

- Countdown derives from server-projected absolute deadline and periodically
  re-evaluates against current time, but is advisory.
- `60/30/+10` policy and hard limit belong to the server protocol. UI labels
  the normal/shortened window and renders a new absolute deadline after a
  qualifying late material action only when the actor projection exposes it.
- Client reaching zero disables optimistic submission and requests/resyncs
  authoritative state; it does not close the window locally.
- A response sent near zero remains «Отправляем…» until server result; copy
  does not claim acceptance.
- Background tab, sleep/wake and reconnect immediately recompute display from
  absolute deadline.
- Disconnect never pauses the server clock. If timeout causes server-side
  auto-pass, reconnect renders that confirmed result instead of restoring the
  stale local choice.
- Reduced motion uses a static numeric/text countdown without pulsing.

## Accessibility contract

### Keyboard and focus

- Every action is reachable and operable with keyboard alone.
- Visible `:focus-visible` styling has at least a two-part high-contrast cue
  against dark board and light card surfaces.
- Focus is never removed to `body` after projection replacement.
- Rail navigation reveals focused item without moving document scroll.
- Card selection uses native checkbox/radio semantics or an equivalent
  explicitly tested composite pattern.
- Drag gestures are optional enhancement; all reorder/select/target tasks have
  button/form alternatives.
- Skip links reach game context, interaction inbox and own actions.

### Forms and errors

- Labels remain visible; placeholder is never the only label.
- Error text is connected to fields and announced once.
- On submit failure, user input and focus context remain.
- Target and reward controls expose constraints in text before submission.
- Disabled actions explain why only when that reason is present in the actor
  projection; client does not guess legality.

### Content and perception

- Body text target is at least `1rem`; critical status is not rendered only as
  tiny uppercase metadata.
- Text remains readable at 200% zoom and reflows at narrow effective width.
- Strength deltas include signed text/number, not only red/green.
- Card type/status uses label plus shape/icon; color is secondary.
- Missing card art retains fixed aspect ratio, name, type and useful fallback.
- Forced-colors mode preserves borders, focus, selected state and disabled
  distinction.
- Minimum interactive target is `44 × 44` CSS px unless native platform
  control provides an equally operable hit area.

### Motion and sensory alternatives

- No essential information depends on animation, sound or haptics.
- Sound/haptics are excluded from this version; a future optional layer needs
  user controls and its own plan.
- Flashing above accessibility thresholds is prohibited.
- Autoscroll never steals reading position from a user inspecting history or
  hand.

## Visual direction

### Chosen concept: tactical street table

Развивается гибрид текущего тёмного acid/road motif и тактильной настольной
композиции:

- тёмная нейтральная поверхность задаёт «стол» и отделяет UI chrome;
- бумажные светлые card surfaces дают длинному тексту спокойный фон;
- acid-lime обозначает доступность/active focus, hazard orange — срочность и
  turn context;
- грубые directional marks и компактный monospace metadata поддерживают
  street-sign характер;
- иерархия, сетка и доступность важнее декоративной «грязи».

Нельзя копировать названия, изображения, логотипы, шрифты или trade dress
коммерческого Munchkin. Card art остаётся versioned presentation content.

### Color token family

Значения ниже — design starting palette; implementation обязана проверить
контраст на реальных парах и может скорректировать lightness без смены roles.

| Role | Starting value | Use |
|---|---|---|
| `canvas` | `#11120F` | Browser/page background |
| `board` | `#1B1D18` | Main table |
| `surface` | `#262921` | Panels and compact opponent cards |
| `paper` | `#F3E8CF` | Card text surface |
| `ink` | `#191A17` | Text on paper |
| `text` | `#F5F3EA` | Primary text on dark |
| `text-muted` | `#B8B9AE` | Secondary metadata |
| `acid` | `#C8FF3D` | Available/focus/active accent |
| `hazard` | `#FF8A24` | Turn urgency and countdown threshold |
| `success` | `#38B978` | Confirmed positive result with icon/text |
| `danger` | `#E85D64` | Error/destructive state with icon/text |
| `info` | `#64B5F6` | Connection/resync information |
| `scrim` | `rgb(0 0 0 / 68%)` | Modal separation |

Rules:

- `acid`, `hazard`, `success` and `danger` are never the only status signal.
- Long body copy uses `paper/ink` or `canvas/text`, not saturated accent.
- Disabled content retains readable text and shape; opacity alone is
  insufficient.
- Card rarity/deck kind may not consume action/error color roles.

### Typography

No external font dependency is required.

| Role | Stack / behavior |
|---|---|
| Display | `"Arial Black", "Segoe UI Black", system-ui, sans-serif`; short headings only |
| Body | `system-ui, -apple-system, "Segoe UI", sans-serif`; readable Russian copy |
| Metadata | `ui-monospace, "Cascadia Mono", "Segoe UI Mono", monospace`; IDs/version/status only |

- Body line length target: `45–75ch`; dialog copy narrower.
- Display uppercase is limited to short labels and includes normal-case
  accessible text where pronunciation suffers.
- Type scale is restrained: `0.75rem`, `0.875rem`, `1rem`, `1.25rem`,
  `1.5rem`, `2rem`; fluid sizing may interpolate inside these bounds.
- Numeric combat strength uses tabular figures where available.

### Spacing, shape and elevation

- Spacing family: `4, 8, 12, 16, 24, 32, 48` CSS px.
- Compact controls use `8–12px` internal gap; regions use `16–32px`.
- Radius family: `4px` card detail, `8px` controls, `12px` panels,
  `16px` sheets. Cards keep a sharper tactile silhouette than modal surfaces.
- Borders carry structure on both dark and light surfaces.
- Elevation has three roles only: raised card/control, sticky action dock,
  modal/sheet. Shadows never replace borders/focus.
- Touch safe-area padding is additive to spacing tokens.

### Iconography

- One outlined geometric family, nominal `20px` inline and `24px` primary.
- Icons use `currentColor`, stable viewBox and no embedded commercial marks.
- Primary/mysterious domain actions retain text labels; icon-only buttons are
  limited to conventional dismiss/expand controls with accessible names.
- Deck/door/treasure shapes remain understandable without their color.

### Motion tokens

| Token | Duration | Use |
|---|---:|---|
| `instant` | `0–80ms` | Press/focus feedback |
| `quick` | `140ms` | Disclosure, hover, small status |
| `standard` | `220ms` | Card relocation after confirmed projection |
| `context` | `320ms` max | Phase/sheet transition |

Default easing is decelerating for entry and accelerating for exit. Repeated
actions use `instant/quick`; no high-frequency loop uses `context`.

## Motion map

| Domain change | Normal motion | Static cue | Reduced-motion equivalent |
|---|---|---|---|
| Intent sending | Button progress/label, no card relocation | «Отправляем…» | Label only |
| Confirmed card play | Short source-to-destination emphasis after projection | Card appears in destination + result text | Immediate state + brief border highlight |
| Intervention received | Inbox badge/change highlight | New labeled inbox item | Immediate badge/text |
| Combat strength delta | Number crossfade/short directional tick | Signed delta and new total | Immediate number + border/text cue |
| Phase/window transition | Context panel crossfade/slide | Heading and status change | Immediate replacement + focus preservation |
| Help accepted | Helper summary joins combat region | «Помощь принята» result | Immediate result |
| Offer declined | Surface closes after confirmed result | «Предложение отклонено» | Immediate result |
| Window expired | No celebratory motion; short status emphasis | «Время вышло» + server result | Static message |
| Runaway result | Confirmed result emphasis | Success/failure text + consequence | Static message |
| Victory | One restrained context transition | Winner heading and final summary | Immediate final state |

All motion is interruptible by a newer projection. An animation never delays
rendering or access to the server result. Pending motion is visually distinct
from confirmed-state motion.

## UX writing contract

### Four server stages

| Stage | Good copy | Prohibited implication |
|---|---|---|
| Local intent being sent | «Отправляем действие…» | «Действие выполнено» |
| Command accepted by endpoint | «Ответ принят сервером» | «Помощник уже вступил в бой» |
| Projection updated | «Состояние игры обновлено» plus meaningful delta | Raw `v17` as sole explanation |
| Window closed/expired | «Окно закрыто» / «Время вышло: сервер применил пас» | «Мы закрыли окно» |

### Labels and messages

| Situation | Recommended copy |
|---|---|
| Waiting turn | «Ходит {name}: {phase label}» |
| No legal action | «Сейчас от вас не требуется действие» |
| Resync | «Обновляем состояние с сервера…» |
| Offline | «Нет связи. Показано последнее подтверждённое состояние.» |
| Retry | «Повторить подключение» |
| Stale | «Состояние уже изменилось. Проверьте доступные действия.» |
| Interaction opens | «Нужен ваш ответ: {subject}» |
| Pass | «Пас» |
| Deadline | «Ответ до {absolute/localized time} · осталось примерно {duration}» |
| Sending near deadline | «Отправляем ответ. Сервер подтвердит, успел ли он вовремя.» |
| Expired | «Время вышло. Обновляем результат с сервера.» |
| Error | «Не удалось отправить действие. Состояние обновлено; попробуйте снова.» |
| Victory | «Побеждает {name}» |

Phase/action identifiers from the wire contract are mapped to localized
product labels. Raw enum, player ID, digest or internal error is supplementary
developer metadata, not primary user copy.

## Component and surface inventory

Names are conceptual product responsibilities, not mandated file/component
names.

| Surface | Responsibility | Current / future |
|---|---|---|
| Page shell | Safe viewport, skip links, global status | CURRENT shell needs TARGET hardening |
| Lobby entry | Create/join flows and recovery | CURRENT |
| Game context header | Room/status/turn/phase/connection | CURRENT split metadata needs consolidation |
| Player roster | 1–6 public summaries | CURRENT |
| Encounter/combat board | Encounter, strengths, confirmed results | CURRENT |
| Own board | Equipment, traits, carried/public state | CURRENT |
| Hand browser | Bounded rail/grid/full-hand sheet | CURRENT rail → TARGET pattern |
| Action dock | Legal actions and pending state | CURRENT inline rail → TARGET persistent surface |
| Interaction inbox | FUTURE actor-visible windows | FUTURE generic windows |
| Interaction decision | Dialog/sheet and eligible response form | FUTURE generic windows |
| Countdown/status | Absolute/updated deadline and expired result | FUTURE |
| Help/reward offer | Fixed helper, offer and accept/decline | FUTURE after generic windows |
| Live region | Connection, updates, errors and results | TARGET |
| Toast/activity summary | Optional transient feedback | TARGET |
| Victory summary | Finished state | CURRENT contract / TARGET polish |

## Representative fixtures

Future visual/a11y tests require deterministic actor projections, not manual
click paths or production secrets.

Minimum fixture set:

1. lobby with one player;
2. lobby with six long Russian player names;
3. setup actor with eight cards and at least five actions;
4. setup waiting actor with eight cards;
5. preparation with dense own board;
6. door encounter with missing card art and long rules text;
7. CURRENT combat with one monster and positive/negative confirmed modifiers;
8. runaway mandatory choice;
9. targetable effect with long option labels;
10. CURRENT charity with maximum hand and self-discard choice;
11. FUTURE charity with player recipients/transfers;
12. offline with last confirmed projection;
13. stale command recovery;
14. FUTURE combat with additional monsters and a helper;
15. FUTURE inbox with simultaneous windows;
16. FUTURE opaque window without sensitive responder detail;
17. FUTURE help offer, accepted, declined and expired;
18. finished game/victory;
19. reduced-motion copy of motion-heavy states;
20. forced-colors and 200% zoom snapshots.

Fixtures must use stable original content IDs/text and actor-specific views.
They may not include another player’s hidden hand, credential, deck order or
RNG internals.

Visual regression should use repository-pinned browser/font environment or
crop/assert layout regions that do not depend on platform font rasterization.
Snapshot portability policy belongs to the tooling implementation plan.

## Verification protocol

### Per-state assertions

For each representative state:

- projection decodes through current/future strict Zod schema;
- only actor-visible fields appear;
- primary context and action are visible at initial scroll position;
- document has no horizontal overflow;
- every bounded overflow belongs to an explicitly labeled rail;
- first/last focusable controls remain visible;
- dialog/sheet open, trap, resize, close and return focus correctly;
- status/error updates are announced once and remain readable;
- longest Russian text and missing image preserve layout;
- reduced motion retains every state cue;
- 1–6 player density and safe-area/short-height cases remain operable.

The evidence volume is intentionally two-tiered:

1. the complete `N-1 / N / N+1` boundary matrix runs for the six-player
   long-copy fixture, multi-action hand and open sheet/dialog;
2. every remaining fixture runs at least at `320 × 568`, `427 × 926`,
   `768 × 1024`, `1024 × 768`, `1440 × 900` and `1920 × 1080`.

Offline, stale/error, mandatory interaction, timeout/expired, victory and
reduced-motion fixtures must be present in the second tier. Short landscape,
zoom, coarse pointer and forced-colors rows from the viewport matrix are
additional cross-cutting gates, not substitutes for either tier.

### Automation boundary

CURRENT repository has unit tests but no Playwright/Cypress/axe/visual
regression dependency. This spec does not install one. A future plan must
select and pin browser/axe/snapshot tooling, add deterministic fixtures and
define CI platform policy before claiming automated browser coverage.

Until then, implementation completion requires recorded manual browser
evidence for the exact viewport/state matrix plus existing lint/typecheck/test/
build gates from `FRONTEND_ENGINEERING_SPEC.md`.

### Review lenses

The external
[`jakubkrehel/skills`](https://github.com/jakubkrehel/skills/tree/main)
collection was evaluated as an optional second-pass checklist. On 2026-07-30
its public tree exposed coordinator `better-interface` and six owners:
`better-ui`, `better-typography`, `better-colors`,
`better-accessibility`, `better-layout`, `better-writing`.

The collection was not installed or repository-pinned, so its full external
pass was **not run** and does not block completion. Repository review covers
the same domains explicitly:

| External lens | Repository-owned evidence in this spec |
|---|---|
| UI polish | visual direction, hierarchy, surfaces, density |
| Typography | stacks, scale, line length, numeric display |
| Colors | semantic palette, contrast gate, non-color status |
| Accessibility | focus, dialog, live regions, zoom, forced colors |
| Layout | breakpoints, regions, overflow, viewport matrix |
| Writing | four server stages, labels, timeout/error copy |

If a future session installs/pins this collection, `better-interface` must be
run with all six owner skills. Findings remain advisory and are accepted only
after checking repository authority, privacy and browser evidence.

## Implementation slices

Each slice needs its own approved plan and canonical verification.

1. **Deterministic UI fixtures and audit harness.** Add representative
   actor-specific projections, viewport assertions and selected browser/axe
   tooling. No product redesign hidden inside test setup.
2. **Safe shell and breakpoint foundation.** Remove 320 document overflow,
   add Munchkin-owned boundaries, safe-area/dynamic viewport handling,
   focus-visible and reduced-motion foundations.
3. **Responsive lobby and table regions.** Implement mobile/tablet/desktop
   composition, 1–6 opponent density and stable context hierarchy.
4. **Hand and persistent actions.** Replace accidental rails with bounded hand
   pattern/full-hand sheet and persistent action dock; verify keyboard/touch.
5. **Generic interaction windows.** After backend descriptor contract, add
   inbox, dialog/sheet, countdown, reconnect reconstruction, live regions and
   pass/expired states.
6. **Combat intervention and help/reward.** Consume generic windows for the
   first domain slice; preserve fixed helper and server-enforced reward.
7. **Motion and visual polish.** Add confirmed-delta motion map, tokenized
   visual direction and static/reduced equivalents.
8. **Expanded state coverage.** Run complete phase, error, stale, offline,
   timeout, victory, zoom, forced-colors and density matrix in CI/manual gates
   selected by the tooling plan.

Generic windows precede combat/help so domain UI cannot create a one-off
modal/timer protocol.

## Resolved design questions

| Question | Decision | Why |
|---|---|---|
| Visual direction | Hybrid tactical street table | Preserves recognizable current acid/road character while improving long-form card readability and tabletop hierarchy |
| Compact hand | Bounded rail + full-hand sheet; small-count grid allowed | Keeps cards readable, gives keyboard/non-rail alternative, avoids inaccessible decorative fan |
| Sound/haptics | Out of scope, optional future layer | No essential feedback may depend on device sensory features |
| Visual fixtures | Deterministic actor projections listed above | Reproducible dense/error/future states without private data or manual RNG |
| Font noise | System stacks plus pinned test runtime/cropped structural assertions | No runtime font dependency; explicit future snapshot policy |
| External skills | Read-only evaluation only; not installed in this plan | Optional review does not override repository contracts or expand docs-only scope |

## Explicit non-goals

- No Vue, CSS, TypeScript/Zod, backend, content, dependency, asset or Compose
  change is made by this specification.
- No local derivation of legal actions, timers, eligible responders or hidden
  outcomes.
- No redesign of Card Studio/admin surfaces.
- No copied commercial content, art, logo, font or trade dress.
- No claim that FUTURE interaction protocol is implemented.
- No claim that source inspection or a successful build proves browser UX.

## Definition of done for future UI implementations

A player-facing implementation conforming to this spec is complete only when:

- the relevant CURRENT/TARGET/FUTURE boundary is documented accurately;
- actor-specific server descriptors are the sole action authority;
- complete viewport/state evidence has no document overflow or clipped control;
- bounded rails satisfy navigation/affordance/full-view rules;
- keyboard, focus, dialog/sheet, live updates, zoom and reduced motion pass;
- 1–6 players, long Russian copy and missing art remain readable;
- pending/accepted/updated/closed copy is semantically correct;
- canonical repository checks and the implementation plan’s browser gates pass.
