---
name: gptpro-review
description: Create a manual ChatGPT Pro review second-opinion bridge. Use when the user invokes /ccg:gptpro-review.
---

# CCG GPT Pro Review

This is a Codex + Gemini + GPT Pro review workflow.

Load and follow `skills/ccg-gptpro-bridge/SKILL.md`.

## Behavior

- Gather review input: plan, diff, touched files, test summary, or user-provided target.
- Run Gemini before GPT Pro using the bundled Gemini preview helper with `--prompt-template review`.
- Follow the Gemini Gate Before GPT Pro from `skills/ccg-gptpro-bridge/SKILL.md`: require a real `CCG_GEMINI_RESPONSE_FILE`, read a non-empty Gemini response from it, stop and do not create a GPT Pro bridge session if it is missing or empty, and Do not invent Gemini findings.
- Include Codex's primary review notes, the Gemini response file path, and a concise Gemini findings summary in the GPT Pro prompt.
- Build a single-round review prompt by default.
- Expected manual questions: 1.
- Maximum manual questions: 2.
- Round 2 only after Codex fixes blocker findings.
- Use `scripts/gptpro_bridge.py --mode review --detach-preview --open-preview --print-prompt`.
- After response is saved, classify:
  - blocking findings
  - non-blocking findings
  - possible false positives
  - Codex actions
- Report in Chinese and synthesize Codex, Gemini, and GPT Pro findings.
- Codex remains final owner.
- Do not automate ChatGPT web login.
- Do not read ChatGPT web DOM.
- Do not extract ChatGPT Output programmatically.

## Manual Handoff Barrier

- After creating the bridge artifacts, display the full generated prompt exactly as printed by the helper.
- Show the preview URL, session directory, prompt file path, response file path, and status file path.
- Tell the user to manually submit the prompt to ChatGPT Pro and manually save the response.
- End the current assistant turn after the handoff. Do not continue the review analysis in the same turn.
- Continue only after `status.json` shows `response_saved=true` and `response.md is non-empty`.
