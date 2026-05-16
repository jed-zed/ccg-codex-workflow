# Original CCG Parity Matrix

This matrix tracks how the Codex-native CCG plugin maps the original `fengmengmengji/ccg-workflow` command surface into a Codex-owned workflow.

The original project is Claude-led: Claude Code orchestrates Codex and Gemini. This plugin is Codex-led: Codex plans, executes, verifies, and delivers; Gemini is a bounded read-only helper that runs through the bundled browser preview helper.

## Status Legend

- `done`: Implemented in this plugin with command, skill, docs, validation, and fixture coverage.
- `phase-1`: Implemented in the high-frequency command parity pass.
- `planned`: Not implemented yet; mapped to a later Codex-native phase.
- `not-copied`: Intentionally not copied because it depends on Claude wrapper behavior or does not fit the Codex authority model.

## Full Parity Required Commands

| Command | Required | Current Status | Validation Group | Reason | Codex-native replacement |
| --- | --- | --- | --- | --- | --- |
| `/ccg:workflow` | yes | done | core | Original workflow entry | Codex-native workflow explanation |
| `/ccg:plan` | yes | done | artifact-path | Original planning entry | Chinese `.codex/ccg/plans/*.md` planner with Gemini gate |
| `/ccg:execute` | yes | done | artifact-path | Original execution entry | Codex-owned executor for `.codex/ccg/plans` and legacy `.claude/plan` inputs |
| `/ccg:codex-exec` | yes | done | artifact-path | Explicit Codex execution alias | Alias to `/ccg:execute` |
| `/ccg:review` | yes | done | core | Original review workflow | Codex-led review with optional Gemini second pass |
| `/ccg:feat` | yes | done | phase-one | Feature workflow | Codex implementation with bounded Gemini help |
| `/ccg:frontend` | yes | done | phase-one | Frontend workflow | Codex implementation with Gemini UI reference |
| `/ccg:backend` | yes | done | phase-one | Backend workflow | Codex primary backend executor |
| `/ccg:analyze` | yes | done | phase-one | Analysis workflow | Read-only Codex analysis |
| `/ccg:debug` | yes | done | phase-one | Debug workflow | Reproduce, diagnose, fix, verify |
| `/ccg:optimize` | yes | done | phase-one | Optimization workflow | Evidence-led Codex optimization |
| `/ccg:test` | yes | done | phase-one | Test workflow | Add, repair, or design tests |
| `/ccg:enhance` | yes | done | phase-one | Enhancement workflow | Scoped Codex enhancement |
| `/ccg:init` | yes | done | git-context | Project setup | Initialize `.codex/ccg/**` without overwriting user rules |
| `/ccg:context` | yes | done | git-context | Context history | Manage `.codex/ccg/context/**` |
| `/ccg:commit` | yes | done | git-context | Git commit helper | Dry-run commit message plus optional gate runner |
| `/ccg:rollback` | yes | done | git-context | Git rollback helper | Safe revert/restore planning plus confirmed non-destructive execution |
| `/ccg:clean-branches` | yes | done | git-context | Branch cleanup | Dry-run merged branch cleanup with protected branches |
| `/ccg:worktree` | yes | done | git-context | Worktree helper | Safe list/add/remove helper |
| `/ccg:spec-init` | yes | done | spec | OPSX/spec init | Initialize `.codex/ccg/specs/**` |
| `/ccg:spec-research` | yes | done | spec | OPSX/spec research | Write research and constraints under `.codex/ccg/specs/<name>/` |
| `/ccg:spec-plan` | yes | done | spec | OPSX/spec planning | Create Chinese spec-backed plans |
| `/ccg:spec-impl` | yes | done | spec | OPSX/spec implementation | Execute spec-backed plans through Codex |
| `/ccg:spec-review` | yes | done | spec | OPSX/spec review | Review constraints, tests, scope, and security deltas |
| `/ccg:team` | yes | done | team | Agent team router | Codex-native team router |
| `/ccg:team-research` | yes | done | team | Agent team research | Scoped Codex worker research |
| `/ccg:team-plan` | yes | done | team | Agent team planning | Worker ownership plan |
| `/ccg:team-exec` | yes | done | team | Agent team execution | Scoped worker dispatch with Codex final owner |
| `/ccg:team-review` | yes | done | team | Agent team review | Final Codex review of worker outputs |
| Claude `codeagent-wrapper` | no | not-copied | not-copied | Claude quota and wrapper runtime do not fit Codex authority | `invoke_gemini_preview.py` read-only helper |
| Claude `SESSION_ID` resume | no | not-copied | not-copied | Opaque Claude sessions cannot be resumed safely in Codex | Fresh Codex context search plus explicit `.codex/ccg/**` artifacts |
| Legacy `.claude/plan` default writes | no | not-copied | artifact-path | New Codex products should not be written to Claude paths | Read-compatible legacy input; new writes use `.codex/ccg/plans` |

## Command Matrix

| Original command | Status | Codex-native mapping | Notes |
| --- | --- | --- | --- |
| `/ccg:workflow` | done | `/ccg:workflow` | Explains Codex-native CCG workflow. |
| `/ccg:plan` | done | `/ccg:plan` | Codex writes Chinese `.codex/ccg/plans/*.md`; Gemini gate is mandatory. |
| `/ccg:execute` | done | `/ccg:execute` | Codex executes `.codex/ccg/plans/*.md` and legacy `.claude/plan/*.md` inputs. |
| `/ccg:codex-exec` | done | `/ccg:codex-exec` | Explicit Codex-led execution alias. |
| `/ccg:review` | done | `/ccg:review` | Codex-led review; Gemini optional second pass. |
| `/ccg:feat` | done | `/ccg:feat` | Feature implementation without requiring a separate plan file. |
| `/ccg:frontend` | done | `/ccg:frontend` | Gemini is strong UI/UX reference; Codex implements and verifies. |
| `/ccg:backend` | done | `/ccg:backend` | Codex primary; Gemini optional for risk and review. |
| `/ccg:analyze` | done | `/ccg:analyze` | Read-only analysis unless the user asks to implement. |
| `/ccg:debug` | done | `/ccg:debug` | Reproduce, diagnose, fix, and verify. |
| `/ccg:optimize` | done | `/ccg:optimize` | Evidence-led optimization with regression checks. |
| `/ccg:test` | done | `/ccg:test` | Add, repair, or design tests. |
| `/ccg:enhance` | done | `/ccg:enhance` | Scoped enhancement of existing behavior. |
| `/ccg:init` | done | `/ccg:init` | Project CCG initialization under `.codex/ccg/**` without overwriting local instructions. |
| `/ccg:context` | done | `/ccg:context` | Codex-native context log/summarize/history workflow. |
| `/ccg:commit` | done | `/ccg:commit` | Safe commit planning/helper replacement; recommends gates and asks before commit. |
| `/ccg:rollback` | done | `/ccg:rollback` | Safe revert/restore planning replacement; destructive actions require explicit confirmation. |
| `/ccg:clean-branches` | done | `/ccg:clean-branches` | Dry-run first; protect main/current/unmerged branches. |
| `/ccg:worktree` | done | `/ccg:worktree` | Codex branch/worktree helper with safe paths. |
| `/ccg:spec-init` | done | `/ccg:spec-init` | OPSX/spec initialization adapted to `.codex/ccg/specs/**`. |
| `/ccg:spec-research` | done | `/ccg:spec-research` | Requirements and constraints research. |
| `/ccg:spec-plan` | done | `/ccg:spec-plan` | Spec-driven Chinese implementation plan under `.codex/ccg/specs/**` and `.codex/ccg/plans/**`. |
| `/ccg:spec-impl` | done | `/ccg:spec-impl` | Execute a spec-backed plan through `/ccg:execute`. |
| `/ccg:spec-review` | done | `/ccg:spec-review` | Codex-led spec/code review with optional Gemini. |
| `/ccg:team` | done | `/ccg:team` | Dispatch Codex subagents instead of Claude Agent Teams. |
| `/ccg:team-research` | done | `/ccg:team-research` | Parallel explorer-style research. |
| `/ccg:team-plan` | done | `/ccg:team-plan` | Codex consolidates WBS and ownership. |
| `/ccg:team-exec` | done | `/ccg:team-exec` | Workers execute scoped file/module ownership. |
| `/ccg:team-review` | done | `/ccg:team-review` | Codex primary review plus optional Gemini second pass. |
| `/ccg:gptpro-plan` | done | `/ccg:gptpro-plan` | Codex + Gemini + GPT Pro planning-only workflow with manual GPT Pro handoff. |
| `/ccg:gptpro-review` | done | `/ccg:gptpro-review` | Codex + Gemini + GPT Pro review workflow with manual GPT Pro handoff. |
| `/ccg:gptpro-exc` | done | `/ccg:gptpro-exc` | Codex + Gemini + GPT Pro execution-companion workflow with manual GPT Pro handoff. |
| Claude `codeagent-wrapper` | not-copied | `invoke_gemini_preview.py` | Replaced by bounded Gemini preview helper; no Claude quota or session resume. |
| Claude `SESSION_ID` resume | not-copied | Fresh Codex context search | Legacy session IDs are provenance only. |

## Additional Codex-native Assistance Paths

CCG also supports a GPT Pro manual bridge. These commands are Codex + Gemini + GPT Pro workflows, not ChatGPT web automation and not a replacement for Codex ownership:

- `/ccg:gptpro-plan` - Codex + Gemini + GPT Pro planning-only workflow.
- `/ccg:gptpro-review` - Codex + Gemini + GPT Pro review workflow.
- `/ccg:gptpro-exc` - Codex + Gemini + GPT Pro execution companion.

Codex runs Gemini through the bundled preview helper first, then the user manually copies prompts into ChatGPT Pro and manually saves responses into `.codex/ccg/gptpro/**`. Codex remains the final planner, executor, reviewer, and verifier.

## Behavioral Depth Coverage

| Area | Script | Status |
| --- | --- | --- |
| Spec lifecycle | `spec_manager.js` | done |
| Team plan conflict check | `team_plan_checker.js` | done |
| Rollback non-destructive execution | `rollback_helper.js` | done |
| Commit gate runner | `commit_helper.js` | done |

## Expert Prompt Template Matrix

| Original role | Status | Codex-native Gemini template |
| --- | --- | --- |
| analyzer | done | `plugins/ccg/skills/ccg-executor/templates/gemini/analyzer.md` |
| architect | done | `plugins/ccg/skills/ccg-executor/templates/gemini/architect.md` |
| debugger | done | `plugins/ccg/skills/ccg-executor/templates/gemini/debugger.md` |
| optimizer | done | `plugins/ccg/skills/ccg-executor/templates/gemini/optimizer.md` |
| reviewer | done | `plugins/ccg/skills/ccg-executor/templates/gemini/review.md` |
| tester | done | `plugins/ccg/skills/ccg-executor/templates/gemini/tester.md` |
| frontend | done | `plugins/ccg/skills/ccg-executor/templates/gemini/frontend.md` |
| planner | done | `plugins/ccg/skills/ccg-executor/templates/gemini/plan.md` |
| prototype | done | `plugins/ccg/skills/ccg-executor/templates/gemini/prototype.md` |

## Domain, UI, and Scrapling Parity

- Domain references are migrated as Codex rule files under `plugins/ccg/rules/domain-*.md`.
- Impeccable UI is migrated as `plugins/ccg/rules/impeccable-ui.md` and is triggered by frontend/UI-heavy tasks.
- Scrapling-like behavior is guarded by `plugins/ccg/rules/scrapling.md`; unsafe scraping behaviors remain outside parity unless explicit safety boundaries are met.

## Acceptance Notes

- A command is not considered parity-complete until it has a command file, skill, `agents/openai.yaml`, command index entry, bridge coverage, README mention, doctor diagnostic coverage, and fixture/validation coverage.
- This matrix claims full original CCG command-surface parity. Core behavior-depth parity is implemented through safer Codex-native artifact workflows rather than behavior-for-behavior copies of Claude, OPSX, or Agent Teams runtime behavior.
- Slash autocomplete is verified in Codex Desktop after plugin cache sync and session restart. Codex CLI 0.130/TUI still requires prompt-text invocation as the supported fallback when autocomplete is absent.
- Gemini helper calls must open the browser preview automatically unless the user explicitly asks for headless execution.
- Full parity release language still requires local validation and a real green GitHub Actions run on Ubuntu and Windows.
