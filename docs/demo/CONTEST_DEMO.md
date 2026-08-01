# Contest demo: five-minute live path

Статус сценария: `live evidence required`. This is a timed script for a
mixed/non-expert audience, not evidence that production is already available.
It has no prerecorded fallback.

## Entry gate

Do not start the clock until the owner has recorded all of the following in a
sanitized evidence note:

- valid HTTPS smoke for the approved public hostname, including certificate
  chain and `/health/live`; the current expected hostname is
  `munchkin.l1ttl3h0rse.ru`, but this workspace has not proved it;
- one successful protected CI run with the full commit SHA, immutable game/web
  digests, scan result, SPDX SBOM and attestation evidence;
- the owner-authenticated Monium dashboard contains the matching release and a
  trace/metric query; the approved soak is `60` minutes;
- backup freshness metadata and, when claimed, an owner-observed isolated
  restore result;
- a separate approval for any deploy, restart, rollback, DNS/NS, secret,
  Monium import/test-email or other remote mutation used during the demo.

If any item is missing, show the architecture/evidence matrix as an honest
limitation and stop. Do not substitute localhost, an unverified hostname, a
fabricated dashboard, a raw database dump, a private game projection or a
recording for the missing evidence.

## Five-minute schedule

| Time | Live action | Evidence to show | Privacy/stop rule |
|---:|---|---|---|
| `0:00–0:30` | Open the approved HTTPS URL in a clean browser profile and show the lock/hostname plus the public health result. | URL, certificate and `/health/live` smoke record. | Invalid TLS, redirect loop or unexpected hostname stops the demo. |
| `0:30–1:15` | Show the protected CI run and the release evidence artifact. | Full commit SHA, game/web `@sha256` references, scan/SBOM/attestation status. | Never show tokens, workflow secret values or unredacted logs. |
| `1:15–3:15` | In two browser profiles choose `Создать комнату` and `Войти в комнату`; start the game; open `Дверь`; take the server-provided legal `Сразиться`/`Сбежать` path; complete `Добыча` when offered and `Закончить ход`. | Visible UI state and successful resync/version update, not private hand contents. | Share only a disposable game ID; do not capture guest credentials, opponent private state or raw API payloads. Stop on any server error instead of inventing a result. |
| `3:15–4:15` | Open the owner-only Monium view and select the matching release/time window. | Request rate, readiness, p95, command/SSE signal and one trace correlated to the demo request. | Do not expose API keys, email, arbitrary game/player/card IDs or unapproved public telemetry. |
| `4:15–4:45` | Show the sanitized production status and backup metadata. | Release SHA/digests, `readiness`, `smoke`, verified backup timestamp/age and restore evidence if completed. | Never open a dump or print a DSN/password. If freshness or restore evidence is absent, say so. |
| `4:45–5:00` | Explain recovery boundary and limitations; run a restart/rollback only if the separate approval is already recorded. | Previous compatible pair, migration contract and recovery evidence. | No ad-hoc SSH, `terraform destroy`, DNS change, image deletion or secret rotation during the demo. |

The gameplay path is intentionally short. The server remains authoritative: the
browser displays only the actor-specific projection and legal action descriptors;
it does not choose RNG, deck order, another player or a battle result.

## Evidence preparation

Use the canonical runbooks; do not copy their remote commands into a slide:

1. [Production deployment and ACME](../operations/PRODUCTION_DEPLOYMENT.md)
   defines the exact release, public smoke and owner approval gates.
2. [Production rollback](../operations/PRODUCTION_ROLLBACK.md) defines the
   compatible previous pair and the migration guard.
3. [Production observability](../operations/OBSERVABILITY.md) defines the
   private Collector, Monium dashboard, alert policy and 60-minute live soak.
4. [PostgreSQL backup and restore](../operations/POSTGRES_BACKUP_AND_RESTORE.md)
   defines the non-secret status and isolated restore evidence.
5. [Security](../operations/PRODUCTION_SECURITY.md),
   [supply-chain](../operations/SUPPLY_CHAIN.md) and
   [secrets](../operations/PRODUCTION_SECRETS.md) define the no-secret and
   remote-mutation boundaries.

The operator may invoke the root-owned forced command `status --evidence` for
non-secret release metadata. The backup evidence is the bounded JSON status
record described by the backup runbook. Neither action authorizes or performs a
mutation.

For a fresh documentation dry-run from the repository root, use only these
read-only/local checks:

```bash
node .codex/hooks/plan-lint.mjs
node scripts/ci/verify-action-pins.mjs
bash scripts/production/security-audit.sh
bash scripts/terraform-check.sh
docker compose --parallel 8 -f compose.production.yml config --quiet
```

The canonical `./leinoctl verify --changed` remains the lifecycle gate. A
Docker daemon, cloud credential, owner-only Monium session or production host
is not silently substituted when a command cannot run.

## Fresh-reader dry-run

Before a real contest, an owner who has not read the implementation should be
able to follow this document and answer:

- which exact URL is approved and where its valid HTTPS smoke is recorded;
- which full SHA, image digests and CI run are being shown;
- where the owner-only dashboard and non-secret backup evidence are opened;
- which actions require a new approval and which are read-only;
- how to stop without exposing private game state or pretending that an unrun
  gate passed.

The documentation-only dry-run in this repository can validate links, commands,
scope and secret classification. It cannot turn an unavailable public URL,
Monium account, production VM or backup bucket into live evidence. A local dev
run may rehearse the UI flow, but it is not a production demo result.

## Current evidence boundary

The preceding infrastructure plans provide local repository contracts and
archived verification records. At this snapshot the following remain unrun:

- public DNS/HTTPS smoke and production UI/API session;
- first GitHub WIF publication, registry digests and artifact attestations;
- production VM bootstrap/deploy, Monium import/query/alert delivery and the
  60-minute soak;
- first verified off-host backup, freshness observation and isolated restore;
- any restart, rollback, secret rotation or other remote mutation.

Until those records exist, the demo is a ready-to-run script with a truthful
stop condition, not a claim of a successful live demonstration.
