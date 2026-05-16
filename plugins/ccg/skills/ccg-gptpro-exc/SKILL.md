---
name: gptpro-exc
description: Create a manual ChatGPT Pro execution-companion bridge. Use when the user invokes /ccg:gptpro-exc.
---

# CCG GPT Pro Execution Companion

Load and follow `skills/ccg-gptpro-bridge/SKILL.md`.

This is a Codex + Gemini + GPT Pro execution-companion workflow.

## Behavior

- Treat input as an implementation companion request.
- Run Gemini before GPT Pro using the bundled Gemini preview helper with `--prompt-template general`.
- Follow the Gemini Gate Before GPT Pro from `skills/ccg-gptpro-bridge/SKILL.md`: require a real `CCG_GEMINI_RESPONSE_FILE`, read a non-empty Gemini response from it, stop and do not create a GPT Pro bridge session if it is missing or empty, and Do not invent Gemini findings.
- Include Codex's implementation context, the Gemini response file path, and a concise Gemini findings summary in the GPT Pro prompt.
- Provide context: task, plan excerpt, target files, constraints, existing patterns.
- Expected manual questions: 1.
- Maximum manual questions: 2.
- Round 2 should be converted into `/ccg:gptpro-review` whenever possible.
- Use `scripts/gptpro_bridge.py --mode exc --detach-preview --open-preview`.
- GPT Pro output is a sketch, pseudo patch, test idea list, or edge-case review.
- Codex owns all file edits and verification.
- Report in Chinese and synthesize Codex, Gemini, and GPT Pro findings.
- Codex remains final owner.
- Do not automate ChatGPT web login.
- Do not read ChatGPT web DOM.
- Do not extract ChatGPT Output programmatically.

## Manual Handoff Barrier

- After creating the bridge artifacts, show only handoff metadata.
- Do not paste the full generated prompt into chat.
- Show the preview URL, session directory, prompt file path, response file path, and status file path.
- Tell the user to open the preview page and use the preview page Copy Prompt button, then manually submit the prompt to ChatGPT Pro and manually save the response.
- End the current assistant turn after the handoff. Do not continue the execution-companion analysis in the same turn.
- Continue only after `status.json` shows `response_saved=true` and `response.md is non-empty`.
