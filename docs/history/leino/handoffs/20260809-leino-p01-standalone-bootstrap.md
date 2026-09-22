# Leino P01 standalone bootstrap handoff

## Completed external state

- Plan: `20260809T102027Z-e499aa-export-leino-history-and-create-repository`
- Source repository/commit: Munchkin
  `c5732490321a86e4e6804e72c05e27083a7a46d8`
- Exported path/history: `tools/leinoctl`, five commits, split tip
  `6f35b0878cb69ebda8d000f96f2f7d5b9e98b5a0`
- Target: private `n.telpukhovsky/leinoctl` at
  `ssh://git@gitlab.leino.dev:2224/n.telpukhovsky/leinoctl.git`
- Preserved target base: `c88a7573d6f78973161c9fc639b0e0a2e18afd35`
- Remote `main` after ordinary non-force push:
  `849e7c48a3172e270690f4490ab0e192687316c3`
- Munchkin lifecycle commit: the single completion commit containing this
  handoff and the archived P01 plan; use `git log -1 --oneline` after handoff.
  Its own final SHA cannot be embedded in the file that determines that SHA.

The standalone root contains the exact 40-file `tools/leinoctl` payload plus
three declared bootstrap additions:

- `LICENSE.md` — byte-identical Munchkin MIT license;
- `PROVENANCE.md` — source SHA, extraction command, five original-to-split
  mappings, 40-file SHA-256 manifest and P02 boundary;
- `docs/bootstrap/GITLAB_INITIAL_README.md` — byte-identical GitLab template
  README from the preserved initial commit.

## Verification

- Exact remote/default branch/pre-push tip and non-force ancestry gates passed.
- Source/split mode and blob trees match for all 40 files; all recorded
  SHA-256 payload hashes matched; `git fsck` passed.
- Candidate and post-push fresh clone passed CLI help and ESM import smokes.
- `npm pack --dry-run --ignore-scripts --json` reported the complete 43-entry
  package file list. A disposable npm cache was used after the user's existing
  `~/.npm` cache reported root-owned files; no ownership or dependency change
  was made.
- Fresh clone resolved `main` and `origin/main` to
  `849e7c48a3172e270690f4490ab0e192687316c3`, retained `c88a757` as an
  ancestor, preserved both README hashes and was clean after smoke.
- Munchkin hook tests, generic `leinoctl` tests, plan-lint, toolchain preflight,
  text-check and canonical `verify --changed` passed before push and after
  pre-push evidence edits. Final lifecycle verify/scope-check are recorded in
  the archived plan and guarded release state.

## Boundaries and remaining risks

- No npm publication, tag, release, package rename, dependency install,
  vendored-source deletion or Munchkin consumer switch occurred.
- Standalone `test/entrypoints.test.mjs` still assumes the Munchkin root and
  `scripts/dev.sh`; a full standalone harness/test claim is deferred to P02.
- The existing local checkout `/Users/kolyalis/Dev/leinoctl` was not a P01
  mutation target. After the push, its reflog showed an out-of-band
  `pull --tags origin main` at 2026-08-09 14:10:42 MSK; it was observed clean
  at `849e7c48a3172e270690f4490ab0e192687316c3`.
- If a defect is later found in remote `849e7c4`, do not force, delete, revert
  or add a corrective remote commit automatically. Research and approve a
  separate recovery plan.

## Next session

Close this execution session after P01 archive/release/local commit. Start P02
`bootstrap-standalone-leino-product` only in a fresh trusted session rooted in
the standalone repository. Re-read its repository state and create/select an
exact P02 plan there; this handoff is not P02 approval and does not claim that
standalone lifecycle policy or tests are already active.
