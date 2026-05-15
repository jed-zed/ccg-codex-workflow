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
```

Legacy `openspec/**` content may be read during migration, but new CCG spec artifacts should use `.codex/ccg/specs/**`.

## Flow

1. `/ccg:spec-init` creates the spec root.
2. `/ccg:spec-research <requirement>` writes research and constraints.
3. `/ccg:spec-plan <name>` creates a Chinese zero-decision implementation plan.
4. `/ccg:spec-impl <name>` executes through `/ccg:execute`.
5. `/ccg:spec-review <name>` checks constraints, acceptance criteria, tests, scope, and security-sensitive deltas.
