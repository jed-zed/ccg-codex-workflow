---
name: spec-impl
description: Execute a spec-backed CCG plan. Use when the user invokes /ccg:spec-impl.
---

# CCG Spec Impl

Execute a plan backed by `.codex/ccg/specs/<name>/`.

## Behavior

- Read `.codex/ccg/specs/<name>/constraints.md`.
- Read `.codex/ccg/specs/<name>/plan.md` or `.codex/ccg/plans/<name>.md`.
- Run `../ccg-spec-init/scripts/spec_manager.js validate <name> --json` before execution.
- Refuse to execute when the spec is missing `constraints.md`, missing `plan.md`, or the existing artifacts fail validation.
- Execute through the normal `/ccg:execute` workflow.
- Archive results to `.codex/ccg/specs/<name>/archive.md` through `../ccg-spec-init/scripts/spec_manager.js archive <name> --summary-file <summary.md>`.

Codex remains final owner. Report in Chinese.
