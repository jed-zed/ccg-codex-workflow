---
name: workflow
description: Explain or enter the Codex-native CCG workflow. Use when the user invokes /ccg:workflow.
---

# CCG Workflow

Load `skills/ccg-executor/SKILL.md` for the full rule.

Explain in Chinese:

- Original CCG: Claude Code orchestrates Codex + Gemini.
- Codex CCG: Codex creates plans, orchestrates execution, and applies final code; Gemini assists as a bounded read-only helper for planning, drafts, tests, UI, edge cases, and review.
- Gemini browser preview is automatic whenever the workflow calls Gemini. `/ccg:gemini-preview` is only a manual smoke-test/debug entry for that same helper.

If the user supplies a plan path or task, route it to `/ccg:execute`.
