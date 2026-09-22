# Munchkin engineering documentation

Executable code, manifests, schemas and tests are the source of truth, followed
by accepted decisions, these documents and dated project memory.

- [Checks and local commands](conventions/checks.md)
- [Stack](conventions/stack.md)
- [Frontend engineering](frontend/engineering.md) and [UI/UX](frontend/ui.md)
- [Game architecture](backend/architecture.md) and [interactions](backend/interactions.md)
- [Decisions](decisions/README.md)
- [Confirmed project memory](PROJECT_MEMORY.md)
- [Migration progress and evidence](migrations/template-storybook.md)
- [Infrastructure](architecture/PRODUCTION_INFRASTRUCTURE.md) and [operations](operations/PRODUCTION_DEPLOYMENT.md)
- [Historical workflow archive](history/leino/README.md), non-normative

Munchkin retains its pure game engine, HTTP/SSE contracts, credential model,
immutable content and separate Studio boundary. Template conventions do not
introduce its example product, gateway authentication or gRPC into this game.
