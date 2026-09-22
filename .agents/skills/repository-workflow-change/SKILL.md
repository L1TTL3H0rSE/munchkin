---
name: repository-workflow-change
description: Repository workflow change using repository boundaries and ordinary checks.
---

# Repository workflow change

Read root AGENTS.md and docs/conventions/checks.md. Inspect actual consumers before changing config, CI or instructions. Preserve ordinary checks and security boundaries. Use isolated native-agent worktrees for independent writes. Check scripts, encoding and diff; verify new instructions in a fresh session.
