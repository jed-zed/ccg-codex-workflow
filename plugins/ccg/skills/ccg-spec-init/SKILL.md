---
name: spec-init
description: Initialize Codex-native CCG spec storage. Use when the user invokes /ccg:spec-init.
---

# CCG Spec Init

Initialize `.codex/ccg/specs/**` for spec-driven work.

## Behavior

- Use `scripts/spec_manager.js init`.
- Create `.codex/ccg/specs/`.
- Create `.codex/ccg/specs/README.md` when missing.
- Do not overwrite existing specs.
- Use `scripts/spec_manager.js create <name> --requirement "<text>"` when the user wants to start a named spec lifecycle.
- Explain that legacy `openspec/**` can be read as migration input but new CCG specs belong under `.codex/ccg/specs/**`.

Report in Chinese.
