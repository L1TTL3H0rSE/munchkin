# ADR-0001: Modular monolith first

- **Статус:** accepted
- **Дата:** 2026-07-29

## Контекст

У продукта один bounded context и одна транзакционная граница: игровая
комната. Раннее разделение на gateway, rules, lobby и realtime services
добавило бы distributed consistency до появления независимых нагрузок.

## Решение

Начать с одного deployable Go backend `backend/game` и одного Nuxt frontend.
Внутри backend оставить явные границы:

- pure `internal/game`;
- application orchestration;
- transport;
- memory/PostgreSQL adapters;
- realtime publisher/subscriber boundary.

Interfaces принадлежат потребителю. Engine не импортирует infrastructure.

## Последствия

Одна PostgreSQL transaction атомарно сохраняет events, snapshot и receipt.
Local development и debugging остаются простыми. Выделение сервиса возможно
позже без переноса правил через сеть.

Новый deployable service оправдан только независимым scaling/SLA/data-owner
требованием, а не размером каталога.
