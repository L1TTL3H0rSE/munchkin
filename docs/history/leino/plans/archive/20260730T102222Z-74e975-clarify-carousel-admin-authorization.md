# PLAN: clarify carousel admin authorization

- **Plan ID:** `20260730T102222Z-74e975-clarify-carousel-admin-authorization`
- **Статус:** completed
- **Создан:** 2026-07-30 10:22:22 UTC
- **Обновлён:** 2026-07-30 10:33:57 UTC
- **Владелец:** Codex
- **Workspace:** shared / `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260730T001013Z-717040-design-responsive-game-ui-ux`, `20260729T225611Z-bbcbc3-record-future-admin-control-plane`.
- **Блокирует:** будущие implementation plans для responsive hand/opponent
  carousel и production admin authentication/authorization.
- **Связанные ADR/handoff:** ADR-0006,
  `docs/agents/GAME_UI_UX_SPEC.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/GAME_UI_UX_SPEC.md",
    "docs/agents/decisions/0006-administration-control-plane.md",
    "docs/agents/plans/active/20260730T102222Z-74e975-clarify-carousel-admin-authorization.md",
    "docs/agents/plans/archive/20260730T102222Z-74e975-clarify-carousel-admin-authorization.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [],
  "dependsOn": [
    "20260730T001013Z-717040-design-responsive-game-ui-ux",
    "20260729T225611Z-bbcbc3-record-future-admin-control-plane"
  ],
  "sharedResources": [
    "frontend:game-ui-ux-design-v1",
    "admin-control-plane:architecture-v1"
  ]
}
```

## Цель

Сохранить два последующих пользовательских уточнения в их канонических
design-документах:

1. UI/UX-спека не запрещает карусели как класс. Для руки разрешён и выбран
   bounded card carousel/rail; запрещены только autoplay, dot-only discovery,
   случайный overflow и скрытие критичного/единственного legal action без
   доступной альтернативы.
2. Admin authentication и RBAC не являются альтернативами. Первый owner-only
   slice может переносить coarse `owner/admin` role в проверенном OIDC/JWT либо
   server session, но backend выполняет deny-by-default capability checks для
   каждого query/command. Fine-grained permissions/scopes и mutable role
   assignments не становятся JWT authority.

## Критерии приёмки

- [x] `GAME_UI_UX_SPEC.md` явно говорит, что bounded card carousel/rail
  разрешён и является выбранным compact-hand pattern, а слово «carousel» не
  означает blanket ban.
- [x] Спека перечисляет разрешённые carousel affordances: touch/native scroll,
  keyboard/focus reveal, visible continuation cue, previous/next controls,
  item count/position и «Показать всю руку» grid/sheet.
- [x] Спека отдельно перечисляет запрещённые carousel variants: autoplay,
  dot-only navigation, focus clipping, accidental document overflow и
  сокрытие единственного mandatory/legal action.
- [x] Для opponents carousel остаётся допустимым bounded fallback только с
  доступным ordered overview; current actor/turn context не скрывается внутри
  неактивного slide.
- [x] ADR-0006 формально разделяет AuthN, transport claims и AuthZ: подпись,
  issuer, audience, expiry/session проверяются до использования `sub` и coarse
  role, но наличие claim само по себе не разрешает domain operation.
- [x] Для первого slice зафиксирован один `owner/admin` role, который
  server-side отображается на минимальный capability catalog; каждый admin
  query/command проверяет capability и fail-closed.
- [x] Capability baseline разделяет read и mutation как минимум для games,
  history, content draft/publish, assets, operations и audit; frontend может
  читать effective capabilities для presentation, но не является PEP.
- [x] Fine-grained permissions, resource scopes и mutable assignments не
  копируются в long-lived JWT. Их future server-side storage/evaluator,
  persisted scopes и expanded roles проектируются только при реальной
  многопользовательской admin-потребности; bounded owner disable/revocation
  freshness обязательна уже в первом slice.
- [x] Не выбираются преждевременно конкретный IdP/OIDC flow, cookie/session
  implementation или Digiversity-sized external PDP. Game bearer и Card
  Studio authoring token по-прежнему не дают admin rights.
- [x] Production code, API, migrations, frontend/CSS, dependencies, config и
  deployment в этом docs-only clarification plan не меняются.

## Контекст и подтверждённое состояние

- `GAME_UI_UX_SPEC.md` уже разрешает bounded rail и выбирает для compact hand
  rail + full-hand sheet, но формулировки про unlabeled carousel dots и
  opponent grid можно ошибочно прочитать как отказ от каруселей вообще.
- Здесь `rail` является разновидностью non-autoplay carousel: несколько
  карточек могут быть видны одновременно, пользователь управляет scroll, а
  focus и «Показать всё» обеспечивают полный доступ.
- Текущая UI/UX-спека запрещает только document-level overflow; осмысленный
  внутренний card rail уже разрешён при keyboard/touch/a11y contract.
- ADR-0006 уже выбирает первый `owner/admin` role и deny-by-default, отделяет
  admin identity от игровых/Studio credentials и откладывает полную RBAC
  matrix, IdP и session mechanism.
- ADR пока не формулирует явно, что role claim является только coarse
  authenticated input, а authorization всё равно выражается server-side
  capabilities.
- В актуальном Digiversity роли присутствуют в OIDC access token для
  frontend/coarse routing, но privileged backend actions не получают fallback
  `ALLOW` по JWT roles/groups: domain PEP использует capability/resource
  decision. Munchkin не нуждается в таком масштабе PDP для owner-only MVP.
- `leinoctl context` для обоих target docs вернул только
  `repository-workflow`; active plans и пересечения отсутствуют.

## Scope

### Входит

- Терминологическое уточнение carousel/rail и выбранного hand pattern.
- Allowed/prohibited carousel rules для hand и opponents.
- Уточнение ADR-0006 про coarse JWT/session role, server-side capability
  mapping, deny-by-default enforcement и future RBAC growth.
- Минимальный semantic capability catalog для первого admin slice.
- Lifecycle, read-only review и canonical docs checks.

### Не входит

- Реализация carousel, Vue/CSS, browser fixtures либо visual tests.
- Admin runtime, route, API, middleware, OIDC provider, JWT issuer, session,
  database, migrations или RBAC editor.
- Копирование Digiversity `gopermissions`, Keycloak mapper либо frontend auth
  code.
- Изменение game/Studio credentials или их authority.
- Commit, push, deploy и публикация без отдельного явного разрешения.

## Архитектурный подход

1. Уточнить vocabulary: `bounded card carousel/rail` — разрешённый
   user-controlled pattern; classic autoplay/dot-only carousel — запрещённый
   variant для decision-critical game UI.
2. Не менять уже принятое решение hand rail + full-hand sheet; сделать явным,
   что это и есть accessible carousel implementation family.
3. Разделить admin flow на:
   `validated identity/session → coarse role → server capability check →
   typed/redacted query or audited command`.
4. Сохранить минимальный owner-only MVP: capability map может быть
   in-process/configured вместе с backend contract, но проверки не
   размазываются как UI-only либо route-name guesses.
5. Fine-grained/scoped authorization оставить будущему server-side RBAC/PDP
   slice. JWT не хранит быстро меняющуюся policy truth; owner-only MVP уже
   требует fail-closed bounded freshness для subject/policy revocation.
6. Не фиксировать случайный IdP/session design до auth threat review.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository-workflow | Clarification двух normative design docs | Runtime/wire unchanged |
| frontend-workspace (design only) | Carousel/rail vocabulary и UX contract | No Vue/CSS/DTO change |
| future admin control plane (design only) | AuthN/claims/capabilities/RBAC boundary | No auth/API/schema implementation |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/GAME_UI_UX_SPEC.md` | write | Уточнить, что accessible bounded carousel разрешён |
| `docs/agents/decisions/0006-administration-control-plane.md` | write | Зафиксировать JWT/RBAC/capability boundary |
| `docs/agents/plans/active/20260730T102222Z-74e975-clarify-carousel-admin-authorization.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260730T102222Z-74e975-clarify-carousel-admin-authorization.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `frontend:game-ui-ux-design-v1` | archived responsive UI/UX plan | этот plan | Узкое clarification без runtime scope |
| `admin-control-plane:architecture-v1` | archived admin control-plane plan | этот plan | Amend accepted ADR без выбора implementation |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 10:23:04 UTC через
  `leinoctl context --paths docs/agents/GAME_UI_UX_SPEC.md,docs/agents/decisions/0006-administration-control-plane.md`
  и `plan-lint`.
- **Обнаруженные пересечения:** active plans отсутствуют; оба target document
  принадлежат завершённым design decisions.
- **Решение:** один exclusive docs-only plan атомарно уточняет оба ответа;
  runtime consumers остаются future plans.

## План реализации

1. [x] Записать в UI/UX spec явное определение bounded card carousel/rail.
2. [x] Уточнить hand и opponent carousel allowed/prohibited behavior без
   ослабления overflow/a11y требований.
3. [x] Дополнить ADR-0006 AuthN → claims/session → role → capability
   server-enforcement boundary.
4. [x] Добавить минимальный capability catalog и правила future RBAC growth.
5. [x] Выполнить independent read-only review терминологии, security boundary
   и scope.
6. [x] Прогнать text/plan/canonical/scope checks, просмотреть exact diff и
   архивировать plan.

## Проверки

- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed` на repository Node 24 toolchain.
- [x] `./leinoctl scope-check --plan 20260730T102222Z-74e975-clarify-carousel-admin-authorization`.
- [x] `git diff --check`.
- [x] Read-only review подтверждает отсутствие blanket carousel ban,
  JWT-as-AuthZ и расширения runtime scope.
- [x] Runtime/frontend tests не требуются: production code не меняется.

## Риски и откат

- **Риск:** слово «carousel» снова будет понято как autoplay widget либо,
  наоборот, как полный запрет.
  **Снижение:** дать явные allowed/prohibited списки и назвать rail
  разновидностью user-controlled carousel.
- **Риск:** coarse JWT role ошибочно станет единственной backend
  authorization check.
  **Снижение:** нормативный per-query/per-command capability check,
  deny-by-default и UI-not-PEP.
- **Риск:** удалённый owner сохранит access до истечения ещё валидной session.
  **Снижение:** fail-closed bounded identity/policy freshness обязательна уже
  в первом slice; short TTL не считается достаточным отзывом.
- **Риск:** owner-only MVP преждевременно разрастётся до Digiversity-sized
  multi-service PDP.
  **Снижение:** один role и локальная server-side mapping сейчас; persisted
  assignments/scopes/PDP только при подтверждённом use case.
- **Риск:** capability names воспримут как уже реализованный wire contract.
  **Снижение:** обозначить их как semantic policy catalog будущего admin API и
  сохранить runtime status как FUTURE.
- **Откат:** обычным revert удалить clarification blocks; runtime остаётся
  неизменным.

## Открытые вопросы

- Блокирующих вопросов нет: пользователь уже попросил сохранить оба
  сформулированных ответа. Конкретный IdP/session и expanded roles намеренно
  остаются implementation decisions.

## Согласование

- **Статус:** approved and in progress
- **Запрошено:** 2026-07-30 10:22:22 UTC
- **Подтверждено:** 2026-07-30 10:29:46 UTC
- **Формулировка/ограничения пользователя:** «Надо тогда записать твой ответ
  про карусель и про RBAC куда-то». Точные destinations и write set
  подготовлены этим plan. После показа точного ID пользователь ответил:
  «Согласовываю».

## Ход выполнения

- Выполнен read-only audit UI/UX spec, ADR-0006, plan registry и актуальной
  Digiversity JWT/capability boundary.
- Draft создан атомарно и заполнен; после явного согласования переведён в
  `in_progress` и выбран текущей session.
- `GAME_UI_UX_SPEC.md` теперь прямо определяет rail как разрешённую
  user-controlled carousel variant, фиксирует allowed/prohibited behaviors,
  сохраняет full-hand sheet и допускает bounded opponent fallback.
- ADR-0006 теперь разделяет validated AuthN, coarse role claim и server-side
  capability enforcement; содержит semantic catalog, feature gating, UI-not-
  PEP, запрет fine-grained long-lived JWT authority и owner revocation
  freshness.
- Три independent read-only review проверили UI consistency, security и
  acceptance/scope. По security finding short TTL дополнен обязательной
  bounded fail-closed freshness для owner subject/policy; targeted recheck
  подтвердил исправление.

## Итог

- Оба пользовательских ответа записаны в канонические design documents без
  изменения runtime, API, schema, frontend/CSS, dependencies или config.
- Pre-archive проверки: text-check без issues, `git diff --check` clean,
  plan-lint `issues=0`, canonical verify на Node `v24.14.0` — hook tests
  `42/42`, leinoctl tests `63 passed`, `1 skipped`, `0 failed`.
- После archive canonical verify и scope-check повторяются на final input set.
- Commit/push не выполняются без отдельного разрешения пользователя.
