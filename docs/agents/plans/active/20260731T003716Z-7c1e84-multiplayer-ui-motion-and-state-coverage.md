# PLAN: multiplayer ui motion and state coverage

- **Plan ID:** `20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`
- **Статус:** draft
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 00:37:16 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260731T003715Z-aaacfd-responsive-lobby-entry`, `20260731T003716Z-fc6391-death-loot-priority-ui`, `20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry`, `20260731T003716Z-f423ed-player-ui-browser-a11y-harness`.
- **Блокирует:** нет
- **Связанные ADR/handoff:** `docs/agents/GAME_UI_UX_SPEC.md`, `docs/agents/FRONTEND_ENGINEERING_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/assets/main.css",
    "frontend/applications/web/app/components/lobby/**",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/test/fixtures/**",
    "frontend/test/browser/**",
    "frontend/test/browser/visual-baselines/**",
    "docs/agents/plans/active/20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage.md",
    "docs/agents/plans/archive/20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "frontend:browser-a11y-harness-v1",
    "frontend:responsive-lobby-entry-v1",
    "frontend:death-loot-priority-v1",
    "game:multiplayer-balance-signals-v1"
  ],
  "dependsOn": [
    "20260731T003715Z-aaacfd-responsive-lobby-entry",
    "20260731T003716Z-fc6391-death-loot-priority-ui",
    "20260731T003716Z-968fc1-multiplayer-balance-and-privacy-telemetry",
    "20260731T003716Z-f423ed-player-ui-browser-a11y-harness"
  ],
  "sharedResources": [
    "frontend:player-ui-readiness-v1",
    "frontend:visual-baselines"
  ]
}
```

## Цель

Выполнить финальный player-facing UI readiness pass: tokenized tactical-street
visual direction, confirmed-delta motion with static/reduced equivalents and
complete automated state/viewport/privacy coverage across lobby and every
multiplayer mechanic.

## Критерии приёмки

- [ ] All 20+ representative fixtures decode strict contracts and contain no
  foreign private data/credentials/raw events.
- [ ] Complete dense fixture N-1/N/N+1 matrix and representative all-state
  viewport tier pass with `scrollWidth <= clientWidth`.
- [ ] Loading/empty/error/offline/retrying/stale/expired/mandatory/victory
  states are durable, accessible and never toast-only.
- [ ] Keyboard/focus/dialog/sheet/return, 200% zoom, forced colors, coarse
  pointer, short landscape and safe-area tests pass.
- [ ] Motion only explains confirmed projection deltas; optimistic pending
  never animates authoritative card/score/reward movement.
- [ ] Combat delta, turn/context, interaction update and card movement follow
  bounded tokenized durations/easing without accumulated queues.
- [ ] `prefers-reduced-motion` removes spatial/nonessential motion and retains
  static text/border/number cues for every result.
- [ ] Semantic color/spacing/radius/shadow/motion tokens replace repeated
  literals only inside touched owners; no unrelated Studio redesign.
- [ ] Axe serious/critical violations are zero or explicitly reviewed with
  repository-owned rationale; baselines are reviewed and platform-correct.
- [ ] Real browser-to-backend smoke covers create/join/core turn, combat/help,
  Run Away, economy and death continuation without fixture shortcuts.
- [ ] Frontend lint/typecheck/unit/build/browser/a11y/visual and canonical
  repository checks all pass; no manual-only readiness claim remains.

## Контекст и подтверждённое состояние

- All backend mechanics, domain UI, responsive lobby/table and browser harness
  are dependencies.
- UI spec already selects visual direction, motion map, token families and
  fixture/viewport protocol.
- Telemetry provides aggregate evidence only and is not UI authority.

## Scope

### Входит

- Final visual/motion token polish, full fixture expansion, automated
  browser/a11y/visual/real-boundary readiness evidence.

### Не входит

- New game mechanics/contracts, timing balance changes, Studio/admin/accounts,
  Terraform, new assets/fonts or external UI skill dependency.

## Архитектурный подход

1. Freeze contracts/fixtures before polish and change only presentation.
2. Animate confirmed delta with one interruptible owner and reduced fallback.
3. Apply semantic tokens component-locally; keep global sheet foundation-only.
4. Treat complete automated matrix as release gate, not screenshot decoration.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| player UI | Final tokens/motion/states | Existing projection only |
| browser harness | Complete matrix/baselines/E2E | Readiness evidence |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/assets/main.css` | write | Foundation token cleanup |
| `frontend/applications/web/app/components/lobby/**` | write | Final states/motion |
| `frontend/applications/web/app/components/game/**` | write | Final states/motion |
| `frontend/applications/web/app/components/interaction/**` | write | Final states/motion |
| `frontend/applications/web/test/fixtures/**` | write | Complete state matrix |
| `frontend/test/browser/**` | write | Readiness gates/E2E |
| `frontend/test/browser/visual-baselines/**` | generated | Reviewed final baselines |
| `docs/agents/plans/active/20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:player-ui-readiness-v1` | release/demo plans | этот plan | Final player UI gate |
| `frontend:visual-baselines` | all UI plans | этот plan finalizes | No parallel baseline updates |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:37:16 UTC
- **Обнаруженные пересечения:** intentionally overlaps every completed UI
  surface and baseline; no implementation may run in parallel.
- **Решение:** final exclusive fresh session after all dependencies.

## План реализации

1. [ ] Freeze complete actor fixtures and run baseline semantic/a11y matrix.
2. [ ] Apply tokenized visual direction and confirmed-delta motion.
3. [ ] Fix only evidence-backed layout/a11y/state findings.
4. [ ] Run complete browser/a11y/visual and real-boundary E2E gates.
5. [ ] Run canonical verify/scope-check, archive and publish readiness evidence.

## Проверки

- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `cd frontend && pnpm test:browser`
- [ ] `cd frontend && pnpm test:a11y`
- [ ] `cd frontend && pnpm test:visual`
- [ ] Full real-boundary player flow smoke
- [ ] Privacy scan and axe serious/critical gate
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** polish changes authority/state semantics. **Снижение:** contract
  freeze, projection-only view and semantic tests before visual diff.
- **Риск:** broad baseline acceptance hides regressions. **Снижение:** no
  auto-update; inspect semantic assertions and each changed image.
- **Откат:** revert presentation/baselines; contracts/data unchanged.

## Открытые вопросы

- Scope-changing вопросов нет; sound/haptics and external UI skill remain
  optional future layers.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Подготовить оставшиеся планы;
  implementation/select/commit/push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.

## Итог

Заполняется после реализации.
