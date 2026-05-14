---
name: review
description: Review a CCG implementation in Codex-led mode. Use when the user invokes /ccg:review or asks for CCG review of a diff/plan.
---

# CCG Review

Load and follow `skills/ccg-executor/SKILL.md`.

Review the current diff or the implementation associated with the supplied plan/task. Codex performs the primary review. Gemini may provide a bounded second-pass review, but Codex must verify findings before reporting them.

When using Gemini, call the bundled preview helper with `--prompt-template review`. The template already carries the original CCG-style read-only and prioritized review protocol; put only the concrete diff, plan, and review focus in the task prompt.
