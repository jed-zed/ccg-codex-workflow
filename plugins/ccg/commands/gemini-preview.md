---
description: "Run Gemini with a live browser preview"
argument-hint: "<prompt>"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Gemini Preview

Use the installed CCG plugin skill `ccg:gemini-preview`.

Run Gemini in read-only plan mode using the Codex-side browser preview helper. Treat the command argument as the focused Gemini prompt. The helper should open the browser preview automatically; if it cannot, report the printed `CCG_GEMINI_PREVIEW_URL`.
