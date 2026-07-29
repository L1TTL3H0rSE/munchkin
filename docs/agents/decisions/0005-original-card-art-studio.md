# ADR-0005: Original card art studio

- **Статус:** accepted
- **Дата:** 2026-07-29

## Контекст

`moscow-core@1` является immutable text-only pack. Для иллюстраций нужен
повторяемый local workflow, который не отдаёт provider credential браузеру,
не смешивает authoring с authoritative gameplay и не запекает длинный русский
текст в raster.

Готовая карта, имитирующая узнаваемую коммерческую рамку или манеру конкретного
художника, нарушила бы content boundary даже при оригинальной механике.
Массовый платный запуск также создаёт неконтролируемую стоимость и слабую
визуальную согласованность.

## Решение

В Nuxt/Nitro вводится disabled-by-default Card Studio с отдельным server-side
bearer token. Browser выбирает существующий allowlisted card ID, редактирует
короткий illustration brief и запускает ровно одну generation. Provider
выбирается server config; CI использует deterministic fake, первый real
adapter — OpenAI Image API.

Generation является persisted async job. Staging находится только в ignored
local directory. Request ID связан с canonical fingerprint, поэтому повтор
одного intent не создаёт второй provider call. Retry и Regenerate — новые
явные действия.

Provider возвращает только illustration candidate. Server проверяет declared
MIME и magic bytes, limits, decode и dimensions, затем нормализует результат в
portrait WebP. Approve строит filename из card ID, пишет asset атомарно и
обновляет draft `moscow-core@2` с alt text, digest и provenance sidecar.
Published identity с другим digest не перезаписывается.

Frame является самостоятельной CSS/SVG-системой: асимметричная городская
геометрия, разные Door/Treasure accents, neutral system typography и отдельный
viewport. Name, stats, `rules_text` и `flavor_text` остаются доступным HTML.
`compileCardArtPrompt` автоматически добавляет один immutable
provider-agnostic master: hand-inked humorous fantasy cartoon, выразительные
pose/expression, одна читаемая visual joke, плоский ограниченный цвет и простой
фон. Пользователь меняет только original name context и семь полей art brief;
provider/model не меняют prompt semantics. Compiler отдельно закрепляет
portrait `1024x1536`, crop-safe margins и запреты embedded text, logos,
watermarks, card borders, stats/UI, artist imitation и commercial trade dress.

## Последствия

Gameplay и production build не зависят от provider availability или
`OPENAI_API_KEY`. Реальный вызов невозможен без feature flag, authoring token,
configured key и отдельного пользовательского подтверждения стоимости.

Version 1 остаётся неизменной. Draft version 2 можно собирать по одной карте;
после публикации дальнейший art создаёт следующую content version. Print
export, public admin auth, cloud queue/storage и автоматический bulk остаются
за пределами решения.
