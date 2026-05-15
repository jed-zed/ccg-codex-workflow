---
name: spec-review
description: Review CCG spec, plan, implementation, and tests for consistency. Use when the user invokes /ccg:spec-review.
---

# CCG Spec Review

Review spec-driven work for consistency and scope control.

## Checks

- Run `../ccg-spec-init/scripts/spec_manager.js validate <name> --json` before review.
- Require both constraints and plan artifacts before treating the spec as reviewable.
- Implemented behavior matches constraints.
- Tests map to acceptance criteria.
- No out-of-scope behavior was added.
- Security-sensitive deltas were reviewed.
- Review output is written or summarized in Chinese and may update `.codex/ccg/specs/<name>/review.md` when requested.

Gemini may provide a bounded second-pass review through the preview helper; Codex makes the final judgment.
