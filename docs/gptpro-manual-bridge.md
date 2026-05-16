# GPT Pro Manual Bridge

## Purpose

The GPT Pro manual bridge gives Codex-native CCG workflows a user-mediated ChatGPT Pro second opinion for planning, review, and execution-companion analysis.

Codex remains final owner. GPT Pro output is helper evidence only.

## Hard Boundaries

- Do not automate ChatGPT web login.
- Do not automatically submit prompts to ChatGPT web.
- Do not read ChatGPT web DOM.
- Do not extract ChatGPT Output programmatically.
- No DOM extraction.
- No automatic prompt submission.
- No automatic output extraction.
- No cookies, sessions, account tokens, or browser credentials are stored.
- Do not bypass rate limits, restrictions, or protective measures.

The local helper may open `https://chatgpt.com/` in a browser as a user convenience. It must not inspect, click, scrape, or read the ChatGPT page.

## Manual Question Budget

Default one question.

- Expected manual questions: 1.
- Maximum manual questions: 2.
- Round 2 only for blocker re-check, revised plan comparison, applied diff review, or high-risk follow-up.
- More than two manual questions means the task should be decomposed or returned to `/ccg:plan`, `/ccg:spec-*`, `/ccg:review`, or another Codex-native CCG workflow.

## Manual Handoff Barrier

After Codex creates a GPT Pro bridge session, it must pause for user-mediated ChatGPT Pro work.

- Codex must display the full generated prompt in the chat.
- Codex must show the preview URL, session directory, prompt file path, response file path, and status file path.
- The preview page should be served by a detached local helper so Codex can end the current turn while the page remains available.
- The user manually submits the prompt to ChatGPT Pro and manually saves the output in the local bridge page or `response.md`.
- Codex must end the current assistant turn after the handoff instructions.
- Codex may continue only after `status.json` shows `response_saved=true` and `response.md is non-empty`.

## Commands

### `/ccg:gptpro-plan`

Use this for a planning second opinion.

Expected output from GPT Pro:

- planning risks
- alternative approaches
- missing context
- recommended implementation sequence
- test strategy
- blocking questions

Round 2 is only for blocker re-check or revised plan comparison.

### `/ccg:gptpro-review`

Use this for a review second opinion over a plan, diff, changed files, or verification summary.

Expected output from GPT Pro:

- blocking findings
- non-blocking findings
- test gaps
- possible false positives
- suggested fixes

Round 2 is only after Codex fixes blocker findings.

### `/ccg:gptpro-exc`

Use this for read-only implementation companion advice.

Expected output from GPT Pro:

- implementation sketch
- pseudo patch or unified diff if enough context exists
- tests to add
- edge cases
- risks
- verification commands

Round 2 should be converted into `/ccg:gptpro-review --from-exc <session>` whenever possible.

## Session Artifacts

Artifacts live under:

```text
.codex/ccg/gptpro/
```

Each session uses:

```text
.codex/ccg/gptpro/<timestamp>-<mode>-<slug>/
  status.json
  round-1/
    prompt.md
    response.md
  round-2/
    prompt.md
    response.md
  synthesis.md
```

`round-2` is created only for an explicit follow-up.

`status.json` records:

```json
{
  "provider": "chatgpt-pro-manual",
  "manual_questions_expected": 1,
  "manual_questions_max": 2,
  "manual_copy_required": true,
  "web_automation": false,
  "dom_extraction": false,
  "cookie_storage": false,
  "auto_submit": false,
  "auto_output_read": false
}
```

## Follow-up Rules

Round 2 must stay narrow:

- blocker re-check
- revised plan comparison
- applied diff review
- high-risk follow-up

Do not restart full analysis in round 2. Do not expand scope unless a new blocker appears.

## Why Web Automation Is Not Supported

OpenAI Terms of Use prohibit automatic or programmatic extraction of data or Output and prohibit interfering with or bypassing service restrictions or protective measures. See [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/).

If a future workflow needs full automation, use the official [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses) instead of ChatGPT web DOM automation.

## How Codex Uses GPT Pro Output

Codex reads the saved `response.md` only after the user manually pastes and saves it.

Codex must independently classify and verify GPT Pro findings before acting:

- blocking findings
- non-blocking findings
- possible false positives
- Codex actions

GPT Pro does not edit files, run commands, or own delivery.

## Troubleshooting

- If the browser does not open, use the printed `CCG_GPTPRO_PREVIEW_URL`.
- If copy fails, manually select the prompt text and copy it.
- If `response_saved` stays false, paste the response again and click Save Response.
- If round 3 is needed, split the task or return to native CCG workflows.
