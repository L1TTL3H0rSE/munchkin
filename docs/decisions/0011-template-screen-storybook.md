# ADR-0011: Template conventions and product screen Storybook

Status: accepted by the migration mandate, 2026-09-22.
Supersedes ADR-0010's Munchkin harness/Leino consumer obligations.

Munchkin adopts Template's single frontend workspace/catalog, built package
exports, deterministic tested generators, topical documentation and ordinary
checks. It adopts Roleplay's presentation-layer screen compositions and separate
product screens export. Story fixtures and design-only compositions cannot be
reachable from product entries. Routes connect the same screens to Munchkin's
existing controllers; the server still determines game outcomes.

The retired workflow's registrations, vendored implementation, registry and
lifecycle tests are removed. Useful encoding/content/privacy/frontend/browser
checks remain independent project commands. Historical plans are non-normative.
Native agents in separate Git worktrees provide bounded parallel work; the root
agent owns integration and shared files. No replacement orchestration service.

Game exceptions are intentional: preserve the pure deterministic Go engine, Go
module paths, HTTP/SSE and wire schemas, bearer-derived actor and immutable content.
No CRUD rewrite, gRPC, trusted gateway headers, optimistic rules or donor branding.
Studio remains disabled by default and separately authenticated. Node remains >=24.
Donor-specific backend/platform choices need a concrete Munchkin consumer before
adoption; this decision does not authorize deployment or cloud changes.
