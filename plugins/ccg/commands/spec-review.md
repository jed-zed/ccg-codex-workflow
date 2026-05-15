---
description: "Review a CCG spec, plan, and implementation diff"
argument-hint: "<spec-name-or-path>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Spec Review

The user invoked:

```text
/ccg:spec-review $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:spec-review`.

Validate the spec artifacts first, then check implementation against constraints, acceptance criteria, tests, scope, and security-sensitive deltas.
