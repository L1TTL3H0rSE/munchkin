# PLAN: multiplayer ui motion and state coverage

- **Plan ID:** `20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`
- **Статус:** in_progress
- **Создан:** 2026-07-31 00:37:16 UTC
- **Обновлён:** 2026-07-31 00:37:16 UTC
- **Владелец:** Codex session `019fb760-1241-7b61-b9ce-217108b8b38e`
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
    "frontend/applications/web/app/pages/game/[id].vue",
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/components/GameCard.vue",
    "frontend/applications/web/app/components/ActionPanel.vue",
    "frontend/applications/web/app/components/actionModel.ts",
    "frontend/applications/web/app/components/lobby/**",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/test/fixtures/**",
    "frontend/applications/web/test/actionModel.test.ts",
    "frontend/applications/web/test/gameCardInteraction.test.ts",
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
    "frontend:card-first-action-surface-v1",
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

Выполнить финальный player-facing UI readiness pass: перевести игровой
интерфейс на card-first interaction model, завершить tokenized tactical-street
visual direction, confirmed-delta motion со static/reduced equivalents и
полное automated state/viewport/privacy coverage across lobby and every
multiplayer mechanic. Карта должна быть понятной точкой входа в действие, а не
декоративным элементом, который требует поиска отдельной верхней кнопки.

## Критерии приёмки

- [ ] All 20+ representative fixtures decode strict contracts and contain no
  foreign private data/credentials/raw events.
- [ ] Every actor-owned card is mapped to server-projected legal actions by
  `source_instance_id`/`instance_ids`; an eligible simple `play_card` or
  `equip_item` card action is activatable from the card itself without finding
  a detached global action button.
- [ ] A card with multiple legal actions or required choices opens a contextual
  action surface adjacent to the selected card or in the mobile bottom sheet;
  target, cost and choice controls remain server-described and version-bound.
- [ ] Card interaction uses semantic keyboard/touch controls with visible
  `idle`, `available`, `selected`, `pending`, `confirmed` and `disabled`
  states. Drag or double-click is never the only way to perform an action.
- [ ] The action dock is persistent and discoverable near the hand on desktop
  and as a bottom sheet/dock on mobile; the top action region is reserved for
  global turn actions and status, not the only path to play a card.
- [ ] Valid action types are not silently removed at the client boundary;
  unsupported or unknown actions produce a recoverable protocol/resync state.
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

- Card-first action mapping and interaction surfaces for the own hand,
  equipped/carried card areas and supported action states.
- Persistent desktop/mobile action dock or contextual sheet, including
  selection, parameter, target, pending and confirmed states.
- Final visual/motion token polish, full fixture expansion, automated
  browser/a11y/visual/real-boundary readiness evidence.

### Не входит

- New game mechanics/contracts, timing balance changes, Studio/admin/accounts,
  Terraform, new assets/fonts or external UI skill dependency.

## Архитектурный подход

1. Freeze existing projection/action contracts and build a pure mapping from
   server descriptors to card-owned action affordances; do not derive legal
   actions locally.
2. Make an unambiguous simple card action executable from the card itself and
   route multi-action/parameterized cases through one contextual surface.
3. Keep pending/confirmed ownership in the session controller; card motion is
   triggered only by a newer server projection.
4. Animate confirmed delta with one interruptible owner and reduced fallback.
5. Apply semantic tokens component-locally; keep global sheet foundation-only.
6. Treat complete automated matrix as release gate, not screenshot decoration.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| player UI | Card-first actions, contextual surfaces, final tokens/motion/states | Existing projection/action descriptors only |
| browser harness | Complete matrix/baselines/E2E | Readiness evidence |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/assets/main.css` | write | Foundation token cleanup |
| `frontend/applications/web/app/pages/game/[id].vue` | write | Card/action surface composition |
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Preserve all valid action descriptors and recoverable protocol handling |
| `frontend/applications/web/app/components/GameCard.vue` | write | Semantic card interaction and states |
| `frontend/applications/web/app/components/ActionPanel.vue` | write | Contextual action dock/sheet |
| `frontend/applications/web/app/components/actionModel.ts` | write | Card-to-action mapping and payload view model |
| `frontend/applications/web/app/components/lobby/**` | write | Final states/motion |
| `frontend/applications/web/app/components/game/**` | write | Final states/motion |
| `frontend/applications/web/app/components/interaction/**` | write | Final states/motion |
| `frontend/applications/web/test/fixtures/**` | write | Complete state matrix |
| `frontend/applications/web/test/actionModel.test.ts` | write | Card/action mapping and authority-preserving payload tests |
| `frontend/applications/web/test/gameCardInteraction.test.ts` | write | Semantic card interaction state tests |
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

1. [ ] Freeze complete actor fixtures and run baseline semantic/a11y matrix,
   including the current card-to-action discoverability failure.
2. [x] Implement server-descriptor-to-card mapping and semantic card states;
   keep `expected_version`, idempotency and actor authority unchanged.
3. [x] Implement direct simple card actions plus contextual action
   dock/sheet for multi-action and parameterized cards.
4. [x] Remove silent valid-action filtering and add negative/recoverable
   protocol coverage for unsupported action descriptors.
5. [x] Apply tokenized visual direction, responsive hand/action layout and
   confirmed-delta motion with static/reduced equivalents.
6. [ ] Fix only evidence-backed layout/a11y/state findings.
7. [ ] Run complete browser/a11y/visual and real-boundary E2E gates.
8. [ ] Run canonical verify/scope-check, archive and publish readiness evidence.

## Проверки

- [x] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] `cd frontend && pnpm test:browser`
- [ ] `cd frontend && pnpm test:a11y`
- [ ] `cd frontend && pnpm test:visual`
- [ ] Full real-boundary player flow smoke
- [x] Card mapping/payload unit coverage proves eligible simple card actions
   without scrolling to a detached action list
- [x] Multi-action mapping and target/choice submission unit coverage
   preserves server-projected IDs and current expected version
- [x] All valid action descriptors survive the client parse boundary or fail
   closed with a recoverable resync state; no silent action drop
- [ ] Browser click/tap/Enter/Space execution and viewport/a11y evidence
- [ ] Privacy scan and axe serious/critical gate
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed` (frontend/build checks pass; root
  `bash -n scripts/dev.sh` is blocked by the local WSL wrapper; the
  alternate Git Bash/Pnpm subprocess path fails before source checks with
  `EPERM lstat C:\Users\Maks`)
- [ ] `./leinoctl scope-check --plan 20260731T003716Z-7c1e84-multiplayer-ui-motion-and-state-coverage`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** polish changes authority/state semantics. **Снижение:** contract
  freeze, projection-only view and semantic tests before visual diff.
- **Риск:** broad baseline acceptance hides regressions. **Снижение:** no
  auto-update; inspect semantic assertions and each changed image.
- **Откат:** revert presentation/baselines; contracts/data unchanged.

## Открытые вопросы

- Sound/haptics and external UI skill remain optional future layers.
- Exact card sheet visual placement is an implementation detail: desktop may
  use an adjacent dock and mobile uses a bottom sheet, but both must satisfy
  the same card-first action contract and keyboard/touch gates.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:37:16 UTC
- **Подтверждено:** пользователь подтвердил обновлённый card-first scope и
  разрешил реализацию без commit/push в текущем сообщении сессии.
- **Формулировка/ограничения пользователя:** сначала показать обновлённый
  scope; implementation разрешена после подтверждения, commit и push требуют
  отдельного приказа.

## Ход выполнения

- Plan расширен card-first contract и конкретными frontend write targets;
  реализация разрешена; commit явно разрешён текущим пользовательским запросом,
  push не выполняется.
- 2026-07-31: current session took over the stale previous owner and selected
  this plan after a clean baseline.
- 2026-07-31: implemented pure `source_instance_id`/`instance_ids` mapping,
  direct card action buttons, contextual persistent dock, stable original
  descriptor indexes, target-player payload preservation, explicit card
  idle/available/selected/pending/confirmed/disabled states, confirmed-only
  motion and reduced-motion/static cues.
- 2026-07-31: `@munchkin/web` lint, typecheck, 74 tests and production build
  pass under the available local runtime; repository verify reached all
  frontend checks and failed only at the environment-owned root bash wrapper.
- Browser/a11y/visual harness remains unavailable in this checkout because
  the dependent harness plan is still draft and `frontend/test/browser` plus
  the related scripts do not exist; no automated browser readiness claim is
  made.
- 2026-07-31: bundled Node 24 hooks harness passes `42/42`; separate Git Bash
  syntax and Compose config checks pass.
- 2026-07-31: `tools/leinoctl` tests with bundled Node 24 report `66 pass,
  2 fail, 1 skip`; both failures are existing entrypoint assertions about
  `--parallel` count, outside this plan write set.
- 2026-07-31: `scope-check` remains blocked by preserved untracked
  `.repomixignore` and `repomix-output.md` outside the write set; neither was
  changed or removed.

## Итог

Card-first implementation готова к локальному коммиту. Plan остаётся active до
появления зависимого browser/a11y/visual harness и прохождения полного
repository scope/verify lifecycle; текущий коммит не является доказательством
полной browser readiness.
