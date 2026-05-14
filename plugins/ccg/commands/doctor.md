---
description: "Diagnose the local CCG Codex plugin installation"
argument-hint: "[-Json] [--fix]"
allowed-tools: [Read, Bash]
---

# CCG Doctor

The user invoked:

```text
/ccg:doctor $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:doctor`.

Run the doctor script from the plugin package. If `$ARGUMENTS` asks for JSON or machine-readable output, pass `-Json`; otherwise pass `-Verbose`.

If `$ARGUMENTS` includes `--fix`, use the `ccg:doctor` skill's source checkout guard. Only pass `-Fix` when the current workspace is the `ccg-codex-workflow` source checkout; otherwise run read-only diagnostics and explain that automatic cache repair needs the source checkout.

Summarize the result in Chinese:

- If `FAIL > 0`, list the failed checks and repair suggestions.
- If there are no failures but `WARN > 0`, explain that the plugin is usable and list optional or degraded items.
- Always mention that doctor can prove prompt-visible skills and file state, but cannot prove TUI slash autocomplete.

Do not install command bridge files, do not modify `.codex` beyond the explicit `--fix` cache refresh, and do not call a real Gemini model.
