[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Medium")]
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
if ($PSCmdlet.ShouldProcess($ccgNamespace, "Create command bridge directory")) {
  New-Item -ItemType Directory -Path $ccgNamespace -Force | Out-Null
}

function Copy-Command {
  param(
    [string]$SourceName,
    [string]$DestinationPath
  )
  $sourcePath = Join-Path $sourceCommands $SourceName
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing command source: $sourcePath"
  }
  Write-Output "bridge target $DestinationPath"
  if ($PSCmdlet.ShouldProcess($DestinationPath, "Install command bridge file from $sourcePath")) {
    $destinationDir = Split-Path -Parent $DestinationPath
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $DestinationPath -Force
    Write-Output "installed $DestinationPath"
  }
}

# Bare /ccg index for Codex versions that load user root commands.
Copy-Command "ccg.md" (Join-Path $commandsRoot "ccg.md")

# Namespaced /ccg:* command stubs for clients that support local command discovery.
Copy-Command "ccg.md" (Join-Path $ccgNamespace "ccg.md")
Copy-Command "plan.md" (Join-Path $ccgNamespace "plan.md")
Copy-Command "execute.md" (Join-Path $ccgNamespace "execute.md")
Copy-Command "excute.md" (Join-Path $ccgNamespace "excute.md")
Copy-Command "codex-exec.md" (Join-Path $ccgNamespace "codex-exec.md")
Copy-Command "workflow.md" (Join-Path $ccgNamespace "workflow.md")
Copy-Command "feat.md" (Join-Path $ccgNamespace "feat.md")
Copy-Command "frontend.md" (Join-Path $ccgNamespace "frontend.md")
Copy-Command "backend.md" (Join-Path $ccgNamespace "backend.md")
Copy-Command "analyze.md" (Join-Path $ccgNamespace "analyze.md")
Copy-Command "debug.md" (Join-Path $ccgNamespace "debug.md")
Copy-Command "optimize.md" (Join-Path $ccgNamespace "optimize.md")
Copy-Command "test.md" (Join-Path $ccgNamespace "test.md")
Copy-Command "enhance.md" (Join-Path $ccgNamespace "enhance.md")
Copy-Command "init.md" (Join-Path $ccgNamespace "init.md")
Copy-Command "context.md" (Join-Path $ccgNamespace "context.md")
Copy-Command "commit.md" (Join-Path $ccgNamespace "commit.md")
Copy-Command "rollback.md" (Join-Path $ccgNamespace "rollback.md")
Copy-Command "clean-branches.md" (Join-Path $ccgNamespace "clean-branches.md")
Copy-Command "worktree.md" (Join-Path $ccgNamespace "worktree.md")
Copy-Command "spec-init.md" (Join-Path $ccgNamespace "spec-init.md")
Copy-Command "spec-research.md" (Join-Path $ccgNamespace "spec-research.md")
Copy-Command "spec-plan.md" (Join-Path $ccgNamespace "spec-plan.md")
Copy-Command "spec-impl.md" (Join-Path $ccgNamespace "spec-impl.md")
Copy-Command "spec-review.md" (Join-Path $ccgNamespace "spec-review.md")
Copy-Command "team.md" (Join-Path $ccgNamespace "team.md")
Copy-Command "team-research.md" (Join-Path $ccgNamespace "team-research.md")
Copy-Command "team-plan.md" (Join-Path $ccgNamespace "team-plan.md")
Copy-Command "team-exec.md" (Join-Path $ccgNamespace "team-exec.md")
Copy-Command "team-review.md" (Join-Path $ccgNamespace "team-review.md")
Copy-Command "doctor.md" (Join-Path $ccgNamespace "doctor.md")
Copy-Command "review.md" (Join-Path $ccgNamespace "review.md")
Copy-Command "gemini-preview.md" (Join-Path $ccgNamespace "gemini-preview.md")
Copy-Command "gen-docs.md" (Join-Path $ccgNamespace "gen-docs.md")
Copy-Command "verify-change.md" (Join-Path $ccgNamespace "verify-change.md")
Copy-Command "verify-module.md" (Join-Path $ccgNamespace "verify-module.md")
Copy-Command "verify-quality.md" (Join-Path $ccgNamespace "verify-quality.md")
Copy-Command "verify-security.md" (Join-Path $ccgNamespace "verify-security.md")

Write-Output ""
if ($WhatIfPreference) {
  Write-Output "CCG command bridge dry run completed for $commandsRoot"
} else {
  Write-Output "CCG command bridge installed under $commandsRoot"
}
Write-Output "Restart Codex TUI to reload local files."
Write-Output "Note: Codex CLI 0.130 may not surface custom command autocomplete. If /ccg:* is not shown, type /ccg:doctor, /ccg:plan, or /ccg:execute as normal prompt text."
