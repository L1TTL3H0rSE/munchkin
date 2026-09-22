# PLAN: frontend contract domain split

- **Plan ID:** `20260809T212617Z-7a4a07-frontend-contract-domain-split`
- **Статус:** completed
- **Создан:** 2026-08-09 21:26:17 UTC
- **Обновлён:** 2026-08-10
- **Владелец:** `019fe88b-0e60-7960-92e7-1a3a1d5513e5`
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260809T212205Z-7b6e38-frontend-dead-code-dependency-prune`.
- **Блокирует:** `20260809T212616Z-758ff2-frontend-session-api-module-boundaries`
- **Связанные ADR/handoff:** `docs/agents/FRONTEND_ENGINEERING_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/plans/active/20260809T212617Z-7a4a07-frontend-contract-domain-split.md",
    "docs/agents/plans/archive/20260809T212617Z-7a4a07-frontend-contract-domain-split.md",
    "frontend/packages/contracts/src/index.ts",
    "frontend/packages/contracts/src/card.ts",
    "frontend/packages/contracts/src/game.ts",
    "frontend/packages/contracts/src/studio.ts",
    "frontend/packages/contracts/test/**"
  ],
  "components": ["frontend-workspace", "pnpm:@munchkin/contracts"],
  "contracts": [
    "game:http-v1",
    "game:realtime-v1",
    "card-studio:http-v1"
  ],
  "dependsOn": [
    "20260809T212205Z-7b6e38-frontend-dead-code-dependency-prune"
  ],
  "sharedResources": ["frontend-wire-contract-facade"]
}
```

## Цель

Разделить 759-line `@munchkin/contracts/src/index.ts` по реальным wire domains
`card`, `game` и `studio`, сохранив один стабильный package-root facade и
бит-в-бит прежнюю Zod/public TypeScript семантику. Это ownership refactor, а
не изменение HTTP/realtime/Studio контрактов.

## Критерии приёмки

- [x] `src/index.ts` содержит только explicit re-exports; gameplay/realtime и
  Studio schemas/types имеют отдельных owners.
- [x] Общие card/deck primitives вынесены в `card.ts` только потому, что их
  реально используют game и Studio; circular imports/barrels отсутствуют.
- [x] `@munchkin/contracts` package export и все прежние named exports остаются
  совместимыми; app/backend fixture consumers не требуют изменений.
- [x] Zod strictness/default transforms/superRefine order и inferred public
  types не меняются; serialized accepted/rejected fixtures дают прежний result.
- [x] Tests разделены по domain без duplicate giant fixture setup; privacy,
  unknown fields, authority and Studio secret/path negatives сохраняются.
- [x] Новые package subpath exports/generated clients не создаются.

## Контекст и подтверждённое состояние

- Current `src/index.ts` хранит gameplay/realtime schemas до примерно line 578,
  Studio schemas после line 579 и все types в общем хвосте.
- `studioCardDefinitionSchema` повторно использует card/deck enums; это
  подтверждает маленький shared card owner, но не новый package.
- All application imports currently use package root; stable facade prevents
  repo-wide churn.
- Previous prune plan removes orphan imports/tests before internal schema files
  move; package-root consumers remain the compatibility boundary.

## Scope

### Входит

- `card.ts`, `game.ts`, `studio.ts` with explicit imports and root re-exports.
- Domain-focused contract tests and any small shared fixture helper with two
  actual consumers inside `test/**`.
- Export/type compatibility and Go-produced game fixture verification.

### Не входит

- Any schema field/default/refinement/type/API change, backend/content change,
  package subpaths, code generation, new package, DTO duplication.
- Nuxt imports, session/API implementation, Card Studio UI, Figma/gameplay,
  dependency mutation or push.

## Архитектурный подход

- **Facade stays boring.** Package root re-exports domain files so consumers do
  not know storage layout.
- **Three owners, not a framework.** `card` exists for two real domains;
  `game` owns HTTP/realtime projection/commands; `studio` owns Studio wire.
- **Move, do not reinterpret.** Schema definitions are relocated without
  changing order-sensitive transforms/refinements or literal unions.
- **Tests follow domains.** Preserve negative/privacy assertions and avoid
  shared helper abstraction unless duplicated setup is substantial.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Card primitives | Shared deck/card enums | Semantics unchanged |
| Game contracts | Gameplay HTTP/realtime schemas/types | `game:http-v1`, `game:realtime-v1` unchanged |
| Studio contracts | Studio request/job/error schemas/types | `card-studio:http-v1` unchanged |
| Package facade | Explicit named re-exports | Existing root imports unchanged |

## Delegation strategy

- **Классификация:** large — planning delegation required: three contract
  domains, strict Zod semantics, privacy and downstream consumer compatibility.
- Queue Package A (`Terra high`, read-only, completed) checked dependency order,
  manifest scope and exclusive contract ownership.
- Queue Package B (`Terra high`, read-only, completed) challenged the domain
  seams/YAGNI and compared relevant Digiversity headless/package patterns.
- Both used `write_set: []`; root-only implementation.

### Delegation findings and closure

| Package | Finding | Disposition/closure |
|---|---|---|
| A | Contract ownership must precede session/API internals and remain exclusive. | Accepted: direct dependency on plan 1, this plan exclusively owns contract source, and plan 3 directly depends on this completed checkpoint. |
| A | A file move alone can silently drop root exports or Zod behavior. | Accepted: named-export compile plus accepted/rejected fixture, privacy and real-consumer gates are mandatory. |
| B | `card`, `game` and `studio` are real domains, but a new package/subpath API is not justified. | Accepted: three internal files behind the unchanged package-root facade; no package/subpath/codegen addition. |
| B | Shared test abstraction would be speculative without repeated setup. | Accepted: a helper is allowed only with two actual test consumers; otherwise tests stay domain-local. |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/plans/active/20260809T212617Z-7a4a07-frontend-contract-domain-split.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260809T212617Z-7a4a07-frontend-contract-domain-split.md` | write | Archived lifecycle |
| `frontend/packages/contracts/src/index.ts` | write | Stable root facade |
| `frontend/packages/contracts/src/card.ts` | write | Shared card/deck primitives |
| `frontend/packages/contracts/src/game.ts` | write | Game HTTP/realtime owner |
| `frontend/packages/contracts/src/studio.ts` | write | Card Studio wire owner |
| `frontend/packages/contracts/test/**` | write | Domain-focused compatibility tests |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend-wire-contract-facade` | next API/session plan | this plan | Exclusive while selected; public facade frozen |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-09 21:54 UTC aggregate context and all
  queue manifests; unrelated infrastructure drafts have no contract claims.
- **Обнаруженные пересечения:** no direct write-set intersection with prune;
  next API/session plan consumes the stable package facade but does not claim
  contract source.
- **Решение:** run after prune commit and before API/session refactor. Any
  schema semantic/export change is material and requires new approval.

## План реализации

1. [x] Lock named export/import and accepted/rejected fixture behavior.
2. [x] Move shared card primitives, gameplay/realtime and Studio definitions to
   three explicit modules; keep root facade.
3. [x] Split tests by domain without weakening privacy/unknown/authority cases.
4. [x] Run contract, consumer and canonical checks; inspect compiled types and
   diff for semantic edits.

## Проверки

- [x] `pnpm --filter @munchkin/contracts lint`.
- [x] `pnpm --filter @munchkin/contracts typecheck`.
- [x] `pnpm --filter @munchkin/contracts test`.
- [x] Go-produced game fixture and real Nuxt package-root consumer through
  `./leinoctl verify --paths frontend/packages/contracts/src`.
- [x] `pnpm lint`, `pnpm check`, `pnpm build`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260809T212617Z-7a4a07-frontend-contract-domain-split`.

## Риски и откат

- **Риск:** circular imports, omitted named export or subtle Zod behavior/type
  drift hidden by source-only tests.
- **Mitigation:** stable root consumer compile, domain fixture parity, strict
  negative tests and no schema edits mixed with moves.
- **Откат:** revert isolated plan commit; no compatibility shim or duplicate
  schema copies.

## Открытые вопросы

- None. Any desire for package subpath exports is explicitly deferred until a
  second consumer proves the need.
- The queue-level unattended execution policy in the first plan applies:
  private module/test names inside this manifest are pre-authorized
  implementation detail; wire semantics and root exports are not.

## Согласование

- **Статус:** approved as exact queue member
- **Запрошено:** 2026-08-09 21:54:06 UTC
- **Подтверждено:** 2026-08-10
- **Формулировка/ограничения пользователя:** exact four-plan queue and
  unattended policy approved; non-material decisions inside this manifest and
  acceptance criteria are autonomous; no dependency install/upgrade, snapshot
  update or push; separate local commit required.

## Ход выполнения

- Exact queue member approved and selected after plan 1 commit; targeted
  takeover from the absent planning session recorded.
- Relocated definitions unchanged into `card.ts`, `game.ts` and `studio.ts`;
  `index.ts` is now a three-line root facade. A direct before/after extraction
  confirmed the same 82 named exports with no additions or omissions.
- Split the 16 game/privacy cases and three Studio secret/path cases into
  domain tests without introducing shared fixture machinery.
- Focused contract lint/typecheck and 19 tests passed. Full frontend lint,
  typecheck, 182 tests and production build passed. Canonical harness tests
  (44), leinoctl tests (81), plan-lint, script syntax and Compose config passed.
- Two superseded canonical attempts recorded a resolver-only failure because
  the invocation PATH omitted `/usr/local/bin`; the final run used the same
  installed Docker executable reported by preflight and completed successfully.
- Final `scope-check` reported `outsideWriteSet: []`, `unledgered: []`, all
  required checks present and `ok: true`.

## Итог

Contracts now have real internal domain owners behind the unchanged package
root. No wire/schema/type semantics, dependencies, package exports, snapshots
or external effects changed. Ready for the separately committed queue handoff.
