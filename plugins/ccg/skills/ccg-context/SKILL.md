---
name: context
description: Manage Codex-native CCG context history. Use when the user invokes /ccg:context.
---

# CCG Context

Manage long-lived CCG context under `.codex/ccg/context/**`.

## Storage

- `.codex/ccg/context/history.md`
- `.codex/ccg/context/current-summary.md`
- `.codex/ccg/context/events/*.md`

Legacy `.context/**` may be read for migration, but new context writes must use `.codex/ccg/context/**`.

## Subcommands

- `init`: create context directories and seed files.
- `log <note>`: append a timestamped entry and event file.
- `summarize`: write or refresh `current-summary.md` without deleting raw history.
- `history`: print raw history.
- `clear --dry-run`: show what would be cleared.
- `clear --confirm`: clear derived summary/events only after explicit confirmation.

## Helper

Use `scripts/context_manager.js` when a mechanical local operation is enough:

```powershell
node .\plugins\ccg\skills\ccg-context\scripts\context_manager.js log "note"
```

Report results in Chinese.
