# PLAN: export Leino history to standalone repository

- **Plan ID:** `20260809T102027Z-e499aa-export-leino-history-and-create-repository`
- **Статус:** completed
- **Создан:** 2026-08-09 10:20:27 UTC
- **Обновлён:** 2026-08-09 14:02 MSK
- **Владелец:** planning session `019fe608-1b73-72c2-947c-df2f7f7c3562`
- **Repository:** `munchkin`
- **Workspace:** Munchkin controller checkout; disposable extraction clone/ref
- **Ветка:** `main` at `c5732490321a86e4e6804e72c05e27083a7a46d8`
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260808T210727Z-bc4736-rebaseline-leino-product-roadmap`.
- **Блокирует:** будущий отдельный P02 `bootstrap-standalone-leino-product`
- **Связанные ADR/handoff:** `docs/agents/decisions/0010-standalone-leino-product-roadmap.md`, `docs/agents/handoffs/20260809-leino-roadmap-trusted-session.md`, `/Users/kolyalis/Downloads/leino_handoff_bundle/00-COPY-FIRST-MASTER-HANDOFF.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "docs/agents/handoffs/20260809-leino-p01-standalone-bootstrap.md",
    "docs/agents/plans/active/20260809T102027Z-e499aa-export-leino-history-and-create-repository.md",
    "docs/agents/plans/archive/20260809T102027Z-e499aa-export-leino-history-and-create-repository.md"
  ],
  "components": [
    "repository-workflow"
  ],
  "contracts": [
    "leino:history-export-v1",
    "gitlab:standalone-repository-bootstrap-v1"
  ],
  "dependsOn": [
    "20260808T210727Z-bc4736-rebaseline-leino-product-roadmap"
  ],
  "sharedResources": [
    "git:repository-history",
    "gitlab:n.telpukhovsky/leinoctl",
    "repository:plan-registry"
  ]
}
```

## Цель

Экспортировать Git-историю `tools/leinoctl` из Munchkin в заранее созданный
private standalone GitLab repository `n.telpukhovsky/leinoctl`, сохранив vendored source
в Munchkin и не публикуя npm package. Любой push выполняется только после
отдельного exact-effect approval этого plan.

## Критерии приёмки

- [x] До approval подтверждены exact target
      `ssh://git@gitlab.leino.dev:2224/n.telpukhovsky/leinoctl.git`, visibility
      `private`,
      default branch `main` и доступ пользователя; существующий initial commit
      `c88a7573d6f78973161c9fc639b0e0a2e18afd35` учтён явно и не
      перезаписывается force push.
- [x] История `tools/leinoctl` экспортирована воспроизводимой Git-native
      процедурой через disposable clone/ref без rewrite Munchkin branches/tags.
- [x] Standalone repository содержит в корне все 40 tracked package files из
      `tools/leinoctl` source commit; mode/blob tree и SHA-256 payload manifest
      совпадают, кроме отдельно перечисленных bootstrap additions.
- [x] Bootstrap provenance фиксирует source repository/commit/plan, license
      provenance/hash, exact extraction method, 40-file manifest, pre-existing
      target commit и ограничение, что standalone harness/tests создаются
      только отдельным P02.
- [x] GitLab template `README.md` из `c88a757` сохранён как
      `docs/bootstrap/GITLAB_INITIAL_README.md`; exported package `README.md`
      становится root README без потери initial commit/content; preserved file
      SHA-256 равен `6f200ae5f77c00d636b723464bf8a9a1bffc8c35dbcb5da3c5def93916a300c5`.
- [x] Munchkin `tools/leinoctl` остаётся текущим source used by Munchkin до P04;
      imports/wrappers и package metadata в Munchkin не переключаются.
- [x] Не выполняются publication ни в private internal, ни в public npm
      registry, package rename, release tag, dependency installation,
      vendored-source deletion или feature changes.
- [x] External mutation выполняется только после approval с exact plan ID,
      GitLab owner/name, visibility и явным разрешением non-force push.
- [x] После push получены remote commit SHA и clean-clone import/CLI/pack smoke
      evidence; полный standalone test suite явно deferred to P02, а Munchkin
      source suite проходит в исходном repository.
- [x] Все feasible source/candidate/Munchkin checks и declared toolchain
      readiness проходят до push. После успешного push remote SHA записывается
      немедленно; failed post-push smoke/canonical/lifecycle evidence оставляет
      P01 `in_progress`, не вызывает automatic remote commit/revert/delete и
      требует отдельного approved recovery plan для remote correction.

## Контекст и подтверждённое состояние

- Planning preflight: Munchkin worktree был clean, branch `main`, HEAD
  `c5732490321a86e4e6804e72c05e27083a7a46d8`; registry issues отсутствуют.
- Exact completed dependency P00 находится в archive со status `completed`.
- `./leinoctl context` отнёс scope к `repository-workflow`; два active
  infrastructure drafts не eligible и не заявляют `tools/leinoctl`, Git
  history или standalone remote, но разделяют registry lifecycle surface.
- Пользователь сообщил о созданном local checkout `/Users/kolyalis/Dev/leinoctl`.
  Read-only inspection показал clean `main`, remote
  `ssh://git@gitlab.leino.dev:2224/n.telpukhovsky/leinoctl.git` и один commit
  full SHA `c88a7573d6f78973161c9fc639b0e0a2e18afd35` (`Initial
  commit`), содержащий `README.md` с SHA-256
  `6f200ae5f77c00d636b723464bf8a9a1bffc8c35dbcb5da3c5def93916a300c5`.
- Пользователь подтвердил 2026-08-09: repository visibility — `private`; до
  отдельного полноценного релиза packages будут использовать private internal
  npm registry. Это закрывает P01 visibility fact, но не является approval P01
  и не авторизует registry publication; exact registry endpoint/project/auth
  boundary принадлежит будущему P03 planning preflight.
- Это material уточнение blueprint: proposed GitHub `leinodev/leino` не является
  текущим target; remote creation уже выполнен пользователем вне P01, а target
  не пуст в Git-смысле. Plan не скрывает расхождение и требует exact approval
  amended GitLab target/visibility и non-force integration method.
- `tools/leinoctl` содержит ровно 40 tracked files: `README.md`, `package.json`,
  one bin, 17 source modules, five schemas and 15 tests. Path создан в commit
  `dc0a6df`; его reachable history имеет пять затрагивающих commits, последний
  `569853a`, и не содержит rename records. Source path не менялся между
  `569853a` и pinned source HEAD `c573249`.
- Ordered original full SHAs for provenance mapping are:
  `dc0a6df3126037fd9a6b547364271cc5f68ce8f8`,
  `b469aa12a2677ba27bfe0c42f75ab28120932082`,
  `5c6e895a81b54572b3c40354bc21394c7d2ba3b1`,
  `4383193bddaab203003571c1afc71fb1ac746078`,
  `569853ad60c1dff9be905489a7116b6f8e1eee6b`; execution records the
  corresponding ordered split full SHAs rather than relying on metadata alone.
- `git subtree split` доступен в Git `2.55.0`; `git-filter-repo` не установлен.
  `subtree split` пишет objects/cache даже без named branch, поэтому выполняется
  только в disposable clone, явно от full source SHA, не в Munchkin worktree.
- Full standalone `node --test` сейчас не является valid P01 evidence:
  `test/entrypoints.test.mjs` вычисляет Munchkin root и требует
  `tools/leinoctl/package.json`/`scripts/dev.sh`. P01 не патчит tests; P02
  переносит harness. Package source imports остаются package-local/`node:`.
- Root `LICENSE.md` — MIT, SHA-256
  `da0dbf08038f4a40c0c801c82bdd86236f37fabacee996b78b7c5f6028b9dd3c`,
  и должен быть скопирован идентично. Package metadata
  не имеет dependencies/lifecycle scripts, `files`, `license`, `repository` or
  `author`; P01 сохраняет `package.json` verbatim, а metadata decisions остаются
  P02/P03.
- `./leinoctl preflight` подтвердил Node `24.18.0`, но declared pnpm resolver
  `LEINO_PNPM_EXECUTABLE` сейчас unset; implementation не устанавливает
  dependencies и обязана использовать существующий declared resolver либо
  остановиться до canonical verify.

## Scope

### Входит

- Read-only audit source history, package boundary, license/provenance and
  pre-created target state.
- Reproducible history split/export of `tools/leinoctl` via disposable
  clone/ref without changing Munchkin `main`/tags/remotes.
- Non-force integration with target `c88a757`: preserve its template README at
  `docs/bootstrap/GITLAB_INITIAL_README.md`, then merge split history as a
  second parent so remote `main` advances by ordinary fast-forward.
- Bootstrap `LICENSE.md` and `PROVENANCE.md` metadata in standalone history;
  provenance carries exact 40-file tree/hash evidence and P02 limitations.
- Exact approved push to the named GitLab repository, followed by fresh-clone
  smoke evidence.
- Munchkin lifecycle plan/handoff, canonical verify, scope-check,
  archive/release and one local Munchkin commit after evidence.

### Не входит

- GitHub `leinodev/leino` creation or mutation unless separately amended and
  reapproved; target migration between hosting providers.
- Standalone harness/restructure (P02), package publication/rename/tag (P03),
  Munchkin consumer migration or vendored deletion (P04).
- Любая private/internal или public registry mutation; exact internal registry
  identity, credentials, publishing pipeline and future public-release plan.
- Feature, schema, dependency, hook/config, CI or model-routing changes.
- Force push, Munchkin history rewrite, implicit install, destructive cleanup,
  or treating roadmap/P00 approval as P01 approval.

## Архитектурный подход

- Perform history filtering only in a disposable clone/ref. Preserve Munchkin
  branches, tags, remotes and worktree unchanged except plan/handoff lifecycle.
- In an approved disposable Munchkin clone run
  `git subtree split --prefix=tools/leinoctl --branch=export-leinoctl
  c5732490321a86e4e6804e72c05e27083a7a46d8`; do not use `--onto`, `--all`,
  `filter-branch` or the Munchkin worktree.
- Treat pre-existing GitLab `main` as an authority domain: fetch/verify full
  SHA, create integration branch from that remote commit, move its template
  README to `docs/bootstrap/GITLAB_INITIAL_README.md`, commit the preservation,
  then `git merge --no-ff --allow-unrelated-histories export-leinoctl`.
  Stop on conflict or drift; do not choose `-X ours/theirs` silently.
- Keep package payload derived from the source split. Add only declared
  bootstrap provenance/license metadata. `PROVENANCE.md` records full source
  SHA/method plus ordered mappings from each of the five original full commit
  SHAs to its corresponding split full SHA; validate count/order/mapping as
  well as the 40-file tree and SHA-256 payload.
- P02 begins in a fresh trusted session in standalone repository and creates
  its own lifecycle/harness. This plan does not claim that bootstrap policy is
  active there.

## Затронутые компоненты и контракты

| Компонент | Изменение | Public contract/данные |
|---|---|---|
| Munchkin Git history | Read-only subtree extraction; no branch/tag rewrite | `leino:history-export-v1` |
| private standalone GitLab repository | Non-force bootstrap push after exact approval | `gitlab:standalone-repository-bootstrap-v1` |
| bootstrap metadata | `LICENSE.md`, `PROVENANCE.md`, preserved GitLab README | Product provenance |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/agents/plans/active/20260809T102027Z-e499aa-export-leino-history-and-create-repository.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260809T102027Z-e499aa-export-leino-history-and-create-repository.md` | write | Archived lifecycle |
| `docs/agents/handoffs/20260809-leino-p01-standalone-bootstrap.md` | write | Cross-repository P02 handoff |

### External/local mutation set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| disposable clone/ref outside Munchkin worktree | temporary local mutation | History split and local validation after approval |
| disposable integration/fresh-clone directories | temporary local mutation | Target merge and post-push smoke; deleted only after evidence |
| standalone `README.md` plus 39 other split payload files | target repository mutation | Verbatim 40-file source payload |
| standalone `LICENSE.md` | target repository mutation | Verbatim Munchkin MIT license |
| standalone `PROVENANCE.md` | target repository mutation | Source/tree/license/plan/target provenance and P02 gate |
| standalone `docs/bootstrap/GITLAB_INITIAL_README.md` | target repository mutation | Preserve pre-existing template README content |
| `/Users/kolyalis/Dev/leinoctl` | none | User checkout remains read-only/unchanged |
| `gitlab:n.telpukhovsky/leinoctl` | external mutation | Non-force push to private repository only after exact approval |
| private internal npm registry | none | Explicitly deferred to separately planned/approved P03 |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок |
|---|---|---|---|
| `git:repository-history` | none found in active registry | P01 after approval | exclusive; disposable operations only |
| `gitlab:n.telpukhovsky/leinoctl` | none in Munchkin registry | user-created private target; P01 only after approval | verify full SHA/private visibility, stop on drift |
| private internal npm registry | future P03/P04 | no P01 owner | no access/mutation in P01 |
| `repository:plan-registry` | two active infrastructure drafts | lifecycle owners | plan-file-only overlap; serialize lifecycle operations |

### Проверка конфликтов

- **Проверены active plans:**
  `20260731T005309Z-569b95-infrastructure-p1-bonus-hardening` and
  `20260731T005309Z-784d5e-infrastructure-p2-platform-evolution`, both draft,
  not eligible, no lifecycle owner record and no overlapping product/history
  write paths.
- **Пересечения:** shared `repository:plan-registry` only. The target remote's
  initial commit is not another plan but is an external-state integration
  constraint.
- **Решение:** exclusive P01 lifecycle; do not alter infrastructure plans.
  Remote identity/private visibility or SHA drift is a hard stop and material reapproval.

## Delegation strategy

- **Classification:** large — planning delegation required.
- **Причина:** independent history-preservation, package-boundary/provenance and
  external-authority/recovery workstreams; an error could rewrite history or
  publish to the wrong durable target.
- **Root parallel work:** finalize dependency/conflict mapping, contracts,
  acceptance criteria, verification and exact approval boundary while agents
  inspect bounded evidence.
- **Write boundary:** every package is `read-only` with `write_set: []`;
  implementation remains `root-only pending worktree orchestration`.

### Preliminary work packages

#### `history-method-audit`

- **Package / role / model / effort:** requested explorer / Luna / high;
  executed as read-only reviewer / Terra / high after runner returned
  `Unknown model gpt-5.6-luna` twice.
- **Bounded scope и context/history:** inspect exact Munchkin Git history and
  `tools/leinoctl` layout; compare safe locally available split/filter methods.
- **Independent from:** root resolves remote target, approval and lifecycle.
- **Access / write set:** `read-only` / `[]`.
- **Expected output:** path/command-backed method recommendation, validation
  design, failure modes and stop conditions.
- **Stop condition:** return concise evidence or stop on scope ambiguity; no
  edits, refs, clones, agents, network or external mutations.
- **Root parallel work:** resolve contracts, target drift and planned checks.
- **Expected savings:** isolate noisy Git-history research from plan synthesis.

#### `package-provenance-audit`

- **Package / role / model / effort:** requested explorer / Luna / high;
  executed as read-only reviewer / Terra / high after the same availability
  failure; no writable worker fallback.
- **Bounded scope и context/history:** inspect `tools/leinoctl` package,
  root license and direct profile/schema/tests for standalone assumptions.
- **Independent from:** history method and remote authority review.
- **Access / write set:** `read-only` / `[]`.
- **Expected output:** exact payload/hash set, license/provenance requirements,
  Munchkin-relative blockers for P02 and focused smoke commands.
- **Stop condition:** return path-backed findings; no edits, installs, commands
  that mutate dependencies, agents or network.
- **Root parallel work:** refine external mutation and rollback semantics.
- **Expected savings:** avoid loading all package/test internals into root.

#### `bootstrap-security-review`

- **Package / role / model / effort:** `bootstrap-security-review` / reviewer / Terra / high.
- **Bounded scope и context/history:** inspect current plan after synthesis for
  target identity, visibility, existing-commit integration, no-force,
  recovery, provenance and evidence gaps.
- **Independent from:** explorers collect facts; this package adversarially
  reviews the whole synthesized plan.
- **Access / write set:** `read-only` / `[]`.
- **Expected output:** severity-ranked findings with exact section/path and
  required closure before approval.
- **Stop condition:** review only the named plan/current evidence; no edits,
  agents, network or external mutations.
- **Root parallel work:** run context/plan-lint consistency and close findings.
- **Expected savings:** independent authority/recovery check before approval.

### Actual delegation evidence

| Package | Result | Evidence/findings | Влияние на plan |
|---|---|---|---|
| `history-method-audit` | completed read-only | Five path commits/no renames; `git subtree split` available, `git-filter-repo` absent; preserve target README by rename, merge unrelated split as second parent, require tree/history/ancestor gates | Selected exact disposable split/non-force merge; prohibited `--onto`, silent README resolution and Munchkin ref writes |
| `package-provenance-audit` | completed read-only | 40-file payload; identical MIT `LICENSE.md`; no deps/scripts/files/license metadata; full standalone tests depend on Munchkin root, while help/import/pack smoke is valid | Expanded payload/hash/provenance and deferred standalone test relocation to P02 without source patch |
| `bootstrap-security-review` | completed read-only | No P0; required post-push recovery contract, full remote-tip/ancestor gate, original→split five-commit mapping, README/license hashes | Closed in acceptance, architecture, steps, checks and risks; private visibility subsequently confirmed by user |

- **Adversarial review:** completed with three P1 and two P2 findings; all
  technical findings are incorporated. User subsequently confirmed private
  visibility; plan is ready for exact P01 approval.

## План реализации

1. [x] Reverify clean Munchkin state/pinned source SHA and exact GitLab URL,
       private visibility, default branch, access and
       `origin/main == c88a7573d6f78973161c9fc639b0e0a2e18afd35`; fetch
       remote `refs/heads/main` into a disposable ref, never trust stale local
       tracking state.
2. [x] Resolve the existing declared pnpm executable and pass preflight plus
       all feasible Munchkin source/harness checks before any external mutation;
       do not install or push while toolchain readiness is unresolved.
3. [x] Clone Munchkin into a unique temporary directory and run the exact
       `git subtree split` command into `export-leinoctl`; never split in the
       controller worktree.
4. [x] Validate 40-path tree mode/blob equality, fsck, SHA-256 payload and
       ordered five-entry original-full-SHA→split-full-SHA mapping against the
       pinned source; record the mapping in `PROVENANCE.md`.
5. [x] Build an integration branch from fetched target `main`; move the target
       template README to `docs/bootstrap/GITLAB_INITIAL_README.md`, commit it,
       and merge `export-leinoctl` with `--no-ff --allow-unrelated-histories`.
6. [x] Add identical `LICENSE.md` and bounded `PROVENANCE.md`; verify exported
       40 files remain verbatim, exact README/license hashes match and full
       initial SHA is an ancestor of candidate HEAD. Run candidate help/import/
       pack smoke and pre-push canonical Munchkin verification.
7. [x] Immediately before push fetch the remote branch again, require the full
       current remote tip equals the approved/recorded SHA and require
       `git merge-base --is-ancestor <current-remote-tip> HEAD`; after exact
       approval push ordinary `HEAD:main` without force/force-with-lease.
8. [x] Immediately record returned/current remote SHA. Fresh-clone remote to
       temp; run help/import/pack smoke using existing
       Node/npm without install, and record the complete pack file list.
9. [x] Record source/remote SHAs, commands, limitations and P02 handoff; rerun
       final canonical Munchkin checks after final evidence edits.
10. [x] If any post-push smoke/canonical/lifecycle check fails, leave P01
        `in_progress`, preserve evidence, make no automatic remote correction
        and require a separate recovery plan. Otherwise complete/archive/release
        P01 and create one local Munchkin commit; no additional push/publication.

## Проверки

- [x] Exact remote URL, private visibility, default branch and pre/post remote SHA.
- [x] Exact 40-file mode/blob tree comparison plus SHA-256 manifest against
      Munchkin source commit; only declared bootstrap files are additional.
- [x] Ordered mapping/count of five original full commit SHAs to split full
      SHAs, plus author/date/message comparison and `git fsck`.
- [x] Preserved README equals
      `c88a7573d6f78973161c9fc639b0e0a2e18afd35:README.md` byte-for-byte
      and matches recorded SHA-256; copied MIT license matches recorded SHA-256.
- [x] Immediately pre-push fetched remote tip equals full expected SHA and
      `git merge-base --is-ancestor <current-remote-tip> HEAD`; ordinary push
      rejects any remote drift/non-fast-forward.
- [x] Candidate `node bin/leinoctl.mjs --help`.
- [x] Candidate `node --input-type=module -e 'import("./src/index.mjs")'`.
- [x] Candidate `npm pack --dry-run --ignore-scripts --json`; record complete
      package file list without publication/install.
- [x] Post-push fresh clone repeated CLI help, ESM import and complete
      `npm pack --dry-run --ignore-scripts --json` smokes without install.
- [x] Explicit P02 blocker for Munchkin-relative `test/entrypoints.test.mjs`;
      no claim that full standalone tests pass under P01.
- [x] `node --test --test-isolation=none .codex/hooks/test/*.test.mjs`.
- [x] `(cd tools/leinoctl && node --test)`.
- [x] `node .codex/hooks/plan-lint.mjs`.
- [x] `./leinoctl preflight` and `./leinoctl text-check --changed`.
- [x] `./leinoctl verify --changed` with declared existing pnpm resolver.
- [x] `./leinoctl scope-check --plan 20260809T102027Z-e499aa-export-leino-history-and-create-repository`.
- [x] `git diff --check` and final source/target clean-state review.

## Риски и откат

- **Риск:** wrong remote, private visibility or credential authority.
  **Снижение/откат:** exact approval repeats GitLab target/private visibility; verify
  fetched URL/SHA immediately before push; no push on mismatch.
- **Риск:** pre-existing commit/README is lost or histories are combined
  ambiguously. **Снижение/откат:** preserve README at exact bootstrap path,
  merge with explicit unrelated-history commit, prove initial SHA ancestry;
  no force and stop on conflict/drift/non-fast-forward.
- **Риск:** Munchkin main/tags/remotes are rewritten. **Снижение/откат:** all
  filtering occurs in disposable clone/ref; compare Munchkin refs before/after.
- **Риск:** extracted payload silently diverges. **Снижение/откат:** source SHA,
  deterministic path list and hashes; reject mismatch before push.
- **Риск:** bootstrap is treated as released/production-ready.
  **Снижение/откат:** provenance and P02/P03 gates; no tag or publication.
- **Риск:** unavailable tool or package has Munchkin-relative assumptions.
  **Снижение/откат:** full standalone tests are an explicit P02 blocker; P01
  runs only valid smoke and does not patch code/tests ad hoc.
- **Риск:** push succeeds but clean-clone/canonical/lifecycle evidence fails.
  **Снижение/откат:** run every feasible gate pre-push and record remote SHA
  immediately. Keep P01 `in_progress`; never auto-force, delete, revert or add
  corrective remote commits. Any remote correction requires a separately
  researched and approved recovery plan.

## Открытые вопросы

- P01 open questions: none. Remote SHA/visibility drift after approval still
  requires reapproval.
- Exact private internal npm registry URL/project ID/auth and the future public
  release boundary are deliberately deferred to separate P03 planning; they do
  not block or expand P01.

## Согласование

- **Статус:** approved.
- **Запрошено:** 2026-08-09 14:02 MSK; exact P01 ID, private GitLab target,
  expected initial SHA, ordinary non-force push and explicit non-goals below.
- **Подтверждено:** пользователь сообщил о checkout и подтвердил private
  repository/private internal npm registry policy; это prerequisite/evidence,
  не approval P01.
- **Approval получен:** 2026-08-09 14:02 MSK. Пользователь написал
  `даю аппрув на план`, потребовал сначала применить exact master handoff и
  выполнить только plan
  `20260809T102027Z-e499aa-export-leino-history-and-create-repository`. В том
  же execution prompt повторены exact GitLab remote
  `ssh://git@gitlab.leino.dev:2224/n.telpukhovsky/leinoctl.git`, expected
  `main` at `c88a757`, preservation initial commit/template README,
  ordinary non-force integration, запреты vendored-source deletion, npm
  publication, force/force-with-lease и stop-on-drift boundary. Approval
  включает exact-effect ordinary push, предусмотренный этим plan, и не
  расширяет его scope/non-goals.
- **Формулировка/ограничения:** `Согласовываю plan 20260809T102027Z-e499aa-export-leino-history-and-create-repository: разрешаю root выполнить P01 для private GitLab repository n.telpukhovsky/leinoctl по remote ssh://git@gitlab.leino.dev:2224/n.telpukhovsky/leinoctl.git при expected main SHA c88a7573d6f78973161c9fc639b0e0a2e18afd35, сохранить initial commit и его README и выполнить только ordinary non-force push после всех pre-push checks; запрещены force/force-with-lease, публикация в private internal или public npm registry, dependency install, package rename/tag/release, удаление Munchkin tools/leinoctl и automatic remote recovery; после push действовать только по recorded recovery gate.`

## Ход выполнения

- Skeleton создан planning session
  `019fe608-1b73-72c2-947c-df2f7f7c3562`; до approval implementation,
  select, push and external mutation не начинались.
- Execution session `019fe62d-3333-7ca0-aa28-54ef62ce20ca` read-only
  проверила planning task через Codex thread registry: предыдущая session
  `idle`, её последний turn completed и оставил P01 `awaiting_approval`.
  Выполнен documented exact takeover только этого plan; owner record содержит
  `takenOverFrom` planning session.
- Live preflight подтвердил Munchkin `main` at exact pinned source SHA,
  completed archived P00, lint-clean registry, exact SSH remote access и
  `refs/heads/main == c88a7573d6f78973161c9fc639b0e0a2e18afd35`.
  GitLab web без authentication не открывает project, что исключает public
  visibility; exact `private` остаётся user-confirmed authority из planning
  evidence. Bundled pnpm resolver `11.16.0` передан только через declared
  `LEINO_PNPM_EXECUTABLE`; dependencies не устанавливались.
- Approval записан, plan переведён в `approved`, lint повторно прошёл с
  `issues=0`, затем exact plan выбран текущей execution session и переведён в
  `in_progress`.
- Pre-push Munchkin checks: 44 hook tests passed; 81 generic `leinoctl` tests
  passed; plan-lint returned `issues=0`; declared toolchain preflight, text
  check and canonical `verify --changed` passed. Ledger recorded
  `codex-harness-tests`, `leinoctl-tests` and `plan-lint` with exit code 0.
- Disposable root: `/private/tmp/leino-p01.yelxAk`. Exact split produced tip
  `6f35b0878cb69ebda8d000f96f2f7d5b9e98b5a0`; `git fsck` completed, source
  and split contain five mapped commits, and all 40 mode/blob entries plus
  SHA-256 payloads match the pinned source.
- Candidate integration is based on `c88a7573d6f78973161c9fc639b0e0a2e18afd35`.
  Preservation commit is `22e17d6`, unrelated-history merge commit is
  `4119a3f`, and bootstrap provenance candidate is
  `849e7c48a3172e270690f4490ab0e192687316c3`. Initial SHA is an ancestor;
  candidate has 43 files: 40 exact payload files and the three declared
  bootstrap additions.
- Candidate CLI help and ESM import smokes passed. First `npm pack --dry-run`
  hit the user's pre-existing root-owned `~/.npm` cache; no ownership change,
  install or cleanup was attempted. Re-run with disposable
  `npm_config_cache=/private/tmp/leino-p01.yelxAk/npm-cache` passed and reported
  all 43 package entries. License, preserved GitLab README and exported root
  README SHA-256 values match the plan.
- Immediately before push, `origin/main` was freshly fetched and equalled full
  approved SHA `c88a7573d6f78973161c9fc639b0e0a2e18afd35`; the ancestor gate and
  clean-candidate gate passed. Ordinary `git push origin HEAD:refs/heads/main`
  advanced the remote without force from `c88a757` to full SHA
  `849e7c48a3172e270690f4490ab0e192687316c3`. Immediate `ls-remote` returned
  that same full SHA for `refs/heads/main`.
- Post-push fresh clone resolved both `HEAD` and `origin/main` to full remote
  SHA `849e7c48a3172e270690f4490ab0e192687316c3`, default branch to `main`, and
  preserved initial SHA ancestry. `git fsck`, template README/license byte
  comparisons, CLI help, ESM import and 43-entry pack dry-run passed; the
  fresh worktree remained clean.
- Handoff created at
  `docs/agents/handoffs/20260809-leino-p01-standalone-bootstrap.md` with exact
  source/split/remote SHAs, artifacts, checks, rollback boundary, P02 blocker
  and new-session requirement.
- The explicitly non-target user checkout `/Users/kolyalis/Dev/leinoctl` was
  read-only throughout root commands. After push its reflog showed a separate
  `pull --tags origin main: Fast-forward` at 2026-08-09 14:10:42 MSK; it was
  observed clean at the approved remote SHA. This out-of-band update did not
  alter the P01 candidate, remote authority or Munchkin write set.
- After all split/candidate/fresh-clone evidence was captured, the exact
  disposable root `/private/tmp/leino-p01.yelxAk` and only its P01-created
  clones/caches were removed. No user checkout or repository state was cleaned.

## Итог

- **Outcome:** P01 completed. Exact five-commit `tools/leinoctl` history and
  40-file payload were exported to the pre-created private GitLab repository.
  Existing target commit/template README were preserved through explicit
  non-force integration. Remote `main` is
  `849e7c48a3172e270690f4490ab0e192687316c3`.
- **Artifacts:** standalone `LICENSE.md`, `PROVENANCE.md`, root package payload,
  `docs/bootstrap/GITLAB_INITIAL_README.md`, and Munchkin handoff
  `docs/agents/handoffs/20260809-leino-p01-standalone-bootstrap.md`.
- **Canonical evidence:** final active-state `verify --changed` recorded all
  three required checks with exit code 0. `scope-check` returned
  `outsideWriteSet=[]`, `unledgered=[]`, `missingRequiredChecks=[]` and
  `ok=true`; `git diff --check`, plan-lint, preflight and text-check passed.
  Canonical verify/scope-check are rerun on this final archived content before
  guarded release.
- **Rollback/recovery:** no automatic remote correction is permitted. A defect
  in remote `849e7c4` requires a separately researched and approved recovery
  plan; never force, force-with-lease, delete, or silently add a corrective
  remote commit.
- **Non-goals preserved:** no registry publication, dependency install,
  package rename/tag/release, Munchkin vendored-source deletion, consumer
  migration, full standalone harness claim or additional external mutation.
- **Next session:** P02 begins only in a fresh trusted standalone-repository
  session after this plan is guarded-released and committed locally.
