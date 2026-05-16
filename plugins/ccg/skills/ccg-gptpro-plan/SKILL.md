---
name: gptpro-plan
description: Create a manual ChatGPT Pro planning second-opinion bridge. Use when the user invokes /ccg:gptpro-plan.
---

# CCG GPT Pro Plan

This is a Codex + Gemini + GPT Pro planning workflow.

Load and follow `skills/ccg-gptpro-bridge/SKILL.md`.

## Behavior

- Treat the argument as a planning task or plan-review input.
- Run Gemini before GPT Pro using the bundled Gemini preview helper with `--prompt-template plan`.
- Follow the Gemini Gate Before GPT Pro from `skills/ccg-gptpro-bridge/SKILL.md`: require a real `CCG_GEMINI_RESPONSE_FILE`, read a non-empty Gemini response from it, stop and do not create a GPT Pro bridge session if it is missing or empty, and Do not invent Gemini findings.
- Include Codex's planning context, the Gemini response file path, and a concise Gemini findings summary in the GPT Pro prompt.
- Build a single-round planning prompt by default.
- Expected manual questions: 1.
- Maximum manual questions: 2.
- Round 2 only for blocker re-check or revised plan comparison.
- Use `scripts/gptpro_bridge.py --mode plan --detach-preview --open-preview --print-prompt`.
- Read the saved response file only after the user manually saves it.
- Summarize and synthesize Codex, Gemini, and GPT Pro findings in Chinese.
- Codex remains final owner.
- Do not automate ChatGPT web login.
- Do not read ChatGPT web DOM.
- Do not extract ChatGPT Output programmatically.

## Plan-only Boundary

- `/ccg:gptpro-plan` is planning-only.
- Do not execute implementation.
- Do not apply code changes except writing or updating CCG plan artifacts and GPT Pro bridge artifacts.
- Do not run implementation tasks, mutate product code, commit, push, create a pull request, or continue into `/ccg:execute` behavior.
- After the user saves GPT Pro output, synthesize Codex, Gemini, and GPT Pro planning findings only.
- Produce or revise the plan, report the plan location and key decisions in Chinese, then stop.
- Stop after producing or updating the plan.
- If the user wants execution, require a separate `/ccg:execute <plan>` or `/ccg:codex-exec <plan>` request.

## Manual Handoff Barrier

- After creating the bridge artifacts, display the full generated prompt exactly as printed by the helper.
- Show the preview URL, session directory, prompt file path, response file path, and status file path.
- Tell the user to manually submit the prompt to ChatGPT Pro and manually save the response.
- End the current assistant turn after the handoff. Do not continue the planning analysis in the same turn.
- Continue only after `status.json` shows `response_saved=true` and `response.md is non-empty`.
