# Дополнительные правила для frontend

Действуют вместе с корневым `AGENTS.md`. Frontend — один pnpm workspace без
submodules и вложенных lock-файлов.

Перед любым frontend plan или implementation полностью прочитай
[`docs/agents/FRONTEND_ENGINEERING_SPEC.md`](../docs/agents/FRONTEND_ENGINEERING_SPEC.md).
Она задаёт normative engineering rules; при конфликте executable manifests,
schemas, contracts и tests остаются источниками истины по корневому
`AGENTS.md`.

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

## Browser evidence runbook

Browser commands use the repository runner, not an internal Playwright CLI:

```bash
# repository root; the runner resolves frontendRoot itself
node frontend/test/run-playwright.mjs test player-ui.spec.ts --project=chromium --workers=1

# frontend/
node test/run-playwright.mjs test player-ui.spec.ts --project=chromium --workers=1
```

The runner is cwd-independent, uses bundled Node 24, defaults to deterministic
serial workers and owns bounded cleanup of Playwright/Nuxt descendants. Browser
output, report, trace, video and `.last-run.json` belong in a unique OS temp
directory outside the worktree: success removes that directory, while failure
prints and retains its absolute evidence path. `frontend/test/browser/artifacts/`
and `.gitignore` are only defense-in-depth for legacy output, never the primary
artifact boundary.

The declared toolchain is Node `>=24`, Git Bash `>=4` and the
`frontend/package.json` package manager `pnpm@10.8.0`. Resolve pnpm through the
profile's process-local `LEINO_PNPM_EXECUTABLE` mapping and fail closed when it
is absent or mismatched; do not silently select a system shim. Browser runs do
not call `pnpm install`, `pnpm --lockfile-only` or update dependencies. Snapshot
updates require an explicit `--update-snapshots` action and a visible diff.

Keep evidence layers separate: a focused player/a11y smoke, browser assertion,
visual/a11y matrix, canonical `./leinoctl verify`, `scope-check`, release ledger
and local commit prove different things. A passing direct test or manual smoke
does not satisfy the canonical ledger, and a passing visual run does not prove
accessibility or product CSS correctness.

После изменения contracts проверь Zod fixtures против Go HTTP fixtures и
реальный consumer:

```bash
./leinoctl verify --paths frontend/<changed-path>
```
