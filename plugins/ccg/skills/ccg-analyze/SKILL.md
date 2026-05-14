---
name: analyze
description: Analyze code, architecture, risks, or implementation options without applying changes. Use when the user invokes /ccg:analyze or asks CCG for read-only analysis.
---

# CCG Analyze

Load and follow `skills/ccg-executor/SKILL.md` for context search and reporting standards, but keep this command read-only unless the user explicitly asks to implement.

## Behavior

- Treat the user argument as an analysis request.
- Inspect relevant files, docs, git status, and project rules.
- Do not edit files, commit, install dependencies, or run destructive commands.
- Use Gemini through the bundled browser preview helper with `--prompt-template analyzer` when a second architectural perspective, risk review, or broad cross-module analysis would help.
- Report in Chinese with findings, evidence, tradeoffs, and recommended next steps.
