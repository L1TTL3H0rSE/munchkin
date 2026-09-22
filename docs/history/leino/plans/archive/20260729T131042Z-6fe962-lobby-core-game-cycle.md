# PLAN: lobby core game cycle

- **Plan ID:** `20260729T131042Z-6fe962-lobby-core-game-cycle`
- **Статус:** completed
- **Создан:** 2026-07-29 13:10:42 UTC
- **Обновлён:** 2026-07-29 19:08 MSK
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** нет
- **Блокирует:** будущие планы Moscow content pack, card presentation и AI art pipeline
- **Связанные ADR/handoff:** ADR-0002, ADR-0003, новый ADR-0004

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".gitignore",
    "backend/game/cmd/server/main.go",
    "backend/game/internal/application/service.go",
    "backend/game/internal/application/service_test.go",
    "backend/game/internal/game/**",
    "backend/game/internal/repository/postgres/store_integration_test.go",
    "backend/game/internal/transport/httpapi/router.go",
    "backend/game/internal/transport/httpapi/router_test.go",
    "content/README.md",
    "content/reference-local/**",
    "content/schema/card-set.schema.json",
    "content/sets/demo/cards.json",
    "content/tools/digest.mjs",
    "content/tools/validate.mjs",
    "content/tools/validate.test.mjs",
    "docs/agents/ARCHITECTURE.md",
    "docs/agents/decisions/0004-lobby-core-cycle-and-interaction-boundary.md",
    "docs/agents/plans/active/20260729T131042Z-6fe962-lobby-core-game-cycle.md",
    "docs/agents/plans/archive/20260729T131042Z-6fe962-lobby-core-game-cycle.md",
    "docs/game/first-edition-core-cycle.md",
    "frontend/applications/web/app/assets/main.css",
    "frontend/applications/web/app/components/**",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/pages/index.vue",
    "frontend/applications/web/package.json",
    "frontend/applications/web/test/**",
    "frontend/pnpm-lock.yaml",
    "frontend/packages/contracts/src/index.ts",
    "frontend/packages/contracts/test/**"
  ],
  "components": [
    "repository-workflow",
    "game-content",
    "go:backend/game",
    "frontend-workspace"
  ],
  "contracts": [
    "content:card-set-v1",
    "content:effect-registry-v1",
    "game:http-v1",
    "game:events-v1"
  ],
  "dependsOn": [],
  "sharedResources": [
    ".gitignore",
    "content:card-set-v1",
    "content:effect-registry-v1",
    "game:http-v1",
    "game:events-v1",
    "content-set:demo-original"
  ]
}
```

## Цель

Довести bootstrap vertical slice до полного самостоятельного игрового цикла
активного игрока в lobby: несколько участников по очереди проходят setup,
открытие двери, собственные card actions, бой или поиск неприятностей/обыск
комнаты, побег/Bad Stuff, награды, charity и завершение хода, но пока не могут
вмешиваться в чужой ход или обмениваться ресурсами.

Основной runtime остаётся lobby game, а технический preview profile разрешает
одного участника для демонстрации того же самого цикла без отдельной ветки
правил. Механическая база — официальные правила и FAQ английского Munchkin
First Edition; русские издания используются только локально как языковой
референс для будущего полностью оригинального набора «Московский манчкин».

## Критерии приёмки

- [x] Новая игра фиксирует immutable rules profile/version вместе с
  `content_set_id`, content version и digest; preview profile поддерживает
  1–6 игроков, чередует ходы lobby-участников и при одном игроке возвращает ход
  тому же actor без отдельной solo-логики.
- [x] Setup раздаёт каждому игроку четыре Door и четыре Treasure card instance,
  последовательно даёт каждому actor разыграть допустимые стартовые карты и
  требует явный `finish_setup`; первая Door недоступна, пока setup не завершили
  все lobby players. Чужие руки и порядок колод не раскрываются.
- [x] Реализован полный non-interactive turn graph: подготовка собственных карт,
  Kick Open The Door, немедленное self-применение открытой Curse, обязательный
  бой с открытым Monster, выбор Look For Trouble либо Loot The Room после
  немонстра, combat/reward или Run Away/Bad Stuff, charity и переход хода.
- [x] Character state поддерживает Level 1–10, class/race-like traits,
  зарегистрированные character tags для card restrictions,
  hand/in-play/carried/equipped/discard zones, предметные слоты и hands,
  Big/Small ограничения, боевые и escape modifiers, стоимость/продажу
  предметов и лимит руки; клиент не вычисляет эти ограничения.
- [x] Бой выигрывается только при большей силе, если typed ability явно не
  разрешает ничью; награды выдаются только после завершения всего боя,
  победный Level 10 достигается убийством Monster либо явным разрешённым
  исключением.
- [x] Run Away использует server RNG, сохраняет реализованный бросок в event,
  применяет typed Bad Stuff, включая потерю level/card/item и death; replay не
  выполняет RNG повторно.
- [x] `run_away` разрешён только после закрытия собственного combat action
  window, когда итоговая сила игрока не побеждает Monster. При выигрывающей
  силе server предлагает/принимает resolve win, а попытку побега отклоняет;
  typed tie-win ability учитывается до определения доступного action.
- [x] Исчерпавшаяся колода детерминированно пересобирается из своего discard;
  shuffle outcome фиксируется в event. Каждый card instance во все моменты
  принадлежит ровно одной zone.
- [x] Card definitions отделены от card instances и поддерживают количество
  копий. Presentation text не исполняется; mechanics используют только
  закрытые typed triggers, predicates, selectors и effect kinds.
- [x] Definition, требующая отключённой interaction capability, не попадает в
  materialized deck `first-edition-core-v1`, а не разыгрывается как no-op.
- [x] Существующий `content:card-set-v1` расширен совместимо для текущего demo
  pack либо мигрирован атомарно со всеми Go/Node/frontend consumers; legacy
  bootstrap fixtures и replay имеют явный тестируемый результат.
- [x] Demo pack остаётся полностью оригинальным и содержит достаточно
  придуманных карт, чтобы пройти каждую core-ветку и каждый поддержанный
  effect kind без коммерческих названий, текстов, art или trade dress.
- [x] `content/reference-local/` игнорируется Git. В нём локально создан
  проверяемый index на 168 позиций First Edition. Каждая запись содержит
  ordinal, deck, публичное название, source locator, нейтральный
  `mechanical_synopsis`, mechanic tags, interaction scope, registry coverage,
  adaptation status и пустые/рабочие поля будущей Moscow-card адаптации, но не
  скан, оригинальный rules text или art. Runtime, pack digest и committed tests
  от index не зависят.
- [x] Actor-specific HTTP projection возвращает только допустимые действия и
  видимые варианты текущего решения. Command fingerprint включает canonical
  payload/selection, а чужой либо устаревший action отклоняется без событий.
- [x] Nuxt UI позволяет пройти весь цикл, выбрать карту/предмет/действие и
  показывает server-calculated character/combat state; длинный текст остаётся
  HTML, а не частью изображения.
- [x] Существующие privacy, replay, idempotency, expected-version и atomic
  receipt/event/snapshot инварианты сохранены и расширены тестами нового цикла.
- [x] Charity в non-interactive profile требует выбрать и сбросить excess до
  актуального hand limit; передача другому player отсутствует. При death
  сохраняются Level, Class/Race-like traits, их multi-trait attachments и
  persistent Curses; прочие hand/in-play cards уходят в свои discard без
  looting body. Player оживает при начале следующего lobby turn и в начале
  следующего собственного хода получает четыре Door + четыре Treasure до
  обычной подготовки; при одном игроке это его непосредственно следующий ход.

## Контекст и подтверждённое состояние

- Repository чист до создания этого draft; других active plans нет.
- `internal/game` уже является pure event-driven engine, а application
  атомарно сохраняет events/snapshot/receipt и строит actor-specific
  projection.
- Текущий bootstrap требует 2–4 игроков, раздаёт 2 Door + 2 Treasure, завершает
  игру на Level 5 и знает только фазы `open_door`, `combat_decision`,
  `loot_decision`, `end_turn`.
- Текущий combat использует `>=`, хотя базовое правило требует строго большую
  силу; текущий `loot` берёт Treasure, хотя Loot The Room должен брать закрытую
  Door.
- Player сейчас содержит только level, плоский `combat_bonus` и hand. Нет
  character traits, equipment/zones, card play, sale, hand limit, Bad Stuff
  variants, death и deck reshuffle.
- Card schema допускает только `monster`, `curse`, `door`, `treasure` и три
  числовых mechanical field. Unknown fields fail-closed; pack уже фиксирует
  author/license/source и identity.
- Frontend уже получает `available_actions` от backend и отдельно отображает
  local image и HTML `rules_text`, но не поддерживает typed decisions.
- Официальный First Edition core set содержит 168 карт: 95 Door и 73 Treasure.
  Официальный продукт рассчитан на 3–6 игроков; разрешение одного игрока здесь
  является preview harness для того же core cycle, не новой независимой игрой.
- Baseline фиксируется как актуальные official English First Edition rulebook,
  FAQ, errata и card list на 2026-07-29; анонсированный Munchkin Second Edition
  не входит.
- Правила конкретных карт могут переопределять общие правила. Этот plan
  реализует полный rulebook core и закрытый framework эффектов.

## Зафиксированный rules baseline

- **Издание:** Munchkin First Edition, текущий English core set/card list
  September 2024; не original 2001 printing и не Munchkin Second Edition.
- **Rulebook:** `https://munchkin.game/site-munchkin/assets/files/1138/munchkin_rules-1.pdf`,
  получен 2026-07-29, 10,666,974 bytes,
  SHA-256 `26c797604dc0f28788461e4545cc4ea8a434cde90773719fb5ffd35b1bd8fb65`.
- **General rulings cutoff:** `https://munchkin.game/gameplay/faq/` и
  `https://munchkin.game/gameplay/faq/changelog.html` по состоянию на
  2026-07-29. Expansion/accessory-specific FAQ не расширяет scope.
- **Composition/index:** `https://munchkin.game/products/games/munchkin/` по
  состоянию на 2026-07-29: 168 physical cards, 95 Door и 73 Treasure.
- В committed rules note сохраняются только ссылки, hash, фактические
  mechanics и наши краткие формулировки. Raw PDF/HTML, scans и commercial card
  rules text в repository не копируются.

Минимальная mechanics matrix этого plan:

- setup 4+4, unique instances, definition copies, separate Door/Treasure
  draw/discard и deterministic reshuffle;
- Level floor 1, winning Level 10, kill/non-kill distinction и запрет обычного
  Go Up A Level/sale как winning level;
- character tags, одна/несколько Class/Race-like traits, Half-Breed/
  Super-Munchkin-like attachments и discard/change trait;
- carried/equipped Items, Headgear/Armor/Footgear/Hands slots, Big/Small,
  use restrictions, Cheat-like restriction bypass и hand-limit modifiers;
- item gold value, sale batches по 1,000 без сдачи и без winning level;
- static/conditional player и Monster combat modifiers, discard-as-cost,
  one-shot self/monster modifiers, tie-win override и monster reward modifiers;
- face-up self Curse, persistent effect, lose level/card/trait/equipment,
  change character tag и effect-choice selectors;
- Monster level, conditional strength, pursuit threshold, Run Away modifier,
  automatic escape/defeat, lethal vs non-lethal defeat, rewards и typed
  Bad Stuff primitives;
- death preservation/revival/redeal, charity discard profile и full
  actor-authorized turn rotation.

Multiplayer-only mechanics — steal/backstab другого player, help, forced help,
trade/gift, targeted Curse/GUAL, charity transfer, other-player combat
modifier, Wandering Monster/Mate/additional Monster и looting body — получают
явный `requires_interaction`/deferred classification, но не runtime no-op.

## Scope

### Входит

- Зафиксировать в ADR/rules note authoritative source order: executable tests
  и schema, согласованный plan, официальный English First Edition
  rulebook/FAQ/errata; русский текст — только linguistic reference.
- Ввести immutable `first-edition-core-v1` rules profile с отключёнными
  other-player reactions, help, trade и targeted interference.
- Перестроить engine state вокруг уникальных card instances, явных zones,
  character loadout, encounter/combat context и pending decision/action
  window, в котором сейчас eligible только active actor.
- Добавить typed commands/payloads для play/equip/unequip/discard/sell,
  `finish_setup`, Look For Trouble/Loot The Room, combat action/pass/resolve,
  Run Away, effect choice, charity и end turn.
- Добавить domain events/reducer для card moves, selections, realized
  shuffle/die outcomes, rewards, Bad Stuff, death и turn advance.
- Расширить closed content schema/Go registry/Node validator и original demo
  pack нужными card definitions, quantities, restrictions, triggers и effects.
- Расширить HTTP/application fingerprint/projection, Zod contracts и Nuxt UI
  синхронно.
- Подключить для web package существующий workspace-catalog Vitest как
  dev-only dependency и покрыть pure UI action/decision mapping; lockfile
  меняется только вследствие этой importer declaration.
- Добавить ignored local reference index и документировать, что он не является
  runtime content и не попадает в Git.
- Обновить архитектурную документацию только в части rules profile,
  interaction seam, zones и content/runtime boundary.

### Не входит

- Помощь в бою, переговоры о Treasure, вмешательство в чужой combat, Wandering
  Monster от другого actor, targeted Curse, кража, торговля, подарки, передача
  charity и looting другого player's body.
- Multiple-monster combat и самостоятельное добавление второго Monster в
  encounter; core encounter этого plan содержит одного Monster.
- Сетевые response timers, priority/pass между несколькими actors и realtime
  публикация card/action payload; realtime остаётся version-only invalidation.
- Полная цифровая копия 168 коммерческих cards, оригинальные rules texts,
  русские переводы, scans, illustration, рамка, логотип, шрифт или trade dress.
- Готовые 168 карт «Московского манчкина», литературная редактура их русского
  текста, балансировка и playtest.
- Card-frame design, image generation, prompt UI/queue/provider integration и
  export карточек для печати.
- Production OIDC, matchmaking, spectators, bots, mobile app, migrations и
  новые runtime dependencies.
- Munchkin Second Edition и последующие expansion rules.
- Гарантия semantic parity для уникального commercial card exception, которое
  отсутствует в официальном rulebook/FAQ и ещё не описано оригинальным
  Moscow-card requirement. Такое расширение registry требует следующего plan.

## Архитектурный подход

- Backend остаётся authoritative. Command содержит только intent и выбранные
  видимые IDs; actor, card draw, deck position, legal targets, modifier total,
  die/shuffle outcome и награда определяются server-side.
- `RulesProfileID + version` сохраняются в game creation event/state и
  определяют player bounds, hand limit, winning rule и включённые interaction
  capabilities. `first-edition-core-v1` разрешает 1–6 участников для preview,
  но не создаёт special-case solo reducer.
- Profile явно заменяет Charity transfer на actor-selected discard и looting
  body на discard всех lootable cards; остальные Death preservation/revival
  правила остаются зафиксированными в acceptance criteria.
- Initial preparation использует последовательное setup-window в lobby order:
  actor выполняет собственные play/equip commands и завершает обязательным
  `finish_setup`; после последнего ready player первый actor получает обычное
  turn-preparation window. В последующих ходах `open_door` сам завершает
  необязательную подготовку.
- Pack хранит уникальные CardDefinition с `copies`; при старте engine
  детерминированно материализует уникальные CardInstance IDs. State хранит
  instance IDs, а mechanics читает immutable definition registry.
- PendingDecision является tagged union с actor и allowlisted visible options.
  ActionWindow содержит eligible actors; в этом plan список всегда состоит из
  active actor. Будущий multiplayer plan расширит окно, не переписывая core
  phase transitions.
- Effects являются closed discriminated union. Общие effects параметризованы
  безопасными enums/числами/selectors; действительно особая механика получает
  отдельный зарегистрированный handler. Free-form expression, eval,
  JavaScript/Lua и parsing `rules_text` запрещены.
- Events фиксируют irreversible choices и realized randomness. Apply/Replay
  только перемещает instances и применяет записанный outcome; отказ команды не
  создаёт event.
- Application canonical fingerprint включает command type, expected version и
  normalized payload. Snapshot/events/receipt остаются одной transaction.
- Internal State не сериализуется. Projection формирует allowlist для actor:
  собственные hand/loadout/choices, публичное состояние других players и
  counts закрытых zones без deck order.
- Существующие v1 contracts являются bootstrap-only и пока не опубликованы.
  Они расширяются атомарно вместе со всеми in-repo consumers; старые event
  types по возможности продолжают replay, а несовместимый local bootstrap
  snapshot получает явную диагностическую ошибку. Автоматического удаления
  local data нет.
- Ignored reference index используется только человеком для адаптации.
  Committed validators/tests не читают его, чтобы build оставался
  воспроизводимым на clean clone.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository-workflow | `.gitignore`, ADR, architecture/rules note, lifecycle plan | Plan manifest/write set, ignored reference boundary |
| game-content | Definitions/instances metadata, typed effect schema, validator, original demo | `content:card-set-v1`, `content:effect-registry-v1` |
| go:backend/game | Rules profile, state machine, events, projection, application payload | `game:events-v1`, `game:http-v1` |
| frontend-workspace | Zod decision/action contract and complete turn UI | `game:http-v1` consumer |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.gitignore` | write | Исключить private reference catalog до его создания |
| `backend/game/cmd/server/main.go` | write | Подключить rules profile/content bootstrap при изменении constructor wiring |
| `backend/game/internal/game/**` | write | Pure rules engine, models, events, content registry, projection и tests |
| `backend/game/internal/application/{service.go,service_test.go}` | write | Typed payload fingerprint/idempotency и application tests |
| `backend/game/internal/repository/postgres/store_integration_test.go` | write | Адаптировать direct `Service.Execute` consumer и transaction race assertions |
| `backend/game/internal/transport/httpapi/{router.go,router_test.go}` | write | Command parsing/routes/contract fixtures |
| `content/schema/card-set.schema.json` | write | Closed content contract |
| `content/tools/digest.mjs` | write | Canonical content digest tooling |
| `content/tools/{validate.mjs,validate.test.mjs}` | write | Semantic validation/digest tests |
| `content/sets/demo/cards.json` | write | Versioned original coverage pack |
| `content/README.md` | write | Authoring/reference boundary |
| `content/reference-local/**` | write | Private 168-slot adaptation index, never staged |
| `frontend/packages/contracts/src/index.ts` | write | Zod wire contract |
| `frontend/packages/contracts/test/**` | write | Contract/conformance tests |
| `frontend/applications/web/app/{components/**,composables/useGameApi.ts,pages/index.vue,pages/game/[id].vue,assets/main.css}` | write | Typed decision UI |
| `frontend/applications/web/package.json` | write | Web test script and existing catalog Vitest dev dependency |
| `frontend/applications/web/test/**` | write | Focused UI action/decision tests |
| `frontend/pnpm-lock.yaml` | write | Workspace importer update for web Vitest declaration |
| `docs/game/first-edition-core-cycle.md` | write | Non-expressive mechanics baseline/deferred matrix |
| `docs/agents/ARCHITECTURE.md` | write | Rules profile/action-window/zone boundary |
| `docs/agents/decisions/0004-lobby-core-cycle-and-interaction-boundary.md` | write | Cross-layer decision |
| `docs/agents/plans/active/20260729T131042Z-6fe962-lobby-core-game-cycle.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260729T131042Z-6fe962-lobby-core-game-cycle.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `.gitignore` | нет | этот plan | Изменить первым, проверить `git check-ignore` |
| `content:card-set-v1` и effect registry | нет | этот plan | Schema → Node validator → Go consumer → frontend projection |
| `game:events-v1` | нет | этот plan | Events/replay tests до application/transport |
| `game:http-v1` | нет | этот plan | Backend fixture → Zod conformance → UI |
| `demo-original` pack identity | нет | этот plan | Новая content version/digest; старую identity не мутировать молча |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-29 16:14 MSK через
  `./leinoctl context --paths backend,content,frontend,.gitignore,docs/agents`
- **Обнаруженные пересечения:** нет; до создания этого draft active plans
  отсутствовали
- **Решение:** plan exclusive из-за одновременного изменения public contracts,
  demo pack и `.gitignore`; write-сабагенты в shared worktree запрещены

## План реализации

1. [x] Зафиксировать ADR-0004 и concise mechanics/deferred matrix без
   commercial card text; записать exact First Edition sources и rules profile.
2. [x] Добавить `.gitignore` boundary и создать local ignored 168-slot
   reference index; проверить count/schema и отсутствие в Git status.
3. [x] Расширить content model, definition quantity, typed effect union,
   semantic validator, digest/conformance и original demo coverage pack.
4. [x] Перестроить pure engine state/events/reducer вокруг instances, zones,
   rules profile, pending decisions и полного core turn graph.
5. [x] Расширить application payload fingerprint, HTTP parsing/projections и
   rejection/privacy/idempotency tests.
6. [x] Обновить Zod contracts и Nuxt UI для server-supplied actions, choices,
   character zones, combat и charity без локального вычисления правил.
7. [x] Выполнить focused и canonical checks, просмотреть diff/UTF-8, выполнить
   `verify --changed` и scope-check.
8. [x] Записать фактические результаты, отметить checklist, перевести plan в
   `completed` и перенести тот же файл в archive.

## Проверки

- [x] `git check-ignore content/reference-local/first-edition-index.json`.
- [x] Локальная проверка reference index: ровно 168 entries, 95 Door и
  73 Treasure; у каждой записи есть source locator, paraphrased mechanical
  synopsis/tags, interaction classification, registry coverage и adaptation
  fields; отсутствуют original `rules_text`, image/binary data и runtime
  imports.
- [x] `node --test content/tools/validate.test.mjs`.
- [x] `node content/tools/digest.mjs content/sets/demo/cards.json` совпадает с
  Go digest fixture.
- [x] `node content/tools/validate.mjs content/sets/demo/cards.json`.
- [x] Go/Node content digest and invalid-fixture conformance.
- [x] `(cd backend/game && go test ./...)`.
- [x] Engine transition/rejection/replay/golden tests полного turn graph.
- [x] Invariant tests: unique instance zone ownership, legal equipment,
  rewards-after-combat, winning Level restriction, deterministic reshuffle и
  no RNG during replay.
- [x] Setup tests требуют `finish_setup` каждого actor; Run Away rejection test
  запрещает побег при уже выигрывающей силе и разрешает его только после
  losing combat resolution.
- [x] Application/HTTP tests: canonical payload reuse/conflict, stale version,
  wrong actor/phase/selection, rollback и private projection.
- [x] `(cd frontend && pnpm lint)`.
- [x] `(cd frontend && pnpm --filter @munchkin/web test)`.
- [x] `(cd frontend && pnpm check)`.
- [x] `(cd frontend && pnpm build)`.
- [x] Zod fixtures против Go HTTP fixtures и direct UI consumer.
- [x] Обязательный native runtime + browser smoke: lobby с двумя players
  проходит setup и по одному полному non-interactive turn каждого; отдельная
  one-player preview game возвращает ход тому же actor. Если внешний runtime
  blocker не позволяет выполнить smoke, plan не помечается completed.
- [x] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs`.
- [x] `(cd tools/leinoctl && node --test)`.
- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl preflight`.
- [x] `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260729T131042Z-6fe962-lobby-core-game-cycle`.
- [x] Финальный `git diff --check`, diff review и `git status --short`.

## Риски и откат

- **Риск:** state-space core rules значительно больше bootstrap slice, а
  уникальные card exceptions могут незаметно превратить schema в script DSL.
  **Снижение:** closed effect union, mechanics matrix, representative original
  fixtures и отдельный handler для исключений.
- **Риск:** упрощённое окно одного actor может потребовать переписать combat
  при добавлении multiplayer. **Снижение:** сразу сохранить ActionWindow,
  eligible actors и PendingDecision как отдельные concepts, но реализовать
  только active actor.
- **Риск:** изменение snapshot/event/content shape ломает уже созданные local
  bootstrap games. **Снижение:** replay legacy fixtures, additive defaults где
  безопасно и явная incompatible-state ошибка; никакого автоматического
  удаления БД.
- **Риск:** private reference catalog случайно попадёт в Git либо станет
  runtime dependency. **Снижение:** ignore до создания, `git check-ignore`,
  clean-clone checks и запрет imports/links из committed files.
- **Риск:** scope может разрастись до написания Moscow pack и art tooling.
  **Снижение:** эти артефакты явно вынесены в последующие plans.
- **Откат:** до публикации откат выполняется обычным обратным patch/revert
  только файлов write set. Immutable demo identity не переписывается после
  использования; создаётся следующая version. Reset/stash/force checkout и
  удаление пользовательских local references не используются.

## Открытые вопросы

- Нет блокирующих. Принятые для согласования допущения:
  `first-edition-core-v1` является lobby preview profile на 1–6 игроков;
  один игрок использует тот же reducer; face-up Curse действует на текущего
  игрока, а розыгрыш Curse на другого actor отложен; English First Edition
  authoritative для mechanics, русский материал authoritative только для
  будущего tone/wording.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-29 16:14 MSK
- **Подтверждено:** 2026-07-29 16:37 MSK
- **Формулировка согласования:** «Я согласовываю 1 план».
- **Формулировка/ограничения пользователя:** обычная lobby game, пока без
  взаимодействия игроков; полный собственный игровой цикл; один игрок допустим
  для demo; commercial reference JSON только ignored/local; собственная рамка
  и иллюстрация; mechanics по original First Edition; русский перевод только
  linguistic reference; будущая оригинальная колода — «Московский манчкин».

## Ход выполнения

- Draft создан атомарно и заполнен после read-only исследования; пользователь
  явно согласовал plan 2026-07-29 в 16:37 MSK.
- Plan выбран для session `019fadf1-0b87-76c1-a798-011cccc65fb8` командой
  `leinoctl plan select` в 16:37 MSK; статус переведён в `in_progress`.
- Реализован pure deterministic engine `first-edition-core-v1` для 1–6
  участников с единым reducer для lobby и one-player preview, полным setup 4+4,
  ходом, боем, побегом/Bad Stuff, death/revival, charity, продажей и loadout.
- Расширены closed content schema/effect registry, Go/Node validators и
  оригинальный demo pack: 36 definitions, 40 Door, 30 Treasure и 2
  interaction-only copies, исключённые из core profile.
- Расширены HTTP projection, idempotent command payloads, Zod contracts и Nuxt
  UI; realtime invalidation использует version-drain resync и recovery после
  разрыва.
- Создан игнорируемый local reference index: 168 записей, 95 Door и
  73 Treasure; обязательные adaptation metadata заполнены, commercial rules
  text, изображения и binary data отсутствуют, runtime его не импортирует.
- Native browser smoke пройден без console errors: two-player game
  `game_760bb7544ad31206fd9586d1c3d31cc8` вернулся к Alice после полного хода
  Alice и Bob на version 14; one-player preview
  `game_2f9549f0de41672cd0703da79fc84895` вернулся к тому же actor на version 8.
- Read-only reviews закрыли замечания по equipment/Cheat cleanup, исчерпанию
  Treasure rewards, sale cleanup и Unicode parity; финальный повторный review
  не обнаружил actionable findings.
- `leinoctl verify --changed` и scope-check завершились успешно 2026-07-29.
  Для запуска pnpm-команд использован Node 24.14.0 и
  `pnpm_config_verify_deps_before_run=false`: это отключило повторную
  supply-chain age-проверку уже установленного lockfile, но не пропустило ни
  один canonical project check.

## Итог

Полный согласованный plan №1 реализован. Backend остаётся authoritative,
случайность фиксируется событиями, replay не повторяет RNG, а actor-specific
projection не раскрывает чужие руки или порядок колод. Мультиплеерное
вмешательство сознательно оставлено за границей profile и может быть добавлено
следующим plan поверх action-window/interaction seam.

Фактические результаты:

- content validator tests: 12/12; demo pack digest
  `sha256:3f32638963d1e77243ba746023153214482e6e7e4ca202ea99553e4e26018acf`;
- Go: все пакеты `backend/game` прошли;
- frontend: contracts 4/4, web 10/10, lint, typecheck и production build
  прошли; build вывел только upstream Node deprecation warning;
- repository harness: hooks 42/42, leinoctl 63 passed/1 skipped из-за
  недоступного Windows symlink permission, plan-lint без issues, preflight,
  text-check, canonical verify и scope-check прошли;
- `git diff --check` чист, local reference подтверждён через `git check-ignore`;
  commit и push не выполнялись.
