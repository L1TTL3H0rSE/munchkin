# Card content

`content/` содержит versioned data packs. Игровой движок никогда не исполняет
текст карты или произвольное выражение: mechanics задаются только закрытыми
typed-полями, которые явно поддержаны schema, Node validator и Go registry.

Committed `demo-original` — небольшой оригинальный набор с вымышленными
названиями и CC0-заглушками. Это не копия коммерческой колоды.

## Московский core pack

`sets/moscow/v1/cards.json` — первый полный оригинальный русскоязычный набор:

- immutable identity `moscow-core@1`;
- автор `L1TTL3H0rSE`, лицензия `All-Rights-Reserved`, source
  `original-moscow-core-2026`;
- 168 отдельных definitions с `copies: 1`: 95 Door и 73 Treasure;
- 152 active slots (84 Door + 68 Treasure) и 16 полностью описанных
  `other_players` slots (11 Door + 5 Treasure);
- text-only presentation без `image` и `alt_text`.

Все девять card kinds, все закрытые effect kinds и основные modifier/condition
branches покрыты pack-specific Node и Go conformance tests. Терминология, тон,
distribution matrix и originality checklist зафиксированы в
[`docs/game/moscow-content-style-guide.md`](../docs/game/moscow-content-style-guide.md).

Digest и validation:

```bash
node content/tools/digest.mjs content/sets/moscow/v1/cards.json
node content/tools/validate.mjs content/sets/moscow/v1/cards.json
node --test content/tools/validate.test.mjs
```

Чтобы запустить backend на этой immutable версии из `backend/game`:

```powershell
$env:GAME_CONTENT_PATH = "../../content/sets/moscow/v1/cards.json"
go run ./cmd/server
```

Следующая версия с illustration assets создаётся отдельно. После использования
`moscow-core@1` не редактируется задним числом.

### Visual authoring и provenance

Локальная Card Studio читает immutable `moscow-core@1`, но записывает только
draft `moscow-core@2`. Illustration brief не содержит `rules_text`: в provider
уходят original card name, subject, setting, action, composition, palette,
mood и exclusions. Рамка, типографика, stats и тексты остаются code-native
HTML/CSS/SVG.

Одобренный raster сначала декодируется с лимитом размера и пикселей, затем
нормализуется в portrait WebP. Имя файла строится только из существующего
card ID: `assets/<card-id>.webp`. Sidecar `provenance.json` хранит provider,
model, quality/size, prompt hash, output SHA-256, provider request ID и время,
но никогда не содержит credential, raw provider response или персональные
данные.

Version 2 остаётся изменяемым authoring draft, пока provenance manifest явно
имеет `status: "draft"`. После `status: "published"` Studio отказывается
перезаписывать `(set_id, version)` с другим digest; следующие изменения
получают новую version. Runtime не должен выбирать draft pack.

Studio по умолчанию выключена. Её local jobs и candidates находятся в
ignored `.card-studio/`; guest game credential не является authoring token.
Fake provider работает полностью offline, а каждый вызов real provider
требует отдельного явного действия и видимого предупреждения о стоимости.

## Definitions и instances

JSON pack хранит `CardDefinition`. Обязательные поля каждой definition:

- `id`, `name`, `deck`, `kind`;
- `copies` — сколько уникальных instances материализуется из definition;
- `interaction_scope`: `none`, `self` или `other_players`.

При создании игры backend создаёт отдельный immutable `CardInstance` для каждой
копии. Instance ID перемещается между ровно одной из zones; definition и её
presentation/mechanics при этом не дублируются в state.

Profile `first-edition-core-v1` не поддерживает вмешательство в чужой ход.
Definition с `interaction_scope: other_players` валидируется и может оставаться
в pack для будущего профиля, но сейчас не материализуется в deck. Она не должна
превращаться в доступную карту без эффекта.

## Закрытая модель mechanics

Поддерживаемые `kind`: `monster`, `curse`, `class`, `race`,
`trait_attachment`, `item`, `one_shot`, `level_up`, `cheat`.

Kind-specific specs описывают:

- Monster strength, levels/treasures, pursuit, tags, conditional modifiers,
  automatic outcomes и typed Bad Stuff;
- Item slot/hands, Big/Small, value, bonuses, restrictions и modifiers;
- Class/Race-like traits, registered tags, tie-win/Big allowance, modifiers и
  discard-cost abilities;
- multi-trait attachment;
- закрытый список effects: gain/lose level, combat/escape/hand/reward modifier,
  discard по allowlisted selector, character-tag change, death, draw и
  persistent tie-win.

Unknown fields, kind-specific поля в неверном месте, незарегистрированные
effects/selectors/conditions и invalid ranges отклоняются fail-closed. Добавить
новую механику означает синхронно расширить schema, semantic validator, Go
registry и tests; `rules_text` не является fallback-интерпретатором.

## Presentation и assets

`rules_text`, `flavor_text`, `name`, `image` и `alt_text` отвечают только за
отображение. Длинный текст остаётся HTML в интерфейсе и не запекается в
изображение.

Разрешены только repository-relative `.avif`, `.jpg`, `.jpeg`, `.png` и
`.webp` внутри директории конкретного set. Absolute/remote paths, `..`,
backslashes, empty segments и symlink escape отклоняются.

## Создание оригинального набора

1. Скопируйте `sets/demo` в новую директорию.
2. Выберите новый immutable `set_id` и начните с `version: 1`.
3. Укажите фактические `author`, `license` и `source`.
4. Создайте definitions и задайте количество через `copies`.
5. Поместите локальные изображения в `assets/` этого set и добавьте `alt_text`.
6. Задайте mechanics только зарегистрированными typed-полями.
7. Рассчитайте digest и провалидируйте pack.

```bash
node content/tools/digest.mjs content/sets/my-set/cards.json --write
node content/tools/validate.mjs content/sets/my-set/cards.json
```

Без `--write` digest tool только печатает рассчитанное значение. Опубликованный
`(set_id, version, content_digest)` неизменяем: любое изменение definition
требует новой version и нового digest.

## Граница reference-материалов

Проект разделяет три слоя:

1. committed оригинальный `demo-original`;
2. committed оригинальный набор `moscow-core@1`;
3. локальный `content/reference-local/`, который игнорируется Git и никогда не
   импортируется runtime, digest tooling или committed tests.

В локальном First Edition index допустимы ordinal, deck, публичное название,
source locator, нейтральный пересказ механики, mechanic tags, interaction
classification, registry coverage и поля статуса будущей адаптации.

Механическая база может использовать официальные правила как reference, но
названия и тексты Moscow pack созданы заново; будущие рамка и иллюстрации также
создаются независимо.
