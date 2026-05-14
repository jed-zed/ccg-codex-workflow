---
name: enhance
description: Enhance an existing feature while preserving current behavior and repository patterns. Use when the user invokes /ccg:enhance or asks CCG to improve an existing capability.
---

# CCG Enhance

Load and follow `skills/ccg-executor/SKILL.md`.

Use this as the Codex-native equivalent of the original CCG `/ccg:enhance` command.

## Behavior

- Identify current behavior, user-visible contract, tests, and constraints before editing.
- Keep the enhancement scoped; avoid unrelated refactors.
- Use Gemini through the bundled browser preview helper with `--prompt-template analyzer`, `--prompt-template frontend`, or `--prompt-template review` depending on whether the enhancement is architectural, UI-heavy, or risk-heavy.
- Codex owns final edits, tests, review, and Chinese delivery.

## Verification

- Run tests/typechecks for the touched area.
- If the enhancement changes user-facing behavior, include at least one manual or automated acceptance check.
