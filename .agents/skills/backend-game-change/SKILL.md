---
name: backend-game-change
description: Backend game change using repository boundaries and ordinary checks.
---

# Backend game change

Read backend/AGENTS.md. Identify pure engine/application/transport/repository ownership. Preserve actor authority, realized event randomness, immutable content, atomic receipt/version and actor-specific projection. Run go build, go vet, go test and real PostgreSQL contracts for persistence changes.
