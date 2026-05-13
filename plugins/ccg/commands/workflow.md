---
description: "Show the Codex-native CCG workflow"
argument-hint: "[plan-path-or-task]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Workflow

The user invoked:

```text
/ccg:workflow $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:executor`.

Explain or execute the Codex-native CCG workflow:

- Claude Code writes or revises plans only.
- Codex orchestrates the work and owns final code edits.
- Gemini assists with bounded code drafts, UI prototypes, edge cases, tests, or review.
- Codex verifies and reports in Chinese.

If `$ARGUMENTS` contains a plan path or task, route to the same behavior as `/ccg:execute`.
