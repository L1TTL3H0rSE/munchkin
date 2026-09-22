# PLAN: Moscow core content pack

- **Plan ID:** `20260729T161631Z-fd0c88-moscow-core-content-pack`
- **Статус:** completed
- **Создан:** 2026-07-29 16:16:31 UTC
- **Обновлён:** 2026-07-29 20:45 MSK
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260729T131042Z-6fe962-lobby-core-game-cycle`.
- **Блокирует:** `20260729T161635Z-c08a8a-moscow-card-art-studio`
- **Связанные ADR/handoff:** ADR-0004, `docs/game/first-edition-core-cycle.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "backend/game/internal/game/content_conformance_test.go",
    "content/README.md",
    "content/reference-local/first-edition-index.json",
    "content/sets/moscow/v1/**",
    "content/tools/validate.test.mjs",
    "docs/agents/plans/active/20260729T161631Z-fd0c88-moscow-core-content-pack.md",
    "docs/agents/plans/archive/20260729T161631Z-fd0c88-moscow-core-content-pack.md",
    "docs/game/moscow-content-style-guide.md"
  ],
  "components": [
    "game-content",
    "go:backend/game",
    "repository-workflow"
  ],
  "contracts": [
    "content:card-set-v1"
  ],
  "dependsOn": [
    "20260729T131042Z-6fe962-lobby-core-game-cycle"
  ],
  "sharedResources": [
    "content:card-set-v1",
    "content-set:moscow-core-v1",
    "content/reference-local:first-edition-index"
  ]
}
```

## Цель

Создать первый полный, полностью оригинальный русскоязычный content pack
«Московский манчкин» для уже реализованного lobby core cycle. Pack сохраняет
размер и функциональное разнообразие First Edition reference matrix, но не
копирует коммерческие названия, формулировки, переводы, шутки, изображения,
персонажей или trade dress.

Результат — immutable `moscow-core` version 1 на 168 authored physical slots:
95 Door и 73 Treasure. Из них 152 self/core slots разыгрываются текущим
`first-edition-core-v1`, а 16 original other-player designs остаются честно
помеченными `interaction_scope: other_players` и не попадают в текущие колоды.

## Критерии приёмки

- [x] Создан `content/sets/moscow/v1/cards.json` с immutable identity:
  `set_id: moscow-core`, `version: 1`, `author: L1TTL3H0rSE`,
  `license: All-Rights-Reserved`, `source: original-moscow-core-2026` и
  рассчитанным canonical digest.
- [x] Сумма `copies` равна ровно 168: 95 Door и 73 Treasure; slot-level
  interaction matrix содержит ровно 152 `none|self` и 16 `other_players`.
- [x] Все card IDs, названия, `rules_text` и `flavor_text` созданы заново на
  русском языке и тематически связаны с современной Москвой, метро, районами,
  городскими профессиями, бытом, бюрократией и локальным абсурдом.
- [x] Ни одна committed card не содержит коммерческого названия, перевода
  оригинального rules text, узнаваемого персонажа, цитаты, логотипа, шрифта,
  изображения или описания trade dress исходной игры.
- [x] Русский First Edition material используется только как linguistic
  reference для длины, ритма, терминов и юмористических приёмов; committed
  текст не является переводом и проходит отдельный originality review.
- [x] Mechanics каждой active card выражена только существующими closed
  `content:card-set-v1` kinds/effects. Если reference slot требует
  неподдерживаемого исключения, Moscow design получает новую оригинальную
  механику из текущего registry, а не script/no-op и не расширение engine.
- [x] Все 16 future multiplayer cards также имеют законченные оригинальные
  тексты и валидную typed definition, но отфильтровываются текущим profile
  целиком, а не становятся доступными пустышками.
- [x] Pack содержит осмысленную distribution matrix: Monsters, Curses,
  Class/Race-like traits, Items, one-shots, level-up и attachments покрывают
  все существующие effect kinds и основные core branches без одной
  доминирующей стратегии.
- [x] Для каждого slot в ignored local index заполнены
  `moscow_working_title`, `moscow_concept` и `adaptation_status`; существует
  однозначное локальное соответствие 168 reference ordinals к 168 Moscow
  slots, но оно не импортируется runtime и не коммитится.
- [x] Создан русский style guide с терминологией Door/Treasure, боя, побега,
  экипировки, Bad Stuff и charity, правилами длины текста и originality
  checklist.
- [x] Иллюстрации и `image` paths отсутствуют в v1: длинный текст остаётся
  presentation metadata, а визуальная версия pack создаётся зависимым
  card-art plan как новая immutable version.
- [x] Node validator, executable JSON Schema и Go loader принимают pack;
  negative fixtures подтверждают точные deck/slot/interaction counts,
  Cyrillic text и отсутствие remote/unsafe assets.
- [x] Чистая clone без `content/reference-local/` валидирует, тестирует и
  загружает committed Moscow pack: local reference не является build input.

## Контекст и подтверждённое состояние

- План №1 завершён и опубликован commit `1889bdd`; profile
  `first-edition-core-v1` и typed registry готовы.
- Committed demo pack содержит 36 definitions, 40 Door, 30 Treasure и
  2 deferred copies; presentation поддерживает русский text без изображения.
- Игнорируемый First Edition index содержит 168 ordinals: 95 Door,
  73 Treasure, 152 self и 16 other-player. Все 168 пока имеют
  `adaptation_status: needs_mechanics_review`.
- Reference matrix включает 36 Monsters, 20 Curses, 40 Items, 21 trait cards,
  17 one-shots, 9 level-ups и ряд special slots. У 24 entries стоит
  `review_required`, у 20 — deferred registry coverage.
- Current engine сознательно не поддерживает help, trade, targeted effects,
  multiple-monster combat и reactions. Этот plan не расширяет runtime scope.
- `content/reference-local/` уже игнорируется Git; committed imports на него
  отсутствуют.

## Scope

### Входит

- Полное авторство 168 Moscow slots и balance/distribution review.
- Versioned pack `content/sets/moscow/v1/cards.json` без изображений.
- Обновление ignored local adaptation status/working fields.
- Русский glossary/style/originality guide.
- Pack-specific Node и Go conformance tests.
- Документация выбора pack через существующий `GAME_CONTENT_PATH`.

### Не входит

- Копирование или перевод 168 коммерческих cards один-в-один.
- Новые effect kinds, schema fields, engine phases или multiplayer profile.
- Help, trade, theft, targeted Curse, additional Monster, charity transfer.
- Рамка, иллюстрации, AI prompts, image provider и Card Studio.
- Печать, PDF/export, production matchmaking и публикация в магазине.
- Автоматическая балансировка или утверждение баланса без playtest.

## Архитектурный подход

- Reference index используется только как локальная slot/checklist matrix.
  Для каждого ordinal сначала фиксируется механическая роль, затем создаются
  независимые Moscow concept, name и prose. Committed pack не хранит original
  name, source URL или ordinal mapping.
- Pack хранится в versioned directory `content/sets/moscow/v1/`; следующий
  visual plan не меняет v1, а создаёт v2 с image references.
- `copies` определяет physical slots. Разные карты не объединяются только ради
  уменьшения JSON, если это уничтожает authoring mapping; настоящие одинаковые
  Moscow copies могут использовать одну definition.
- Active designs ограничены текущим typed registry. `rules_text` описывает
  механику человеку, но runtime читает только typed specs/effects.
- Interaction-only designs валидны как content, но profile materialization
  исключает их до shuffle. Их будущая точная multiplayer semantics будет
  отдельным plan.
- Проверка originality состоит из машинных запретов на reference/runtime
  dependency и ручного review концепта/формулировки; fuzzy similarity не
  объявляется доказательством авторского права.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| game-content | Новый original Moscow pack и pack tests | `content:card-set-v1`, `moscow-core@1` |
| go:backend/game | Load/conformance fixture нового pack | Существующий Go content loader |
| repository-workflow | Style guide и lifecycle plan | Originality/reference boundary |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/internal/game/content_conformance_test.go` | write | Go load/digest conformance для Moscow pack |
| `content/README.md` | write | Документировать versioned Moscow pack |
| `content/reference-local/first-edition-index.json` | write | Обновить 168 ignored adaptation fields без commit |
| `content/sets/moscow/v1/**` | write | Полный immutable text-only pack version 1 |
| `content/tools/validate.test.mjs` | write | Counts, Cyrillic, digest и clean-clone fixtures |
| `docs/agents/plans/active/20260729T161631Z-fd0c88-moscow-core-content-pack.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260729T161631Z-fd0c88-moscow-core-content-pack.md` | write | Archived lifecycle плана |
| `docs/game/moscow-content-style-guide.md` | write | Русский glossary, tone и originality checklist |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `content-set:moscow-core-v1` | card-art plan | этот plan | v1 immutable; art plan создаёт v2 |
| `content:card-set-v1` | card-art plan | этот plan не меняет contract | только consume/validate |
| `content/reference-local:first-edition-index` | нет | этот plan | local ignored, никогда не runtime input |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-29 19:21 MSK через `leinoctl context`;
  до создания drafts active plans отсутствовали.
- **Обнаруженные пересечения:** зависимый card-art draft будет читать v1 и
  затронет `content/README.md`/validator tests после завершения этого plan.
- **Решение:** этот plan exclusive; card-art plan имеет явный `dependsOn` и
  не выбирается до archive `moscow-core-content-pack`.

## План реализации

1. [x] Зафиксировать Moscow glossary, tone, originality и distribution matrix.
2. [x] Пройти ignored index slot-by-slot, заполнить Moscow concept/title/status
   и классифицировать каждый design как active или future multiplayer.
3. [x] Создать `moscow-core@1` definitions партиями по kind с exact copies и
   только существующими typed mechanics.
4. [x] Выполнить semantic, balance и duplicate review после каждой партии;
   исправить текст/числа, не меняя runtime contract.
5. [x] Добавить Node pack invariants и Go load/digest conformance.
6. [x] Проверить clean-clone independence от ignored reference и реальный
   backend startup с `GAME_CONTENT_PATH` на Moscow v1.
7. [x] Выполнить canonical verify, scope-check, записать результаты и
   архивировать plan.

## Проверки

- [x] Local index: 168/95/73, все adaptation fields заполнены, 152/16 scope.
- [x] `git check-ignore content/reference-local/first-edition-index.json`.
- [x] `rg` подтверждает отсутствие committed import/reference mapping.
- [x] `node --test content/tools/validate.test.mjs`.
- [x] `node content/tools/digest.mjs content/sets/moscow/v1/cards.json`.
- [x] `node content/tools/validate.mjs content/sets/moscow/v1/cards.json`.
- [x] Go Moscow pack load/digest conformance.
- [x] `(cd backend/game && go test ./...)`.
- [x] Native backend startup с `GAME_CONTENT_PATH` на Moscow v1 и create-game
  smoke для 1 и 2 players.
- [x] Ручной originality review всех 168 slots по checklist.
- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260729T161631Z-fd0c88-moscow-core-content-pack`.
- [x] Финальный `git diff --check`, diff review и `git status --short`.

## Риски и откат

- **Риск:** 168 cards создают большой литературный и balance scope.
  **Снижение:** slot matrix, партия по kind, механические invariants и отдельный
  full-deck review до immutable digest.
- **Риск:** «на основе» превратится в перевод/механическую кальку.
  **Снижение:** independent Moscow concept до prose, запрет original names/text,
  ручной originality checklist и отсутствие mapping в committed pack.
- **Риск:** unsupported reference exception провоцирует script или scope creep.
  **Снижение:** redesign внутри текущего registry; engine/schema не меняются.
- **Риск:** v1 без art будет воспринят как финальная printable колода.
  **Снижение:** versioned directory и явная text-only маркировка; v2 принадлежит
  зависимому visual plan.
- **Откат:** до публикации удалить/исправить только новый v1 directory и tests
  обычным обратным patch. После использования identity не переписывается:
  исправление создаёт следующую version. Ignored local index не удаляется.

## Открытые вопросы

- Блокирующих вопросов нет. Согласованные `author: L1TTL3H0rSE`,
  `license: All-Rights-Reserved` и 16 disabled multiplayer designs зафиксированы
  в immutable v1.
- Точная runtime semantics взаимодействия с другим игроком остаётся отдельным
  future plan; текущий profile целиком исключает эти definitions.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-29 19:21 MSK
- **Подтверждено:** 2026-07-29 19:36 MSK
- **Формулировка согласования:** «Согласовываю планы 2 и 3».
- **Формулировка/ограничения пользователя:** после commit/push начать следующие
  планы; будущая колода полностью русская и оригинальная, называется
  «Московский манчкин»; First Edition задаёт mechanics/reference matrix,
  русский выпуск — только linguistic reference; original reference JSON
  остаётся ignored/local.

## Ход выполнения

- Draft создан атомарно после публикации plan №1; выполнено read-only
  исследование current pack/schema/registry и local 168-slot index.
- Пользователь явно согласовал plan 2026-07-29 формулировкой
  «Согласовываю планы 2 и 3».
- Новая trusted session `019faebe-b3c7-7c20-a32e-31fde14937ef` 2026-07-29
  приняла lifecycle через явный `leinoctl plan select --takeover`: прежний
  owner принадлежал завершившей планирование session, выбранным plan которой
  был уже archived `lobby-core-game-cycle`.
- Реализация начата по прямой команде пользователя «Начинай plan
  20260729T161631Z-fd0c88-moscow-core-content-pack».
- Создан `moscow-core@1`: 168 уникальных русскоязычных definitions с
  `copies: 1`, 95 Door, 73 Treasure, 152 active и 16
  `interaction_scope: other_players`; canonical digest
  `sha256:e87f280cc53667659c38308dc213510749c8c87495c38cefc07f58f8bb094854`.
- Локальный ignored index обновлён до однозначного 168↔168 соответствия:
  все working title/concept/status заполнены, 152 entries готовы для core и
  16 — для будущего multiplayer; runtime/import зависимость отсутствует.
- Независимые read-only contract и editorial reviews охватили весь pack.
  Исправлены pursuit boundary, tag closure, multiplayer wording и русская
  терминология; финальные повторные reviews вернули PASS.
- Статическая distribution review закреплена exact tests: 9 card kinds,
  11 effect kinds, 5 modifier targets, 23 active character tags и 14 active
  monster tags. Эмпирический игровой баланс не утверждается без playtest.
- Clean-copy из 174 tracked/unignored files без `content/reference-local/`
  прошла validator, 19 Node tests и `go test -count=1 ./...`; отдельные
  isolated Node/Go fixtures закрепляют эту границу в regression suite.
- Native startup smoke загрузил `moscow-core@1`: после setup у one-player
  осталось 80/64 Door/Treasure, у two-player — 76/60, оба start API завершились
  успешно.
- Canonical verify и scope-check завершились успешно 2026-07-29. Использованы
  объявленные toolchain Node 24.14.0, pnpm 11.9.0 и Git Bash 5.2.37;
  `pnpm_config_verify_deps_before_run=false` отключал повторную age-проверку
  уже установленного lockfile, не пропуская project checks. Scope-check:
  `outsideWriteSet: []`, `missingRequiredChecks: []`; сохранилось
  информационное предупреждение о шести writes без post-write ledger hook.

## Итог

Согласованный text-only Moscow pack реализован и проверен без изменения schema
или engine contract. `moscow-core@1` материализует 84 Door и 68 Treasure,
а все 16 future multiplayer definitions валидируются, но полностью исключены
из current profile.

Фактические результаты:

- Node content suite: 19/19; executable JSON Schema и standalone validator
  приняли pack; IDs/names уникальны, presentation text кириллический, images
  отсутствуют;
- Go: forced `go test -count=1 ./...` прошёл в clean-copy, package conformance
  проверил digest/materialization и pursuit levels 1/2/3;
- frontend impact checks: lint, typecheck, contracts 4/4, web 10/10 и
  production build прошли;
- repository harness: hooks 42/42, leinoctl 63 passed/1 platform symlink skip,
  plan-lint без issues, strict text-check, Bash syntax и Compose config прошли;
- originality review не нашёл коммерческих имён/текстов или reference mapping
  в committed pack; это редакторское доказательство по checklist, а не
  правовая гарантия;
- commit и push не выполнялись.
