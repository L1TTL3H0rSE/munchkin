# PLAN: host bootstrap gateway idempotence

- **Plan ID:** `20260802T151748Z-2949c1-host-bootstrap-gateway-idempotence`
- **Статус:** completed
- **Создан:** 2026-08-02 15:17:48 UTC
- **Обновлён:** 2026-08-02 15:17:48 UTC
- **Владелец:** Codex
- **Workspace:** shared
- **Ветка:** current
- **Режим параллельности:** conditional
- **Зависит от:** нет
- **Блокирует:** нет
- **Связанные ADR/handoff:** —

## Machine-readable manifest

```json
{
  "schemaVersion": 1,
  "paths": [
    "scripts/production/bootstrap-host.sh",
    "docs/agents/plans/active/20260802T151748Z-2949c1-host-bootstrap-gateway-idempotence.md",
    "docs/agents/plans/archive/20260802T151748Z-2949c1-host-bootstrap-gateway-idempotence.md"
  ],
  "components": [],
  "contracts": [],
  "dependsOn": [],
  "sharedResources": []
}
```

## Цель

Исправить production host bootstrap так, чтобы выделенный deploy-user после
идемпотентного bootstrap использовал forced-command gateway как login shell,
а сам gateway был исполняем deploy-user без расширения прав.

## Критерии приёмки

- [x] После bootstrap `munchkin-deploy` имеет shell
      `/usr/local/sbin/munchkin-deploy-gateway`.
- [x] Gateway принадлежит `root:root`, имеет режим `0755` и не writable для
      deploy-user; allowlist остаётся root-owned `0750` и запускается только
      через `sudo`.
- [x] Bootstrap сохраняет forced-command, no-forwarding/no-pty ограничения,
      отсутствие docker group и idempotent replacement `authorized_keys`.
- [x] Source-only проверка проходит для изменённого shell script и lifecycle
      scope; production VM mutation, secrets, deploy и containers не запускаются.

## Контекст и подтверждённое состояние

- `scripts/production/bootstrap-host.sh` создаёт/обновляет deploy-user с
  `/usr/sbin/nologin`, а затем оставляет этот shell после установки gateway.
  В результате SSH forced command не может быть выполнен.
- Gateway создаётся root-owned с `0750`, поэтому даже после исправления shell
  deploy-user не может его исполнять.
- На VM host-only repair уже был выполнен отдельно: shell переключён на
  gateway и gateway сделан `0755`; этот plan переносит исправление в source.
- Production release preflight выполняется отдельно. Последний CI run прошёл
  базовые проверки, но publish immutable image pair остановился на security
  scan; deploy не может быть запущен без image digests и release evidence.

## Scope

### Входит

- Изменение порядка/режима установки gateway и финальный `usermod` на
  gateway shell в `scripts/production/bootstrap-host.sh`.
- Обязательные repository lifecycle записи, проверки и архивирование этого
  plan.

### Не входит

- Любое прямое изменение VM, SSH/GitHub secrets, password manager или ключей.
- Запуск production workflow, `deploy.sh`, `rollback.sh`, `status.sh`,
  `smoke.sh`, Docker Compose или containers.
- Заполнение application secrets на VM.
- Исправление CI security scan, workflow, image build или registry.
- Изменение allowlist-команд, sudoers policy, compose, systemd и deploy
  protocol.

## Архитектурный подход

- До установки gateway deploy-user временно удерживается в безопасном
  `nologin` состоянии (включая уже существующую учётную запись).
- Gateway устанавливается root-owned с `0755`, чтобы SSH мог выполнить его
  от имени deploy-user; deploy-user не получает права записи.
- После успешной записи gateway shell учётной записи переключается на
  gateway path. Allowlist и sudoers остаются без изменений.
- Повторный запуск повторяет защищённые установки и атомарно заменяет
  `authorized_keys`, не принимая private key или secret payload.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| `scripts/production/bootstrap-host.sh` | Исправить финальный shell deploy-user и executable mode gateway | SSH forced-command boundary сохраняется; новые команды не добавляются |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `scripts/production/bootstrap-host.sh` | write | Source fix for gateway shell and executable mode |
| `docs/agents/plans/active/20260802T151748Z-2949c1-host-bootstrap-gateway-idempotence.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260802T151748Z-2949c1-host-bootstrap-gateway-idempotence.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| Нет | — | — | — |

### Проверка конфликтов

- **Проверены active plans:** 2026-08-02 15:17:48 UTC
- **Обнаруженные пересечения:** нет; active plans относятся к infrastructure
  roadmap и frontend redesign, write set не пересекается.
- **Решение:** выполнять как единственный selected plan; deploy lifecycle
  остаётся отдельной approval-gated операцией и не является частью этого plan.

## План реализации

1. [x] Изменить `bootstrap-host.sh`: gateway `0755`, финальный shell
   deploy-user = gateway path после создания gateway.
2. [x] Просмотреть diff и проверить, что write set не расширился.
3. [x] Выполнить shell syntax check и canonical repository checks.
4. [x] Выполнить `scope-check`, записать фактические результаты, archive и
   guarded release.
5. [ ] Сделать отдельный локальный commit; push не выполнять.

## Проверки

- [x] `bash -n scripts/production/bootstrap-host.sh` — passed через
      `C:\Program Files\Git\bin\bash.exe`.
- [x] `./leinoctl verify --changed` — passed на bundled Node `v24.14.0`;
      canonical `codex-harness-tests`, `leinoctl-tests` и `plan-lint` завершились
      с `exitCode=0`.
- [x] `./leinoctl scope-check --plan 20260802T151748Z-2949c1-host-bootstrap-gateway-idempotence` — passed;
      `outsideWriteSet=[]`, `unledgered=[]`, `failedChecks=[]`,
      `missingRequiredChecks=[]`.
- [x] `node .codex/hooks/plan-lint.mjs` — passed; `plans=62 active=6 archive=56 issues=0`.
- [x] `./leinoctl preflight` — exit 0; штатный process path показал
      предупреждения о системном Node 22, `bash` resolver, unset
      `LEINO_PNPM_EXECUTABLE` и Docker Compose capability. Эти предупреждения
      не относятся к изменённому shell script; deploy/containers не запускались.

## Риски и откат

- **Риск:** изменение login shell может сделать deploy-user недоступным при
  неполной установке gateway.
- **Откат:** source rollback к предыдущему commit; runtime host не меняется
  этим plan. До финального `usermod` gateway существует и проверен как файл.

## Открытые вопросы

- Для production deploy всё ещё требуется новый успешный CI publish с двумя
  digest refs и release evidence; это внешний blocker данного plan.
- VM application secret placeholders не проверяются и не заполняются этим
  plan.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-08-02 15:17:48 UTC
- **Подтверждено:** 2026-08-02; пользователь согласовал пункт 2.
- **Формулировка/ограничения пользователя:** пункт 1 отложен; пункт 3
  сохранён пользователем; пункт 4 согласован отдельно, но deploy не
  выполняется при отсутствии release preconditions.

## Ход выполнения

- Plan approved and completed; source implementation выполнена только в
  указанном write set.
- `scripts/production/bootstrap-host.sh` теперь устанавливает gateway с
  `0755` и после его создания назначает его shell для deploy-user.
- Diff review подтвердил, что изменены только два permission/shell участка.
- VM mutation, GitHub mutation, secrets, deploy и containers не выполнялись.

### Фактические результаты canonical ledger

- `./leinoctl verify --changed`: `ok`; `codex-harness-tests`,
  `leinoctl-tests`, `plan-lint` — `exitCode=0`.
- `./leinoctl scope-check --plan 20260802T151748Z-2949c1-host-bootstrap-gateway-idempotence`:
  `ok`; `outsideWriteSet=[]`, `unledgered=[]`, `missingRequiredChecks=[]`.
- `node .codex/hooks/plan-lint.mjs`: `plans=62 active=6 archive=56 issues=0`.
- `git diff --check`: passed.

## Итог

Source fix реализован, focused/canonical repository checks и финальный
scope-check прошли. Plan готов к archive и guarded release; затем нужен
отдельный локальный commit без push. Production deploy остаётся заблокированным
до успешного CI publish immutable image pair/release evidence.
