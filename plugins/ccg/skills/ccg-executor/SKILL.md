---
name: executor
description: Run the CCG workflow inside Codex. Use when the user invokes /ccg, /ccg:workflow, /ccg:execute, /ccg:excute, /ccg:codex-exec, asks Codex to execute a .claude/plan/*.md file, or wants Codex to orchestrate Gemini while implementing a CCG plan.
---

# CCG Executor

You are the Codex-side orchestrator for CCG workflow plans. Plans may be produced by `/ccg:plan` or by legacy Claude CCG planning files; Codex owns execution, final code edits, verification, and delivery. Gemini is an auxiliary coding/review partner that Codex may call for bounded assistance, especially UI-heavy or broad implementation drafts.

## Hard Boundaries

- Do not modify the original Claude CCG plugin under `~/.claude/commands/ccg`, `~/.claude/.ccg`, or `~/.claude/skills/ccg`.
- Do not call `~/.claude/bin/codeagent-wrapper.exe` or use Claude execution quota.
- Do not let Gemini directly own the workspace. Gemini should provide analysis, implementation sketches, focused patches, tests, or review notes; Codex applies final edits and verifies them.
- Preserve existing user changes. Inspect `git status` before edits and work around unrelated dirty files.
- Communicate with the user in Chinese. Tool prompts and external documentation queries may be English.
- Prefer `mcp__ace-tool__search_context` as the primary semantic code search tool when the user has configured ace-tool globally. Use `mcp__fast-context__fast_context_search` as a supplement when ace-tool is unavailable or insufficient.

## Architecture Shift

The original CCG model was:

```text
Claude Code orchestrates Codex + Gemini
```

In Codex, the model is:

```text
Codex creates plans, orchestrates Gemini, applies code, verifies, and reports
Legacy Claude CCG plans may still be executed as input artifacts
```

When an old plan mentions `CODEX_SESSION`, `GEMINI_SESSION`, or Claude-driven handoff files, treat them as provenance and intent, not as sessions to resume. If the old workflow says Claude should dispatch subagents, translate that into Codex actions: local context search, optional Gemini read-only help, Codex edits, Codex verification.

## Input Handling

1. Treat the command argument as either:
   - a plan path, usually `.claude/plan/<task>.md`; or
   - a direct task description.
2. If it is a plan path, read the file and extract:
   - title and task type;
   - implementation steps;
   - key files and expected operations;
   - acceptance criteria and test commands;
   - any `CODEX_SESSION` / `GEMINI_SESSION` notes, for context only.
3. If it is a direct task description and no clear plan exists, ask for the plan path unless the user explicitly says to execute without a plan.
4. If the plan is UI-heavy or frontend-dominant, warn that this executor is optimized for backend-heavy work and ask before proceeding unless the user already explicitly chose Codex.
5. If the plan involves costly ML training, GPU jobs, destructive data writes, or production deployment, implement code and smoke tests only; do not start expensive or destructive runs without explicit confirmation.

## Gemini Delegation Policy

Use Gemini as a helper, not as the executor of record.

- Backend-heavy tasks: Gemini is optional. Use it for edge-case review, API design alternatives, test ideas, or a second-pass diff review when risk is meaningful.
- Pure backend/simple tasks: do not spend time delegating unless the plan asks for it or the logic is risky.
- Frontend-heavy or UI-heavy tasks: ask Gemini for a focused prototype, component structure, styling pass, or visual-risk review, then Codex implements and checks the result.
- Cross-cutting tasks: split the problem. Codex keeps ownership of shared contracts, migrations, data integrity, and verification; Gemini can draft isolated pieces or review specific files.
- Failed Gemini call: retry at most twice for UI-heavy work. For backend-heavy work, continue Codex-only and report the skipped delegation if relevant.

Recommended safe Gemini invocation:

```powershell
python "<path-to-this-skill>\scripts\invoke_gemini_preview.py" --workdir "<repo-abs-path>" --model gemini-2.5-flash --prompt-file "<prompt-file>"
```

Resolve `<path-to-this-skill>` from this `SKILL.md` directory. This helper creates a disposable snapshot of the workspace by default, starts a localhost browser preview, streams Gemini `stream-json` output into the page, and writes the raw output under `~/.codex/ccg/logs/`. It mirrors the original CCG `codeagent-wrapper` Web UI behavior without calling the Claude-side wrapper.

Use `--no-browser` only for quick smoke tests or when the user explicitly wants headless execution. For long-running background delegation, add `--detach`; the script prints `CCG_GEMINI_PREVIEW_PID`, `CCG_GEMINI_OUTPUT_FILE`, `CCG_GEMINI_RESPONSE_FILE`, and `CCG_GEMINI_LAUNCHER_LOG`. Later read the response file before acting on Gemini's suggestions. Use `--direct-workdir` only when the user explicitly accepts that Gemini may touch the real workspace.

Gemini prompts should include:

- task goal and relevant plan excerpt;
- exact files or snippets to inspect when available;
- a request for concise output: analysis, unified diff, test cases, or review findings;
- the constraint that Gemini must not require direct workspace writes.
- the constraint that Codex will verify and apply any final changes.

## Execution Workflow

### Phase 0: Preflight

- Run `git status --short`.
- Read project instructions (`AGENTS.md`, relevant project docs, and any plan-linked notes).
- Summarize the plan internally as scope, files, tests, and risks.
- For substantial tasks, maintain a task checklist and update it as work progresses.
- Decide whether Gemini assistance is useful and state that decision briefly in Chinese if the task is substantial.

### Phase 1: Context Search

- Use ace-tool first with a query built from the plan title, key files, domains, and symbols.
- Read the specific files needed after semantic search identifies them.
- Use exact search only for known identifiers, filenames, or error messages.
- If the plan references current library/API behavior, use Context7 or official docs before coding.
- Keep context focused on files that affect the implementation.

### Phase 2: Optional Gemini Assistance

- Build a narrow prompt from the current plan and local code context.
- Prefer asking for one of:
  - an implementation outline;
  - a focused unified diff;
  - missing edge cases/tests;
  - review findings on a specific diff.
- Treat Gemini output as untrusted suggestions. Codex must adapt it to local patterns and run verification.

### Phase 3: Implementation

- Implement directly in Codex using the repository's existing patterns.
- Prefer small, focused edits and existing helpers.
- Use tests first when the plan includes clear behavior or bugfix acceptance criteria; otherwise add focused tests in the most local existing test style.
- Use `apply_patch` for manual file edits.
- Do not rewrite plan files, handoff files, or original CCG workflow files as part of execution unless the user explicitly asks.

### Phase 4: Verification

- Run the narrowest relevant verification first:
  - backend TypeScript: workspace typecheck and focused tests;
  - Python/ML service: focused pytest or the script's smoke mode;
  - contracts/shared schemas: affected package tests/typecheck;
  - frontend touched incidentally: typecheck and focused component tests.
- Apply CCG quality gates when they match the scope:
  - `/ccg:verify-change` and `/ccg:verify-quality <changed-path>` for changes over roughly 30 lines or risky refactors;
  - `/ccg:verify-module <module-path>` for newly created modules;
  - `/ccg:verify-security <changed-path>` for auth, permission, validation, secrets, file upload, command execution, or network-boundary changes.
- If full verification is too slow or blocked by local services, run a smaller meaningful check and report the blocker.
- Fix regressions caused by the implementation before delivery.

### Phase 5: Review

- Inspect `git diff --stat` and the full relevant diff.
- Check that every changed file maps back to the plan scope.
- For large or risky diffs, use Gemini or a local Codex review/subagent for a bounded review pass, then independently verify the findings.
- Treat backend logic, data integrity, transactions, error handling, and tests as first-class review targets.

### Phase 6: Delivery

Report in Chinese with:

- what was implemented;
- changed files;
- verification commands and results;
- any blockers, residual risks, or manual follow-up.

Do not commit unless the user asks.

## CCG-Specific Notes

- A CCG plan's `SESSION_ID` section is for the old Claude-orchestrated workflow. In this Codex executor, use it only to understand provenance; do not try to resume those sessions.
- A plan may still say `/ccg:execute` as the launch command. Inside Codex, this plugin's `/ccg:execute` means direct Codex execution.
- `/ccg:excute` is preserved as a typo alias for muscle memory.
- `/ccg:ccg` and `/ccg:workflow` are help/index entries that should route the user into this Codex-native workflow.
- Respect each repository's local `AGENTS.md` and project-specific rules. When no stronger project rule exists, use ace-tool first if configured and fast-context second.

## Bundled Rule References

When the task needs more detail, read only the relevant rule file under `../../rules/`:

- `ccg-fast-context.md` for ace-tool and fast-context routing.
- `ccg-search-evidence.md` for web/search evidence standards.
- `ccg-quality-gates.md` for quality gate trigger rules.
- `ccg-skill-routing.md` for domain-oriented context routing.
