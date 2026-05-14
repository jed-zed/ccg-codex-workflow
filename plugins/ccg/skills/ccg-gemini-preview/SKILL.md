---
name: gemini-preview
description: Run a read-only Gemini helper task with a local browser preview. Use when the user invokes /ccg:gemini-preview, asks to test Gemini preview, or wants to watch Gemini output while Codex delegates a CCG helper task.
---

# CCG Gemini Preview

Use the Gemini preview helper bundled with this plugin:
`../ccg-executor/scripts/invoke_gemini_preview.py`.

Default command:

```powershell
python "<plugin-skill-root>\ccg-executor\scripts\invoke_gemini_preview.py" --workdir "<repo-abs-path>" --model gemini-3.1-pro-preview --prompt-template general --prompt "<focused prompt>"
```

The helper defaults to `gemini-3.1-pro-preview` when `--model` is omitted, while `GEMINI_MODEL` and `--model` can still override it. It also defaults to `--prompt-template general`, with additional templates `plan`, `prototype`, `review`, and `frontend` bundled under `ccg-executor/templates/gemini/`. These templates preserve the original CCG model boundary: Gemini is read-only and Codex owns final application and verification. It runs Gemini in a disposable workspace snapshot by default. Use `--direct-workdir` only when the user explicitly accepts direct workspace access.

For background mode, add `--detach`. The helper should still open the browser automatically and print `CCG_GEMINI_PREVIEW_URL`, `CCG_GEMINI_BROWSER_OPENED`, `CCG_GEMINI_RESPONSE_FILE`, `CCG_GEMINI_PROMPT_TEMPLATE`, and `CCG_GEMINI_AUTO_CLOSE_BROWSER_SECONDS`; later read the response file before using Gemini's output. The preview page closes itself after completion by default. Use `--no-auto-close-browser` only when the user explicitly wants the preview tab kept open.
