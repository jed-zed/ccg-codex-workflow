param(
  [string]$CodexHome = $env:CODEX_HOME
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($CodexHome)) {
  $CodexHome = Join-Path $HOME ".codex"
}

$commandsRoot = Join-Path $CodexHome "commands"
$paths = @(
  (Join-Path $commandsRoot "ccg.md"),
  (Join-Path $commandsRoot "ccg")
)

foreach ($path in $paths) {
  if (Test-Path -LiteralPath $path) {
    $resolved = (Resolve-Path -LiteralPath $path).Path
    if (-not $resolved.StartsWith((Resolve-Path $commandsRoot).Path)) {
      throw "Refusing to remove unexpected path: $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
    Write-Output "removed $resolved"
  }
}
