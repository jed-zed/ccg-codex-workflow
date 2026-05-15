---
description: "Initialize Codex-native CCG project artifacts"
argument-hint: "[--append-agents-section]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Init

The user invoked:

```text
/ccg:init $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:init`.

Initialize Codex-owned CCG structure under `.codex/ccg/**`. Do not overwrite `AGENTS.md`, `CLAUDE.md`, or existing project rules. Legacy Claude files are context inputs only.
