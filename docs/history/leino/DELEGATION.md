# Делегирование при планировании

Этот документ задаёт постоянный workflow для planning agents. Конкретный plan
хранит только решение о делегировании, ограниченные work packages и фактические
результаты. Сабагенты поставляют evidence; scope, архитектура, approval и все
repository writes остаются ответственностью root.

## Классификация задачи

До запроса approval каждый plan получает `Delegation strategy` и одну из
классификаций:

- **large — planning delegation required**, если есть два или больше
  независимых workstreams, затронуты несколько компонентов/контрактов,
  неоднозначны ownership или границы, либо ошибка несёт повышенный риск для
  security, privacy, replay, migrations, release или lifecycle;
- **small — not needed**, только если задача имеет один узкий workstream,
  очевидный owner и низкий contract/risk impact. Plan обязан записать
  конкретную причину, почему независимый research или review ничего не даст.

Длина Markdown, число файлов и наличие свободного agent slot сами по себе не
делают задачу большой или маленькой.

## Последовательность

1. Root читает инструкции, проверяет dirty state и вызывает
   `leinoctl context --paths ...`.
2. Root создаёт skeleton plan с manifest, предварительными scope/non-goals,
   рисками, write set, shared resources и `Delegation strategy`.
3. Для large plan root до spawn фиксирует независимые read-only work packages:
   вопрос, role/model/effort, bounded scope/context, ожидаемый output, stop
   condition и полезную параллельную работу root.
4. Root запускает только пакеты, которые действительно независимы, и
   параллельно уточняет conflicts, contracts или verification design.
5. Root синтезирует evidence в тот же draft. После появления цельного plan
   отдельный reviewer проверяет scope, риски, контракты и проверки, пока root
   выполняет `context`/`plan-lint` consistency checks.
6. Root записывает фактический результат каждого пакета, устраняет findings и
   только затем показывает exact plan ID для approval.

Small plan не запускает агента ради формальности: он записывает `not needed` и
проверяемую причину. Если исследование обнаружило второй независимый workstream
или существенный риск, plan переклассифицируется в large до approval.

## Routing

| Работа | Default | Когда менять |
|---|---|---|
| synthesis, scope, архитектура, approval | root / Sol | не делегируется |
| узкий поиск фактов с bounded context | Luna explorer, high | остановить и вернуть root при неоднозначности или расширении scope |
| широкий adversarial review plan/контрактов | Terra reviewer, high | повышать effort только при concrete risk/ambiguity |

Routing выбирается по сложности и риску, а не по фиксированной доле токенов.
Luna не получает весь repository или длинную историю, если достаточно точных
путей и вопроса. Reviewer не повторяет exploration: он ищет противоречия,
непокрытые риски и слабые проверки в уже синтезированном draft.

Project config ограничивает глубину `1` и число одновременных threads. Root не
запускает agent, если не может назвать полезную параллельную работу и ожидаемую
экономию времени/контекста.

## Bounded package

Первая строка сообщения агенту содержит JSON без Markdown prefix:

```text
DELEGATION_META {"scope":"Inspect one named contract and its direct tests","independent_from":"Root is resolving scope and conflicts","root_parallel_work":"Root drafts architecture and verification sections","expected_savings":"The narrow audit runs concurrently and avoids loading unrelated history into root","access":"read-only","stop_condition":"Return path-backed findings and stop without edits","context_turns":"none","write_set":[]}
```

Затем сообщение перечисляет точные пути, вопрос и формат результата. Используй
named profile `explorer` или `reviewer`, явно bounded `fork_turns` и пустой
`write_set`. Agent не редактирует файлы, не commit-ит и не запускает агентов.

## Evidence в plan

До spawn plan хранит preliminary packages, а до approval — фактический итог:

- package/role и переданный bounded scope;
- `completed`, `stopped` или `not run` с причиной;
- краткие evidence-backed findings и влияние на plan;
- результат adversarial review и закрытие findings.

Временные agent/thread IDs не являются долговечным контрактом и не нужны в
plan. Логи, secrets и персональные данные туда не копируются.

## Write boundary

В текущем workflow delegated package всегда `access: read-only` и
`write_set: []`. Возможную будущую запись можно описать в plan только как
`root-only pending worktree orchestration`; исполняет её root. Write-agent,
общий worktree, leases, checkpoint/recovery и controlled integration появятся
только после завершения отдельного worktree-orchestration plan.
