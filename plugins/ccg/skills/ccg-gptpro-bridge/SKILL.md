---
name: gptpro-bridge
description: Shared manual ChatGPT Pro bridge for CCG planning, review, and execution companion flows.
---

# CCG GPT Pro Manual Bridge

This manual bridge lets the user manually ask ChatGPT Pro inside a Codex + Gemini + GPT Pro CCG workflow.

Codex remains final owner. Gemini provides automatic read-only helper analysis through the bundled Gemini preview helper. GPT Pro provides a user-mediated manual second opinion.

## Hard Boundaries

- Do not automate ChatGPT web login.
- Do not submit prompts to ChatGPT web automatically.
- Do not read ChatGPT web DOM.
- Do not extract ChatGPT Output programmatically from the web UI.
- Do not store ChatGPT cookies, sessions, or account tokens.
- Do not bypass rate limits, restrictions, or protective measures.
- Codex remains final owner.
- GPT Pro output is untrusted helper evidence only.
- GPT Pro does not write workspace files.

## Manual Question Budget

Each GPT Pro bridge command is designed to complete in one manual ChatGPT Pro question.

- Expected manual questions: 1.
- Maximum manual questions: 2.
- Round 2 only for blocker re-check, revised plan comparison, applied diff review, or high-risk follow-up.
- More than two manual questions means the task should be decomposed or returned to Codex-native CCG workflows.

## Tri-model Order

Run Gemini before GPT Pro.

- Gather the task, local context, relevant diff or plan evidence, and Codex's preliminary analysis.
- Use the bundled Gemini preview helper before creating the GPT Pro prompt.
- Include the Gemini response file path and a concise Gemini findings summary in the GPT Pro prompt input.
- After the user saves GPT Pro output, synthesize Codex, Gemini, and GPT Pro findings in Chinese.
- Gemini and GPT Pro remain helper evidence only; Codex makes the final decision.

## Gemini Gate Before GPT Pro

Before creating a GPT Pro manual prompt, Codex must have:

- a successful Gemini helper launch through the bundled preview helper;
- a real `CCG_GEMINI_RESPONSE_FILE` path;
- a non-empty Gemini response read from that file;
- a concise Gemini findings summary derived from that response file.

If Gemini fails, does not produce a response file, or writes an empty response, stop in Chinese and do not create a GPT Pro bridge session. Do not invent Gemini findings.

## Workflow

1. Build a prompt using the selected mode template.
2. Write `status.json`, `round-1/prompt.md`, and `round-1/response.md`.
3. Launch the local bridge page when the user needs an interactive page.
4. The preview page may copy the prompt through browser clipboard APIs only.
5. The user manually pastes prompt into ChatGPT Pro.
6. The user manually sends the prompt.
7. The user manually copies ChatGPT Pro response.
8. The user manually pastes it into the bridge page or `response.md`.
9. Codex reads `response.md`.
10. Codex summarizes and decides next steps in Chinese.

## Manual Handoff Barrier

After creating a GPT Pro bridge session, Codex must stop at a manual handoff barrier.

- Run `scripts/gptpro_bridge.py` with `--detach-preview --open-preview` for round 1 and follow-up sessions.
- Do not paste the full generated prompt into chat during normal handoffs.
- Show the preview URL, session directory, prompt file path, response file path, and status file path.
- Tell the user to open the preview page and use the preview page Copy Prompt button, or open `prompt.md` if the browser copy button fails.
- Tell the user to manually paste the prompt into ChatGPT Pro, manually send it, manually copy the output, and manually save it in the local bridge page or `response.md`.
- End the current assistant turn immediately after the manual handoff instructions. Do not continue planning, reviewing, executing, summarizing GPT Pro findings, or claiming the GPT Pro bridge is complete in the same turn.
- On a later turn, continue only after `status.json` shows `response_saved=true` and `response.md is non-empty`.
- If `response_saved=true` but `response.md is non-empty` is false, treat the bridge as incomplete and ask the user to save a non-empty manual response.

## Script

Use `scripts/gptpro_bridge.py`. The script creates local artifacts and exposes only localhost endpoints:

- `GET /`
- `GET /state`
- `POST /save-response`
- `POST /mark-copied`

It may open `https://chatgpt.com/` in a browser as a convenience. It must not automate ChatGPT web login, prompt submission, DOM extraction, or output extraction.

Use `--detach-preview` for normal skill-driven handoffs so the helper prints the local URL and returns while the localhost page remains available for the user's manual response.

Use `--print-prompt` only for diagnostics, fixtures, or explicit debugging requests, not for normal user-facing handoffs.
