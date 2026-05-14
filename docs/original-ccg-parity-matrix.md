# Original CCG Parity Matrix

This matrix tracks how the Codex-native CCG plugin maps the original `fengmengmengji/ccg-workflow` command surface into a Codex-owned workflow.

The original project is Claude-led: Claude Code orchestrates Codex and Gemini. This plugin is Codex-led: Codex plans, executes, verifies, and delivers; Gemini is a bounded read-only helper that runs through the bundled browser preview helper.

## Status Legend

- `done`: Implemented in this plugin with command, skill, and docs coverage.
- `phase-1`: Implemented in the high-frequency command parity pass.
- `planned`: Not implemented yet; mapped to a later Codex-native phase.
- `not-copied`: Intentionally not copied because it depends on Claude wrapper behavior or does not fit the Codex authority model.

## Command Matrix

| Original command | Status | Codex-native mapping | Notes |
| --- | --- | --- | --- |
| `/ccg:workflow` | done | `/ccg:workflow` | Explains Codex-native CCG workflow. |
| `/ccg:plan` | done | `/ccg:plan` | Codex writes `.claude/plan/*.md`; Gemini gate is mandatory. |
| `/ccg:execute` | done | `/ccg:execute` | Codex executes plans; Gemini is bounded helper. |
| `/ccg:codex-exec` | done | `/ccg:codex-exec` | Explicit Codex-led execution alias. |
| `/ccg:review` | done | `/ccg:review` | Codex-led review; Gemini optional second pass. |
| `/ccg:feat` | phase-1 | `/ccg:feat` | Feature implementation without requiring a separate plan file. |
| `/ccg:frontend` | phase-1 | `/ccg:frontend` | Gemini is strong UI/UX reference; Codex implements and verifies. |
| `/ccg:backend` | phase-1 | `/ccg:backend` | Codex primary; Gemini optional for risk and review. |
| `/ccg:analyze` | phase-1 | `/ccg:analyze` | Read-only analysis unless the user asks to implement. |
| `/ccg:debug` | phase-1 | `/ccg:debug` | Reproduce, diagnose, fix, verify. |
| `/ccg:optimize` | phase-1 | `/ccg:optimize` | Evidence-led optimization with regression checks. |
| `/ccg:test` | phase-1 | `/ccg:test` | Add, repair, or design tests. |
| `/ccg:enhance` | phase-1 | `/ccg:enhance` | Scoped enhancement of existing behavior. |
| `/ccg:init` | planned | `/ccg:init` | Project CCG initialization without overwriting local instructions. |
| `/ccg:context` | planned | `/ccg:context` | Codex-native context log/compress/history workflow. |
| `/ccg:commit` | planned | `/ccg:commit` | Safe commit helper; runs gates and asks before commit. |
| `/ccg:rollback` | planned | `/ccg:rollback` | Safe revert/reset planning; destructive actions require explicit confirmation. |
| `/ccg:clean-branches` | planned | `/ccg:clean-branches` | Dry-run first; protect main/current/unmerged branches. |
| `/ccg:worktree` | planned | `/ccg:worktree` | Codex branch/worktree helper with safe paths. |
| `/ccg:spec-init` | planned | `/ccg:spec-init` | OpenSpec/OPSX initialization adapted to Codex. |
| `/ccg:spec-research` | planned | `/ccg:spec-research` | Requirements and constraints research. |
| `/ccg:spec-plan` | planned | `/ccg:spec-plan` | Spec-driven implementation plan under `.claude/plan`. |
| `/ccg:spec-impl` | planned | `/ccg:spec-impl` | Execute a spec-backed plan through `/ccg:execute`. |
| `/ccg:spec-review` | planned | `/ccg:spec-review` | Codex-led spec/code review with optional Gemini. |
| `/ccg:team` | planned | `/ccg:team` | Dispatch Codex subagents instead of Claude Agent Teams. |
| `/ccg:team-research` | planned | `/ccg:team-research` | Parallel explorer-style research. |
| `/ccg:team-plan` | planned | `/ccg:team-plan` | Codex consolidates WBS and ownership. |
| `/ccg:team-exec` | planned | `/ccg:team-exec` | Workers execute scoped file/module ownership. |
| `/ccg:team-review` | planned | `/ccg:team-review` | Codex primary review plus optional Gemini second pass. |
| Claude `codeagent-wrapper` | not-copied | `invoke_gemini_preview.py` | Replaced by bounded Gemini preview helper; no Claude quota or session resume. |
| Claude `SESSION_ID` resume | not-copied | Fresh Codex context search | Legacy session IDs are provenance only. |

## Expert Prompt Template Matrix

| Original role | Status | Codex-native Gemini template |
| --- | --- | --- |
| analyzer | phase-1 | `plugins/ccg/skills/ccg-executor/templates/gemini/analyzer.md` |
| architect | phase-1 | `plugins/ccg/skills/ccg-executor/templates/gemini/architect.md` |
| debugger | phase-1 | `plugins/ccg/skills/ccg-executor/templates/gemini/debugger.md` |
| optimizer | phase-1 | `plugins/ccg/skills/ccg-executor/templates/gemini/optimizer.md` |
| reviewer | done | `plugins/ccg/skills/ccg-executor/templates/gemini/review.md` |
| tester | phase-1 | `plugins/ccg/skills/ccg-executor/templates/gemini/tester.md` |
| frontend | done | `plugins/ccg/skills/ccg-executor/templates/gemini/frontend.md` |
| planner | done | `plugins/ccg/skills/ccg-executor/templates/gemini/plan.md` |
| prototype | done | `plugins/ccg/skills/ccg-executor/templates/gemini/prototype.md` |

## Later Parity Phases

1. Git and context workflow: `init`, `context`, `commit`, `rollback`, `clean-branches`, `worktree`.
2. OPSX/spec workflow: `spec-init`, `spec-research`, `spec-plan`, `spec-impl`, `spec-review`.
3. Team workflow: `team`, `team-research`, `team-plan`, `team-exec`, `team-review`.
4. Domain skills: development, architecture, DevOps, security, AI, frontend design, and data engineering references.
5. Impeccable UI and Scrapling: migrate as Codex skills/references with Gemini read-only behavior.

## Acceptance Notes

- A command is not considered parity-complete until it has a command file, skill, `agents/openai.yaml`, command index entry, bridge coverage, README mention, and fixture/validation coverage.
- Slash autocomplete is still client-dependent. Prompt-text invocation remains the supported fallback.
- Gemini helper calls must open the browser preview automatically unless the user explicitly asks for headless execution.
