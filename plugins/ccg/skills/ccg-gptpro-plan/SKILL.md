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
- Use `scripts/gptpro_bridge.py --mode plan --detach-preview --open-preview --print-prompt`.
- Read the saved response file only after the user manually saves it.
- Summarize GPT Pro findings in Chinese.
- Codex remains final owner.
- Do not automate ChatGPT web login.
- Do not read ChatGPT web DOM.
- Do not extract ChatGPT Output programmatically.

## Manual Handoff Barrier

- After creating the bridge artifacts, display the full generated prompt exactly as printed by the helper.
- Show the preview URL, session directory, prompt file path, response file path, and status file path.
- Tell the user to manually submit the prompt to ChatGPT Pro and manually save the response.
- End the current assistant turn after the handoff. Do not continue the planning analysis in the same turn.
- Continue only after `status.json` shows `response_saved=true` and `response.md is non-empty`.
