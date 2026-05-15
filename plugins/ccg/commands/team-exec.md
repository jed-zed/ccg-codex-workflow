---
description: "Execute a scoped CCG team plan with Codex as final owner"
argument-hint: "<team-plan-path-or-task>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Team Exec

The user invoked:

```text
/ccg:team-exec $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:team-exec`.

Detect same-file conflicts before dispatch. Codex reviews and verifies all final changes.
