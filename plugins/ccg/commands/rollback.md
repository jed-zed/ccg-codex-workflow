---
description: "Plan a safe CCG rollback"
argument-hint: "--last|<commit>|--file <path>|--dry-run"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Rollback

The user invoked:

```text
/ccg:rollback $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:rollback`.

Default behavior is dry-run. Destructive reset, clean, and force-push operations require explicit user confirmation and must not be inferred.
