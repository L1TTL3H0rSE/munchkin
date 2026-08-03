# Контекст для AI-агентов

Этот каталог — компактная навигация repository. Он не заменяет code,
manifests, config, schemas, migrations и tests.

## Быстрый вход

```bash
git status --short
./leinoctl preflight
./leinoctl context --paths <relative-path[,relative-path...]>
```

| Файл | Когда нужен |
|---|---|
| `AGENTS.md` | Всегда: planning, safety, content boundary |
| `STACK.md` | Перед выбором runtime/dependency |
| `ARCHITECTURE.md` | Engine, authority, replay, privacy, persistence |
| `FRONTEND_ENGINEERING_SPEC.md` | Нормативные frontend architecture, code, markup, CSS, responsive и review rules |
| `GAME_UI_UX_SPEC.md` | Product lobby/game layouts, visual direction, interaction surfaces, motion и responsive viewport/state verification |
| `INFRASTRUCTURE_ROADMAP.md` | Production deployment, observability, recovery и конкурсный backlog |
| `../operations/YANDEX_CLOUD_TERRAFORM_BOOTSTRAP.md` | Owner prerequisites до первого Yandex Cloud/Terraform implementation plan |
| `HARNESS.md` | Hooks, selected plan, ledger, CI |
| `DELEGATION.md` | Large/small criteria, planning packages и model routing |
| `PROJECT_MEMORY.md` | Подтверждённые устойчивые ловушки |
| `plans/README.md` | Plan lifecycle и manifests |
| `decisions/` | Принятые сквозные решения |
| `handoffs/` | Контекст длинной незавершённой задачи |
| `backend/AGENTS.md` | Go engine/service правила |
| `frontend/AGENTS.md` | Nuxt/pnpm/contract правила |
| `content/AGENTS.md` | Pack/schema/licensing правила |

## Источники истины

1. executable code, manifests, config, schemas, migrations и tests;
2. согласованный active plan — только для ожидаемого scope;
3. принятые ADR;
4. scoped AGENTS и карты этого каталога;
5. README компонентов;
6. handoff/archive/несогласованные plans.

План описывает желаемое состояние и не доказывает реализацию.

## Рабочий цикл

Перед записью создай draft через `./leinoctl plan create`, согласуй точный ID,
запиши approval и выбери plan через `./leinoctl plan select`. Меняй только
write set. Перед завершением выполни canonical verify и scope-check, запиши
результаты и перенеси completed plan в archive.

В `PROJECT_MEMORY.md` сохраняй только подтверждённый неочевидный факт или
ловушку со ссылкой и датой. Scope/progress живёт в plan, причина решения — в
ADR, завершённая история — в Git.
