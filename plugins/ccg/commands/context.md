---
description: "Manage Codex-native CCG context history"
argument-hint: "init|log <note>|summarize|history|clear [--dry-run|--confirm]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Context

The user invoked:

```text
/ccg:context $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:context`.

Store context artifacts only under `.codex/ccg/context/**`. Legacy `.context/**` may be read as migration input but is not the default write target.
