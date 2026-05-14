---
name: backend
description: Implement backend-heavy work with Codex as the primary executor. Use when the user invokes /ccg:backend or asks CCG to handle APIs, services, data flows, jobs, storage, or backend architecture.
---

# CCG Backend

Load and follow `skills/ccg-executor/SKILL.md`.

Use this as the Codex-native equivalent of the original CCG `/ccg:backend` command.

## Behavior

- Treat the user argument as backend-heavy work: APIs, services, data flow, storage, jobs, migrations, auth, validation, or backend architecture.
- Codex is the primary implementer and reviewer. Gemini is optional for simple or local backend fixes.
- Use Gemini through the bundled browser preview helper when the task involves broad architecture, risky edge cases, concurrency, data integrity, security boundaries, or a second-pass review.
- Prefer `--prompt-template architect` for design alternatives, `--prompt-template tester` for test ideas, and `--prompt-template review` for review.
- Codex owns final edits, migration safety, tests, diff review, and Chinese delivery.

## Verification

- Run focused backend tests, type checks, schema checks, or smoke scripts.
- For security-sensitive backend changes, run or equivalently perform `/ccg:verify-security <changed-path>`.
