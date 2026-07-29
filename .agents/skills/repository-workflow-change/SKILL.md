---
name: repository-workflow-change
description: Plan, implement, and verify changes to AGENTS, Codex hooks, leinoctl, repository profile, component graph, CI, plans, or Compose workflow.
---

# Repository workflow change

1. Run context for exact workflow paths and read `docs/agents/HARNESS.md`.
2. Create/approve/select an exclusive plan for shared config/CI/harness.
3. Change generic core separately from repository profile.
4. Run hooks tests, leinoctl tests, plan-lint, preflight and diff review.
5. Start a new trusted session before claiming new hooks are active.
6. Scope-check and complete lifecycle.
