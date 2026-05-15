---
name: rollback
description: Plan safe rollback or revert operations. Use when the user invokes /ccg:rollback.
---

# CCG Rollback

Plan rollback actions conservatively.

## Behavior

- Support `--last`, `<commit>`, `--file <path>`, and `--dry-run`.
- Default to dry-run previews such as:
  - `git revert --no-commit <sha>`
  - `git restore --source=<sha> -- <file>`
- Do not run `git reset --hard`, `git clean -fd`, or `git push --force` unless the user explicitly asks and confirms the destructive action.
- Preserve unrelated worktree changes.

## Helper

Use `scripts/rollback_helper.js` for command planning. Report in Chinese.
