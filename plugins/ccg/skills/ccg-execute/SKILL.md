---
name: execute
description: Execute a CCG plan with Codex as orchestrator and Gemini as a bounded helper. Use when the user invokes /ccg:execute or asks Codex to execute a .codex/ccg/plans/*.md file or legacy .claude/plan/*.md file.
---

# CCG Execute

Load and follow `skills/ccg-executor/SKILL.md`.

Treat the user argument as a CCG plan path or task description. New plans from `/ccg:plan` live under `.codex/ccg/plans/*.md`; legacy `.claude/plan/*.md` files remain valid read-compatible inputs. Codex owns context gathering, final code edits, verification, review, and Chinese delivery. Backend-only simple work may remain Codex-only, but Frontend/UI execution must be Gemini-first: Gemini produces the Unified Diff Patch prototype or bounded review, and Codex rewrites, applies, verifies, and reports the final workspace changes.

Every Gemini call in the CCG workflow must use the bundled preview helper. Do not call the raw `gemini`, `gemini.cmd`, or `gemini.exe` CLI directly. `/ccg:gemini-preview` is only a manual smoke-test/debug entry; `/ccg:execute` must open the same browser preview automatically whenever it delegates to Gemini.

For frontend, UI, styling, layout, component, accessibility, or responsive work, `/ccg:execute` must call Gemini with `--prompt-template frontend` or `--prompt-template prototype` before Codex edits the real workspace. Treat Gemini diffs as dirty prototypes, not final code. After Codex applies any frontend/UI change, run Gemini bounded review with `--prompt-template review` or `--prompt-template frontend`; retry Gemini failures twice, then stop and report missing Gemini evidence instead of pretending the review happened.
