# ADR-0002: Authoritative deterministic game engine

- **Статус:** accepted
- **Дата:** 2026-07-29

## Контекст

Игра содержит скрытую информацию, конкурентные команды и случайность.
Client-side authority позволяет подменять actor, карты и результат RNG, а
повторный расчёт случайности делает event replay нестабильным.

## Решение

Backend принимает intent с exact expected version и idempotency key. Actor
определяется из hash-verified bearer credential. Pure engine возвращает
domain events; события содержат уже реализованные shuffle/deck orders и die
rolls. Replay только применяет события.

Application сохраняет events, snapshot и request-fingerprinted receipt одной
транзакцией. Одинаковый duplicate возвращает сохранённую projection, reuse с
другим fingerprint отклоняется.

Internal state никогда не сериализуется. Projector строит allowlisted view
для конкретного actor. Общий authenticated SSE stream содержит только:

```json
{
  "type": "game.v1.version_advanced",
  "game_id": "game_...",
  "version": 7,
  "reason": "open_door",
  "occurred_at": "..."
}
```

После reconnect, invalid envelope или version gap клиент делает
actor-specific HTTP resync.

## Последствия

Можно воспроизвести спорную игру независимо от будущей версии PRNG. Медленный
realtime subscriber получает newest invalidation через conflation, а
publication failure не откатывает игру. Для horizontal scaling in-process hub
заменяется внешним adapter без изменения engine или wire envelope.
