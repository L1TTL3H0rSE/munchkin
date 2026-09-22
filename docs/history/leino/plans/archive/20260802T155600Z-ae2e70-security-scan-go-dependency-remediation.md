# PLAN: security scan Go dependency remediation

- **Plan ID:** `20260802T155600Z-ae2e70-security-scan-go-dependency-remediation`
- **Статус:** completed
- **Создан:** 2026-08-02 15:56:00 UTC
- **Обновлён:** 2026-08-02 19:31:00 UTC
- **Владелец:** Codex
- **Workspace:** `C:\Dev\_Personal\_Pet\munchkin`
- **Ветка:** `main`
- **Режим параллельности:** exclusive
- **Зависит от:** plan `20260731T005308Z-3beea1-production-security-and-supply-chain`.
- **Блокирует:** production image publication and first deploy evidence
- **Связанные ADR/handoff:** `docs/operations/PRODUCTION_DEPLOYMENT.md`

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "backend/game/go.mod",
    "backend/game/go.sum",
    "scripts/ci/security-scan.sh",
    "docs/agents/plans/active/20260802T155600Z-ae2e70-security-scan-go-dependency-remediation.md",
    "docs/agents/plans/archive/20260802T155600Z-ae2e70-security-scan-go-dependency-remediation.md"
  ],
  "components": ["go:backend/game", "repository-workflow"],
  "contracts": [],
  "dependsOn": ["20260731T005308Z-3beea1-production-security-and-supply-chain"],
  "sharedResources": ["go:backend/game", "ci:security-scan"]
}
```

## Цель

Устранить подтверждённые CRITICAL/HIGH findings в Go dependency graph и
исправить несовместимый с Trivy `0.70.0` флаг в `config`-сканере, сохранив
блокирующую security policy без ignore-исключений и без ослабления scanner set.

## Критерии приёмки

- [x] `github.com/jackc/pgx/v5` обновлён не ниже `v5.9.0`; `golang.org/x/net`,
      `golang.org/x/text` и `google.golang.org/grpc` обновлены до версий,
      закрывающих зафиксированные findings, с согласованным `go.mod`/`go.sum`.
- [x] `trivy config` больше не получает неподдерживаемый `--no-progress`;
      `--exit-code 1`, severity threshold `CRITICAL,HIGH` и scanners policy
      остаются без ослабления.
- [x] Нет новых ignore rules, снижения severity, отключения `vuln`, `misconfig`
      или `secret`, а также обхода `exit code 1`.
- [x] Backend tests, repository workflow checks и доступные pinned security
      checks проходят; Linux-only wrapper не может исполняться на Windows и
      оставлен отдельным обязательным CI gate после push.
- [x] Scope-check подтверждает, что изменены только указанные paths.

## Контекст и подтверждённое состояние

- На commit `f04ada251af81376489a61b4ca902de13458f5e3` Gitleaks сообщил
  `no leaks found`, но Trivy завершил job с `exit code 1`.
- Read-only запуск Trivy `0.70.0` с официально проверенным Windows asset
  показал в `backend/game/go.mod`:
  - `github.com/jackc/pgx/v5 v5.8.0`: `CVE-2026-33815` и `CVE-2026-33816`,
    CRITICAL; fixed `v5.9.0`.
  - `golang.org/x/net v0.52.0`: `CVE-2026-25681`, `CVE-2026-27136`,
    `CVE-2026-33814`, `CVE-2026-39821`, HIGH; fixed `v0.55.0`.
  - `golang.org/x/text v0.35.0`: `CVE-2026-56852`, HIGH; fixed `v0.39.0`.
  - `google.golang.org/grpc v1.80.0`: `GHSA-hrxh-6v49-42gf`, HIGH; fixed
    `v1.82.1`.
- The same Trivy release rejected `--no-progress` for `trivy config` with
  `unknown flag`; the current wrapper would hit this after the dependency
  findings are cleared.
- Terraform missing-variable messages and Trivy version notice are warnings,
  not the root cause of this failure.
- No VM, cloud, DNS, Lockbox, GitHub settings, Registry, secret, commit or
  push operation was performed during diagnosis.

## Scope

### Входит

- Targeted Go module version remediation in `backend/game/go.mod` and
  `backend/game/go.sum`.
- Remove only the unsupported `--no-progress` argument from the `trivy config`
  invocation in `scripts/ci/security-scan.sh`.
- Focused backend/workflow/security verification and lifecycle evidence.

### Не входит

- VM bootstrap, application secret insertion, deployment, rollback or Docker
  runtime operations.
- Terraform, Yandex Cloud, DNS/NS, Lockbox, GitHub environment/settings,
  Registry publication or image deletion.
- Changes to `.github/workflows/security.yml`, scanner severity policy,
  `.trivyignore`, dependency-suppression policy, or unrelated dependencies.
- Remote Terraform, DNS/NS, Lockbox, GitHub settings, VM, Registry publication
  and deploy remain outside this source plan and require successor plans.
  The owner separately authorized this plan's lifecycle, local commit and
  push after completion.

## Архитектурный подход

- Upgrade the direct `pgx` requirement and the affected indirect modules only;
  use Go `1.25.1` and review resolver output for unrelated upgrades.
- Keep the backend runtime, engine authority, replay, persistence contracts and
  public API unchanged; dependency-only changes receive `go test ./...`.
- Keep Trivy `fs` and `config` as separate fail-closed commands. The config
  output flag correction changes only CLI compatibility, not policy.

## Затронутые компоненты и контракты

| Компонент | Изменение | Public contract/данные |
|---|---|---|
| `go:backend/game` | Fixed dependency versions and checksums | No game/API/persistence contract change |
| `repository-workflow` | Trivy config CLI compatibility | CRITICAL/HIGH blocking policy preserved |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `backend/game/go.mod` | write | Fixed Go dependency requirements |
| `backend/game/go.sum` | write | Checksums for resolved dependency graph |
| `scripts/ci/security-scan.sh` | write | Remove unsupported Trivy config flag |
| `docs/agents/plans/active/20260802T155600Z-ae2e70-security-scan-go-dependency-remediation.md` | write | Active lifecycle |
| `docs/agents/plans/archive/20260802T155600Z-ae2e70-security-scan-go-dependency-remediation.md` | write | Archived lifecycle |

### Shared resources

| Ресурс | Другие plans | Владелец | Порядок |
|---|---|---|---|
| `go:backend/game` | backend/frontend consumers | this plan | Dependency-only, no API change |
| `ci:security-scan` | production release | this plan | Complete before image publication |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-02 через `leinoctl context` и
  `plan relevant` для exact write paths.
- **Пересечения:** активные frontend redesign plans не владеют backend Go или
  scanner paths; infrastructure P1/P2 plans остаются draft/deferred.
- **Решение:** exclusive plan; no remote or deployment work may be folded into
  this remediation.

## План реализации

1. [x] Record the exact dependency diff and update only the four affected
      module lines plus generated checksums.
2. [x] Remove only `--no-progress` from the `trivy config` command.
3. [x] Run `go test ./...` from `backend/game` and the full local scanner with
      the pinned tool contract; inspect OSV and govulncheck results too.
4. [x] Run canonical repository verification and review `git diff --check`.
5. [x] Run `scope-check`, mark completed, archive and guarded-release the plan.
6. [x] Complete the guarded-release handoff; the separately authorized local
     commit and push follow immediately, while CI Linux wrapper evidence
     remains the next release gate.

## Проверки

- [x] `go test ./...` from `backend/game` — passed.
- [x] Pinned Trivy `0.70.0` Windows `fs` and `config` scan — both exit 0;
      zero CRITICAL/HIGH vulnerabilities and zero config failures.
- [x] `govulncheck v1.6.0 -json ./...` — exit 0 with no findings.
- [x] Canonical `./leinoctl verify --changed` — passed with Node `v24.14.0`;
      frontend lint/typecheck/tests/build, backend tests, shell syntax and
      Compose config all exit 0.
- [x] `./leinoctl scope-check --plan 20260802T155600Z-ae2e70-security-scan-go-dependency-remediation` — passed;
      `outsideWriteSet=[]`, `unledgered=[]`, `missingRequiredChecks=[]`.
- [x] `node .codex/hooks/plan-lint.mjs` and `git diff --check` — passed.
- [x] Windows host cannot execute the Linux-only Gitleaks/OSV/Syft wrapper;
      this platform boundary was verified and the authoritative Linux CI run
      remains required after push.

## Риски и откат

- **Риск:** resolver выберет дополнительные module upgrades или обнаружится
  API/behavior incompatibility. **Снижение:** targeted update, diff review and
  full backend tests; stop and request amendment if scope expands.
- **Риск:** removing the unsupported flag hides progress output only.
  **Снижение:** keep JSON/SARIF output, separate command failure and exact
  severity threshold unchanged.
- **Откат:** revert the three source dependency/scanner changes before commit;
  no remote state is changed by this plan.

## Открытые вопросы

- If the Linux CI wrapper reports a different vulnerable module, stop and
  create a successor remediation plan rather than adding an unreviewed change.
- Remote CI rerun, image publication and deploy are successor release gates.

## Согласование

- **Статус:** approved; implementation completed
- **Запрошено:** 2026-08-02 15:56:00 UTC
- **Подтверждено:** 2026-08-02; пользователь одобрил exact plan ID и разрешил
  менять только `backend/game/go.mod`, `backend/game/go.sum` и
  `scripts/ci/security-scan.sh`, выполнить `go test`, полный security scan,
  canonical verify и scope-check.
- **Формулировка/ограничения:** текущий source write set остаётся ровно
  `backend/game/go.mod`, `backend/game/go.sum` и
  `scripts/ci/security-scan.sh`. Последним сообщением пользователь разрешил
  lifecycle changes, successor plans, local commit и push; remote mutations
  выполняются только по их отдельным exact plans.

## Ход выполнения

- Approval recorded after read-only Trivy reproduction; lifecycle owner was
  repaired, implementation completed, and all repository gates passed.
- `go.mod` now uses `pgx/v5 v5.9.0`, `x/net v0.55.0`, `x/text v0.39.0` and
  `grpc v1.82.1`; `go mod tidy` synchronized the required transitive sums.
- `trivy config` no longer receives the unsupported `--no-progress` flag;
  scanner severity/scanner set and fail-closed exit policy are unchanged.

## Итог

Source remediation is complete and remains limited to the approved three
files. Local verification is green; the Linux CI run after push is required
to close the platform-specific wrapper evidence and produce release digests.
