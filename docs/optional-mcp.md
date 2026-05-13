# Optional MCP Setup

The plugin bundles MCP entries for `context7` and `fast-context` because they do not require secrets.

CCG also works best with `ace-tool` as the primary semantic code search tool and `grok-search` for web search, but those usually require private tokens. Do not commit those tokens into this repository.

Configure secret-backed MCP servers globally in Codex instead:

```powershell
codex mcp list
```

If you already have global `ace-tool`, `grok-search`, `context7`, or `fast-context` entries, keep them there. The plugin rules will prefer `ace-tool` when it is available and fall back to bundled or local search when it is not.
