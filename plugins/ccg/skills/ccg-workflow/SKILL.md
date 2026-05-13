---
name: workflow
description: Explain or enter the Codex-native CCG workflow. Use when the user invokes /ccg:workflow.
---

# CCG Workflow

Load `skills/ccg-executor/SKILL.md` for the full rule.

Explain in Chinese:

- Original CCG: Claude Code orchestrates Codex + Gemini.
- Codex CCG: Claude Code only writes plans; Codex orchestrates; Gemini assists; Codex applies final code, verifies, and reports.

If the user supplies a plan path or task, route it to `/ccg:execute`.
