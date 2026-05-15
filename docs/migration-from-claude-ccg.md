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

Legacy `.claude/plan/*.md` files can still be used as input artifacts for `/ccg:execute`. New Codex-native plans are written under `.codex/ccg/plans/*.md`. Codex treats legacy plans as implementation intent:

- title and task type;
- implementation steps;
- key files and expected operations;
- acceptance criteria and test commands;
- historical model/session notes.

Codex will re-read repository context before editing. It does not assume the old plan context is still complete or current.

## Codex Artifact Paths

New CCG products belong to Codex-owned project paths:

```text
.codex/ccg/plans/*.md
.codex/ccg/context/**
.codex/ccg/specs/**
.codex/ccg/team/**
.codex/ccg/tmp/**
```

Legacy `.claude/plan/*.md`, `CLAUDE.md`, `.context/**`, and `openspec/**` files are read-compatible migration inputs. They are not the default write target. `/ccg:plan` saves Chinese plan content under `.codex/ccg/plans/*.md` unless the user explicitly asks to revise an existing legacy plan file.

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
| Claude `/ccg:plan` | `/ccg:plan` creates Chinese `.codex/ccg/plans/*.md` plans with Codex as planner and Gemini as read-only analysis helper. |
| Claude `/ccg:execute` | `/ccg:execute` makes Codex apply final edits, run verification, review diffs, and report in Chinese. It accepts `.codex/ccg/plans/*.md` and explicit legacy `.claude/plan/*.md` inputs. |
| Claude `.context/` | `.codex/ccg/context/**` stores Codex-native history, summary, and event files. |
| OPSX / OpenSpec paths | `.codex/ccg/specs/**` stores research, constraints, plan, review, and archive files. |
| Agent Teams | `/ccg:team-*` uses scoped Codex workers with Codex as final owner. |
| Wrapper Web UI | Gemini preview helper opens a localhost browser page with process status, parsed output, raw stream logs, and auto-close on completion. |
| `SESSION_ID` resume | Not supported; Codex re-searches context and launches fresh Gemini helper calls when useful. |

## Practical Migration Checklist

1. Install or sync the Codex plugin.
2. Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1 -Verbose`.
3. Confirm `codex debug prompt-input | Select-String "ccg:"` can see the skills.
4. Create new plans with `/ccg:plan <task>` and execute them with `/ccg:execute .codex/ccg/plans/<file>.md`.
5. Use legacy plans only as explicit `/ccg:execute .claude/plan/<file>.md` compatibility inputs.
6. Expect Codex to re-validate context and tests instead of trusting old wrapper sessions.

If a legacy plan relies on secret files, production state, or old hidden session context, provide a sanitized excerpt or updated requirement before execution.
