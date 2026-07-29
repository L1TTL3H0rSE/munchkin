# ADR-0003: Content pack and licensing boundary

- **Статус:** accepted
- **Дата:** 2026-07-29

## Контекст

Игровые механики можно реализовать независимо от конкретных card texts и art.

## Решение

Pack является closed versioned JSON data:

- identity: `set_id`, integer version, canonical SHA-256 digest;
- provenance: author, license, source;
- presentation: original name/text/local image/alt text;
- mechanics: только зарегистрированные typed fields.

Unknown fields/effects, remote/absolute/traversing assets, symlink escape и
digest drift отклоняются. Игра фиксирует set/version/digest на всём lifecycle.

Checked-in demo содержит только придуманные CC0 placeholders..

## Последствия

Пользователь может независимо создавать и лицензировать fan pack, не меняя
engine architecture. Любое изменение опубликованного набора создаёт новую
version. Лицензия pack не определяет лицензию исходного кода.
