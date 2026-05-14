# Optional MCP Setup

The plugin bundles MCP entries for `context7` and `fast-context` because they do not require secrets.

CCG also works best with `ace-tool` as the primary semantic code search tool and `grok-search` for web search, but those usually require private tokens. Do not commit those tokens into this repository.

Configure secret-backed MCP servers globally in Codex instead:

```powershell
codex mcp list
```

If you already have global `ace-tool`, `grok-search`, `context7`, or `fast-context` entries, keep them there. The plugin rules will prefer `ace-tool` when it is available and fall back to bundled or local search when it is not.

## Reproducible MCP Mode

The bundled plugin MCP entries use `latest` packages for easy local installation. That is convenient while iterating, but it means behavior can change when upstream MCP packages publish new versions.

For a more reproducible setup, configure pinned MCP versions globally in Codex and keep secrets out of this repository. Example shape:

```powershell
codex mcp add context7 -- cmd /c npx -y @upstash/context7-mcp@<version>
codex mcp add fast-context -- cmd /c npx -y fast-context-mcp@<version>
```

Use the exact version numbers you have validated locally or in your team environment. Secret-backed entries such as `ace-tool` and `grok-search` should also remain global, with tokens stored in your normal local secret mechanism rather than committed into marketplace manifests.
