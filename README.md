# CCG Codex Workflow

[![CI](https://github.com/jed-zed/ccg-codex-workflow/actions/workflows/ci.yml/badge.svg)](https://github.com/jed-zed/ccg-codex-workflow/actions/workflows/ci.yml)

Codex-native CCG workflow plugin.

This project rewrites CCG execution around Codex:

- Codex creates or revises CCG plans.
- Codex is the orchestrator and final executor.
- Gemini is a bounded helper for drafts, edge cases, tests, UI prototypes, and review.
- Codex applies final code changes, runs verification, reviews diffs, and reports in Chinese.

## Install Locally

From this repository root:

```powershell
codex plugin marketplace add I:\ai\ccg-codex-workflow
```

Restart the currently open Codex client session so plugin skills, MCP entries, and command metadata reload.

Codex Desktop has been manually verified to show `/ccg:*` slash-command autocomplete for this plugin after the plugin cache is current and the Desktop session is restarted. Codex CLI 0.130 loads this plugin's skills and MCP entries, but it does not currently guarantee marketplace plugin commands as custom slash-command autocomplete entries in the TUI. A computer reboot is not needed. If `/ccg:doctor`, `/ccg:plan`, or `/ccg:execute` does not appear in a CLI/TUI autocomplete menu, type the invocation as normal prompt text:

```text
/ccg:doctor
/ccg:plan Add user login audit logging
/ccg:execute .codex/ccg/plans/my-task.md
```

If a TUI build intercepts unknown leading-slash input before the model sees it, prefix the prompt:

```text
Execute /ccg:doctor
Execute /ccg:plan Add user login audit logging
Execute /ccg:execute .codex/ccg/plans/my-task.md
```

### Codex Compatibility Matrix

| Capability | Codex Desktop | Codex CLI 0.130 / TUI | Expected behavior |
|------------|---------------|------------------------|-------------------|
| Plugin skills | Supported | Supported | `codex debug prompt-input` should list `ccg:*` skills after install/restart. |
| Plugin MCP entries | Supported | Supported | `codex mcp list` should show configured plugin MCP servers when available. |
| Marketplace command autocomplete | Verified for `/ccg:*` | Not guaranteed | Desktop should show `/ccg:plan`, `/ccg:execute`, `/ccg:doctor`, and the other `/ccg:*` commands; CLI/TUI slash menu absence is not a plugin failure. |
| Prompt-text invocation | Supported | Supported | Type `/ccg:doctor`, `/ccg:plan ...`, `/ccg:execute ...`, or prefix with `Execute ...` if slash input is intercepted. |
| Command bridge | Usually unnecessary | Client-dependent | `scripts/install-codex-command-bridge.ps1` helps only clients that discover `~/.codex/commands`. |

### Smoke Test After Install

```powershell
codex plugin marketplace add I:\ai\ccg-codex-workflow
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1 -Verbose
codex mcp list
codex debug prompt-input | Select-String "ccg:"
```

`doctor.ps1` is read-only. It checks the plugin files, Codex plugin cache, prompt-visible `ccg:*` skills, MCP visibility, optional command bridge files, and Gemini CLI presence. It cannot prove slash-menu autocomplete, because that depends on the Codex TUI build; use prompt-text invocation when autocomplete is absent.

Desktop autocomplete smoke test: open Codex Desktop, type `/ccg`, and confirm the menu includes `/ccg:plan`, `/ccg:execute`, `/ccg:doctor`, and the high-frequency `/ccg:*` commands. CLI smoke test: use `codex debug prompt-input | Select-String "ccg:"` to prove skills are prompt-visible; CLI slash autocomplete is not required to pass.

To make a real, optional Gemini model availability probe, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1 -CheckGeminiModel -GeminiModel gemini-3.1-pro-preview -Verbose
```

This sends a minimal Gemini CLI request with `--skip-trust`. It is not part of the default doctor because default diagnostics stay read-only and do not call a model.

### Local Development Cache Sync

For first install, use `codex plugin marketplace add`. For local development after editing files in this repository, Codex CLI 0.130 does not guarantee that running `marketplace add` again refreshes an already-added local marketplace cache. Sync the local cache explicitly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-local-plugin-cache.ps1 -WhatIf
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-local-plugin-cache.ps1
```

The sync script refreshes only this plugin's current versioned cache directory under `~/.codex/plugins/cache/ccg-codex-workflow/ccg/<version>`. It does not edit `config.toml`, install the optional command bridge, or call Gemini. Restart the current Codex TUI session after syncing.

`doctor.ps1` compares the source plugin with the cached plugin. A stale-cache warning means the source and cache differ; run the sync script and restart Codex. From a source checkout, you can also ask doctor to refresh only the plugin cache:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1 -Fix -Verbose
```

`-Fix` does not install command bridge files and does not edit other Codex configuration. It uses the plugin-bundled `scripts\sync-local-plugin-cache.ps1` as the source of truth.

For machine-readable output:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1 -Json
```

If your Codex build supports command discovery, also try:

```text
/commands list
/commands reload
```

Then in Codex CLI/TUI, test prompt-text routing with:

```text
Execute /ccg:doctor
Execute /ccg:plan Add a smoke-test-only plan
Execute /ccg:gemini-preview Reply exactly: CCG_OK
```

For a release-readiness smoke test, verify all of the following on the target machine:

- Codex Desktop autocomplete shows `/ccg:plan`, `/ccg:execute`, and `/ccg:doctor` after restarting the Desktop session.
- `codex debug prompt-input | Select-String "ccg:"` shows `ccg:doctor`, `ccg:plan`, and `ccg:execute`.
- `codex mcp list` shows the expected plugin or global MCP entries.
- `/ccg:doctor` reports no `FAIL`.
- `/ccg:gemini-preview Reply exactly: CCG_OK` opens the browser preview automatically and writes a non-empty `CCG_GEMINI_RESPONSE_FILE` containing `CCG_OK`.
- `/ccg:plan <small smoke requirement>` asks Gemini through the preview helper, writes a Chinese plan under `.codex/ccg/plans/*.md`, and replies in Chinese.
- GitHub Actions is green on both Ubuntu and Windows before publishing a stable release.

### Codex Artifact Paths

New CCG artifacts are Codex-owned by default:

```text
.codex/ccg/plans/*.md
.codex/ccg/context/**
.codex/ccg/specs/**
.codex/ccg/team/**
.codex/ccg/tmp/**
```

Legacy `.claude/plan/*.md`, `CLAUDE.md`, `.context/**`, and `openspec/**` files remain readable migration inputs. New `/ccg:plan` output must not default to `.claude/plan`; saved plan content itself is Chinese by default, including section headings, tables, checklists, analysis, risks, test strategy, and handoff prose.

### Original CCG Parity Status

The original CCG workflow exposes a broader 29+ command surface. This Codex-native plugin now implements the core planner/executor/review/doctor gates, the high-frequency parity group, Git/context helpers, OPSX/spec commands, and Codex-native team workflow commands. Full original CCG command-surface parity is achieved, and behavior-depth parity is implemented through safer Codex-native helpers instead of behavior-for-behavior copies.

The detailed tracking table lives in `docs/original-ccg-parity-matrix.md`. Domain skills, Impeccable UI, and Scrapling safety guidance are migrated as Codex rules. Claude wrapper behavior and legacy `SESSION_ID` resume are intentionally not copied.

Behavior-depth parity:

- Spec artifacts are managed by `spec_manager.js`.
- Team plans are parsed and conflict-checked with `team_plan_checker.js` before execution.
- Rollback supports confirmed non-destructive revert/restore execution.
- Commit helper can collect CCG gate status before committing.

The plugin provides these prompt invocations and matching skills:

```text
/ccg:ccg
/ccg:doctor
/ccg:plan
/ccg:execute
/ccg:excute
/ccg:codex-exec
/ccg:workflow
/ccg:feat
/ccg:frontend
/ccg:backend
/ccg:analyze
/ccg:debug
/ccg:optimize
/ccg:test
/ccg:enhance
/ccg:init
/ccg:context
/ccg:commit
/ccg:rollback
/ccg:clean-branches
/ccg:worktree
/ccg:spec-init
/ccg:spec-research
/ccg:spec-plan
/ccg:spec-impl
/ccg:spec-review
/ccg:team
/ccg:team-research
/ccg:team-plan
/ccg:team-exec
/ccg:team-review
/ccg:review
/ccg:gemini-preview
/ccg:gptpro-plan
/ccg:gptpro-review
/ccg:gptpro-exc
/ccg:gen-docs
/ccg:verify-change
/ccg:verify-module
/ccg:verify-quality
/ccg:verify-security
```

This plugin uses namespaced prompt invocations shaped like `/ccg:command`, so the command index is `/ccg:ccg`. A bare `/ccg` root invocation is treated as an index request by the plugin skill when Codex routes the prompt text to the CCG skill.

## Codex CLI Command Bridge

This repository keeps command markdown files under `plugins/ccg/commands/` so Codex Desktop, future Codex builds, or compatible frontends can discover them. Codex Desktop has been manually verified to show `/ccg:*` autocomplete from the installed plugin. Codex CLI 0.130 may still ignore those files for TUI autocomplete.

The optional bridge below copies thin command stubs into `~/.codex/commands`. Use it only for Codex builds that support user-command discovery; on builds that do not, it is harmless but will not make `/ccg:*` appear in autocomplete. Codex Desktop does not need this bridge when plugin autocomplete is already working.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-command-bridge.ps1 -WhatIf
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-command-bridge.ps1
```

This copies thin command stubs into:

```text
~/.codex/commands/ccg.md
~/.codex/commands/ccg/*.md
```

The plugin remains the source of truth; the bridge is only a compatibility layer for clients that already support local command discovery.

Codex CLI 0.130 exposes prompt-visible skills through `codex debug prompt-input`, but it does not expose a public command-registry debug command. Doctor can prove skills and bridge files are present; doctor cannot prove slash autocomplete. Verify Codex Desktop autocomplete with the manual UI smoke test above; treat CLI/TUI slash autocomplete as optional.

To remove the bridge:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-command-bridge.ps1
```

## Typical Usage

Diagnose the local plugin install:

```text
/ccg:doctor
```

From this repository's source checkout, repair a stale local plugin cache:

```text
/ccg:doctor --fix
```

Create a Codex-native CCG plan:

```text
/ccg:plan Add user login audit logging
```

Real `/ccg:plan` runs require Gemini participation. Codex must launch the preview helper, read a non-empty `CCG_GEMINI_RESPONSE_FILE`, and include Codex/Gemini analysis before writing `.codex/ccg/plans/*.md`. If Gemini fails, planning stops instead of producing a fake dual-model plan.

`/ccg:plan` user-facing output and saved plan content are Chinese by default. English remains acceptable for literal commands, paths, generated slugs, model names, environment variables, code identifiers, and clearly labeled raw Gemini excerpts.

Execute a CCG plan:

```text
/ccg:execute .codex/ccg/plans/my-task.md
```

Legacy plans remain executable as explicit compatibility inputs:

```text
/ccg:execute .claude/plan/my-task.md
```

Implement a feature directly through the high-frequency command surface:

```text
/ccg:feat Add user login audit logging
/ccg:backend Add the audit log API
/ccg:frontend Improve the audit log table
/ccg:debug Fix the failing audit log test
/ccg:test Add audit log edge-case coverage
```

Execution has two practical Gemini policies:

- **Fast**: simple, backend-heavy changes may be Codex-only unless the plan or risk level calls for Gemini.
- **Strict**: high-risk, UI-heavy, broad refactors, or release-sensitive work should use Gemini through the preview helper for a bounded second-pass review.

Use the typo-compatible alias:

```text
/ccg:excute .codex/ccg/plans/my-task.md
```

Ask Gemini for bounded help with a browser preview:

```text
/ccg:gemini-preview Review this plan for missing backend edge cases
```

`/ccg:gemini-preview` is only the manual smoke-test/debug entry. Normal CCG workflow commands do not require the user to type it first: whenever `/ccg:plan`, `/ccg:execute`, or `/ccg:review` calls Gemini internally, it must invoke the bundled preview helper itself and open the browser preview automatically.

Detached Gemini calls also open the browser preview automatically. If Windows blocks focus or popup behavior, use the printed `CCG_GEMINI_PREVIEW_URL`; successful launches print `CCG_GEMINI_BROWSER_OPENED=1`.

## ChatGPT Pro Manual Bridge

This plugin supports Codex + Gemini + GPT Pro planning, review, and execution-companion workflows through:

- `/ccg:gptpro-plan`
- `/ccg:gptpro-review`
- `/ccg:gptpro-exc`

For these commands, Codex first runs Gemini read-only analysis through the bundled Gemini preview helper. Codex then includes the Gemini response file path and a concise Gemini findings summary in the GPT Pro manual prompt. After the user saves the GPT Pro response, Codex must synthesize Codex, Gemini, and GPT Pro findings and remain the final owner.

Gemini Gate Before GPT Pro: Codex must read a real `CCG_GEMINI_RESPONSE_FILE` containing a non-empty Gemini response before creating any GPT Pro manual prompt. If Gemini fails, produces no response file, or writes an empty response, Codex stops in Chinese, does not create a GPT Pro bridge session, and must not invent Gemini findings.

The helper enforces this gate with `--gemini-response-file <CCG_GEMINI_RESPONSE_FILE>` and `--gemini-summary-file <summary-file>` (or `--gemini-summary` for short diagnostics). It injects Gemini Gate Evidence into `prompt.md` and records `response_file`, `response_non_empty`, `response_chars`, `response_sha256`, and `summary` in `status.json`.

`/ccg:gptpro-plan` has a Plan-only Boundary: it may produce or revise a plan, but must not execute implementation, apply product-code changes, commit, push, or create a pull request. Execution requires a later explicit `/ccg:execute <plan>` or `/ccg:codex-exec <plan>` request.

The bridge writes local prompt and response files under `.codex/ccg/gptpro/`. After generating a prompt, Codex must pause at a manual handoff barrier: it does not paste the full generated prompt into chat, prints the preview URL and local artifact paths, tells the user to open the preview page and use the preview page Copy Prompt button, and stops the current turn. The preview page is served by a detached local helper so the user can manually paste the prompt into ChatGPT Pro and manually paste the response back into the local bridge page or response file.

Codex may continue only after `status.json` shows `response_saved=true` and `response.md is non-empty`.

The bridge intentionally does not automate ChatGPT web login, prompt submission, DOM reading, or output extraction.

Manual question budget:

| Command | Expected | Maximum | Round 2 only for |
| --- | ---: | ---: | --- |
| `/ccg:gptpro-plan` | 1 | 2 | blocker re-check or revised plan comparison |
| `/ccg:gptpro-review` | 1 | 2 | blocker re-review after Codex fixes |
| `/ccg:gptpro-exc` | 1 | 2 | preferably converted into review mode |

这是人工桥接，不是 ChatGPT 网页自动化工具。

Run quality gates:

```text
/ccg:verify-change
/ccg:verify-quality src/server
/ccg:verify-security src/auth
```

## Marketplace Structure

The canonical marketplace entry lives at:

```text
.agents/plugins/marketplace.json
```

Compatibility marketplace manifests are also provided:

```text
.claude-plugin/marketplace.json
.codex-plugin/marketplace.json
```

The plugin itself lives at:

```text
plugins/ccg
```

## MCP

The plugin includes MCP entries for `context7` and `fast-context`.

Secret-backed MCP servers such as `ace-tool` and `grok-search` should be configured globally in Codex, not committed into this repository. See `docs/optional-mcp.md`.

Migrating from the original Claude-led CCG workflow is covered in `docs/migration-from-claude-ccg.md`.

## Gemini Preview Helper

The helper script is bundled at:

```text
plugins/ccg/skills/ccg-executor/scripts/invoke_gemini_preview.py
```

It runs Gemini with `stream-json`, creates a disposable workspace snapshot by default, opens a localhost preview page unless `--no-browser` is set, and writes logs under:

```text
~/.codex/ccg/logs/
```

Snapshots exclude common secret files and directories such as `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `.aws`, `.gcp`, and `.azure`. They also ignore symlinks and Windows junctions so a repository link cannot pull external secrets into the Gemini snapshot. The helper prints `CCG_GEMINI_SNAPSHOT_PATH`, `CCG_GEMINI_SNAPSHOT_EXCLUDES`, copied file/byte counts, and skipped-file categories for auditability.

For large repositories, add a repo-local `.ccgignore` to exclude generated or irrelevant context from Gemini snapshots. The helper supports a lightweight ignore subset: blank lines and `#` comments are ignored; basename patterns, simple relative paths, directory patterns ending in `/`, and `*` wildcards are supported. You can also pass `--respect-gitignore`, `--max-snapshot-bytes`, `--max-snapshot-files`, or `--files-from <list.txt>` for targeted snapshots. Hardcoded secret and link exclusions always win over user include rules.

Smoke test:

```powershell
python .\plugins\ccg\skills\ccg-executor\scripts\invoke_gemini_preview.py --workdir . --model gemini-3.1-pro-preview --prompt "Reply exactly: CCG_OK" --no-browser --hold-seconds 0
```

The default Gemini model is `gemini-3.1-pro-preview`. You can override it with `GEMINI_MODEL` or `--model`.

Gemini helper prompts use bundled CCG templates by default. Use `--prompt-template general|plan|prototype|review|frontend|analyzer|architect|debugger|optimizer|tester`; use `none` only for debugging the wrapper. These templates are adapted from the original CCG role prompts, but rewritten so Codex owns orchestration, file edits, verification, and final delivery while Gemini remains a read-only helper. The browser preview shows a live process timeline, parsed Gemini output, and a raw stream-json/debug pane. Preview tabs attempt to close themselves after completion, defaulting to 3 seconds; pass `--no-auto-close-browser` to keep the preview open. The response file remains the source of truth if browser focus, polling, or auto-close behavior hides the final output.

Use `--direct-workdir` only when you explicitly want Gemini to run against the real workspace.

## Development Checks

```powershell
node .\scripts\validate-plugin.js --phase-one
node .\scripts\validate-plugin.js --full-parity-surface
node .\scripts\validate-plugin.js --full-parity-behavior
node .\scripts\validate-plugin.js --full-parity
python -m py_compile .\plugins\ccg\skills\ccg-executor\scripts\invoke_gemini_preview.py
python -m py_compile .\plugins\ccg\skills\ccg-gptpro-bridge\scripts\gptpro_bridge.py
node .\scripts\run-fixture-tests.js
```

`verify-quality` scans JavaScript and TypeScript-family files, including `.jsx` and `.tsx`, with a dependency-free structural AST-lite pass for functions, classes, methods, parameters, length, and branching complexity. It is not a full Babel/TypeScript parser and is not type-aware, so keep using the target project's own lint/typecheck for deep language checks.

The CCG verification scripts are heuristic gates. They are useful preflight checks for common change, quality, module, and security issues, but they do not replace project-native tests, typechecks, linters, Semgrep, CodeQL, dependency scanning, or manual review for high-risk code.
