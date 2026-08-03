---
name: repository-workflow-change
description: Plan, implement, and verify changes to AGENTS, Codex hooks, leinoctl, repository profile, component graph, CI, plans, or Compose workflow.
---

# Repository workflow change

1. Run context for exact workflow paths and read `docs/agents/HARNESS.md`.
2. Create a skeleton exclusive plan and classify delegation before approval.
   For a large workflow change, use bounded explorers for independent
   config/hook/runbook surfaces and a reviewer for the synthesized plan; for
   small, record why delegation is not needed.
3. Complete/approve/select the plan for shared config/CI/harness.
4. Change generic core separately from repository profile.
5. Run hooks tests, leinoctl tests, plan-lint, preflight and diff review.
6. Start a new trusted session before claiming new hooks are active.
7. Scope-check and complete lifecycle.
