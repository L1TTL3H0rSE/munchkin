# PLAN: frontend session api module boundaries

- **Plan ID:** `20260809T212616Z-758ff2-frontend-session-api-module-boundaries`
- **Статус:** completed
- **Создан:** 2026-08-09 21:26:16 UTC
- **Обновлён:** 2026-08-10
- **Владелец:** `019fe88b-0e60-7960-92e7-1a3a1d5513e5`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260809T212617Z-7a4a07-frontend-contract-domain-split`.
- **Блокирует:** `20260809T212615Z-c3d56b-game-table-composition-decomposition`
- **Связанные ADR/handoff:** `docs/agents/FRONTEND_ENGINEERING_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/plans/active/20260809T212616Z-758ff2-frontend-session-api-module-boundaries.md",
    "docs/agents/plans/archive/20260809T212616Z-758ff2-frontend-session-api-module-boundaries.md",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/composables/game/**",
    "frontend/applications/web/test/actionModel.test.ts",
    "frontend/applications/web/test/gameApiErrors.test.ts",
    "frontend/applications/web/test/gameSessionController.test.ts",
    "frontend/applications/web/test/interactionApi.test.ts",
    "frontend/applications/web/test/realtimeResync.test.ts"
  ],
  "components": ["frontend-workspace", "pnpm:@munchkin/web"],
  "contracts": ["game:http-v1", "game:realtime-v1"],
  "dependsOn": [
    "20260809T212617Z-7a4a07-frontend-contract-domain-split"
  ],
  "sharedResources": ["frontend-game-session-api-boundary"]
}
```

## Цель

Разделить 796-line `useGameApi.ts` и 1145-line
`useGameSessionController.ts` по уже существующим, независимо тестируемым
responsibilities — request/error/SSE adapter и session lifecycle/command
submission — сохранив прежние public facades, runtime behavior, privacy,
idempotency и realtime invalidation semantics.

## Критерии приёмки

- [x] `useGameApi.ts` остаётся тонким stable facade/composition factory;
  parsing/errors, HTTP requests и SSE consumption имеют отдельные cohesive
  modules только там, где есть самостоятельные tests/owners.
- [x] `useGameSessionController.ts` сохраняет public API, но connection/resync/
  retry lifecycle отделён от command/economy/interaction submission.
- [x] Existing `GameSessionAPI` сохраняется: production adapter и test fake —
  два реальных consumers; новые one-implementation interfaces не создаются.
- [x] Abort, lifecycle generation, monotonic projection, bounded reconnect,
  auth clearing, stale/conflict resync и same-command retry invariants проходят
  без изменения observable behavior.
- [x] Wire payloads/types не дублируются и не меняются; raw `unknown` всё ещё
  проходит Zod/error normalization before feature state.
- [x] Route/components продолжают импортировать прежние facade exports либо
  получают strictly smaller explicit imports без barrel/circular dependency.

## Контекст и подтверждённое состояние

- `useGameApi.ts` смешивает typed request methods, asset URL, projection parse,
  resync coordinator, SSE parser/consumer и error taxonomy.
- `useGameSessionController.ts` смешивает scheduler/stream lifecycle,
  request cancellation, projection state, command/economy/interaction retry и
  terminal error handling.
- Controller boundary уже имеет injected API/credential/scheduler test fakes и
  strong focused tests; это refactor, не rewrite.
- Previous queue checkpoint stabilizes the package-root contract facade before
  these internal adapter/controller modules move.

## Scope

### Входит

- Feature-local `composables/game/**` modules for existing cohesive adapter and
  lifecycle responsibilities.
- Stable re-exports/facades from current two files.
- Focused tests relocated/split by responsibility while preserving assertions.
- Removal of duplicate/private helpers made obsolete by the split.

### Не входит

- New API endpoints, schema/type changes, gameplay intent changes, Pinia/store,
  generated client, external request library, generic repository framework.
- GameTable/layout/SCSS, contracts file split, Studio, backend/realtime
  publisher, credential persistence change, Figma or browser visual work.

## Архитектурный подход

- **Keep the public seam.** Current facades protect route/components; internal
  files move without forcing repo-wide import churn.
- **Split by lifecycle and tests.** A module exists only for a named owner:
  error normalization, event stream, request adapter, session lifecycle or
  command submission. No `utils.ts` dumping ground.
- **Authority unchanged.** Adapter sends server-permitted intent with expected
  version/idempotency; controller never reduces realtime events or computes
  authoritative result.
- **No speculative package.** One Nuxt app remains the only consumer, so all
  modules stay app-local.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Game API facade | Internal adapter/error/SSE modules | `game:http-v1` unchanged |
| Session controller | Lifecycle vs submission modules | Public controller API unchanged |
| Realtime resync | Isolated existing owner | `game:realtime-v1` invalidation-only |
| Focused tests | Reorganized around responsibilities | Existing fixtures unchanged |

## Delegation strategy

- **Классификация:** large — planning delegation required: transport, realtime,
  lifecycle, retry/idempotency and privacy invariants are separate high-risk
  workstreams even without public schema change.
- Queue Package A (`Terra high`, read-only, completed) checked sequencing and
  write-set/shared-resource risk.
- Queue Package B (`Terra high`, read-only, completed) challenged module
  seams/YAGNI against useful Digiversity composition-root patterns.
- Both used `write_set: []`; root-only implementation.

### Delegation findings and closure

| Package | Finding | Disposition/closure |
|---|---|---|
| A | Plan 1 mutates `useGameApi.ts`; contracts must stabilize before transport internals move. | Accepted: direct chain prune → contracts → this plan, with lifecycle closeout and a separate commit at each boundary. |
| A | Stable types alone do not protect abort/retry/resync/idempotency races. | Accepted: focused cancellation, terminal-error, command-ID, retry and realtime race checks are acceptance gates. |
| B | Existing public composable facades already isolate consumers. | Accepted: keep `useGameApi`/`useGameSessionController`; split only cohesive private owners under app-local `composables/game/**`. |
| B | Existing `GameSessionAPI` test fake is a real second implementation, not removable boilerplate. | Accepted: preserve the injected seam; no new interface, package, store or request framework. |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/plans/active/20260809T212616Z-758ff2-frontend-session-api-module-boundaries.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260809T212616Z-758ff2-frontend-session-api-module-boundaries.md` | write | Archived lifecycle |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Stable thin API facade |
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Stable thin controller facade |
| `frontend/applications/web/app/composables/game/**` | write | Cohesive internal adapter/lifecycle modules |
| `frontend/applications/web/test/actionModel.test.ts` | write | Asset URL/facade regression if relocated |
| `frontend/applications/web/test/gameApiErrors.test.ts` | write | Error taxonomy regression |
| `frontend/applications/web/test/gameSessionController.test.ts` | write | Lifecycle/submission regression |
| `frontend/applications/web/test/interactionApi.test.ts` | write | Typed interaction request regression |
| `frontend/applications/web/test/realtimeResync.test.ts` | write | SSE/resync/race regression |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend-game-session-api-boundary` | prior contracts, next GameTable plan | this plan | Preserve facades; UI refactor consumes the stabilized boundary |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-09 21:54 UTC aggregate context and all
  queue manifests; unrelated infrastructure drafts have no composable claims.
- **Обнаруженные пересечения:** dead-code plan narrows unused exports in
  `useGameApi`; contracts plan changes only the package internals behind a
  stable facade. GameTable plan consumes these public types but does not claim
  composable paths.
- **Решение:** strict dependency after separate commits. Any public API, wire
  schema or behavior change is material and stops the queue.

## План реализации

1. [x] Lock existing public exports and invariant-focused tests.
2. [x] Extract API error/request/event-stream responsibilities behind current
   facade; remove duplicate private helpers.
3. [x] Extract session lifecycle and command submission collaborators behind
   current controller facade without weakening cancellation/idempotency.
4. [x] Run race/error/realtime tests plus canonical gates and inspect consumer
   imports/cycles.

## Проверки

- [x] Focused Vitest: error taxonomy, interaction API, session controller,
  realtime resync, asset URL.
- [x] Typecheck verifies facade/import/cycle boundaries; optional static cycle
  scan uses existing tooling only.
- [x] `pnpm lint`, `pnpm check`, `pnpm build`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260809T212616Z-758ff2-frontend-session-api-module-boundaries`.

## Риски и откат

- **Риск:** moving closures changes lifecycle ownership, abort ordering,
  command-ID reuse or retry/resync races despite stable types.
- **Mitigation:** preserve facade and injected fakes; lock race/terminal error
  tests before moving code; no simultaneous behavior cleanup.
- **Откат:** revert the isolated plan commit; do not retain dual old/new
  implementations or feature flags.

## Открытые вопросы

- Exact internal filenames are implementation detail inside
  `composables/game/**`; adding a new public interface/package is not allowed
  without re-approval.
- The queue-level unattended execution policy in the first plan applies:
  private extraction size/test placement and reuse of existing seams are
  pre-authorized; lifecycle, transport and wire behavior are not variable.

## Согласование

- **Статус:** approved as exact queue member
- **Запрошено:** 2026-08-09 21:54:06 UTC
- **Подтверждено:** 2026-08-10
- **Формулировка/ограничения пользователя:** exact four-plan queue and
  unattended policy approved; non-material decisions inside this manifest and
  acceptance criteria are autonomous; no dependency install/upgrade, snapshot
  update or push; separate local commit required.

## Ход выполнения

- Exact queue member approved after completed dependency commit `b98bce0`;
  targeted takeover from the absent planning session recorded. Implementation
  not started before selection.
- Selected for implementation in the approved queue order.
- Kept both public composable files as stable facades and moved cohesive HTTP,
  error normalization, realtime, session lifecycle/types and submission owners
  under app-local `composables/game/**` without changing public exports.
- Focused Vitest passed: 5 files, 44 tests. Full frontend gates passed: contract
  19 tests, web 163 tests, lint, typecheck and production build.
- Canonical `verify --changed` passed all 15 recorded checks, including harness,
  leinoctl, plan-lint and `docker compose --parallel 8 config`; final
  `scope-check` reported `outsideWriteSet: []`, no missing or stale required
  checks. An earlier canonical lint attempt failed only because nested `pnpm`
  was absent from PATH; the successful rerun used the declared pnpm 10.8.0.

## Итог

Completed. Public facades and wire contracts are unchanged; API transport,
error normalization and realtime consumption now have cohesive owners, while
session lifecycle and command/economy/interaction submissions are separated.
No dependency install/upgrade, snapshot update or remote effect was performed.
