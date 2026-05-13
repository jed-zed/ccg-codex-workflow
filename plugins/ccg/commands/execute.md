---
description: "Execute a CCG plan with Codex orchestrating Gemini"
argument-hint: "<plan-path-or-task>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Execute - Codex Orchestrator

The user invoked:

```text
/ccg:execute $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:executor` and follow it exactly. Treat `$ARGUMENTS` as the plan path or task description.

This command is Codex-native:

- Planning may come from `/ccg:plan` or an existing CCG plan file.
- Codex is the orchestrator and final code owner.
- Gemini may be used for bounded code drafting, edge-case analysis, UI prototypes, or review, but Codex applies and verifies all changes.
- Do not edit the original Claude plugin files and do not spend Claude execution quota.
