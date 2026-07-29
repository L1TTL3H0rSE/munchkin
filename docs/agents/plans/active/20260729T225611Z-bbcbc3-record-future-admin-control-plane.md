# PLAN: record future admin control plane

- **Plan ID:** `20260729T225611Z-bbcbc3-record-future-admin-control-plane`
- **Статус:** draft
- **Создан:** 2026-07-29 22:56:11 UTC
- **Обновлён:** 2026-07-29 23:03:00 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** нет
- **Блокирует:** будущие implementation plans для production admin console
- **Связанные ADR/handoff:** ADR-0002, ADR-0003, ADR-0005, proposed ADR-0006

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
  "dependsOn": [],
  "sharedResources": [
    "admin-control-plane:architecture-v1"
  ]
}
```

## Цель

Зафиксировать отдельным ADR подтверждённое направление production admin
control plane: каталог всех хранимых сущностей через безопасные предметные
представления, управление draft-версиями контента и assets, обзор игр,
участников и истории, отдельная admin-аутентификация и аудит. Явно отделить
это будущее направление от уже существующей local/dev Card Studio и не
выдавать его за реализованную админку.

## Критерии приёмки

- [ ] ADR описывает разделы будущей админки: content sets/versions/decks/cards,
  assets и provenance, Card Studio jobs, games, participants, безопасная
  история событий/боёв, а также audit/operations.
- [ ] «Показать всё, что хранится» определено как полное покрытие предметных
  сущностей curated read-моделями, а не как raw DB/filesystem browser.
- [ ] Опубликованный `(set_id, version, content_digest)` остаётся immutable:
  создание и редактирование карт выполняется в draft следующей версии,
  публикация проходит schema/content/provenance validation.
- [ ] Admin identity и authorization отделены от игровых bearer credentials;
  для первого MVP рекомендована минимальная owner/admin роль, а расширенный
  RBAC оставлен отдельному implementation plan.
- [ ] Raw snapshots, event payloads, command receipt projections, credential
  hashes, deck order, RNG state и private player state не показываются по
  умолчанию; история строится как redacted timeline/read model.
- [ ] ADR фиксирует, что сейчас существуют только game-scoped guest players,
  а не global user accounts; account/OIDC domain проектируется отдельно, если
  потребуются настоящие зарегистрированные пользователи.
- [ ] Связь с будущим S3-compatible asset storage обозначена без выбора vendor,
  key layout, lifecycle, signed URL или migration contract.
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
  рассматривается отдельным draft plan.
- Пользователь подтвердил потребность видеть в будущей админке текущие колоды,
  прикреплённые файлы, редактировать поля и создавать карты, а также видеть
  остальные хранимые сущности, включая участников и историю боёв.

## Scope

### Входит

- Новый ADR-0006 с current-state inventory, целевой boundary и безопасностью.
- Модульная карта будущей admin console и рекомендуемые фазы реализации.
- Явное различие между текущими guest participants и будущими accounts.
- Обновление ADR index.

### Не входит

- Nuxt admin pages, shared TypeScript contracts или backend admin endpoints.
- Database migrations, query models, replay/reporting jobs и audit storage.
- Content CRUD, draft/publish workflow или изменение schema/content packs.
- Production auth, OIDC, RBAC, account management, bans и impersonation.
- S3 client, buckets, IAM, presigned URLs, CDN, retention или migration.
- Commit, push и публикация.

## Архитектурный подход

- Строить админку как отдельный control plane с backend-owned admin API, а не
  давать frontend прямой доступ к PostgreSQL, filesystem или object storage.
- Экспонировать явные paginated/filterable read models для каждой области:
  content/assets, games/participants/history и operations/audit.
- Разделять query и mutation permissions; все admin mutations записывать в
  append-only audit trail с actor, action, target, timestamp и result.
- Выполнять content mutations только над draft следующей версии; перед publish
  показывать diff/validation и создавать новый immutable content artifact.
- Производить redacted battle timeline из событий; raw replay/state оставлять
  внутренним диагностическим артефактом с отдельным break-glass решением, если
  оно когда-либо понадобится.
- Развивать существующую Card Studio как специализированный art workflow,
  который может быть связан с будущей админкой, но не считать её production
  authorization или общим content repository.
- Предлагаемый порядок: read-only owner MVP, content draft CRUD/publish и asset
  storage, затем accounts/RBAC, затем operations/analytics/retention.

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
| `admin-control-plane:architecture-v1` | Нет | этот plan | Exclusive ADR update |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 02:03 MSK через `leinoctl context`.
- **Обнаруженные пересечения:** draft plan
  `20260729T224707Z-7f21dd-record-card-art-object-storage` затрагивает ADR-0005
  и смежное future storage направление, но write sets не пересекаются.
- **Решение:** оставить storage и admin как два независимых решения; в этой
  session можно выбрать только один plan.

## План реализации

1. [ ] Создать ADR-0006 и перечислить current storage/domain inventory.
2. [ ] Зафиксировать admin modules, authorization/privacy boundaries,
   immutable draft/publish content workflow и audit requirements.
3. [ ] Добавить staged implementation roadmap и ссылки на ADR-0002/0003/0005.
4. [ ] Добавить ADR-0006 в decision index.
5. [ ] Выполнить canonical checks, scope-check и архивировать plan.

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
- **Откат:** удалить новый ADR и строку из index обычным revert.

## Открытые вопросы

- Нужны ли отдельные зарегистрированные accounts уже в первом MVP, или раздел
  «пользователи» сначала показывает только game-scoped guest participants.
- Конкретный admin identity provider, deployment topology и RBAC matrix.
- Retention/export policy для games, events, receipts, studio jobs и assets.
- Точный состав derived battle summaries и допустимый break-glass доступ.
- Vendor/key/lifecycle/CDN/signed access для object storage.

## Согласование

- **Статус:** awaiting user approval
- **Запрошено:** 2026-07-29 22:56:11 UTC
- **Подтверждено:** —
- **Формулировка/ограничения пользователя:** «Я также хочу админку, в которой
  можно будет видеть текущие колоды, файлы, которые к ним прикреплены и
  возможность редактирования полей у каждой карты и создания новых… там
  должно отображаться вообще всё, что у нас хранится, то есть также пользаки
  и история боёв».

## Ход выполнения

- Выполнена read-only инвентаризация backend persistence/API, content packs,
  Card Studio и frontend contracts.
- Draft заполнен; ADR и runtime реализация не начаты.

## Итог

Заполняется после реализации.
