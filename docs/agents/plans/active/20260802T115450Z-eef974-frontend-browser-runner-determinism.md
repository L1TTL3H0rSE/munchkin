# PLAN: frontend browser runner determinism

- **Plan ID:** `20260802T115450Z-eef974-frontend-browser-runner-determinism`
- **Статус:** draft
- **Создан:** 2026-08-02 11:54:50 UTC
- **Обновлён:** 2026-08-02 12:20:00 UTC
- **Владелец:** —
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260802T115448Z-5d7519-leinoctl-plan-close-guard`.
- **Блокирует:** `20260802T115451Z-fe7a2e-workflow-runbook-evidence-hardening`, `20260801T225903Z-2b0ad7-figma-decision-interaction-surfaces`, `20260801T225904Z-83bfe1-figma-system-terminal-states`, `20260801T225905Z-64608a-frontend-redesign-verification-cleanup`
- **Связанные ADR/handoff:** `frontend/AGENTS.md`,
  `docs/agents/HARNESS.md`, `docs/agents/GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".gitignore",
    ".leino/profile.json",
    "frontend/package.json",
    "frontend/playwright.config.ts",
    "frontend/test/run-playwright.mjs",
    "frontend/test/run-playwright.test.mjs",
    "frontend/test/browser/fixtureSupport.ts",
    "frontend/test/browser/a11y.spec.ts",
    "frontend/test/browser/player-ui.spec.ts",
    "frontend/test/browser/visual.spec.ts",
    "docs/agents/plans/active/20260802T115450Z-eef974-frontend-browser-runner-determinism.md",
    "docs/agents/plans/archive/20260802T115450Z-eef974-frontend-browser-runner-determinism.md"
  ],
  "components": [
    "frontend-workspace",
    "repository-workflow"
  ],
  "contracts": [
    "frontend:browser-runner-v2",
    "frontend:artifact-boundary-v1",
    "leinoctl:toolchain-resolution-v1"
  ],
  "dependsOn": [
    "20260802T115448Z-5d7519-leinoctl-plan-close-guard"
  ],
  "sharedResources": [
    "frontend:browser-a11y-harness-v2",
    "frontend:playwright-temp-output-v1",
    "lifecycle:required-check-evidence-v1"
  ]
}
```

## Цель

Сделать browser evidence повторяемым на Windows и из любого допустимого cwd:
один runner должен запускать Playwright на bundled Node 24, не использовать
системный pnpm shim случайно, не оставлять десятки мегабайт артефактов в
worktree и гарантированно завершать Nuxt/Playwright descendants после failure.
Параллельно убрать ложные browser failures от скрытого desktop/mobile
presenter и cold-start/lock contention.

## Критерии приёмки

- [ ] `frontend/test/run-playwright.mjs` одинаково работает из repository root
  и из `frontend/`, сохраняет exact exit code/signal и не требует ручного
  `cd` или прямого вызова внутреннего Playwright CLI.
- [ ] Playwright `outputDir`, report, trace, video и `.last-run.json` по
  умолчанию находятся в unique temp directory вне worktree. На успешном run
  temporary output очищается; на failure путь к retained evidence явно
  выводится. `frontend/test/browser/artifacts/` не создаётся.
- [ ] Runner корректно forward-ит Ctrl+C/SIGINT/SIGTERM, завершает child и
  Nuxt descendants с bounded timeout, возвращает non-zero при assertion,
  startup или teardown failure и не оставляет orphan `node`/Nuxt process.
- [ ] Базовый toolchain evidence фиксирует Node `>=24`, Git Bash `>=4` и
  pnpm, согласованный с `frontend/package.json` `packageManager` (`10.8.0`),
  через declarative resolver из предыдущего generic plan; system shim с
  sandbox EPERM не выбирается молча.
- [ ] Browser commands не запускают `pnpm install`, не меняют lockfile и не
  обновляют snapshots автоматически. `--update-snapshots` требует явного
  отдельного действия и видимого diff.
- [ ] В helper/specs активный presenter выбирается явно (`:visible` или typed
  semantic helper), viewport-ы задаются в тесте/проекте явно; дубликат
  скрытого desktop/mobile DOM не создаёт ambiguous locator failures.
- [ ] Browser lanes разделены: focused player/a11y smoke, visual matrix и
  optional real boundary; workers default to deterministic serial или задаются
  явным bounded flag, а failed Card Studio/Nuxt teardown не зависает до
  внешнего command timeout.
- [ ] Regression test воспроизводит assertion failure и startup/teardown
  failure, проверяет bounded exit и отсутствие in-worktree artifacts.
- [ ] На текущей UI evidence baseline сохранены проверки уровня `player-ui
  51/51` и `visual 18/18` без snapshot updates либо в плане записано точное
  объяснение любого изменения count/baseline.

## Контекст и подтверждённое состояние

- `frontend/playwright.config.ts` сейчас пишет в
  `./test/browser/artifacts`; `.gitignore` не защищает от того, что
  scope-check увидит generated `.last-run.json`.
- Browser run уже оставлял около 50 MB traces/videos/screenshots, поэтому
  одной ignore-записи недостаточно: output boundary должен быть вне repo.
- `frontend/test/run-playwright.mjs` сейчас только spawn-ит Playwright и не
  имеет cwd resolution, signal forwarding или bounded descendant cleanup.
- Один browser assertion мог пройти, но runner зависал на Nuxt teardown и
  доходил до внешнего timeout; запуск с отдельным isolated dev-server это
  временно обходил, но не устранял причину.
- Serial Playwright run дал стабильные `51/51` player-ui и `18/18` visual;
  параллельный cold start ранее был flaky.
- На Windows canonical verify выбирал системный pnpm shim, который получил
  sandbox EPERM при чтении `C:\Users`; в одном evidence pnpm был `11.9.0`,
  при declared `packageManager` `10.8.0`.
- `Card Studio` compatibility smoke и player UI являются разными evidence
  границами; lock contention не должен маскироваться под frontend regression.

## Scope

### Входит

- Playwright config/runner/package scripts и narrow browser fixture helpers.
- Temp output/report policy, child-process cleanup and deterministic worker
  defaults.
- Repository profile mapping to generic declared toolchain resolver.
- Focused runner regression tests and semantic selector/viewport fixes in
  existing browser specs, без изменения product behavior.
- Defense-in-depth ignore rules for legacy artifacts, при сохранении основного
  outside-worktree output boundary.

### Не входит

- Production Vue components, backend/game, HTTP/realtime contracts or content.
- Redesign/visual direction changes, new snapshots or mass baseline refresh.
- Lockfile/dependency install, package upgrades, browser download or registry
  mutation as an implicit verification step.
- `.codex/hooks` generic implementation and `tools/leinoctl` core changes;
  only consume the resolver/ledger contract from predecessor plan.
- Commit, push, cloud/paid services and remote messages.

## Архитектурный подход

1. Runner resolves its own repo/frontend roots from `import.meta.url`, passes a
   unique temp evidence directory through environment and invokes the local
   Playwright CLI with `shell: false`.
2. Config uses explicit `path`/`os.tmpdir` output roots and a clear retention
   policy; no generated evidence path is inside a plan write set or source
   tree.
3. Runner installs signal handlers, waits for child close, applies a bounded
   cleanup path on Windows (including descendants), and differentiates test
   exit from teardown failure in its final exit code.
4. Package scripts remain thin aliases to the runner. They accept project,
   workers and spec filters without silently adding snapshot updates.
5. Browser fixtures expose active semantic presenter helpers and canonical
   viewport matrix. Visual, a11y and real-boundary suites are independently
   runnable and report their evidence directory.
6. Toolchain is resolved from declared profile/package metadata; no absolute
   user path is committed. Missing/mismatched tools fail before the browser
   server starts.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| `frontend/playwright.config.ts` | temp output, deterministic projects/server lifecycle | `frontend:browser-runner-v2` |
| `frontend/test/run-playwright.mjs` | cwd/signal/exit/cleanup wrapper | runner CLI behavior |
| `frontend/test/run-playwright.test.mjs` | process/artifact regression tests | no product data |
| `frontend/test/browser/**` (listed specs only) | visible selectors and explicit matrix | browser/a11y evidence |
| `frontend/package.json` | stable scripts and declared runner contract | `packageManager` remains authoritative |
| `.leino/profile.json` | repository mapping to resolver | `leinoctl:toolchain-resolution-v1` |
| `.gitignore` | legacy artifact defense-in-depth | no reliance on ignore for scope |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.gitignore` | write | Legacy browser artifact defense |
| `.leino/profile.json` | write | Portable declared toolchain mapping |
| `frontend/package.json` | write | Root-safe browser commands |
| `frontend/playwright.config.ts` | write | Temp output and deterministic server/projects |
| `frontend/test/run-playwright.mjs` | write | Runner lifecycle and cleanup |
| `frontend/test/run-playwright.test.mjs` | write | Runner regression matrix |
| `frontend/test/browser/fixtureSupport.ts` | write | Active presenter/viewport helper |
| `frontend/test/browser/a11y.spec.ts` | write | Explicit a11y smoke selectors |
| `frontend/test/browser/player-ui.spec.ts` | write | Deterministic player smoke selectors |
| `frontend/test/browser/visual.spec.ts` | write | Deterministic visual lane/viewport selection |
| `docs/agents/plans/active/20260802T115450Z-eef974-frontend-browser-runner-determinism.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260802T115450Z-eef974-frontend-browser-runner-determinism.md` | write | Archived lifecycle плана |

Generated browser output is intentionally **not** a write target; it must live
under the OS temp directory and be cleaned/retained by runner policy.

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:browser-a11y-harness-v2` | remaining UI plans, runbook | этот plan before UI queue | Only harness behavior; product UI remains out |
| `frontend:playwright-temp-output-v1` | runbook | этот plan | One output boundary for all browser lanes |
| `lifecycle:required-check-evidence-v1` | generic close guard, runbook | generic predecessor | Consume recorded-check contract |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-02 11:54 UTC.
- **Обнаруженные пересечения:** remaining UI plans claim
  `frontend/playwright.config.ts` and/or `frontend/test/browser/**`.
- **Решение:** generic ledger is the only predecessor of this plan. The three
  remaining UI plans now declare this browser plan as a direct predecessor, so
  the overlap is sequenced before any UI implementation. No plan may silently
  add snapshot or production UI paths here.

## План реализации

1. [ ] Capture current runner/config behavior and add failure tests before
   changing output or process handling.
2. [ ] Implement outside-worktree temp output with success cleanup/failure
   retention and explicit artifact path in result.
3. [ ] Make runner cwd-independent, signal-safe and bounded on Windows; verify
   no orphan Nuxt/Playwright process after assertion/startup failure.
4. [ ] Integrate declared Node/pnpm/Bash resolver and fail before server start
   on version/shim mismatch; do not install dependencies.
5. [ ] Make browser lanes serial-by-default/explicitly bounded and fix only
   visibility/semantic selector/viewport harness issues.
6. [ ] Run focused browser evidence and canonical repository checks; record
   exact counts, snapshot status, output location and teardown result in plan.

## Проверки

- [ ] `node --version` is `>=24`; `bash --version` is `>=4`; pnpm satisfies
  declared `packageManager` through resolver.
- [ ] Root invocation: `node frontend/test/run-playwright.mjs test player-ui.spec.ts --project=chromium --workers=1`
- [ ] Frontend invocation: `node test/run-playwright.mjs test player-ui.spec.ts --project=chromium --workers=1`
- [ ] Focused visual: `node frontend/test/run-playwright.mjs test visual.spec.ts --project=chromium --workers=1`
- [ ] Focused a11y and Card Studio compatibility smoke.
- [ ] Injected assertion/startup failure exits non-zero within bounded timeout;
  no in-worktree artifacts or orphan child processes remain.
- [ ] No snapshot updates; `git diff --check` is clean.
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260802T115450Z-eef974-frontend-browser-runner-determinism`

## Риски и откат

- **Риск:** temp cleanup удалит единственное failure evidence. **Снижение:**
  retain-on-failure prints an absolute path and never deletes failed output.
- **Риск:** descendant cleanup завершит чужой server. **Снижение:** only kill
  the process tree spawned by this runner, use unique ports/dirs, and preserve
  `reuseExistingServer` semantics explicitly.
- **Риск:** selector fix скроет real UI regression. **Снижение:** assert one
  visible semantic presenter and keep a11y/visual evidence separate.
- **Риск:** resolver picks a different pnpm major. **Снижение:** compare exact
  declared packageManager and fail before browser startup.
- **Откат:** revert runner/config/profile/test changes; temp artifacts are
  outside Git and no dependency install is part of rollback.

## Открытые вопросы

- Какой portable alias/profile field должен указывать bundled pnpm without
  embedding a machine-specific path.
- Нужен ли отдельный `--keep-artifacts` flag или достаточно retain-on-failure;
  default success path должен оставаться чистым.
- Какой bounded teardown timeout подходит для CI без скрытия настоящего
  server hang; значение должно быть зафиксировано тестом.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-08-02 12:00 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** расширить предыдущие планы и
  записать их в репозиторий; не обновлять snapshots и не выполнять push.

## Ход выполнения

- 2026-08-02: draft создан штатным `./leinoctl plan create`.
- 2026-08-02: добавлены findings о repo-root cwd, 50 MB generated output,
  Nuxt teardown hang, hidden presenter ambiguity, serial matrix и pnpm shim/
  packageManager mismatch.
- Реализация не начата.

## Итог

Заполняется после реализации и отдельного lifecycle closure.
