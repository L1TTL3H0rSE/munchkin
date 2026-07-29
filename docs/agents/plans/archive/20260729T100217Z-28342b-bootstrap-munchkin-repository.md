# PLAN: bootstrap munchkin repository

- **Plan ID:** `20260729T100217Z-28342b-bootstrap-munchkin-repository`
- **Статус:** completed
- **Создан:** 2026-07-29 10:02:17 UTC
- **Обновлён:** 2026-07-29 14:30 MSK
- **Владелец:** Codex
- **Workspace:** `/Users/kolyalis/Dev/munchkin`
- **Ветка:** `main`, unborn
- **Режим параллельности:** exclusive
- **Зависит от:** нет
- **Блокирует:** нет
- **Связанные ADR/handoff:** ADR-0001..0003

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".agents/**",
    ".codex/**",
    ".leino/**",
    "backend/**",
    "content/**",
    "docs/**",
    "frontend/**",
    "scripts/**",
    "tools/leinoctl/**",
    ".dockerignore",
    ".editorconfig",
    ".env.example",
    ".gitattributes",
    ".gitignore",
    ".gitlab-ci.yml",
    "AGENTS.md",
    "README.md",
    "docker-compose.yml",
    "leinoctl",
    "leinoctl.cmd"
  ],
  "components": [
    "repository-workflow",
    "go:backend/game",
    "frontend-workspace",
    "game-content",
    "root-compose"
  ],
  "contracts": [
    "leinoctl:profile-v1",
    "game:http-v1",
    "game:realtime-v1",
    "game:events-v1",
    "content:card-set-v1"
  ],
  "dependsOn": [],
  "sharedResources": []
}
```

## Цель

Создать самостоятельный repository с перенесённым generic AI harness и
проверяемым online card-game vertical slice без коммерческого card content.

## Критерии приёмки

- [x] Отдельный unborn Git repository на `main`, без commit/remote/push.
- [x] Harness/profile/docs адаптированы и проходят собственные tests.
- [x] Pure deterministic engine, private projections и replay реализованы.
- [x] HTTP, idempotency, guest credentials, SSE invalidation и CORS работают.
- [x] PostgreSQL migration/adapter и real-DB contract suite добавлены.
- [x] Nuxt lobby/table flow и Zod wire schemas проходят проверки.
- [x] Versioned content pack поддерживает original texts/local images.
- [x] Compose, CI, README и ADR созданы.

## Scope

В scope вошли весь первоначальный scaffold, harness snapshot и vertical
slice. Полный набор правил/карт, production auth/matchmaking/deploy и
коммерческий presentation content не входили.

## Архитектурный подход

Modular monolith сохраняет одну transaction boundary. Backend авторитетен;
engine pure; события сохраняют randomness; query projection actor-specific;
realtime version-only; content closed, immutable и лицензируется отдельно.

## Затронутые компоненты и контракты

| Компонент | Изменение | Контракт |
|---|---|---|
| repository-workflow | Новый harness/CI/docs | leinoctl/profile/plan v1 |
| go:backend/game | Engine/API/store/SSE | HTTP/events/realtime v1 |
| frontend-workspace | Nuxt + Zod | player projection v1 |
| game-content | Schema/validator/demo | card-set v1 |
| root-compose | PostgreSQL/game/web | local runtime |

## Координация с другими планами

Bootstrap был выполнен из согласованного external source plan с тем же ID.
Target hooks в bootstrap-session ещё не были загружены и проверялись вручную.
Следующая write-задача обязана начать новую trusted session и обычный target
plan lifecycle.

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.agents/**` | write | Skills |
| `.codex/**` | write | Hooks |
| `.leino/**` | write | Profile |
| `backend/**` | write | Backend |
| `content/**` | write | Card data |
| `docs/**` | write | Agent docs/ADR/plan |
| `frontend/**` | write | Web |
| `scripts/**` | write | Entrypoints |
| `tools/leinoctl/**` | write | Harness core |
| `.dockerignore` | write | Hygiene |
| `.editorconfig` | write | Hygiene |
| `.env.example` | write | Local config |
| `.gitattributes` | write | Hygiene |
| `.gitignore` | write | Hygiene |
| `.gitlab-ci.yml` | write | CI |
| `AGENTS.md` | write | Policy |
| `README.md` | write | Handoff |
| `docker-compose.yml` | write | Runtime |
| `leinoctl` | write | Wrapper |
| `leinoctl.cmd` | write | Wrapper |

### Shared resources

Нет.

## План реализации

1. [x] Инициализировать target и перенести/adapt harness.
2. [x] Реализовать content, pure engine и persistence.
3. [x] Реализовать HTTP/SSE и frontend.
4. [x] Добавить Compose/CI/docs.
5. [x] Выполнить canonical и runtime smoke checks.

## Проверки

- [x] Hooks: 42 tests.
- [x] `leinoctl`: 64 tests.
- [x] Go unit/application/HTTP/replay/privacy suite.
- [x] Node content validation и invalid fixtures.
- [x] Frontend lint/typecheck/contracts/build.
- [x] Compose config; Docker image startup был запущен, а registry EOF
  зафиксирован как внешний блокер среды.
- [x] Real PostgreSQL race/receipt/rollback contract.
- [x] Native API/SSE/CORS и frontend dev/SSR smoke.
- [x] Browser smoke был запрошен; connected browser в среде отсутствовал.
- [x] Strict UTF-8, target impact verify и content-boundary review.

## Риски и откат

Основные риски закрыты private projection tests, persisted randomness,
hash-only credentials, strict content validation и no-copyright boundary.
До первого commit откат является ручным удалением/редактированием target;
bootstrap не выполняет destructive cleanup автоматически.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-29 13:14 MSK
- **Подтверждено:** 2026-07-29 13:15 MSK
- **Формулировка/ограничения:** создать новый repository в `dev/munchkin`,
  взять архитектуру/harness текущего repository; пользователь самостоятельно
  создаёт новые фанатские тексты и изображения.
- **Формулировка согласования:** «Делай».

## Итог

Создан самостоятельный unborn repository с playable vertical slice и
self-contained AI control plane. Canonical verify и native runtime/API smoke
прошли; real PostgreSQL contract подтверждён. Полный Compose startup не дошёл
до build из-за повторного EOF при pull `postgres:17-alpine` из Docker Hub, а
визуальный click-through не запускался из-за отсутствия connected browser.
Commit, remote и push намеренно не создавались.
