---
name: team
description: CCG team command index and router for Codex-native worker workflows. Use when the user invokes /ccg:team.
---

# CCG Team

Route team workflow requests. Codex remains final owner.

## Commands

- `/ccg:team-research <task>`
- `/ccg:team-plan <task>`
- `/ccg:team-exec <team-plan-path-or-task>`
- `/ccg:team-review <team-task-or-diff>`

## Rules

- Workers are scoped helpers with explicit ownership.
- Gemini remains read-only.
- Same-file conflicts must be detected before dispatch.
- No worker can bypass final Codex verification.

Report in Chinese.
