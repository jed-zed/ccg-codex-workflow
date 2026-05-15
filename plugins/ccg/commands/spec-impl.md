---
description: "Execute a CCG spec-backed plan"
argument-hint: "<spec-name>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Spec Impl

The user invoked:

```text
/ccg:spec-impl $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:spec-impl`.

Validate the spec artifacts, read `.codex/ccg/specs/<name>/plan.md`, execute through Codex, and archive results under `.codex/ccg/specs/<name>/archive.md`.
