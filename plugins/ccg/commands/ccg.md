---
description: "CCG command index for Codex"
argument-hint: "[plan-path-or-task]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Command Index

The user invoked:

```text
/ccg:ccg $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:executor`.

If `$ARGUMENTS` is empty, show the available CCG commands in Chinese:

- `/ccg:ccg` - show this command index.
- `/ccg:plan <task>` - create or revise a CCG plan with Codex and Gemini analysis.
- `/ccg:workflow` - explain the Codex-native CCG workflow.
- `/ccg:doctor` - diagnose local CCG plugin, skill, MCP, bridge, and Gemini availability.
- `/ccg:doctor --fix` - from this source checkout only, refresh stale local plugin cache.
- `/ccg:execute <plan>` - execute a CCG plan with Codex as orchestrator.
- `/ccg:codex-exec <plan>` - explicit Codex-led execution alias.
- `/ccg:excute <plan>` - typo-compatible alias.
- `/ccg:feat <task>` - implement a feature with Codex and bounded Gemini help.
- `/ccg:frontend <task>` - handle frontend/UI work with Gemini as a strong read-only UI helper.
- `/ccg:backend <task>` - handle backend-heavy work with Codex as the primary executor.
- `/ccg:analyze <target>` - read-only code, architecture, risk, or option analysis.
- `/ccg:debug <bug>` - reproduce, diagnose, fix, and verify failures.
- `/ccg:optimize <target>` - optimize with evidence and regression checks.
- `/ccg:test <target>` - add, repair, or design tests.
- `/ccg:enhance <task>` - enhance existing behavior while preserving local patterns.
- `/ccg:review [plan-or-diff]` - review a CCG implementation.
- `/ccg:gemini-preview <prompt>` - run Gemini with a live browser preview.
- `/ccg:gen-docs <module-path>` - generate README/DESIGN skeletons.
- `/ccg:verify-change` - analyze change impact and documentation sync.
- `/ccg:verify-module <module-path>` - check module completeness.
- `/ccg:verify-quality <changed-path>` - check quality issues.
- `/ccg:verify-security <changed-path>` - check security-sensitive changes.

If `$ARGUMENTS` contains a plan path or task, treat it as `/ccg:execute $ARGUMENTS`.
