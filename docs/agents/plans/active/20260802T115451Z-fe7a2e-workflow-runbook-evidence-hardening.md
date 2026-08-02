# PLAN: workflow runbook evidence hardening

- **Plan ID:** `20260802T115451Z-fe7a2e-workflow-runbook-evidence-hardening`
- **Статус:** draft
- **Создан:** 2026-08-02 11:54:51 UTC
- **Обновлён:** 2026-08-02 12:20:00 UTC
- **Владелец:** —
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

- [ ] `AGENTS.md` и `docs/agents/plans/README.md` требуют queue preflight до
  batch approval: exact IDs, exact order, count consistency, direct dependency
  graph, overlapping write sets/shared resources, current owner/session state.
  Текст с «7 plans» при перечислении 8 IDs должен fail/checkpoint, а не
  исправляться молча.
- [ ] Документация прямо запрещает менять dependencies/order/write set/risk
  после approval без остановки и повторного согласования; `plan-lint` не
  используется как замена approval.
- [ ] Lifecycle table фиксирует порядок: selected plan → focused checks →
  canonical `verify`/recorded ledger → `scope-check` → completed + archive →
  `plan release <plan-id> --session <session-id>` → отдельный local commit →
  next claim/select. Push остаётся explicit user authorization.
- [ ] Runbook объясняет, что прямые hooks/leinoctl/plan-lint commands могут быть
  зелёными, но release всё ещё видит `missingRequiredChecks`, если результат
  не записан в текущий ledger; штатный способ регистрации описан через
  canonical verify/close, а не ручной внутренний helper.
- [ ] Записан recovery protocol для stale owner: read-only проверить session,
  repository identity и остановку прежнего owner; `--takeover` применять
  точечно; не удалять все `.leino/runtime/plan-owners` и не выбирать новый
  plan поверх selected session.
- [ ] Browser runbook фиксирует bundled Node 24/Git Bash, cwd-agnostic runner,
  declared pnpm version, serial/bounded worker policy и output вне worktree;
  ignore rules названы defense-in-depth, а не основным artifact boundary.
- [ ] Runbook отдельно предупреждает, что `pnpm install`/`--lockfile-only`
  может изменить lockfile/node_modules и не является бесплатной verification
  подготовкой; если lockfile входит в write set, это должно быть declared до
  approval.
- [ ] Evidence taxonomy содержит минимум: focused test, browser assertion,
  visual/a11y matrix, canonical verify, scope-check, release ledger и local
  commit. Ни один слой не рекламируется как доказательство другого.
- [ ] После изменений hooks/config/lifecycle rules зафиксирован новый trusted
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

1. [ ] Add queue preflight section with a concrete 8-vs-7 mismatch example and
   exact dependency/order validation.
2. [ ] Rewrite lifecycle section with selected/verify/scope/archive/release/
   commit/select boundaries and correct CLI syntax.
3. [ ] Add ledger/evidence taxonomy, stale-owner recovery and trusted-session
   handoff checklist.
4. [ ] Add frontend runtime/artifact/install/snapshot policy and distinguish
   ignore defense from temp output boundary.
5. [ ] Run text-check, plan-lint, canonical verify/scope-check and review the
   documentation diff for scope creep; do not archive until all evidence is
   recorded.

## Проверки

- [ ] `./leinoctl context --paths AGENTS.md,frontend/AGENTS.md,docs/agents/HARNESS.md,docs/agents/plans/README.md`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl text-check --paths AGENTS.md,frontend/AGENTS.md,docs/agents/HARNESS.md,docs/agents/plans/README.md`
- [ ] `./leinoctl verify --paths AGENTS.md,frontend/AGENTS.md,docs/agents/HARNESS.md,docs/agents/plans/README.md`
- [ ] `./leinoctl scope-check --plan 20260802T115451Z-fe7a2e-workflow-runbook-evidence-hardening`
- [ ] `git diff --check`
- [ ] Manual read-through confirms no instruction authorizes push, cloud
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

- Где лучше разместить reusable queue-preflight command/template: generic
  `leinoctl` (predecessor plan) или docs-only checklist; implementation choice
  должна быть согласована до изменения command surface.
- Нужно ли добавить отдельную документацию для `plan close` после того, как
  generic plan зафиксирует окончательное имя и exit contract.
- Как пользователь предпочитает оформлять trusted-session handoff после
  lifecycle changes: отдельной командой или только SessionStart evidence.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-08-02 12:00 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** расширить предыдущие планы и
  записать их в репозиторий; implementation и push не запрашивались.

## Ход выполнения

- 2026-08-02: draft создан штатным `./leinoctl plan create`.
- 2026-08-02: добавлены findings о mismatch 7/8, 26 registry conflicts,
  stale owners, ledger evidence, outside-worktree artifacts, toolchain/cwd,
  lockfile side effects и trusted-session boundary.
- Реализация не начата.

## Итог

Заполняется после реализации и отдельного lifecycle closure.
