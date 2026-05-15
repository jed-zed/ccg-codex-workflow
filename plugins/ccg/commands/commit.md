---
description: "Prepare a safe CCG commit"
argument-hint: "[--execute|--confirm]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Commit

The user invoked:

```text
/ccg:commit $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:commit`.

Default behavior is dry-run: inspect status, recommend gates, and show a commit message. Commit only when the user explicitly asks for direct execution.
