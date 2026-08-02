# PLAN: leinoctl plan close guard

- **Plan ID:** `20260802T115448Z-5d7519-leinoctl-plan-close-guard`
- **Статус:** draft
- **Создан:** 2026-08-02 11:54:48 UTC
- **Обновлён:** 2026-08-02 12:20:00 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** нет
- **Блокирует:**
  `20260802T115450Z-eef974-frontend-browser-runner-determinism`,
  `20260802T115451Z-fe7a2e-workflow-runbook-evidence-hardening`
- **Связанные ADR/handoff:** `docs/agents/HARNESS.md`,
  `docs/agents/plans/README.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "tools/leinoctl/src/cli.mjs",
    "tools/leinoctl/src/runner.mjs",
    "tools/leinoctl/src/session.mjs",
    "tools/leinoctl/src/toolchain.mjs",
    "tools/leinoctl/test/cli.test.mjs",
    "tools/leinoctl/test/runner.test.mjs",
    "tools/leinoctl/test/session.test.mjs",
    "tools/leinoctl/test/toolchain.test.mjs",
    "docs/agents/plans/active/20260802T115448Z-5d7519-leinoctl-plan-close-guard.md",
    "docs/agents/plans/archive/20260802T115448Z-5d7519-leinoctl-plan-close-guard.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [
    "leinoctl:session-ledger-v2",
    "leinoctl:plan-close-v1",
    "leinoctl:toolchain-resolution-v1"
  ],
  "dependsOn": [],
  "sharedResources": [
    "lifecycle:session-ledger-v2",
    "lifecycle:required-check-evidence-v1",
    "toolchain:declared-executable-resolution-v1"
  ]
}
```

## Цель

Убрать повторяющийся ручной lifecycle-repair вокруг `verify`, `scope-check`,
`plan release` и следующего `select`: успешные проверки должны попадать в
session ledger автоматически, patch targets не должны теряться, а закрытие
плана должно быть одной fail-closed проверяемой state transition. Commit и
push остаются отдельными действиями и не выполняются этим plan.

## Критерии приёмки

- [ ] Добавлена явная close/finalize-команда или эквивалентный подкомандный
  режим `leinoctl`, который принимает exact plan ID и session ID, проверяет
  selected-plan ownership, checklist, archive placement, lint, scope,
  required checks и current fingerprints; при отказе не меняет plan, owner,
  session или rotation checkpoint.
- [ ] После успешного close/release в ledger присутствуют все required checks,
  вычисленные из impacted components, включая Codex hooks tests, leinoctl tests
  и plan-lint для `repository-workflow`; повторный ручной запуск одного и того
  же check не требуется только для его регистрации.
- [ ] `verify --changed` записывает для каждого запуска `id`, `cwd`, точный
  `argv`, `exitCode`, `dryRun`, `checkedPaths` и input fingerprint; неуспешный
  или dry-run результат не маскируется как успешное lifecycle evidence.
- [ ] `recordSessionTargets` выполняет нормализацию и атомарное объединение
  targets без потери записей при последовательных/повторных PostToolUse
  событиях; повторная запись idempotent.
- [ ] Scope report различает outside-write-set, unledgered и stale-check
  состояния, не превращая предупреждение о generated temp output в скрытый
  зелёный release. Для in-scope write потеря target evidence видна в ошибке
  close, а не исправляется ручным вызовом внутреннего helper.
- [ ] Recovery показывает owner/session mismatch и отсутствие session state;
  `--takeover` остаётся явным действием, автоматического удаления всех stale
  owner-файлов нет. Добавлен тест, что takeover одной записи не затрагивает
  другие планы.
- [ ] Toolchain inspection может вернуть resolved executable path и version,
  применяет declared resolver/alias до системного PATH и fail-closed при
  mismatch; в коде нет hardcoded пользовательского пути `C:\Users\...`.
- [ ] API сохраняет отдельные границы: close/release не делает Git commit,
  push, plan select следующего ID, cloud mutation, dependency install или
  изменение production/frontend UI.

## Контекст и подтверждённое состояние

- `plan release` уже требует completed archived plan, чистый checklist, scope
  и required checks, но direct hooks/leinoctl/plan-lint runs не попадают в
  ledger автоматически.
- В desktop closure повторный `verify` с дополнительными workflow paths
  понадобился только для регистрации трёх required checks; после этого
  `missingRequiredChecks` стал пустым и release прошёл.
- `recordSessionTargets` пришлось вызывать вручную после того, как ранние
  patch-вызовы не попали в post-write ledger.
- `session.mjs` сейчас хранит targets/checks через read-modify-write; это
  оставляет место для потерянных обновлений и не даёт close-команде объяснить
  происхождение unledgered path.
- Синтаксис текущего release должен быть отражён в проверках и документации:
  `./leinoctl plan release <plan-id> --session <session-id>`.
- Текущие approved UI plans остаются downstream-очередью; пользователь
  отдельно разрешил поставить workflow plans перед оставшимися UI plans.
  Статусы, owners и product write sets UI plans этим draft не меняются.

## Scope

### Входит

- Generic session ledger, required-check evidence и fingerprint validation в
  `tools/leinoctl`.
- Fail-closed close/release orchestration без commit/push.
- Безопасная обработка команд runner-а: сохранение exit result до throw,
  capture метаданных и bounded completion, необходимая для lifecycle evidence.
- Declarative executable resolution/version reporting в generic toolchain core.
- Unit/CLI tests на missing checks, stale fingerprints, concurrent/idempotent
  targets, failed close, stale owner и commit-before-rotation guard.

### Не входит

- Изменения `.codex/hooks`, `.leino/profile.json`, frontend Playwright и
  package scripts — это следующий repository-profile plan.
- Изменения backend/game, API contracts, database, Compose, Terraform,
  GitHub/GitLab, cloud, DNS, Monium или public traffic.
- Автоматический Git commit/push или автоматический выбор следующего plan.
- Удаление stale runtime-файлов широким glob-ом.

## Архитектурный подход

1. Выделить единый generic `required-check plan` из текущего impact graph и
   передавать его в verify, scope report и guarded release.
2. Записывать command result и fingerprint через один session API до возврата
   ошибки; dry-run остаётся диагностикой и не удовлетворяет required check.
3. Сделать ledger update atomic/idempotent: нормализовать repo-relative paths,
   объединять targets/checks, сохранять прежнее состояние при любой ошибке.
4. Добавить close/finalize state machine, которая сначала полностью проверяет
   preconditions, затем выполняет только разрешённые lifecycle writes. Any
   failed precondition оставляет owner/session/plan неизменными.
5. Для owner recovery добавить read-only status/evidence и оставить takeover
   explicit; отсутствие файла session не является разрешением чистить registry.
6. Расширить toolchain core declarative resolution так, чтобы repository
   profile мог выбрать bundled executable без привязки к конкретному Windows
   user path.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| `tools/leinoctl/src/session.mjs` | atomic targets/checks, close guards, stale evidence | `leinoctl:session-ledger-v2` |
| `tools/leinoctl/src/cli.mjs` | close/status/recording orchestration and exact option errors | `leinoctl:plan-close-v1` |
| `tools/leinoctl/src/runner.mjs` | bounded command result and failure metadata | check evidence envelope |
| `tools/leinoctl/src/toolchain.mjs` | declared executable resolution and version evidence | `leinoctl:toolchain-resolution-v1` |
| `tools/leinoctl/test/**` | regression matrix for lifecycle failure/success paths | no production data |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `tools/leinoctl/src/cli.mjs` | write | Close/release CLI state machine |
| `tools/leinoctl/src/runner.mjs` | write | Check result and bounded process evidence |
| `tools/leinoctl/src/session.mjs` | write | Atomic ledger and lifecycle guards |
| `tools/leinoctl/src/toolchain.mjs` | write | Explicit executable resolution |
| `tools/leinoctl/test/cli.test.mjs` | write | CLI lifecycle regressions |
| `tools/leinoctl/test/runner.test.mjs` | write | Runner failure/exit evidence |
| `tools/leinoctl/test/session.test.mjs` | write | Ledger/owner/rotation regressions |
| `tools/leinoctl/test/toolchain.test.mjs` | write | Windows/PATH/resolver regressions |
| `docs/agents/plans/active/20260802T115448Z-5d7519-leinoctl-plan-close-guard.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260802T115448Z-5d7519-leinoctl-plan-close-guard.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `lifecycle:session-ledger-v2` | browser runner, runbook | этот plan | Generic core first; profile adapters после release |
| `lifecycle:required-check-evidence-v1` | browser runner, runbook | этот plan | One canonical recording shape |
| `toolchain:declared-executable-resolution-v1` | browser runner | этот plan | Profile supplies aliases only after core exists |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-02 11:54 UTC, повторная read-only
  сверка перед записью draft.
- **Обнаруженные пересечения:** browser plan пересекается с frontend/browser
  verification paths оставшихся UI plans; generic `tools/leinoctl` paths
  отдельны. Старые owner-файлы UI plans не считаются approval или текущей
  session.
- **Решение:** этот plan идёт первым в новой workflow-очереди; browser runner
  и runbook зависят от него, а оставшиеся UI plans зависят от browser runner.
  Пользователь явно разрешил это изменение порядка 2026-08-02.

## План реализации

1. [ ] Зафиксировать текущий CLI/session contract тестами до изменения
   реализации, включая точный порядок `plan release <id> --session`.
2. [ ] Вынести единый required-check descriptor и записывать результаты вместе
   с checked paths/fingerprint даже при non-zero exit.
3. [ ] Исправить atomic/idempotent target/check ledger и добавить stale-owner
   read-only diagnostics без broad cleanup.
4. [ ] Реализовать close/finalize guard с fail-closed preconditions и
   transaction-like rollback при ошибке lifecycle write.
5. [ ] Добавить declarative toolchain resolver и тесты системного shim,
   bundled path, version mismatch и missing executable.
6. [ ] Выполнить generic harness gates и показать diff; затем остановиться для
   отдельного lifecycle approval/release этого plan.

## Проверки

- [ ] `node --test --test-isolation=none tools/leinoctl/test/*.test.mjs`
- [ ] Focused session/CLI/runner/toolchain tests: success, failed check,
  dry-run, stale fingerprint, duplicate target, stale owner and failed close.
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl preflight --require-toolchain`
- [ ] `./leinoctl verify --paths tools/leinoctl/src,tools/leinoctl/test`
- [ ] `./leinoctl scope-check --plan 20260802T115448Z-5d7519-leinoctl-plan-close-guard`
- [ ] `git diff --check`
- [ ] Release evidence proves no commit/push/next-select was performed by the
  close command.

## Риски и откат

- **Риск:** close-команда станет скрытым auto-commit/auto-select механизмом.
  **Снижение:** explicit plan/session, no Git mutation, no next-plan action;
  dedicated CLI tests.
- **Риск:** неуспешный check будет записан как зелёный. **Снижение:**
  `exitCode`, `dryRun` and input fingerprint are required fields; success is
  granted only to exit code 0 and current inputs.
- **Риск:** параллельные hook updates потеряют targets. **Снижение:** atomic
  merge/retry and idempotent fixture tests.
- **Риск:** takeover скроет живую session. **Снижение:** read-only owner/session
  report and explicit `--takeover`; no automatic stale cleanup.
- **Откат:** revert only this plan's generic source/tests; ignored local ledger
  and rotation files are not committed and remote state is untouched.

## Открытые вопросы

- Нужно выбрать окончательное имя close subcommand (`plan close` или
  `plan finalize`) до implementation; это material CLI contract и должно быть
  явно зафиксировано в approval.
- Нужно решить, является ли unledgered in-scope path hard error для release или
  отдельным evidence category с explicit acknowledgement; silent warning
  превращать в зелёный close нельзя.
- Нужно определить portable source bundled toolchain alias в profile, не
  записывая абсолютный путь пользователя.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-08-02 12:00 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** расширить предыдущие планы и
  записать их в репозиторий; менять код, select, commit и push пока не просил.

## Ход выполнения

- 2026-08-02: draft создан штатным `./leinoctl plan create`.
- 2026-08-02: добавлены findings о required-check ledger, потерянных patch
  targets, stale owners, toolchain resolver и fail-closed close transition.
- Реализация не начата.

## Итог

Заполняется после реализации и отдельного lifecycle closure.
