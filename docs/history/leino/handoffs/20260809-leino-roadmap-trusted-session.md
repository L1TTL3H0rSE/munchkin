# Handoff: staged Leino roadmap trusted-session checkpoint

## Completed repository checkpoint

- Exact plan:
  `20260808T210727Z-bc4736-rebaseline-leino-product-roadmap`.
- Selected implementation session:
  `019fe36c-a949-7320-92bf-7ddac8b5beab`.
- The stale owner session for the two superseded lifecycle files was
  `019fc743-f079-7d30-9756-e9aedfd5592e`. Before takeover it had no
  `.leino/runtime/sessions` state and its Codex task status was `notLoaded`.
- Takeover was limited to plans
  `20260803T115527Z-a5636f-parallel-agent-worktree-orchestration` and
  `20260804T134001Z-d7a194-agent-runtime-and-toolchain-hardening`. Neither was
  selected or approved for implementation.
- Both plans were cancelled before implementation with exact reason
  `superseded by staged Leino product roadmap` and moved intact to archive with
  their technical research preserved.
- ADR-0010 now records the standalone product boundary, semantic P01-P14 queue,
  optional P15 boundary, P11/P12 writer evidence gate and separate Figma
  external-artifact consistency model.

## Authorization boundary

P00 approval and ADR-0010 do not approve or select P01-P15. They do not
authorize product code, extraction, dependency installation, GitHub repository
creation, package publication, push, cloud mutation or Figma mutation. The
proposed targets `leinodev/leino` and `@leinodev/leinoctl` must be repeated and
validated in the exact child approvals that own those external effects.

Current executable generic source remains `tools/leinoctl`. Munchkin becomes a
published-package consumer only after the staged export/bootstrap/release/pin
plans complete with artifact and behavior parity.

## New trusted-session requirement

This checkpoint changes `docs/agents/HARNESS.md` and lifecycle/runbook
documentation. The implementation session can test and review those files, but
cannot claim the changed instructions were loaded at SessionStart. Begin any
P01 planning or subsequent lifecycle work in a new trusted Codex session and
confirm `Munchkin harness is active` before relying on the revised wording.

The new session must first verify the P00 archive/release/local commit and a
clean worktree. It must not take over or select any P01-P15 plan: no exact child
IDs exist yet. If the user asks to proceed, create only the next scoped plan,
run current context/dependency/ownership research, present its exact ID and wait
for separate approval.

## Verification evidence

- `git diff --check` and strict text-check passed; text-check covered all eight
  present changed text files with zero issues.
- Focused harness tests passed `44/44`; focused leinoctl tests passed `81/81`.
- Plan lint reported `plans=75 active=3 archive=72 issues=0` before P00 archive.
- Preflight resolved an existing cached pnpm `10.8.0` exactly and reported
  `toolchain.ready=true`; no install or lockfile mutation occurred.
- Canonical `./leinoctl verify --changed` passed the three required
  repository-workflow checks and recorded exit code 0 in the selected session
  ledger.
- Canonical scope report for session
  `019fe36c-a949-7320-92bf-7ddac8b5beab` returned `ok=true`,
  `outsideWriteSet=[]`, `unledgered=[]`, `failedChecks=[]` and
  `missingRequiredChecks=[]`; root HEAD stayed at
  `f828536321120e91fcbf8810e2f28d7d91a512b4` before the lifecycle commit.
- Archived P00 path, guarded release result and local commit SHA are recorded in
  the completed P00 plan and Git history. No push or external mutation belongs
  to this checkpoint.
