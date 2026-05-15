# Codex-Native CCG Team Workflow

The original CCG Agent Teams concept is mapped to Codex-native worker orchestration.

## Ownership Model

- Codex remains final owner of implementation, merge decisions, verification, and delivery.
- Workers are scoped helpers with explicit file or module ownership.
- Gemini remains a read-only helper through the bundled preview helper.
- No worker can bypass final Codex verification.

## Required Flow

1. `/ccg:team-research <task>` gathers evidence, risks, open questions, and a recommended ownership split.
2. `/ccg:team-plan <task>` creates `.codex/ccg/team/<task>/plan.md` with worker scopes, files, constraints, merge strategy, verification strategy, and conflict risks.
3. `/ccg:team-exec <plan>` dispatches scoped workers only after same-file conflicts are handled.
4. `/ccg:team-review <task>` reviews worker output, diff, tests, and residual risk.

## Conflict Rule

If two workers need the same file, the plan must either assign a single owner or define an explicit merge strategy before execution starts.
