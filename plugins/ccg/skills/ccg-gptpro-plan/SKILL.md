---
name: gptpro-plan
description: Create a manual ChatGPT Pro planning second-opinion bridge. Use when the user invokes /ccg:gptpro-plan.
---

# CCG GPT Pro Plan

Load and follow `skills/ccg-gptpro-bridge/SKILL.md`.

## Behavior

- Treat the argument as a planning task or plan-review input.
- Build a single-round planning prompt by default.
- Expected manual questions: 1.
- Maximum manual questions: 2.
- Round 2 only for blocker re-check or revised plan comparison.
- Use `scripts/gptpro_bridge.py --mode plan`.
- Read the saved response file only after the user manually saves it.
- Summarize GPT Pro findings in Chinese.
- Codex remains final owner.
- Do not automate ChatGPT web login.
- Do not read ChatGPT web DOM.
- Do not extract ChatGPT Output programmatically.
