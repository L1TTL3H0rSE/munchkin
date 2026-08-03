---
name: frontend-game-change
description: Plan, implement, and verify a Nuxt game UI or shared TypeScript contract change, including lobby, table, credential handling, version invalidation, resync, and privacy-safe projections.
---

# Frontend game change

1. Run context and read `frontend/AGENTS.md`.
2. Inspect workspace manifest, Zod wire schema, Go conformance fixture and
   direct UI consumer.
3. Create a skeleton plan and classify delegation before approval. For a large
   change, use bounded explorers for independent contract, UI/state and
   browser/a11y questions, then give the synthesized plan to a reviewer; for
   small, record why delegation is not needed.
4. Complete/approve/select the plan; claim lockfile/contracts explicitly.
5. Keep backend authoritative and realtime invalidation-only.
6. Run focused tests, `pnpm lint`, `pnpm check`, then leinoctl verify.
7. Scope-check and complete lifecycle.
