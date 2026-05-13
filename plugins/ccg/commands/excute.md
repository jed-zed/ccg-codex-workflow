---
description: "Alias for /ccg:execute, preserving the common misspelling"
argument-hint: "<plan-path-or-task>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Excute - Alias

The user invoked:

```text
/ccg:excute $ARGUMENTS
```

This is a typo-compatible alias of `/ccg:execute`. Use the installed CCG plugin skill `ccg:executor` and follow it exactly. Treat `$ARGUMENTS` as the plan path or task description. The architecture is Codex-led: Gemini assists only when useful; Codex owns final implementation and verification.
