---
description: "Create or revise a CCG plan with Codex orchestrating Gemini analysis"
argument-hint: "<task-or-requirement>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Plan - Codex Planner

The user invoked:

```text
/ccg:plan $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:plan`.

This command is Codex-native:

- Codex owns context search, requirement enhancement, final plan synthesis, and writing new plans under `.codex/ccg/plans/*.md`.
- Gemini must participate as a read-only analysis helper through the bundled preview helper, using `gemini-3.1-pro-preview` by default.
- Do not write or present a final plan unless the helper printed `CCG_GEMINI_RESPONSE_FILE` and Codex read a non-empty response from that file.
- Do not call Claude-side wrappers or spend Claude execution quota.
- Do not modify product code. This command may only write new CCG plan files under `.codex/ccg/plans/`; existing `.claude/plan/*.md` files are legacy compatibility inputs and may be revised only when the user explicitly names that existing file.
- All user-facing output for this command must be Chinese by default, including usage/help, progress summaries, questions, failure reports, saved-plan summaries, and the next manual command.
- The saved CCG plan content itself must be Chinese by default. Section headings, table headers, checklists, narrative analysis, risks, test strategy, and handoff prose must be Chinese. English is allowed only for literal file paths, commands, code identifiers, generated slugs, URLs, model names, and environment variables.
- After writing the plan, show the saved path and the next manual command: `/ccg:execute <plan-path>`.
