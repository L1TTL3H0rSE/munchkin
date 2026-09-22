# PLAN: agent delegation planning workflow

- **Plan ID:** `20260803T111613Z-1cf94f-agent-delegation-planning-workflow`
- **Статус:** completed
- **Создан:** 2026-08-03 11:16:13 UTC
- **Обновлён:** 2026-08-03 15:43 MSK
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260802T164112Z-dfb164-production-live-wif-registry-evidence`.
- **Блокирует:** plan `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration`
- **Связанные ADR/handoff:** `docs/agents/HARNESS.md`, `docs/agents/plans/README.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "AGENTS.md",
    ".codex/config.toml",
    ".codex/agents/explorer.toml",
    ".codex/agents/reviewer.toml",
    ".codex/hooks/session-start.mjs",
    ".codex/hooks/test/configuration.test.mjs",
    ".agents/skills/backend-game-change/SKILL.md",
    ".agents/skills/content-pack-change/SKILL.md",
    ".agents/skills/frontend-game-change/SKILL.md",
    ".agents/skills/repository-workflow-change/SKILL.md",
    "docs/agents/README.md",
    "docs/agents/HARNESS.md",
    "docs/agents/DELEGATION.md",
    "docs/agents/plans/README.md",
    "docs/agents/plans/_template.md",
    "docs/agents/plans/active/20260803T111613Z-1cf94f-agent-delegation-planning-workflow.md",
    "docs/agents/plans/archive/20260803T111613Z-1cf94f-agent-delegation-planning-workflow.md"
  ],
  "components": ["repository-workflow"],
  "contracts": [
    "codex:planning-delegation-v1",
    "leinoctl:plan-authoring-v1"
  ],
  "dependsOn": [
    "20260802T164112Z-dfb164-production-live-wif-registry-evidence"
  ],
  "sharedResources": [
    "repository:harness-policy",
    "repository:plan-authoring-contract",
    "codex:project-agent-routing"
  ]
}
```

## Цель

Сделать planning delegation ожидаемым и воспроизводимым поведением: до
согласования большого plan root создаёт skeleton plan, заранее фиксирует в нём
независимые read-only work packages, запускает подходящих planning agents,
синтезирует их evidence и отдаёт plan на отдельный adversarial review.

Harness хранит постоянные критерии, model routing и ограничения, а каждый plan
хранит только своё task-specific решение и work packages. В этой итерации
read-only agents исследуют и проверяют, а все repository writes выполняет root.
Формат plan уже различает будущие write packages, но их исполнение передано
отдельному worktree-orchestration plan.

## Критерии приёмки

- [x] `AGENTS.md` и domain skills явно требуют planning agents для большой
      задачи, поэтому local Codex получает положительный delegation trigger, а
      не только разрешение вызвать агента.
- [x] Большая задача определяется по risk/independent workstreams, а не по
      длине Markdown; маленький plan обязан записать `not needed` с причиной.
- [x] Новый plan template содержит обязательный `Delegation strategy` с
      classification, предварительными work packages, role/model/effort,
      scope, output, stop condition, root parallel work и фактическим evidence.
- [x] Workflow не содержит chicken-and-egg: initial context предшествует
      skeleton plan, агенты запускаются после предварительной delegation map,
      затем тот же draft уточняется до запроса approval.
- [x] Default routing использует root/Sol для synthesis и решений,
      Luna explorer для узкого bounded research и Terra reviewer для широкого
      cross-plan/cross-component review; escalation зависит от ambiguity/risk,
      а не от фиксированной доли токенов.
- [x] Agent profiles, project config и SessionStart reminder согласованы с
      documented routing и ограничением `max_depth = 1`.
- [x] `DELEGATION_META` остаётся read-only и fail-closed с пустым write set;
      plan template при этом умеет помечать потенциальный write package как
      `root-only pending worktree orchestration`, не запуская writer.
- [x] Harness tests проверяют model/profile/config/template/reminder contract;
      canonical repository-workflow checks, plan-lint, preflight, text-check и
      diff review выполнены и записаны.
- [x] После изменения hooks/config/instructions подготовлен handoff checkpoint:
      текущая session не заявляет новую policy активной; проверка выполняется в
      новой trusted session по SessionStart evidence.

## Контекст и подтверждённое состояние

- `.codex/config.toml` включает multi-agent, ограничивает три subagent threads
  и глубину одним уровнем.
- `AGENTS.md` сейчас только ограничивает делегирование независимой read-only
  задачей при полезной параллельной работе root; положительного требования для
  планирования большой задачи нет.
- `explorer` и `reviewer` оба используют `gpt-5.6-luna` с `max`, несмотря на
  разные требования к bounded search и широкому adversarial review.
- `.codex/hooks/lib/delegation.mjs` уже валидирует bounded context,
  `root_parallel_work`, expected savings, read-only empty write set и named
  profiles, но для `access: write` безусловно возвращает
  `delegation-write-binding-unsupported` и требует отдельный worktree.
- Worktree isolation, durable worker sessions, checkpoint/recovery и controlled
  integration выделены в direct follow-up
  `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration`; временный
  cooperative shared-worktree writer здесь не создаётся.
- Текущий Codex workflow запускает agents после прямого запроса либо явного
  требования applicable `AGENTS.md`/skill; поэтому durable positive trigger
  должен жить в repository instructions и skills.
- Актуальный GPT-5.6 routing допускает дешёвый Luna fan-out, но published
  long-context results заметно слабее Terra; поэтому task context обязан быть
  bounded, а full-plan reviewer маршрутизируется на Terra.
- `./leinoctl context` и `plan-lint` 2026-08-03 подтверждают registry без lint
  issues; dependency `20260802T164112Z-dfb164-production-live-wif-registry-evidence`
  уже `completed` и находится в archive, поэтому execution blocker снят.
- Другие active plans, включая frontend remediation draft, сохраняются без
  изменений.

## Scope

### Входит

- Repository-wide classification и mandatory planning-delegation workflow.
- Новый concise `docs/agents/DELEGATION.md` как постоянный routing contract.
- Skeleton-plan-first delegation map и evidence fields в plan template/runbook.
- Explicit delegation steps в backend/frontend/content/repository skills.
- Model routing: Luna bounded explorer, Terra adversarial reviewer, Sol/root
  synthesis/authority; documented escalation conditions.
- Project agent/config updates и SessionStart reminder.
- Static regression tests для новых config/profile/template/reminder invariants.
- Маркировка потенциальных write packages в plan без их выполнения subagent:
  до follow-up plan они остаются root-owned.

### Не входит

- Любые write-сабагенты, cooperative write leases, отдельные worktree,
  worker sessions, agent commits, checkpoints, recovery и merge orchestration;
  весь этот scope принадлежит direct follow-up plan
  `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration`.
- Изменение plan manifest schema, leinoctl parser/session/ledger или generic
  lifecycle semantics.
- Автоматический выбор модели по реальному billing/benchmark API, hardcoded
  token prices или budget enforcement.
- Изменение product/backend/frontend/content code и активных чужих plans.

## Архитектурный подход

- **Permanent policy в harness:** критерии large/small, безопасные роли,
  model defaults, escalation и root-only write boundary до follow-up.
- **Task policy в plan:** classification, причина, предварительные bounded work
  packages и после выполнения ссылки на evidence/выводы. Временные agent IDs в
  plan не фиксируются.
- **Двухступенчатое планирование:** root выполняет initial context и создаёт
  skeleton; для large plan запускает независимых explorers, параллельно
  уточняет scope/conflicts; после synthesis reviewer проверяет draft, пока root
  выполняет plan-lint/context consistency checks.
- **Fail-closed small path:** отсутствие agents допустимо только с явным
  `not needed` и конкретной причиной; размер текста не является критерием.
- **Authority:** subagents возвращают evidence и findings; root отвечает за
  scope, архитектурные решения, approval request, repository writes,
  verification и lifecycle.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository workflow | mandatory planning fan-out и plan-specific map | новый internal `codex:planning-delegation-v1` |
| project agents | Luna explorer / Terra reviewer routing | local Codex config, без product API |
| plan authoring | delegation decision/packages/evidence section | template/runbook only; manifest v1 сохраняется |
| hooks | SessionStart reminder и static checks | PreTool write delegation остаётся заблокированным |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `AGENTS.md` | write | Positive large-plan delegation trigger и root-only write boundary |
| `.codex/config.toml` | write | Current agent concurrency/default routing keys |
| `.codex/agents/explorer.toml` | write | Bounded Luna planning explorer profile |
| `.codex/agents/reviewer.toml` | write | Broad Terra adversarial planning reviewer profile |
| `.codex/hooks/session-start.mjs` | write | Trusted-session reminder о delegation decision/map |
| `.codex/hooks/test/configuration.test.mjs` | write | Static routing/config/template/reminder regression checks |
| `.agents/skills/backend-game-change/SKILL.md` | write | Domain-specific planning fan-out trigger |
| `.agents/skills/content-pack-change/SKILL.md` | write | Domain-specific planning fan-out trigger |
| `.agents/skills/frontend-game-change/SKILL.md` | write | Domain-specific planning fan-out trigger |
| `.agents/skills/repository-workflow-change/SKILL.md` | write | Harness-specific planning review trigger |
| `docs/agents/README.md` | write | Навигация к delegation contract |
| `docs/agents/HARNESS.md` | write | Permanent workflow boundary and evidence taxonomy |
| `docs/agents/DELEGATION.md` | write | Новый detailed classification/routing/runbook |
| `docs/agents/plans/README.md` | write | Skeleton-plan-first lifecycle |
| `docs/agents/plans/_template.md` | write | Task-specific delegation strategy/evidence fields |
| `docs/agents/plans/active/20260803T111613Z-1cf94f-agent-delegation-planning-workflow.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260803T111613Z-1cf94f-agent-delegation-planning-workflow.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок/стратегия |
|---|---|---|---|
| `repository:harness-policy` | completed production live WIF plan | exclusive | dependency archived; повторить context и начать новую trusted session |
| `repository:plan-authoring-contract` | все будущие plans | этот plan | применяется только после completion/new session |
| `codex:project-agent-routing` | active Codex sessions | этот plan | current session не доказывает reload |

### Проверка конфликтов

- **Проверены active plans:** `./leinoctl context --paths ...`, manifests,
  write sets, owner/session state и `./leinoctl preflight`, 2026-08-03.
- **Обнаруженные пересечения:** archived completed plan
  `20260802T164112Z-dfb164-production-live-wif-registry-evidence` исторически
  менял `docs/agents/HARNESS.md`, но больше не является eligible concurrent
  owner. Frontend remediation draft
  `20260803T105519Z-a1d39d-...` не входит в source write set этого plan.
- **Решение:** exact dependency удовлетворена; перед approval/select повторить
  context/preflight и не изменять чужие active plans.

## Delegation strategy

- **Classification:** large; planning delegation required.
- **Почему:** repository-wide instructions/config/skills/template образуют
  несколько независимых evidence surfaces и меняют поведение будущих sessions.
- **Planning agents до approval:** не запускаются в этой bootstrap session,
  потому что новая positive policy ещё не активна, а текущая platform policy не
  разрешает proactive spawn без явного delegation request. Архитектурное
  исследование выполнено root read-only; это ограничение записывается как
  bootstrap evidence, а новый workflow проверяется в следующей trusted session.
- **Planned validation package:** после implementation отдельный read-only
  reviewer проверяет согласованность AGENTS/skills/template/config, пока root
  выполняет diff и canonical checks; запуск возможен только если действующая
  session policy явно его разрешает.
- **Write delegation:** prohibited in this plan; все subagents имеют
  `write_set: []`. Потенциальные write packages фиксируются для будущего
  worktree runner, но до его completion исполняются root.
- **Authority:** root принимает решения, вносит изменения, проверяет результат
  и закрывает plan.

### Actual delegation evidence

- **Config/hook audit — Luna explorer, completed:** подтвердил current profile,
  SessionStart и test gaps; предложил Luna/high default, Terra/high reviewer и
  strict-config proof. Root параллельно проектировал docs/template contract.
- **Docs/skills audit — Luna explorer, completed:** сопоставил positive trigger,
  skeleton-first lifecycle, package fields и bootstrap boundary во всех
  инструкциях. Root параллельно готовил executable config/hook patch.
- **Adversarial diff review — Terra reviewer, completed:** нашёл один P2 —
  static tests не защищали trigger в `AGENTS.md` и четырёх skills. Root добавил
  per-surface large/small assertions; follow-up reviewer подтвердил finding
  закрытым без остаточных замечаний.
- **Write evidence:** все delegated packages были `read-only` с
  `write_set: []`; все repository edits выполнил root.

## План реализации

1. [x] Добавить `docs/agents/DELEGATION.md` с large/small criteria,
       skeleton-plan-first sequence, model routing, escalation и готовым
       bounded `DELEGATION_META` примером.
2. [x] Обновить `AGENTS.md`, README/HARNESS и четыре domain skills так, чтобы
       large planning fan-out был явным требованием, а small path требовал
       записанной причины.
3. [x] Добавить `Delegation strategy` в template и уточнить plan lifecycle:
       preliminary packages фиксируются до spawn, actual evidence — до approval.
4. [x] Настроить agent profiles/config: Luna для bounded explorer, Terra для
       broad reviewer, depth `1` и bounded read concurrency; worker profile и
       write policy остаются follow-up scope.
5. [x] Обновить SessionStart reminder и static configuration tests.
6. [x] Просмотреть diff, выполнить focused hooks tests, полный leinoctl suite,
       plan-lint, canonical `verify --changed`, text-check и scope-check.
7. [x] Записать bootstrap limitation, завершить/archive/release plan и создать
       отдельный local commit; новую policy подтвердить новой trusted session.

## Оценка времени

- **Активная инженерная работа:** 6–10 часов, ориентировочно 1–2 рабочих дня.
- **Не включено:** ожидание completion/release dependency, user approval,
  новая trusted session и внешние platform delays.

## Проверки

- [x] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs` — 44/44.
- [x] `(cd tools/leinoctl && node --test)` — 81/81.
- [x] `node .codex/hooks/plan-lint.mjs` — `issues=0`.
- [x] `./leinoctl preflight` — toolchain ready, включая pnpm `10.8.0`.
- [x] `./leinoctl text-check --changed` — issues отсутствуют.
- [x] `./leinoctl verify --changed` — repository-workflow checks успешны.
- [x] `./leinoctl scope-check --plan 20260803T111613Z-1cf94f-agent-delegation-planning-workflow`
      — outside/unledgered paths отсутствуют, required checks свежие.
- [x] `git diff --check` и scoped diff review — clean; Terra review finding
      закрыт и подтверждён follow-up review.
- [x] Post-commit handoff checkpoint записан: только новая trusted session
      должна сообщить `Munchkin harness is active` и новый planning-delegation
      reminder; текущая session не считается activation evidence.

## Риски и откат

- **Риск:** чрезмерный fan-out для маленьких задач. **Митигация:** объективные
  risk/workstream criteria и `not needed` path.
- **Риск:** Luna получает слишком широкий context. **Митигация:** bounded
  package/fork и Terra reviewer для whole-plan review.
- **Риск:** plan описывает agents после их запуска. **Митигация:** обязательный
  skeleton plan до spawn и отдельное actual-evidence обновление.
- **Риск:** agents воспринимают model routing как жёсткое вечное правило.
  **Митигация:** роли и escalation нормативны, цены/benchmark numbers не
  hardcode; текущие model defaults локализованы в profiles.
- **Риск:** current session ложно считается обновлённой. **Митигация:** новая
  trusted session обязательна до claims об activation.
- **Риск:** users ожидают write delegation сразу после первого plan.
  **Митигация:** docs явно маркируют write packages как root-only до completion
  exact follow-up worktree plan.
- **Откат:** вернуть этот отдельный commit; product/schema/data не меняются.

## Открытые вопросы

- Нет. Read-only fan-out может быть параллельным; write delegation не получает
  временную shared-worktree реализацию и переходит в exact follow-up plan.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-03 после read-only impact/conflict анализа
- **Подтверждено:** 2026-08-03 15:27 MSK, пользователь явно утвердил exact
  plan ID и полную реализацию по lifecycle.
- **Формулировка/ограничения пользователя:** отредактировать harness под новый
  workflow; task-specific agents заранее описывать в plan, permanent
  trigger/routing хранить в harness. После выделения отдельного worktree plan
  первый этап оставляет root единственным writer и не строит временный
  cooperative механизм. Для реализации разрешены адаптивные bounded read-only
  сабагенты без формальной квоты; repository writes выполняет только root;
  обязательны проверки, scope-check, archive и отдельный локальный commit.

## Ход выполнения

- Draft `20260803T111613Z-1cf94f-agent-delegation-planning-workflow` создан
  атомарно; product/harness implementation не начата.
- Read-only context подтвердил repository-workflow impact, direct dependency и
  lint-clean registry; чужие active plans не изменялись.
- Пользователь утвердил exact plan; session
  `019fc743-f079-7d30-9756-e9aedfd5592e` выбрала его на clean source baseline.
- Root реализовал permanent delegation contract, routing profiles/config,
  SessionStart reminder и static regression coverage; write-сабагенты не
  использовались.
- Два bounded explorers и отдельный Terra reviewer выполнили read-only
  packages. Единственный reviewer finding о coverage был исправлен и закрыт
  повторной проверкой.
- Canonical verify и scope-check завершились успешно; plan подготовлен к
  guarded release и отдельному локальному commit без push.

## Итог

Planning delegation теперь является явным harness contract: large plans
создают skeleton и bounded packages до approval, small записывают `not needed`,
root/Sol синтезирует решения, Luna/high исследует узкие вопросы, Terra/high
проверяет цельный plan. Delegated writes остаются fail-closed и root-only до
отдельного worktree-orchestration plan. Активация новых instructions/config
должна быть подтверждена только новой trusted session после commit.
