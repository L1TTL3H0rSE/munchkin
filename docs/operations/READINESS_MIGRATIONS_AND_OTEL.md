# Readiness, migrations and OTLP foundation

This runbook describes the repository-local operational contract delivered by
`20260731T005306Z-fb49f6-backend-readiness-and-opentelemetry`. It does not
authorize a production deploy, Terraform apply, DNS change, or secret-store
mutation.

## Health contract

- `GET /health/live` is process-only and returns `200 {"status":"ok"}`.
- `GET /health/ready` performs a bounded dependency probe and returns `200`
  when the probe succeeds or `503 {"status":"not_ready"}` otherwise.
- `GET /healthz` remains a compatibility alias for liveness.

The responses never include a DSN, SQL text, credentials, game/player/card
identifiers, or internal state. The game server loads and validates its
immutable content pack before it starts listening. A PostgreSQL-backed server
uses a bounded `Ping` for readiness; an in-memory development server has a
successful no-op dependency probe.

## One-shot migrations

Application startup does not run schema mutations. The migration binary is
`/app/migrate` in the game image and uses:

- `DATABASE_URL` for the connection (never print it);
- `MIGRATION_PATH` for a file or directory of ordered `*.up.sql` files;
- optional `MIGRATION_TIMEOUT`, default `2m`, bounded to `1s..15m`.

Exit codes are stable:

- `0` — all migrations are applied;
- `1` — connection or migration failure; rollout must stop;
- `2` — missing or invalid configuration.

The runner takes a PostgreSQL transaction-scoped advisory lock, creates the
`munchkin_schema_migrations` ledger, applies files in lexical order, records a
SHA-256 checksum, and rejects a changed already-applied file. A failed
migration rolls back with its ledger entry, so a corrected migration can be
retried explicitly. Do not start new application containers after a migration
failure.

Local example:

```powershell
$env:DATABASE_URL = '<local-only connection value>'
$env:MIGRATION_PATH = 'backend/game/migrations'
go run ./cmd/migrate
```

Use a process-local credential source for the placeholder above; do not put a
real value in this file, `.env`, Git, CI output, or chat. Production Compose
will call the image entrypoint as a one-shot job before the application
services are considered ready.

## OTLP configuration

Go and Nitro telemetry are disabled unless an OTLP endpoint is configured.
When enabled, only bounded resource attributes and allowlisted trace context
are exported. Request telemetry uses route classes, method, status code/class,
and bounded application enums; it never exports request bodies, credentials,
game/player/card/command IDs, or arbitrary paths.

The approved exact Nitro pins are recorded in `frontend/package.json` and
`frontend/pnpm-lock.yaml`. The Go OTel dependency line remains `v1.43.0`.

The local Collector fixtures are:

- `infra/otel/collector.production.yaml` — OTLP HTTP and health listeners
  intended for a private Compose network only;
- `infra/otel/collector.test.yaml` — loopback test fixture.

Both use bounded memory/batch processing and a credential-free debug sink.
The production image digest, external destination, retention, dashboards and
alerts belong to later exact plans. Never publish ports `4318` or `13133` on a
production host edge.

## Verification

From the repository root, the focused checks are:

```powershell
go test ./...
pnpm --dir frontend lint
pnpm --dir frontend check
pnpm --dir frontend build
```

The PostgreSQL concurrency/retry smoke runs only when `TEST_DATABASE_URL` is
present. A missing test database is a skipped integration gate, not evidence
of a successful live migration. Collector config validation must use the
version-pinned Contrib image and must remain a read-only local check until a
separate mutation approval is granted.
