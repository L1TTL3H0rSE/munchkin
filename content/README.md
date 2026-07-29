# Card content

`content/` contains data packs. The game engine never executes expressions
from a card: every rule is represented by a closed, typed field understood by
the engine.

The checked-in `demo-original` set is deliberately small and uses invented
names and CC0 placeholders. It is not a copy of a commercial Munchkin set.

## Create your fan set

1. Copy `sets/demo` to a new directory.
2. Choose a new immutable `set_id` and start at `version: 1`.
3. Record the actual `author`, `license` and `source`.
4. Put local images under that set's `assets/` directory.
5. Reference an image as `assets/cards/my-card.webp` and always provide
   `alt_text`.
6. Add optional `rules_text` and `flavor_text`. Mechanical behavior still has
   to use supported typed fields such as `combat_strength`, `treasure_count`
   and `level_loss`.
7. Recalculate `content_digest`, then validate the file.

Only `.avif`, `.jpg`, `.jpeg`, `.png` and `.webp` repository-relative image
paths are accepted. Absolute paths, remote URLs, `..`, backslashes and symlink
escapes are rejected.

## Recalculate a digest

Print the digest without changing a file:

```bash
node content/tools/digest.mjs content/sets/my-set/cards.json
```

Write it back and format the JSON:

```bash
node content/tools/digest.mjs content/sets/my-set/cards.json --write
```

Then validate:

```bash
node content/tools/validate.mjs content/sets/my-set/cards.json
```

A published `(set_id, version, content_digest)` identifies immutable content.
Any card change requires a new version and a new digest.