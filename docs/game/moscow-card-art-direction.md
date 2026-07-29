# Visual direction: `moscow-core`

Этот документ задаёт самостоятельную визуальную систему и prompt boundary для
illustration viewport. Он не описывает механику и не разрешает переносить
presentation text в raster.

## Визуальный язык

- оригинальный hand-inked humorous fantasy cartoon;
- живой неровный ink-контур и крупный читаемый силуэт;
- выразительные pose и expression главного персонажа;
- одна ясная visual joke, считываемая без подписи;
- плоская ограниченная палитра с минимальной штриховкой;
- простой незагромождённый фон и свободные края для безопасного crop;
- дружелюбный городской абсурд вместо реалистичной жестокости или унижения.

Эта грамматика автоматически добавляется compiler и не редактируется отдельно
для каждой карты. Московские персонажи, реквизит и окружение приходят из
семипольного brief. Door/Treasure accents принадлежат code-native frame:
лаймовый маршрутный акцент и резкая диагональ для Door, кирпичный/медный
акцент и круговые жетоны для Treasure. Это собственные UI tokens, а не
воспроизведение чужой рамки, логотипа, шрифта или trade dress.

## Illustration brief

Для каждой карты Studio принимает только:

1. `subject` — кто или что является главным объектом;
2. `setting` — оригинальная городская сцена;
3. `action` — одно видимое действие;
4. `composition` — ракурс, силуэт и распределение пространства;
5. `palette` — подмножество общей палитры;
6. `mood` — эмоциональный тон;
7. `exclusions` — дополнительные запреты.

Эти семь полей являются единственной редактируемой per-card вариацией.
Полный `rules_text`, gameplay effects, filesystem path и provider credential в
prompt не входят. Original card name используется как короткий контекст, но
модель не должна рисовать его буквами.

## Prompt policy

`compileCardArtPrompt` всегда сначала добавляет неизменяемый visual master из
раздела выше. Он одинаков для fake, встроенной ImageGen и token-backed
generation, не содержит provider/model names и не требует воспроизводить
существующую иллюстрацию или trade dress.

После master compiled prompt всегда добавляет:

- opaque portrait `1024x1536` illustration viewport без внешней рамки;
- один главный объект и generous crop-safe margins для важных деталей;
- no words, letters, numbers, captions, logos, trademarks or watermarks;
- no card border, stat boxes, UI, typography or finished-card layout;
- no imitation of a named artist, existing tabletop product or commercial
  trade dress;
- original characters, props and city details only;
- безопасные края и читаемый силуэт после crop.

Studio отклоняет brief с формулировками «в стиле», `in the style of`,
«как у художника», `trade dress`, заблокированным product keyword или
требованием что-либо скопировать. Независимо от brief compiler добавляет hard
exclusions против встроенного текста, логотипов, рамки и имитации продукта.
Модерация provider не считается доказательством оригинальности: approve
остаётся осознанным human review.

## Frame и доступность

Frame строится code-native CSS/SVG. Raster занимает только viewport с
фиксированным aspect ratio. Name, kind, stats, `rules_text` и `flavor_text`
являются отдельными semantic HTML nodes. При отсутствии изображения
показывается нейтральный геометрический fallback с доступным label; compact
mode сохраняет name, stats и rules.

## Generation workflow

- Draft: `quality=low`, portrait `1024x1536`.
- Final review: `quality=medium|high`, тот же portrait viewport.
- Один Generate/Regenerate создаёт один job и один provider request.
- Candidate проверяется и нормализуется в WebP до preview.
- Approve требует alt text, фиксирует prompt/output hashes и обновляет только
  draft следующей version.
- Bulk generation отсутствует.
