# PLAN: safe sequential plan rotation

- **Plan ID:** `20260731T011059Z-018e05-safe-sequential-plan-rotation`
- **Статус:** completed
- **Создан:** 2026-07-31 01:10:59 UTC
- **Обновлён:** 2026-07-31 01:35:06 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** нет
- **Блокирует:** безопасное последовательное выполнение очереди active plans
- **Связанные ADR/handoff:** `docs/agents/HARNESS.md`, `docs/agents/plans/README.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "AGENTS.md",
    "docs/agents/HARNESS.md",
    "docs/agents/plans/README.md",
    "tools/leinoctl/README.md",
    "tools/leinoctl/src/session.mjs",
    "tools/leinoctl/src/cli.mjs",
    "tools/leinoctl/test/session.test.mjs",
    "tools/leinoctl/test/cli.test.mjs",
    "docs/agents/plans/active/20260731T011059Z-018e05-safe-sequential-plan-rotation.md",
    "docs/agents/plans/archive/20260731T011059Z-018e05-safe-sequential-plan-rotation.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [
    "leinoctl:session-lifecycle-v2",
    "codex:sequential-plan-rotation-v1"
  ],
  "dependsOn": [],
  "sharedResources": [
    "leinoctl:session-runtime-schema",
    "leinoctl:plan-lifecycle-cli",
    "docs:agent-workflow"
  ]
}
```

## Цель

Разрешить одному Codex dialogue/session выполнять заранее согласованную очередь
планов строго по одному: закончить и отпустить текущий plan, зафиксировать его
отдельным commit, затем выбрать следующий с новым baseline и пустым ledger.
Преждевременный release или прямое переключение должны оставаться fail-closed.

## Критерии приёмки

- [x] Одновременно session по-прежнему может иметь только один selected plan;
  прямой `plan select B` при незавершённом `A` возвращает
  `session-plan-already-selected`.
- [x] `plan release A` без selected session сохраняет прежнюю семантику
  lifecycle handoff для draft/approval work.
- [x] Release выбранного плана разрешён только когда тот имеет статус
  `completed`, находится в archive, не содержит unchecked checklist items или
  lint issues, а свежий scope report не содержит outside-write-set и missing
  required checks.
- [x] Неуспешный release атомарен: session record и lifecycle ownership не
  удаляются и следующий plan выбрать нельзя.
- [x] Успешный release сохраняет rotation checkpoint/history вместо потери
  audit trail; до отдельного commit завершённого plan следующий select
  отклоняется понятной ошибкой.
- [x] После commit завершённого plan следующий approved/in-progress plan можно
  выбрать с тем же session ID; он получает новый baseline, новый lifecycle
  ownership и пустой targets/checks ledger.
- [x] Предсуществующие dirty paths из исходного baseline не считаются работой
  завершённого plan и не очищаются; новые незакоммиченные изменения блокируют
  rotation.
- [x] Eligibility и completed dependencies следующего plan проверяются обычным
  registry/plan-lint механизмом; release не является approval следующего plan.
- [x] Документация разрешает batch approval только для перечисленных exact
  plan IDs и порядка; material scope/contract/risk change или failed check
  останавливает очередь и требует пользователя.
- [x] Push выполняется между plans только когда он явно разрешён пользователем;
  локальный отдельный commit является обязательным checkpoint ротации.
- [x] Сценарии handoff, takeover, повторного select того же plan и
  one-selected-plan enforcement не регрессируют.
- [x] После изменения workflow полный leinoctl/hook harness и canonical
  repository checks проходят; новый контракт объявляется активным только в
  следующей trusted session.

## Контекст и подтверждённое состояние

- `AGENTS.md` и `docs/agents/HARNESS.md` сейчас запрещают смену plan/baseline в
  одной session.
- `selectSessionPlan` механически отклоняет другой plan при существующем
  session record через `session-plan-already-selected`.
- CLI `plan release` уже вызывает `releasePlanLifecycle` с
  `releaseSelectedSession: true`, удаляя session record без проверки
  завершения, scope или commit checkpoint.
- Архивные планы фиксируют ранее согласованный успешный workflow
  `complete -> verify -> archive -> commit/push -> release -> select`, поэтому
  текстовая политика, историческая практика и фактическая CLI-семантика сейчас
  расходятся.
- Session state уже содержит исходный Git snapshot и ledger targets/checks;
  `sessionScopeReport` умеет валидировать completed archived plan, свежесть
  canonical checks и границы write set.
- В worktree находятся пользовательские untracked draft plans. Они должны
  сохраниться как baseline state и не попадать в write set/commit этого plan.

## Scope

### Входит

- Generic leinoctl state transition для selected-plan release и последующего
  same-session select.
- Rotation checkpoint/history, atomic failure semantics и diagnostics.
- Unit/CLI tests для разрешённых и запрещённых переходов.
- Repository policy и runbook для exact ordered batch approval, commit
  checkpoint, release/select и stop conditions.

### Не входит

- Автоматическое утверждение, редактирование или переупорядочивание product
  plans.
- Автоматический commit/push, GitHub/GitLab orchestration или network checks.
- Параллельное выполнение write plans в одном worktree.
- Ослабление write-set, verification, dependency, takeover или privacy gates.
- Реализация текущих frontend/backend/infrastructure plans.

## Архитектурный подход

1. Сохранить `selectSessionPlan` fail-closed для прямой смены активного plan.
2. Разделить release простого lifecycle claim и release выбранного plan.
3. Для selected plan вычислять fresh completion/scope/check report до любой
   мутации runtime state.
4. После успешного release сохранять session в явной released/awaiting-commit
   фазе с неизменяемой историей plan ID и baseline/release snapshot.
5. Разрешать следующий select только после отдельного локального commit,
   отсутствия нового worktree delta относительно исходного baseline и
   прохождения eligibility/dependency checks следующего plan.
6. При select нового plan заменять active baseline/ledger, но сохранять
   bounded rotation history для диагностики.
7. Сначала изменить generic `tools/leinoctl`, затем согласовать repository
   profile policy в `AGENTS.md` и `docs/agents/**`.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| leinoctl session core | Released phase, checkpoint/history, guarded reselection | `.leino/runtime` local schema v2 |
| leinoctl CLI | Fail-closed selected release diagnostics | `plan release`, `plan select` |
| repository workflow | Разрешённая последовательная очередь | AGENTS/HARNESS contract |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `AGENTS.md` | write | Нормативное правило same-session rotation |
| `docs/agents/HARNESS.md` | write | State machine, invariants и trusted-session boundary |
| `docs/agents/plans/README.md` | write | Human lifecycle и batch approval |
| `tools/leinoctl/README.md` | write | CLI contract и примеры |
| `tools/leinoctl/src/session.mjs` | write | Generic session rotation state machine |
| `tools/leinoctl/src/cli.mjs` | write | Release/select validation orchestration |
| `tools/leinoctl/test/session.test.mjs` | write | State transition unit coverage |
| `tools/leinoctl/test/cli.test.mjs` | write | End-to-end CLI lifecycle coverage |
| `docs/agents/plans/active/20260731T011059Z-018e05-safe-sequential-plan-rotation.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260731T011059Z-018e05-safe-sequential-plan-rotation.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `leinoctl:session-runtime-schema` | все future plan sessions | этот plan | Exclusive migration-compatible reader |
| `leinoctl:plan-lifecycle-cli` | все active plans | этот plan | Нельзя реализовывать product plans параллельно |
| `docs:agent-workflow` | все active plans | этот plan | Policy change before queue execution |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 01:10:59 UTC
- **Обнаруженные пересечения:** все product/infra plans потребляют lifecycle,
  но не заявляют записи в `tools/leinoctl/**`, `AGENTS.md` или выбранные
  workflow docs; пользовательские draft-файлы остаются вне write set.
- **Решение:** exclusive session; не выбирать и не реализовывать другие plans
  до завершения этого workflow plan. После изменения policy начать новую
  trusted session и только тогда запускать очередь.

## План реализации

1. [x] Добавить generic released/awaiting-commit state и bounded rotation
   history без изменения repository-specific profile.
2. [x] Сделать selected `plan release` атомарным completion/scope/check gate;
   сохранить простой unselected lifecycle handoff.
3. [x] Разрешить same-session `plan select` только после отдельного commit и
   чистого delta относительно исходного baseline; сбросить active ledger.
4. [x] Добавить unit и CLI tests для happy path, premature release, missing
   checks, dirty transition, direct switch, handoff и takeover.
5. [x] Обновить generic CLI README, затем repository `AGENTS.md`,
   `HARNESS.md` и plans runbook с exact batch approval/stop rules.
6. [x] Просмотреть diff, выполнить полный harness/canonical verify,
   scope-check, архивировать plan и сообщить о необходимости новой trusted
   session.

## Проверки

- [x] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs`
- [x] `cd tools/leinoctl && node --test`
- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl preflight`
- [x] `./leinoctl text-check --changed`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260731T011059Z-018e05-safe-sequential-plan-rotation`
- [x] `git diff --check`
- [x] Manual fixture: completed archived A releases, commit checkpoint permits
  same-session select B with empty active ledger and preserved history.
- [x] Negative fixtures: active/incomplete A, stale/missing checks, outside
  scope, uncommitted delta and direct A-to-B select remain blocked.

## Риски и откат

- **Риск:** release станет обходом write-set/verification. **Снижение:**
  completion + fresh scope/check gate выполняется до удаления ownership.
- **Риск:** новый baseline скроет незакоммиченные изменения прошлого plan.
  **Снижение:** released/awaiting-commit phase и сравнение с исходным baseline.
- **Риск:** runtime schema v2 ломает незавершённые session. **Снижение:**
  backward-compatible чтение schema v1 и tests восстановления/handoff.
- **Риск:** длинный диалог несёт устаревший контекст. **Снижение:** exact
  ordered approval, dependency re-scan перед каждым select и stop на material
  change.
- **Откат:** вернуть one-plan-per-session policy и прежний session/CLI
  transition; runtime state локален/ignored, product data не меняются.

## Открытые вопросы

- Scope-changing вопросов нет. Локальный commit обязателен; push остаётся
  явным пользовательским разрешением, потому что CLI не должен зависеть от
  сети или remote availability.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 01:10:59 UTC
- **Подтверждено:** 2026-07-31 01:19:40 UTC
- **Формулировка/ограничения пользователя:** «Согласен с plan
  20260731T011059Z-018e05-safe-sequential-plan-rotation». Разрешена реализация
  exact plan; commit/push не запрошены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Exact plan ID явно согласован пользователем; plan переведён в
  `in_progress` перед selection.
- Plan выбран session `019fb585-f79e-7270-a0e8-623b6e4ee554`; baseline
  содержал только approval/lifecycle edit этого plan.
- Generic core разделил unselected claim handoff и guarded selected rotation.
  Rotation хранится в отдельном ignored checkpoint, поэтому hooks не считают
  released plan активным.
- Next select требует отдельного HEAD transition, сохраняет исходные dirty
  entries, разрешает только lifecycle edit exact next plan и создаёт schema v2
  session с новым baseline/пустым ledger и bounded history.
- Targeted session/CLI suites и full canonical suite прошли на bundled Node
  `v24.14.0`; system Node failure был только несовместимым toolchain и не
  использован как результат проверки.
- `preflight` завершился `ok` с ожидаемыми диагностическими warnings о dirty
  worktree, неизвестной pnpm version probe и недоступном Docker capability;
  эти capabilities не входят в changed component checks.
- `text-check` проверил 8 production/test/doc paths без issues; `git diff
  --check` чист.
- Финальный `verify --changed`: hooks `42/42`, leinoctl `68 passed / 0 failed /
  1 platform-permission skip`, plan-lint `issues=0`.
- Финальный scope-check: `outsideWriteSet=[]`, `missingRequiredChecks=[]`,
  `ok=true`; 8 writes отмечены как unledgered из-за текущего tool adapter, но
  это существующий warning, а не scope failure.
- Commit и push не выполнялись: пользователь согласовал implementation exact
  plan, но не запрашивал Git mutations.

## Итог

Same-session sequential plan rotation реализована fail-closed в generic
leinoctl и закреплена в repository policy. Новый lifecycle должен
использоваться только из следующей trusted session, где обновлённые
`AGENTS.md` и workflow core загружены с начала диалога.
