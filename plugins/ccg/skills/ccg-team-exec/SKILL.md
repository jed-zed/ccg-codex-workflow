---
name: team-exec
description: Execute a scoped CCG team plan with Codex as final owner. Use when the user invokes /ccg:team-exec.
---

# CCG Team Exec

Execute scoped worker plans conservatively.

## Behavior

- Read `.codex/ccg/team/<task>/plan.md` when provided.
- Refuse to dispatch when multiple workers own the same file without a conflict strategy.
- Tell every worker they are not alone in the codebase and must not revert others' edits.
- Codex applies or reconciles final changes, reviews the diff, runs verification, and reports in Chinese.

Gemini may provide read-only review, but cannot own execution.
