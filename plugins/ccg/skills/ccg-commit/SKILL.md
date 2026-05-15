---
name: commit
description: Prepare a safe commit with CCG gates. Use when the user invokes /ccg:commit.
---

# CCG Commit

Help prepare a commit without surprising the user.

## Behavior

- Run `git status --short`.
- Distinguish staged, unstaged, and untracked files.
- Recommend `/ccg:verify-change`, `/ccg:verify-quality <changed-path>`, and `/ccg:verify-security <changed-path>` when the diff is broad or security-sensitive.
- Use `scripts/commit_helper.js --check-gates --json` to collect gate status before recommending a direct commit.
- Generate a concise conventional commit message.
- Default to showing the command:

```text
git commit -m "<message>"
```

- Execute the commit only when the user explicitly says to commit directly.
- Refuse `--execute` / `--confirm` when no staged files exist.
- Refuse `--execute` / `--confirm` when gates fail, unless the user explicitly accepts `--allow-gate-warnings`.

## Helper

Use `scripts/commit_helper.js` for mechanical status/message analysis. Report in Chinese.
