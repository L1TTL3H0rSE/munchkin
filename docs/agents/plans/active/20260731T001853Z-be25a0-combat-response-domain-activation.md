# PLAN: combat response domain activation

- **Plan ID:** `20260731T001853Z-be25a0-combat-response-domain-activation`
- **Статус:** draft
- **Создан:** 2026-07-31 00:18:53 UTC
- **Обновлён:** 2026-07-31 00:18:53 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260730T134442Z-bfe764-generic-interaction-window-engine-kernel`, `20260730T184131Z-6428a0-interaction-window-runtime-boundary`.
- **Блокирует:** `20260731T001853Z-015911-combat-helper-reward-settlement`, `20260731T001853Z-aae2bb-game-session-recovery-controller`, `20260731T001853Z-f90fcb-generic-interaction-window-ui`
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
    "content/README.md",
    "docs/agents/plans/active/20260731T001853Z-be25a0-combat-response-domain-activation.md",
    "docs/agents/plans/archive/20260731T001853Z-be25a0-combat-response-domain-activation.md"
  ],
  "components": [
    "go:backend/game",
    "frontend-workspace"
  ],
  "contracts": [
    "game:events-v1",
    "game:http-v1",
    "game:interaction-window-runtime-v1",
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260730T134442Z-bfe764-generic-interaction-window-engine-kernel",
    "20260730T184131Z-6428a0-interaction-window-runtime-boundary"
  ],
  "sharedResources": [
    "game:combat-response-domain-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ]
}
```

## Цель

Активировать первый реальный multiplayer domain поверх готового generic
interaction runtime: combatant вместо немедленного `resolve_combat` запрашивает
завершение боя, backend открывает opaque collective response window, другие
живые игроки получают только собственные legal intervention descriptors или
`pass`, а all-pass/timeout детерминированно закрывает окно и разрешает бой.

## Критерии приёмки

- [ ] Сохранённые игры профиля `first-edition-core-v1@1` продолжают replay и
  прежний single-actor combat без новых окон и без изменения JSON.
- [ ] Новый immutable rules profile `lobby-multiplayer-v1@1` использует тот же
  versioned content pack, но новые lobby создаются с ним явно и projection
  сообщает exact profile identity.
- [ ] В combat server-supplied action `request_combat_resolution` заменяет
  прямой client-selected outcome и открывает `combat_response` на 60 секунд.
- [ ] Responder set вычисляется из публичного roster всех живых
  non-combatants. Окно открывается opaque даже когда ни у кого нет hidden
  intervention; internal eligibility и чужие response states не проецируются.
- [ ] Actor получает только `pass` и descriptors для собственных
  `interaction_scope: other_players` one-shot/effect sources с server-owned
  target allowlist; source чужой карты и отсутствие capability не видны.
- [ ] Material intervention атомарно перемещает source card, применяет closed
  typed `modify_combat` effect, фиксирует realized public delta, сбрасывает
  latest-revision responses в `pending` и только после late threshold может
  добавить `+10s` в пределах hard cap `90s`.
- [ ] Pass относится только к current revision. Duplicate/retry/rejected/pass
  не продлевают deadline и не создают material event.
- [ ] Когда latest revision не имеет pending responders, либо timeout
  auto-pass-ит их, engine одним deterministic sequence закрывает window и
  выполняет прежний victory/run-away transition.
- [ ] Actor authority, action/window/version binding и idempotency повторно
  проверяются под per-game transaction; transport не принимает actor,
  deadline, revision, target вне descriptor или realized modifier.
- [ ] New event payloads полностью replay-safe; `Apply` не читает clock/RNG и
  legacy snapshots/events не мигрируют догадками.
- [ ] Go-owned fixtures, strict Zod schemas и typed API adapter принимают
  только новый profile/action/interaction payload и отклоняют private/unknown
  fields.
- [ ] Engine/application/HTTP/privacy/conformance tests покрывают no-action
  opaque window, two responders, stale pass after intervention, late `+10`,
  hard cap, timeout, duplicate command и legacy profile regression.

## Контекст и подтверждённое состояние

- Completed kernel/runtime plans уже дают typed open/respond/pass/timeout/
  close events, durable deadline index, bounded sweeper, actor-specific
  interaction projection и strict HTTP/Zod boundary.
- Current `first-edition-core-v1@1` всё ещё завершает combat сразу по
  `resolve_combat`; `InteractionWindow` в normal flow не открывается.
- `content/sets/moscow/v1/cards.json` уже содержит оригинальные
  `interaction_scope: other_players` definitions и closed
  `modify_combat` effects, но current profile намеренно их не materialize-ит.
- Frontend contract допускает только current profile literal и generic
  intents `pass/respond/accept/decline`; material source/target descriptor ещё
  отсутствует.
- Active Terraform plan пишет только infra/docs/scripts paths и не владеет
  game contracts, backend code либо frontend contracts.

## Scope

### Входит

- Versioned multiplayer rules profile и explicit compatibility path для old
  games.
- Combat resolution request, opaque responder set, intervention predicate,
  material response/reset/extension и terminal combat continuation.
- Actor-specific material descriptors/request payload, application
  transaction integration, HTTP/Zod/API contract и fixtures.
- Existing original `other_players + modify_combat` definitions как input;
  content JSON, art и digest не меняются.

### Не входит

- Help offer, helper acceptance, reward obligation/settlement, forced help.
- Additional Monster, enhancer registry beyond already typed
  `modify_combat`, Run Away responses, target effects, trade, theft, charity
  transfer или death loot.
- Vue inbox/dialog/countdown, responsive table, browser tooling.
- Terraform, Compose, migrations, deadline worker topology или telemetry.
- Изменение текста, названий, изображений либо digest content pack.

## Архитектурный подход

1. Добавить registry immutable rules profiles; old state выбирает поведение
   только по сохранённым ID/version, new lobby — по server-owned default.
2. Представить request-to-resolve и play-intervention как typed domain
   commands, но использовать generic window lifecycle для времени/ответов.
3. Строить responder set только из public roster, а material descriptor — из
   actor-owned hand и closed effect registry в `ProjectForActor`.
4. Сохранять intervention outcome, response reset, deadline revision и combat
   totals одним append; continuation выполняется engine, а не worker/UI.
5. Расширить public contract аддитивно для нового profile; legacy profile
   fixture обязан оставаться byte-semantically совместимым.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| pure engine | Combat request/intervention/continuation | Replay-safe events, immutable profile behavior |
| application | Open/material response transaction | Current CAS, receipt, deadline sync |
| HTTP projection | Actor-owned source/target descriptor | No eligible list or foreign card leak |
| contracts/web API | Strict new actions/profile union | Parsed request/result only |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/internal/game/model.go` | write | Immutable profile registry and combat window state |
| `backend/game/internal/game/engine.go` | write | Resolution request and material intervention transitions |
| `backend/game/internal/game/rules.go` | write | Public responder/material predicate and continuation |
| `backend/game/internal/game/event.go` | write | Replay-safe combat response events |
| `backend/game/internal/game/effects.go` | write | Closed other-player modify-combat application |
| `backend/game/internal/game/projection.go` | write | Actor-specific descriptors/profile actions |
| `backend/game/internal/game/*_test.go` | write | Engine/replay/privacy/profile regressions |
| `backend/game/internal/application/interaction_runtime.go` | write | Material interaction transaction integration |
| `backend/game/internal/application/interaction_runtime_test.go` | write | CAS/idempotency/deadline races |
| `backend/game/internal/transport/httpapi/router.go` | write | Strict request mapping |
| `backend/game/internal/transport/httpapi/router_test.go` | write | Auth/privacy/compatibility HTTP tests |
| `backend/game/internal/transport/httpapi/testdata/*.json` | write | Versioned Go-owned fixtures |
| `frontend/packages/contracts/src/index.ts` | write | Profile/action/descriptor schemas |
| `frontend/packages/contracts/test/contracts.test.ts` | write | Positive/private/unknown fixtures |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Typed material interaction request |
| `frontend/applications/web/test/interactionApi.test.ts` | write | Adapter contract tests |
| `content/README.md` | write | Current profile activation boundary |
| `docs/agents/plans/active/20260731T001853Z-be25a0-combat-response-domain-activation.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T001853Z-be25a0-combat-response-domain-activation.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game:combat-response-domain-v1` | helper/backend and interaction UI | этот plan | Complete before consumers |
| `game:http-v1` | all product contract plans | этот plan | Exclusive during implementation |
| `pnpm:@munchkin/contracts` | frontend consumers | этот plan | Fixture-first, then consumers |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:18:53 UTC
- **Обнаруженные пересечения:** Terraform plan имеет отдельные
  infra/docs/scripts files; остальные product plans пока только drafts, но
  backend helper и frontend interaction plans зависят от этого contract.
- **Решение:** выполнять в отдельной trusted session первым; не выбирать
  параллельно другой `game:http-v1`/contracts plan.

## План реализации

1. [ ] Зафиксировать compatibility tests и registry двух profiles.
2. [ ] Реализовать pure request/open/material/reset/close/continuation events.
3. [ ] Добавить actor-private descriptors и adversarial privacy tests.
4. [ ] Подключить application CAS/idempotency/deadline transaction.
5. [ ] Расширить HTTP/Go fixture/Zod/API adapter contract.
6. [ ] Выполнить focused/full checks, review privacy/replay/concurrency,
   canonical verify и scope-check; архивировать plan.

## Проверки

- [ ] `cd backend/game && go test ./internal/game -run 'Combat|Interaction|Profile' -count=1`
- [ ] `cd backend/game && go test ./internal/application -run Interaction -count=1`
- [ ] `cd backend/game && go test ./internal/transport/httpapi -run 'Combat|Interaction' -count=1`
- [ ] `cd backend/game && go test ./...`
- [ ] `cd frontend && pnpm --filter @munchkin/contracts test`
- [ ] `cd frontend && pnpm --filter @munchkin/web test`
- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T001853Z-be25a0-combat-response-domain-activation`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** новый default меняет newly-created games. **Снижение:** immutable
  profile identity, explicit old-state regression и projection visibility.
- **Риск:** timing/descriptor раскрывает hidden hand. **Снижение:** public
  roster window always opens; own material descriptors only; cross-actor JSON
  snapshot matrix.
- **Риск:** material reset/timeout разрешают бой дважды. **Снижение:** one
  per-game CAS append, revision-bound deadline and replay/concurrency tests.
- **Откат:** обычный revert возвращает new-lobby default к legacy profile;
  уже созданные multiplayer-profile snapshots нельзя открывать старым binary
  без явного compatibility gate, поэтому deploy rollback сначала запрещает
  creation и требует отдельного operational decision.

## Открытые вопросы

- Scope-changing вопросов нет при согласовании proposed
  `lobby-multiplayer-v1@1` как нового default только для newly-created games.
  Иное имя либо opt-in profile selection требует повторного согласования.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:18:53 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Пользователь попросил подготовить
  backend/frontend plans параллельно фоновой Terraform-работе; implementation,
  selection, commit и push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Read-only audit подтвердил completed generic runtime, dormant combat domain
  и отсутствие Terraform write-set overlap.

## Итог

Заполняется после реализации.
