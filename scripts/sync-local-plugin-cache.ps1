[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Medium")]
param(
  [string]$CodexHome = $env:CODEX_HOME,
  [string]$PluginRoot = "",
  [string]$MarketplaceName = "ccg-codex-workflow",
  [string]$PluginName = "ccg"
)

$ErrorActionPreference = "Stop"

function Test-SafeSegment {
  param(
    [string]$Name,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "$Name must not be empty."
  }
  if ($Value -eq "." -or $Value -eq "..") {
    throw "$Name must not be a relative path segment: $Value"
  }
  if ($Value.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ge 0 -or
      $Value.Contains("\") -or
      $Value.Contains("/") -or
      $Value.Contains(":")) {
    throw "$Name contains unsafe path characters: $Value"
  }
}

function Get-PluginManifest {
  param([string]$Root)

  $manifestPath = Join-Path $Root ".codex-plugin\plugin.json"
  if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Plugin manifest not found: $manifestPath"
  }

  try {
    return Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  } catch {
    throw "Plugin manifest is not valid JSON: $manifestPath ($($_.Exception.Message))"
  }
}

if ([string]::IsNullOrWhiteSpace($CodexHome)) {
  $CodexHome = Join-Path $HOME ".codex"
}
$CodexHome = [System.IO.Path]::GetFullPath($CodexHome)

if ([string]::IsNullOrWhiteSpace($PluginRoot)) {
  $PluginRoot = Join-Path $PSScriptRoot "..\plugins\ccg"
}
$PluginRoot = [System.IO.Path]::GetFullPath($PluginRoot)

if (-not (Test-Path -LiteralPath $PluginRoot)) {
  throw "Plugin root not found: $PluginRoot"
}

Test-SafeSegment "MarketplaceName" $MarketplaceName
Test-SafeSegment "PluginName" $PluginName

$manifest = Get-PluginManifest $PluginRoot
$version = [string]$manifest.version
Test-SafeSegment "plugin version" $version

$cacheRoot = [System.IO.Path]::GetFullPath((Join-Path $CodexHome "plugins\cache"))
$targetRoot = [System.IO.Path]::GetFullPath((Join-Path (Join-Path (Join-Path $cacheRoot $MarketplaceName) $PluginName) $version))
$expectedRoot = [System.IO.Path]::GetFullPath((Join-Path (Join-Path (Join-Path $CodexHome "plugins\cache") $MarketplaceName) (Join-Path $PluginName $version)))

if ($targetRoot -ne $expectedRoot) {
  throw "Refusing to sync unexpected target: $targetRoot"
}

$cacheRootWithSeparator = $cacheRoot.TrimEnd("\") + "\"
if (-not $targetRoot.StartsWith($cacheRootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to sync outside Codex plugin cache: $targetRoot"
}

Write-Output "CCG local plugin cache sync"
Write-Output "Source plugin : $PluginRoot"
Write-Output "Target cache  : $targetRoot"
Write-Output "Version       : $version"

if ($PSCmdlet.ShouldProcess($targetRoot, "Refresh local Codex plugin cache")) {
  $targetParent = Split-Path -Parent $targetRoot
  New-Item -ItemType Directory -Path $targetParent -Force | Out-Null

  if (Test-Path -LiteralPath $targetRoot) {
    try {
      Remove-Item -LiteralPath $targetRoot -Recurse -Force
    } catch {
      throw "Failed to remove existing cache target. Close running Codex sessions and retry: $targetRoot ($($_.Exception.Message))"
    }
  }

  New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
  Get-ChildItem -LiteralPath $PluginRoot -Force | Copy-Item -Destination $targetRoot -Recurse -Force
  Write-Output "Synced CCG plugin cache. Restart the current Codex TUI session to reload plugin skills."
}
