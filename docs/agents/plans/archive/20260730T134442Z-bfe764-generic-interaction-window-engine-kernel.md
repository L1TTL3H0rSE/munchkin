# PLAN: generic interaction window engine kernel

- **Plan ID:** `20260730T134442Z-bfe764-generic-interaction-window-engine-kernel`
- **Статус:** completed
- **Создан:** 2026-07-30 13:44:42 UTC
- **Обновлён:** 2026-07-30 14:51:46 UTC
- **Владелец:** Codex session `019fb36e-5e67-7aa0-9e55-b5e58c8ec116`
- **Workspace:** `/Users/kolyalis/Dev/munchkin`
- **Ветка:** `codex/generic-interaction-window-engine-kernel`
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260730T001008Z-74d4bb-map-multiplayer-interactions`.
- **Блокирует:** будущие interaction projection/persistence и combat/help
  implementation plans
- **Связанные ADR/handoff:** ADR-0008, `GAME_INTERACTION_PROTOCOL.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "backend/game/internal/game/model.go",
    "backend/game/internal/game/engine.go",
    "backend/game/internal/game/rules.go",
    "backend/game/internal/game/event.go",
    "backend/game/internal/game/interaction_window_test.go",
    "docs/agents/plans/active/20260730T134442Z-bfe764-generic-interaction-window-engine-kernel.md",
    "docs/agents/plans/archive/20260730T134442Z-bfe764-generic-interaction-window-engine-kernel.md"
  ],
  "components": [
    "go:backend/game"
  ],
  "contracts": [
    "game:events-v1"
  ],
  "dependsOn": [
    "20260730T001008Z-74d4bb-map-multiplayer-interactions"
  ],
  "sharedResources": [
    "game:interaction-window-engine-kernel-v1"
  ]
}
```

## Цель

Реализовать первый узкий runtime slice ADR-0008 внутри pure deterministic Go
engine: типизированное, replay-safe и пока не выставленное наружу generic
interaction window с opaque ID, eligibility/privacy policy, CAS-compatible
response/pass/timeout semantics и жёстко ограниченным deadline extension.
Существующий lobby/core game flow должен продолжить работать без изменения
HTTP projection или frontend contract.

## Критерии приёмки

- [x] Pure model содержит отдельное `InteractionWindow`, не перегружая
  существующий turn-owner `ActionWindow`: opaque stable ID, closed kind,
  parent reference, eligibility policy, allowed intents, eligible actors,
  opened/deadline instants, extension budget, per-actor response state и close
  reason.
- [x] `State.Clone` делает глубокую копию window collections, а
  `State.Validate` отклоняет пустой/дублированный actor, unknown enum,
  malformed deadline/extension и невозможную open/closed state combination.
- [x] Kernel поддерживает typed open/respond/pass/timeout/close transitions.
  Actor, interaction ID и intent проверяются server-side; illegal/stale/
  already-closed transition возвращает ошибку и не создаёт событий.
- [x] Deadline policy может выразить принятые defaults `60/30/+10` с жёстким
  extension cap. Engine не читает wall clock: opened/deadline/observed instant
  поступают как trusted input и полностью фиксируются в событиях.
- [x] Pure transitions CAS-compatible: они детерминированы, side-effect-free и
  возвращают immutable events от одной base state. Проверка expected-version
  и concurrent winner остаётся в application layer и явно переносится в
  следующий integration plan.
- [x] `opaque_public_set` существует как закрытая policy и не вычисляется по
  hidden hand внутри public path. В этом slice нет projection, поэтому
  eligibility и responses остаются internal state.
- [x] Timeout детерминированно auto-pass-ит оставшихся optional responders и
  закрывает window; reconnect не продлевает deadline. Mandatory/default
  behavior в generic model только typed, без конкретных card rules.
- [x] Новые stored event types имеют явные versioned names
  `game.v1.interaction_window_opened`,
  `game.v1.interaction_response_recorded` и
  `game.v1.interaction_window_closed`, используют envelope schema `1` и
  содержат все данные, нужные replay без clock/RNG.
- [x] Legacy current-game envelope/state sequence без interaction fields
  replay-ится как прежде с zero closed window; malformed/unknown new schema
  fail-closed. Old games не угадывают новые fields.
- [x] Текущий `first-edition-core-v1` не открывает новый window и сохраняет
  прежнее observable gameplay behavior.
- [x] Focused tests и полный `go test ./...` проходят; HTTP/application/store,
  frontend и infrastructure не меняются.

## Контекст и подтверждённое состояние

- Текущий `ActionWindow` хранит только kind и одного eligible active player;
  `State.Validate` жёстко связывает его с текущим turn owner.
- Engine pure: команды проходят через `Handle`, случайные результаты
  фиксируются событиями, replay не должен повторять RNG либо читать clock.
- ADR-0008 и interaction protocol уже приняли generic kernel первым runtime
  slice, затем combat/help.
- Принятые owner defaults: `60/30/+10` с hard cap, CAS/simultaneous,
  privacy-first opaque windows, timeout/auto-pass при disconnect.
- Expected-version CAS сейчас реализован в application boundary, а
  `game.Command` pure engine не содержит expected version. Этот plan обязан
  сохранить совместимость, но не может доказать concurrent storage winner.
- Public projection и frontend Zod schemas пока не содержат interaction ID,
  deadlines, responder state или private descriptors. Их изменение в этом
  plan нарушило бы независимость parallel frontend work.

## Scope

### Входит

- Closed Go types/enums и invariants generic interaction window.
- Pure engine commands/transitions для open/respond/pass/timeout/close.
- Persistable domain events и deterministic apply/replay behavior.
- Explicit versioned event names/schema и legacy zero-window replay coverage.
- Compatibility bridge, при котором current turn flow остаётся на старом
  `ActionWindow` и не активирует generic window.
- Focused unit/property-style table tests для legality, CAS-compatible
  determinism, deadline cap, timeout, replay, clone/validation и unchanged
  current flow.

### Не входит

- HTTP DTO/projection, Zod/shared contracts, SSE payload или frontend UI.
- Application `Clock`, scheduler, sweeper, repository queries, Postgres
  migration/deadline index, expected-version concurrency integration и restart
  recovery.
- Реальное открытие combat/help window, helper reward, content effects, cards
  либо player-to-player mechanics.
- Actor-specific privacy serialization; наружу internal eligible actors не
  выдаются.
- Infrastructure, Compose, CI и documentation contracts.

## Архитектурный подход

1. Оставить current `ActionWindow` как compatibility boundary и ввести
   отдельный dormant generic aggregate.
2. Использовать только closed typed values; никакого arbitrary effect payload,
   clock, network, database или global RNG в engine.
3. Принимать interaction ID и instants от будущего trusted application layer;
   validate их и persist в event, не генерировать внутри pure engine.
4. Выражать respond/pass/timeout как commands, которые сначала полностью
   валидируются, затем выпускают immutable events.
5. Делать transitions совместимыми с application CAS: не мутировать input
   state, возвращать только events и давать одинаковый result для одинаковой
   base state/command. Concurrent winner/stale persistence integration
   проверяется следующим plan.
6. Доказать replay и backward compatibility tests до public wiring.
7. Следующий отдельный plan добавит persistence/projection/privacy DTO, затем
   первый domain slice `combat/help`.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| `go:backend/game` pure engine | Dormant interaction aggregate, commands and events | Internal event schema grows; HTTP/realtime unchanged |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/internal/game/model.go` | write | Generic window model, clone and validation |
| `backend/game/internal/game/engine.go` | write | Typed pure transitions and legality |
| `backend/game/internal/game/rules.go` | write | Compatibility/default transition helpers |
| `backend/game/internal/game/event.go` | write | Replay-safe interaction event payloads |
| `backend/game/internal/game/interaction_window_test.go` | write | Focused kernel/replay/compatibility tests |
| `docs/agents/plans/active/20260730T134442Z-bfe764-generic-interaction-window-engine-kernel.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260730T134442Z-bfe764-generic-interaction-window-engine-kernel.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game:interaction-window-engine-kernel-v1` | future projection/combat plans | этот plan | Kernel completes before any consumer wires it |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 13:55:00 UTC.
- **Обнаруженные пересечения:** нет общих paths/shared resources с Terraform
  plan или frontend safe-shell plan.
- **Решение:** не трогать `projection.go`, application/store/migrations,
  shared TS contracts или frontend. Выполнять в отдельном worktree.

## План реализации

1. [x] Добавить typed window/policy/response model, deep clone и invariants.
2. [x] Добавить pure open/respond/pass/timeout/close commands и events.
3. [x] Реализовать deterministic event application и compatibility with
   current turn rules.
4. [x] Покрыть validation, illegal actor/intent, duplicate response, hard
   extension cap, timeout auto-pass, versioned/legacy replay и unchanged
   current flow.
5. [x] Запустить focused/full Go tests, canonical verify и scope-check.
6. [x] Провести read-only adversarial review server authority/replay/privacy,
   исправить findings в write set и архивировать plan.

## Проверки

- [x] `gofmt -w` только для write set Go files
- [x] `go test ./internal/game -run InteractionWindow -count=1`
- [x] `go test ./...`
- [x] Replay equivalence, legacy replay и zero-events-on-error assertions
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260730T134442Z-bfe764-generic-interaction-window-engine-kernel`
- [x] `git diff --check`

## Риски и откат

- **Риск:** dormant model случайно попадёт в public projection или изменит
  current gameplay. **Снижение:** no-projection write set, compatibility
  default и regression tests.
- **Риск:** generic abstraction станет слишком card-specific либо позволит
  arbitrary payload. **Снижение:** closed enums, typed allowed intents,
  no content execution.
- **Риск:** hidden eligibility превратится в timing oracle позже.
  **Снижение:** policy хранится internal; projection отдельно реализует
  privacy matrix и always-open opaque semantics.
- **Риск:** clock-dependent timeout сломает replay.
  **Снижение:** все instants — explicit trusted inputs persisted in events.
- **Откат:** обычным revert удалить dormant window/events/tests; migrations и
  public contracts отсутствуют, cloud/frontend state не затронуты.

## Открытые вопросы

- Нет scope-changing вопросов. Конкретные public descriptor, persistence
  recovery и combat/help activation намеренно перенесены в следующие plans.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-30 13:44:42 UTC
- **Подтверждено:** 2026-07-30 14:12:52 UTC
- **Формулировка/ограничения пользователя:** «Согласовываю все три плана.
  Разрешаю зафиксировать и запушить approved drafts». Пользователь запустит
  другой approved plan на другом устройстве; эта infra-session данный plan не
  выбирает и не реализует.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Read-only review ADR-0008, protocol и current engine подтвердил, что pure
  dormant kernel можно отделить от projection/application/persistence.
- Exact plan ID был согласован для отдельной implementation session/worktree.
- Dependency plan завершён; `leinoctl context` подтвердил plan как eligible,
  исходный worktree был чистым.
- Session `019fb36e-5e67-7aa0-9e55-b5e58c8ec116` выбрала plan в ветке
  `codex/generic-interaction-window-engine-kernel`; статус переведён в
  `in_progress`.
- Добавлены закрытые interaction kind/policy/intent/response/close enums,
  authoritative parent/actor sets, fixed instants, deadline policy и
  deep-cloned per-actor response map. Nil window остаётся legacy zero-state и
  не добавляет поле в current `game.v2` event payload.
- Добавлены pure open/respond/pass/timeout/close commands и три
  `game.v1.interaction_*` event type. Apply проверяет stale ID, actor,
  registered intent, deadline/revision, replay outcome и fail-closed payload.
- Collective default выражает `60/30/+10/90`; только late typed `respond`
  расходует bounded budget. Timeout по exact revision фиксирует optional
  auto-pass, mandatory typed auto-resolution и terminal close events.
- Focused tests покрыли clone/validation, deterministic equal-base result,
  extension cap, illegal/stale/duplicate/late transitions, timeout,
  malformed schema/payload, replay equivalence и unchanged current flow.
- Adversarial review дополнительно запретил reuse opaque ID, проверил parent
  subject по authoritative state и передал close после deadline только
  timeout transition.
- Focused `go test ./internal/game -run 'Interaction|LegacyCurrent' -count=1`
  и полный `go test ./...` прошли.
- Canonical `./leinoctl verify --changed` прошёл на Node 24, Go 1.26.5 и
  repository-pinned pnpm 10.8.0: frontend contracts 7/7, web 41/41,
  lint/typecheck/build; backend all packages; hooks 42/42; leinoctl 64/64;
  plan-lint 0 issues; Bash syntax и `docker compose --parallel 8 config`.
- `text-check`: 6 paths, issues `[]`; `gofmt -d` и `git diff --check` без
  вывода. `scope-check`: `ok: true`, `outsideWriteSet: []`,
  `missingRequiredChecks: []`; 6 paths diagnostic `unledgered`, поскольку
  desktop PostToolUse ledger их не записал.

## Итог

Реализован dormant pure-engine kernel generic interaction window без
изменения HTTP/application/store/frontend. Window получает opaque stable ID,
closed typed policies/intents, authoritative actors, fixed deadline state,
bounded extension budget, replayed responses и terminal reason. New events
полностью восстанавливают open/respond/pass/timeout/close sequence без clock
или RNG; legacy/current `first-edition-core-v1` продолжает работать с nil
window и прежним observable event payload. Persistence/CAS winner,
projection/privacy DTO, scheduler и combat/help activation остаются
следующими отдельными plans.
