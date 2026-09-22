# ADR-0010: Standalone Leino product and staged roadmap

- **Статус:** superseded for Munchkin by [ADR-0011](0011-template-screen-storybook.md)
- **Дата:** 2026-08-09
- **Roadmap authority:** plan
  `20260808T210727Z-bc4736-rebaseline-leino-product-roadmap`

## Контекст

Generic lifecycle, context, toolchain and runner code currently lives in the
Munchkin repository under `tools/leinoctl`. Two earlier unapproved plans tried
to add runtime/toolchain hardening and parallel worktree orchestration as large
repository-local changes. They mixed product extraction, runtime identity,
writer concurrency and repository dogfooding into slices too broad to approve
or verify safely.

Munchkin needs to remain a consumer and dogfood repository. Generic Leino
CLI/core/schema must eventually have a standalone source of truth, while
Munchkin keeps only its repository profile, component graph, policy adapters
and pinned package consumption. That boundary cannot be declared complete by
documentation: code/history migration, repository creation, publication and
consumer pinning each require separate approved implementation plans.

## Решение

### Product boundary

The proposed standalone repository is `leinodev/leino`. It becomes the source
of truth for generic Leino CLI/core/schema only after the relevant migration
and package-consumer plans are separately approved, executed and verified.
Until then, current executable source in `tools/leinoctl` remains authoritative.

Munchkin remains responsible for repository-specific profile, component and
policy configuration and for dogfood evidence. Standalone Leino must not gain
Munchkin-specific paths, package-manager constants or gameplay/product rules.

The repository name, visibility, initial history transfer and any push are
proposed targets, not current authority. P01 must repeat and validate the exact
external target before any repository mutation. The proposed public package
`@leinodev/leinoctl`, its version, visibility, tag and publication are likewise
authorized only by P03. No external resource is created or changed by this ADR.

### Staged roadmap

Roadmap codes and slugs are stable semantic references. Exact child plan IDs do
not exist yet and must not be invented. `dependsOn` is recorded only after the
repository creates an exact child plan in a later planning session.

| Code | Slug | Repository | Semantic dependencies |
|---|---|---|---|
| P01 | `export-leino-history-and-create-repository` | munchkin | exact completed P00 |
| P02 | `bootstrap-standalone-leino-product` | leino | P01 |
| P03 | `release-pipeline-and-first-package-publication` | leino | P02 |
| P04 | `pin-munchkin-to-published-leinoctl` | munchkin | P03 |
| P05 | `plan-spec-and-context-capsules` | leino | P04 |
| P06 | `repository-workspace-runtime-identity` | leino | P05 |
| P07 | `durable-attempts-leases-and-fencing` | leino | P06 |
| P08 | `transitive-toolchain-binding` | leino | P07 |
| P09 | `semantic-agent-routing-and-telemetry` | leino | P05, P07, P08 |
| P10 | `codex-readonly-runner` | leino | P05, P07, P08, P09 |
| P11 | `single-worktree-writer-pilot` | leino | P06, P07, P08, P09, P10 |
| P12 | `two-worker-package-dag` | leino | P11 plus evidence gate |
| P13 | `figma-external-artifact-lane` | leino | P05, P07, P09, P10 |
| P14 | `adaptive-routing-evaluation` | leino | P09, P12, P13 |
| P15 optional | `split-gameplay-figma-remediation-epic` | munchkin | P05, P13 |

P01 through P11, then P12, P13 and P14 are implemented through separately
approved lifecycle plans with one selected write plan at a time. Semantic DAG
independence does not authorize early parallel write execution. P15 is an
optional Munchkin product restructuring plan after P05 and P13; it is not part
of Leino core and does not change the completed checkpoint
`20260808T093246Z-e55ac3-figma-closed-set-playability-remediation-v2`.

### Evidence and failure gates

- P04 pins an exact published package and lockfile and removes vendored source
  only after artifact and behavior parity. Implicit install or download is not
  authorized.
- Before P11 completes, all repository writes remain root-only. P11 proves
  bounded single-worktree, single-writer packages; it does not prove concurrent
  writers.
- P12 is not eligible for approval until at least 10 bounded P11 packages have
  completed successfully with zero accepted scope violations. Concurrent write
  execution remains forbidden until P12 is separately approved and verified.
- P13 uses a separate single-writer consistency model for external Figma
  artifacts. Its plan must name the exact file/resource key and mutation scope.
  A repository writer lease does not authorize Figma writes, and a Figma lane
  does not authorize concurrent repository writers.
- P14 may conclude `inconclusive`. It never changes active model routing without
  another exact approval.
- Missing dependencies, stale ownership, ambiguous resource identity, failed
  evidence gates or a material change in queue semantics stop the child plan;
  they are not repaired by silently reordering or widening the roadmap.

### Authorization boundary

Approval of P00 or acceptance of this ADR does not create, approve, select or
execute P01-P15. Each child requires current research, a generated exact plan
ID, manifest/write set, dependency and shared-resource review, its own explicit
user approval, canonical verification, scope-check, archive/release and local
commit. Push, publication, cloud/GitHub/Figma mutation and dependency installs
remain separate exact-effect approval gates.

## Последствия

- The two unapproved mega-plans are preserved in archive as research but are
  cancelled with the exact reason `superseded by staged Leino product roadmap`.
- Generic Leino extraction and package consumption become explicit reversible
  stages rather than one repository-local rewrite.
- Early write concurrency is deliberately deferred until single-writer evidence
  exists; the roadmap optimizes for recoverability and scope ownership first.
- Current Munchkin product code, hooks/config runtime semantics, package source
  and completed Figma/gameplay checkpoint remain unchanged by this decision.

## Отклонённые альтернативы

- Approve either earlier mega-plan and split it during implementation.
- Treat this roadmap as batch approval for P01-P15.
- Create all exact child IDs now before current evidence and repository ownership
  are known.
- Move generic source before a published package and Munchkin parity gate exist.
- Start two repository writers from a dependency graph before P11/P12 evidence.
- Reuse repository write ownership as authority for Figma external artifacts.

## Связанные материалы

- P00 plan:
  `docs/agents/plans/archive/20260808T210727Z-bc4736-rebaseline-leino-product-roadmap.md`
- Superseded worktree research:
  `docs/agents/plans/archive/20260803T115527Z-a5636f-parallel-agent-worktree-orchestration.md`
- Superseded runtime/toolchain research:
  `docs/agents/plans/archive/20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening.md`
- Trusted-session handoff:
  `docs/agents/handoffs/20260809-leino-roadmap-trusted-session.md`
