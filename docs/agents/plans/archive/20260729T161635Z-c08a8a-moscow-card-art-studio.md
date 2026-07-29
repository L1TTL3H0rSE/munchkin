# PLAN: Moscow card art studio

- **Plan ID:** `20260729T161635Z-c08a8a-moscow-card-art-studio`
- **Статус:** completed
- **Создан:** 2026-07-29 16:16:35 UTC
- **Обновлён:** 2026-07-30 00:57 MSK
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260729T161631Z-fd0c88-moscow-core-content-pack`.
- **Блокирует:** future print/export и full-deck art production plans
- **Связанные ADR/handoff:** ADR-0004, новый ADR-0005

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    ".env.example",
    ".gitignore",
    "content/README.md",
    "content/sets/moscow/v2/**",
    "content/tools/validate.test.mjs",
    "docs/agents/ARCHITECTURE.md",
    "docs/agents/decisions/0005-original-card-art-studio.md",
    "docs/agents/plans/active/20260729T161635Z-c08a8a-moscow-card-art-studio.md",
    "docs/agents/plans/archive/20260729T161635Z-c08a8a-moscow-card-art-studio.md",
    "docs/game/moscow-card-art-direction.md",
    "frontend/applications/web/app/assets/**",
    "frontend/applications/web/app/components/GameCard.vue",
    "frontend/applications/web/app/components/studio/**",
    "frontend/applications/web/app/pages/studio/**",
    "frontend/applications/web/nuxt.config.ts",
    "frontend/applications/web/package.json",
    "frontend/applications/web/server/api/studio/**",
    "frontend/applications/web/server/utils/cardStudio/**",
    "frontend/applications/web/test/**",
    "frontend/packages/contracts/src/**",
    "frontend/packages/contracts/test/**",
    "frontend/pnpm-lock.yaml"
  ],
  "components": [
    "frontend-workspace",
    "game-content",
    "pnpm:@munchkin/contracts",
    "pnpm:@munchkin/web",
    "repository-workflow"
  ],
  "contracts": [
    "card-studio:http-v1",
    "content:card-set-v1"
  ],
  "dependsOn": [
    "20260729T161631Z-fd0c88-moscow-core-content-pack"
  ],
  "sharedResources": [
    "card-studio:provider-v1",
    "content:card-set-v1",
    "content-set:moscow-core-v2",
    "frontend:server-runtime-config"
  ]
}
```

## Цель

Создать локальную web Card Studio для «Московского манчкина»: выбрать card из
готового v1 pack, составить короткий illustration brief, сгенерировать только
иллюстрацию через сменяемый AI provider, просмотреть/перегенерировать/одобрить
результат и собрать новую immutable visual version pack.

Рамка, типографика, stats и длинный `rules_text` остаются собственными
HTML/CSS/SVG-компонентами. AI не рисует готовую карту и не запекает текст:
растровый output занимает только illustration viewport.

## Критерии приёмки

- [x] Создана оригинальная Moscow visual system: разные Door/Treasure accents,
  собственная frame geometry, neutral typography и responsive card layout без
  копирования коммерческой рамки, логотипа, шрифта или trade dress.
- [x] Visual direction описывается высокоуровневыми признаками — сатирическая
  городская fantasy-зин графика, энергичный ink, collage/geometric metro
  motifs и ограниченная палитра — без имени живого художника, названия
  коммерческого продукта или требования «сделай в точности как оригинал».
- [x] `GameCard.vue` отображает illustration внутри frame viewport, а name,
  stats, `rules_text` и `flavor_text` — отдельным доступным HTML; layout
  остаётся читаемым при отсутствии image и в compact mode.
- [x] Dev-only route `/studio/cards` показывает все definitions Moscow v1,
  search/filter/status, editable illustration brief, compiled prompt,
  generation settings, preview history и явные Generate/Regenerate/Approve.
- [x] Provider API key и Card Studio token существуют только в server runtime
  config/env, передаются server-side, не попадают в client bundle, URL, logs,
  repository, error payload или provenance.
- [x] Studio по умолчанию выключена. Server routes требуют одновременно
  `CARD_STUDIO_ENABLED=true` и server-validated bearer token; game guest
  credential не даёт authoring rights.
- [x] Реализован закрытый provider interface и deterministic fake provider для
  CI. Первый real adapter использует OpenAI Image API с configurable model,
  default `gpt-image-2`, portrait output и server-side base64 decode.
- [x] Draft generation использует low quality, final — configurable
  medium/high. Request не содержит full rules text: только original card name,
  subject, setting, action, composition, palette, mood, exclusions и запрет
  text/logos/watermarks.
- [x] Generation работает как async job: UI не держит один request до двух
  минут, поддерживает polling, timeout, terminal error и retry без duplicate
  approval. Job metadata/staging images хранятся только в ignored local
  directory.
- [x] Каждая платная real generation запускается отдельным явным действием;
  автоматический bulk на 168 cards отсутствует. UI заранее показывает model,
  size/quality и предупреждение о внешнем API cost.
- [x] Approve атомарно переносит normalized `.webp` asset в
  `content/sets/moscow/v2/assets/`, создаёт alt text и provenance record с
  provider/model/settings/prompt hash/output SHA-256/request ID/timestamp, но
  без API key и персональных данных.
- [x] Moscow v1 никогда не перезаписывается. Studio собирает
  `moscow-core` version 2, пересчитывает digest и отказывается менять уже
  published identity с другим digest.
- [x] Asset filenames определяются allowlisted card IDs; path traversal,
  symlink escape, unexpected MIME, oversized response и invalid image bytes
  отклоняются до записи.
- [x] Fake-provider tests полностью offline и покрывают credential, provider,
  image, filesystem, jobs и approve boundaries.
- [x] По отдельному явному указанию пользователя выполнена одна встроенная
  ImageGen generation для выбранной card; asset одобрен без API key,
  credential, paid repository API call или логирования secret.
- [x] Production build работает при выключенной Studio и не требует
  `OPENAI_API_KEY`; game runtime не запускает генерацию и не зависит от
  external provider availability.

## Контекст и подтверждённое состояние

- Current content contract уже поддерживает local `.png/.jpg/.webp`,
  `image`, `alt_text` и safe pack-relative asset resolution.
- `GameCard.vue` сейчас показывает raw image перед text, без отдельной frame
  composition; длинный текст уже является HTML, а не частью bitmap.
- Nuxt app не имеет server routes или authoring auth; game backend обслуживает
  authoritative gameplay и не должен получать content-authoring network code.
- Поэтому Studio размещается в Nuxt/Nitro server boundary, а не в pure Go game
  engine или gameplay application.
- Официальная OpenAI Image guide на 2026-07-29 рекомендует Image API для
  одной генерации из одного prompt; `gpt-image-2` возвращает base64, принимает
  portrait sizes и WebP output. Complex requests могут занимать до двух минут,
  поэтому нужен async UX.
- `gpt-image-2` не поддерживает transparent background; frame overlay и
  controlled illustration viewport не зависят от transparency.
- Зависимый plan создаёт text-only `moscow-core@1`; этот plan создаёт v2 и не
  меняет published v1.

Официальные provider references:

- `https://developers.openai.com/api/docs/guides/image-generation`
- `https://developers.openai.com/api/docs/models/gpt-image-2`

## Scope

### Входит

- Original SVG/CSS frame и card presentation components.
- Dev-only Nuxt Card Studio UI и server routes.
- Provider interface, fake provider и OpenAI Image API adapter.
- Async local job/staging store, prompt compiler, approve workflow.
- Moscow v2 pack/assets/provenance manifest.
- Server-only env configuration, authoring token и security tests.
- Одна opt-in real generation выбранной illustration через встроенный ImageGen
  после отдельного явного указания пользователя.

### Не входит

- Копирование фона/рамки/рисовки/персонажей/шрифтов Munchkin.
- Prompt с именем конкретного живого художника или commercial style mimicry.
- Генерация rules text, logo, card title или stats внутри raster image.
- Автоматическая платная генерация всех 168 illustrations.
- Public production admin panel, OIDC/RBAC, shared cloud queue или object
  storage.
- Print-ready PDF, bleed/crop marks, CMYK и типографский export.
- Изменение gameplay mechanics, Go engine или `game:http-v1`.
- Image moderation как доказательство copyright/originality.

## Архитектурный подход

- Browser вызывает только typed Nitro endpoints. Server validates authoring
  bearer token, card ID и generation settings, компилирует prompt и вызывает
  provider; client никогда не видит provider credential.
- Provider interface принимает нормализованный request и возвращает bytes,
  MIME, request ID и model metadata. Fake adapter детерминирован; OpenAI
  adapter использует official SDK и Image API, но не влияет на CI.
- Job state и raw candidates живут под ignored `.card-studio/` с atomic JSON
  writes. UI poll-ит typed status; restart может восстановить terminal/pending
  metadata либо явно пометить interrupted job.
- Prompt строится из отдельного art brief, а не из полного rules text.
  Negative constraints запрещают слова, рамку, UI, watermark и copied IP.
- Approve декодирует/проверяет bytes, нормализует WebP, вычисляет SHA-256,
  пишет asset/provenance и создаёт/обновляет только draft v2. Перед write
  проверяется expected source v1 digest и отсутствие published v2 conflict.
- Frame создаётся code-native SVG/CSS. AI output не используется для borders,
  typography или logos, поэтому единый visual identity не зависит от
  межгенерационной consistency.
- Studio routes исключаются/deny-by-default при disabled config. Это локальный
  authoring tool, не часть guest gameplay surface.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| game-content | Moscow v2 assets/provenance/digest | `content:card-set-v1`, `moscow-core@2` |
| pnpm:@munchkin/contracts | Typed Studio requests/jobs/errors | `card-studio:http-v1` |
| pnpm:@munchkin/web | Frame, Studio UI, Nitro provider boundary | Server-only authoring surface |
| repository-workflow | env/ignore, ADR, art direction, plan | Secret/staging/copyright boundary |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `.env.example` | write | Документировать server-only Studio/provider env |
| `.gitignore` | write | Исключить local jobs/raw candidates |
| `content/README.md` | write | Visual version/provenance workflow |
| `content/sets/moscow/v2/**` | write | Immutable visual pack, assets, provenance |
| `content/tools/validate.test.mjs` | write | Moscow v2 asset/digest fixtures |
| `docs/agents/ARCHITECTURE.md` | write | Отделить authoring Studio от gameplay |
| `docs/agents/decisions/0005-original-card-art-studio.md` | write | Provider/frame/versioning decision |
| `docs/agents/plans/active/20260729T161635Z-c08a8a-moscow-card-art-studio.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260729T161635Z-c08a8a-moscow-card-art-studio.md` | write | Archived lifecycle плана |
| `docs/game/moscow-card-art-direction.md` | write | Original style/prompt/provenance guide |
| `frontend/applications/web/app/assets/**` | write | Frame SVG/CSS visual tokens |
| `frontend/applications/web/app/components/GameCard.vue` | write | Frame + separate illustration viewport |
| `frontend/applications/web/app/components/studio/**` | write | Studio controls/previews/status |
| `frontend/applications/web/app/pages/studio/**` | write | Dev-only authoring route |
| `frontend/applications/web/nuxt.config.ts` | write | Private runtime config/feature flag |
| `frontend/applications/web/package.json` | write | Server provider/image dependencies |
| `frontend/applications/web/server/api/studio/**` | write | Authenticated typed Nitro endpoints |
| `frontend/applications/web/server/utils/cardStudio/**` | write | Jobs/provider/prompt/asset services |
| `frontend/applications/web/test/**` | write | UI/server/fake-provider/security tests |
| `frontend/packages/contracts/src/**` | write | Shared Studio wire schema |
| `frontend/packages/contracts/test/**` | write | Closed request/response fixtures |
| `frontend/pnpm-lock.yaml` | write | Exact workspace dependency update |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `content-set:moscow-core-v2` | Moscow content plan | этот plan | Только после immutable v1 |
| `content:card-set-v1` | Moscow content plan | не меняется | consume existing image fields |
| `frontend:server-runtime-config` | нет | этот plan | secrets server-only, disabled default |
| `card-studio:provider-v1` | нет | этот plan | fake CI + OpenAI first adapter |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-29 19:21 MSK через `leinoctl context`.
- **Обнаруженные пересечения:** `content/README.md`,
  `content/tools/validate.test.mjs` и Moscow identity зависят от content plan.
- **Решение:** explicit `dependsOn`; этот plan не выбирается и не реализуется,
  пока `20260729T161631Z-fd0c88-moscow-core-content-pack` не completed/archive.

## План реализации

1. [x] Зафиксировать ADR-0005, original visual tokens, art-direction schema,
   prompt policy и immutable v1→v2 workflow.
2. [x] Создать code-native Door/Treasure frame и адаптировать `GameCard.vue`
   с доступным HTML text и illustration viewport.
3. [x] Добавить closed Studio contracts, disabled-by-default runtime config,
   bearer authoring guard и path/MIME/size validation.
4. [x] Реализовать prompt compiler, fake provider и OpenAI Image API adapter
   без client-side secrets.
5. [x] Реализовать async local jobs, polling/history/retry и atomic ignored
   staging.
6. [x] Реализовать Card Studio UI и approve pipeline в Moscow v2 с
   provenance/digest validation.
7. [x] Выполнить offline tests/build/browser smoke.
8. [x] По отдельному явному указанию пользователя заменить credential/cost
   gate на одну встроенную ImageGen generation и approve.
9. [x] Выполнить canonical verify/scope-check, записать результаты и
   архивировать plan.

## Проверки

- [x] Contracts reject unknown fields, arbitrary provider/model/path и secrets.
- [x] Fake provider generation, retry, interrupted job и idempotent approve.
- [x] Auth tests: disabled, missing/wrong token, no secret in payload/log.
- [x] Path traversal, symlink escape, MIME, size и invalid-byte negative tests.
- [x] Prompt snapshot не содержит full rules text, commercial style names,
  card-frame instructions, embedded text/logo/watermark requests.
- [x] Moscow v1 unchanged; v2 assets/provenance hashes/digest validate.
- [x] `node content/tools/validate.mjs content/sets/moscow/v2/cards.json`.
- [x] `(cd frontend && pnpm lint)`.
- [x] `(cd frontend && pnpm check)`.
- [x] `(cd frontend && pnpm build)` без Studio env/API key.
- [x] Native dev Card Studio browser smoke с fake provider.
- [x] Один built-in ImageGen smoke выполнен без API key и paid repository API
  call; call ID записан без credential.
- [x] Game browser smoke подтверждает frame/image/text и отсутствие Studio
  routes при disabled config.
- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed`.
- [x] `./leinoctl scope-check --plan 20260729T161635Z-c08a8a-moscow-card-art-studio`.
- [x] Финальный `git diff --check`, diff review и `git status --short`.

## Риски и откат

- **Риск:** visual result слишком похож на commercial trade dress.
  **Снижение:** code-native original frame, high-level Moscow zine direction,
  запрет commercial/artist style names и human review.
- **Риск:** API key или paid endpoint окажется доступен guest client.
  **Снижение:** Nitro server-only config, disabled default, separate bearer
  authoring token, payload/log tests и отсутствие browser provider SDK.
- **Риск:** latency/retry создаст duplicate paid calls.
  **Снижение:** explicit generate, client request ID, server job idempotency,
  terminal status и retry как новое подтверждённое действие.
- **Риск:** web tool повредит immutable pack или запишет произвольный path.
  **Снижение:** v1 read-only, v2 draft gate, expected digest, allowlisted IDs,
  atomic writes, symlink/path checks и validator before approve.
- **Риск:** 168 generated images создадут неконтролируемую стоимость и
  непоследовательность.
  **Снижение:** bulk отсутствует; low-quality draft, one-card review loop,
  frame несёт общую identity независимо от art.
- **Риск:** current provider/model/API изменится.
  **Снижение:** provider adapter и configurable model; official docs
  перепроверяются при implementation, alias не попадает в content digest.
- **Откат:** выключить `CARD_STUDIO_ENABLED`, удалить ignored staging и
  отменить v2/source UI patch обычным revert. v1 и gameplay state не меняются;
  одобренные assets восстанавливаются из Git.

## Открытые вопросы

- Repository OpenAI Image API adapter остаётся реализованным и проверенным
  offline, но acceptance этого plan больше не зависит от `OPENAI_API_KEY`:
  пользователь явно заменил paid API smoke встроенным ImageGen.
- Генерация остальных 167 final illustrations остаётся последующей управляемой
  authoring работой через Studio, а не автоматическим acceptance step.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-29 19:21 MSK
- **Подтверждено:** 2026-07-29 19:36 MSK
- **Формулировка согласования:** «Согласовываю планы 2 и 3».
- **Повторное явное согласование:** «Согласовываю план
  20260729T161635Z-c08a8a-moscow-card-art-studio. Делай».
- **Явная замена paid API smoke:** «Так у тебя есть imagen собственный, сделай
  через него».
- **Формулировка/ограничения пользователя:** после commit/push начать следующие
  планы; использовать собственную рамку и иллюстрацию; генерировать art по
  короткому описанию; длинный русский текст выводить отдельно в web UI;
  исходную коммерческую рамку/стиль не копировать.

## Ход выполнения

- Draft создан атомарно после read-only исследования current Nuxt/content
  boundaries и официальной OpenAI Image API документации.
- Пользователь явно согласовал plan 2026-07-29 формулировкой
  «Согласовываю планы 2 и 3».
- Пользователь повторно явно согласовал точный plan ID 2026-07-29 формулировкой
  «Согласовываю план 20260729T161635Z-c08a8a-moscow-card-art-studio. Делай».
- Зависимый plan `20260729T161631Z-fd0c88-moscow-core-content-pack` завершён,
  архивирован и опубликован в `main` commit `cbae587`.
- Lifecycle принят текущей execution-session через явный
  `leinoctl plan select --takeover` после проверки handoff: прежняя session
  оставила только согласованный plan-файл и не начинала implementation writes.
- Пользователь явно заменил cost-gated repository API smoke встроенным
  ImageGen. Сгенерирован original illustration-only portrait без card frame,
  текста, logos и commercial trade dress; результат визуально проверен и
  одобрен в `content/sets/moscow/v2/assets/yard-evacuator.webp`.

## Итог

Реализация и все offline acceptance steps завершены:

- dev Card Studio загрузила 168 definitions, скомпилировала prompt и прошла
  полный deterministic fake-provider flow; затем встроенный ImageGen создал
  final illustration, атомарно принятую как
  `assets/yard-evacuator.webp` в draft `moscow-core@2`;
- v2 digest
  `sha256:6921d914f296fe4bb87cceb69faf2131849e256c56e344bd55a50d3320d4d1f7`,
  provenance output SHA-256 и immutable source v1 проверены validator tests;
- final WebP имеет размер 1024x1536, вес 745104 bytes и SHA-256
  `9c5deb8e2fe695e40362d58d97403f102ce375fe2916b6940290e1576d1d2083`;
  provenance сохраняет `codex-imagegen-built-in`, quality `unexposed` и call ID
  `codex-imagegen-call_wUnBZi0LEEWTnAyLaheuE9Ke`;
- approve теперь сериализуется crash-safe OS-owned loopback lock и directory
  transaction с full-state digest; regression tests закрывают concurrent
  approvals/jobs, same-alt regeneration, interrupted swap, incomplete draft,
  source/mechanics/asset drift и published immutability;
- contracts: 7/7 tests; web: 37/37 tests; content: 23/23 tests; полный Go,
  Codex hooks и leinoctl suites прошли;
- повторный `./leinoctl verify --changed` после ImageGen asset и финального
  provenance-инварианта прошёл на Node 24.14.0; финальный adversarial diff
  review дал GO без findings;
- финальные text-check, plan-lint, scope-check (`outsideWriteSet: []`) и
  `git diff --check` прошли;
- production Nuxt build прошёл на Node 24 с выключенной Studio и без
  `OPENAI_API_KEY`; `/studio/cards` и `/api/studio/cards` возвращают 404;
- game browser smoke на Moscow v2 подтвердил Door/Treasure frame, compact
  fallback, отдельные accessible name/stats/rules text и чистую console.

Paid repository API smoke по явному указанию пользователя заменён встроенным
ImageGen и не блокирует acceptance. Финальные canonical verify, text-check,
plan-lint, scope-check (`outsideWriteSet: []`) и `git diff --check` прошли;
plan завершён и архивирован.
