---
name: rollback
description: Plan safe rollback or revert operations. Use when the user invokes /ccg:rollback.
---

# CCG Rollback

Plan rollback actions conservatively.

## Behavior

- Support `--last`, `--target <rev>`, `--branch <branch>`, `--file <path>`, `--mode revert|restore|reset`, `--depth <n>`, and `--dry-run`.
- Default to dry-run previews such as:
  - `git revert --no-commit <sha>`
  - `git restore --source=<sha> -- <file>`
- Non-destructive `revert` and `restore` may execute only after explicit confirmation.
- If `--branch <branch>` is provided for a confirmed rollback, the helper must verify the current branch matches it and refuse cross-branch execution.
- `git reset --hard` remains manual-only even with confirmation.
- `git clean -fd`, `git push --force`, and `git push -f` remain blocked/manual-only.
- Protected branches such as `main`, `master`, `production`, and `release` require `--protected-branch-ok` before executing a non-destructive rollback.
- Preserve unrelated worktree changes.

## Helper

Use `scripts/rollback_helper.js` for command planning. Report in Chinese.
