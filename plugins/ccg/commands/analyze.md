---
description: "Analyze code, architecture, risks, or implementation options without applying changes"
argument-hint: "<analysis-request>"
allowed-tools: [Read, Glob, Grep, Bash, WebFetch]
---

# CCG Analyze

The user invoked:

```text
/ccg:analyze $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:analyze`.

This command is read-only unless the user later asks for implementation. Codex performs the primary analysis and may ask Gemini for a bounded second perspective through the browser preview helper.
