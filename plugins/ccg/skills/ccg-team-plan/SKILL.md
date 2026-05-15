---
name: team-plan
description: Create a worker ownership plan for CCG team execution. Use when the user invokes /ccg:team-plan.
---

# CCG Team Plan

Create `.codex/ccg/team/<task>/plan.md`.

## Required Structure

```markdown
## Workers
| Worker | Scope | Files | Constraints |
|--------|-------|-------|-------------|

## Merge Strategy
## Verification Strategy
## Conflict Risks
```

Detect same-file ownership conflicts before recommending execution. Write the plan in Chinese by default.

## Required Helper Flow

- Validate the plan structure with `../ccg-team/scripts/team_plan_checker.js summarize <plan.md> --json`.
- Run `../ccg-team/scripts/team_plan_checker.js validate <plan.md> --json` before recommending `/ccg:team-exec`.
- Keep the plan executable by ensuring every same-file conflict is paired with an explicit merge strategy, not a generic promise to reconcile later.
