---
description: "Manual ChatGPT Pro bridge for CCG planning"
argument-hint: "<task> [--followup <session-dir>]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG GPT Pro Plan

The user invoked:

```text
/ccg:gptpro-plan $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:gptpro-plan`.

Create a Codex + Gemini + GPT Pro planning bridge.

Codex must run Gemini read-only planning analysis through the bundled preview helper before generating the GPT Pro manual prompt. The GPT Pro prompt must include the Gemini response file path and a concise Gemini findings summary.

Expected manual ChatGPT Pro questions: 1.
Maximum manual ChatGPT Pro questions: 2.
Round 2 is only for blocker re-check or revised plan comparison.

## Plan-only Boundary

`/ccg:gptpro-plan` is planning-only. Do not execute implementation. Do not apply code changes except writing or updating CCG plan artifacts and GPT Pro bridge artifacts. After the user saves GPT Pro output, Codex may synthesize Codex, Gemini, and GPT Pro planning findings, produce or revise the plan, report the plan location, and stop. Execution requires a separate `/ccg:execute <plan>` or `/ccg:codex-exec <plan>` request.

Manual handoff is required. After generating the prompt, Codex must not paste the full generated prompt into chat. Codex must show the preview URL plus prompt/response/status file paths, tell the user to open the preview page and use the preview page Copy Prompt button, and stop the current turn so the user can manually submit the prompt to ChatGPT Pro and save the response.

Do not automate ChatGPT web login, prompt submission, DOM reading, or output extraction. The user must manually paste the prompt into ChatGPT Pro and paste the response back into the local bridge or response file.
