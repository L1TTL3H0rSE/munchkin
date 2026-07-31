# GitHub Actions -> Yandex immutable images

This runbook documents the repository-side delivery boundary. It does not
apply Terraform, configure GitHub, exchange a live token or publish an image.
Those are separate owner-approved gates.

## Contract

The workflow in `.github/workflows/ci.yml` runs the repository verification DAG
for pull requests and `main` pushes. Only its `publish` job can request a
GitHub OIDC token. It requires all verification jobs, `refs/heads/main`, and
either a `push` event or an explicitly confirmed `workflow_dispatch` input.
The job uses the protected GitHub environment `production-images`.

The expected immutable GitHub OIDC claims are:

```text
iss=https://token.actions.githubusercontent.com
aud=https://github.com/L1TTL3H0rSE
sub=repo:L1TTL3H0rSE@32160016/munchkin@1316069622:environment:production-images
repository_id=1316069622
repository_owner_id=32160016
environment=production-images
```

Yandex federation maps that exact subject to the keyless service account
`munchkin-github-images`. Production Terraform grants that account only
`container-registry.images.pusher` on registry
`crpdnmjudj1usiu90gdn`. The runtime service account keeps its separate
pull-only binding.

The pair is published only as:

```text
cr.yandex/crpdnmjudj1usiu90gdn/game:<full-lowercase-commit-sha>
cr.yandex/crpdnmjudj1usiu90gdn/web:<full-lowercase-commit-sha>
```

The workflow refuses an existing tag, verifies OCI labels locally, pushes both
images, resolves both remote digests, and writes
`munchkin-images-<sha>.json` only after both verifications succeed. The
manifest contains digest-pinned `image@sha256:...` references and no token.
There is no `latest` tag, tag overwrite, cleanup, scanner or registry cache
policy in this slice.

## Owner setup gates

1. Configure the GitHub environment `production-images` as protected and
   allow only the `main` branch. Add the repository’s required reviewers or
   equivalent organization protection before enabling publication.
2. Add the non-secret environment variable
   `YANDEX_GITHUB_IMAGES_SERVICE_ACCOUNT_ID` with the ID returned by the
   reviewed bootstrap Terraform output. Do not add a secret, static key,
   authorized key, service-account JSON, `YC_TOKEN` or Docker password.
3. Review the bootstrap and production Terraform plans separately. Bootstrap
   may add only the CI service account, one OIDC federation and one exact
   federated credential. Production may add only the CI service-account lookup
   and exact registry pusher binding; an existing runtime puller replacement
   or unexpected IAM change stops the apply.
4. Before apply, run the claim probe from the protected workflow or an
   equivalent owner-controlled job. Compare every allowlisted claim above.
   Any changed repository ID, owner ID, audience, subject, issuer or
   environment is a trust-boundary change and requires a new plan approval.
5. Apply bootstrap and production only with fresh short-lived owner
   credentials, locked remote state, sanitized saved-plan review and separate
   explicit approvals. Record resource addresses and non-secret IDs, never
   tokens or backend credentials.
6. Run one controlled WIF exchange and registry login. Confirm the login can
   reach the target registry without granting folder-wide access. The helper
   masks the ephemeral IAM token and emits no raw JWT, IAM token or Docker
   config as evidence.
7. Enable the first trusted `main` publication only after the protected
   environment and both live Terraform graphs are verified. Preserve the
   uploaded digest-pair artifact as the handoff to the deploy plan.

## Local checks

From repository root:

```bash
bash -n scripts/ci/yandex-wif-token.sh
terraform fmt -check -recursive infra/terraform
./scripts/terraform-check.sh
./leinoctl verify --changed
./leinoctl scope-check --plan 20260731T005255Z-b3ea2b-github-actions-yandex-images
```

The helper requires `curl`, `jq`, `base64` and the GitHub-provided
`ACTIONS_ID_TOKEN_REQUEST_*` variables. `claims` prints only the six
allowlisted fields. `exchange` prints only the short-lived access token to its
caller; callers must pipe it directly to `docker login --password-stdin` and
unset the shell variable immediately.

## Diagnose and revoke

### Claim mismatch

Stop before Terraform apply. Inspect only the allowlisted claim object and
compare it with the exact subject in bootstrap HCL. Do not broaden the
federated credential to a branch wildcard, repository name, owner name or
reusable workflow. If GitHub changes its subject contract, create a new
reviewed plan and update the environment protection together with Terraform.

### Exchange or registry login failure

Check, in order, that the environment is approved, the service-account ID
variable is present, the federated credential is enabled and exact, the
production pusher binding targets registry `crpdnmjudj1usiu90gdn`, and the
runtime puller binding is unchanged. Do not retry by adding a static key or a
folder-wide role. Keep the failed run free of JWT/token artifacts.

### Emergency revoke

Use the Yandex control plane to disable or remove the exact federated
credential, then remove the registry pusher binding through a reviewed
Terraform change. Disable the GitHub environment/workflow while investigating.
Removal of the federation or service account is destructive and requires a
separate recovery/destructive approval; published images are not deleted by
this runbook. Rotate any owner-side backend credential independently if it may
have been exposed.

### Rotation

Create the replacement identity/trust in a separate reviewed plan, validate a
new exact claim probe and non-destructive registry login, then switch the
protected environment variable. Remove the old credential and binding only
after the replacement is proven. Never store the OIDC JWT or IAM token in
GitHub variables, artifacts, summaries, caches or repository files.

## Evidence expected from a completed gate

- protected `production-images` environment and main-only rule;
- exact allowlisted claim JSON with no token-like value;
- bootstrap and production sanitized plans with no unexpected IAM changes;
- zero CI service-account keys/authorized keys and no state access;
- successful masked WIF exchange and registry login;
- two full-SHA image references, two remote digests and the pair manifest;
- OCI source/revision/created/licenses labels on both images;
- no `latest`, tag overwrite, image deletion or cleanup mutation.
