---
name: optimize
description: Optimize performance, maintainability, or workflow bottlenecks with measured Codex-owned changes. Use when the user invokes /ccg:optimize.
---

# CCG Optimize

Load and follow `skills/ccg-executor/SKILL.md`.

Use this as the Codex-native equivalent of the original CCG `/ccg:optimize` command.

## Behavior

- Identify the optimization target and current bottleneck before editing.
- Prefer measurements, profiler output, tests, or static evidence over speculation.
- Preserve public behavior unless the user explicitly requests behavior changes.
- Use Gemini through the bundled browser preview helper with `--prompt-template optimizer` for alternative designs, performance tradeoffs, or missed regression risks.
- Codex owns final edits, benchmarks/tests, diff review, and Chinese delivery.

## Verification

- Run the smallest meaningful performance, build, test, or static check that proves the optimization did not break behavior.
- Report any missing benchmark or measurement limitation.
