# Supply-chain and release evidence

This runbook defines how an immutable Munchkin release is scanned, described
and verified. It is a repository-side contract; it does not publish an image,
change GitHub settings, exchange WIF credentials or deploy a VM.

## Approved free tool contract

| Control | Version | Verification |
|---|---:|---|
| Gitleaks | `8.30.1` | pinned Linux archive SHA-256 |
| Trivy | `0.70.0` | pinned Linux archive SHA-256 |
| OSV-Scanner | `2.3.8` | pinned Linux binary SHA-256 |
| govulncheck | `v1.6.0` | Go module checksum database |
| Syft | `1.44.0` | pinned Linux archive SHA-256 |
| CodeQL Action | `v4.37.3` | full commit SHA `c54b30b7df092240050e69945842bc67aee0f0f4` |
| Artifact Attestations | `v4.2.0` | full commit SHA `f7c74d28b9d84cb8768d0b8ca14a4bac6ef463e6` |

`scripts/ci/security-scan.sh --contract` prints the approved binary pins.
The scanner downloads use HTTPS, TLS 1.2+, retries and SHA-256 verification
before execution. Mutable action tags and `latest` are rejected by
`scripts/ci/verify-action-pins.mjs`.

## CI evidence flow

The publish job has only the permissions needed for its stage. It builds the
non-root `game` and `web` images, scans the local immutable commit-tagged
images, pushes only after the scan gate, resolves registry digests, and writes
the release manifest. Syft emits one SPDX SBOM per digest. GitHub OIDC-backed
Artifact Attestations then bind provenance and SBOM predicates to each image.

The deploy job downloads the exact release artifact by workflow run ID and
fails closed unless all of the following match:

- full release commit SHA;
- `cr.yandex/crpdnmjudj1usiu90gdn/game@sha256:...` and `web@sha256:...`;
- manifest image digests and security evidence;
- Gitleaks/Trivy/OSV/govulncheck/Syft policy versions;
- both SPDX files;
- provenance and SBOM attestation bundles whose subjects contain the exact
  image digest and whose signer is `.github/workflows/ci.yml`.

The workflow cannot replace this with a mutable tag. First publication and
live `gh attestation verify` are still separate remote evidence gates.

## Findings policy

| Severity | Default action | Deadline/exception |
|---|---|---|
| Critical | block release | fix or explicit waiver within `24h` |
| High | block when reachable or runtime-impacting | fix within `7d` |
| Medium | track and remediate | `30d` |
| Low | maintenance backlog | next maintenance window |

An exception is owned by `L1TTL3H0rSE` and records finding ID, affected
component/digest, rationale, scope, compensating control, reviewer and an
expiry no later than `30d`. An expired exception blocks the next release.
The base policy has incremental scanner budget `0 RUB/month`; paid scanning
requires a new price review and owner approval.

## Retention and recovery

Retention starts as a report-only calculation. A safe dry run supplies the
current, previous, pending and minimum recovery references plus the available
immutable digests:

```bash
bash scripts/production/registry-retention-plan.sh \
  --output /tmp/munchkin-retention.json \
  --current cr.yandex/crpdnmjudj1usiu90gdn/game@sha256:<digest> \
  --previous cr.yandex/crpdnmjudj1usiu90gdn/game@sha256:<digest> \
  --pending cr.yandex/crpdnmjudj1usiu90gdn/game@sha256:<digest>
```

Use one report per repository when the available digest inventory is known.
The output marks the protected set and deletion candidates, but the script
cannot delete images or call a registry mutation API. Current, previous,
pending and the approved minimum generations are never candidates.

## Revoke and recovery drill

If a signing or publisher credential is suspected to be compromised, stop the
publish/deploy workflow, disable the exact GitHub environment subject, inspect
recent digests and preserve evidence. Revoke or rotate only through the
approved secret/IAM store. Do not delete the last known-good pair until a
replacement release has independently passed scan, SBOM and attestation
verification. A rollback uses the verified previous digest and the controlled
production gateway.

## Evidence boundary

Local implementation proves the pins, workflow policy, scanner orchestration,
manifest/evidence schema, digest checks and report-only retention behavior.
It does not prove live GitHub branch/environment settings, WIF exchange,
registry publication, attestation availability, cloud IAM convergence or
production deployment. Those are explicitly recorded as unrun gates.
