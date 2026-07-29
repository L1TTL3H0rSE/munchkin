# Дополнительные правила для content

Content packs являются данными, а не исполняемым кодом.

- Каждый pack содержит immutable `set_id`, integer `version`, `author`,
  `license`, `source`, cards и ожидаемый digest.
- Изменение уже используемого `(set_id, version)` запрещено: создай следующую
  version.
- Card IDs уникальны внутри set. Effect kind выбирается только из закрытого
  registry engine.
- Validator отклоняет unknown fields/effects, duplicate IDs, абсолютные paths,
  `..`, symlink escape и assets вне pack.
- Не добавляй JavaScript/Lua expressions, templates с eval или remote asset
  URLs.
- Demo pack использует только invented identifiers, тексты и визуальные
  placeholders.

Проверка:

```bash
node content/tools/validate.mjs content/sets/demo/cards.json
```

Изменение schema/effect registry требует проверки backend consumer и
frontend presentation:

```bash
./leinoctl verify --paths content/<changed-path>
```
