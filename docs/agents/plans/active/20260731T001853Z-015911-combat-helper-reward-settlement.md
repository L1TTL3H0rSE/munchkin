# PLAN: combat helper reward settlement

- **Plan ID:** `20260731T001853Z-015911-combat-helper-reward-settlement`
- **Статус:** draft
- **Создан:** 2026-07-31 00:18:53 UTC
- **Обновлён:** 2026-07-31 00:18:53 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260731T001853Z-be25a0-combat-response-domain-activation`.
- **Блокирует:** `20260731T001853Z-aae2bb-game-session-recovery-controller`, `20260731T001853Z-40d6e6-combat-helper-offer-ui`
- **Связанные ADR/handoff:** ADR-0008, `docs/agents/GAME_INTERACTION_PROTOCOL.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "backend/game/internal/game/**",
    "backend/game/internal/application/**",
    "backend/game/internal/transport/httpapi/**",
    "frontend/packages/contracts/**",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/test/interactionApi.test.ts",
    "docs/agents/plans/active/20260731T001853Z-015911-combat-helper-reward-settlement.md",
    "docs/agents/plans/archive/20260731T001853Z-015911-combat-helper-reward-settlement.md"
  ],
  "components": [
    "go:backend/game",
    "frontend-workspace"
  ],
  "contracts": [
    "game:events-v1",
    "game:http-v1",
    "game:combat-response-domain-v1",
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260731T001853Z-be25a0-combat-response-domain-activation"
  ],
  "sharedResources": [
    "game:combat-helper-reward-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ]
}
```

## Цель

Добавить поверх active combat response один server-authoritative voluntary
helper flow: combatant предлагает ровно одному живому игроку integer reward,
helper принимает или отклоняет bounded child offer, а accepted helper и
Treasure obligation становятся immutable и при победе исполняются backend
атомарно вместе с combat outcome.

## Критерии приёмки

- [ ] Help доступен только combatant через server descriptor внутри открытого
  `combat_response`; client не присылает произвольный helper ID или максимум
  награды вне allowlisted options.
- [ ] Offer содержит ровно одного living non-combatant и reward
  `1..max_available_treasures`, где maximum вычисляет backend из typed
  encounter reward и доступного Treasure draw capacity.
- [ ] Одновременно существует не более одного pending offer. Combatant может
  cancel либо supersede только до accept; эти действия не продлевают parent.
- [ ] Offer не открывается, если parent оставляет менее 10 секунд; deadline
  равен `min(opened_at + 30s, parent_deadline_at)`.
- [ ] Exact helper/reward/action options видят только combatant и invited
  helper. Остальные actors видят не более coarse combat summary без факта
  declined/pending negotiation, если он не стал public rule outcome.
- [ ] Invited helper может только accept/decline server-supplied offer ID.
  Late/stale/foreign response rejected under current version/window checks.
- [ ] Accept фиксирует ровно одного helper и reward obligation, пересчитывает
  combat participant strength, сбрасывает response revision и может получить
  bounded material `+10s`; helper/reward после accept immutable.
- [ ] Defeat/run-away закрывает conditional obligation с нулевой выплатой.
  Victory реализует Treasure draw один раз, persist-ит exact order и
  канонически отдаёт первые promised cards helper, остаток combatant.
- [ ] Combat transition, делающий accepted reward неисполнимым, fail-closed до
  append; UI договорённость не может обойти engine invariant.
- [ ] Level/outcome, helper/combatant hands, reward settlement, window close,
  deadline sync и receipt коммитятся атомарно; replay не читает deck/RNG/clock.
- [ ] Duplicate offer/accept/decline/cancel/supersede возвращает receipt,
  fingerprint reuse conflicts, concurrent accept/supersede имеет одного
  committed winner.
- [ ] Legacy combat response без help, old rules profile and zero-helper
  settlement сохраняют прежнее observable behavior.
- [ ] Cross-actor Go/Zod fixtures и tests покрывают privacy, deadline clamp,
  parent timeout, reward bounds, immutable accept, victory/defeat and replay.

## Контекст и подтверждённое состояние

- ADR-0008 выбирает одного invited helper, one pending offer, fixed integer
  reward и canonical server settlement; free market и free-text promises
  отклонены.
- Generic window model имеет parent interaction identity, но current runtime
  хранит один active window; implementation должна явно представить
  suspended/resumable child semantics, а не прятать nested state в UI.
- Предыдущий draft plan владеет combat response descriptors/material
  revisions и обязан завершиться раньше.
- Current engine выдаёт Treasure combatant напрямую и не моделирует helper,
  reward obligation либо split ownership.
- Active Terraform write set не пересекается с backend/contracts paths.

## Scope

### Входит

- Voluntary offer/cancel/supersede/accept/decline child lifecycle.
- Parent/child deadline and resume semantics, one-helper invariant.
- Helper combat strength participation and conditional exact reward
  obligation.
- Atomic victory allocation/defeat closure, replay events and actor-specific
  projection.
- Strict HTTP/Zod/API contract plus fixtures and focused tests.

### Не входит

- Forced help, multiple helpers, bargaining, percentages, card choice order,
  free-text promises or renegotiation after accept.
- New content definitions/effects, additional Monster, target/Run Away/social
  mechanics.
- Vue helper form/dialog, responsive UI or browser automation.
- New migrations, Terraform, Compose, telemetry or account identity.

## Архитектурный подход

1. Представить offer как typed child interaction с explicit parent snapshot/
   identity and deterministic resume; simultaneously active actionable window
   остаётся один.
2. Server projection выдаёт combatant allowlisted helper/reward options,
   invited helper — accept/decline, остальным — coarse parent context.
3. Accepted relationship хранить в combat state, не в transient window;
   последующие legality/totals/settlement читают только authoritative state.
4. Treasure draw outcome и split сохранить в one terminal event sequence;
   Apply распределяет уже realized instance IDs без RNG.
5. Все player intents проходят current application CAS/receipt/deadline
   transaction; parent timeout закрывает pending child atomарно.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| pure engine | Offer lifecycle, helper participant, reward settlement | Replay-safe help/reward events |
| application | Parent/child intent transaction | Existing version/idempotency/deadline boundary |
| projection/HTTP | Party-specific offer descriptors | Exact terms only for involved actors |
| contracts/web API | Offer/request/result schemas | Closed typed IDs and integer reward |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/internal/game/model.go` | write | Helper/obligation and parent-child state |
| `backend/game/internal/game/engine.go` | write | Offer and settlement commands |
| `backend/game/internal/game/rules.go` | write | Reward bounds, participant totals, legality |
| `backend/game/internal/game/event.go` | write | Replay-safe help/reward outcomes |
| `backend/game/internal/game/projection.go` | write | Party-specific offer descriptors |
| `backend/game/internal/game/*_test.go` | write | Transition/replay/privacy/settlement tests |
| `backend/game/internal/application/interaction_runtime.go` | write | Offer intents in CAS/deadline transaction |
| `backend/game/internal/application/interaction_runtime_test.go` | write | Retry/race/parent-timeout tests |
| `backend/game/internal/transport/httpapi/router.go` | write | Strict helper intent mapping |
| `backend/game/internal/transport/httpapi/router_test.go` | write | Auth/party/privacy HTTP tests |
| `backend/game/internal/transport/httpapi/testdata/*.json` | write | Versioned cross-actor fixtures |
| `frontend/packages/contracts/src/index.ts` | write | Help offer/action/result schemas |
| `frontend/packages/contracts/test/contracts.test.ts` | write | Strict fixture and privacy tests |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Typed helper requests |
| `frontend/applications/web/test/interactionApi.test.ts` | write | Adapter body/error contract |
| `docs/agents/plans/active/20260731T001853Z-015911-combat-helper-reward-settlement.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T001853Z-015911-combat-helper-reward-settlement.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game:combat-helper-reward-v1` | helper UI | этот plan | Backend contract completes first |
| `game:combat-response-domain-v1` | response UI | dependency plan | Extend, do not redefine |
| `game:http-v1` | product contract work | этот plan | Exclusive while selected |
| `pnpm:@munchkin/contracts` | frontend consumers | этот plan | Fixture-first compatibility |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:18:53 UTC
- **Обнаруженные пересечения:** full overlap with predecessor backend contract
  paths and future helper UI contract consumption; no Terraform overlap.
- **Решение:** start only after predecessor is completed/archived/pushed in a
  fresh trusted session; helper UI starts after this contract stabilizes.

## План реализации

1. [ ] Добавить parent/child and accepted obligation invariants plus replay
   fixtures.
2. [ ] Реализовать offer/cancel/supersede/accept/decline transitions and
   privacy projection.
3. [ ] Подключить helper totals and exact victory/defeat settlement.
4. [ ] Подключить application/HTTP/Zod/API contracts and concurrency tests.
5. [ ] Выполнить focused/full checks, adversarial privacy/economy review,
   canonical verify/scope-check and archive.

## Проверки

- [ ] `cd backend/game && go test ./internal/game -run 'Help|Reward|Combat|Interaction' -count=1`
- [ ] `cd backend/game && go test ./internal/application -run 'Help|Interaction' -count=1`
- [ ] `cd backend/game && go test ./internal/transport/httpapi -run 'Help|Interaction' -count=1`
- [ ] `cd backend/game && go test ./...`
- [ ] `cd frontend && pnpm --filter @munchkin/contracts test`
- [ ] `cd frontend && pnpm --filter @munchkin/web test`
- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T001853Z-015911-combat-helper-reward-settlement`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** child offer deadlock-ит parent или продлевает hard cap.
  **Снижение:** one active actionable window, clamped deadline, atomic parent
  timeout and explicit resume tests.
- **Риск:** exact terms/decline leak to observers. **Снижение:** party-specific
  allowlists and cross-actor serialized fixture diff.
- **Риск:** reward becomes impossible or drawn twice. **Снижение:** invariant
  checked before material commits and one realized settlement event.
- **Откат:** обычный revert безопасен до создания help-enabled snapshots.
  После production use rollback требует first disable new offers and prove no
  active/accepted obligations; destructive state rewrite is separate plan.

## Открытые вопросы

- Scope-changing вопросов нет: v1 uses exactly one helper, integer Treasure
  count, first-cards canonical allocation, zero payout on defeat.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:18:53 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Пользователь попросил подготовить
  backend/frontend plans параллельно фоновой Terraform-работе; implementation,
  selection, commit и push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Read-only audit использовал accepted ADR timing/help defaults and current
  engine reward path; Terraform files не затронуты.

## Итог

Заполняется после реализации.
