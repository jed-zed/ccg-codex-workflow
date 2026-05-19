---
name: gptpro-exc
description: Create a manual ChatGPT Pro execution-companion bridge. Use when the user invokes /ccg:gptpro-exc.
---

# CCG GPT Pro Execution Companion

Load and follow `skills/ccg-gptpro-bridge/SKILL.md`.

This is a Codex-led execution-companion workflow: Codex controls implementation, Gemini only participates for frontend/full-stack frontend prototype or review evidence, GPT Pro provides one manual second opinion, and Codex makes the final implementation, verification, and delivery decision.

## Behavior

- Treat input as an implementation companion request.
- Codex owns the implementation context, file edits, verification, final landing, and final decision.
- For backend-only tasks, do not run Gemini by default; Codex may create the GPT Pro bridge without a Gemini response file.
- For frontend or full-stack tasks, Gemini is read-only frontend evidence only: run Gemini through the bundled Gemini preview helper with `--prompt-template frontend` before GPT Pro, and summarize its UI/UX prototype findings.
- Include Codex's implementation context, target files, constraints, existing patterns, and any available `Gemini Frontend Prototype Evidence` in the GPT Pro prompt.
- If Gemini frontend evidence is provided, it must come from a real, non-empty response file with a concise summary; do not invent Gemini findings.
- Gemini is not a gate for `/ccg:gptpro-exc`, is not a general execution participant, and must not apply workspace changes.
- GPT Pro is a manual second opinion only; it does not write workspace files.
- Expected manual questions: 1.
- Maximum manual questions: 2.
- Round 2 should be converted into `/ccg:gptpro-review` whenever possible; use Gemini `--prompt-template review` and `--gemini-evidence-role frontend-review` for frontend review evidence over the applied diff.
- Use `scripts/gptpro_bridge.py --mode exc --detach-preview --open-preview --gemini-policy optional --gemini-evidence-role frontend-prototype`.
- When frontend/full-stack Gemini output is available, add `--gemini-response-file <CCG_GEMINI_RESPONSE_FILE> --gemini-summary-file <summary-file>`.
- GPT Pro output is a sketch, pseudo patch, test idea list, or edge-case review.
- Report in Chinese and synthesize Codex, Gemini frontend evidence, and GPT Pro manual second opinion when Gemini evidence exists; otherwise synthesize Codex and GPT Pro findings and state that Gemini frontend evidence was not used.
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
