---
name: init
description: Initialize Codex-native CCG project configuration. Use when the user invokes /ccg:init or asks to initialize CCG in a project.
---

# CCG Init

Initialize the current project for Codex-native CCG without overwriting user instructions.

## Behavior

- Detect the project root from the current workspace.
- Read existing `AGENTS.md`, `CLAUDE.md`, `README.md`, `package.json`, `pyproject.toml`, `go.mod`, and `Cargo.toml` when present.
- Create these directories when missing:
  - `.codex/ccg/`
  - `.codex/ccg/context/`
  - `.codex/ccg/notes/`
  - `.codex/ccg/plans/`
  - `.codex/ccg/specs/`
  - `.codex/ccg/team/`
  - `.codex/ccg/tmp/`
- Do not overwrite `AGENTS.md`, `CLAUDE.md`, or existing project rules.
- Only append a CCG section to `AGENTS.md` when the user explicitly asks.
- Explain in Chinese that `.claude/plan/**` remains a legacy compatibility input, while new CCG artifacts belong under `.codex/ccg/**`.

## Verification

After initialization, report created and pre-existing paths in Chinese.
