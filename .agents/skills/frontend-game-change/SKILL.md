---
name: frontend-game-change
description: Plan, implement, and verify a Nuxt game UI or shared TypeScript contract change, including lobby, table, credential handling, version invalidation, resync, and privacy-safe projections.
---

# Frontend game change

1. Run context and read `frontend/AGENTS.md`.
2. Inspect workspace manifest, Zod wire schema, Go conformance fixture and
   direct UI consumer.
3. Create/approve/select a plan; claim lockfile/contracts explicitly.
4. Keep backend authoritative and realtime invalidation-only.
5. Run focused tests, `pnpm lint`, `pnpm check`, then leinoctl verify.
6. Scope-check and complete lifecycle.
