# Production observability

This runbook describes the repository-local contract for
`20260731T005307Z-54ac2f-telemetry-backend-dashboards-and-alerts`. It does not
authorize a Terraform apply, Monium resource mutation, Lockbox payload write,
production deploy, alert test message or paid service change.

## Topology and provider decision

Production uses a private OpenTelemetry path:

```text
game/web -> private OTLP HTTP -> Collector -> private egress -> Yandex Monium
```

Yandex Monium is the managed destination for metrics and traces. Logs are not
ingested. Grafana, Prometheus, Loki, host agents and a public telemetry
management endpoint are intentionally absent from the single production VM.
The Collector listens only on the internal Compose networks; ports `4318` and
`13133` are never published by the production Compose file.

The version-controlled definitions are:

- `infra/otel/collector.production.yaml` — OTLP receiver, privacy processor,
  tail sampling, bounded retry/queue and Monium exporter;
- `infra/observability/monium/production-dashboard.json` — importable dashboard
  shape with request, errors, p95, readiness/PostgreSQL and bounded interaction
  panels;
- `infra/observability/monium/production-alerts.yaml` — owner-only alert
  rules, thresholds, deduplication, silence and runbook links;
- `infra/terraform/environments/production/telemetry.tf` — the dedicated
  keyless writer identity, its two exact IAM roles and the dashboard resource.

Monium pricing is usage-based: custom metric values, trace bytes and alert
calculation hours are billable, while the Monium UI and incoming traffic are
not. The approved budget gate is a `500 RUB/month` incremental soft ceiling:
review at 70%, and stop/review before the forecast reaches 100%. The official
pricing evidence is [Monium pricing policy](https://yandex.cloud/en/docs/monium/pricing).

## Runtime secret boundary

The Collector is the only container that receives the Monium API key. Create
the host-side file only during an approved secret insertion step:

```text
/srv/munchkin/secrets/telemetry.env
```

It must be a root-owned regular file with mode `0600`, containing exactly the
runtime values needed by the Collector:

```text
MONIUM_API_KEY=<owner-managed value; never print or commit>
MONIUM_PROJECT=folder__<production-folder-id>
```

The API key is owner-managed, expires and rotates no later than 90 days, and is
created with only `yc.monium.metrics.write` and `yc.monium.traces.write`. The
dedicated `munchkin-monium-writer` service account has only
`monium.metrics.writer` and `monium.traces.writer`. Terraform manages neither
the API key nor a Lockbox version/payload. A later approved secret-store step
may supply the same values to the host runtime without placing them in state,
Git, plan output, shell history or logs.

The applications receive only the private Collector endpoint through the
process environment when telemetry is enabled:

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318
```

An empty endpoint disables application exporters; exporter failure is
asynchronous and must not change game/web response semantics.

## Privacy, retention and failure behavior

The Collector removes known credential, request-body and gameplay identifier
attributes before export. The application instrumentation already allowlists
route classes, status classes, bounded methods and interaction enums. No raw
event payload, game/player/card/command ID, arbitrary URL, DSN, API key or
authorization value is an allowed metric label or trace attribute.

Traces use bounded tail sampling: errors and spans slower than 1 second are
kept, while successful traces use a 10% sample. The Collector has a 128 MiB
memory limit, a 512-trace tail buffer, 256 queued export items, two consumers,
five-second batches and a two-minute retry ceiling. The queue is memory-only;
it does not create an unreviewed telemetry disk or backup surface.

The Monium service retention decision is four days for traces and metrics are
removed after 30 days without new values. Logs remain disabled. If Monium or
the private egress is unavailable, the Collector drops/retries within these
bounds and the game/web processes continue serving requests.

## Dashboard and alert operations

The dashboard includes low-cardinality request rate, 4xx/5xx, p95 latency,
readiness-backed PostgreSQL dependency, interaction outcomes and timeouts. The
deploy/migration revision is read from `service.revision` on trace resources
and the immutable release evidence; the migration contract is
`health-migrations-v1`.

The four base alerts are:

- readiness dependency failure for more than two minutes;
- sustained aggregated 5xx rate above 1% for ten minutes;
- host disk free below 15% for ten minutes, once the separately approved host
  metric source exists;
- p95 above 125% of the measured 60-minute-soak baseline for fifteen minutes.

Rules are delivered only to the owner-supplied email outside the repository.
The address is referenced by `destination_ref` and is never stored in this
runbook, plan or Git. Every rule has a severity, a `for` window, dedup key,
manual-reason silence and a versioned runbook link. Backup freshness/failure
alerts are owned by the later backup plan after its metric exists.

Terraform provider coverage is used for the dashboard and IAM metadata. The
alert/channel definition remains version-controlled YAML and must be imported
through the approved Monium API/UI procedure after a separate sanitized remote
mutation plan and owner approval. A test email is also a separate remote
mutation gate.

## Validation and smoke

Repository-local checks do not need Docker, a Monium key or a remote mutation:

```bash
bash scripts/production/telemetry-smoke.sh
bash scripts/terraform-check.sh
docker compose --parallel 8 -f compose.production.yml config --quiet
```

After the host and secret gates are separately approved, run live evidence as
root with a full release SHA. The default soak is the owner-approved 60
minutes; `--outage-test` stops only the Collector and proves game health stays
available before restarting it:

```bash
MUNCHKIN_RELEASE_COMMIT=<full-release-sha> \
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318 \
bash scripts/production/telemetry-smoke.sh --live --outage-test --soak-minutes 60
```

The live smoke checks Collector/game/web private health, public HTTPS liveness,
one synthetic trace context and the exact release SHA configured in the
services. It does not print secret values or container logs. End-to-end
Monium evidence must then verify the matching trace and metric series in the
owner-authenticated UI/API, followed by the negative privacy scan and a
resource/cost review. If the 70% budget warning or 100% stop threshold is
reached, disable the exporter and review before continuing.

## Rollback and incident response

For a destination outage, leave the game/web deployment running, remove or
blank the process-local OTLP endpoint under the approved change, and inspect
Collector health without exposing its environment. For a bad dashboard or
alert definition, disable/import-revert only the managed observability object;
do not delete the writer identity or secret payload as an unreviewed cleanup.

For an application regression, use the production deploy/rollback runbooks and
the immutable release evidence. Never treat a telemetry alert as permission to
run a migration, change DNS, rotate credentials, or perform a destructive
cloud action.
