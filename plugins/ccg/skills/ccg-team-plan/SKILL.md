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
