---
name: clean-branches
description: Preview safe cleanup of merged Git branches. Use when the user invokes /ccg:clean-branches.
---

# CCG Clean Branches

Clean merged branches only after a dry-run review.

## Safety Rules

Protect:

- `main`
- `master`
- `develop`
- `dev`
- the current branch
- unmerged branches
- unknown remote-only branches
- branches matching protected patterns such as `release/*`, `hotfix/*`, and `prod/*`

Default behavior is dry-run. Execute deletion only when the user explicitly confirms.

## Helper

Use `scripts/clean_branches.js` for candidate analysis. Report in Chinese.
