# PLAN: humorous card art master prompt

- **Plan ID:** `20260729T220455Z-399c0e-humorous-card-art-master-prompt`
- **Статус:** completed
- **Создан:** 2026-07-29 22:04:55 UTC
- **Обновлён:** 2026-07-30 01:36 MSK
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260729T161635Z-c08a8a-moscow-card-art-studio`.
- **Блокирует:** нет
- **Связанные ADR/handoff:** ADR-0005

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/decisions/0005-original-card-art-studio.md",
    "docs/agents/plans/active/20260729T220455Z-399c0e-humorous-card-art-master-prompt.md",
    "docs/agents/plans/archive/20260729T220455Z-399c0e-humorous-card-art-master-prompt.md",
    "docs/game/moscow-card-art-direction.md",
    "frontend/applications/web/server/utils/cardStudio/prompt.ts",
    "frontend/applications/web/test/cardStudioAuthPrompt.test.ts"
  ],
  "components": [
    "frontend-workspace",
    "pnpm:@munchkin/web",
    "repository-workflow"
  ],
  "contracts": [
    "card-studio:http-v1"
  ],
  "dependsOn": [
    "20260729T161635Z-c08a8a-moscow-card-art-studio"
  ],
  "sharedResources": [
    "card-studio:prompt-policy-v1"
  ]
}
```

## Цель

Сделать принятый original humorous tabletop cartoon master prompt постоянной
provider-agnostic частью server-side Card Studio compiler. Пользователь для
каждой карты редактирует только короткий семипольный illustration brief;
визуальный язык, composition boundary и hard exclusions добавляются
автоматически одинаково для fake, встроенного ImageGen и OpenAI Image API.

## Критерии приёмки

- [x] `compileCardArtPrompt` автоматически добавляет компактный master-блок:
  hand-inked humorous fantasy cartoon, выразительные pose/expression, одна
  читаемая visual joke, плоский ограниченный цвет и простой фон.
- [x] Master остаётся самостоятельным: не содержит имени John Kovalic,
  `Munchkin`, другого художника/продукта, provider/model names или требования
  воспроизвести существующую illustration/trade dress.
- [x] Illustration-only boundary сохраняет portrait 1024x1536, crop-safe
  margins и запреты text/logo/watermark/frame/stats/UI/finished-card layout.
- [x] Existing seven-field `StudioArtBrief` и `card-studio:http-v1` wire shape
  не меняются; provider/service получают compiled prompt как opaque string.
- [x] Максимально длинный valid brief вместе с master prompt укладывается в
  существующий лимит compile result `4000` characters.
- [x] Prompt hash детерминирован, меняется при card-specific brief variation,
  а existing mimicry rejection срабатывает до provider invocation.
- [x] Ранее одобренный Moscow v2 asset, provenance и content digest не
  изменяются и новая генерация не запускается.

## Контекст и подтверждённое состояние

- Current compiler уже является единственной server-side runtime точкой для
  fake/OpenAI providers, но жёстко добавляет zine/cut-paper/transit-map style.
- UI и wire contract уже передают только `subject`, `setting`, `action`,
  `composition`, `palette`, `mood`, `exclusions`; новых полей не требуется.
- Provider/service не интерпретируют prompt и не требуют изменений.
- Current `studioCompileResultSchema` ограничивает prompt длиной 4000
  characters, поэтому полный prose-вариант master prompt нужно компактно
  скомпилировать, сохранив его смысл.
- Go backend не содержит Card Studio contract/fixture: authoring boundary
  принадлежит Nuxt/Nitro и не затрагивает authoritative gameplay.
- В worktree остаются согласованные незакоммиченные изменения завершённого
  parent plan; они являются baseline и не очищаются/не перезаписываются.

## Scope

### Входит

- Provider-agnostic master constant и deterministic prompt assembly.
- Focused policy tests, включая maximum-length brief.
- Обновление ADR-0005 и art-direction документа под автоматический master.

### Не входит

- Новые brief fields, изменение shared Zod schemas или UI layout.
- Изменение provider adapter, jobs, approval, content pack или provenance.
- Повторная генерация `yard-evacuator.webp` либо других illustrations.
- Имитация named living artist, commercial product или готовой card frame.
- Commit, push и публикация.

## Архитектурный подход

- Компактный immutable master-блок живёт рядом с
  `compileCardArtPrompt`; compiler добавляет после него нормализованные
  card-specific fields и hard exclusions.
- Master описывает только общую визуальную грамматику. Card name остаётся
  context-only, семь brief fields — единственная per-card variation.
- Prompt не знает выбранный provider/model, поэтому один hashable string
  одинаково подходит fake, built-in ImageGen и token-backed adapter.
- Existing `assertBriefPolicy` остаётся fail-closed для artist/product
  mimicry; тесты закрепляют отсутствие provider-specific и named-style terms.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| pnpm:@munchkin/web | Master prompt compiler и focused tests | Semantics `card-studio:http-v1`, shape unchanged |
| repository-workflow | ADR и art-direction guidance | `card-studio:prompt-policy-v1` |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/decisions/0005-original-card-art-studio.md` | write | Зафиксировать ownership master prompt |
| `docs/agents/plans/active/20260729T220455Z-399c0e-humorous-card-art-master-prompt.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260729T220455Z-399c0e-humorous-card-art-master-prompt.md` | write | Archived lifecycle плана |
| `docs/game/moscow-card-art-direction.md` | write | Заменить zine direction на accepted automatic master |
| `frontend/applications/web/server/utils/cardStudio/prompt.ts` | write | Provider-agnostic master compiler |
| `frontend/applications/web/test/cardStudioAuthPrompt.test.ts` | write | Prompt/policy/length regression coverage |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `card-studio:prompt-policy-v1` | archived parent Studio plan | этот plan | Узкая последовательная семантическая корректировка |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 01:04 MSK через
  `leinoctl context`/`preflight`; active plans отсутствуют.
- **Обнаруженные пересечения:** current paths уже существуют как dirty baseline
  завершённого и архивированного parent plan.
- **Решение:** explicit `dependsOn`; не менять никакие parent artifacts вне
  write set и проверять scope относительно snapshot новой selected session.

## План реализации

1. [x] Заменить hardcoded zine sentence компактным constant master prompt.
2. [x] Сохранить normalized per-card fields, hard exclusions и deterministic
   SHA-256 assembly без provider-specific branches.
3. [x] Расширить focused tests master-инвариантами, provider neutrality,
   maximum length, variation hash и mimicry rejection.
4. [x] Обновить ADR/art-direction без named-artist imitation language.
5. [x] Выполнить focused и canonical checks, scope-check и архивировать plan.

## Проверки

- [x] `pnpm --dir frontend/applications/web test -- cardStudioAuthPrompt.test.ts`.
- [x] `(cd frontend && pnpm lint)`.
- [x] `(cd frontend && pnpm check)`.
- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed` на repository Node 24 toolchain.
- [x] `./leinoctl scope-check --plan 20260729T220455Z-399c0e-humorous-card-art-master-prompt`.
- [x] `git diff --check` и финальный read-only diff review.

## Риски и откат

- **Риск:** слишком длинный master нарушит wire limit 4000.
  **Снижение:** компактная формулировка и maximum-valid-brief test.
- **Риск:** prompt снова станет provider-specific или будет незаметно
  дублировать per-card style.
  **Снижение:** один server constant, neutrality assertions и documentation.
- **Риск:** защита от imitation ослабнет при смене visual direction.
  **Снижение:** существующий rejection остаётся; negative tests расширяются.
- **Откат:** вернуть четыре scoped text/source файла обычным revert; jobs,
  assets, provenance и immutable content versions не меняются.

## Открытые вопросы

- Нет. Принят safe master без имени художника; UI/wire shape остаются прежними.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-30 01:07 MSK
- **Подтверждено:** 2026-07-30 01:10 MSK
- **Формулировка согласования:** «Согласовываю план
  20260729T220455Z-399c0e-humorous-card-art-master-prompt. Делай».
- **Формулировка/ограничения пользователя:** «Давай, пусть так будет» —
  принят предложенный original master prompt; требуется автоматическая
  подстановка для local ImageGen и token-backed generation.

## Ход выполнения

- Draft создан атомарно после read-only проверки compiler, contract, UI,
  tests, ADR и art-direction; реализация не начата.
- Пользователь явно согласовал точный plan ID; status переведён в
  `approved`.
- Выбор plan в текущей task-session остановлен штатной защитой: session уже
  навсегда привязана к архивированному parent plan
  `20260729T161635Z-c08a8a-moscow-card-art-studio`. Implementation writes не
  начинались; продолжение требует новой trusted task-session.
- Новая trusted task-session подтвердила остановку прежнего владельца,
  приняла lifecycle через явный `leinoctl plan select --takeover` и перевела
  plan в `in_progress`.
- Compiler, focused regression tests, ADR и art-direction обновлены в пределах
  write set. Focused suite прошёл `9/9`; maximum brief проверяется через
  `studioCompileResultSchema`, а service-level test подтверждает отсутствие job
  и provider invocation при mimicry rejection.
- Canonical `./leinoctl verify --changed` успешно прошёл на Node `24.14.0`:
  frontend lint/check/build, `41` web tests, `7` contract tests, `23` content
  validator tests, Go tests, `42` hook tests, `64` leinoctl tests
  (`63` pass, `1` platform skip), plan lint, shell syntax и Compose config.
- Baseline SHA-256 для Moscow v2 asset/cards/provenance повторно совпали:
  `9c5deb8e...`, `dbd3874f...`, `2e85ea5a...`; генерация не запускалась.
- `scope-check` остаётся заблокирован двумя чужими изменениями вне write set:
  `content/README.md` изменён в `22:14:45Z`, а архив lobby-plan
  `20260729T131042Z-6fe962-lobby-core-game-cycle.md` — в `22:15:21Z`, уже
  после snapshot этой session (`22:14:34Z`). Они не изменялись и не
  откатывались текущим plan.

## Итог

Реализация и canonical checks завершены.
