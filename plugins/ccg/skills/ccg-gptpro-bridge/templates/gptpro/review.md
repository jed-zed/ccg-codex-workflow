# Mode: Review Second Opinion

Review the plan, diff, changed files, or verification summary below.

The input should include Codex's primary review notes and any available Gemini findings. Compare them, call out disagreements, and help Codex decide what is actually blocking.

## Expected Output

| Severity | File/Area | Finding | Rationale | Suggested Fix |
| --- | --- | --- | --- | --- |

Then provide:

- Must-fix before merge
- Should-fix later
- Test gaps
- Possible false positives
- Confidence and assumptions

Also include:

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

For frontend/UI-heavy input, also include:

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

Cross-score Codex primary review and Gemini findings. If evidence conflicts, use the more conservative score and blocker judgment.

Do not invent files. Do not assume hidden state.
