# PLAN: interaction window runtime boundary

- **Plan ID:** `20260730T184131Z-6428a0-interaction-window-runtime-boundary`
- **Статус:** completed
- **Создан:** 2026-07-30 18:41:31 UTC
- **Обновлён:** 2026-07-30 19:29:10 UTC
- **Владелец:** Codex session `019fb43c-be9a-7e82-9148-d0e2b7744c86`
- **Workspace:** `/Users/kolyalis/Dev/munchkin`
- **Ветка:** `codex/interaction-window-runtime-boundary` после approval
- **Режим параллельности:** conditional
- **Зависит от:** plan `20260730T134442Z-bfe764-generic-interaction-window-engine-kernel`.
- **Блокирует:** generic interaction UI и первый domain slice
  combat intervention/help.
- **Связанные ADR/handoff:** ADR-0008,
  `docs/agents/GAME_INTERACTION_PROTOCOL.md`,
  `docs/agents/GAME_UI_UX_SPEC.md`.

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "backend/game/cmd/server/main.go",
    "backend/game/Dockerfile",
    "backend/game/internal/application/store.go",
    "backend/game/internal/application/service.go",
    "backend/game/internal/application/service_test.go",
    "backend/game/internal/application/interaction_runtime.go",
    "backend/game/internal/application/interaction_runtime_test.go",
    "backend/game/internal/game/projection.go",
    "backend/game/internal/game/interaction_projection_test.go",
    "backend/game/internal/repository/memory/store.go",
    "backend/game/internal/repository/memory/store_test.go",
    "backend/game/internal/repository/postgres/store.go",
    "backend/game/internal/repository/postgres/store_integration_test.go",
    "backend/game/internal/transport/httpapi/router.go",
    "backend/game/internal/transport/httpapi/router_test.go",
    "backend/game/internal/transport/httpapi/testdata/interaction-projection-v1.json",
    "backend/game/migrations/000002_interaction_deadlines.up.sql",
    "backend/game/migrations/000002_interaction_deadlines.down.sql",
    "docker-compose.yml",
    "frontend/packages/contracts/src/index.ts",
    "frontend/packages/contracts/test/contracts.test.ts",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/test/interactionApi.test.ts",
    "docs/agents/plans/active/20260730T184131Z-6428a0-interaction-window-runtime-boundary.md",
    "docs/agents/plans/archive/20260730T184131Z-6428a0-interaction-window-runtime-boundary.md"
  ],
  "components": [
    "go:backend/game",
    "frontend-workspace",
    "pnpm:@munchkin/contracts",
    "pnpm:@munchkin/web",
    "root-compose"
  ],
  "contracts": [
    "game:http-v1",
    "game:realtime-v1",
    "game:events-v1",
    "compose:local-dev"
  ],
  "dependsOn": [
    "20260730T134442Z-bfe764-generic-interaction-window-engine-kernel"
  ],
  "sharedResources": [
    "game:interaction-window-runtime-v1",
    "database:game-interaction-deadlines-v1"
  ]
}
```

## Цель

Подключить dormant generic interaction-window kernel к безопасной runtime
границе без активации конкретной карточной механики: player respond/pass
проходят authenticated application transaction и version/idempotency CAS,
actor-specific HTTP projection выдаёт только собственный descriptor,
deadline index сохраняется атомарно со snapshot/events/receipt, а bounded
timeout worker восстанавливается после restart и публикует только coarse
version invalidation.

## Критерии приёмки

- [x] Existing игры без `InteractionWindow` сохраняют прежний JSON contract:
  interaction field отсутствует, текущие routes/actions/replay работают без
  изменения observable behavior.
- [x] Для open window projection содержит common coarse summary со stable
  opaque `interaction_id`, public parent/status, absolute `deadline_at`,
  response requirement и server time. Она никогда не содержит internal
  eligible actor IDs, initiator authority, чужие response states, hidden card
  IDs либо exact private capability.
- [x] Только authenticated eligible actor получает собственный response state
  и closed action descriptors. Descriptor получает opaque
  projection-version-bound `action_id`; ineligible/responded actor не получает
  чужие или уже недействительные actions.
- [x] Public routes принимают только server-supplied `interaction_id`,
  `action_id`, typed intent, `expected_version` и `Idempotency-Key`. Body не
  выбирает actor, accepted time, deadline, deadline revision, close reason,
  eligible set или timeout.
- [x] Player respond/pass sample-ит application `Clock.Now()` ровно один раз
  внутри locked `WithinGame` transaction после credential, receipt и version
  checks. Engine получает этот fixed instant; `accepted_at >= deadline_at`
  никогда не принимается как player response.
- [x] Network retry с тем же command ID/fingerprint возвращает receipt и не
  повторяет response/extension. Reuse ID с другим interaction/action/intent
  возвращает idempotency conflict; concurrent same-version actors дают ровно
  один committed winner.
- [x] Expired player request либо bounded sweeper выполняет тот же stable
  system timeout command `timeout:<interaction_id>:<deadline_revision>`.
  Player-versus-timeout race создаёт максимум один terminal sequence; stale
  revision/closed window становится safe no-op или typed conflict, но не
  вторым append.
- [x] Active deadline row upsert/delete выполняется в той же transaction, что
  snapshot, events и optional player receipt. Row является advisory index:
  worker повторно проверяет current window ID/revision/status/deadline под
  game lock до engine timeout.
- [x] PostgreSQL schema имеет не более одной active row на
  `(game_id, interaction_id)`, positive deadline revision и индекс по
  `deadline_at`; clean setup и upgrade from current `000001` применяют
  `000002` в stable order.
- [x] Worker при старте и периодически читает bounded ordered batch due rows,
  останавливается по context cancellation и публикует invalidation только
  после commit. Publish failure не повторяет committed timeout.
- [x] Realtime reason для respond/pass/timeout — только
  `interaction_changed`; envelope не получает actor, action, deadline или
  state.
- [x] Go HTTP fixture и strict Zod schemas совпадают. Positive fixture
  принимается; internal state, foreign responses/actions и unknown
  intents/private fields отклоняются. Typed web API adapter parse-ит projection
  и формирует только разрешённый interaction request.
- [x] Memory repository, PostgreSQL contract, application, projection, HTTP,
  TypeScript contract и API adapter tests покрывают restart recovery,
  transaction rollback, expiry boundary, privacy, stale action/version,
  duplicate/reused idempotency и concurrent winner.

## Контекст и подтверждённое состояние

- `main` содержит merged kernel plan
  `20260730T134442Z-bfe764-generic-interaction-window-engine-kernel`: closed
  typed model, open/respond/pass/timeout/close transitions, fixed instants,
  deadline revision/cap и replay-safe `game.v1.interaction_*` events.
- Kernel намеренно dormant: current `first-edition-core-v1` не открывает
  window; HTTP/application/projection/shared contracts о нём не знают.
- `application.Service.Execute` уже владеет credential authority,
  `(actor_id, command_id)` receipt, fingerprint, expected-version check,
  event envelopes, atomic `Tx.Save` и post-commit invalidation.
- Current `Tx.Save` atomically persists snapshot/events/receipt in memory and
  PostgreSQL, но Store не умеет искать due games и не синхронизирует deadline
  index.
- PostgreSQL transaction использует serializable per-game boundary; current
  schema состоит из одного idempotent `000001_game.up.sql`, а runtime принимает
  один `MIGRATION_PATH`.
- `ProjectForActor` является allowlist DTO и уже разделяет self/other player,
  но interaction summary/action descriptor отсутствуют.
- Frontend `projectionSchema` strict; wire action schema описывает только
  turn-owner actions. Interaction protocol требует отдельного descriptor
  contract, а не расширения текущего ActionPanel raw state.
- `GAME_INTERACTION_PROTOCOL.md` фиксирует `60/30/+10`, exact expiry
  `accepted_at < deadline_at`, opaque windows, same-CAS player/timeout race,
  durable advisory deadline index и coarse SSE invalidation.
- `leinoctl context` для application/projection/transport/repository/migrations
  и contracts вернул компоненты backend/frontend/root-compose, no relevant
  active plans. Единственный active Terraform plan не имеет общих
  paths/contracts/shared resources и выполняется в отдельной ветке.

## Scope

### Входит

- Actor-specific interaction summary и own-action projection поверх
  существующего pure state, включая stable version-bound action IDs и strict
  privacy allowlist.
- Dedicated application commands для player respond/pass и system timeout:
  credential/actor authority, expected version, typed fingerprint, one fixed
  accepted/observed instant, receipt replay и coarse invalidation.
- Internal server-owned open-context helper для будущего domain handler:
  opaque interaction ID и open/deadline instants генерируются application,
  не transport body. Он не активируется current rules profile.
- Store deadline candidate contract, atomic deadline synchronization в memory
  и PostgreSQL adapters, bounded due scan и restart-safe timeout worker.
- Additive PostgreSQL migration `000002` и deterministic application of all
  `.up.sql` files from configured migrations directory for local runtime and
  contract tests.
- HTTP respond/pass routes, strict request parsing, typed expired/closed/error
  mapping и privacy-safe fixture.
- Shared Zod request/projection/invalidation schemas, negative privacy
  fixtures и typed web API adapter methods без Vue interaction UI.
- Focused concurrency, rollback, replay/idempotency, privacy, restart and
  cross-language contract tests.

### Не входит

- Combat intervention, help/reward, trade, curse, Run Away, death loot либо
  другое domain activation; current game flow не открывает generic window.
- Vue inbox, modal/sheet, countdown, focus/live-region UI или responsive game
  table changes.
- Новый card/effect registry behavior, content pack или card assets.
- Public route для open/close/timeout, client-selected deadline extension,
  actor/time/revision либо arbitrary action payload.
- Event outbox/reliable SSE delivery; reconnect продолжает делать actor-specific
  GET after version-only invalidation.
- Production migration job, readiness, deployment, Terraform, DNS, backup или
  production Compose topology. Этот slice только сохраняет существующий local
  `AUTO_MIGRATE` workflow для нескольких additive `.up.sql`.
- General turn/lobby AFK policy вне active interaction window.

## Архитектурный подход

1. Оставить `internal/game` pure kernel и current domain flow неизменными.
   Projection строит allowlist view из current window; application injects
   clock/random context и transport никогда не создаёт internal model.
2. Отделить `InteractionView/InteractionActionView` от current
   `ActionView`: generic interaction имеет собственную identity/lifecycle и не
   маскируется под turn-owner action.
3. Action ID детерминированно bind-ится к high-entropy interaction ID,
   actor, intent и projection version. Он opaque capability reference, но
   authority всё равно повторно проверяется по credential/current state.
4. Player command проходит current receipt/version transaction. Application
   sample-ит accepted instant внутри lock, проверяет projected action, затем
   вызывает pure engine. Late request atomically выполняет current-revision
   timeout и возвращает typed expired result после commit.
5. `Tx.Save` получает authoritative next state и синхронизирует единственную
   active deadline row в том же commit. Due scan только находит candidates;
   timeout всегда перечитывает and revalidates aggregate in normal game
   transaction.
6. System timeout использует stable command ID/revision and no forged player
   credential. Parallel workers and player request serialize on the same
   per-game CAS boundary.
7. SSE сообщает только `interaction_changed`; client replaces full parsed
   projection after GET and never reduces domain events locally.
8. PostgreSQL runner applies sorted additive `.up.sql` files. Migration
   execution remains local bootstrap compatibility; production migration
   ownership stays in infrastructure roadmap.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| `go:backend/game` application | Player/system interaction transactions, fixed clock, idempotency and timeout worker | New respond/pass HTTP behavior |
| `go:backend/game` projection | Coarse common window + own descriptors only | Additive optional interaction projection |
| memory/PostgreSQL repository | Atomic active deadline index and due scan | Internal persistence contract |
| `game:http-v1` | Strict interaction request/result/error and projection DTO | Additive routes/fields; legacy no-window JSON unchanged |
| `game:realtime-v1` | Coarse interaction invalidation reason | No state/private payload |
| `game:events-v1` | Existing kernel events committed by application timeout path | No new arbitrary event type/payload |
| `pnpm:@munchkin/contracts` | Strict schemas/types and Go fixture parity | Additive interaction wire contract |
| `pnpm:@munchkin/web` | Typed API adapter methods only | No UI/render behavior |
| `root-compose` | Migration directory path for additive local migrations | Topology/ports unchanged |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/cmd/server/main.go` | write | Migration directory and cancellable timeout worker lifecycle |
| `backend/game/Dockerfile` | write | Point existing local auto-migrate contract at migrations directory |
| `backend/game/internal/application/store.go` | write | Deadline candidate/store interfaces |
| `backend/game/internal/application/service.go` | write | Projection helper, fingerprint and common transaction integration |
| `backend/game/internal/application/service_test.go` | write | Existing transaction/idempotency regression coverage |
| `backend/game/internal/application/interaction_runtime.go` | write | Player/system interaction runtime and bounded sweep |
| `backend/game/internal/application/interaction_runtime_test.go` | write | Clock, expiry, race, retry and worker tests |
| `backend/game/internal/game/projection.go` | write | Privacy-safe interaction summary/action DTO |
| `backend/game/internal/game/interaction_projection_test.go` | write | Eligible/ineligible/legacy privacy tests |
| `backend/game/internal/repository/memory/store.go` | write | Atomic active deadline sync and due scan |
| `backend/game/internal/repository/memory/store_test.go` | write | Deadline ordering/update/delete tests |
| `backend/game/internal/repository/postgres/store.go` | write | Sorted migrations, deadline sync/query |
| `backend/game/internal/repository/postgres/store_integration_test.go` | write | Real DB upgrade/restart/concurrency/rollback contract |
| `backend/game/internal/transport/httpapi/router.go` | write | Strict respond/pass routes and error mapping |
| `backend/game/internal/transport/httpapi/router_test.go` | write | Auth/body/privacy/expiry/receipt HTTP tests |
| `backend/game/internal/transport/httpapi/testdata/interaction-projection-v1.json` | write | Versioned Go-owned cross-language fixture |
| `backend/game/migrations/000002_interaction_deadlines.up.sql` | write | Active durable deadline table/index |
| `backend/game/migrations/000002_interaction_deadlines.down.sql` | write | Explicit schema rollback |
| `docker-compose.yml` | write | Use migrations directory without topology change |
| `frontend/packages/contracts/src/index.ts` | write | Interaction request/projection/invalidation schemas and inferred types |
| `frontend/packages/contracts/test/contracts.test.ts` | write | Go fixture parity and private/unknown negative cases |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Typed respond/pass adapter and parsed projection |
| `frontend/applications/web/test/interactionApi.test.ts` | write | Adapter request/parse/error contract |
| `docs/agents/plans/active/20260730T184131Z-6428a0-interaction-window-runtime-boundary.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260730T184131Z-6428a0-interaction-window-runtime-boundary.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `game:interaction-window-runtime-v1` | future generic UI and combat/help plans | этот plan | Downstream consumes only after completion |
| `database:game-interaction-deadlines-v1` | future domain windows and production migration plan | этот plan | Additive local schema first; production job consumes reviewed migration later |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 18:41:31 UTC
- **Обнаруженные пересечения:** active Terraform plan пишет `.gitignore`,
  `.leino`, infra Terraform roots and owner runbook; общих paths/contracts или
  shared resources нет. Public HTTP/migration/Compose resources считаются
  exclusive для любых новых product plans.
- **Решение:** после approval создать отдельную product branch от `main`.
  Terraform остаётся в своей ветке. Не начинать второй backend/frontend
  contract или Compose plan до завершения этого runtime boundary.

## План реализации

1. [x] Добавить privacy-safe projection DTO/action ID и legacy/eligible/
   ineligible tests без изменения current engine flow.
2. [x] Реализовать player respond/pass transaction, server-owned clock/context,
   typed fingerprints, late-request timeout и coarse invalidation.
3. [x] Расширить Store atomic deadline contract; реализовать memory adapter и
   focused update/delete/due ordering tests.
4. [x] Добавить additive PostgreSQL migration, sorted migration-directory
   runner, atomic deadline sync/query и real database contract coverage.
5. [x] Реализовать bounded system sweep/restart lifecycle и доказать
   player-versus-timeout/multi-worker single winner.
6. [x] Добавить strict HTTP routes/error mapping и versioned Go fixture.
7. [x] Добавить Zod schemas/types, negative privacy fixtures и typed web API
   adapter без Vue UI.
8. [x] Запустить focused/full checks, adversarial privacy/concurrency/restart
   review, исправить findings только в write set, выполнить canonical verify и
   scope-check, архивировать plan.

## Проверки

- [x] `gofmt -w` только для Go write set
- [x] `cd backend/game && go test ./internal/game -run Interaction -count=1`
- [x] `cd backend/game && go test ./internal/application -run Interaction -count=1`
- [x] `cd backend/game && go test ./internal/repository/memory -run Interaction -count=1`
- [x] `cd backend/game && go test ./internal/transport/httpapi -run Interaction -count=1`
- [x] `cd backend/game && go test ./...`
- [x] При `TEST_DATABASE_URL`: real PostgreSQL upgrade/deadline/restart/race
  contract suite
- [x] `cd frontend && pnpm --filter @munchkin/contracts test`
- [x] `cd frontend && pnpm --filter @munchkin/web test`
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [x] `./leinoctl compose --jobs 8 -- config`
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed` для полного фактического path set
- [x] `./leinoctl scope-check --plan 20260730T184131Z-6428a0-interaction-window-runtime-boundary`
- [x] `git diff --check`

## Риски и откат

- **Риск:** projection становится timing/eligibility oracle.
  **Снижение:** opaque window common summary, own response/actions only,
  always-open semantics задаёт future domain plan; negative privacy fixtures.
- **Риск:** pre-lock arrival time либо stale deadline revision позволяет
  late action или двойной timeout. **Снижение:** один fixed clock sample внутри
  game transaction, exact `< deadline`, authoritative recheck and stable
  system key.
- **Риск:** deadline row расходится со snapshot/event state.
  **Снижение:** row derived from authoritative next state and changed only
  inside the same `Tx.Save`; worker treats it as advisory.
- **Риск:** duplicate player/system command повторяет extension/events.
  **Снижение:** typed receipt fingerprint, revision-bound system key,
  per-game serializable/CAS tests and post-commit-only publish.
- **Риск:** additive projection ломает strict old frontend или раскрывает
  internal enum. **Снижение:** field omitted for no-window games, separate
  coarse public enum, Go-owned fixture and strict Zod negative tests.
- **Риск:** migration directory change accidentally applies down/non-SQL files
  or changes production topology. **Снижение:** sorted allowlist только
  `*.up.sql`, idempotent additive migration, Compose config test; production
  migration job остаётся non-goal.
- **Откат:** обычным revert удалить additive routes/contracts/worker and
  `000002`. Если migration уже применена локально, сначала остановить runtime,
  убедиться, что active deadline rows отсутствуют, затем явно применить
  `000002_interaction_deadlines.down.sql`; production cleanup требует
  отдельного approval и не выполняется автоматически.

## Открытые вопросы

- Scope-changing вопросов нет. Exact combat descriptors, source/target option
  registry, open-window trigger and opaque-window eligible-set computation
  принадлежат следующему combat/help plan; runtime contract остаётся generic
  and dormant в current rules profile.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-30 18:41:31 UTC
- **Подтверждено:** 2026-07-30 18:52:52 UTC
- **Формулировка/ограничения пользователя:** Пользователь подтвердил
  направление «Делай» после предложения вынести Terraform в отдельную ветку
  и следующим slice реализовать application/persistence/projection runtime
  boundary. После показа exact plan ID
  `20260730T184131Z-6428a0-interaction-window-runtime-boundary` пользователь
  отдельно подтвердил: «делай». Terraform остаётся в отдельной ветке.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Read-only research подтвердил dormant kernel, current application CAS/
  receipt boundary, отсутствие deadline index/worker, strict frontend
  projection schema and no overlap with active Terraform plan.
- Прочитаны root/backend/frontend instructions, backend skill, normative
  frontend engineering spec, interaction protocol, current Store/HTTP/
  projection/migration/contracts/tests.
- Пользователь явно согласовал exact plan ID; session
  `019fb43c-be9a-7e82-9148-d0e2b7744c86` claimed/selected plan и создала ветку
  `codex/interaction-window-runtime-boundary`.
- Реализованы actor-specific interaction projection и version-bound action
  descriptors. Adversarial privacy review сузил `opaque_public_set` до
  fail-closed `pass`; exact `respond` descriptor не раскрывает скрытую
  eligibility/capability.
- Player respond/pass, late-request timeout и sweeper используют один locked
  aggregate boundary. Тесты доказали receipt replay, stale action rejection,
  exact deadline boundary, один clock sample и обе линейзации гонки
  player-versus-timeout.
- Memory/PostgreSQL adapters атомарно синхронизируют advisory deadline index.
  Temporary PostgreSQL 17 contract test применил `000001`, затем sorted
  migration directory с `000002`, перечитал due row новым store и выполнил
  restart timeout; контейнер работал без volume и удалён после проверки.
- Добавлены strict HTTP respond/pass routes, Go-owned fixture, Zod schemas и
  typed web adapter без domain activation и без Vue UI.
- Проверки: full Go suite прошёл; contracts `9/9`, web `43/43`, frontend
  lint/typecheck/build прошли; hooks `42/42`, leinoctl `64/64`, Compose config
  прошёл с `--parallel 8`.
- Canonical `./leinoctl verify --changed` и `scope-check` завершились `ok`;
  `outsideWriteSet=[]`, required checks complete, `git diff --check` чист.

## Итог

Dormant generic interaction kernel подключён к runtime boundary:
authenticated player actions проходят strict version/idempotency transaction,
timeout восстанавливается из durable bounded deadline index после restart, а
wire boundary публикует только actor-specific projection и coarse version
invalidation. Current rules profile по-прежнему не открывает окна; combat/help,
Vue UI и Terraform не затронуты и остаются отдельными следующими slices.
