---
name: frontend
description: Build or review frontend/UI work with Codex as implementer and Gemini as a strong read-only UI helper. Use when the user invokes /ccg:frontend or asks CCG for UI, UX, component, styling, accessibility, or responsive work.
---

# CCG Frontend

Load and follow `skills/ccg-executor/SKILL.md`.

Use this as the Codex-native equivalent of the original CCG `/ccg:frontend` command.

## Behavior

- Treat the user argument as a frontend, UI, UX, component, styling, accessibility, or responsive-design task.
- Gemini is a strong reference for UI structure, interaction states, accessibility, responsive behavior, and visual risks.
- Unless the task is a tiny text-only tweak, call Gemini through the bundled browser preview helper with `--prompt-template frontend` before major UI edits or for a review pass after implementation.
- Codex must adapt Gemini output to the local framework, design system, and existing component patterns. Gemini output is not authoritative.
- Codex owns final edits, screenshot/playwright verification where applicable, tests, diff review, and Chinese delivery.
- Do not create marketing-style landing pages unless the user asked for one; build the actual usable experience first.

## Verification

- Run the relevant frontend typecheck, lint, component tests, or build.
- When a dev server is needed, start it and inspect the UI with a browser/screenshot workflow when available.
- Check text fit, layout overlap, responsive behavior, and accessibility-sensitive states.
