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

Create a manual ChatGPT Pro planning bridge.

Expected manual ChatGPT Pro questions: 1.
Maximum manual ChatGPT Pro questions: 2.
Round 2 is only for blocker re-check or revised plan comparison.

Do not automate ChatGPT web login, prompt submission, DOM reading, or output extraction. The user must manually paste the prompt into ChatGPT Pro and paste the response back into the local bridge or response file.
