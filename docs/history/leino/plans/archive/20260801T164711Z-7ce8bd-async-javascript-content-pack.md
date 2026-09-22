# PLAN: async javascript content pack

- **Plan ID:** `20260801T164711Z-7ce8bd-async-javascript-content-pack`
- **Статус:** completed
- **Создан:** 2026-08-01 16:47:11 UTC
- **Обновлён:** 2026-08-01 17:34:00 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** нет
- **Блокирует:** нет
- **Связанные ADR/handoff:** —

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "content/sets/async-javascript/cards.json",
    "docs/agents/plans/active/20260801T164711Z-7ce8bd-async-javascript-content-pack.md",
    "docs/agents/plans/archive/20260801T164711Z-7ce8bd-async-javascript-content-pack.md"
  ],
  "components": ["game-content"],
  "contracts": ["content/schema/card-set.schema.json"],
  "dependsOn": [],
  "sharedResources": []
}
```

## Цель

Добавить в репозиторий новый самостоятельный JSON-пак `async-javascript` для
карточной игры по презентации «Асинхронность в JavaScript». Пак должен быть
самодостаточным, валидироваться существующей схемой и включать полный v1-набор
игровых сущностей: Утя, Заврик, Мастер Манул и Мастер Панда как расы;
асинхронные классы; монстров по темам браузерной асинхронности, Promise и
async/await; сокровища; проклятия и карты разового действия.

## Критерии приёмки

- [x] Создан только новый контентный файл `content/sets/async-javascript/cards.json`;
  существующие паки, движок, фронтенд и устаревшие требования к иллюстрациям не
  изменены.
- [x] Пак содержит 75 уникальных определений карт: 22 монстра, 10 проклятий,
  6 классов, 4 расы, 17 предметов, 14 одноразовых сокровищ и 2 карты повышения
  уровня; `copies` задаёт фактическую плотность колоды.
- [x] Все игровые правила выражены поддержанными schema-native tags,
  modifiers, abilities и effects; в тексте карт нет механик, которых JSON не
  может выполнить.
- [x] `content_digest` соответствует содержимому и записан в формате
  `sha256:<64 hex>`.
- [x] Проходят `content/tools/digest.mjs`, `content/tools/validate.mjs`,
  тесты валидатора и релевантные Go-тесты backend game.

## Контекст и подтверждённое состояние

- `content/README.md` и `content/schema/card-set.schema.json` описывают JSON
  как источник игровых данных; отдельной регистрации нового пака не требуется:
  загрузчик принимает путь к файлу через `GAME_CONTENT_PATH`.
- Существующая схема поддерживает нужные типы `monster`, `curse`, `class`,
  `race`, `item`, `one_shot` и `level_up`, а также условные модификаторы по
  тегам персонажа/монстра и ограниченный набор эффектов.
- Темы взяты из PDF: Event Loop и очереди, rAF/rIC, SOP и postMessage,
  structured clone и transferable objects, SharedArrayBuffer/Atomics,
  MessageChannel/BroadcastChannel/Workers, состояния и цепочки Promise,
  обработка ошибок, finally, combinators, promisify, async/await и
  параллелизм.
- Сгенерированная иллюстрация Ути не включается в этот JSON-пак: визуальный
  стиль нового дизайна ещё не утверждён, а текущая задача ограничена
  переносом пака в JSON.

## Scope

### Входит

- Новый файл `content/sets/async-javascript/cards.json` с метаданными,
  digest и полным набором карт на русском языке.
- Четыре расы: Утя, Заврик, Мастер Манул, Мастер Панда.
- Шесть классов: Диспетчер Event Loop, Алхимик Promise, Инженер Web Worker,
  Переговорщик MessageChannel, Оптимизатор рендера, Отладчик Rejection.
- Монстры, сокровища, проклятия и одноразовые карты, покрывающие темы PDF.
- Валидация и проверка совместимости без изменения runtime-контрактов.

### Не входит

- Иллюстрации, ассеты и любые решения по новому визуальному стилю карточек.
- Изменения backend/frontend, схемы карт, правил игры или загрузчика контента.
- Изменение существующих published packs.
- Публикация, push или подключение пака к окружению вместо передачи пути через
  `GAME_CONTENT_PATH`.

## Архитектурный подход

- Собрать один immutable pack с `set_id: "async-javascript"` и `version: 1`.
  Использовать текущий repo-конвенционный `author: "L1TTL3H0rSE"`,
  `license: "All-Rights-Reserved"` и источник
  `original-async-javascript-card-game-2026`, если пользователь не укажет
  другие значения.
- Использовать стабильные kebab-case IDs. Тематические способности классов и
  рас моделировать существующими tag-conditioned modifiers и
  `discard_for_combat`; плохие последствия монстров и проклятия — только
  поддержанными effects.
- Для первой версии оставить карточки текстовыми: поля изображения не
  добавлять до утверждения арт-направления.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| `game-content` | Добавляется новый JSON-пак | `content/schema/card-set.schema.json`; loader получает файл через `GAME_CONTENT_PATH` |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `content/sets/async-javascript/cards.json` | write | Новый JSON-пак, основная реализация |
| `docs/agents/plans/active/20260801T164711Z-7ce8bd-async-javascript-content-pack.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260801T164711Z-7ce8bd-async-javascript-content-pack.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| Нет | — | — | — |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-01 16:47:11 UTC
- **Обнаруженные пересечения:** активного плана, владеющего
  `content/sets/async-javascript`, не найдено; пересечений с текущими
  frontend/backend-планами нет.
- **Решение:** новый pack-only write set; не менять shared schema, loader или
  существующие наборы.

## План реализации

1. [x] После явного подтверждения пользователя создать JSON-пак с 75
   определениями карт и проверить структуру/ID/копии.
2. [x] Посчитать и записать `content_digest` штатным инструментом digest.
3. [x] Запустить schema/content validation, тесты валидатора, релевантные
   backend game-тесты и `git diff --check`.
4. [x] Выполнить `leinoctl verify --changed` и
   `leinoctl scope-check --plan 20260801T164711Z-7ce8bd-async-javascript-content-pack`.
5. [x] Перевести план в release/archive lifecycle и подготовить локальный
   результат; push не выполнять.

## Проверки

- [x] `node content/tools/digest.mjs content/sets/async-javascript/cards.json --write` —
  `sha256:995c78b19ad803e5d3808653673d104690d705c28506c113cb75c5299c071197`.
- [x] `node content/tools/validate.mjs content/sets/async-javascript/cards.json` —
  75 definitions, 62 Door copies, 61 Treasure copies.
- [x] `node --test content/tools/validate.test.mjs` — 24 passed, 5 skipped;
  `TMPDIR=/private/tmp` нужен для clean-copy guard на macOS.
- [x] `go test ./...` из `backend/game` — все пакеты passed.
- [x] `git diff --check` — whitespace issues не обнаружены.
- [x] `./leinoctl verify --changed` — passed с bundled Node, системным Go и
  `TMPDIR=/private/tmp`.
- [x] `./leinoctl scope-check --plan 20260801T164711Z-7ce8bd-async-javascript-content-pack` —
  outsideWriteSet пуст; новый JSON отмечен как unledgered shell path, но scope
  полностью совпадает с write set.

## Риски и откат

- **Риск:** часть игровых формулировок может быть шире, чем исполняемая
  механика; это контролируется закрытой схемой и текстовой сверкой всех карт.
  Автор и лицензия взяты из repo-конвенции как значения по умолчанию.
- **Откат:** удалить только новый `content/sets/async-javascript/cards.json`
  до публикации; существующие паки и runtime не затрагиваются.

## Открытые вопросы

- Если нужен другой владелец контента или лицензия, заменить значения до
  создания файла; по умолчанию используются `L1TTL3H0rSE` и
  `All-Rights-Reserved`.
- Иллюстрации и их формат вынести в отдельный следующий проход после принятия
  нового дизайна.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-01 16:47:11 UTC
- **Подтверждено:** 2026-08-01 17:22:26 UTC
- **Формулировка/ограничения пользователя:** «подтверждаю» — согласован
  точный plan ID и описанный scope; старые требования к изображениям не
  применять, сгенерированную иллюстрацию Ути в JSON-пак не включать.

## Ход выполнения

- Approval пользователя записан; JSON-пак создан, провалидирован и проверен.

## Итог

Реализован новый `async-javascript` pack: 75 card definitions, 123 physical
copies, digest `sha256:995c78b19ad803e5d3808653673d104690d705c28506c113cb75c5299c071197`.
Изменения ограничены новым JSON и lifecycle-файлом плана; изображения не
добавлялись.
