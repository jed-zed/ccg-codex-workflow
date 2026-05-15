---
name: gptpro-exc
description: Create a manual ChatGPT Pro execution-companion bridge. Use when the user invokes /ccg:gptpro-exc.
---

# CCG GPT Pro Execution Companion

Load and follow `skills/ccg-gptpro-bridge/SKILL.md`.

## Behavior

- Treat input as an implementation companion request.
- Provide context: task, plan excerpt, target files, constraints, existing patterns.
- Expected manual questions: 1.
- Maximum manual questions: 2.
- Round 2 should be converted into `/ccg:gptpro-review` whenever possible.
- Use `scripts/gptpro_bridge.py --mode exc`.
- GPT Pro output is a sketch, pseudo patch, test idea list, or edge-case review.
- Codex owns all file edits and verification.
- Report in Chinese.
- Codex remains final owner.
- Do not automate ChatGPT web login.
- Do not read ChatGPT web DOM.
- Do not extract ChatGPT Output programmatically.
