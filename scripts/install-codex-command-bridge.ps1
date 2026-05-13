param(
  [string]$CodexHome = $env:CODEX_HOME,
  [string]$PluginRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($CodexHome)) {
  $CodexHome = Join-Path $HOME ".codex"
}

if ([string]::IsNullOrWhiteSpace($PluginRoot)) {
  $PluginRoot = Resolve-Path (Join-Path $PSScriptRoot "..\plugins\ccg")
} else {
  $PluginRoot = Resolve-Path $PluginRoot
}

$sourceCommands = Join-Path $PluginRoot "commands"
if (-not (Test-Path -LiteralPath $sourceCommands)) {
  throw "CCG plugin commands directory not found: $sourceCommands"
}

$commandsRoot = Join-Path $CodexHome "commands"
$ccgNamespace = Join-Path $commandsRoot "ccg"
New-Item -ItemType Directory -Path $ccgNamespace -Force | Out-Null

function Copy-Command {
  param(
    [string]$SourceName,
    [string]$DestinationPath
  )
  $sourcePath = Join-Path $sourceCommands $SourceName
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing command source: $sourcePath"
  }
  Copy-Item -LiteralPath $sourcePath -Destination $DestinationPath -Force
  Write-Output "installed $DestinationPath"
}

# Bare /ccg index for Codex versions that load user root commands.
Copy-Command "ccg.md" (Join-Path $commandsRoot "ccg.md")

# Namespaced /ccg:* command stubs for clients that support local command discovery.
Copy-Command "ccg.md" (Join-Path $ccgNamespace "ccg.md")
Copy-Command "execute.md" (Join-Path $ccgNamespace "execute.md")
Copy-Command "excute.md" (Join-Path $ccgNamespace "excute.md")
Copy-Command "codex-exec.md" (Join-Path $ccgNamespace "codex-exec.md")
Copy-Command "workflow.md" (Join-Path $ccgNamespace "workflow.md")
Copy-Command "review.md" (Join-Path $ccgNamespace "review.md")
Copy-Command "gemini-preview.md" (Join-Path $ccgNamespace "gemini-preview.md")
Copy-Command "gen-docs.md" (Join-Path $ccgNamespace "gen-docs.md")
Copy-Command "verify-change.md" (Join-Path $ccgNamespace "verify-change.md")
Copy-Command "verify-module.md" (Join-Path $ccgNamespace "verify-module.md")
Copy-Command "verify-quality.md" (Join-Path $ccgNamespace "verify-quality.md")
Copy-Command "verify-security.md" (Join-Path $ccgNamespace "verify-security.md")

Write-Output ""
Write-Output "CCG command bridge installed under $commandsRoot"
Write-Output "Restart Codex TUI to reload local files."
Write-Output "Note: Codex CLI 0.130 may not surface custom command autocomplete. If /ccg:* is not shown, type /ccg:execute as normal prompt text."
