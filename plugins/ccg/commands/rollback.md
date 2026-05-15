---
description: "Plan or execute a safe non-destructive CCG rollback"
argument-hint: "--last|--target <commit>|--file <path>|--mode revert|restore|reset [--allow-dirty|--only-if-clean]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Rollback

The user invoked:

```text
/ccg:rollback $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:rollback`.

Default behavior is dry-run. Non-destructive revert/restore can execute only after explicit confirmation and dirty-worktree preflight; destructive reset, clean, and force-push operations remain manual-only or blocked.
