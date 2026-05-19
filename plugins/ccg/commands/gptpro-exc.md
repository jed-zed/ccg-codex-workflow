---
description: "Manual ChatGPT Pro execution-companion bridge"
argument-hint: "<task-or-plan> [--followup <session-dir>]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG GPT Pro Execution Companion

The user invoked:

```text
/ccg:gptpro-exc $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:gptpro-exc`.

Generate a Codex-led GPT Pro execution-companion helper prompt for implementation sketches, patch proposals, edge cases, or test ideas.

Codex is the controller and final implementer. GPT Pro provides one manual second opinion only. Gemini is optional frontend/full-stack evidence only: backend-only sessions should not run Gemini by default; frontend/full-stack sessions should run the bundled Gemini preview helper with `--prompt-template frontend` when frontend prototype evidence is needed. If Gemini evidence is included, it must come from a real, non-empty response file with a concise summary; do not invent Gemini findings.

Expected manual ChatGPT Pro questions: 1.
Maximum manual ChatGPT Pro questions: 2.
Round 2 should be converted into review mode whenever possible.

Manual handoff is required. After generating the prompt, Codex must not paste the full generated prompt into chat. Codex must show the preview URL plus prompt/response/status file paths, tell the user to open the preview page and use the preview page Copy Prompt button, and stop the current turn so the user can manually submit the prompt to ChatGPT Pro and save the response.

GPT Pro must not write files or own execution. Codex applies final edits and verification.
