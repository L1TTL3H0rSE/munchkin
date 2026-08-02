# Frontend engineering specification

- **Статус:** normative
- **Область:** `frontend/`
- **Последний source audit:** 2026-07-30
- **Runtime:** Nuxt 4, Vue 3, Pinia, TypeScript, Zod, pnpm

## Как читать документ

Этот документ задаёт инженерные правила Munchkin frontend. Он не заменяет
исполняемые manifests, schemas, tests, ближайший `frontend/AGENTS.md` и
backend contracts. При конфликте действуют источники истины из
`docs/agents/README.md`.

Формулировки «обязательно», «запрещено» и «только» нормативны.
«Рекомендуется» допускает другое решение, если причина и проверка записаны в
согласованном plan. Блоки «Почему» и «Пример» объясняют правило, но сами не
создают новый контракт. Раздел `Audit snapshot` датирован и описывает
наблюдаемое состояние, а не вечную норму.

Product UI/UX, конкретные screen layouts, visual direction и interaction
wireflows принадлежат отдельной `GAME_UI_UX_SPEC.md`. Этот документ определяет
как размещать, типизировать, стилизовать и проверять их реализацию.

## Источники и граница заимствования

Спецификация основана на:

1. текущих Munchkin manifests, contracts, source и tests;
2. authority/privacy/replay решениях Munchkin;
3. read-only аудите повторяемых frontend-паттернов Digiversity;
4. выявленных legacy-дефектах обоих codebase, которые нельзя превращать в
   стандарт.

Digiversity является source context, но не dependency и не автоматически
«правильным» эталоном.

### Переносим

- разделение deployable application, wire contracts и app-local adapters;
- strict TypeScript и проверку `unknown` на transport boundary;
- real/mock implementations за одним typed interface и выбор в composition
  root;
- component-owned styles, design tokens и именованные responsive boundaries;
- capability-aware interaction через `hover`, `pointer`, keyboard и viewport;
- единые lint/typecheck/test/build gates.

### Не переносим

- monorepo/submodule topology и package decomposition ради сходства;
- `@digiversity/*`, private components, SCSS, theme, fonts, icons и assets;
- product-specific visual language либо selector names;
- legacy `any`, широкие assertions, clickable `div`, raw pixel breakpoints,
  unscoped global selectors и монолитные компоненты;
- правило только потому, что оно встречается в одном live-файле.

Munchkin самостоятельно владеет каждым правилом, token name и future
dependency. Копирование исходного package/theme запрещено.

## Workspace и ownership

Frontend остаётся одним pnpm workspace:

```text
frontend/
  applications/
    web/                  # Nuxt application и Nitro Card Studio boundary
  packages/
    contracts/            # public HTTP/realtime/Studio wire schemas
  pnpm-workspace.yaml     # catalog и workspace packages
  pnpm-lock.yaml          # единственный frontend lockfile
```

### Placement matrix

| Артефакт | Владелец | Не размещать |
|---|---|---|
| HTTP/realtime request и response schema | `packages/contracts` | page/component |
| DTO-derived public TypeScript type | рядом со schema через `z.infer` | вручную дублированный interface |
| Route composition, route params, top-level SEO | `app/pages` | generic component |
| Повторяемый visual surface | `app/components/<feature>` | page template copy |
| Headless feature state/lifecycle | `app/composables` либо feature-local composable | global singleton без причины |
| Pure mapping/validation/view model | feature-local `.ts` module | Vue lifecycle callback |
| Cross-route client state | Pinia store только после доказанного shared ownership | store «на всякий случай» |
| Browser credential persistence | выбранный session adapter | URL, Pinia devtools, logs |
| External HTTP/SSE transport | typed adapter/composable | scattered `$fetch` в components |
| Nitro-only secret/provider/filesystem logic | `server/` | public runtime config или client bundle |
| Deterministic fixture/mock | рядом с adapter/test support | условные fake branches во всех consumers |
| Global reset, tokens, shared primitives | `app/assets` | произвольные page selectors |
| Component styles | компонент/feature, scoped по умолчанию | растущий общий stylesheet |

Новый package создаётся только при реальной independent ownership boundary:
несколько consumers, отдельный public contract и собственные checks. Размер
каталога сам по себе не является причиной.

### Composition root

Выбор real/mock adapter, runtime config и provider wiring выполняется один раз
на plugin/page/server composition boundary. Feature code зависит от typed
interface, а не проверяет `if (mock)` в каждом request.

Typed mock обязан:

- реализовывать тот же interface и возвращать те же parsed public types;
- моделировать loading, empty, success, expected failures и races;
- не добавлять полей, которых нет в production contract;
- не считаться cross-layer E2E доказательством.

## Authority, contracts и privacy

### Transport boundary

Любой network/storage payload сначала имеет тип `unknown`, затем проходит
Zod/type guard. Только parsed value попадает в feature state.

- Wire schemas являются `.strict()`, если forward-compatible envelope явно не
  согласован.
- Неизвестный action/effect/event не применяется локально. UI показывает
  recoverable protocol/resync state.
- Contract type выводится из schema; параллельный handwritten DTO запрещён.
- API adapter возвращает domain-safe result либо классифицированную ошибку, а
  не сырой framework response.
- URL path/query строятся только из allowlisted/encoded значений.

При изменении wire contract нужны:

1. schema positive fixtures;
2. unknown/private-field negative fixtures;
3. Go-produced либо versioned backend HTTP fixture;
4. проверка реального frontend consumer;
5. migration/compatibility решение, если старый server/client возможен.

### Server authority

Клиент отправляет intent и никогда не выбирает:

- actor/player ID как authority;
- RNG result, deck position или итог правила;
- чужой hidden card/option;
- завершение или продление server interaction window;
- новую authoritative version.

UI рендерит server-supplied `available_actions` и разрешённые options. Local
validation улучшает UX, но server остаётся единственной security/rules
границей. Optimistic UI может показывать только pending intent; он не меняет
authoritative cards, combat result, reward либо timer outcome.

Каждая mutation использует:

- current `expected_version`;
- random `command_id`/`Idempotency-Key`;
- один и тот же ID при network retry того же intent;
- новый ID для нового пользовательского действия;
- closed payload, содержащий только server-permitted identifiers.

### Actor-specific projection

Internal backend state никогда не является frontend model. Обязательно
сохраняются границы:

- actor видит свою руку и свои решения;
- другой игрок представлен только public zones/stats и `hand_count`;
- deck order, RNG, credential hashes, raw events и snapshots отсутствуют;
- version-only realtime channel не содержит state;
- display code не пытается восстановить hidden state из counts/timing.

Credential хранится только выбранным local session adapter:

- bearer header, не URL/query;
- не analytics, error copy, logs, SSR payload или persistent Pinia state;
- не public runtime config;
- clear/redirect при terminal auth failure.

### Realtime и resync

Realtime — best-effort invalidation hint:

```text
strict invalidation envelope
  -> compare version
  -> coalesce refresh requests
  -> GET actor-specific projection
  -> replace only with monotonic version
```

После reconnect, version gap, invalid envelope, stream end или publish gap
выполняется fresh `GET`. Клиент не применяет event payload как reducer.

Обязательные свойства:

- один owner stream на game session;
- `AbortController`/unsubscribe при route change и unmount;
- reconnect не создаёт два stream;
- bounded exponential backoff с jitter и retry ceiling;
- terminal auth/protocol error не зацикливается как transient offline;
- invalidation во время in-flight refresh вызывает дополнительный drain;
- stale response не заменяет более новую projection;
- reconnect state видим пользователю и доступен assistive technology.

## State ownership

Выбирается наименьший достаточный owner:

| Состояние | Owner |
|---|---|
| input, раскрытие, локальный selection | component `ref` |
| feature lifecycle в одной route | feature composable |
| navigable filters/selection | route/query |
| server projection | session/composable, без дублирования в components |
| shared cross-route client workflow | Pinia store |
| credential | session adapter |
| immutable wire schema/type | contracts package |

Pinia не является default. Store вводится, когда состояние действительно
делят несколько routes/surfaces либо нужен независимый lifecycle. Server state
не копируется в несколько writable stores.

Derived data оформляется `computed` либо pure function. Не сохраняй то, что
можно детерминированно вычислить из projection. Watcher допустим для
синхронизации внешнего lifecycle, но не как скрытый reducer.

## Async lifecycle и ошибки

### State model

Каждый async surface явно различает применимые состояния:

```text
idle | loading | success | empty | error | offline | retrying | stale
```

Один `busy: boolean` допустим только для одного невзаимозаменяемого request.
Параллельные operations получают отдельные states либо keyed pending map.

### Error taxonomy

Transport adapter нормализует ошибки минимум в:

| Kind | Типичная реакция |
|---|---|
| `auth` | clear credential, безопасный redirect/login |
| `validation` | field/action feedback, без blind retry |
| `conflict` / `stale_version` | resync, затем новое явное intent |
| `not_found` | stable empty/not-found route |
| `offline` / `transient` | bounded retry и offline status |
| `protocol` | fail closed, resync/report incompatible client |
| `unexpected` | safe generic copy и diagnostic correlation |

Raw backend/framework `Error.message` не является UX contract. User copy не
содержит token, request body, raw provider response, filesystem path или
private state. Diagnostic cause можно сохранить только в безопасном
server/dev channel.

### Cancellation и race safety

Любой request, timer, listener, stream, object URL и polling loop имеет owner и
cleanup.

- Fetch/composable принимает `AbortSignal`, если operation может пережить
  route/component.
- Unmount запрещает late result менять state.
- Search/filter requests используют cancel либо generation token.
- Polling имеет abortable delay, deadline/attempt limit и terminal states.
- Object URLs вызывают `URL.revokeObjectURL`.
- Retry не дублирует mutation и не продлевает server deadline локально.
- `finally` освобождает только тот pending state, которым владеет operation.

## TypeScript contract

Текущие `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` и `forceConsistentCasingInFileNames` обязательны.
Ослабление требует отдельного plan и доказанного incompatible dependency.

### Types

- `any` в production/test code запрещён. Используй `unknown` и narrowing.
- Assertion `as T` допустим только в узком adapter/test boundary после
  проверяемого invariant. Комментарий объясняет invariant, если он не очевиден.
- DOM target проверяется через `instanceof`, template ref либо typed handler,
  а не широким cast.
- Literal preservation использует `satisfies` или `as const`, не assertion
  сложного object type.
- Non-null `!` допустим только когда lifecycle/type guard механически
  гарантирует значение.
- Exhaustive union обрабатывается `switch` с `never` guard.
- Public function имеет выводимый либо явный return type, достаточный для
  стабильного contract; exported boundary не протекает framework internals.

### Imports

Порядок:

1. platform/external packages;
2. workspace packages и Nuxt aliases;
3. feature-relative modules;
4. type-only imports через `import type`.

Запрещены deep import чужого package, circular feature imports и barrel,
скрывающий ownership. Большой общий barrel разделяется по domain, когда его
изменения регулярно затрагивают несвязанные contracts.

### Naming

| Сущность | Правило | Пример |
|---|---|---|
| Vue component | PascalCase file/export | `ActionPanel.vue` |
| Route page | Nuxt route convention | `game/[id].vue` |
| Composable | `use` + PascalCase concept | `useGameSession` |
| Pinia store | `use...Store` | `useLobbyStore` |
| Pure module | camelCase concept | `actionModel.ts` |
| Zod schema | camelCase + `Schema` | `projectionSchema` |
| Type/interface | PascalCase | `ActionDescriptor` |
| Boolean | `is/has/can/should` | `isOffline` |
| Pure function | domain verb/result, без generic `process` | `mapAvailableActions` |
| Command/side effect | imperative domain verb | `submitAction` |
| Event handler | `handle...` либо semantic verb | `handleSubmit` |
| ID | repository spelling `ID` | `gameID`, `setID` |
| Test | subject + `.test.ts` | `realtimeResync.test.ts` |

Имя описывает domain intent, а не HTML/implementation detail. Избегай
`data`, `item`, `handler`, `utils`, если scope не делает значение однозначным.

### Formatting

До появления repository-owned formatter новые/изменённые участки следуют
стабильному contract:

- double quotes;
- semicolons;
- trailing comma в multiline;
- ориентир 80 columns без ухудшения читаемости;
- один Vue attribute на строку для multiline tag;
- braces у object/control-flow, без скрытых side effects;
- unrelated file reformat не смешивается с feature change.

Formatting config вводится отдельным plan; документ не выдаёт ручное
соглашение за уже enforced lint rule.

## Vue и Nuxt

### Component responsibilities

Используй `<script setup lang="ts">` и Composition API. Options API либо
class-style component требует interop-причины.

Page отвечает за:

- route params/query и route-level loading/not-found;
- composition feature surfaces;
- page metadata;
- создание/закрытие route-scoped session.

Layout отвечает только за persistent shell, landmarks и cross-route
navigation. Layout не владеет feature transport/state и не создаёт второй
`main` внутри app-level `main`; ровно один owner задаёт основной landmark.

Page не должен одновременно владеть transport parsing, reconnect algorithm,
большой view model и всей разметкой. Выделяй responsibility, когда её можно
назвать и независимо проверить:

- API/session controller;
- pure projection-to-view model;
- action/interaction surface;
- reconnect/offline state;
- large form/editor section.

Line count — сигнал review, не автоматическая граница. Компонент около
250–300 строк требует явной проверки responsibilities; split без cohesive
owner также запрещён.

### Props, emits и models

- Props и emits полностью typed.
- Prop readonly; child не мутирует object/array parent.
- Event name описывает intent/result, payload минимален и typed.
- `defineModel` используется только для настоящего two-way form control, не
  для server state.
- Provide/inject имеет typed key и ограниченный subtree owner.
- Slot получает минимальный typed surface.
- `v-for` key стабилен по domain ID; array index допустим только для immutable
  static presentation.

Component либо является controlled presentation, либо документирует owned
local state. Смешивать оба режима неявно нельзя.

### Side effects и SSR

- Browser API защищён `import.meta.client` либо client lifecycle.
- Server secret/provider/filesystem import не попадает в app bundle.
- `useRuntimeConfig().public` содержит только публичные значения.
- Side effect запускается из названного lifecycle/composable, имеет cleanup и
  тестируемый adapter.
- `watch` не выполняет mutation при initial render без явного `immediate`
  contract.
- Hydration не зависит от случайного/локального browser state.

## Semantic markup и accessibility

### Native first

- Action — `<button>`, navigation — `<a>`/`NuxtLink`, form — `<form>`.
- Clickable `div/span` запрещён.
- Native checkbox/radio/select предпочтительнее custom widget.
- ARIA не заменяет semantic HTML.
- Custom listbox/dialog/tab реализуется только с полным keyboard/focus
  pattern; иначе используй список buttons/links без ложной ARIA role.

### Forms

- Каждый control имеет programmatic label.
- Related controls группируются `fieldset/legend`.
- Required/constraints доступны не только placeholder.
- Field error связан через `aria-describedby`; summary получает focus после
  failed submit, если это улучшает navigation.
- Submit имеет visible pending state и защищён от duplicate intent.
- Disabled используется только когда control действительно недоступен;
  read-only/status объясняет причину.

### Keyboard и focus

- Полный flow доступен без pointer.
- `:focus-visible` заметен на всех interactive elements.
- Focus order следует visual/read order.
- Route/dialog/sheet управляет initial focus, trap, return focus и close
  policy.
- Mandatory server decision нельзя dismiss через Escape/backdrop без
  server-permitted cancel/pass action.
- Dynamic removal не теряет focus в `body`; owner выбирает следующий stable
  target.

### Status и content

- Loading container использует `aria-busy`; короткое сообщение может иметь
  `role="status"`.
- Ошибка, требующая немедленного внимания, получает bounded `role="alert"`.
- Reconnect/offline/result обновления используют продуманную `aria-live`
  стратегию без спама.
- State не кодируется только цветом; нужен text/icon/shape.
- Content image имеет meaningful alt; decorative motif — `aria-hidden`.
- Fallback сохраняет имя/правила карты без изображения.
- Heading hierarchy и landmarks остаются последовательными.
- Touch target ориентируется минимум на 44 CSS px.

## CSS architecture

### Layers и ownership

Рекомендуемая логическая структура:

```text
assets/scss/
  api/              # Munchkin-owned tokens, breakpoints and mixins
  base/             # reset, typography, document defaults, app shell
  pages/            # explicitly isolated compatibility layers
  main.scss         # one global entry with stable import order
component.vue      # component-owned scoped styles
feature/*.scss     # только shared feature primitives с несколькими owners
```

`main.scss` импортирует только `api → base → app shell → compatibility pages`.
SCSS API использует `@use`/`@forward`; скрытый global Sass namespace и
`additionalData` запрещены. Новые styles не должны снова собираться в один
растущий global stylesheet.

Global разрешён для:

- tokens;
- box sizing/reset;
- document typography/background;
- действительно shared layout primitive;
- third-party override с локальной причиной.

Foundation exception: dev-only Card Studio compatibility styles живут в
`assets/scss/pages/_studio.scss`; это preservation layer, а не player UI kit.

Component/page selectors scoped по умолчанию. Deep/global selector требует
комментария о внешнем owner. Element selectors вне reset/base запрещены, если
они меняют поведение несвязанных surfaces.

### Tokens

Новые repeated values получают semantic families:

```text
--color-*
--font-*
--space-*
--size-*
--radius-*
--shadow-*
--duration-*
--easing-*
--z-*
```

Token называется по роли (`--color-text-muted`), а не по literal
(`--gray-300`), если literal не является осознанной palette primitive.
Component-specific token объявляется у block root, не в `:root`.

Нельзя импортировать Digiversity tokens/theme. Числовое source значение
становится Munchkin-owned только после записи локальной семантики и tests.

### Selectors

Используй BEM-like ownership:

```text
.game-table
.game-table__actions
.game-table__actions--offline
```

Допустим `data-state` для finite state. Запрещены:

- selector по DOM depth;
- styling через generated Vue attributes;
- generic `.active`, `.error`, `.card` вне scoped owner;
- `!important`, кроме изолированного documented override;
- inline style для static design.

Dynamic numeric presentation передаётся validated CSS custom property.

### Units и layout

- `rem`/unitless для typography и spacing;
- `ch` для readable text width;
- `%`, `fr`, `minmax(0, 1fr)`, `clamp()` для fluid layout;
- `px` для 1px borders, raster constraints и canonical breakpoint boundary;
- `min-width: 0` у flex/grid child с потенциально длинным content;
- intrinsic sizes и wrapping вместо magic fixed width.

Document-level horizontal overflow запрещён. Перед `overflow-x: auto` проверь:

1. может ли layout перейти в grid/stack/wrap;
2. виден ли affordance продолжения;
3. доступен ли rail keyboard/touch;
4. не обрезается ли focused element;
5. существует ли reduced-motion/static equivalent.

Scrollable region получает понятный owner и не прячет critical action.

Z-index использует короткую semantic scale, а component не создаёт stacking
context случайным `transform/filter/isolation`. Sticky/fixed element учитывает
safe area и keyboard viewport.

### Motion

- Motion объясняет state delta, а не заменяет его.
- Предпочтительны `transform` и `opacity`.
- Animation interruptible; repeated realtime action не накапливает queue.
- Authoritative result показывается только после server response/projection.
- `prefers-reduced-motion: reduce` убирает spatial/nonessential motion и
  сохраняет static cue.
- Essential timer/decision никогда не передаётся только анимацией.

## Responsive contract

### Mobile-first

Default CSS обязан работать на 320 CSS px без media query. Последующие
queries улучшают layout по content pressure. Device names являются именами
boundaries, а не предположением о конкретном устройстве.

Canonical Munchkin boundaries:

| Token | Boundary | Проверка при использовании |
|---|---:|---|
| `mobile` | 374 px | 373 / 374 / 375 px |
| `mobile_large` | 427 px | 426 / 427 / 428 px |
| `tablet_small` | 599 px | 598 / 599 / 600 px |
| `tablet` | 767 px | 766 / 767 / 768 px |
| `tablet_large` | 1023 px | 1022 / 1023 / 1024 px |
| `laptop` | 1279 px | 1278 / 1279 / 1280 px |
| `desktop` | 1439 px | 1438 / 1439 / 1440 px |
| `desktop_large` | 1900 px | 1899 / 1900 / 1901 px |

Boundary означает inclusive `down`: `max-width: Npx`. Следующий mobile-first
range начинается с `N + 1px`. Например, `mobile` заканчивается на `374px`, а
следующий range начинается на `375px`. Нельзя одновременно трактовать одно
значение как inclusive min и max. Future token implementation обязана
генерировать/проверять обе стороны из одного Munchkin-owned source.

Компонент не обязан переключаться на каждом token. Query добавляется только
там, где content/layout перестаёт выполнять contract.

### Capabilities и viewport

- Hover-only action запрещён; используй
  `(hover: hover) and (pointer: fine)` только как enhancement.
- Touch/keyboard имеют равный доступ к content/action.
- Full-height shell использует modern `dvh` с безопасным fallback.
- Fixed/sticky controls учитывают `env(safe-area-inset-*)`.
- Virtual keyboard не закрывает active field/submit.
- 200% zoom и enlarged text не создают two-dimensional page scroll.

Минимальная verification matrix:

| Class | Viewports |
|---|---|
| full-support mobile | 360×640, 390×844, 427×926 |
| safety-only mobile | 320×568, short-height and phone landscape |
| boundary entry | 375×667, 428×926 |
| large mobile | 390×844, 427×926 |
| tablet | 599×960, 768×1024, 1024×768 |
| laptop/desktop | 1280×720, 1440×900, 1900×1080 |
| narrow landscape | 667×375 |

Для каждого реально используемого boundary проверяются `N-1`, `N`, `N+1`.
На critical states:

```text
document.documentElement.scrollWidth <=
document.documentElement.clientWidth
```

Также проверяются clipping, focus visibility, sticky overlap, long Russian
copy, empty/error/offline state и 1–6 players. Отдельно проверяются
keyboard-only flow, coarse touch, fine hover и reduced-motion.

## Testing strategy

| Изменение | Минимальное доказательство |
|---|---|
| schema/wire type | positive + privacy/unknown negative fixtures |
| pure mapper/view model | focused unit tests |
| API/realtime adapter | parsed fixture, error mapping, abort/race/retry test |
| composable/store | lifecycle + concurrency tests |
| component/form | user-visible state and keyboard interaction test |
| route flow | browser-to-real-boundary E2E либо явно scoped fake |
| layout/style | viewport overflow/focus/reduced-motion browser evidence |
| visual token/surface | stable visual regression strategy |

Snapshot не заменяет semantic assertions. Frontend fixture не называется E2E,
если browser не проходит реальный HTTP/application boundary.

### Canonical gates

Из `frontend/`:

```bash
pnpm lint
pnpm check
pnpm build
```

`./leinoctl verify --paths <changed-path>` вычисляет реальный consumer graph и
остаётся canonical repository gate. Contract change дополнительно сверяет
backend fixture и реального consumer.

Browser/a11y/visual tooling добавляется отдельным implementation plan, если
dependency отсутствует. До этого manual evidence записывается честно и не
выдаётся за автоматизированный regression gate.

## Review gates

Reviewer проверяет:

1. ownership и отсутствие дублированного wire/server state;
2. authority/privacy и credential boundary;
3. parsing `unknown`, error taxonomy и recovery;
4. cancellation, cleanup, retry/idempotency и races;
5. Vue responsibility/props/emits/key/SSR;
6. semantic markup, keyboard, focus и live status;
7. token/style ownership, overflow и responsive boundaries;
8. tests по изменённому риску, а не только happy path;
9. отсутствие новой external/theme dependency;
10. exact `leinoctl` impact и clean diff.

## Definition of Done

Copy-ready checklist для любого frontend change:

```markdown
- [ ] Exact plan approved/selected; write set и contracts актуальны.
- [ ] Code размещён у правильного owner; new package/store обоснован.
- [ ] Wire data parsed from unknown; schemas/types не дублируются.
- [ ] Client отправляет intent и не вычисляет authoritative/private state.
- [ ] Credential/secrets не попадают в URL, logs, UI errors или public config.
- [ ] Loading/empty/error/offline/stale/disabled states определены.
- [ ] Async operations имеют cancellation, cleanup и race policy.
- [ ] Props/emits/models/keys typed; assertions узкие и проверяемые; any нет.
- [ ] Markup semantic; keyboard/focus/ARIA и non-color status проверены.
- [ ] Styles принадлежат component/feature; tokens semantic; overflow bounded.
- [ ] Relevant N-1/N/N+1 viewports and canonical `360×640`/`1440×900` are
  checked; unsupported `320px` fallback preserves action, focus and privacy.
- [ ] Reduced motion, long Russian copy и 200% zoom имеют usable equivalent.
- [ ] Unit/contract/integration/browser evidence соответствует риску.
- [ ] pnpm lint, pnpm check, pnpm build и leinoctl verify прошли.
- [ ] Diff review не содержит unrelated formatting/generated/manual edits.
```

## Audit snapshot — 2026-08-02

Этот раздел нужно перепроверять перед refactor. Он не доказывает текущее
состояние после будущих commits.

### Сильные стороны Munchkin

- Один pnpm workspace, catalog versions и `workspace:*`.
- TypeScript включает `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`.
- Closed Zod contracts различают self/other-player projections и отклоняют
  internal/private fields.
- UI отправляет server-supplied actions с expected version/idempotency.
- Realtime переносит только version invalidation; coalescing resync имеет
  focused tests.
- SSE cleanup, reconnect timer cleanup и Studio object URL cleanup уже
  присутствуют.
- Action mapping/reconciliation вынесены в pure `actionModel.ts`.
- Card Studio имеет typed client/server/provider boundary и deterministic fake.
- Forms/buttons, card alt/fallback и основные landmarks используют semantic
  HTML.
- One `main.scss` entry now owns the semantic token/reset/app-shell layers;
  Card Studio has an explicitly isolated compatibility layer.
- `sass-embedded` is a direct web devDependency resolved by the single
  `frontend/pnpm-lock.yaml`; pinned Chromium/axe/visual harnesses are present
  in the frontend workspace.

### Gap matrix

| Priority | Наблюдение | Нормализованное направление |
|---|---|---|
| P0 | Gameplay `apiErrorSchema` не превращён в typed UX errors; pages показывают `Error.message` | error adapter + recovery taxonomy |
| P0 | Non-stream requests/polling не получают route-owned cancellation | AbortSignal/generation owner |
| P0 | Reconnect использует fixed 1s retry без bounded backoff/terminal classification | retry policy + offline state |
| P0 | Foundation had no focus-visible/reduced-motion/safe-area/dvh contract | resolved by SCSS base layer and focused browser smoke |
| P0 | One raw `720px` query had no boundary source/viewport regression | resolved by Munchkin-owned SCSS breakpoint API and focused browser smoke |
| P0 | App-level `<main>` содержит второй `<main>` Card Studio | один page landmark, Studio как `section` |
| P0 | Loading/error/success/offline transitions не объявлены через live status/`aria-busy` | bounded status/alert/live-region contract |
| P0 | Studio `listbox` не реализует roving focus/arrow-key pattern | native button list либо complete APG pattern |
| P1 | `game/[id].vue` около 333 строк смешивает fetch/SSE/commands/render | game-session composable + feature surfaces |
| P1 | `CardStudioPanel.vue` около 489 строк смешивает form/polling/preview/render | split по independently testable responsibilities |
| P1 | Legacy `main.css` смешивал reset, gameplay, cards и Studio | resolved by SCSS tokens/base/app-shell plus isolated Studio compatibility |
| P1 | Hand/actions/public cards используют rails без полного keyboard/focus/affordance evidence | bounded rail contract или grid/stack |
| P1 | Studio history selection передаётся только CSS class | `aria-current`/`aria-selected` по реальной semantic |
| P1 | Global disabled style всегда показывает wait cursor, смешивая invalid и busy | отдельные disabled и pending contracts |
| P1 | Gameplay не имеет typed mock/data-source и page-level async-state tests | adapter fixtures + component/route tests |
| P1 | Frontend contract fixture handwritten, не backend-produced | cross-layer versioned fixture |
| P2 | Contracts gameplay и Studio живут в одном 366-line barrel | domain split без изменения public semantics |
| P2 | Lint rules кроме generated Nuxt preset и `no-console` неявны | repository-owned lint plan после принятия правил |

### Нормализованный Digiversity comparison

| Область | Полезный repeatable pattern | Что не канонизируем |
|---|---|---|
| Workspace | applications/packages, catalog, internal dependency boundary | submodules и количество packages |
| Contracts | transport/generated API отдельно от app composition | generated stack как обязательный Munchkin выбор |
| Adapters | real/mock source выбирается в composition root | app-specific private providers |
| TypeScript | strict flags, type-only imports, predictable formatting | legacy `any` и broad casts |
| Vue | typed Composition API и headless/shared state | большие legacy components |
| Markup | native controls/forms | clickable non-semantic containers |
| CSS | custom-property tokens, component ownership, responsive helpers | private theme/SCSS/components/fonts |
| Responsive | named boundaries, touch/hover и viewport-height handling | raw one-off pixels и blind query-per-token |

### Backlog slicing

Audit gaps не исправляются этим docs plan. Рекомендуемые независимые
implementation slices:

1. gameplay error/cancellation/reconnect adapter;
2. game-session composable и page/component split;
3. CSS tokens/base/focus/reduced-motion/safe-area foundation;
4. responsive gameplay layout по `GAME_UI_UX_SPEC.md`;
5. typed gameplay fixtures и component/browser/a11y tests;
6. Card Studio form/polling/preview decomposition;
7. contracts domain split и explicit lint/format config.
