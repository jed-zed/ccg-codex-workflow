---
name: test
description: Add, repair, or design tests with Codex as the implementer. Use when the user invokes /ccg:test or asks CCG to improve test coverage.
---

# CCG Test

Load and follow `skills/ccg-executor/SKILL.md`.

Use this as the Codex-native equivalent of the original CCG `/ccg:test` command.

## Behavior

- Treat the user argument as a testing task: add coverage, repair failing tests, design fixtures, or improve validation.
- Inspect existing test style before adding new test infrastructure.
- Use Gemini through the bundled browser preview helper with `--prompt-template tester` for edge-case brainstorming, fixture design, or test gap review.
- Codex owns final test code, test execution, failures, and Chinese delivery.

## Verification

- Run the focused tests you changed or added.
- If a full suite is too slow or blocked, run the smallest meaningful subset and report the blocker.
