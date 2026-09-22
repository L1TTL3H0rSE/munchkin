# ADR-0004: Lobby core cycle and interaction boundary

- **Статус:** accepted
- **Дата:** 2026-07-29

## Контекст

Bootstrap vertical slice не моделировал полный ход, equipment, typed card
effects, смерть и переиспользование discard. Одновременно полная настольная
игра требует окон, в которых другие игроки помогают, мешают, торгуются и
выбирают цели. Подключать эти реакции раньше authoritative single-actor cycle
означало бы смешать две независимые сложности.

Требуется обычная lobby game с чередованием участников. Режим на одного
участника нужен только как технический preview, а не как отдельный набор
правил.

## Решение

Вводится immutable profile `first-edition-core-v1`, основанный на core
mechanics актуального English Munchkin First Edition. Profile допускает 1–6
участников и всегда использует один reducer; отдельного `solo-mode` нет.

В этой версии полный setup и ход выполняет только active actor. State сразу
содержит `ActionWindow.eligible_actor_ids` и tagged `PendingDecision`, чтобы
будущий multiplayer profile мог расширить число eligible actors и targets без
смены backend authority, card-instance model, events или projection boundary.

Content явно классифицирует `interaction_scope`. Definition со scope
`other_players` проходит schema/registry validation, но исключается при
materialization `first-edition-core-v1`. Она не становится доступной картой с
пустым эффектом.

Отложены:

- помощь, торг за награду и forced help в бою;
- добавление монстров/усилителей и контрдействия в чужом бою;
- Curse, level changes и иные selectors, направленные на другого actor;
- кража, trade, gift и charity transfer;
- looting body другого игрока;
- любые decision/priority/pass windows с несколькими eligible actors.

Charity текущего профиля — server-validated сброс excess самим владельцем.
После смерти lootable cards уходят в соответствующие discard; Level,
Class/Race-like traits, их attachments и persistent Curses сохраняются.

## Последствия

Lobby из нескольких игроков уже проходит полные самостоятельные ходы по
очереди, а one-player preview проверяет тот же путь. Нельзя представить
отложенную карту как поддержанную только потому, что её JSON валиден.

Следующий multiplayer plan расширит capabilities, targets, projections и
action windows. Он не должен переносить authority на клиент, раскрывать чужую
руку либо менять зафиксированный результат RNG при replay.
