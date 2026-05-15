---
description: "Manual ChatGPT Pro bridge for CCG review"
argument-hint: "[plan-or-diff] [--followup <session-dir>]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG GPT Pro Review

The user invoked:

```text
/ccg:gptpro-review $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:gptpro-review`.

Create a manual ChatGPT Pro review bridge.

Expected manual ChatGPT Pro questions: 1.
Maximum manual ChatGPT Pro questions: 2.
Round 2 is only after Codex fixes blocker findings.

Do not automate ChatGPT web login, prompt submission, DOM reading, or output extraction. Codex must independently verify GPT Pro findings.
