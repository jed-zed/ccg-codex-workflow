---
description: "Implement backend-heavy work with Codex as the primary executor"
argument-hint: "<backend-task>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Backend

The user invoked:

```text
/ccg:backend $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:backend`.

Backend work is Codex-led by default. Gemini is optional and should be used only for complex design alternatives, risk review, edge cases, or tests through the bundled browser preview helper.
