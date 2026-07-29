---
name: backend-game-change
description: Plan, implement, and verify a scoped change to the authoritative Go game backend, pure engine, HTTP application boundary, persistence, migrations, replay, idempotency, or privacy projections.
---

# Backend game change

1. Run `./leinoctl context --paths <paths>` and read returned plans plus
   `backend/AGENTS.md`.
2. Identify whether the change belongs to pure engine, application,
   transport, repository, migration or public contract.
3. Create/approve/select a plan with exact paths/contracts/shared resources.
4. Preserve actor authority, deterministic event outcomes, immutable content
   identity, atomic receipt/version append and actor-specific projection.
5. Run focused Go tests, then `./leinoctl verify --paths <paths>`.
6. Run scope-check and complete the plan.
