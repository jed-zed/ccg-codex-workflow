---
name: team-exec
description: Execute a scoped CCG team plan with Codex as final owner. Use when the user invokes /ccg:team-exec.
---

# CCG Team Exec

Execute scoped worker plans conservatively.

## Behavior

- Read `.codex/ccg/team/<task>/plan.md` when provided.
- Run `../ccg-team/scripts/team_plan_checker.js validate .codex/ccg/team/<task>/plan.md --json` before dispatch so `status.json` is refreshed.
- Refuse to dispatch when `can_execute=false`, including when multiple workers own the same file without an explicit merge strategy.
- Tell every worker they are not alone in the codebase and must not revert others' edits.
- Maintain `.codex/ccg/team/<task>/status.json` as the execution evidence artifact.
- Codex applies or reconciles final changes, reviews the diff, runs verification, and reports in Chinese.

Gemini may provide read-only review, but cannot own execution.
