# Card content

`content/` содержит versioned data packs. Игровой движок никогда не исполняет
текст карты или произвольное выражение: mechanics задаются только закрытыми
typed-полями, которые явно поддержаны schema, Node validator и Go registry.

Committed `demo-original` — небольшой оригинальный набор с вымышленными
названиями и CC0-заглушками. Это не копия коммерческой колоды.

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
2. будущий committed оригинальный набор «Московский манчкин»;
3. локальный `content/reference-local/`, который игнорируется Git и никогда не
   импортируется runtime, digest tooling или committed tests.

В локальном First Edition index допустимы ordinal, deck, публичное название,
source locator, нейтральный пересказ механики, mechanic tags, interaction
classification, registry coverage и поля статуса будущей адаптации. Там
запрещены scans, изображения, оригинальный rules text, готовые переводы,
логотипы, шрифты, trade dress и бинарные вложения.

Механическая база может использовать официальные правила как reference, но
названия, тексты, рамка и иллюстрации будущего Moscow pack создаются заново.
