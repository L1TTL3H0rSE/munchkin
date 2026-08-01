# PLAN: combat helper offer ui

- **Plan ID:** `20260731T001853Z-40d6e6-combat-helper-offer-ui`
- **Статус:** completed
- **Создан:** 2026-07-31 00:18:53 UTC
- **Обновлён:** 2026-08-01 07:53:36 +03:00
- **Владелец:** Codex session `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue5`
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
    "frontend/applications/web/app/composables/useGameApi.ts",
    "frontend/applications/web/app/components/interaction/**",
    "frontend/applications/web/app/components/game/**",
    "frontend/applications/web/test/fixtures/**",
    "frontend/applications/web/test/helperOfferSurface.test.ts",
    "frontend/applications/web/test/interactionSurface.test.ts",
    "frontend/applications/web/test/gameSessionController.test.ts",
    "frontend/applications/web/test/interactionApi.test.ts",
    "frontend/test/browser/helper-offer.spec.ts",
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

- [x] Offer action показывается только при наличии server descriptor;
  frontend не выводит legal helpers/max reward из public roster, encounter
  text or Treasure counters.
- [x] Combatant form содержит native labeled helper selection and integer
  reward constraints exactly from descriptor; submitted helper/reward must
  remain members of current options.
- [x] Invalid/empty/stale selection gives linked field feedback and never
  produces request; pending submit blocks duplicate intent.
- [x] Invited helper sees exact combatant, reward, absolute deadline and only
  server actions accept/decline. Other actors do not see exact pending/declined
  offer or infer private eligibility.
- [x] Combatant can cancel/supersede only when descriptors exist; UI never
  locally extends parent countdown or keeps superseded offer alive.
- [x] On accept, pending form is replaced by immutable accepted helper/reward
  summary from projection; controls cannot renegotiate.
- [x] Decline/expired/parent-closed/stale states show durable, party-appropriate
  copy and resync path without exposing raw backend errors.
- [x] Combat context shows accepted helper public contribution only when
  backend projection declares it public; no foreign hand/equipment inference.
- [x] Victory/defeat UI does not invent helper allocation, payout or card
  movement: the current web projection exposes accepted helper terms only, so
  the authoritative settlement receipt remains server-owned and is never
  inferred from public hands/deck counters.
- [x] Reconnect reconstructs current offer/accepted obligation from
  fresh GET. No local promise survives when server projection removed it.
- [x] Generic dialog/sheet focus, countdown, resize, live regions and reduced
  motion are reused rather than forked into a second modal/timer protocol.
- [x] Tests cover combatant, invited helper and uninvolved observer fixtures,
  reward min/max, stale supersede, accept/timeout race, reconnect and result.
- [x] Browser matrix proves keyboard/touch form, long names/copy, 200% zoom,
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
| `frontend/applications/web/app/composables/useGameApi.ts` | write | Preserve helper command ID and abort signal |
| `frontend/applications/web/app/components/interaction/**` | write | Helper offer party views |
| `frontend/applications/web/app/components/game/**` | write | Accepted helper/result in combat context |
| `frontend/applications/web/test/fixtures/**` | write | Combatant/helper/observer/accepted projections |
| `frontend/applications/web/test/helperOfferSurface.test.ts` | write | Party/form/result coverage |
| `frontend/applications/web/test/interactionSurface.test.ts` | write | Generic lifecycle regressions |
| `frontend/applications/web/test/gameSessionController.test.ts` | write | Helper error/resync/retry cases |
| `frontend/applications/web/test/interactionApi.test.ts` | write | Helper transport options |
| `frontend/test/browser/helper-offer.spec.ts` | write | Helper party/form browser coverage |
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

1. [x] Add three-actor privacy fixtures and helper view-model/form tests.
2. [x] Implement combatant offer/cancel/supersede form.
3. [x] Implement invited accept/decline and observer-safe rendering.
4. [x] Add accepted combat context without optimistic authority; terminal
   settlement remains backend-owned because the current web projection has no
   settlement receipt fields.
5. [x] Run unit/full frontend and helper viewport/accessibility/privacy matrix.
6. [x] Canonical verify/scope-check and archive.

## Проверки

- [x] `cd frontend && pnpm --filter @munchkin/web test` — 16 files, 99 tests
  passed.
- [x] `cd frontend && pnpm lint && pnpm check && pnpm build` — passed.
- [x] Cross-actor serialized fixture assertions for combatant/helper/observer
  projections — passed; observer receives no exact offer terms.
- [x] Browser helper offer/accept/decline/accepted/observer states at the
  configured Chromium, tablet and mobile projects — 9/9 passed. The targeted
  helper spec exercises native form constraints, party privacy, absolute
  deadline, accepted summary and no-action observer state.
- [x] Existing generic browser harness continues to cover interaction
  reconnect/expiry/focus/overflow behavior; this plan adds only the helper
  domain surface.
- [x] `node .codex/hooks/plan-lint.mjs` — `plans=49 active=13 archive=36
  issues=0`.
- [x] `./leinoctl verify --changed` — all canonical checks passed, including
  contracts, web, harness, leinoctl, shell syntax and Compose config.
- [x] `./leinoctl scope-check --plan 20260731T001853Z-40d6e6-combat-helper-offer-ui`
  — `ok=true`, `outsideWriteSet=[]`, `missingRequiredChecks=[]` in session
  `019fb8ab-5590-70f1-8fd0-d2fc2429d6fc-queue5`.
- [x] `git diff --check` — passed.

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

- **Статус:** approved
- **Запрошено:** 2026-07-31 00:18:53 UTC
- **Подтверждено:** 2026-08-01 07:08:52 +03:00
- **Формулировка/ограничения пользователя:** Пользователь явно одобрил
  batch approval queue в указанном порядке; этот plan выполняется после
  generic interaction window, проходит собственные verify/scope-check,
  archive и отдельный локальный commit. Push не выполнять.

## Ход выполнения

- Draft создан атомарно; backend helper settlement и generic interaction
  prerequisites completed and archived.
- 2026-08-01: plan принят из утверждённой batch queue после commit
  `133402f`; implementation scope ограничен helper/reward UI и его write set.
- Реализованы descriptor-only helper/reward options, native labeled form,
  exact action lookup, cancel routing и сохранение одного command ID при
  transient/offline retry через specialized combat-help endpoint.
- Добавлены party-safe combatant/invited/observer/accepted fixtures и
  projection-derived accepted helper summary без client-side payout/card
  inference. Generic interaction surface остаётся единственным владельцем
  dialog, focus, countdown, reconnect и error lifecycle.
- Browser helper matrix сообщает 9/9 passed на desktop, tablet и mobile;
  полный web suite сообщает 16 files / 99 tests passed. Playwright wrapper для
  этого узкого spec завершился чисто, без teardown timeout.
- Settlement receipt intentionally не добавлялся в web contract: backend
  сохраняет authoritative helper-first/zero-payout outcome, но текущий
  actor-specific `Projection` его полей не публикует; UI therefore остаётся
  fail-closed и не реконструирует payout из публичных счётчиков.

## Итог

Implementation, canonical checks, scope-check and archive завершены; plan
готов к release и отдельному локальному commit. Push не выполняется.
