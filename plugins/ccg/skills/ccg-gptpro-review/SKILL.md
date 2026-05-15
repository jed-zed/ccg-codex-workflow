---
name: gptpro-review
description: Create a manual ChatGPT Pro review second-opinion bridge. Use when the user invokes /ccg:gptpro-review.
---

# CCG GPT Pro Review

Load and follow `skills/ccg-gptpro-bridge/SKILL.md`.

## Behavior

- Gather review input: plan, diff, touched files, test summary, or user-provided target.
- Build a single-round review prompt by default.
- Expected manual questions: 1.
- Maximum manual questions: 2.
- Round 2 only after Codex fixes blocker findings.
- Use `scripts/gptpro_bridge.py --mode review`.
- After response is saved, classify:
  - blocking findings
  - non-blocking findings
  - possible false positives
  - Codex actions
- Report in Chinese.
- Codex remains final owner.
- Do not automate ChatGPT web login.
- Do not read ChatGPT web DOM.
- Do not extract ChatGPT Output programmatically.
