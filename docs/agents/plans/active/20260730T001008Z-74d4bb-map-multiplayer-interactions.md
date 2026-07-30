# PLAN: map multiplayer interactions

- **Plan ID:** `20260730T001008Z-74d4bb-map-multiplayer-interactions`
- **Статус:** draft
- **Создан:** 2026-07-30 00:10:08 UTC
- **Обновлён:** 2026-07-30 00:13:24 UTC
- **Владелец:** Codex
- **Workspace:** shared / `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260729T131042Z-6fe962-lobby-core-game-cycle`.
- **Блокирует:** `20260729T225611Z-bbcbc3-record-future-admin-control-plane`,
  `20260730T001013Z-717040-design-responsive-game-ui-ux` и будущие
  multiplayer interaction implementation plans.
- **Связанные ADR/handoff:** ADR-0001, ADR-0002, ADR-0004, ADR-0007,
  proposed ADR-0008

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/GAME_INTERACTION_PROTOCOL.md",
    "docs/agents/decisions/README.md",
    "docs/agents/decisions/0008-multiplayer-interaction-windows.md",
    "docs/agents/plans/active/20260730T001008Z-74d4bb-map-multiplayer-interactions.md",
    "docs/agents/plans/archive/20260730T001008Z-74d4bb-map-multiplayer-interactions.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [],
  "dependsOn": [
    "20260729T131042Z-6fe962-lobby-core-game-cycle"
  ],
  "sharedResources": [
    "game:multiplayer-interaction-protocol-v1",
    "docs:decision-index"
  ]
}
```

## Цель

До реализации расширения составить полную server-authoritative карту
multiplayer interactions для каждого шага игры: кто и когда может действовать,
какие данные видит, какие команды отправляет, когда окно закрывается либо
скипается, как работают помощь/награда/контрдействия и что происходит при
timeout, reconnect и конкурентных ответах. Зафиксировать решение в ADR-0008 и
детальном `GAME_INTERACTION_PROTOCOL.md` с графами, матрицами и очередью
implementation slices, не выдавая проектируемый протокол за runtime.

## Критерии приёмки

- [ ] Документ содержит end-to-end Mermaid state graph от lobby/setup до
  end-turn и отмечает все места, где возможны self choice, response другого
  игрока, collective window, negotiation, forced interaction или auto-skip.
- [ ] Для каждой фазы и capability приведена interaction matrix:
  initiator, eligible actors, legal intents/cards/targets, public/private
  projection, mandatory/optional response, close condition, timeout policy и
  следующий state.
- [ ] Отдельно разобраны combat interventions, voluntary/forced help,
  предложение награды в сокровищах, accept/decline/cancel/supersede,
  дополнительные монстры/усилители/one-shot modifiers, Run Away, targetable
  curses/effects, trade/gift, charity transfer, theft, death/loot и
  disconnect/reconnect.
- [ ] Формальная модель окна включает stable `interaction_id`, kind,
  parent phase/subject, initiator, eligible actors, allowed intents,
  `opened_at`, authoritative `deadline_at`, extension budget, response state
  и terminal close reason.
- [ ] Для каждого окна определён deterministic legal-action predicate. По
  умолчанию, если ни у одного eligible actor нет разрешённого действия, окно
  и timer не создаются, а переход выполняется сразу через явное domain event.
- [ ] Для predicate по hidden state документируется неизбежный timing
  side-channel: immediate skip публично раскрывает только агрегированный факт
  «legal response отсутствует», но не actor/card/reason. Для interaction kinds,
  где даже такой aggregate чувствителен, выбирается public-capability
  predicate либо indistinguishable minimum window вместо hidden-state skip.
- [ ] Таймеры остаются server-authoritative. Спека выбирает per-window base
  durations, late-action grace formula, maximum extension/cap и правила,
  исключающие last-second sniping, бесконечное продление retry/pass командами
  и griefing; предложенные пользователем 60/30/+10 секунд оцениваются как
  исходный default, а не принимаются без проверки.
- [ ] Pure engine не читает clock: application/scheduler передаёт
  зафиксированный момент либо timeout intent, а accepted action, deadline
  extension, timeout, auto-pass и close reason сохраняются событиями, чтобы
  replay не зависел от текущего времени.
- [ ] Описан restart-safe deadline worker/sweeper: persisted deadline,
  повторный поиск overdue windows после старта, normal optimistic transaction,
  idempotent system command и race policy между timeout и последней player
  command.
- [ ] Help negotiation задаёт server-validated диапазон награды
  `1..max_available_treasures`, одного выбранного helper, момент фиксации
  сделки и обязательное settlement после победы; поздний accept и обещание
  невозможной награды отклоняются.
- [ ] Actor-specific projection не раскрывает actor-specific contents чужой
  руки через eligibility или option lists. Aggregate empty-window timing
  signal классифицирован как осознанная game-visible information либо заменён
  opaque policy по предыдущему критерию. Клиент получает только разрешённый
  descriptor, absolute deadline и server time/offset metadata; countdown
  остаётся advisory.
- [ ] Описаны version/idempotency semantics для одновременных ответов,
  duplicate command, stale version, closed/expired window и reconnect; realtime
  остаётся version-only invalidation.
- [ ] Приведены sequence diagrams минимум для combat intervention, help offer
  и timeout/restart, а также test matrix для engine, application,
  persistence, contracts, privacy и UI consumers.
- [ ] Roadmap делит реализацию на небольшие планы: generic windows/deadlines,
  combat interventions/help, остальные other-player mechanics, frontend
  interaction surfaces и баланс таймингов.
- [ ] Runtime code, migrations, API/Zod contracts, content packs и frontend
  поведение в рамках этого docs-only plan не меняются.

## Контекст и подтверждённое состояние

- ADR-0004 сознательно отложил помощь, торг, forced help, вмешательства в
  чужой бой, targetable effects, trade/gift, charity transfer, theft,
  death-loot и любые multi-actor priority/pass windows.
- `State.Validate`, `setTurnPhase` и `requireActiveActor` сейчас допускают
  ровно одного eligible actor — текущего игрока. `PendingDecision` также
  принадлежит только ему.
- Combat сводится к действиям active player: play one-shot/use ability,
  resolve либо run away. Команд помощи, предложения награды, accept/decline,
  чужого intervention/pass или target player в wire contract нет.
- `available_actions` проецируется только active player; чужая рука видна
  только как `hand_count`. Эту privacy boundary нельзя ослаблять.
- Clock сейчас ставит `occurred_at` event/invalidation envelope. Deadline
  state, scheduler/sweeper и timeout command отсутствуют.
- Даже при отсутствии содержательного выбора текущий flow требует явные
  `resolve_combat`, `loot_room`, `resolve_charity` и `end_turn`; общей
  legal-action auto-skip модели нет.
- Optimistic expected version, idempotency fingerprint, atomic
  event/snapshot/receipt, replay-safe RNG и version-only realtime уже дают
  основу для безопасной сериализации конкурентных multiplayer intents.
- Пользователь предложил начать не с кода, а с карты всех интеракций и
  оптимизировать ожидание: не запускать timer без legal actions и давать
  bounded grace после позднего вмешательства.

## Scope

### Входит

- Новый ADR-0008 с authority, clock, concurrency, privacy и replay решениями.
- `GAME_INTERACTION_PROTOCOL.md` с state graph, interaction catalog,
  sequence diagrams, data model draft, timer/auto-skip rules и test matrix.
- Capability tiers и рекомендуемое разбиение будущей реализации.
- Обновление ADR index.

### Не входит

- Go engine/application/repository/transport code и tests.
- PostgreSQL migrations, scheduler process, background jobs и production
  deployment.
- Zod/HTTP/realtime contract changes.
- Vue components, dialogs, countdowns, animations или browser tests.
- Реализация новых cards/effects либо копирование коммерческих текстов.
- Финальная балансировка длительностей по production telemetry.
- Commit, push и публикация.

## Архитектурный подход

1. Использовать единый tagged `InteractionWindow`, а не отдельные ad-hoc
   boolean flags для помощи, контрдействий и таймеров.
2. Разделить pure transition rules и wall clock orchestration: engine
   проверяет typed intent и применяет уже определённый timeout/close outcome;
   application Clock/sweeper инициирует overdue transition.
3. Материализовать только окна с реальным legal action хотя бы у одного
   eligible actor, когда aggregate availability разрешено сделать
   game-visible. Eligibility вычисляется сервером по authoritative state;
   projection не раскрывает конкретного actor/card/reason. Для sensitive
   interaction kind используется public-capability либо opaque-window policy.
4. Сериализовать одновременные ответы существующим expected-version CAS.
   Первый committed legal transition определяет state; stale/late intent
   fail-closed и может безопасно повторно прочитать projection.
5. Продлевать deadline только после committed material intervention по
   bounded формуле и cap; retries, duplicate receipts, pass/decline и
   rejected commands время не увеличивают.
6. Представлять помощь как отдельную negotiation state machine, а обещанную
   награду — как server-enforced obligation, а не текстовую договорённость UI.
7. Сохранять все закрывающие причины и реализованные outcomes в events.
   Reconnect и process restart восстанавливают тот же pending interaction.
8. Оставить client countdown, modal/sheet и animation чистыми projections:
   UI не открывает, не продлевает и не завершает окно локально.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository-workflow | ADR-0008, interaction protocol map и decision index | Runtime contracts unchanged; future contract sketched only |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/GAME_INTERACTION_PROTOCOL.md` | write | Нормативная карта phases/windows/timers |
| `docs/agents/decisions/README.md` | write | Добавить ADR-0008 в index |
| `docs/agents/decisions/0008-multiplayer-interaction-windows.md` | write | Зафиксировать cross-cutting protocol decision |
| `docs/agents/plans/active/20260730T001008Z-74d4bb-map-multiplayer-interactions.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260730T001008Z-74d4bb-map-multiplayer-interactions.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game:multiplayer-interaction-protocol-v1` | admin-control-plane и responsive-game-ui-ux drafts | этот plan | Сначала протокол; consumers не изобретают свои interaction states |
| `docs:decision-index` | admin-control-plane draft | этот plan первым | Admin plan зависит от этого plan и пишет index позже |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 00:13:24 UTC через
  `leinoctl context --paths backend/game,frontend`.
- **Обнаруженные связи:** admin plan также пишет decision index и проектирует
  battle history; UI/UX plan потребляет interaction surfaces. Frontend
  engineering spec имеет отдельный docs/frontend-instructions scope.
- **Решение:** admin и UI/UX plans явно зависят от этого plan. Runtime plans
  создаются только после принятия protocol map.

## План реализации

1. [ ] Полностью инвентаризировать текущие phases, commands, effects,
   projections и отложенные ADR-0004 interactions.
2. [ ] Составить phase/interaction graph и каталог всех interaction kinds.
3. [ ] Зафиксировать generic window/deadline/auto-skip/concurrency/replay
   model и privacy-safe actor projections.
4. [ ] Разобрать combat/help/reward и timeout/restart sequence diagrams.
5. [ ] Определить capability tiers, test matrix и будущие implementation
   plans без изменения runtime.
6. [ ] Создать ADR-0008, добавить его в decision index и связать с подробной
   картой.
7. [ ] Выполнить canonical checks, scope-check, exact diff review и
   архивировать plan.

## Проверки

- [ ] `node .codex/hooks/plan-lint.mjs`.
- [ ] `./leinoctl text-check --changed`.
- [ ] `./leinoctl verify --changed` на repository Node 24 toolchain.
- [ ] `./leinoctl scope-check --plan 20260730T001008Z-74d4bb-map-multiplayer-interactions`.
- [ ] `git diff --check` и read-only review графов, таблиц, dependencies и
  отсутствия заявлений о реализованном runtime.
- [ ] Go/frontend tests не запускать: production/test code не меняется.

## Риски и откат

- **Риск:** один универсальный protocol превратится в слишком сложную
  абстракцию до первой реализации.
  **Снижение:** capability tiers, один minimal window kernel и отдельные
  implementation slices с конкретными interaction kinds.
- **Риск:** client countdown либо local hand scan станет authority.
  **Снижение:** только server-computed eligibility/deadline; client является
  projection и может лишь отправить intent.
- **Риск:** late-action grace позволяет бесконечно удерживать бой.
  **Снижение:** material-action allowlist, idempotency, extension cap и
  telemetry-ready close reasons.
- **Риск:** auto-skip раскрывает, что у конкретного соперника нет нужной карты.
  **Снижение:** признать immediate skip aggregate timing signal, не показывать
  actor-specific negative evidence и применять opaque/public-capability
  policy там, где aggregate disclosure неприемлем.
- **Риск:** timeout и последняя команда расходятся при race/restart.
  **Снижение:** optimistic transaction, persisted deadline, idempotent system
  command и deterministic committed event order.
- **Откат:** удалить ADR/map и вернуть строку decision index обычным revert;
  runtime/data остаются неизменными.

## Открытые вопросы

- Какие base duration, late threshold, grace и total cap нужны каждому типу
  окна; исходная гипотеза боя — 60 секунд, late zone после 30 секунд и
  +10 секунд за material intervention.
- Для каких interaction kinds aggregate «ни у кого нет legal response»
  допустим как game-visible information, а где нужен opaque minimum window.
- Нужна ли свободная simultaneous-response модель или explicit
  priority/pass order для отдельных interactions.
- Кто инициирует help negotiation: combatant приглашает конкретного игрока,
  другие игроки предлагают помощь либо поддерживаются оба направления.
- Можно ли иметь несколько pending offers при одном выбранном helper, и как
  supersede/cancel влияет на deadline.
- Какие mechanics войдут в первый runtime slice после generic window kernel.
- Как обрабатывать длительно disconnected eligible actor: обычный timeout,
  явный auto-pass либо настраиваемый lobby policy.

## Согласование

- **Статус:** backlog draft; approval intentionally not requested yet
- **Запрошено:** —
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** сначала составить карту/граф
  всех взаимодействий на каждом шаге, затем реализовывать; timer создавать
  только при возможных действиях, bounded-продление защищает от позднего
  вмешательства, а помощь оформляется явным предложением награды и
  accept/decline.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Выполнен read-only аудит current phases, single-actor invariants,
  projections, commands, Clock usage, realtime/idempotency и tests.

## Итог

Заполняется после реализации.
