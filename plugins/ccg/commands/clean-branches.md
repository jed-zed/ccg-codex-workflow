---
description: "Preview safe cleanup of merged branches"
argument-hint: "[--delete|--confirm]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Clean Branches

The user invoked:

```text
/ccg:clean-branches $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:clean-branches`.

Default behavior is dry-run. Protect mainline, current, unmerged, and unknown remote-only branches.
