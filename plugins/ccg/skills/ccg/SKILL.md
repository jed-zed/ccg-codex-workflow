---
name: ccg
description: CCG command index for Codex. Use when the user invokes /ccg, asks what CCG commands are available, or gives a CCG plan/task without choosing a subcommand.
---

# CCG

This is the Codex plugin prompt index for CCG. Current Codex CLI builds may not show it in TUI slash autocomplete, but the invocation text still routes to this skill.

Route all real work to `skills/ccg-executor/SKILL.md`.

If the user provided no argument, answer in Chinese with the CCG command index:

- `/ccg:ccg` - show this index; with a plan path or task, execute it.
- `/ccg:plan <task>` - create or revise a CCG plan with Codex and Gemini analysis.
- `/ccg:workflow` - explain the Codex-native CCG workflow.
- `/ccg:doctor` - diagnose local CCG plugin, skill, MCP, bridge, and Gemini availability.
- `/ccg:doctor --fix` - from this source checkout only, refresh stale local plugin cache.
- `/ccg:execute <plan>` - execute a CCG plan with Codex as orchestrator.
- `/ccg:codex-exec <plan>` - explicit Codex-led execution alias.
- `/ccg:excute <plan>` - typo-compatible alias.
- `/ccg:review [plan-or-diff]` - review a CCG implementation.
- `/ccg:gemini-preview <prompt>` - manual smoke-test/debug entry for the same browser preview helper used automatically by CCG workflow Gemini calls.
- `/ccg:gen-docs <module-path>` - generate README/DESIGN skeletons for a new module.
- `/ccg:verify-change` - analyze change impact and documentation sync.
- `/ccg:verify-module <module-path>` - check module structure and required documentation.
- `/ccg:verify-quality <changed-path>` - inspect complexity, duplication, naming, and code smells.
- `/ccg:verify-security <changed-path>` - scan security-sensitive changes.

If the user provided a plan path or task, treat it as `/ccg:execute`.

Core rule: Codex plans and executes; Gemini assists with bounded read-only planning analysis, drafts, tests, edge cases, UI prototypes, or review; Codex applies final edits, verifies, and reports in Chinese. Whenever any CCG workflow uses Gemini, it must invoke the bundled browser preview helper automatically rather than asking the user to run `/ccg:gemini-preview` manually.
