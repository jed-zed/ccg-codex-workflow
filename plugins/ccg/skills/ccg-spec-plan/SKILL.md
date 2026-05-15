---
name: spec-plan
description: Create a Chinese Codex-native implementation plan from a CCG spec. Use when the user invokes /ccg:spec-plan.
---

# CCG Spec Plan

Create a zero-decision implementation plan from `.codex/ccg/specs/<name>/constraints.md`.

## Outputs

- `.codex/ccg/specs/<name>/plan.md`
- `.codex/ccg/plans/<name>.md` when a standalone execution plan is useful

## Required Plan Content

- 验收标准
- 关键文件
- 实施顺序
- 验证命令
- 风险表
- Codex/Gemini 分析

Saved plan content must be Chinese by default, matching `/ccg:plan`.
