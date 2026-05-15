---
name: team-review
description: Review CCG team outputs, diffs, and tests. Use when the user invokes /ccg:team-review.
---

# CCG Team Review

Review team results before delivery.

## Checks

- Require `.codex/ccg/team/<task>/status.json` or `plan.md` evidence before concluding the review.
- Use `../ccg-team/scripts/team_plan_checker.js validate <plan.md> --json` when the assignment or conflict picture is unclear.
- Worker outputs match assigned scopes.
- Diff respects file ownership and merge strategy.
- Tests and verification match the plan.
- Same-file conflict risks are resolved.
- Security-sensitive changes are reviewed.

Gemini may provide a second-pass review through the preview helper; Codex delivers final judgment in Chinese.
