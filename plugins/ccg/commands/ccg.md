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
- `/ccg:init` - initialize Codex-native CCG project artifacts under `.codex/ccg/`.
- `/ccg:context <subcommand>` - manage Codex-native context history under `.codex/ccg/context/`.
- `/ccg:commit` - prepare a safe commit message and gate checklist.
- `/ccg:rollback` - plan safe rollback or revert operations.
- `/ccg:clean-branches` - dry-run cleanup of safely merged branches.
- `/ccg:worktree <subcommand>` - manage Git worktrees with safety checks.
- `/ccg:spec-init` - initialize `.codex/ccg/specs/`.
- `/ccg:spec-research <requirement>` - write spec research and constraints.
- `/ccg:spec-plan <spec>` - create a Chinese spec-backed CCG plan.
- `/ccg:spec-impl <spec>` - execute a spec-backed plan.
- `/ccg:spec-review <spec>` - review spec, plan, implementation, and tests.
- `/ccg:team` - show Codex-native team workflow commands.
- `/ccg:team-research <task>` - research a task for worker ownership.
- `/ccg:team-plan <task>` - create a worker ownership plan.
- `/ccg:team-exec <plan>` - execute scoped worker plans with Codex as final owner.
- `/ccg:team-review <task>` - review worker output, diffs, and tests.
- `/ccg:review [plan-or-diff]` - review a CCG implementation.
- `/ccg:gemini-preview <prompt>` - run Gemini with a live browser preview.
- `/ccg:gptpro-plan <task>` - manual ChatGPT Pro planning second opinion.
- `/ccg:gptpro-review [target]` - manual ChatGPT Pro review second opinion.
- `/ccg:gptpro-exc <task-or-plan>` - manual ChatGPT Pro execution companion.
- `/ccg:gen-docs <module-path>` - generate README/DESIGN skeletons.
- `/ccg:verify-change` - analyze change impact and documentation sync.
- `/ccg:verify-module <module-path>` - check module completeness.
- `/ccg:verify-quality <changed-path>` - check quality issues.
- `/ccg:verify-security <changed-path>` - check security-sensitive changes.

If `$ARGUMENTS` contains a plan path or task, treat it as `/ccg:execute $ARGUMENTS`.
