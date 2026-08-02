# PLAN: workflow runbook evidence hardening

- **Plan ID:** `20260802T115451Z-fe7a2e-workflow-runbook-evidence-hardening`
- **Статус:** completed
- **Создан:** 2026-08-02 11:54:51 UTC
- **Обновлён:** 2026-08-02 13:55:00 UTC
- **Владелец:** `019fc267-5ce7-7cc0-9faf-0e3694e099b9`
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260802T115448Z-5d7519-leinoctl-plan-close-guard`, `20260802T115450Z-eef974-frontend-browser-runner-determinism`.
- **Блокирует:** нет
- **Связанные ADR/handoff:** `AGENTS.md`, `docs/agents/HARNESS.md`,
  `docs/agents/plans/README.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "AGENTS.md",
    "frontend/AGENTS.md",
    "docs/agents/HARNESS.md",
    "docs/agents/plans/README.md",
    "docs/agents/plans/active/20260802T115451Z-fe7a2e-workflow-runbook-evidence-hardening.md",
    "docs/agents/plans/archive/20260802T115451Z-fe7a2e-workflow-runbook-evidence-hardening.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [
    "repository:plan-queue-preflight-v1",
    "repository:lifecycle-evidence-v2",
    "repository:browser-artifact-boundary-v1"
  ],
  "dependsOn": [
    "20260802T115448Z-5d7519-leinoctl-plan-close-guard",
    "20260802T115450Z-eef974-frontend-browser-runner-determinism"
  ],
  "sharedResources": [
    "lifecycle:session-ledger-v2",
    "frontend:playwright-temp-output-v1",
    "repository:trusted-session-boundary-v1"
  ]
}
```

## Цель

Перенести повторяющиеся ловушки из chain transcript в executable runbook:
проверять точную очередь до approval, различать assertions/manual smoke и
canonical lifecycle evidence, закрывать plan в правильном порядке и не
оставлять следующий агенту угадывать runtime, cwd, artifact или owner
recovery. Документация должна запрещать silent repair и не расширять
authorization на code/cloud/push.

## Критерии приёмки

- [x] `AGENTS.md` и `docs/agents/plans/README.md` требуют queue preflight до
  batch approval: exact IDs, exact order, count consistency, direct dependency
  graph, overlapping write sets/shared resources, current owner/session state.
  Текст с «7 plans» при перечислении 8 IDs должен fail/checkpoint, а не
  исправляться молча.
- [x] Документация прямо запрещает менять dependencies/order/write set/risk
  после approval без остановки и повторного согласования; `plan-lint` не
  используется как замена approval.
- [x] Lifecycle table фиксирует порядок: selected plan → focused checks →
  canonical `verify`/recorded ledger → `scope-check` → completed + archive →
  `plan release <plan-id> --session <session-id>` → отдельный local commit →
  next claim/select. Push остаётся explicit user authorization.
- [x] Runbook объясняет, что прямые hooks/leinoctl/plan-lint commands могут быть
  зелёными, но release всё ещё видит `missingRequiredChecks`, если результат
  не записан в текущий ledger; штатный способ регистрации описан через
  canonical verify/close, а не ручной внутренний helper.
- [x] Записан recovery protocol для stale owner: read-only проверить session,
  repository identity и остановку прежнего owner; `--takeover` применять
  точечно; не удалять все `.leino/runtime/plan-owners` и не выбирать новый
  plan поверх selected session.
- [x] Browser runbook фиксирует bundled Node 24/Git Bash, cwd-agnostic runner,
  declared pnpm version, serial/bounded worker policy и output вне worktree;
  ignore rules названы defense-in-depth, а не основным artifact boundary.
- [x] Runbook отдельно предупреждает, что `pnpm install`/`--lockfile-only`
  может изменить lockfile/node_modules и не является бесплатной verification
  подготовкой; если lockfile входит в write set, это должно быть declared до
  approval.
- [x] Evidence taxonomy содержит минимум: focused test, browser assertion,
  visual/a11y matrix, canonical verify, scope-check, release ledger и local
  commit. Ни один слой не рекламируется как доказательство другого.
- [x] После изменений hooks/config/lifecycle rules зафиксирован новый trusted
  session boundary; текущая session не заявляет, что новые hooks уже активны.

## Контекст и подтверждённое состояние

- Batch transcript объявлял 7 plans, но фактически перечислял 8 IDs:
  foundation, lobby, primitives, mobile, desktop, interactions,
  system/terminal и final gate.
- `plan-lint` нашёл 26 dependency/registry conflicts; metadata поздних plans
  была исправлена уже после batch approval. Это должно стать pre-approval
  blocker с повторным approval, а не нормальным repair step.
- Были stale lifecycle owner-файлы без соответствующих session state; для
  первого plan применялся takeover. Нужен точечный recovery protocol.
- Browser artifacts оставались в worktree несмотря на ignore boundary; scope
  видел `.last-run.json`. Нужна outside-worktree policy.
- Canonical verify на системном pnpm shim дал Windows sandbox EPERM и только
  bundled Node24/Git Bash execution прошёл полный gate.
- Прямые harness tests были зелёными, но release не увидел их, пока checks не
  были записаны через canonical verify. Один повторный web run также показал
  transient Card Studio lock, поэтому flaky environment и product regression
  должны быть разнесены в evidence.
- Desktop plan завершился честно: browser `51/51` и `18/18`, verify,
  scope-check, release и отдельный commit `2a4ca08`; push и следующий select не
  выполнялись. Этот факт — пример целевого closure, а не новый scope.

## Scope

### Входит

- Root `AGENTS.md`, `frontend/AGENTS.md`, `docs/agents/HARNESS.md` и
  `docs/agents/plans/README.md`.
- Queue preflight checklist/template, lifecycle command examples, evidence
  naming and recovery guardrails.
- Explicit distinction between code/profile changes in predecessor plans and
  documentation-only rules in this plan.

### Не входит

- Изменения `.codex/hooks`, `tools/leinoctl`, `.leino/profile.json`, frontend
  runner, Playwright specs, package manager, lockfile или snapshots.
- Удаление runtime owners/artifacts, archive/release/commit/push actions.
- Изменение product, backend, cloud, CI provider, secrets or paid services.
- Запись нового durable fact в `PROJECT_MEMORY.md`; plan itself is the scope
  and audit trail.

## Архитектурный подход

1. Добавить короткий read-only queue preflight перед approval: parse exact IDs,
   compare count/order, load manifests, resolve direct dependencies, flag
   overlap and stale owners, then stop on mismatch.
2. Сделать lifecycle order copy-pasteable with the correct release argument
   order and a separate commit boundary; explicitly list what each evidence
   layer proves and does not prove.
3. Put runtime/toolchain/artifact policy next to the command it protects:
   bundled runtime, frontend cwd, temp output, no auto-install/snapshot update.
4. Describe recovery as narrow, observable and reversible. A stale owner is a
   finding; takeover is an explicit operation after human/session confirmation.
5. Add trusted-session rule after hook/config/lifecycle edits and a handoff
   checklist for the next session.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| root instructions | queue/approval/safety guardrails | `repository:plan-queue-preflight-v1` |
| frontend instructions | browser runtime/cwd/artifact guidance | `repository:browser-artifact-boundary-v1` |
| harness docs | ledger, required checks and trusted session | `repository:lifecycle-evidence-v2` |
| plans README | lifecycle and evidence runbook | `repository:lifecycle-evidence-v2` |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `AGENTS.md` | write | Root queue/lifecycle rules |
| `frontend/AGENTS.md` | write | Frontend runner/toolchain rules |
| `docs/agents/HARNESS.md` | write | Ledger/trusted-session evidence |
| `docs/agents/plans/README.md` | write | Exact lifecycle command order |
| `docs/agents/plans/active/20260802T115451Z-fe7a2e-workflow-runbook-evidence-hardening.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260802T115451Z-fe7a2e-workflow-runbook-evidence-hardening.md` | write | Archived lifecycle плана |

No source code, generated browser output, runtime ledger, lockfile or remote
resource is a write target.

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `lifecycle:session-ledger-v2` | generic close guard, browser runner | predecessors | Document after behavior is fixed |
| `frontend:playwright-temp-output-v1` | browser runner | browser plan | Document observed contract, do not implement it here |
| `repository:trusted-session-boundary-v1` | all workflow changes | this plan | New session required after hooks/config/lifecycle change |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-02 11:54 UTC.
- **Обнаруженные пересечения:** existing UI plans own parts of frontend docs/
  browser verification; generic and runner plans own behavior. This plan owns
  only the four documentation files listed above.
- **Решение:** execute last among the three workflow plans, after generic close
  guard and browser runner are released, but before the remaining UI queue.
  Any doc rule that changes write set/dependency/order pauses the queue and
  requires reapproval.

## План реализации

1. [x] Add queue preflight section with a concrete 8-vs-7 mismatch example and
   exact dependency/order validation.
2. [x] Rewrite lifecycle section with selected/verify/scope/archive/release/
   commit/select boundaries and correct CLI syntax.
3. [x] Add ledger/evidence taxonomy, stale-owner recovery and trusted-session
   handoff checklist.
4. [x] Add frontend runtime/artifact/install/snapshot policy and distinguish
   ignore defense from temp output boundary.
5. [x] Run text-check, plan-lint, canonical verify/scope-check and review the
   documentation diff for scope creep; do not archive until all evidence is
   recorded.

## Проверки

- [x] `./leinoctl context --paths AGENTS.md,frontend/AGENTS.md,docs/agents/HARNESS.md,docs/agents/plans/README.md`
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl text-check --paths AGENTS.md,frontend/AGENTS.md,docs/agents/HARNESS.md,docs/agents/plans/README.md`
- [x] `./leinoctl verify --paths AGENTS.md,frontend/AGENTS.md,docs/agents/HARNESS.md,docs/agents/plans/README.md`
- [x] `./leinoctl scope-check --plan 20260802T115451Z-fe7a2e-workflow-runbook-evidence-hardening`
- [x] `git diff --check`
- [x] Manual read-through confirms no instruction authorizes push, cloud
  mutation, dependency install, snapshot update or broad stale-owner cleanup.

## Риски и откат

- **Риск:** runbook becomes aspirational and diverges from executable CLI.
  **Снижение:** every command is checked against `leinoctl --help` and tests;
  unknown syntax is recorded as open question, not invented as fact.
- **Риск:** documentation change is mistaken for active hooks. **Снижение:**
  trusted-session boundary is explicit.
- **Риск:** preflight rules over-constrain unrelated work. **Снижение:** only
  repository workflow/lifecycle/browser evidence paths are covered; product
  plans retain their own scope.
- **Откат:** revert only the four documentation files; no runtime/remote state
  changes are involved.

## Открытые вопросы

Решения зафиксированы:

- Queue preflight остаётся docs-only checklist с exact IDs/count/order,
  dependencies, overlap и owner/session state; command surface generic
  `leinoctl` не расширяется этим plan.
- Отдельный `plan close` не документируется: публичный `plan release <id>
  --session <session-id>` остаётся lifecycle close boundary.
- После изменения hooks/config/lifecycle/runbook rules требуется новая trusted
  session с SessionStart evidence. Текущая session не заявляет, что новая
  policy уже активна; это ограничение записано в HARNESS и plans README.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-02 12:00 UTC
- **Подтверждено:** 2026-08-02 12:41 UTC
- **Формулировка/ограничения пользователя:** approve exact queue in order:
  `20260802T115448Z`, `20260802T115450Z`, `20260802T115451Z`; не обновлять
  snapshots и не выполнять push.

## Ход выполнения

- 2026-08-02: draft создан штатным `./leinoctl plan create`.
- 2026-08-02: добавлены findings о mismatch 7/8, 26 registry conflicts,
  stale owners, ledger evidence, outside-worktree artifacts, toolchain/cwd,
  lockfile side effects и trusted-session boundary.
- 2026-08-02 13:41 UTC: predecessor browser plan released and committed as
  `e1704e9`; stale owner `019fc235-357e-7c61-ba58-4573e367bf1e` was taken
  over after leinoctl confirmed its session state was absent. User approval
  was recorded for this third queued plan; no scope/order/write-set expansion
  is authorized.
- 2026-08-02 13:45 UTC: updated only `AGENTS.md`, `frontend/AGENTS.md`,
  `docs/agents/HARNESS.md` and `docs/agents/plans/README.md`. Added queue
  preflight hard stops, exact lifecycle/release syntax, evidence taxonomy,
  stale-owner recovery, browser temp/toolchain policy, no-install/no-snapshot
  guardrails and trusted-session handoff.
- 2026-08-02 13:48 UTC: context and strict text-check passed; canonical verify
  passed with all required checks recorded (harness 42/42, leinoctl 75 pass/1
  skip, plan-lint, frontend checks/build, bash syntax and Compose config).
  Scope-check returned `ok=true`, with no outside, unledgered or missing paths.
  `git diff --check` is clean; no code, lockfile, runtime ledger or remote
  state changed.

## Итог

Runbook evidence hardening реализован в пределах четырёх documentation paths.
Queue approval теперь fail-closed на count/order/dependency/overlap mismatch;
canonical ledger, scope, release, commit и push boundaries разделены; stale
owner recovery точечный; browser output/install/snapshot policy явно описана.
Новая trusted session требуется после этих instruction/lifecycle changes,
поэтому текущая session не заявляет активацию обновлённых hooks/instructions.
Plan готов к archive, guarded release и отдельному local commit; push не
выполняется.
