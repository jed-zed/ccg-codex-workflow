---
description: "Enhance an existing feature while preserving current behavior and repository patterns"
argument-hint: "<enhancement-request>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Enhance

The user invoked:

```text
/ccg:enhance $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:enhance`.

Codex should identify current behavior first, keep the change scoped, and verify regressions. Gemini may assist with UX, edge cases, or review through the bundled browser preview helper.
