---
name: gptpro-review
description: Create a manual ChatGPT Pro review second-opinion bridge. Use when the user invokes /ccg:gptpro-review.
---

# CCG GPT Pro Review

This is a Codex + Gemini + GPT Pro review workflow.

Load and follow `skills/ccg-gptpro-bridge/SKILL.md`.

## Behavior

- Gather review input: plan, diff, touched files, test summary, or user-provided target.
- Run Gemini before GPT Pro using the bundled Gemini preview helper with `--prompt-template review`.
- Follow the Gemini Gate Before GPT Pro from `skills/ccg-gptpro-bridge/SKILL.md`: require a real `CCG_GEMINI_RESPONSE_FILE`, read a non-empty Gemini response from it, stop and do not create a GPT Pro bridge session if it is missing or empty, and do not invent Gemini findings.
- Include Codex's primary review notes, the Gemini response file path, and a concise Gemini findings summary in the GPT Pro prompt.
- Require GPT Pro to cross-score Codex primary review and Gemini Gate Evidence with `VALIDATION REPORT` and, for frontend/UI-heavy reviews, `FRONTEND VALIDATION REPORT`.
- Codex must adopt the more conservative score and blocking judgment when Codex, Gemini, and GPT Pro disagree.
- Required GPT Pro code review score block:

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

- Required GPT Pro frontend/UI score block when applicable:

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

- Build a single-round review prompt by default.
- Expected manual questions: 1.
- Maximum manual questions: 2.
- Round 2 only after Codex fixes blocker findings.
- Use `scripts/gptpro_bridge.py --mode review --detach-preview --open-preview --gemini-response-file <CCG_GEMINI_RESPONSE_FILE> --gemini-summary-file <summary-file>`.
- After response is saved, classify:
  - blocking findings
  - non-blocking findings
  - possible false positives
  - Codex actions
- Report in Chinese and synthesize Codex, Gemini, and GPT Pro findings.
- Include `TOTAL SCORE: XX/100` in the final synthesis and explain any score that was lowered because of missing evidence or unresolved blockers.
- Codex remains final owner.
- Do not automate ChatGPT web login.
- Do not read ChatGPT web DOM.
- Do not extract ChatGPT Output programmatically.

## Manual Handoff Barrier

- After creating the bridge artifacts, show only handoff metadata.
- Do not paste the full generated prompt into chat.
- Show the preview URL, session directory, prompt file path, response file path, and status file path.
- Tell the user to open the preview page and use the preview page Copy Prompt button, then manually submit the prompt to ChatGPT Pro and manually save the response.
- End the current assistant turn after the handoff. Do not continue the review analysis in the same turn.
- Continue only after `status.json` shows `response_saved=true` and `response.md is non-empty`.
