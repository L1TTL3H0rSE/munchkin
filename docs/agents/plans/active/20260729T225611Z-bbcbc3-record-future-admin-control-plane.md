# PLAN: record future admin control plane

- **Plan ID:** `20260729T225611Z-bbcbc3-record-future-admin-control-plane`
- **Статус:** awaiting_approval
- **Создан:** 2026-07-29 22:56:11 UTC
- **Обновлён:** 2026-07-30 00:13:24 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plans `20260729T230648Z-127dc2-record-contest-infrastructure-roadmap`, `20260729T224707Z-7f21dd-record-card-art-object-storage`, `20260730T001008Z-74d4bb-map-multiplayer-interactions`.
- **Блокирует:** будущие implementation plans для production admin console
- **Связанные ADR/handoff:** ADR-0002, ADR-0003, ADR-0005, ADR-0007,
  proposed ADR-0006, proposed ADR-0008,
  `docs/agents/INFRASTRUCTURE_ROADMAP.md`, storage plan
  `20260729T224707Z-7f21dd-record-card-art-object-storage`, interaction plan
  `20260730T001008Z-74d4bb-map-multiplayer-interactions`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/decisions/README.md",
    "docs/agents/decisions/0006-administration-control-plane.md",
    "docs/agents/plans/active/20260729T225611Z-bbcbc3-record-future-admin-control-plane.md",
    "docs/agents/plans/archive/20260729T225611Z-bbcbc3-record-future-admin-control-plane.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [],
  "dependsOn": [
    "20260729T230648Z-127dc2-record-contest-infrastructure-roadmap",
    "20260729T224707Z-7f21dd-record-card-art-object-storage",
    "20260730T001008Z-74d4bb-map-multiplayer-interactions"
  ],
  "sharedResources": [
    "admin-control-plane:architecture-v1",
    "docs:decision-index"
  ]
}
```

## Цель

Зафиксировать отдельным ADR подтверждённое P2-направление production admin
control plane поверх boundary ADR-0007: каталог всех хранимых предметных
сущностей через безопасные read models, управление draft-версиями контента и
assets, обзор игр, участников и истории, отдельная admin-аутентификация,
append-only audit и безопасные operations summaries. Явно отделить его от
local/dev Card Studio, P0-A/P0-B конкурсной инфраструктуры и не выдавать за
реализованную либо уже публично доступную админку.

## Критерии приёмки

- [ ] ADR описывает разделы будущей админки: content sets/versions/decks/cards,
  assets и provenance, Card Studio jobs, games, participants, безопасная
  история событий/боёв, а также audit/operations.
- [ ] Admin control plane явно относится к P2 после стабильных HTTPS deploy,
  readiness, observability и backup/restore и не блокирует Sunday MVP.
- [ ] «Показать всё, что хранится» определено как полное покрытие предметных
  сущностей curated read-моделями, а не как raw DB/filesystem browser.
- [ ] Опубликованный `(set_id, version, content_digest)` остаётся immutable:
  создание и редактирование карт выполняется в draft следующей версии,
  публикация проходит schema/content/provenance validation.
- [ ] Admin identity и authorization отделены от игровых bearer credentials;
  для первого MVP рекомендована минимальная owner/admin роль, а расширенный
  RBAC оставлен отдельному implementation plan.
- [ ] Admin и Card Studio не публикуются ingress-ом до отдельной production
  admin identity/auth boundary; после включения они доступны только через
  защищённый Traefik route/hostname, без прямых public DB/object-storage ports.
- [ ] Raw snapshots, event payloads, command receipt projections, credential
  hashes, deck order, RNG state и private player state не показываются по
  умолчанию; история строится как redacted timeline/read model.
- [ ] ADR фиксирует, что сейчас существуют только game-scoped guest players,
  а не global user accounts; account/OIDC domain проектируется отдельно, если
  потребуются настоящие зарегистрированные пользователи.
- [ ] Asset catalog работает через backend admin API и storage adapter:
  frontend не получает S3 credentials, raw filesystem paths или прямой bucket
  browser; private candidates выдаются временными signed URLs.
- [ ] Card-art asset storage отделён от PostgreSQL backup storage; admin не
  показывает backup objects, backup credentials или содержимое backup.
- [ ] Admin audit и OpenTelemetry разведены: append-only audit покрывает
  каждую admin mutation минимальной allowlisted записью
  `actor/action/target/timestamp/result` без credentials, raw
  payloads/snapshots, prompts/images или иных secrets; operational telemetry
  может sampling-иться и не содержит display names или high-cardinality
  entity IDs.
- [ ] Operations UI показывает только curated summaries: deployed SHA,
  readiness, backup age/result и безопасный статус Studio jobs, но не secrets,
  raw infrastructure config, backup contents или telemetry storage.
- [ ] Будущие admin migrations, read models и audit data наследуют migration
  compatibility, readiness, backup/restore и rollback требования ADR-0007.
- [ ] Связь с принятым S3-compatible asset storage decision обозначена без
  повторного выбора vendor, exact key layout, lifecycle/CDN или migration.
- [ ] Документ содержит поэтапный roadmap и явно не меняет runtime code,
  database, API, auth, storage либо content packs.

## Контекст и подтверждённое состояние

- PostgreSQL сейчас хранит `games`, game-scoped `game_players`, append-only
  `game_events` и idempotency `game_command_receipts`; global `users`, admin
  roles и admin audit log отсутствуют.
- `games.snapshot` и payload событий содержат authoritative internal state,
  включая приватные игровые данные; существующий HTTP слой намеренно отдаёт
  только actor-specific projection.
- Текущий `GET /api/v1/games/{gameID}/events` является authenticated SSE
  version invalidation stream, а не API чтения сохранённой истории.
- Content packs закрыты schema и фиксируются immutable identity/version/digest.
  Backend не хранит карточки и их assets в игровых таблицах.
- Local/dev Card Studio уже умеет перечислять карты Moscow v1, редактировать
  illustration brief, создавать generation jobs и approve-ить WebP в draft
  Moscow v2. CRUD механик карт, колод, наборов и production-admin auth нет.
- Studio jobs/candidates сейчас лежат в локальном `.card-studio`, а approved
  assets — внутри versioned content pack; S3-compatible production boundary
  фиксируется предшествующим storage plan.
- ADR-0007 задаёт single-VPS/Traefik production topology, vendor-neutral OTel
  boundary, readiness/deploy/rollback и off-host PostgreSQL backup и прямо
  запрещает публиковать admin/Card Studio без отдельного решения.
- Infrastructure roadmap относит production admin console и card-art asset
  storage/CDN к P2 после конкурсного P0-A/P0-B.
- Future battle/history read models должны потреблять принятые interaction
  events/close reasons из предшествующего multiplayer protocol, а не
  изобретать параллельную семантику в admin ADR.
- Пользователь подтвердил потребность видеть в будущей админке текущие колоды,
  прикреплённые файлы, редактировать поля и создавать карты, а также видеть
  остальные хранимые сущности, включая участников и историю боёв.

## Scope

### Входит

- Новый ADR-0006 с current-state inventory, целевой boundary и безопасностью.
- Модульная карта будущей admin console и рекомендуемые фазы реализации.
- Явное различие между текущими guest participants и будущими accounts.
- Наследование ingress, telemetry, migration и recovery boundary ADR-0007.
- Обновление ADR index.

### Не входит

- Nuxt admin pages, shared TypeScript contracts или backend admin endpoints.
- Database migrations, query models, replay/reporting jobs и audit storage.
- Content CRUD, draft/publish workflow или изменение schema/content packs.
- Реализация/provisioning/configuration production auth, OIDC, RBAC, account
  management, bans и impersonation.
- Реализация S3 client, buckets, IAM, presigned URLs, CDN, retention или
  migration.
- Изменение Traefik routes, OTel exporters/dashboards, backup jobs или restore.
- Commit, push и публикация.

## Архитектурный подход

- Строить админку как отдельный control plane с backend-owned admin API, а не
  давать frontend прямой доступ к PostgreSQL, filesystem или object storage.
- Не публиковать admin/Card Studio до отдельной production admin auth. После
  включения использовать только защищённый Traefik route/hostname и internal
  service networks из ADR-0007.
- Экспонировать явные paginated/filterable read models для каждой области:
  content/assets, games/participants/history и operations/audit.
- Разделять query и mutation permissions; каждую admin mutation записывать в
  append-only unsampled audit trail с минимальной allowlisted записью actor,
  action, target, timestamp и result. Не сохранять там raw payload/private
  state и не использовать sampled OTel traces как audit storage.
- Отправлять в OTel только operational signals с bounded cardinality и
  privacy rules ADR-0007; raw admin payloads, snapshots, prompts, images,
  display names и entity IDs туда не попадают.
- Выполнять content mutations только над draft следующей версии; перед publish
  показывать diff/validation и создавать новый immutable content artifact.
- Получать asset metadata и temporary signed URLs только через backend storage
  adapter. Backup bucket и его credentials никогда не являются частью asset
  catalog.
- Производить redacted battle timeline из событий; raw replay/state оставлять
  внутренним диагностическим артефактом с отдельным break-glass решением, если
  оно когда-либо понадобится. Timeline использует interaction kinds,
  participants, outcomes и close reasons из принятого ADR-0008.
- Развивать существующую Card Studio как специализированный art workflow,
  который может быть связан с будущей админкой, но не считать её production
  authorization или общим content repository.
- Включить admin schema/read models/audit в migration compatibility,
  readiness, off-host backup/restore и rollback policy до production writes.
- Предлагаемый порядок: сначала завершить P0-A/P0-B; затем P2 owner-only
  read-model MVP с auth/redaction; потом content draft CRUD/publish и asset
  storage; после этого accounts/OIDC, расширенный RBAC,
  operations/analytics/retention.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| repository-workflow | Новый ADR-0006 и запись в ADR index | Runtime contracts unchanged |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/decisions/README.md` | write | Добавить ADR в index |
| `docs/agents/decisions/0006-administration-control-plane.md` | write | Зафиксировать future admin boundary |
| `docs/agents/plans/active/20260729T225611Z-bbcbc3-record-future-admin-control-plane.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260729T225611Z-bbcbc3-record-future-admin-control-plane.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `admin-control-plane:architecture-v1` | Нет | этот plan | Exclusive ADR update после storage decision |
| `docs:decision-index` | interaction plan `20260730T001008Z-74d4bb-map-multiplayer-interactions` | этот plan после dependency | Interaction plan сначала добавляет ADR-0008; затем этот plan добавляет ADR-0006 без изменения его записи |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 02:48 MSK через `leinoctl context`.
- **Обнаруженные связи:** infrastructure-roadmap plan завершён и является
  design dependency; storage draft определяет asset boundary, необходимую
  ADR-0006; interaction draft определяет события и outcomes для battle/history
  read models. Write sets storage/admin не пересекаются. Interaction/admin
  последовательно пишут decision index. Frontend engineering spec пишет
  другие paths/shared resources.
- **Решение:** dependency order:
  infrastructure roadmap + card-art storage ADR + multiplayer interaction ADR
  → admin control-plane ADR. Каждый plan выполняется отдельной selected
  session.

## План реализации

1. [ ] После завершения storage и interaction dependencies создать ADR-0006
   и перечислить current storage/domain inventory.
2. [ ] Зафиксировать admin modules, protected Traefik exposure,
   authorization/privacy boundaries, immutable draft/publish workflow и
   backend-owned asset access.
3. [ ] Развести append-only admin audit и sampled operational OTel; описать
   safe operations summaries и forbidden data.
4. [ ] Наследовать migration/readiness/backup/restore/rollback boundary
   ADR-0007 и добавить staged P2 implementation roadmap.
5. [ ] Добавить ссылки на ADR-0002/0003/0005/0007 и ADR-0006 в decision index.
6. [ ] Выполнить canonical checks, scope-check и архивировать plan.

## Проверки

- [ ] `node .codex/hooks/plan-lint.mjs`.
- [ ] `./leinoctl text-check --changed`.
- [ ] `./leinoctl verify --changed` на repository Node 24 toolchain.
- [ ] `./leinoctl scope-check --plan 20260729T225611Z-bbcbc3-record-future-admin-control-plane`.
- [ ] `git diff --check` и финальный read-only diff review.

## Риски и откат

- **Риск:** формулировка «всё, что хранится» будет понята как разрешение
  показывать сырые snapshots/events/secrets.
  **Снижение:** закрепить полный каталог сущностей, но только через redacted
  typed read models и least privilege.
- **Риск:** ADR создаст впечатление, что global users и production admin auth
  уже существуют.
  **Снижение:** явно разделить current state, target state и staged roadmap.
- **Риск:** редактирование опубликованной карты нарушит replay/content digest.
  **Снижение:** только draft следующей версии и immutable publish.
- **Риск:** Traefik случайно откроет admin/Card Studio до готовой admin auth.
  **Снижение:** deny-by-default ingress, отсутствие direct public ports и
  отдельная проверяемая route/hostname policy в implementation plan.
- **Риск:** admin audit или чувствительные payloads утекут в sampled OTel.
  **Снижение:** отдельное audit storage, telemetry allowlist/redaction и
  bounded-cardinality attributes из ADR-0007.
- **Риск:** operations screen превратится в raw infrastructure/backup browser.
  **Снижение:** только typed summaries без secrets, configs и backup contents.
- **Откат:** удалить новый ADR и строку из index обычным revert.

## Открытые вопросы

- Нужны ли отдельные зарегистрированные accounts уже в первом MVP, или раздел
  «пользователи» сначала показывает только game-scoped guest participants.
- Конкретный admin identity provider, protected hostname/route и RBAC matrix;
  базовая single-VPS/Traefik topology уже задана ADR-0007.
- Retention/export policy для games, events, receipts, studio jobs и assets.
- Точный состав derived battle summaries и допустимый break-glass доступ.
- Exact signed URL TTL и admin asset operations после принятия storage ADR.

## Согласование

- **Статус:** awaiting renewed user approval after material dependency and
  risk update
- **Запрошено:** 2026-07-29 23:48:05 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** «Я также хочу админку, в которой
  можно будет видеть текущие колоды, файлы, которые к ним прикреплены и
  возможность редактирования полей у каждой карты и создания новых… там
  должно отображаться вообще всё, что у нас хранится, то есть также пользаки
  и история боёв»; затем пользователь потребовал учесть утверждённый
  infrastructure roadmap в обоих active drafts и разрешил исправить их в
  обновлённой session.

## Ход выполнения

- Выполнена read-only инвентаризация backend persistence/API, content packs,
  Card Studio и frontend contracts.
- После принятия ADR-0007 обновлены dependencies, P2 sequencing, ingress,
  storage, audit/telemetry и recovery boundaries.
- Draft заполнен; ADR и runtime реализация не начаты.

## Итог

Заполняется после реализации.
