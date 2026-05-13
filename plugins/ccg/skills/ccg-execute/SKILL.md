---
name: execute
description: Execute a CCG plan with Codex as orchestrator and Gemini as a bounded helper. Use when the user invokes /ccg:execute or asks Codex to execute a .claude/plan/*.md file.
---

# CCG Execute

Load and follow `skills/ccg-executor/SKILL.md`.

Treat the user argument as a CCG plan path or task description. Plans may come from `/ccg:plan` or legacy CCG plan files. Codex owns context gathering, final code edits, verification, review, and Chinese delivery. Gemini may assist with focused code drafts, test ideas, UI prototypes, edge cases, or second-pass review, but Codex must verify and adapt its output.
