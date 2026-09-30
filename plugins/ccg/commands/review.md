---
description: "Review a CCG implementation in Codex-led mode"
argument-hint: "[diff-or-plan-path]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, WebFetch]
---

# CCG Review

The user invoked:

```text
/ccg:review $ARGUMENTS
```

Use the installed CCG plugin skill `ccg:executor`.

Review the current diff or the implementation associated with `$ARGUMENTS`. Codex performs the primary review. Gemini may be asked for a bounded second-pass review, but Codex verifies findings before reporting them.

If Gemini is used, invoke the bundled browser preview helper automatically. Do not ask the user to run `/ccg:gemini-preview` first and do not call the raw Gemini CLI directly.

Review output must include:

```text
VALIDATION REPORT
=================
Task / Root Cause Coverage: XX/20 - [reason]
Code Quality: XX/20 - [reason]
Side Effects: XX/20 - [reason]
Edge Cases: XX/20 - [reason]
Test Coverage: XX/20 - [reason]

TOTAL SCORE: XX/100
```

Frontend/UI-heavy review output must also include:

```text
FRONTEND VALIDATION REPORT
==========================
User Experience: XX/20 - [reason]
Visual Consistency: XX/20 - [reason]
Accessibility: XX/20 - [reason]
Performance: XX/20 - [reason]
Browser Compatibility: XX/20 - [reason]

TOTAL SCORE: XX/100
```
