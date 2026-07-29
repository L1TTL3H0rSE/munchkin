# Дополнительные правила для frontend

Действуют вместе с корневым `AGENTS.md`. Frontend — один pnpm workspace без
submodules и вложенных lock-файлов.

- Команды запускай из `frontend/`.
- Общие версии храни в `pnpm-workspace.yaml` catalog, внутренние зависимости —
  через `workspace:*`.
- Wire/realtime schemas принадлежат `packages/contracts`; приложение не
  дублирует transport DTO.
- Клиент не вычисляет authoritative game result. Он отправляет intent с
  expected version и idempotency key.
- Bearer credential хранится только в выбранном local dev adapter; не помещай
  token в URL, analytics, error text или realtime payload.
- Realtime является version invalidation hint. После reconnect, version gap,
  invalid envelope или publish gap выполняй `GET` actor-specific projection.
- UI никогда не получает full internal state. Не добавляй fallback на
  `any`/raw JSON ради временного backend gap.
- Чужие cards отображаются только count; закрытые decks — count без order.
- Unknown schema/effect/event отображается как recoverable resync error,
  но не применяется локально.

Canonical checks:

```bash
pnpm lint
pnpm check
```

После изменения contracts проверь Zod fixtures против Go HTTP fixtures и
реальный consumer:

```bash
./leinoctl verify --paths frontend/<changed-path>
```
