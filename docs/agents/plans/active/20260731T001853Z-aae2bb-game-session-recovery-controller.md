# PLAN: game session recovery controller

- **Plan ID:** `20260731T001853Z-aae2bb-game-session-recovery-controller`
- **Статус:** draft
- **Создан:** 2026-07-31 00:18:53 UTC
- **Обновлён:** 2026-07-31 00:18:53 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260729T234102Z-898ef6-frontend-engineering-spec`, `20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation`, `20260730T184131Z-6428a0-interaction-window-runtime-boundary`, `20260731T001853Z-be25a0-combat-response-domain-activation`, `20260731T001853Z-015911-combat-helper-reward-settlement`.
- **Блокирует:** `20260731T001853Z-2fc5e2-responsive-game-table-and-action-dock`, `20260731T001853Z-f90fcb-generic-interaction-window-ui`
- **Связанные ADR/handoff:** `docs/agents/FRONTEND_ENGINEERING_SPEC.md`, `docs/agents/GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/composables/useGameSession.ts",
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/components/GameConnectionStatus.vue",
    "frontend/applications/web/test/gameSessionController.test.ts",
    "frontend/applications/web/test/realtimeResync.test.ts",
    "frontend/applications/web/test/gameApiErrors.test.ts",
    "docs/agents/plans/active/20260731T001853Z-aae2bb-game-session-recovery-controller.md",
    "docs/agents/plans/archive/20260731T001853Z-aae2bb-game-session-recovery-controller.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "game:http-v1",
    "game:realtime-v1",
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260729T234102Z-898ef6-frontend-engineering-spec",
    "20260730T134443Z-3ffbc0-frontend-safe-shell-breakpoint-foundation",
    "20260730T184131Z-6428a0-interaction-window-runtime-boundary",
    "20260731T001853Z-be25a0-combat-response-domain-activation",
    "20260731T001853Z-015911-combat-helper-reward-settlement"
  ],
  "sharedResources": [
    "frontend:game-session-controller-v1"
  ]
}
```

## Цель

Вынести из монолитной game route единый route-owned session controller,
который безопасно загружает actor projection, выполняет server intents,
классифицирует API ошибки, управляет одним realtime stream и восстанавливается
через bounded resync/backoff без duplicate requests, stale overwrite и утечки
credential.

## Критерии приёмки

- [ ] `game/[id].vue` остаётся composition/route boundary: params, metadata,
  top-level states и feature composition; fetch/SSE/retry/timer algorithm
  принадлежит `useGameSessionController`.
- [ ] Любой HTTP/storage payload остаётся `unknown` до existing Zod parse;
  API adapter нормализует `auth`, `validation`, `conflict/stale_version`,
  `not_found`, `offline/transient`, `protocol`, `unexpected`.
- [ ] User-visible error никогда не использует raw backend/framework message,
  token, request body, private projection или stack; safe diagnostic cause
  доступен только dev/test boundary.
- [ ] Initial load, manual refresh and action requests принимают route-owned
  `AbortSignal`; unmount/game-ID change отменяет их и запрещает late state
  mutation.
- [ ] Controller владеет ровно одним stream; reconnect/route changes не
  создают duplicate listeners или timers.
- [ ] Reconnect использует bounded exponential backoff with jitter, explicit
  attempt ceiling and states `connecting/connected/resyncing/offline/failed`;
  terminal auth/protocol errors не retry-ятся бесконечно.
- [ ] Version gap, invalid envelope, stream close and publish gap выполняют
  fresh actor-specific GET. Invalidation during in-flight refresh schedules
  exactly one additional drain.
- [ ] Projection заменяется только монотонно; stale HTTP response не
  перезаписывает newer projection.
- [ ] Network retry одного intent сохраняет command ID; stale-version conflict
  делает resync и требует нового явного user intent, а не silent replay.
- [ ] Terminal auth очищает только credential текущей игры и безопасно
  возвращает в lobby; credential не попадает в route, Pinia, log or error.
- [ ] Loading/offline/retrying/failed status видим durable component with
  `aria-busy`/bounded live-region semantics; toast не является единственным
  объяснением.
- [ ] Fake-clock tests покрывают abort, reconnect ceiling, jitter bounds,
  stream de-duplication, forced drain, stale response, auth terminal and
  unmount cleanup.

## Контекст и подтверждённое состояние

- Current `game/[id].vue` смешивает route, projection, commands, SSE,
  reconnect timer and full table markup.
- Reconnect использует fixed 1 second timer without ceiling/classification;
  raw `Error.message` показывается пользователю.
- `createVersionedResync` уже coalesces refresh and tests forced drain, но
  owner/cancellation/error policy остаются в page.
- `useGameSession` хранит bearer token only in `sessionStorage` per game,
  что сохраняется; plan не вводит global auth/account.
- Backend runtime and contracts уже поддерживают version-only invalidation and
  actor-specific GET; wire schema changes не требуются.
- Terraform active plan не затрагивает frontend files.

## Scope

### Входит

- Typed gameplay API error adapter and safe user copy mapping.
- Route-scoped session controller: initial GET, action submission, monotonic
  projection, realtime lifecycle, bounded recovery and cleanup.
- Minimal connection/status component and page decomposition required to
  consume controller.
- Unit tests with deterministic clock/random/transport adapters.

### Не входит

- Backend/HTTP/Zod schema changes, new profile or domain mechanics.
- Responsive table redesign, hand sheet, action dock, interaction modal,
  visual token rewrite or Card Studio refactor.
- Pinia/global account, persistent credentials, analytics or outbox.
- Playwright/axe dependency, snapshots, Terraform, Compose or CI changes.

## Архитектурный подход

1. Keep `useGameApi` as transport/parser and return classified errors, not
   framework response.
2. Inject timer/jitter/transport dependencies into a headless controller so
   concurrency can be proven without browser sleeps.
3. Maintain one monotonic projection owner and one keyed pending intent state;
   components receive readonly state and emit intent.
4. Reuse versioned resync drain; controller decides retry/terminal behavior and
   owns all AbortController/timer/stream cleanup.
5. Keep credential adapter narrow and clear current game only on terminal auth.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| web API adapter | Classified gameplay errors and AbortSignal | Consumes existing HTTP/Zod contract |
| session controller | One projection/stream/recovery owner | No local authoritative reducer |
| game route/status | Composition and accessible lifecycle states | No layout redesign |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/pages/game/[id].vue` | write | Replace embedded lifecycle with controller |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Error taxonomy and AbortSignal |
| `frontend/applications/web/app/composables/useGameSession.ts` | write | Narrow current-game clear/credential adapter |
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Headless session owner |
| `frontend/applications/web/app/components/GameConnectionStatus.vue` | write | Durable accessible connection state |
| `frontend/applications/web/test/gameSessionController.test.ts` | write | Lifecycle/concurrency tests |
| `frontend/applications/web/test/realtimeResync.test.ts` | write | Drain/monotonic regressions |
| `frontend/applications/web/test/gameApiErrors.test.ts` | write | Safe error classification tests |
| `docs/agents/plans/active/20260731T001853Z-aae2bb-game-session-recovery-controller.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T001853Z-aae2bb-game-session-recovery-controller.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:game-session-controller-v1` | all later game surfaces | этот plan | Controller first, UI consumes readonly state |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:18:53 UTC
- **Обнаруженные пересечения:** later table/interaction drafts touch the same
  route/controller consumer; Terraform has no overlap.
- **Решение:** implement this frontend plan first in a fresh session; later
  plans depend on its completed API instead of editing embedded page logic.

## План реализации

1. [ ] Зафиксировать current behavior with adapter/controller tests.
2. [ ] Добавить typed error taxonomy, AbortSignal and safe copy.
3. [ ] Реализовать deterministic session controller and cleanup.
4. [ ] Подключить route/status component without visual redesign.
5. [ ] Run focused/full checks, lifecycle review, canonical verify/scope-check
   and archive.

## Проверки

- [ ] `cd frontend && pnpm --filter @munchkin/web test`
- [ ] `cd frontend && pnpm lint`
- [ ] `cd frontend && pnpm check`
- [ ] `cd frontend && pnpm build`
- [ ] Manual browser smoke: load, action, offline/reconnect, route leave,
  terminal auth at `320×568` and `1280×720`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T001853Z-aae2bb-game-session-recovery-controller`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** refactor changes command/reconnect semantics. **Снижение:** capture
  current fixtures first, inject deterministic transport/clock and compare
  monotonic projection behavior.
- **Риск:** retry duplicates mutation. **Снижение:** controller retains command
  ID only for same network attempt and never silently retries stale intent.
- **Риск:** live region spams on every version. **Снижение:** announce bounded
  connection transitions, not raw invalidations.
- **Откат:** ordinary revert restores page-owned lifecycle; no backend,
  schema, persisted game or migration change.

## Открытые вопросы

- Scope-changing вопросов нет. Backoff default proposed as
  `1s, 2s, 4s, 8s, 15s cap`, full jitter, five consecutive attempts before
  stable failed state with explicit retry.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:18:53 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Пользователь попросил подготовить
  backend/frontend plans параллельно фоновой Terraform-работе; implementation,
  selection, commit и push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Frontend skill and normative engineering spec applied: controller owns
  async lifecycle, frontend remains projection-driven and credential-safe.

## Итог

Заполняется после реализации.
