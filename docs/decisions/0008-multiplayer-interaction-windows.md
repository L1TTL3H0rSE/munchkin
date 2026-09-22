# ADR-0008: Server-authoritative multiplayer interaction windows

- **Статус:** accepted
- **Дата:** 2026-07-30

## Контекст

ADR-0004 намеренно оставил current lobby core cycle single-actor. Runtime
поддерживает 1–6 участников и полный поочерёдный ход, но `ActionWindow`,
`PendingDecision`, commands и projections разрешают действовать только active
player. Помощь, награда helper, interventions, additional Monsters,
targetable effects, trade/gift/charity transfer, theft и death loot отложены.

Эти mechanics создают общую cross-cutting задачу:

- несколько actors могут отвечать почти одновременно;
- legal action часто зависит от hidden hand;
- ожидание не должно быть бесконечным;
- timeout/restart не может зависеть от browser или in-memory timer;
- late intervention не должно выигрывать только из-за network timing;
- accepted help reward должна исполняться сервером;
- replay обязан получить тот же close/outcome без чтения clock;
- projection не может раскрывать чужие cards через eligibility/options/timing.

Existing exact version, idempotency fingerprint, atomic
events/snapshot/receipt и actor-specific resync являются фундаментом, но
persisted deadline, timeout system command и due worker отсутствуют.

## Решение

### One generic window kernel

Future multiplayer profile использует tagged persisted
`InteractionWindow`, а не отдельные booleans/timers для каждой mechanics.
Window включает:

- stable opaque `interaction_id`;
- closed `kind`;
- parent phase/subject и optional parent interaction;
- initiator и authoritative eligible actors;
- registered allowed intent kinds;
- eligibility/visibility policy;
- server-fixed `opened_at` и absolute `deadline_at`;
- deadline revision и remaining extension budget;
- per-actor response state;
- terminal close reason.

Engine остаётся pure. Application передаёт fixed `accepted_at` либо typed
system timeout intent. Open/response/extension/auto-pass/timeout/close и
realized random outcomes сохраняются events; replay только применяет их.

### Legal predicates and privacy

Каждый kind имеет deterministic server predicate. Client получает только
actor-specific descriptors и не сканирует чужие hands.

Три policy:

1. `public_predicate`: если legal action публично отсутствует у всех, window и
   timer не создаются; explicit event фиксирует aggregate auto-skip.
2. `actor_private`: private choices видит только их owner.
3. `opaque_public_set`: если сам факт наличия response в hidden hand
   чувствителен, window всегда открывается для public-derived actor set.
   Actor без legal response видит только `pass`.

Internal eligible list, чужие response states и options не публикуются.
Sensitive SSE reason coarse (`interaction_changed`); realtime остаётся
version-only invalidation.

### Timing defaults

Target defaults:

| Window | Duration |
|---|---:|
| Collective combat response | 60 s |
| Addressed/private/priority response | 30 s |
| Late zone | после 30 s от combat `opened_at` |
| Material intervention grace | +10 s |
| Absolute combat cap | 90 s от `opened_at` |

Только committed material intervention может добавить +10. Pass, decline,
cancel/supersede, retry, duplicate, reconnect, stale/rejected intent и timeout
не продлевают окно. Deadline revision меняется атомарно с state/events.

Action допустим при server-fixed `accepted_at < deadline_at`. Application
sample-ит clock один раз внутри locked per-game transaction после чтения
current state и сохраняет тот же instant в event; pre-lock arrival time не
резервирует action. Client countdown advisory и получает absolute deadline +
server time metadata.

### Concurrency and restart

Simultaneous intent model является default. Existing expected-version CAS
сериализует commits; stale responder делает actor-specific resync и при
наличии descriptor отправляет новый intent. Explicit seat priority
используется только для contested scarce object, например death loot.

Persisted deadline получает searchable PostgreSQL materialization с максимум
одной active row на `(game_id, interaction_id)`, обновляемую атомарно со
snapshot/events. Startup/periodic sweeper:

1. находит overdue candidate;
2. входит в normal per-game transaction;
3. recheck-ит interaction ID/revision, затем sample-ит clock под lock;
4. выполняет typed system timeout;
5. сохраняет events/state/deadline update;
6. публикует invalidation после commit.

System key стабилен как
`timeout:<interaction_id>:<deadline_revision>`. Player-versus-timeout и два
workers проходят одну transaction/CAS boundary; только один append выигрывает.
Post-commit invalidation остаётся best-effort: publish failure не откатывает
timeout, а reliable delivery/outbox является отдельным follow-up.

Transport disconnect не считается pass. Actor остаётся pending, reconnect
восстанавливает тот же window/deadline, а deadline записывает auto-pass либо
typed mandatory outcome.

### Help

Только внутри уже открытого collective combat window combatant предлагает
одному конкретному living helper integer reward в диапазоне
`1..max_available_treasures`. Одновременно существует не более одного pending
offer. Offer deadline ограничен parent combat deadline; parent timer не
приостанавливается.

До accept combatant может cancel/supersede, но это не продлевает parent и
поэтому не создаёт infinite negotiation. После accept helper и reward
immutable. Victory draw/settlement атомарно передаёт helper exact promised
count по canonical server allocation; transition, делающий obligation
неисполнимой, illegal. При defeat/escape условная obligation закрывается без
выплаты.

Forced help также фиксирует ровно одного helper. Его consent/reward определяет
typed effect; default forced reward v1 равен zero.

### Implementation order

Первый implementation путь:

```text
generic window/replay/projection
  -> durable deadlines + sweeper
  -> combat intervention + one helper/reward
  -> frontend combat interaction surface
  -> target/Run Away/death/social mechanics
  -> timing balance
```

Каждый slice получает отдельный approved plan. Этот ADR не меняет runtime.

## Последствия

Положительные:

- один tested kernel покрывает help, reactions, target choices и timeout;
- exact CAS/receipt semantics сохраняются;
- restart не теряет deadline;
- hidden-hand response не раскрывается immediate empty-window timing;
- late action получает bounded response time без бесконечного griefing;
- accepted reward исполняется engine, а не честностью UI;
- admin/history сможет строить redacted timeline по stable kind/close reason.

Стоимость:

- opaque window иногда ждёт даже при отсутствии hidden legal action;
- simultaneous responders после чужого commit должны resync;
- deadline index/system receipt требуют migration/application work;
- 60/30/+10/90 являются стартовым balance contract и потребуют playtest;
- contested mechanics требуют explicit priority exception;
- projections/contracts/UI становятся actor- и window-aware.

## Отклонённые альтернативы

- Client timer либо client-calculated eligibility.
- In-memory `time.After` без persisted deadline/restart scan.
- Re-run RNG/clock during replay.
- Immediate hidden-hand scan с public skip.
- Публикация `eligible_actor_ids`, per-actor pass status или чужих option IDs.
- Global seat-priority для всех reactions.
- Unbounded +10 либо extension от pass/retry/reconnect.
- Несколько accepted helpers или free-text reward promise.
- Immediate auto-pass при SSE disconnect.
- Один большой implementation plan для workers, content, API и frontend.

## Совместимость и follow-up

Current `first-edition-core-v1`, HTTP/Zod schemas, event registry и migration
остаются без изменений. Future stored window/event schema получает explicit
versioning и migration/replay tests. Old games не угадывают новые fields.

Полная phase/capability map, projection rules, sequence diagrams, test matrix
и retrospective choices:
[Multiplayer interaction protocol](../GAME_INTERACTION_PROTOCOL.md).

Связанные решения:

- [ADR-0002](0002-authoritative-deterministic-game-engine.md)
- [ADR-0004](0004-lobby-core-cycle-and-interaction-boundary.md)
