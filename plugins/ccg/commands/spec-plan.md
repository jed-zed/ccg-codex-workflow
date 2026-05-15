---
description: "Create a Codex-native plan from a CCG spec"
argument-hint: "<spec-name>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Spec Plan

The user invoked:

```text
/ccg:spec-plan $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:spec-plan`.

Create Chinese spec-backed plans under `.codex/ccg/specs/<name>/plan.md` and, when needed, `.codex/ccg/plans/<name>.md`. Refuse to continue when `constraints.md` is missing or invalid.
