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
3. `plugins/ccg/skills/ccg-team/scripts/team_plan_checker.js` validates the plan, emits `can_execute`, and writes `.codex/ccg/team/<task>/status.json` when `validate` runs against a plan stored under the team artifact root.
4. `/ccg:team-exec <plan>` dispatches scoped workers only after `team_plan_checker.js validate <plan.md> --json` reports `can_execute=true`.
5. `/ccg:team-review <task>` reviews worker output, diff, tests, and residual risk using `status.json` or `plan.md` as evidence.

`summarize` and `conflicts` are read-only by default. Use `--write-status` when a query should also refresh `status.json`, or `--no-write-status` with `validate` for a validation-only check.

## Conflict Rule

If two workers need the same file, the plan must either assign a single owner or define an explicit merge strategy before execution starts. Generic text such as "Codex will reconcile later" is not sufficient; the merge strategy must name the conflicted file or workers and explain who will reconcile the change.
