# Migrating From Claude CCG

This plugin is a Codex-native rewrite of the original Claude-led CCG workflow. It preserves the core collaboration idea, but the orchestration owner changes.

## What Changes

Original CCG:

```text
Claude Code orchestrates Codex + Gemini
```

CCG Codex Workflow:

```text
Codex creates plans, executes code, verifies changes, and reports results.
Gemini is a bounded read-only helper for analysis, drafts, tests, UI risks, and review.
```

The Claude-side `codeagent-wrapper`, Claude command files, and Claude execution quota are not used by this plugin.

## Old Plans

Legacy `.claude/plan/*.md` files can still be used as input artifacts for `/ccg:execute`. Codex treats them as implementation intent:

- title and task type;
- implementation steps;
- key files and expected operations;
- acceptance criteria and test commands;
- historical model/session notes.

Codex will re-read repository context before editing. It does not assume the old plan context is still complete or current.

## Session IDs

Old CCG plans may contain values such as `CODEX_SESSION`, `GEMINI_SESSION`, or Claude handoff file paths. In this plugin those values are provenance only.

Codex does not resume old wrapper sessions. When Gemini help is needed, Codex launches a fresh read-only Gemini call through:

```text
plugins/ccg/skills/ccg-executor/scripts/invoke_gemini_preview.py
```

The helper creates a disposable snapshot by default, opens a browser preview, writes raw logs under `~/.codex/ccg/logs/`, and returns a `CCG_GEMINI_RESPONSE_FILE` for Codex to inspect.

## Command Mapping

| Original idea | Codex-native behavior |
|---------------|-----------------------|
| Claude `/ccg:plan` | `/ccg:plan` creates or revises `.claude/plan/*.md` with Codex as planner and Gemini as read-only analysis helper. |
| Claude `/ccg:execute` | `/ccg:execute` makes Codex apply final edits, run verification, review diffs, and report in Chinese. |
| Wrapper Web UI | Gemini preview helper opens a localhost browser page with process status, parsed output, raw stream logs, and auto-close on completion. |
| `SESSION_ID` resume | Not supported; Codex re-searches context and launches fresh Gemini helper calls when useful. |

## Practical Migration Checklist

1. Install or sync the Codex plugin.
2. Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1 -Verbose`.
3. Confirm `codex debug prompt-input | Select-String "ccg:"` can see the skills.
4. Use legacy plans as normal `/ccg:execute .claude/plan/<file>.md` inputs.
5. Expect Codex to re-validate context and tests instead of trusting old wrapper sessions.

If a legacy plan relies on secret files, production state, or old hidden session context, provide a sanitized excerpt or updated requirement before execution.
