---
name: spec-impl
description: Execute a spec-backed CCG plan. Use when the user invokes /ccg:spec-impl.
---

# CCG Spec Impl

Execute a plan backed by `.codex/ccg/specs/<name>/`.

## Behavior

- Read `.codex/ccg/specs/<name>/constraints.md`.
- Read `.codex/ccg/specs/<name>/plan.md` or `.codex/ccg/plans/<name>.md`.
- Execute through the normal `/ccg:execute` workflow.
- Archive results to `.codex/ccg/specs/<name>/archive.md`.

Codex remains final owner. Report in Chinese.
