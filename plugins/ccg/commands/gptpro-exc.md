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

Generate a Codex + Gemini + GPT Pro helper prompt for implementation sketches, patch proposals, edge cases, or test ideas.

Codex must run Gemini read-only execution-companion analysis through the bundled preview helper before generating the GPT Pro manual prompt. The GPT Pro prompt must include the Gemini response file path and a concise Gemini findings summary.

Expected manual ChatGPT Pro questions: 1.
Maximum manual ChatGPT Pro questions: 2.
Round 2 should be converted into review mode whenever possible.

Manual handoff is required. After generating the prompt, Codex must not paste the full generated prompt into chat. Codex must show the preview URL plus prompt/response/status file paths, tell the user to open the preview page and use the preview page Copy Prompt button, and stop the current turn so the user can manually submit the prompt to ChatGPT Pro and save the response.

GPT Pro must not write files or own execution. Codex applies final edits and verification.
