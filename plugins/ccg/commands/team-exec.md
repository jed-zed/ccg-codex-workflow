---
description: "Execute a scoped CCG team plan with Codex as final owner"
argument-hint: "<team-plan-path-or-task>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Team Exec

The user invoked:

```text
/ccg:team-exec $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:team-exec`.

Run `team_plan_checker.js` before dispatch, stop when `can_execute=false`, and let Codex review and verify all final changes.
