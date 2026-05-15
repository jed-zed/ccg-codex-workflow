# Codex-Native CCG Spec Workflow

CCG spec artifacts live under `.codex/ccg/specs/**`.

## Storage

```text
.codex/ccg/specs/<spec-name>/
  research.md
  constraints.md
  plan.md
  review.md
  archive.md
  status.json
```

Legacy `openspec/**` content may be read during migration, but new CCG spec artifacts should use `.codex/ccg/specs/**`.

`plugins/ccg/skills/ccg-spec-init/scripts/spec_manager.js` is the lifecycle helper for init, artifact writes, validation, archive, and status updates.

## Flow

1. `/ccg:spec-init` creates the spec root through `spec_manager.js init`.
2. `/ccg:spec-research <requirement>` writes research and constraints, then runs `spec_manager.js validate <spec-name> --json`.
3. `/ccg:spec-plan <name>` refuses to proceed until `constraints.md` validates cleanly, then writes the plan artifacts.
4. `/ccg:spec-impl <name>` validates the spec again, executes through `/ccg:execute`, then archives the outcome.
5. `/ccg:spec-review <name>` validates artifacts first, then checks constraints, acceptance criteria, tests, scope, and security-sensitive deltas.
