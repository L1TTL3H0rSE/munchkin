# Production rollback

Rollback changes only the application image pair. It never downgrades the
PostgreSQL schema blindly.

## Guard

The current and previous release evidence must both contain the exact
`health-migrations-v1` contract. The previous game and web digests must be
complete lowercase SHA-256 references in the approved Yandex registry. If
either condition fails, `rollback.sh` stops before changing containers.

## Procedure

1. Stop new deployment attempts through the protected workflow/concurrency
   gate and capture the current evidence artifact.
2. Show a sanitized rollback plan with current and previous commit/digests,
   migration contract, expected container changes and smoke/abort conditions.
3. Obtain the separate rollout approval.
4. Run the forced-command operation:

   ```text
   rollback
   ```

   The host script takes the same serialized lock, pulls only the previous
   game/web pair, leaves the database schema unchanged, runs the services with
   `--no-deps` for the application rollback, waits for readiness and runs
   internal/public HTTPS smoke.

5. On success, the old current release becomes the atomic previous marker and
   the rollback evidence becomes the new current marker. On failure, the
   current marker is left unchanged and failed evidence is written separately.

Use `status` or `status --evidence` through the forced-command gateway for
non-secret verification. Never request a general shell, Docker-group access or
raw secret output from the deploy user.

## Re-forward

After the incident, fix the source or configuration in a new approved plan.
Do not repeatedly redeploy a broken pair, edit release JSON by hand, delete
the database, or use `terraform destroy`/state surgery as a rollback.
