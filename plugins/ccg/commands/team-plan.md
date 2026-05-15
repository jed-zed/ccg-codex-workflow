---
description: "Create a scoped worker ownership plan for CCG team execution"
argument-hint: "<task>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Team Plan

The user invoked:

```text
/ccg:team-plan $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:team-plan`.

Produce `.codex/ccg/team/<task>/plan.md` with workers, file ownership, merge strategy, verification, and conflict risks.
