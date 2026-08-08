# PLAN: figma closed set playability remediation v2

- **Plan ID:** `20260808T093246Z-e55ac3-figma-closed-set-playability-remediation-v2`
- **Статус:** completed
- **Создан:** 2026-08-08 09:32:46 UTC
- **Обновлён:** 2026-08-08 20:47:00 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** нет
- **Блокирует:** повторное утверждение frontend как playable/Figma-parity complete
- **Связанные ADR/handoff:** —

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/plans/active/20260808T093246Z-e55ac3-figma-closed-set-playability-remediation-v2.md",
    "docs/agents/plans/archive/20260808T093246Z-e55ac3-figma-closed-set-playability-remediation-v2.md",
    "frontend/applications/web/app/assets/scss/api/**",
    "frontend/applications/web/app/assets/scss/base/**",
    "frontend/applications/web/app/assets/scss/pages/_lobby.scss",
    "frontend/applications/web/app/components/GameConnectionStatus.vue",
    "frontend/applications/web/app/components/actionModel.ts",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/lobby/**",
    "frontend/applications/web/app/components/ui/**",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/pages/index.vue",
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/test/**",
    "frontend/playwright.config.ts",
    "frontend/packages/contracts/src/**",
    "frontend/packages/contracts/test/**",
    "frontend/test/browser/**",
    "frontend/test/run-playwright.mjs",
    "backend/game/cmd/server/**",
    "backend/game/internal/application/**",
    "backend/game/internal/game/**",
    "backend/game/internal/transport/httpapi/testdata/**",
    "content/README.md",
    "content/schema/**",
    "content/tools/**",
    "content/sets/moscow/v5/**"
  ],
  "components": [
    "pnpm:@munchkin/web",
    "pnpm:@munchkin/contracts",
    "go:backend/game",
    "game-content"
  ],
  "contracts": [
    "game:http-v1",
    "content:card-set-schema",
    "figma:bmxy6z3Z0bBLHLYryYJYrP-closed-player-ui"
  ],
  "dependsOn": [],
  "sharedResources": [
    "frontend-player-ui",
    "frontend-browser-baselines",
    "game-http-card-view",
    "content-schema-and-digest"
  ]
}
```

## Цель

Удалить оставшуюся legacy/generic player-facing presentation и привести lobby,
весь игровой core loop, карточки, character/equipment и обязательные decision
surfaces к прямым Figma nodes. После реализации игра должна оставаться
полностью проходимой через реальный Nuxt → HTTP Go flow, а layout — непрерывно
играбельным от `360x640` до `1920x1080` на согласованных контрольных ширинах и
между ними. Figma является исчерпывающим визуальным набором: отсутствующий в
ней экран, текст или generic fallback удаляется, а не маскируется новым CSS.

## Lifecycle checkpoint, согласованный 2026-08-08

Пользователь явно остановил полную реализацию и разрешил завершить этот plan как
implementation checkpoint, чтобы освободить lifecycle для отдельной работы над
harness. Статус `completed` ниже означает только сохранённый, проверенный и
переданный checkpoint. Он **не означает** full Figma parity, завершённый visual
audit или полную играбельность.

- [x] Текущий production/test/content/backend diff сохранён без дальнейшей
  фронтенд-реализации.
- [x] Устаревшие fixture expectations синхронизированы с уже сохранённым diff.
- [x] Canonical `./leinoctl verify --changed` прошёл полностью.
- [x] Незавершённые acceptance requirements и reviewer findings перечислены как
  deferred continuation; прямые Figma links сохранены.
- [x] Plan подготовлен к archive, guarded release и локальному commit; push
  запрещён и не выполняется.

## Deferred original acceptance requirements — не выполнены и не заявляются

- [deferred] Lobby, desktop/mobile board states, character/equipment, exact equip,
  fast equip, charity/discard, run-away, reward, interaction и system states
  имеют по одному прямому Figma owner; player-facing legacy/generic branches,
  copy, fixtures, selectors и baselines без Figma owner удалены.
- [deferred] Core loop `setup → preparation → door_choice → combat | run_away |
  resolve_effect → charity → end_turn → next player` проходим двумя реальными
  browser actors через Nuxt и HTTP backend; обязательный discard при hand
  limit действительно открывается и блокирует продолжение до server-confirmed
  resolution.
- [deferred] Run-away больше не открывает generic `InteractionDialog`: выбор монстра,
  бросок, modifiers, success/failure/next-monster и consequence отображаются
  существующими Figma `RunAway` states и только по actor-specific projection.
- [deferred] Encounter Card сохраняет strict `240x400` desktop primitive и compact
  composition, включая отдельный `НЕПОТРЕБСТВО` block. Presentation text
  приходит из versioned content/backend projection; frontend не переводит
  typed effects в русский текст и не разрезает `rules_text` эвристикой.
- [deferred] Exact equip фильтрует только предметы выбранного slot; fast equip
  запускается из выбранной вещи в hand. Mobile использует разные approved
  `360x470`/`360x410` sheets, desktop — `768x502` Cards3 archetype. Нет старой
  full encounter card, generic checkbox list, вертикального scrollbar или
  вне-Figma CTA.
- [deferred] Character/equipment совпадает с direct desktop `940x620` и compact
  `360x470` structures; slot/carried data и state-specific close copy верны,
  а internal placeholder `local` и прочий технический текст отсутствуют.
- [deferred] Lobby не содержит лишней внутренней bordered card вокруг form; формы,
  recovery и disabled/pending states остаются semantic и keyboard-usable.
- [deferred] На `360x640`, ширинах `428`, `600`, `768`, `1024`, `1280`, `1400`,
  `1920` и `N-1/N/N+1` реально используемых границ нет document horizontal
  overflow, clipped/floating critical controls или overlap. На short-height
  rows hand/action/mandatory choice доступны без предположения о высоте 900px;
  compact dock учитывает safe-area и прижат к нижней usable boundary.
- [deferred] Каждый изменённый Figma node проверен live через Figma integration и
  side-by-side с текущим browser screenshot при canonical viewport; visible
  headings/labels/buttons/status/empty/error copy внесены в text ledger.
- [deferred] Baselines разрешено менять только после зафиксированного `pass` по
  соответствующей паре. Затем visual suite повторно проходит без update.
- [deferred] Frontend contract, backend projection, content schema/new immutable pack
  version, privacy, replay, accessibility и browser checks проходят вместе с
  canonical `verify --changed` и `scope-check`.

## Контекст и подтверждённое состояние

- Предыдущий completed plan
  `20260805T000140Z-ef4dda-frontend-gameplay-flow-responsive-figma-remediation`
  закрыл visual ledger семейными `pass`, но новая live проверка 2026-08-08
  доказала, что эти pass неверны: screenshots сравнивались недостаточно
  детально, а green baselines закрепили текущий raster.
- Live Figma + browser side-by-side подтвердил: extra lobby form card; legacy
  run-away dialog; несходные setup/door/post-door/reward compositions; неверные
  exact/fast equip и desktop character sheets; отсутствующий Bad Stuff block;
  charity shell с другой typography/rail; вертикальную деградацию desktop
  layout на `1024x768`/`1280x800`.
- Compact `360/428/600/768` не имеет root horizontal overflow, encounter card
  и dock центрируются. Это сохраняется как regression baseline, но не отменяет
  structural parity gaps.
- `gamePresentationModel.ts` сейчас присваивает node metadata, но
  `GameTable.vue` продолжает рендерить одну generic board composition; node
  attribute не является concrete Figma owner.
- Run-away разделён между generic primary-action path в `GameTable` и
  `run_away_response` внутри `InteractionDialog`; `TargetRunAwaySurface`
  является generic summary. Эта двойная ownership удаляется.
- Catalog содержит 43 named states, но visual suite делает 9 desktop + 7
  mobile screenshots и покрывает только 11 уникальных runtime states.
  `semanticCheck` — неисполняемая строка, а 21 acceptance reference не
  потребляется browser/visual suite. Green suite поэтому не доказывает catalog.
- Axe проходит fixtures только в default composition и не открывает optional
  sheets; существующий focus-boundary helper не вызывается.
- `CardView` и strict Zod schema сейчас не содержат presentation-safe Bad
  Stuff text. Content хранит typed `monster.bad_stuff`, а текущий `rules_text`
  часто смешивает combat rule и consequence; клиентское форматирование или
  эвристический split запрещены.
- Published Moscow packs `v1-v4` immutable. Если presentation contract требует
  новое поле, plan создаёт новую `moscow/v5`, не переписывает старые digests.

## Scope

### Входит

- Удаление/замена legacy player-facing Vue/CSS/model branches, которых нет в
  Figma closed set; удаление связанных tests/fixtures/selectors/baselines.
- Refactor shared presentation model: runtime state выбирает ровно один
  Figma-owned board/sheet, domain intent остаётся в mapper, а visual component
  не вычисляет legality или hidden state.
- Lobby, full desktop/compact game compositions, core-loop state surfaces,
  character/equipment, choice/equip sheets, encounter/choice cards,
  interaction/system states и responsive shell.
- Узкое actor-safe расширение `CardView` и content presentation contract через
  optional `monster.bad_stuff_text`; schema/validator/backend/Zod/fixtures/
  consumer меняются атомарно, published packs не мутируются.
- Deterministic state fixtures только как reachability/semantic evidence;
  реальный multi-actor HTTP flow отдельно доказывает playability.
- Browser/a11y/visual coverage на согласованной width matrix, keyboard, safe
  area, short height, 200% zoom, reduced motion и long Russian copy.

### Не входит

- Новые Figma screens/components, редизайн Figma-файла или визуалы без direct
  node owner.
- Локальный расчёт RNG, combat/run-away outcome, legal actions, eligible
  responders, target IDs или authoritative phase.
- Изменение persistence/migrations/realtime envelope/idempotency/credentials.
- Изменение rules mechanics или typed Bad Stuff effects; меняется только
  presentation-safe projection уже существующей authoritative mechanics.
- Редизайн Card Studio, dependency install/upgrade, Compose/cloud/deploy.
- Изменение/перепубликация immutable `demo-original@1` и content versions
  `moscow-core@1..4`; optional schema compatibility проверяется без их rewrite.
- Push. Завершение — отдельный local commit после canonical lifecycle.

## Архитектурный подход

- **Closed-set presenter.** `gamePresentationModel`/sheet model становятся
  exhaustive mapping из parsed actor projection в named Figma state. Generic
  gameplay fallback разрешён только для transport/system state с прямым Figma
  owner; неизвестная runtime shape fail-closed, а не получает новый visual.
- **Board и decision — разные owners.** Phase board объясняет context и
  persistent actions; mandatory decision получает dedicated existing
  dialog/sheet family. Dedicated game-owned `RunAwaySurface` покрывает current
  monster, modifiers, server-roll intent, confirmed result, next-monster and
  actor/observer states. `GameModalCoordinator` маршрутизирует его до generic
  `InteractionSurface`; run-away imports/branches/technical copy удаляются из
  generic dialog path.
- **Shared semantic primitives, distinct geometry.** `SheetDialog` отвечает за
  focus/inert/return-focus/safe-area semantics. Character, Cards3, Hand 410,
  Mandatory 470 и interaction families владеют своими explicit layout
  contracts; один generic body не подменяет разные Figma components. Старый
  mode-switching `CardChoiceSheet` branch заменяется dedicated Cards3,
  exact-slot и fast-hand owners, а не получает ещё один CSS override.
- **Server/content-owned presentation.** Optional
  `monster.bad_stuff_text` хранится в следующей immutable content version,
  допускается только внутри `monster`, обязан быть valid UTF-8,
  `strings.TrimSpace(value) != ""` и не длиннее 400 Unicode code points.
  Schema/Node/Go отклоняют поле у non-monster cards; projector передаёт его
  allowlisted как optional `CardView.bad_stuff_text` только для видимой
  actor-authorized monster card. Typed `monster.bad_stuff` остаётся
  engine-only. Mechanics/replay не меняются. Frontend рендерит два отдельных
  text regions без интерпретации effects или split `rules_text`.
- **Responsive by constraints.** Grid/flex/intrinsic sizing, capped widths,
  `minmax(0,1fr)`, dynamic viewport and safe-area replace magic offsets и
  assumptions о `360`/`900` height. Absolute positioning допускается только
  внутри Figma-owned card decoration, не для page centering/dock placement.
- **Evidence is state-specific.** Matrix связывает runtime state, exact direct
  Figma node, deterministic fixture/real-flow step, DOM owner, viewport,
  current/reference screenshots, text audit и reviewer result. Family-level
  pass без пары screenshots запрещён.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Web player UI | Удалить legacy owners, построить Figma-owned board/sheets и responsive constraints | Parsed `Projection`, `ActionView`, `InteractionView` |
| Shared contracts | Добавить presentation-safe optional Bad Stuff text в strict `CardView` | `game:http-v1` additive field with positive/negative fixtures |
| Go projector/content | Allowlist нового presentation field без internal effects/private state | Pure `ProjectForActor`, immutable content registry |
| Content schema/pack | Ввести presentation-only field и новую immutable Moscow v5 | `content:card-set-schema`, new digest; v1-v4 unchanged |
| Browser harness | State reachability, exact owner, responsive/a11y and side-by-side evidence | Fixture evidence separated from real HTTP playability |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/plans/active/20260808T093246Z-e55ac3-figma-closed-set-playability-remediation-v2.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260808T093246Z-e55ac3-figma-closed-set-playability-remediation-v2.md` | write | Archived lifecycle плана |
| `frontend/applications/web/app/assets/scss/api/**` | write | Shared breakpoint/layout tokens only when a repeated constraint requires it |
| `frontend/applications/web/app/assets/scss/base/**` | write | Safe-area/dynamic viewport foundation only when shared by multiple owners |
| `frontend/applications/web/app/assets/scss/pages/_lobby.scss` | write | Remove cross-component legacy lobby overrides; page composition only |
| `frontend/applications/web/app/components/GameConnectionStatus.vue` | write | Connection-state presentation changed in this checkpoint |
| `frontend/applications/web/app/components/actionModel.ts` | write | Root action labels/availability changed in this checkpoint |
| `frontend/applications/web/app/components/game/**` | write | Exhaustive Figma board/card/modal owners and responsive presentation model; deletion allowed inside write claim |
| `frontend/applications/web/app/components/interaction/**` | write | Replace/delete generic technical player-facing interaction visuals with mapped Figma surfaces |
| `frontend/applications/web/app/components/lobby/**` | write | Remove extra card and preserve semantic forms/recovery |
| `frontend/applications/web/app/components/ui/**` | write | Shared semantic dialog/timer/live primitives; obsolete product visual deletion allowed |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Typed command/projection consumer changes if required by mapped flow |
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Modal/action orchestration needed by Figma-owned states |
| `frontend/applications/web/app/pages/index.vue` | write | Lobby page composition |
| `frontend/applications/web/app/pages/game/[id].vue` | write | Route-level presenter/modal composition |
| `frontend/applications/web/test/**` | write | Component/model/fixture coverage; delete assertions for legacy visuals |
| `frontend/playwright.config.ts` | write | Real-browser default selects immutable Moscow v5; fixture default remains demo |
| `frontend/packages/contracts/src/**` | write | Strict additive CardView presentation field |
| `frontend/packages/contracts/test/**` | write | Positive/unknown/privacy compatibility fixtures |
| `frontend/test/browser/**` | write | State/viewport/a11y/real-boundary tests; generated baselines only after side-by-side |
| `frontend/test/run-playwright.mjs` | write | Managed real-boundary server selects Moscow v5 without changing production defaults |
| `backend/game/cmd/server/**` | write | Explicit test-mode-only deterministic entropy wiring for reproducible real-browser reachability; production remains crypto-random |
| `backend/game/internal/application/**` | write | Bounded deterministic test entropy hook used only by managed E2E server |
| `backend/game/internal/game/**` | write | Content registry/projector and focused privacy/conformance tests; no rules change |
| `backend/game/internal/transport/httpapi/testdata/**` | write | Go-produced/versioned CardView contract fixture |
| `content/README.md` | write | Document new immutable v5 identity, provenance and validation |
| `content/schema/**` | write | Presentation field JSON schema |
| `content/tools/**` | write | Validator/digest/invalid fixture tests |
| `content/sets/moscow/v5/**` | write | Create next immutable version; never modify v1-v4 |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend-player-ui` | none found by context | this plan | Exclusive lifecycle owner |
| `frontend-browser-baselines` | none found by context | this plan | Generated only after reviewed pairs |
| `game-http-card-view` | none found by context | this plan | Contracts/backend/content updated atomically |
| `content-schema-and-digest` | none found by context | this plan | New version; old packs immutable |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-08 09:32:46 UTC
- **Обнаруженные пересечения:** `leinoctl context` не вернул релевантных
  active plans; registry scan показал только unrelated infrastructure/tooling
  plans.
- **Решение:** plan не выбирается до approval; перед select повторить context и
  conflict scan. Любое новое пересечение contracts/content/browser baselines
  — material change и требует остановки/координации.

## План реализации

1. [deferred] До implementation повторно получить live Figma context/screenshots для
   каждого exact node в source matrix; сохранить text/geometry inventory и
   отметить inaccessible node как `unverified`, а не наследовать старый pass.
2. [deferred] Удалить legacy presentation inventory: generic run-away/technical
   dialogs, fallback copy/CTA, stale selectors, old card variants, orphan
   fixtures/tests/baselines. Для каждого удаления записать replacement Figma
   owner или доказать dead code.
3. [deferred] Refactor presenter/modal coordinator в exhaustive state mapping с одним
   primary owner; разделить board context, optional info и mandatory decision.
4. [deferred] Реализовать immutable-safe Bad Stuff presentation pipeline:
   optional `monster.bad_stuff_text` schema/validators → `moscow-core@5`
   version/source digest/content digest → Go `MonsterSpec`/projector → strict
   Zod `CardView.bad_stuff_text` → separate Figma card regions. V5 сохраняет
   v4 mechanics и `DeathLootProfile`; v1-v4 остаются loadable и неизменными.
   На каждом boundary проверить monster-only placement, UTF-8,
   trim-nonempty, максимум 400 code points и отсутствие internal effect data.
5. [deferred] Пересобрать lobby и shared responsive shell по intrinsic constraints;
   удалить перекрёстные scoped/global overrides и fixed-offset centering.
6. [deferred] Пересобрать desktop/compact core-loop states: setup, preparation, door,
   post-door, combat, run-away sequence, reward, charity/discard, end-turn,
   waiting/death/victory/system states — только существующими primitives.
7. [deferred] Пересобрать Character/Strength/Opponent/Hand, exact slot equip и fast
   hand equip; проверить filtering/action semantics и state-specific copy.
8. [deferred] Обновить deterministic state matrix/fixtures так, чтобы данные
   достигали именно mapped state и visible copy, но не становились заменой
   real-flow evidence.
9. [deferred] Выполнить focused unit/contract/Go/content checks, затем browser
   semantic/a11y/responsive matrix и реальный two-actor core loop.
10. [deferred] Выполнить live side-by-side node-by-node. Исправлять implementation,
    пока каждая строка не `pass`; baseline update допустим только после pass,
    затем обязательный no-update rerun.
11. [deferred] Запустить `pnpm lint`, `pnpm check`, `pnpm build`, `go test ./...`,
    content validators, `./leinoctl verify --changed`, `scope-check`, plan-lint
    и final Terra review. После clean evidence завершить/archive/release и
    создать один local commit; push не делать.

## Проверки

- [deferred] Contract: Zod принимает отсутствующее поле и monster card с непустым
  `bad_stuff_text` длиной до 400 code points; отклоняет empty/whitespace,
  over-limit, unknown/private fields и поле у non-monster card. Backend HTTP
  fixtures декодируются старым клиентом при отсутствии optional field.
- [deferred] Content: schema invalid fixtures, Node/Go semantic validation and digest
  for unchanged demo plus `moscow-core@5`; exact
  `set_id/version/source/source_digest/content_digest` recorded. V5 equals v4
  mechanically; allowed presentation delta is limited to separating mixed
  monster `rules_text` into combat/rule copy plus `bad_stuff_text`, alongside
  identity/provenance/digests. Negative fixtures cover invalid UTF-8 input,
  whitespace-only, over-400-code-point and non-monster placement. V1-v4 and
  demo stay byte-for-byte untouched.
- [deferred] Backend focused: content conformance, `ProjectForActor` privacy, replay
  invariance, v5 → `DeathLootProfile` selection and HTTP projection tests;
  positive actor-visible monster получает только presentation text, а hidden,
  non-monster и unauthorized cards его не получают. Raw serialized JSON
  проверяется отрицательно на `monster.bad_stuff`, `bad_stuff`, effect payloads
  и private state; затем
  `(cd backend/game && go test ./...)`.
- [deferred] Frontend focused: presenter exhaustive mapping, modal priority/focus,
  run-away, charity/discard, exact/fast equip filtering and copy, lobby form,
  card presentation and system states.
- [deferred] Browser functional: machine ledger содержит ровно 43 уникальных runtime
  states и по одному exact predicate, fixture/real-flow step и primary
  `data-figma-owner`; missing/duplicate/generic fallback — test failure.
  `ActiveTurn` доказывается отдельно для authoritative combat и
  resolve-effect paths. Нет legacy technical copy/selectors; keyboard
  open/close/return-focus и mandatory non-dismiss проверяются исполняемо.
- [deferred] Run-away/death-loot authority: dedicated `RunAwaySurface` строится только
  из server action/interaction descriptors; generic `InteractionSurface` не
  содержит run-away ветку. Non-responder/observer не видит private controls.
  `DeathLoot` сохраняет server `death_loot_priority`; клиент не сортирует и не
  выбирает чужую очередь. Для каждого non-dead actor projection и UI явно не
  содержат `death_loot_priority` controls/loot options, а попытка выполнить
  death-loot descriptor с credential такого actor отклоняется server-side.
- [deferred] Responsive: `360x640`, `428`, `600`, `768`, `1024`, `1280`, `1400`,
  `1920` plus exact boundary triples at `900px` height:
  `373/374/375`, `426/427/428`, `598/599/600`, `766/767/768`,
  `1022/1023/1024`, `1278/1279/1280`, `1438/1439/1440`,
  `1899/1900/1901`; tall/short heights, safe-area, document overflow,
  dock/card/strength centering, dialog open/close and first/last focus
  visibility. Dense long-copy, multi-action and open-sheet fixtures run the
  full boundary sweep, not only `full-roster-combat`.
- [deferred] Accessibility: serious/critical Axe, keyboard-only, 200% zoom, reduced
  motion, forced colors and long Russian copy on representative compact/wide
  states.
- [deferred] Playability: два browser contexts только видимыми UI controls создают,
  join/start игру и проходят deterministic authoritative scenario, который
  гарантированно создаёт hand overflow. У active actor безусловно открывается
  `CharityDiscard`; modal нельзя закрыть, обойти или продолжить ход до submit.
  Submit уходит через Nuxt → HTTP Go, обновлённая actor projection подтверждает
  hand limit, после чего UI завершает текущий ход и показывает handoff второму
  игроку. Отдельный UI-only scenario проходит door/combat и run-away response;
  route fixtures и direct API-driving не принимаются как playability proof.
  Determinism задаётся server-side test runtime/content до запуска browsers;
  браузер не передаёт seed, deck position, outcome или чужой player ID.
- [deferred] Visual: direct Figma/current pairs for each changed exact node at
  `360x640`/`1440x900` plus responsive safety rows; visible copy inventory;
  durable per-node ledger содержит Figma capture/reference, current screenshot
  path+digest, viewport/dimensions, copy compare, reviewer verdict, baseline
  diff и immediate no-update rerun. Controlled update только после pair pass.
- [deferred] Canonical: `pnpm lint`, `pnpm check`, `pnpm build`, `go test ./...`,
  `./leinoctl verify --changed`,
  `./leinoctl scope-check --plan 20260808T093246Z-e55ac3-figma-closed-set-playability-remediation-v2`,
  `node .codex/hooks/plan-lint.mjs`, `git diff --check`.

## Checkpoint evidence

- 2026-08-08: full responsive browser matrix ранее прошла 216/216; full a11y
  matrix прошла 168/168; real two-actor browser-to-HTTP scenario прошёл 2/2.
- 2026-08-08: поздний live Figma side-by-side reviewer отклонил Help Incoming,
  Help Accepted, Run Away Pending, Run Away Failure и End Turn как materially
  non-parity. Эти состояния остаются deferred; новые baselines не считаются
  Figma-approved.
- 2026-08-08: no-update visual suite имела 18 pass / 17 fail. Поэтому visual
  parity и green baseline suite не заявляются.
- 2026-08-08: `./leinoctl verify --changed` прошёл после явного
  `LEINO_PNPM_EXECUTABLE` и добавления Go в `PATH`: frontend lint/check/build,
  content validators, Go tests, contracts, web tests/typecheck/lint/build,
  harness tests, leinoctl tests, plan-lint, script syntax и compose config —
  exit 0.
- Harness defects для следующего plan: declared pnpm resolver требует
  `LEINO_PNPM_EXECUTABLE`; bundled pnpm предложил переустановить
  `node_modules`; Go не находился без `/usr/local/go/bin` в PATH; selected
  cancelled plan нельзя штатно release, поэтому checkpoint потребовал явного
  rescope в completed.

## Deferred continuation

- Не считать текущие visual baselines доказательством Figma parity.
- Продолжить live node-by-node comparison поздних desktop states и всех compact
  counterparts; inaccessible compact nodes оставить `unverified`.
- Довести shared presentation model до одного exact state owner вместо root
  metadata/generic board ownership.
- Проверить реальный промежуточный Run Away result acknowledgement перед
  следующим монстром, Bad Stuff applied summary и authoritative CTA flow.
- Повторить visual no-update до полного green только после side-by-side pass;
  затем fresh Terra final review.
- Полный исходный acceptance scope должен получить новый exact plan и новый
  approval после завершения harness work.

## Риски и откат

- **Риск:** broad replacement может временно сломать reachable action flow.
  **Снижение:** по одному mapped state family, unit tests до browser loop,
  server descriptor остаётся единственным action authority.
- **Риск:** попытка получить Bad Stuff copy из mechanics создаст localization/
  privacy drift. **Снижение:** explicit presentation-only content field,
  allowlisted projection и immutable new pack version; effects не сериализуются.
- **Риск:** CSS снова скопирует canonical frame fixed offsets и развалится
  между widths/heights. **Снижение:** constraint-based layout, short-height and
  between-breakpoint sweeps, DOM geometry assertions рядом с screenshots.
- **Риск:** fixture специально подгонит raster, но real flow не достигнет
  state/action. **Снижение:** fixture и real-boundary ledgers независимы.
- **Риск:** baseline замаскирует mismatch. **Снижение:** no update до pair pass,
  visible baseline diff review и no-update rerun.
- **Откат:** до local commit изменения остаются reviewable в одном plan write
  set; исправляется forward within plan. Не применять reset/stash и не
  восстанавливать удалённый legacy UI как compatibility fallback.

## Открытые вопросы

- Real-browser managed test runtime переключается с Moscow v4 на v5, иначе
  Figma Bad Stuff acceptance не проверяется. Production/server/Docker Compose
  defaults остаются `demo`; их migration не требуется и не входит в scope.
- `CreateLobby` обязан явно сопоставить `moscow-core@5` существующему
  `DeathLootProfile`; новый rules profile и mechanics не создаются.
- Какие из inherited 43 mappings live connector больше не подтверждает — такие
  строки остаются `unverified` и блокируют parity claim до direct source.

## Figma source matrix — direct links, closed set

- File: [Munchkin](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin).
- Lobby: [mobile 228:14](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=228-14),
  [desktop 240:53](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=240-53).
- Active board: [mobile 147:731](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-731),
  [desktop 248:5](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=248-5).
- Core loop desktop: [setup 293:1617](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1617),
  [door 285:1315](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1315),
  [post-door 285:1388](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1388),
  [run-away 285:1473](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1473),
  [reward 285:1566](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1566).
- Encounter Card: [96:30](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=96-30).
- Choice/sheet catalog: [page 110:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=110-2),
  [Choice Card 110:29](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=110-29),
  [Bottom Sheet 112:66](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=112-66),
  [desktop Cards3 291:1587](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=291-1587).
- Equipment: [mobile exact 340:3475](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=340-3475),
  [mobile fast 342:3574](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=342-3574),
  [desktop character 267:708](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=267-708),
  [mobile character 165:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-42).
- Charity/discard shared visual: [desktop 256:316](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=256-316),
  [mobile 147:978](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-978).
- Compact decision families: [Info 167:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=167-42),
  [Turn Decision 172:1719](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=172-1719),
  [Interaction 177:1772](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=177-1772),
  [Result 179:1784](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=179-1784).
- Mobile system states: [observer 147:1082](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1082),
  [reconnect 147:1138](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1138),
  [failed 147:1203](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1203).

### Direct-node admission ledger for routes and shared primitives

Эта таблица вместе с двумя runtime tables ниже образует один exhaustive
ledger. Каждая строка обязана получить отдельные live Figma/current captures;
соседняя строка или family-level screenshot не засчитывается. Статус всех строк
до implementation — `unverified`; недоступный direct node блокирует parity, а
не разрешает generic replacement. `110:2` является только catalog source и не
может появиться как runtime owner.

| Exact node | DOM/component owner | Exact predicate and evidence step | Required pair/copy verdict |
|---|---|---|---|
| [228:14](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=228-14) | `lobby-route:compact` | `/`, compact, create/join/recovery fixture + real actor entry | compact screenshot + all visible form/error/pending copy; `unverified` |
| [240:53](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=240-53) | `lobby-route:wide` | `/`, wide, same semantic states | wide screenshot + copy; `unverified` |
| [147:731](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-731) | `game-board:active-compact` | active actor + mapped active/preparation predicate | `360x640` current/reference + copy; `unverified` |
| [248:5](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=248-5) | `game-board:active-wide` | active actor + authoritative combat and resolve-effect variants | `1440x900` pairs for both predicates; `unverified` |
| [293:1617](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1617) | `game-board:preparation` | preparation projection + server actions | wide pair + copy; `unverified` |
| [285:1315](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1315) | `game-board:door` | door-choice projection + server action | wide pair + copy; `unverified` |
| [285:1388](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1388) | `game-board:post-door` | post-door projection + server actions | wide pair + copy; `unverified` |
| [285:1473](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1473) | `game-board:run-away` | combat-loss projection + run-away descriptor | wide pair + copy; `unverified` |
| [285:1566](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1566) | `game-board:reward` | server-confirmed combat reward | wide pair + copy; `unverified` |
| [96:30](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=96-30) | `encounter-card` | actor-visible monster in board and sheet variants | strict card-region geometry + all card copy; `unverified` |
| [110:2](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=110-2) | catalog only, no DOM owner | source inventory for choice/sheet primitives | catalog capture and child-node reconciliation; `unverified` |
| [110:29](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=110-29) | `choice-card` | selectable/unselectable/actionable variants | component pairs + copy; `unverified` |
| [112:66](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=112-66) | `sheet-dialog` semantics | compact info/decision/mandatory variants | open sheet pair + focus/copy; `unverified` |
| [291:1587](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=291-1587) | `game-modal:cards3` | wide hand/exact-slot candidates | wide pair + copy; `unverified` |
| [340:3475](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=340-3475) | `game-modal:equip-slot` | selected slot + only matching equipment | compact pair + filtering/copy; `unverified` |
| [342:3574](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=342-3574) | `game-modal:hand-fast-equip` | selected hand equipment + equip action | compact pair + action/copy; `unverified` |
| [267:708](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=267-708) | `game-modal:character-equipment` | own character, wide | wide pair + slots/carried/copy; `unverified` |
| [165:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-42) | `game-modal:character-equipment` | own character, compact | compact pair + slots/carried/copy; `unverified` |
| [256:316](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=256-316) | `game-modal:charity` | transfer and mandatory-discard data/copy modes | two wide pairs + non-dismiss/copy; `unverified` |
| [147:978](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-978) | `game-modal:charity` | same modes, compact | two compact pairs + non-dismiss/copy; `unverified` |
| [167:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=167-42) | `sheet:info` | optional information descriptor | compact pair + copy; `unverified` |
| [172:1719](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=172-1719) | `sheet:turn-decision` | active actor decision descriptor | compact pair + copy; `unverified` |
| [177:1772](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=177-1772) | `sheet:interaction` | non-run-away interaction descriptor | compact pair + copy; `unverified` |
| [179:1784](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=179-1784) | `sheet:result` | server-confirmed result descriptor | compact pair + copy; `unverified` |
| [147:1082](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1082) | `game-board:observer` | non-active actor projection | compact pair + copy; `unverified` |
| [147:1138](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1138) | `game-route:reconnecting` | transport reconnecting | compact pair + copy; `unverified` |
| [147:1203](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1203) | `game-route:connection-failed` | terminal reconnect failure | compact pair + copy; `unverified` |

### Exhaustive runtime states to re-verify live

The node link is the design owner to fetch, not proof that current code passes.
`Expected primary owner` is the single runtime responsibility that must replace
generic/fallback presentation; implementation may rename the DOM marker only
if this table is updated before approval.

| Runtime state | Direct Figma node | Expected primary owner |
|---|---|---|
| ActiveTurn | [248:5](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=248-5) | `game-board:active` |
| HandExpanded | [253:96](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=253-96) | `game-modal:hand` |
| HandFastEquip | [291:1587](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=291-1587) / [342:3574](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=342-3574) | `game-modal:hand-fast-equip` |
| EquipmentSlotOpen | [291:1587](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=291-1587) / [340:3475](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=340-3475) | `game-modal:equip-slot` |
| RequiredResponse | [254:221](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=254-221) | `game-modal:mandatory-response` |
| CharityTransfer | [256:316](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=256-316) | `game-modal:charity` |
| CharityDiscard | [256:316](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=256-316), data/copy mode only | `game-modal:charity` |
| Waiting | [257:447](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=257-447) | `game-board:observer` |
| Reconnecting | [258:2530](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=258-2530) | `game-route:reconnecting` |
| ConnectionFailed | [258:2674](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=258-2674) | `game-route:connection-failed` |
| CharacterOpen | [267:708](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=267-708) | `game-modal:character-equipment` |
| StrengthOpen | [271:3010](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=271-3010) | `game-modal:strength` |
| OpponentOpen | [271:3216](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=271-3216) | `game-modal:opponent` |
| DoorReady | [285:1315](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1315) | `game-board:door` |
| PostDoorChoice | [285:1388](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1388) | `game-board:post-door` |
| RunAwayChoice | [285:1473](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1473) | `game-board:run-away` |
| RewardReceived | [285:1566](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=285-1566) | `game-board:reward` |
| Preparation | [293:1617](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1617) | `game-board:preparation` |
| CurseEffect | [293:1706](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1706) | `game-modal:mandatory-effect` |
| HelpOffer | [293:1780](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1780) | `game-modal:help-offer` |
| HelpIncoming | [293:1866](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1866) | `game-modal:help-incoming` |
| HelpAccepted | [293:1952](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-1952) | `game-board:help-accepted` |
| RunAwayPending | [293:2026](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=293-2026) | `game-modal:run-away-response` |
| RunAwaySuccess | [294:1998](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-1998) | `game-board:run-away-result` |
| RunAwayFailure | [294:2072](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2072) | `game-board:run-away-result` |
| RunAwayNextMonster | [294:2146](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2146) | `game-board:run-away-next` |
| EndTurnReady | [294:2235](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2235) | `game-board:end-turn` |
| TurnPassed | [294:2309](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2309) | `game-board:observer` |
| Death | [294:2384](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=294-2384) | `game-route:death` |
| DeathLoot | [295:2355](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2355) | `game-modal:death-loot` |
| DeathRecovery | [295:2444](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2444) | `game-route:death-recovery` |
| Victory | [295:2518](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2518) | `game-route:victory` |
| Trade | [295:2592](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2592) | `game-modal:trade` |
| Gift | [295:2678](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2678) | `game-modal:gift` |
| TheftResponse | [295:2764](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=295-2764) | `game-modal:theft-response` |
| PrivateChoice | [296:2748](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2748) | `game-modal:private-choice` |
| StaleChoice | [296:2837](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2837) | `game-route:stale-choice` |
| ExpiredChoice | [296:2911](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2911) | `game-route:expired-choice` |
| EmptyHand | [296:2985](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-2985) | `game-modal:hand-empty` |
| InitialLoading | [296:3058](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-3058) | `game-route:loading` |
| SessionLost | [296:3133](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=296-3133) | `game-route:session-lost` |
| GameUnavailable | [297:3103](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=297-3103) | `game-route:unavailable` |
| GameFinished | [297:3177](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=297-3177) | `game-route:finished` |

### Machine-checked 43-state contract

Runtime table above is copied into one typed descriptor catalog consumed by
unit, semantic and visual tests; Markdown alone is not evidence. Its schema is
`{ state, desktopNodeId, compactNodeId, primaryOwner, predicateId, fixtureId,
actionStepId, expectedCopy, visualDisposition }`. Tests hard-code the accepted
ordered state names and `EXPECTED_FIGMA_RUNTIME_STATE_COUNT = 43`; they fail on
count drift, missing/duplicate name, duplicate predicate ownership, missing
node/fixture/action step, undocumented state, generic owner or rendered
fallback. `semanticCheck` becomes executable assertion code, not a string.

Predicate IDs are exact projection conditions, not labels. In particular:

- `ActiveTurn` has two required evidence variants: actor owns the authoritative
  combat turn, and actor owns an authoritative resolve-effect step; both render
  the same approved owner but each has its own fixture/action assertion.
- `CurseEffect` and `PrivateChoice` require their concrete `resolve_effect`
  interaction kind and matching server action descriptors; they cannot be
  inferred from arbitrary modal visibility.
- `RunAwayPending` requires the responder credential and server
  `run_away_response`; the other actor must prove absence of private controls.
- `DeathLoot` requires the dead actor plus exact server
  `death_loot_priority`; order equality is asserted before rendering. Для
  каждого non-dead actor отдельный negative fixture/assertion доказывает
  отсутствие priority/loot options в projection и DOM, а HTTP test — rejection
  попытки выполнить descriptor с его credential.
- At completion every compact row must have a live-confirmed direct source.
  `unverified` is allowed only while the plan is open and is a failing visual
  disposition, never an accepted shared/generic fallback.

### Compact source extension of the runtime matrix

Rows join the table above by the exact runtime-state key. Every direct link
must be fetched live; inaccessible rows remain `unverified` and block parity
completion. No `shared approved primitives` shorthand can produce a pass.

| Runtime state | Compact direct source |
|---|---|
| ActiveTurn | [147:731](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-731) |
| HandExpanded | [147:803](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-803) |
| HandFastEquip | [342:3574](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=342-3574) |
| EquipmentSlotOpen | [340:3475](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=340-3475) |
| RequiredResponse | [147:903](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-903) |
| CharityTransfer | [147:978](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-978) |
| CharityDiscard | [147:978](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-978), data/copy mode only |
| Waiting | [147:1082](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1082) |
| Reconnecting | [147:1138](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1138) |
| ConnectionFailed | [147:1203](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1203) |
| CharacterOpen | [165:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=165-42) |
| StrengthOpen | [164:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=164-42) |
| OpponentOpen | [185:1742](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=185-1742) / [166:42](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=166-42) |
| DoorReady | [181:1634](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=181-1634) |
| PostDoorChoice | [182:1627](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=182-1627) |
| RunAwayChoice | [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671) |
| RewardReceived | [184:1687](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=184-1687) |
| Preparation | [147:731](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-731), integrated-state composition |
| CurseEffect | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) |
| HelpOffer | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) |
| HelpIncoming | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) |
| HelpAccepted | `unverified` — direct compact source required; parity blocked |
| RunAwayPending | [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671) |
| RunAwaySuccess | [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671) |
| RunAwayFailure | [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671) |
| RunAwayNextMonster | [183:1671](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=183-1671) |
| EndTurnReady | `unverified` — direct compact source required; parity blocked |
| TurnPassed | [147:1082](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1082) |
| Death | [178:145](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=178-145) |
| DeathLoot | [177:130](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=177-130) |
| DeathRecovery | `unverified` — direct compact source required; parity blocked |
| Victory | [179:146](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=179-146) |
| Trade | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) |
| Gift | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) |
| TheftResponse | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) |
| PrivateChoice | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) |
| StaleChoice | [147:1138](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-1138) |
| ExpiredChoice | [188:1777](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=188-1777) |
| EmptyHand | [147:803](https://www.figma.com/design/bmxy6z3Z0bBLHLYryYJYrP/Munchkin?node-id=147-803) |
| InitialLoading | `unverified` — direct compact source required; parity blocked |
| SessionLost | `unverified` — direct compact source required; parity blocked |
| GameUnavailable | `unverified` — direct compact source required; parity blocked |
| GameFinished | `unverified` — direct compact source required; parity blocked |

### Evidence layers and admission rules

| Layer | Required proof | Explicitly insufficient |
|---|---|---|
| Fixture reachability | Parsed actor-specific fixture renders exact state owner/node, state copy and descriptor actions | Route interception returning the same fixture at `version + 1` |
| Figma parity | Per-node live source + current screenshot + geometry/copy verdict at canonical viewport | Repository baseline, node ID attribute or family-level pass |
| Accessibility | Axe plus keyboard trap, mandatory non-dismiss, return-focus, resize and first/last focus on open sheets | Axe on closed/default fixture only |
| Playability | Two browser actors use visible UI through Nuxt → HTTP Go for a full authoritative turn | Direct API-driven scenario followed by opening one page |
| HTTP/authority | Direct API tests for privacy, projection and mechanics | Rebranding those tests as browser playability |

### Durable implementation evidence ledger

До первого baseline update root расширяет **эту же plan-секцию** одной строкой
на каждый exact node/state из трёх tables выше. Обязательные поля строки:
`node/state`, live Figma request/capture reference и dimensions, DOM owner,
exact predicate/fixture/real-flow step, current screenshot repository path и
SHA-256, viewport, visible-copy comparison, geometry verdict, independent
reviewer verdict, baseline diff path/result, no-update command/result. Ссылки
на ephemeral screenshots без сохранённого reference ID и family-level `pass`
запрещены. Baseline admission script/test сверяет, что количество admitted
rows равно количеству live-confirmed ledger keys и что нет `unverified`,
`generic`, missing digest или missing no-update result.

| Ledger key | Figma capture | Current capture + SHA-256 | Viewport/dimensions | Copy + geometry | Reviewer | Baseline diff | No-update rerun |
|---|---|---|---|---|---|---|---|
| `248:5/ActiveTurn-single` | live `get_screenshot`, request `75c76840-f831-497d-8c60-19597517fb87`, `1440x900` | `frontend/test/browser/visual-baselines/chromium/desktop-combat-one.png`, `da78e2d26ad49a9bdec69b49cd60c1dae0b137b9209a2607efd1bfb4b074dd44` | `1440x900`; source `1440x900` | pass: БОЙ/ТВОЙ ХОД, three-card rail, Bad Stuff and action/sidebar geometry | Terra final pending after P1 remediation | controlled single-case diff admitted after live pair | exact 10-case no-update run: pass |
| `248:5/ActiveTurn-multiple` | live `get_screenshot`, request `75c76840-f831-497d-8c60-19597517fb87`, `1440x900` | `frontend/test/browser/visual-baselines/chromium/desktop-combat-multiple.png`, `cfcdefbe3c57d0d7f403baa931918595ce3df332f6a7777bd869de794094ad0c` | `1440x900`; source `1440x900` | pass: multiple encounter pagination/rail containment and combat totals | Terra final pending after P1 remediation | controlled single-case diff admitted after live pair | exact 10-case no-update run: pass |
| `285:1473/RunAwayChoice` | live `get_screenshot`, request `6d56b794-1890-4163-8184-34f935ab3338`, `1440x900` | `frontend/test/browser/visual-baselines/chromium/desktop-run-away.png`, `d0084023401e058451726345d62840266daac96b11a8d4bb2edddbbcdf244101` | `1440x900`; source `1440x900` | pass: inline owner, timer, selected monster, modifiers and server-roll CTA; no overlay | Terra P1 generic-result branch removed; closure pending | controlled single-case diff admitted after live pair | exact 10-case no-update run: pass |
| `257:447/Waiting` | live `get_screenshot`, request `26ada676-421f-4378-a8d0-06ceaa238b27`, `1440x900` | `frontend/test/browser/visual-baselines/chromium/desktop-waiting.png`, `7ca10d82a3845f797f2640280835431d5717bb30202c551bbba91468b109acdd` | `1440x900`; source `1440x900` | pass: observer stage spans both rows; no hand/action controls | Terra final pending after P1 remediation | controlled single-case diff admitted after live pair | exact 10-case no-update run: pass |
| `295:2355/DeathLoot` | live `get_screenshot`, request `372f4457-3d5e-4052-a6e0-393e570b7a13`, `1440x900` | `frontend/test/browser/visual-baselines/chromium/desktop-death.png`, `16f67ccbf4f9c722adac7e2528af4c3d65195ff0d8813232a53eb688175c5d82` | `1440x900`; source `1440x900` | pass: inline actor pool/pass/timer/priority and disabled confirm; observer opacity asserted | Terra final pending after P1 remediation | controlled single-case diff admitted after live pair | exact 10-case no-update run: pass |
| `147:731/PostDoorChoice-compact` | live `get_screenshot`, request `f883c330-c872-4a3f-be11-558f169a38f7`, `360x640` | `frontend/test/browser/visual-baselines/chromium/mobile-combat-one.png`, `f2d49dab02677db3ae27a5ca496d5be1cff75507360ac3727e10350ef56480f8` | `360x640`; source `360x640` | pass: centered strict compact card, header strength and safe-area dock | Terra final pending after P1 remediation | controlled single-case diff admitted after live pair | exact 10-case no-update run: pass |
| `147:731/ActiveTurn-compact-multiple` | live `get_screenshot`, request `f883c330-c872-4a3f-be11-558f169a38f7`, `360x640` | `frontend/test/browser/visual-baselines/chromium/mobile-combat-multiple.png`, `f1f4daf61237065da72f12367ebaf9e9775fb8de2009bbfaf5589e6bfc3a9dac` | `360x640`; source `360x640` | pass: centered carousel, pager and non-overlapping dock/CTA | Terra final pending after P1 remediation | controlled single-case diff admitted after live pair | exact 10-case no-update run: pass |
| `183:1671/RunAwayChoice-compact` | live `get_screenshot`, request `e2e437ff-0670-4fbe-9fbb-89e5570b0033`, `360x640` | `frontend/test/browser/visual-baselines/chromium/mobile-run-away.png`, `3f7645542be5a6c90c91de48762823a3b65a6eec00035e803f2c225cc289adf0` | `360x640`; source `360x640` | pass: mandatory bottom sheet, 2-card rail, selected state and full-width server-roll CTA | Terra P1 generic-result branch removed; closure pending | controlled single-case diff admitted after live pair | exact 10-case no-update run: pass |
| `147:1082/Waiting-compact` | live `get_screenshot`, request `e185ff6f-7767-4a7e-8c74-ac72ea5c4388`, `360x640` | `frontend/test/browser/visual-baselines/chromium/mobile-waiting.png`, `5d87febcf4bc06583615c1b6ff1005f3fae6b0071949ef0dcb0a3ff5b57aefab` | `360x640`; source `360x640` | pass: ЧУЖОЙ ХОД, `1/1`, one centered card and no actor CTA | Terra final pending after P1 remediation | controlled single-case diff admitted after live pair | exact 10-case no-update run: pass |
| `177:130/DeathLoot-compact` | live `get_screenshot`, request `ea131e07-3d91-4614-9629-b80a3abd7e31`, source `416x526` | `frontend/test/browser/visual-baselines/chromium/mobile-death.png`, `a8f3e41e0a873e86f85d75b6b083243343c7dfa71541b5e2f0c02bf80a798fca` | runtime `360x640`; source sheet `416x526` constrained to viewport | pass: dedicated title/timer/two choices/Пас/full-width confirm; no generic dialog header | Terra final pending after P1 remediation | new controlled baseline admitted after live pair | exact 10-case no-update run: pass |
| `267:708/CharacterEquipment-desktop` | live `get_screenshot`, request `363293d0-2831-4eec-ac2e-369587d9b605`, source `996x676` | `frontend/test/browser/visual-baselines/chromium/desktop-character.png`, `88b76fb5728609625270cf3840b98f69f7576c2b0b4d4bb43ab144efc9e1a5f6` | runtime `1440x900`; source surface `940x608` inside effect bounds | pass: 940px surface, 280px summary, four slot grid, backpack, 110x52 close and source typography | Terra final pending after P1 remediation | exact single-state baseline updated only after live pair | pending exact no-update rerun |
| `165:42/CharacterEquipment-compact` | live `get_screenshot`, request `ae9cb1f6-f6da-4fb1-92c3-dbf9d9ebd51f`, source `416x526` | `frontend/test/browser/visual-baselines/chromium/mobile-character.png`, `bd89f08487f8a4e1b8e253322062fc1a39a3b601b34df0985e03e573b178e98b` | runtime `360x640`; source `360x470` sheet within `416x526` effect bounds | pass: compact-only header, traits, 2x2 slot grid, backpack and 36px safe bottom without desktop summary | Terra final pending after P1 remediation | exact single-state baseline updated only after live pair | pending exact no-update rerun |
| `291:1587/FastEquip-desktop` | live `get_screenshot`, request `6f190053-d330-4f4d-b58c-39aa875715b7`, source `768x502` | `frontend/test/browser/visual-baselines/chromium/desktop-fast-equip.png`, `d13eedb2efa0e308ca3e6f9349b8f62a3398a7fe592bf357424aa4a540221233` | runtime `1440x900`; source surface `768x502` | pass: dedicated desktop choice surface; selected equippable card is centered and raised, non-equippable cards disabled | Terra final pending after P1 remediation | exact single-state baseline updated only after live pair | pending exact no-update rerun |
| `342:3574/FastEquip-compact` | live `get_screenshot`, request `77c49ec8-9f42-45c0-babc-985e3b910070`, source `416x466` | `frontend/test/browser/visual-baselines/chromium/mobile-fast-equip.png`, `81a489b20ca41affc32cc29a8f3e5714b381fd719823f2da141fa5e8647bc7f8` | runtime `360x640`; source exact `360x410` sheet | pass: no stale subtitle, selected card centered/raised between neighbors, CTA at 36px safe bottom | Terra final pending after P1 remediation | exact single-state baseline updated only after live pair | pending exact no-update rerun |
| `291:1587/ExactEquip-desktop` | live `get_screenshot`, request `6f190053-d330-4f4d-b58c-39aa875715b7`, source `768x502` | `frontend/test/browser/visual-baselines/chromium/desktop-exact-equip.png`, `f821e31f5b4eb55e3e41092ecaf2e9bdb06407813c925391acd45280ecca025f` | runtime `1440x900`; source surface `768x502` | pass: dedicated exact-slot owner filters the rail to matching equipment and exposes equip/unequip only | Terra final pending after P1 remediation | exact single-state baseline updated only after live pair | pending exact no-update rerun |
| `340:3475/ExactEquip-compact` | live `get_screenshot`, request `3c6d81ef-ca40-4d3c-b7a6-783199dfb020`, source `416x526` | `frontend/test/browser/visual-baselines/chromium/mobile-exact-equip.png`, `6d13050cd8ffdd069cbea0b03a1ad153b6a37695c04c804f865bc15987cf5163` | runtime `360x640`; source exact `360x470` sheet | pass: slot/current-item copy, matching-only card rail, remove/close state and CTA at 36px safe bottom | Terra final pending after P1 remediation | exact single-state baseline updated only after live pair | pending exact no-update rerun |
| `256:316/HandLimitDiscard-desktop` | live `get_screenshot`, request `2fbd0042-b14c-4715-b874-676f0342a0f0`, source `1440x900` | `frontend/test/browser/visual-baselines/chromium/desktop-charity-discard.png`, `0b1b3e8edebab277e39a1ca876015813c3bb52f2102c22fecf2b07433cdf19db` | `1440x900`; source `1440x900` | pass: charity presentation reused with discard-only title/copy, exact excess counter, no recipient step or empty header control | Terra final pending after P1 remediation | exact single-state baseline updated only after live pair | pending exact no-update rerun |
| `147:978/HandLimitDiscard-compact` | live `get_screenshot`, request `8a19d1cd-8d8a-49da-a24b-fd5cac2be59e`, `360x640` | `frontend/test/browser/visual-baselines/chromium/mobile-charity-discard.png`, `8854ca7819dc6294f898e7e3336ca66ba3055aa0117d95936be403fc05583793` | `360x640`; source `360x640` | pass: mandatory non-dismiss sheet, two-card rail, exact excess progress and disabled CTA with 36px safe bottom | Terra final pending after P1 remediation | exact single-state baseline updated only after live pair | pending exact no-update rerun |

Bulk snapshot update is prohibited. Obsolete snapshots are deleted only after
their legacy owner is removed and replacement state evidence exists. A new or
changed baseline is admitted only after its exact live Figma/current pair is
`pass`, followed immediately by a no-update run.

Каждая ссылка выше повторно читается live перед implementation. Полная
runtime-state table из предыдущего plan не считается доказательством сама по
себе; appendix выше задаёт source/owner admission, а factual pass появляется
только после direct link + fixture/action + DOM assertion + screenshot pair.

## Delegation strategy

- **Классификация:** large — planning delegation required. Независимы минимум
  shared presentation/contract architecture и Figma/browser/responsive
  coverage; затронуты frontend, backend projection, content schema/immutable
  pack, tests и generated baselines.
- **Package A — Luna explorer requested; Terra read-only fallback used,
  architecture/shared presentation/content.**
  Read-only scope: `components/{game,interaction,ui}`, presenter/sheet models,
  `CardView`, Go content/projector, content schema/version registry. Output:
  exact owner graph, deletions, minimal immutable-safe Bad Stuff pipeline,
  manifest/write-set corrections. Stop after path-backed findings; no edits.
- **Package B — Luna explorer requested; Terra read-only fallback used,
  tests/Figma/responsive.** Read-only scope:
  Figma state matrix, browser/visual/a11y/real-boundary tests, current direct
  links and breakpoint contracts. Output: missing/false coverage, exact
  verification matrix, baseline policy and exhaustive source appendix gaps.
  Stop after evidence; no edits or browser duplication of root live captures.
- **Root parallel work:** root resolves conflict/context, drafts criteria,
  architecture, Figma link inventory, risks and lifecycle checks.
- **Reviewer — Terra.** После synthesis проверяет цельный plan на closed-set
  violations, authority/privacy/content immutability, under-scoped write set,
  unverifiable criteria and lifecycle gaps; не повторяет explorers и не пишет.
- Возможная implementation работа остаётся `root-only pending worktree
  orchestration`; delegated write set всегда пуст.

### Planning delegation results

- Luna spawn реально вызван и дважды вернул `Unknown model gpt-5.6-luna`;
  runtime перечислил только Sol/Terra. Оба bounded packages выполнены
  отдельными Terra read-only agents с `write_set: []`; repository не менялся.
- **Package A — completed.** Подтвердил, что node IDs в
  `gamePresentationModel` являются metadata поверх generic `GameTable`, а не
  concrete owners; run-away имеет два legacy owners. Plan зафиксировал
  dedicated `RunAwaySurface`, replacement mode-switching choice branch и
  pipeline `monster.bad_stuff_text → CardView.bad_stuff_text`. Также добавлены
  Moscow v5 profile regression и exact runner/config paths без Compose/default
  migration.
- **Package B — completed.** Подтвердил, что 43-state catalog не исполняет
  `semanticCheck`, acceptance references не потребляются, а 18 snapshots
  покрывают только 11 unique states. Plan получил exhaustive direct/compact
  source appendices, exact boundary triples, evidence-layer separation,
  open-sheet focus/a11y gates и per-node baseline admission.
- **Terra adversarial reviewer — completed.** Первый проход нашёл семь P1:
  условный mandatory discard gate, неполный direct-node ledger, неисполняемый
  43-state catalog, неограниченный Bad Stuff field, неявные run-away/death-loot
  negatives, self-attested baseline admission и незакрытый lifecycle record.
  После исправлений второй проход оставил только explicit non-dead death-loot
  negative; добавлены projection/UI absence и server credential rejection.
  Финальный bounded re-check: `READY`, remaining P0/P1 gaps — none.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-08 09:55:11 UTC
- **Подтверждено:** 2026-08-08 10:02:24 UTC; пользователь явно написал
  «даю аппрув, делай» в ответ на exact plan ID.
- **Формулировка/ограничения пользователя:** Пользователь потребовал написать
  новый plan после live Figma/browser проверки. Сохраняются ранее заданные
  ограничения: Figma исчерпывающая, legacy удаляется, игра полностью playable,
  минимальный viewport `360x640`, контрольные widths
  `428/600/768/1024/1280/1400/1920`, visual baselines только после
  side-by-side, push запрещён, read-only subagents используются.
- **Разрешённое расширение write set:** пользователь ранее явно разрешил
  backend additions и расширение scope/write set, если real playability audit
  обнаружит недостающую authority/runtime wiring. После воспроизводимого
  random reachability failure добавлены только test-mode entropy hook в
  `backend/game/internal/application`, его explicit `cmd/server` gate и managed
  harness env; production path сохраняет `crypto/rand`.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Read-only context/conflict scan и два independent planning packages
  завершены; `plan-lint` после synthesis: `plans=74 active=5 archive=69
  issues=0`.
- Terra adversarial review выполнен в три bounded прохода; все P1 отражены в
  plan, финальный verdict — `READY`, implementation не начата.
- Exact approval записан 2026-08-08 10:02:24 UTC; разрешены implementation,
  локальная verification и lifecycle completion, push остаётся запрещён.
- Plan selected current session 2026-08-08 10:03:04 UTC; baseline dirty path —
  только этот plan file.

## Итог

Plan завершён как явно согласованный implementation checkpoint, а не как
Figma-parity completion. Canonical verify и scope-check прошли; текущий diff
сохраняется для продолжения после harness refactor. Late-state visual review,
полный no-update visual green и final parity reviewer остаются deferred.
Push не выполнялся.


