---
name: debug
description: Debug a failure with Codex-led reproduction, root-cause analysis, and focused verification. Use when the user invokes /ccg:debug or provides an error, failing test, crash, or regression.
---

# CCG Debug

Load and follow `skills/ccg-executor/SKILL.md`.

Use this as the Codex-native equivalent of the original CCG `/ccg:debug` command.

## Behavior

- Reproduce or localize the failure before changing code when feasible.
- Gather exact error messages, failing commands, recent diffs, and relevant files.
- Prefer small fixes that address the root cause, not broad rewrites.
- Use Gemini through the bundled browser preview helper with `--prompt-template debugger` for complex root-cause hypotheses, race conditions, state-flow problems, or second-pass review.
- Codex owns final diagnosis, edits, verification, and Chinese delivery.

## Verification

- Re-run the failing command or the smallest meaningful reproduction.
- Add or update a regression test when the failure has a stable behavior boundary.
