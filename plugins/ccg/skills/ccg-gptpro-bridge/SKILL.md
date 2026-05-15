---
name: gptpro-bridge
description: Shared manual ChatGPT Pro bridge for CCG planning, review, and execution companion flows.
---

# CCG GPT Pro Manual Bridge

This manual bridge lets the user manually ask ChatGPT Pro for second-opinion planning, review, or execution-companion analysis.

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

## Script

Use `scripts/gptpro_bridge.py`. The script creates local artifacts and exposes only localhost endpoints:

- `GET /`
- `GET /state`
- `POST /save-response`
- `POST /mark-copied`

It may open `https://chatgpt.com/` in a browser as a convenience. It must not automate ChatGPT web login, prompt submission, DOM extraction, or output extraction.
