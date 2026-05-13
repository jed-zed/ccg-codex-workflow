---
description: "Execute a CCG plan in Codex-led CCG mode"
argument-hint: "<plan-path>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Codex Exec

The user invoked:

```text
/ccg:codex-exec $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:executor` and follow it exactly. This command is equivalent to `/ccg:execute` in this Codex plugin: Codex reads the plan, gathers context, optionally delegates narrow tasks to Gemini, applies final edits, verifies, reviews, and reports in Chinese.
