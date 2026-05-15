---
name: worktree
description: Manage Git worktrees safely. Use when the user invokes /ccg:worktree.
---

# CCG Worktree

Provide safe worktree list, add, and remove assistance.

## Behavior

- `list`: show `git worktree list`.
- `add <branch>`: propose a safe worktree add command.
- `remove <path> --dry-run`: preview removal.
- `remove <path> --confirm`: remove only when the target is not the current directory and has no uncommitted changes.

Never delete the current directory. Never remove a dirty worktree.

## Helper

Use `scripts/worktree_helper.js` for mechanical checks. Report in Chinese.
