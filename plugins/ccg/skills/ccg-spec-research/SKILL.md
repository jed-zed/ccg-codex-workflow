---
name: spec-research
description: Convert a requirement into CCG research and constraints. Use when the user invokes /ccg:spec-research.
---

# CCG Spec Research

Turn fuzzy requirements into research and constraints under `.codex/ccg/specs/<name>/`.

## Outputs

- `.codex/ccg/specs/<name>/research.md`
- `.codex/ccg/specs/<name>/constraints.md`
- `.codex/ccg/specs/<name>/status.json`

## Required Helper Flow

- Use `../ccg-spec-init/scripts/spec_manager.js write-research <name> --file <research.md>`.
- Use `../ccg-spec-init/scripts/spec_manager.js write-constraints <name> --file <constraints.md>`.
- Run `../ccg-spec-init/scripts/spec_manager.js validate <name> --json` after writing both artifacts.
- If validation fails, report the blocking sections in Chinese instead of pretending the spec is ready.

Gemini may provide a read-only analyzer second view through the preview helper, but Codex writes the final Chinese constraints.
