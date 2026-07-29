# First Edition core cycle

Этот документ фиксирует mechanics baseline профиля
`first-edition-core-v1`. Это краткое техническое описание нашей реализации,
а не копия текста правил или конкретных коммерческих карт.

## Источники и границы

- [официальные правила Munchkin First Edition][rulebook], получены
  2026-07-29: 10 666 974 bytes, SHA-256
  `26c797604dc0f28788461e4545cc4ea8a434cde90773719fb5ffd35b1bd8fb65`;
- [официальный FAQ][faq] и [FAQ changelog][faq-changelog] по состоянию на
  2026-07-29;
- [официальная страница текущего core set][product]: 168 карт, 95 Door и
  73 Treasure.

Baseline относится к актуальному First Edition core/reprint и не утверждает
идентичность первоначальному тиражу 2001 года. Munchkin Second Edition и
expansions не входят.

При конфликте authoritative порядок для runtime такой: executable schema/code
и tests, принятые ADR, этот mechanics note, затем официальные general rules и
FAQ. Правило будущей оригинальной карты может расширить closed registry
отдельным изменением. Русские издания используются только как linguistic
reference для будущих формулировок «Московского манчкина», не как источник
runtime mechanics.

## Реализовано и отложено

| Область | `first-edition-core-v1` | Следующий multiplayer profile |
|---|---|---|
| Lobby | 1–6 участников, один reducer, ходы по lobby order | lobby остаётся тем же |
| Setup | каждому 4 Door + 4 Treasure; каждый явно завершает свой setup | reactions других actors не нужны |
| Собственный ход | preparation, Door, encounter/effect, charity, end turn | сохраняется |
| Бой | один Monster, собственные карты/abilities, server totals | помощь, переговоры, чужие усилители, дополнительные Monsters |
| Run Away | server die, modifiers, typed Bad Stuff | чужие реакции на побег |
| Карты игроков | traits, attachments, carried/equipped Items, self effects | trade, gift, steal, targeted effects |
| Charity | владелец сбрасывает excess до hand limit | передача eligible player |
| Death | discard lootable zones без looting body | looting другими players |
| Content | `none`/`self` materialized; `other_players` deferred | новые scopes/capabilities |

## Setup

Backend материализует `copies` definitions в уникальные card instances,
фильтруя interaction-only definitions. Door и Treasure перемешиваются
server-side; realized order сохраняется в event.

Каждый участник получает 4 Door и 4 Treasure. Setup window идёт по lobby
order: actor может разыграть разрешённые traits/items и обязан вызвать
`finish_setup`. Первая Door недоступна, пока setup не завершили все.

## Полный ход

1. **Preparation.** Active actor разыгрывает/снимает собственные cards,
   экипирует Items, использует доступные abilities и продаёт Items. Затем
   открывает верхнюю Door.
2. **Kick Open The Door.** Monster начинает обязательный combat. Curse
   немедленно разрешается на current actor. Другой тип Door уходит в hand и
   открывает выбор следующего действия.
3. **Door choice.** Actor либо играет Monster из своей hand через
   Look For Trouble, либо выполняет Loot The Room и берёт закрытую Door.
4. **Combat.** Server считает Level, equipment, traits, persistent/temporary и
   conditional modifiers. Победа требует строго большей силы. Ничья является
   победой только при явном typed `tie_wins`.
5. **Combat resolution.** Пока собственное combat window открыто, actor может
   применить разрешённые one-shots/abilities и затем закрывает его. При победе
   Monster сбрасывается, levels/treasures начисляются после завершения всего
   боя. Обычный level-up или продажа не дают winning Level 10.
6. **Run Away.** Доступен только после закрытия проигрываемого combat window.
   Server фиксирует d6 outcome; успех определяется целью 5 с modifiers.
   Неудача применяет typed Bad Stuff.
7. **Charity.** Если hand превышает server-calculated limit, actor выбирает
   ровно excess cards для discard. Передачи другому игроку пока нет.
8. **End turn.** Управление переходит следующему lobby player. В игре на одного
   участника следующий ход получает тот же actor тем же reducer.

## Character, Items и level

Level имеет нижнюю границу 1. Победа наступает на Level 10 только после
разрешённого monster-kill либо effect с явным `can_win`.

Character tags и Class/Race-like traits являются зарегистрированными данными.
Trait attachments увеличивают допустимое количество traits своей группы.
Items имеют carried/equipped состояния, Headgear/Armor/Footgear/Hands slots,
Big/Small size, restrictions, gold value и typed bonuses. Cheat-like
attachment bypasses restrictions только для связанного Item.

Продажа принимает server-validated batch суммарной стоимостью не менее 1 000:
каждая полная тысяча даёт Level без сдачи и не может дать winning level.

## Bad Stuff, death и revival

Bad Stuff использует только registered effects: потеря Level, выбранной карты,
Item/trait, character-tag change или death. Если требуется выбор, server
создаёт `PendingDecision` с allowlisted instance IDs; клиент не отправляет
произвольную цель.

Death сохраняет Level, Class/Race-like traits, multi-trait attachments и
persistent Curses. Hand, Items, cheat attachments и прочие lootable cards
переходят в соответствующие discard. Player остаётся вне активных действий до
начала своего следующего хода, затем оживает, получает 4 Door + 4 Treasure и
переходит к обычной preparation.

## Deck exhaustion и replay

Пустая draw pile пересобирается только из discard того же deck. Новый порядок
и обновлённое RNG state фиксируются в transition event. Replay применяет
готовый state/outcomes и не делает повторный shuffle или die roll.

## Closed effect registry

Presentation `rules_text` никогда не исполняется. Registry поддерживает
typed primitives:

- gain/lose Level;
- player/Monster combat modifier;
- escape, hand-limit и Treasure-reward modifier;
- discard по allowlisted selector;
- registered character-tag change;
- death;
- draw из Door/Treasure;
- persistent tie-win;
- discard-as-cost combat ability.

Новые произвольные expressions, `eval`, JavaScript/Lua и разбор естественного
текста запрещены.

[rulebook]: https://munchkin.game/site-munchkin/assets/files/1138/munchkin_rules-1.pdf
[faq]: https://munchkin.game/gameplay/faq/
[faq-changelog]: https://munchkin.game/gameplay/faq/changelog.html
[product]: https://munchkin.game/products/games/munchkin/
