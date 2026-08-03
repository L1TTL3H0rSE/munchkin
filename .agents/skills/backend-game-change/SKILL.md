---
name: backend-game-change
description: Plan, implement, and verify a scoped change to the authoritative Go game backend, pure engine, HTTP application boundary, persistence, migrations, replay, idempotency, or privacy projections.
---

# Backend game change

1. Run `./leinoctl context --paths <paths>` and read returned plans plus
   `backend/AGENTS.md`.
2. Identify whether the change belongs to pure engine, application,
   transport, repository, migration or public contract.
3. Create a skeleton plan and classify delegation before approval. For a large
   change, use bounded explorers for independent engine/transport/persistence
   questions and a reviewer for the synthesized plan; for small, record why
   delegation is not needed.
4. Complete/approve/select the plan with exact paths/contracts/shared resources.
5. Preserve actor authority, deterministic event outcomes, immutable content
   identity, atomic receipt/version append and actor-specific projection.
6. Run focused Go tests, then `./leinoctl verify --paths <paths>`.
7. Run scope-check and complete the plan.
