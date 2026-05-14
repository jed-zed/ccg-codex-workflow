---
name: gemini-preview
description: Run a read-only Gemini helper task with a local browser preview. Use when the user invokes /ccg:gemini-preview, asks to test Gemini preview, or wants to watch Gemini output while Codex delegates a CCG helper task.
---

# CCG Gemini Preview

Use the Gemini preview helper bundled with this plugin:
`../ccg-executor/scripts/invoke_gemini_preview.py`.

Default command:

```powershell
python "<plugin-skill-root>\ccg-executor\scripts\invoke_gemini_preview.py" --workdir "<repo-abs-path>" --model gemini-3.1-pro-preview --prompt "<focused prompt>"
```

The helper defaults to `gemini-3.1-pro-preview` when `--model` is omitted, while `GEMINI_MODEL` and `--model` can still override it. It runs Gemini in a disposable workspace snapshot by default. Keep Gemini in read-only plan mode. Codex must inspect the output, adapt it to local code patterns, and apply any final edits itself. Use `--direct-workdir` only when the user explicitly accepts direct workspace access.

For background mode, add `--detach`. The helper should still open the browser automatically and print `CCG_GEMINI_PREVIEW_URL`, `CCG_GEMINI_BROWSER_OPENED`, and `CCG_GEMINI_RESPONSE_FILE`; later read the response file before using Gemini's output.
