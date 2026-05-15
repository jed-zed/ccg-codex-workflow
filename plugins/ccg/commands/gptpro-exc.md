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

Generate a manual ChatGPT Pro helper prompt for implementation sketches, patch proposals, edge cases, or test ideas.

Expected manual ChatGPT Pro questions: 1.
Maximum manual ChatGPT Pro questions: 2.
Round 2 should be converted into review mode whenever possible.

GPT Pro must not write files or own execution. Codex applies final edits and verification.
