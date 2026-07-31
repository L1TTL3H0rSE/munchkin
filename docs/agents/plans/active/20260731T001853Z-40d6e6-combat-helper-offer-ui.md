# PLAN: combat helper offer ui

- **Plan ID:** `20260731T001853Z-40d6e6-combat-helper-offer-ui`
- **Статус:** draft
- **Создан:** 2026-07-31 00:18:53 UTC
- **Обновлён:** 2026-07-31 00:18:53 UTC
- **Владелец:** —
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** plans `20260731T001853Z-015911-combat-helper-reward-settlement`, `20260731T001853Z-f90fcb-generic-interaction-window-ui`.
- **Блокирует:** нет
- **Связанные ADR/handoff:** ADR-0008, `docs/agents/GAME_INTERACTION_PROTOCOL.md`, `docs/agents/GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "frontend/applications/web/app/composables/useGameSessionController.ts",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/test/helperOfferSurface.test.ts",
    "frontend/applications/web/test/interactionSurface.test.ts",
    "frontend/applications/web/test/gameSessionController.test.ts",
    "docs/agents/plans/active/20260731T001853Z-40d6e6-combat-helper-offer-ui.md",
    "docs/agents/plans/archive/20260731T001853Z-40d6e6-combat-helper-offer-ui.md"
  ],
  "components": [
    "frontend-workspace"
  ],
  "contracts": [
    "game:combat-helper-reward-v1",
    "game:http-v1",
    "pnpm:@munchkin/contracts"
  ],
  "dependsOn": [
    "20260731T001853Z-015911-combat-helper-reward-settlement",
    "20260731T001853Z-f90fcb-generic-interaction-window-ui"
  ],
  "sharedResources": [
    "frontend:combat-helper-offer-v1"
  ]
}
```

## Цель

Расширить generic interaction surface доменным helper/reward UX: combatant
выбирает одного server-projected helper и integer reward, invited player
accept/decline-ит exact offer, а accepted relationship и later settlement
отображаются только из authoritative projection с корректной privacy,
deadline, focus and recovery semantics.

## Критерии приёмки

- [ ] Offer action показывается только при наличии server descriptor;
  frontend не выводит legal helpers/max reward из public roster, encounter
  text or Treasure counters.
- [ ] Combatant form содержит native labeled helper selection and integer
  reward constraints exactly from descriptor; submitted helper/reward must
  remain members of current options.
- [ ] Invalid/empty/stale selection gives linked field feedback and never
  produces request; pending submit blocks duplicate intent.
- [ ] Invited helper sees exact combatant, reward, absolute deadline and only
  server actions accept/decline. Other actors do not see exact pending/declined
  offer or infer private eligibility.
- [ ] Combatant can cancel/supersede only when descriptors exist; UI never
  locally extends parent countdown or keeps superseded offer alive.
- [ ] On accept, pending form is replaced by immutable accepted helper/reward
  summary from projection; controls cannot renegotiate.
- [ ] Decline/expired/parent-closed/stale states show durable, party-appropriate
  copy and resync path without exposing raw backend errors.
- [ ] Combat context shows accepted helper public contribution only when
  backend projection declares it public; no foreign hand/equipment inference.
- [ ] Victory result distinguishes authoritative helper allocation and
  combatant remainder from projection; defeat shows zero payout without
  optimistic card movement.
- [ ] Reconnect reconstructs current offer/accepted obligation/settlement from
  fresh GET. No local promise survives when server projection removed it.
- [ ] Generic dialog/sheet focus, countdown, resize, live regions and reduced
  motion are reused rather than forked into a second modal/timer protocol.
- [ ] Tests cover combatant, invited helper and uninvolved observer fixtures,
  reward min/max, stale supersede, accept/timeout race, reconnect and result.
- [ ] Browser matrix proves keyboard/touch form, long names/copy, 200% zoom,
  compact keyboard viewport and no root overflow.

## Контекст и подтверждённое состояние

- Backend helper plan defines one pending offer, party-specific terms,
  clamped deadline, immutable accepted obligation and exact settlement.
- Generic interaction UI plan owns inbox/dialog/sheet/countdown/error/focus
  lifecycle; this plan only supplies helper-specific presentation and form.
- Responsive table plan owns combat context/action dock regions.
- No current Vue helper form exists; generic current intents alone cannot
  represent helper/reward selection.
- Terraform active plan has no frontend overlap.

## Scope

### Входит

- Combatant offer/cancel/supersede form from server descriptors.
- Invited helper accept/decline view.
- Accepted helper/reward and terminal settlement presentation.
- Party-specific privacy fixtures, field validation and responsive/a11y tests.
- Minimal controller submit extension if completed backend adapter requires it.

### Не входит

- Backend/Zod/HTTP changes, reward calculation, target eligibility or
  settlement allocation.
- Forced help, multiple helpers, negotiation chat, percentages, arbitrary
  clauses or card choice.
- Generic modal/countdown rewrite, table redesign, new dependency.
- Run Away, trade, charity, theft, death loot or content changes.
- Terraform, Compose, CI/browser tool installation.

## Архитектурный подход

1. Map completed typed help descriptors to party-specific view models; no
   handwritten DTO or roster inference.
2. Reuse generic interaction identity/revision and session controller submit.
3. Keep form local/controlled and clear it whenever offer identity/options
   change.
4. Render accepted/settled results from projection only; optimistic state may
   show pending request, never reward/card movement.
5. Verify serialized observer fixtures contain neither exact reward nor
   invited helper until backend marks accepted relationship public.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| helper offer components | Offer/accept/decline/result views | Completed party-specific descriptors |
| generic interaction surface | Helper presentation extension | Same modal/countdown/focus lifecycle |
| combat context | Accepted helper/settlement summary | Projection-owned public result only |
| session controller | Typed helper submit if needed | Existing adapter and CAS semantics |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `frontend/applications/web/app/composables/useGameSessionController.ts` | write | Typed helper submit/pending state |
| `frontend/applications/web/app/components/interaction/**` | write | Helper offer party views |
| `frontend/applications/web/app/components/game/**` | write | Accepted helper/result in combat context |
| `frontend/applications/web/test/helperOfferSurface.test.ts` | write | Party/form/result coverage |
| `frontend/applications/web/test/interactionSurface.test.ts` | write | Generic lifecycle regressions |
| `frontend/applications/web/test/gameSessionController.test.ts` | write | Helper error/resync/retry cases |
| `docs/agents/plans/active/20260731T001853Z-40d6e6-combat-helper-offer-ui.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260731T001853Z-40d6e6-combat-helper-offer-ui.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:combat-helper-offer-v1` | future balance/domain UI | этот plan | Final consumer of v1 helper contract |
| `frontend:generic-interaction-surface-v1` | generic UI plan | dependency | Extend, do not fork |
| `game:combat-helper-reward-v1` | backend plan | dependency | Consume completed fixtures only |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-31 00:18:53 UTC
- **Обнаруженные пересечения:** full frontend feature overlap with generic UI
  and contract dependency on backend helper; no Terraform overlap.
- **Решение:** execute only after both dependencies completed/archived/pushed
  in fresh trusted sessions.

## План реализации

1. [ ] Add three-actor privacy fixtures and helper view-model/form tests.
2. [ ] Implement combatant offer/cancel/supersede form.
3. [ ] Implement invited accept/decline and observer-safe rendering.
4. [ ] Add accepted/settled combat context without optimistic authority.
5. [ ] Run unit/full frontend and manual viewport/accessibility/privacy matrix.
6. [ ] Canonical verify/scope-check and archive.

## Проверки

- [ ] `cd frontend && pnpm --filter @munchkin/web test`
- [ ] `cd frontend && pnpm lint && pnpm check && pnpm build`
- [ ] Cross-actor serialized fixture assertions for combatant/helper/observer
- [ ] Browser offer/accept/decline/supersede/expired/reconnect/victory/defeat at
  `320×568`, `374×812`, `599×960`, `667×375`, `768×1024`, `1280×720`,
  `1440×900`
- [ ] Browser keyboard form, error focus, sheet trap/return, coarse touch,
  reduced motion, 200% zoom, long Russian names and overflow assertion
- [ ] `node .codex/hooks/plan-lint.mjs`
- [ ] `./leinoctl verify --changed`
- [ ] `./leinoctl scope-check --plan 20260731T001853Z-40d6e6-combat-helper-offer-ui`
- [ ] `git diff --check`

## Риски и откат

- **Риск:** UI leaks invited helper/reward to observer. **Снижение:** distinct
  actor fixtures and no fallback derivation from public roster.
- **Риск:** local form survives supersede and submits stale terms.
  **Снижение:** key/reset on offer ID + projection version and descriptor
  membership check.
- **Риск:** result implies reward before server settlement. **Снижение:** only
  pending request locally; cards/reward rendered from authoritative result.
- **Откат:** ordinary frontend revert; backend still enforces/settles helper
  state and generic client can safely show coarse interaction fallback.

## Открытые вопросы

- Scope-changing вопросов нет. V1 displays integer Treasure count and exact
  fixed helper only; richer negotiation requires new backend contract/plan.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-31 00:18:53 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** Пользователь попросил подготовить
  backend/frontend plans параллельно фоновой Terraform-работе; implementation,
  selection, commit и push не разрешены.

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Frontend skill and accepted helper/privacy decisions applied; no
  implementation or contract mutation started.

## Итог

Заполняется после реализации.
