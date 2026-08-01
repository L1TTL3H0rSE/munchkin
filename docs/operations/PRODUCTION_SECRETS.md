# Production secrets

Secret values are owner-side runtime inputs. This document records names,
boundaries and rotation rules only; it intentionally contains no values,
email address, private key or payload.

## Inventory

| Destination | Entry | Consumer |
|---|---|---|
| `/srv/munchkin/secrets/postgres.env` | generated `POSTGRES_PASSWORD` | PostgreSQL |
| `/srv/munchkin/secrets/game.env` | derived `DATABASE_URL` | migrate/game |
| `/srv/munchkin/secrets/traefik.env` | owner `ACME_EMAIL`, staging/prod `ACME_CA_SERVER` | Traefik |
| protected GitHub `production-deploy` environment | dedicated deploy SSH private key, pinned known-hosts and host | workflow |
| `/srv/munchkin/traefik/acme/acme.json` | ACME account/certificate state | Traefik |

The application inventory excludes `OPENAI_API_KEY`, Card Studio authoring
tokens and a general game-signing secret. Runtime identity is keyless; no
static Yandex key is placed on the VM or in GitHub.

## Generation and insertion

When the separate mutation step is approved, generate the PostgreSQL password
and dedicated ED25519 deploy key in the process that performs the insertion.
Pipe each value directly to its approved secret store or protected GitHub
environment. Do not print, echo, serialize, copy to a plan/tfvars file, put in
`.env`, commit, paste into chat, or include in logs. Clear temporary buffers
and remove process-local temporary files after insertion.

The DSN is derived from the generated password and written only to the root-
owned `game.env`. The deploy public key may be passed to host bootstrap; the
private key is never accepted by `bootstrap-host.sh` and never reaches the
host filesystem.

## File boundary

The host secret directory is root-owned `0700`; each environment file is
root-owned `0600`. The ACME state file is root-owned `0600`. The PostgreSQL
data directory is owned by the numeric container PostgreSQL UID and is not
read by the deploy user. `deploy.sh` validates these modes and checks for
non-empty required entries without printing values.

Terraform creates only deletion-protected Lockbox metadata and an exact
runtime `viewer` IAM member. It intentionally has no password generation
block, secret version, text entry or payload value. Lockbox payload insertion,
rotation, and runtime delivery are separate owner approvals.

## Rotation

Rotate the password, derived DSN, deploy key and ACME material independently:

1. Show the exact sanitized target stores and expected service impact.
2. Obtain the relevant owner approval.
3. Generate the new value process-locally and insert it directly.
4. Validate file modes and readiness without exposing the value.
5. Revoke the old key/version only after the new path is proven.

If a secret appears in terminal output, Git, Terraform state or an artifact,
stop, revoke/rotate it and start a recovery review before continuing.
