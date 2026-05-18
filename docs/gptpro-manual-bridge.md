# GPT Pro Manual Bridge

## Purpose

The GPT Pro manual bridge gives Codex-native CCG workflows a user-mediated ChatGPT Pro second opinion for planning, review, and execution-companion analysis inside a Codex + Gemini + GPT Pro flow.

Codex remains final owner. Gemini provides automatic read-only helper analysis through the bundled Gemini preview helper. GPT Pro output is manual helper evidence only.

## Tri-model Order

Run Gemini before GPT Pro.

- Codex gathers the task, local context, relevant diff or plan evidence, and its preliminary analysis.
- Codex runs Gemini through the bundled Gemini preview helper.
- Codex includes the Gemini response file path and a concise Gemini findings summary in the GPT Pro manual prompt.
- Codex stops at the manual handoff barrier and waits for the user to save GPT Pro output.
- After the user saves GPT Pro output, Codex must synthesize Codex, Gemini, and GPT Pro findings in Chinese.
- Gemini and GPT Pro remain helper evidence only; Codex makes the final decision.

## Gemini Gate Before GPT Pro

Before creating a GPT Pro manual prompt, Codex must have:

- a successful Gemini helper launch through the bundled preview helper;
- a real `CCG_GEMINI_RESPONSE_FILE` path;
- a non-empty Gemini response read from that file;
- a concise Gemini findings summary derived from that response file.

If Gemini fails, does not produce a response file, or writes an empty response, stop in Chinese and do not create a GPT Pro bridge session. Do not invent Gemini findings.

The helper enforces this with:

```text
--gemini-response-file <CCG_GEMINI_RESPONSE_FILE>
--gemini-summary-file <summary-file>
```

For short diagnostics or fixtures, `--gemini-summary "<summary>"` may be used instead of a summary file.

The helper injects Gemini Gate Evidence into `prompt.md` and records auditable provenance in `status.json`:

- `response_file`
- `response_non_empty`
- `response_chars`
- `response_sha256`
- `summary`

## Project Access Context

The prompt also includes a Project Access Context section so ChatGPT Pro can understand where the work lives.

The helper auto-detects Git metadata when available:

- project name
- sanitized repository URL from `origin`
- current branch
- current commit
- clean or dirty local status

Codex may override the detected repository URL with:

```text
--repo-url <repository-url>
```

The helper sanitizes repository URLs before writing prompts or `status.json`; credentials, access tokens, cookies, and local filesystem paths must not be included as repository URLs.

A GitHub URL is useful but not enough on its own. If ChatGPT Pro has GitHub connector, Deep Research, or browsing available, it may inspect the URL and cite exact file paths or commits. If it cannot access the URL, it must rely on the pasted CCG input, Gemini Gate Evidence, diffs, and file excerpts. Pasted context has priority because uncommitted local changes may not exist on GitHub.

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

- Codex must not paste the full generated prompt into chat during normal handoffs.
- Codex must show the preview URL, session directory, prompt file path, response file path, and status file path.
- The preview page should be served by a detached local helper so Codex can end the current turn while the page remains available.
- The user opens the preview page and uses the preview page Copy Prompt button, or opens `prompt.md` if the browser copy button fails.
- The user manually submits the prompt to ChatGPT Pro and manually saves the output in the local bridge page or `response.md`.
- Codex must end the current assistant turn after the handoff instructions.
- Codex may continue only after `status.json` shows `response_saved=true` and `response.md is non-empty`.

## Commands

### `/ccg:gptpro-plan`

Use this for a Codex + Gemini + GPT Pro planning workflow with a manual GPT Pro planning second opinion.

Plan-only Boundary:

- Do not execute implementation.
- Do not apply code changes except writing or updating CCG plan artifacts and GPT Pro bridge artifacts.
- Do not mutate product code, commit, push, create a pull request, or continue into `/ccg:execute` behavior.
- After the user saves GPT Pro output, Codex may synthesize Codex, Gemini, and GPT Pro planning findings, produce or revise the plan, report the plan location, and stop.
- Execution requires a separate `/ccg:execute <plan>` or `/ccg:codex-exec <plan>` request.

Expected output from GPT Pro:

- planning risks
- alternative approaches
- missing context
- recommended implementation sequence
- test strategy
- blocking questions

Round 2 is only for blocker re-check or revised plan comparison.

### `/ccg:gptpro-review`

Use this for a Codex + Gemini + GPT Pro review workflow over a plan, diff, changed files, or verification summary.

Expected output from GPT Pro:

- blocking findings
- non-blocking findings
- test gaps
- possible false positives
- suggested fixes

Round 2 is only after Codex fixes blocker findings.

### `/ccg:gptpro-exc`

Use this for a Codex + Gemini + GPT Pro read-only implementation companion workflow.

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
