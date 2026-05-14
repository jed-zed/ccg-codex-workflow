# CCG Codex Workflow

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

Restart the currently open Codex TUI session so plugin skills and MCP entries reload.

Codex CLI 0.130 loads this plugin's skills, but it does not currently expose marketplace plugin commands as custom slash-command autocomplete entries in the TUI. A computer reboot is not needed. If `/ccg:doctor`, `/ccg:plan`, or `/ccg:execute` does not appear in the autocomplete menu, type the invocation as normal prompt text:

```text
/ccg:doctor
/ccg:plan Add user login audit logging
/ccg:execute .claude/plan/my-task.md
```

If a TUI build intercepts unknown leading-slash input before the model sees it, prefix the prompt:

```text
Execute /ccg:doctor
Execute /ccg:plan Add user login audit logging
Execute /ccg:execute .claude/plan/my-task.md
```

### Codex Compatibility Matrix

| Capability | Codex CLI 0.130 | Expected behavior |
|------------|-----------------|-------------------|
| Plugin skills | Supported | `codex debug prompt-input` should list `ccg:*` skills after install/restart. |
| Plugin MCP entries | Supported | `codex mcp list` should show configured plugin MCP servers when available. |
| Marketplace command autocomplete | Not guaranteed | `/ccg:*` may not appear in the TUI slash menu. |
| Prompt-text invocation | Supported | Type `/ccg:doctor`, `/ccg:plan ...`, `/ccg:execute ...`, or prefix with `Execute ...` if slash input is intercepted. |
| Command bridge | Client-dependent | `scripts/install-codex-command-bridge.ps1` helps only clients that discover `~/.codex/commands`. |

### Smoke Test After Install

```powershell
codex plugin marketplace add I:\ai\ccg-codex-workflow
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1 -Verbose
codex mcp list
codex debug prompt-input | Select-String "ccg:"
```

`doctor.ps1` is read-only. It checks the plugin files, Codex plugin cache, prompt-visible `ccg:*` skills, MCP visibility, optional command bridge files, and Gemini CLI presence. It cannot prove slash-menu autocomplete, because that depends on the Codex TUI build; use prompt-text invocation when autocomplete is absent.

### Local Development Cache Sync

For first install, use `codex plugin marketplace add`. For local development after editing files in this repository, Codex CLI 0.130 does not guarantee that running `marketplace add` again refreshes an already-added local marketplace cache. Sync the local cache explicitly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-local-plugin-cache.ps1 -WhatIf
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-local-plugin-cache.ps1
```

The sync script refreshes only this plugin's current versioned cache directory under `~/.codex/plugins/cache/ccg-codex-workflow/ccg/<version>`. It does not edit `config.toml`, install the optional command bridge, or call Gemini. Restart the current Codex TUI session after syncing.

`doctor.ps1` compares the source plugin with the cached plugin. A stale-cache warning means the source and cache differ; run the sync script and restart Codex.

For machine-readable output:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1 -Json
```

If your Codex build supports command discovery, also try:

```text
/commands list
/commands reload
```

Then in Codex, test prompt-text routing with:

```text
Execute /ccg:doctor
Execute /ccg:plan Add a smoke-test-only plan
Execute /ccg:gemini-preview Reply exactly: CCG_OK
```

The plugin provides these prompt invocations and matching skills:

```text
/ccg:ccg
/ccg:doctor
/ccg:plan
/ccg:execute
/ccg:excute
/ccg:codex-exec
/ccg:workflow
/ccg:review
/ccg:gemini-preview
/ccg:gen-docs
/ccg:verify-change
/ccg:verify-module
/ccg:verify-quality
/ccg:verify-security
```

This plugin uses namespaced prompt invocations shaped like `/ccg:command`, so the command index is `/ccg:ccg`. A bare `/ccg` root invocation is treated as an index request by the plugin skill when Codex routes the prompt text to the CCG skill.

## Codex CLI Command Bridge

This repository keeps command markdown files under `plugins/ccg/commands/` so future Codex builds or compatible frontends can discover them. Codex CLI 0.130 may still ignore those files for TUI autocomplete.

The optional bridge below copies thin command stubs into `~/.codex/commands`. Use it only for Codex builds that support user-command discovery; on builds that do not, it is harmless but will not make `/ccg:*` appear in autocomplete:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-command-bridge.ps1
```

This copies thin command stubs into:

```text
~/.codex/commands/ccg.md
~/.codex/commands/ccg/*.md
```

The plugin remains the source of truth; the bridge is only a compatibility layer for clients that already support local command discovery.

To remove the bridge:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-command-bridge.ps1
```

## Typical Usage

Diagnose the local plugin install:

```text
/ccg:doctor
```

Create a Codex-native CCG plan:

```text
/ccg:plan Add user login audit logging
```

Real `/ccg:plan` runs require Gemini participation. Codex must launch the preview helper, read a non-empty `CCG_GEMINI_RESPONSE_FILE`, and include Codex/Gemini analysis before writing `.claude/plan/*.md`. If Gemini fails, planning stops instead of producing a fake dual-model plan.

Execute a CCG plan:

```text
/ccg:execute .claude/plan/my-task.md
```

Use the typo-compatible alias:

```text
/ccg:excute .claude/plan/my-task.md
```

Ask Gemini for bounded help with a browser preview:

```text
/ccg:gemini-preview Review this plan for missing backend edge cases
```

Detached Gemini calls also open the browser preview automatically. If Windows blocks focus or popup behavior, use the printed `CCG_GEMINI_PREVIEW_URL`; successful launches print `CCG_GEMINI_BROWSER_OPENED=1`.

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

## Gemini Preview Helper

The helper script is bundled at:

```text
plugins/ccg/skills/ccg-executor/scripts/invoke_gemini_preview.py
```

It runs Gemini with `stream-json`, creates a disposable workspace snapshot by default, opens a localhost preview page unless `--no-browser` is set, and writes logs under:

```text
~/.codex/ccg/logs/
```

Snapshots exclude common secret files and directories such as `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `.aws`, `.gcp`, and `.azure`. The helper prints `CCG_GEMINI_SNAPSHOT_PATH` and `CCG_GEMINI_SNAPSHOT_EXCLUDES` for auditability.

Smoke test:

```powershell
python .\plugins\ccg\skills\ccg-executor\scripts\invoke_gemini_preview.py --workdir . --model gemini-3.1-pro-preview --prompt "Reply exactly: CCG_OK" --no-browser --hold-seconds 0
```

The default Gemini model is `gemini-3.1-pro-preview`. You can override it with `GEMINI_MODEL` or `--model`.

Use `--direct-workdir` only when you explicitly want Gemini to run against the real workspace.

## Development Checks

```powershell
node .\scripts\validate-plugin.js
python -m py_compile .\plugins\ccg\skills\ccg-executor\scripts\invoke_gemini_preview.py
node .\scripts\run-fixture-tests.js
```

`verify-quality` scans frontend file extensions including `.jsx` and `.tsx`, but JavaScript and TypeScript still use a lightweight generic scan. Use the project's own lint/typecheck for deep JS/TS complexity and type-aware checks.
