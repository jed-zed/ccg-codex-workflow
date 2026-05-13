---
description: "Review a CCG implementation in Codex-led mode"
argument-hint: "[diff-or-plan-path]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Review

The user invoked:

```text
/ccg:review $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:executor`.

Review the current diff or the implementation associated with `$ARGUMENTS`. Codex performs the primary review. Gemini may be asked for a bounded second-pass review, but Codex verifies findings before reporting them.
