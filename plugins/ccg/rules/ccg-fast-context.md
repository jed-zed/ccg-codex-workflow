# CCG Fast Context Rule

Use `ace-tool` as the primary semantic code search tool when it is configured in Codex.

Use `fast-context` as a supplement when:

- the query is naturally expressed as behavior or intent rather than exact symbols;
- the task needs cross-module or cross-layer flow discovery;
- Chinese semantic search is useful;
- ace-tool is unavailable or returns insufficient context.

For exact filenames, symbols, literals, or error messages, prefer `rg` or the repository's native search tools.
