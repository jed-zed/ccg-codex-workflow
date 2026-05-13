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

Codex CLI 0.130 loads this plugin's skills, but it does not currently expose marketplace plugin commands as custom slash-command autocomplete entries in the TUI. A computer reboot is not needed. If `/ccg:plan` or `/ccg:execute` does not appear in the autocomplete menu, type the invocation as normal prompt text:

```text
/ccg:plan Add user login audit logging
/ccg:execute .claude/plan/my-task.md
```

If a TUI build intercepts unknown leading-slash input before the model sees it, prefix the prompt:

```text
Execute /ccg:plan Add user login audit logging
Execute /ccg:execute .claude/plan/my-task.md
```

The plugin provides these prompt invocations and matching skills:

```text
/ccg:ccg
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

Create a Codex-native CCG plan:

```text
/ccg:plan Add user login audit logging
```

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

Smoke test:

```powershell
python .\plugins\ccg\skills\ccg-executor\scripts\invoke_gemini_preview.py --workdir . --model gemini-2.5-flash --prompt "Reply exactly: CCG_OK" --no-browser --hold-seconds 0
```

Use `--direct-workdir` only when you explicitly want Gemini to run against the real workspace.

## Development Checks

```powershell
node -e "JSON.parse(require('fs').readFileSync('.agents/plugins/marketplace.json','utf8')); JSON.parse(require('fs').readFileSync('plugins/ccg/.codex-plugin/plugin.json','utf8')); JSON.parse(require('fs').readFileSync('plugins/ccg/.mcp.json','utf8')); console.log('json ok')"
python -m py_compile .\plugins\ccg\skills\ccg-executor\scripts\invoke_gemini_preview.py
```
