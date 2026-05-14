---
description: "Create or revise a CCG plan with Codex orchestrating Gemini analysis"
argument-hint: "<task-or-requirement>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Plan - Codex Planner

The user invoked:

```text
/ccg:plan $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:plan`.

This command is Codex-native:

- Codex owns context search, requirement enhancement, final plan synthesis, and writing `.claude/plan/*.md`.
- Gemini must participate as a read-only analysis helper through the bundled preview helper, using `gemini-3.1-pro-preview` by default.
- Do not write or present a final plan unless the helper printed `CCG_GEMINI_RESPONSE_FILE` and Codex read a non-empty response from that file.
- Do not call Claude-side wrappers or spend Claude execution quota.
- Do not modify product code. This command may only write or revise CCG plan files under `.claude/plan/`.
- After writing the plan, show the saved path and the next manual command: `/ccg:execute <plan-path>`.
