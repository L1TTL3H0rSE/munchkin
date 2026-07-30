# PLAN: record yandex cloud bootstrap facts

- **Plan ID:** `20260730T132310Z-0ce347-record-yandex-cloud-bootstrap-facts`
- **Статус:** completed
- **Создан:** 2026-07-30 13:23:10 UTC
- **Обновлён:** 2026-07-30 13:28:56 UTC
- **Владелец:** Codex `/root`
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
    "docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md",
    "docs/agents/plans/active/20260730T132310Z-0ce347-record-yandex-cloud-bootstrap-facts.md",
    "docs/agents/plans/archive/20260730T132310Z-0ce347-record-yandex-cloud-bootstrap-facts.md"
  ],
  "components": [],
  "contracts": [],
  "dependsOn": [],
  "sharedResources": [
    "operations:yandex-cloud-bootstrap-facts"
  ]
}
```

## Цель

Зафиксировать в owner runbook фактически выполненную подготовку Yandex Cloud и
домена перед первым Terraform implementation slice, не создавая и не изменяя
cloud resources.

## Критерии приёмки

- [x] Таблица решений содержит фактические cloud/folder, zone, budget, domain
  и production hostname.
- [x] Handoff содержит проверенные cloud/folder IDs, Yandex Cloud CLI version,
  registrar/DNS boundary и отсутствие заранее созданных Terraform resources.
- [x] Отдельно отмечено, что карта привязана, но баланс не пополнялся, а budget
  является notification boundary, не hard spending limit.
- [x] Существующие пользовательские отметки bootstrap checklist сохранены и
  согласованы с зафиксированными значениями.
- [x] Не записаны credentials, SSH private key, токены, платёжные реквизиты или
  другие secrets.
- [x] Canonical verify и scope-check проходят.

## Контекст и подтверждённое состояние

- Внешний регистратор: Timeweb; куплен domain `l1ttl3h0rse.ru`.
- Для приложения выбран hostname `munchkin.l1ttl3h0rse.ru`, корень
  `l1ttl3h0rse.ru` зарезервирован под будущую визитку.
- Yandex cloud `munchkin`: `b1gppf0332cb1uanlrqf`.
- Folder `munchkin-prod`: `b1g55l8i2mtpv23b5ql7`.
- Выбранная availability zone: `ru-central1-d`; `yc compute zone list`
  показывает её в статусе `UP`.
- Локальный Yandex Cloud CLI: `1.22.0 windows/amd64`; profile `default`
  активен и указывает на правильные cloud/folder.
- Monthly budget ceiling создан на `5000 RUB`; карта привязана, баланс пока не
  пополнялся.
- В рабочем дереве до plan selection уже были пользовательские отметки
  выполненного bootstrap checklist в целевом runbook; их нельзя очищать или
  приписывать реализации этого plan.

## Scope

### Входит

- Заполнить фактические значения в существующем bootstrap runbook.
- Уточнить итоговый handoff block и owner-visible статус готовности.
- Сохранить различие registrar в Timeweb и будущего authoritative DNS в
  Yandex Cloud DNS.

### Не входит

- Создание Terraform root, state bucket, IAM, network, VM, registry, DNS zone,
  DNS records или других Yandex Cloud resources.
- Смена NS в Timeweb, настройка A/CNAME/TXT, запуск Terraform или сервисов.
- Проверка или запись платёжных реквизитов, credentials и secrets.
- Commit, push и начало следующего implementation plan без отдельного
  согласования.

## Архитектурный подход

- Runbook остаётся единственным owner-facing источником bootstrap prerequisites.
- Фиксируются только наблюдаемые идентификаторы и решения, безопасные для Git.
- Domain остаётся у внешнего registrar; public zone сначала будет создана
  Terraform в Yandex Cloud DNS и только затем получит делегирование NS.
- Budget фиксируется как notification boundary; отсутствие денег на внутреннем
  балансе не трактуется как hard limit или гарантия невозможности списаний.

## Затронутые компоненты и контракты

| Компонент | Изменение | Публичный контракт/данные |
|---|---|---|
| Owner operations documentation | Фактический bootstrap status и handoff | Runtime/API contracts не меняются |

## Координация с другими планами

### Write set

| Путь/ресурс | Режим | Причина |
|---|---|---|
| `docs/operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md` | write | Зафиксировать подтверждённые решения и readiness handoff |
| `docs/agents/plans/active/20260730T132310Z-0ce347-record-yandex-cloud-bootstrap-facts.md` | write | Active lifecycle плана |
| `docs/agents/plans/archive/20260730T132310Z-0ce347-record-yandex-cloud-bootstrap-facts.md` | write | Archived lifecycle плана |

### Shared resources

| Ресурс | Другие планы | Владелец | Порядок/стратегия |
|---|---|---|---|
| `operations:yandex-cloud-bootstrap-facts` | Нет active plans | этот plan | Один короткий documentation update |

### Проверка конфликтов

- **Проверены active plans:** 2026-07-30 13:23:10 UTC
- **Обнаруженные пересечения:** active plans отсутствуют; целевой runbook уже
  содержит пользовательские незакоммиченные checklist-изменения.
- **Решение:** включить runbook целиком в write set, сохранить существующий
  diff и дополнять только фактические значения.

## План реализации

1. [x] Записать фактические решения в таблицу шага 0.
2. [x] Обновить readiness/handoff значениями cloud, folder, zone, domain,
   budget и CLI без secrets.
3. [x] Просмотреть итоговый diff, сохранить пользовательские checklist-правки.
4. [x] Выполнить canonical verify и scope-check.
5. [x] Записать результаты, завершить lifecycle и архивировать plan.

## Проверки

- [x] `node .codex/hooks/plan-lint.mjs`
- [x] `./leinoctl verify --changed`
- [x] `./leinoctl scope-check --plan 20260730T132310Z-0ce347-record-yandex-cloud-bootstrap-facts`
- [x] `git diff --check`

## Риски и откат

- **Риск:** ошибочно представить budget как hard limit или отсутствие
  пополненного баланса как защиту от списаний.
- **Риск:** записать лишние account/payment/credential данные.
- **Риск:** перезаписать пользовательские checklist-отметки.
- **Откат:** отменить только строки, добавленные этим plan, сохранив исходный
  пользовательский diff; cloud resources не затрагиваются.

## Открытые вопросы

- Нет; неизвестные или непроверенные значения не будут угадываться.

## Согласование

- **Статус:** approved
- **Запрошено:** 2026-07-30 13:23:10 UTC
- **Подтверждено:** 2026-07-30
- **Формулировка/ограничения пользователя:** пользователь попросил
  зафиксировать купленный domain и выполненные owner-side bootstrap steps;
  implementation и cloud mutations не запрашивались. Точное согласование:
  «Согласовываю».

## Ход выполнения

- Draft создан атомарно; реализация не начата.
- Пользователь явно согласовал exact plan ID; статус переведён в `in_progress`.
- Предыдущий completed bootstrap-plan был уже archived, а `main` совпадал с
  `origin/main`; выполнены разрешённые release и select нового plan.
- В runbook заполнены фактические cloud/folder IDs, zone, domain/hostnames,
  registrar/DNS boundary, budget/calculator profile и `yc` version.
- Исходные пользовательские отметки Definition of Ready сохранены; никакие
  cloud resources, DNS records или registrar NS не изменялись.
- `plan-lint`, `text-check --changed`, `git diff --check`,
  `leinoctl verify --changed` и `scope-check` прошли. Scope-check подтвердил
  отсутствие путей вне write set и сообщил только ожидаемый warning о
  незафиксированном post-write hook target для существующего baseline diff.
- После archive impact расширился до `repository-workflow`. Первая попытка
  canonical verify на системном Node завершилась ожидаемой environment-ошибкой
  `node: bad option: --test-isolation=none`; исходные файлы при этом не
  менялись.
- Повторный canonical verify на объявленном Node `24.14.0`, pnpm `11.9.0` и
  Git Bash `5.2.37` прошёл: harness `42/42`, leinoctl `63 passed`,
  `1` platform-dependent symlink test skipped, failures `0`; plan-lint:
  `14` plans, `0` issues.

## Итог

- Owner bootstrap readiness зафиксирован в одном runbook без secrets.
- Следующий infrastructure plan получает cloud `munchkin`, folder
  `munchkin-prod`, zone `ru-central1-d`, ceiling `5000 RUB`, domain
  `l1ttl3h0rse.ru` и production hostname `munchkin.l1ttl3h0rse.ru`.
- Делегирование Timeweb -> Yandex Cloud DNS остаётся будущим действием после
  создания public zone и records через Terraform.
