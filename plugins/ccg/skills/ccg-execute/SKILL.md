---
name: execute
description: Execute a CCG plan with Codex as orchestrator and Gemini as a bounded helper. Use when the user invokes /ccg:execute or asks Codex to execute a .codex/ccg/plans/*.md file or legacy .claude/plan/*.md file.
---

# CCG Execute

Load and follow `skills/ccg-executor/SKILL.md`.

Treat the user argument as a CCG plan path or task description. New plans from `/ccg:plan` live under `.codex/ccg/plans/*.md`; legacy `.claude/plan/*.md` files remain valid read-compatible inputs. Codex owns context gathering, final code edits, verification, review, and Chinese delivery. Gemini may assist with focused code drafts, test ideas, UI prototypes, edge cases, or second-pass review, but Codex must verify and adapt its output.

Every Gemini call in the CCG workflow must use the bundled preview helper. Do not call the raw `gemini`, `gemini.cmd`, or `gemini.exe` CLI directly. `/ccg:gemini-preview` is only a manual smoke-test/debug entry; `/ccg:execute` must open the same browser preview automatically whenever it delegates to Gemini.
