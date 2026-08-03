# PLAN: agent delegation planning workflow

- **Plan ID:** `20260803T111613Z-1cf94f-agent-delegation-planning-workflow`
- **Статус:** awaiting_approval
- **Создан:** 2026-08-03 11:16:13 UTC
- **Обновлён:** 2026-08-03 14:42 MSK
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `codex/frontend-remaining-plans`
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260802T164112Z-dfb164-production-live-wif-registry-evidence`.
- **Блокирует:** применение обязательного planning fan-out в новых больших plans
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
хранит только своё task-specific решение и work packages. В этой итерации все
repository writes остаются у root.

## Критерии приёмки

- [ ] `AGENTS.md` и domain skills явно требуют planning agents для большой
      задачи, поэтому local Codex получает положительный delegation trigger, а
      не только разрешение вызвать агента.
- [ ] Большая задача определяется по risk/independent workstreams, а не по
      длине Markdown; маленький plan обязан записать `not needed` с причиной.
- [ ] Новый plan template содержит обязательный `Delegation strategy` с
      classification, предварительными work packages, role/model/effort,
      scope, output, stop condition, root parallel work и фактическим evidence.
- [ ] Workflow не содержит chicken-and-egg: initial context предшествует
      skeleton plan, агенты запускаются после предварительной delegation map,
      затем тот же draft уточняется до запроса approval.
- [ ] Default routing использует root/Sol для synthesis и решений,
      Luna explorer для узкого bounded research и Terra reviewer для широкого
      cross-plan/cross-component review; escalation зависит от ambiguity/risk,
      а не от фиксированной доли токенов.
- [ ] Agent profiles, project config и SessionStart reminder согласованы с
      documented routing и ограничением `max_depth = 1`.
- [ ] PreToolUse продолжает принимать только bounded read-only delegation с
      `DELEGATION_META`; write delegation остаётся заблокированным и явно
      вынесено за scope.
- [ ] Harness tests проверяют model/profile/config/template/reminder contract;
      canonical repository-workflow checks, plan-lint, preflight, text-check и
      diff review выполнены и записаны.
- [ ] После изменения hooks/config/instructions подготовлен handoff checkpoint:
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
  profiles. Для planning-only workflow менять этот generic validator не нужно.
- Текущий Codex workflow запускает agents после прямого запроса либо явного
  требования applicable `AGENTS.md`/skill; поэтому durable positive trigger
  должен жить в repository instructions и skills.
- Актуальный GPT-5.6 routing допускает дешёвый Luna fan-out, но published
  long-context results заметно слабее Terra; поэтому task context обязан быть
  bounded, а full-plan reviewer маршрутизируется на Terra.
- `./leinoctl preflight` 2026-08-03 fail-closed: completed plan
  `20260803T083541Z-26e9ab-frontend-compact-figma-handoff` остаётся в active;
  это внешний lifecycle blocker и не исправляется этим plan.
- User-owned untracked draft
  `20260803T105519Z-a1d39d-figma-frontend-parity-component-remediation.md`
  сохраняется без изменений.

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

### Не входит

- Любые write-сабагенты, worker profile или снятие
  `delegation-write-binding-unsupported`.
- Параллельные writers, отдельные worktree, tool-level cwd binding, delegated
  leases, child session ownership, agent commits или merge orchestration.
- Изменение plan manifest schema, leinoctl parser/session/ledger или generic
  lifecycle semantics.
- Автоматический выбор модели по реальному billing/benchmark API, hardcoded
  token prices или budget enforcement.
- Изменение product/backend/frontend/content code и активных чужих plans.

## Архитектурный подход

- **Permanent policy в harness:** критерии large/small, безопасные роли,
  model defaults, escalation и запрет write delegation.
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
  scope, архитектурные решения, approval request и все repository writes.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository workflow | mandatory planning fan-out и plan-specific map | новый internal `codex:planning-delegation-v1` |
| project agents | Luna explorer / Terra reviewer routing | local Codex config, без product API |
| plan authoring | delegation decision/packages/evidence section | template/runbook only; manifest v1 сохраняется |
| hooks | SessionStart reminder и static checks | PreTool delegation validator не меняется |

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
| `repository:harness-policy` | production live WIF plan | exclusive | дождаться archive/release dependency, затем новая trusted session |
| `repository:plan-authoring-contract` | все будущие plans | этот plan | применяется только после completion/new session |
| `codex:project-agent-routing` | active Codex sessions | этот plan | current session не доказывает reload |

### Проверка конфликтов

- **Проверены active plans:** `./leinoctl context --paths ...`, manifests,
  write sets, owner/session state и `./leinoctl preflight`, 2026-08-03.
- **Обнаруженные пересечения:** in-progress exclusive plan
  `20260802T164112Z-dfb164-production-live-wif-registry-evidence` также владеет
  `docs/agents/HARNESS.md`; completed plan
  `20260803T083541Z-26e9ab-frontend-compact-figma-handoff` неправильно остаётся
  в active и ломает registry health. User draft `20260803T105519Z-a1d39d-...`
  не пересекается с source write set этого plan, но остаётся dirty baseline.
- **Решение:** exact dependency на production-live plan; не select/implement,
  пока dependency не completed/archive/released и registry issue не устранён
  его владельцем. После этого повторить context/preflight и сохранить dirty
  user draft как baseline.

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
- **Write delegation:** prohibited; `write_set: []` для всех subagents.
- **Authority:** root принимает решения, вносит все изменения и закрывает plan.

## План реализации

1. [ ] Добавить `docs/agents/DELEGATION.md` с large/small criteria,
       skeleton-plan-first sequence, model routing, escalation и готовым
       bounded `DELEGATION_META` примером.
2. [ ] Обновить `AGENTS.md`, README/HARNESS и четыре domain skills так, чтобы
       large planning fan-out был явным требованием, а small path требовал
       записанной причины.
3. [ ] Добавить `Delegation strategy` в template и уточнить plan lifecycle:
       preliminary packages фиксируются до spawn, actual evidence — до approval.
4. [ ] Настроить agent profiles/config: Luna для bounded explorer, Terra для
       broad reviewer, depth `1`, bounded concurrency; не добавлять worker.
5. [ ] Обновить SessionStart reminder и static configuration tests.
6. [ ] Просмотреть diff, выполнить focused hooks tests, полный leinoctl suite,
       plan-lint, canonical `verify --changed`, text-check и scope-check.
7. [ ] Записать bootstrap limitation, завершить/archive/release plan и создать
       отдельный local commit; новую policy подтвердить новой trusted session.

## Проверки

- [ ] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs`
- [ ] `(cd tools/leinoctl && node --test)`
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl preflight`
- [ ] `./leinoctl text-check --changed`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260803T111613Z-1cf94f-agent-delegation-planning-workflow`
- [ ] `git diff --check` и scoped diff review
- [ ] Новая trusted session сообщает `Munchkin harness is active` и новый
      planning-delegation reminder; это post-commit handoff evidence.

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
- **Откат:** вернуть этот отдельный commit; product/schema/data не меняются.

## Открытые вопросы

- Нет. Принятое ограничение первой итерации: только read-only planning agents;
  write delegation будет отдельным plan после отдельного решения пользователя.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-08-03 после read-only impact/conflict анализа
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** отредактировать harness под новый
  workflow; пока не проектировать параллельных writers, отдельные worktree,
  tool-level binding, leases и controlled integration. Task-specific agents
  заранее описывать в plan, permanent trigger/routing хранить в harness.

## Ход выполнения

- Draft `20260803T111613Z-1cf94f-agent-delegation-planning-workflow` создан
  атомарно; product/harness implementation не начата.
- Read-only context подтвердил repository-workflow impact, direct dependency и
  существующий registry blocker; чужие active plans не изменялись.

## Итог

Заполняется после реализации.
