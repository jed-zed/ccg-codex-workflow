[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Medium")]
param(
  [string]$CodexHome = $env:CODEX_HOME,
  [string]$PluginRoot = "",
  [string]$MarketplaceName = "ccg-codex-workflow",
  [string]$PluginName = "ccg"
)

$ErrorActionPreference = "Stop"

function Join-PathMany {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Base,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Children
  )

  $path = $Base
  foreach ($child in $Children) {
    $path = Join-Path $path $child
  }
  return $path
}

$pluginSync = Join-PathMany $PSScriptRoot ".." "plugins" "ccg" "scripts" "sync-local-plugin-cache.ps1"
if (-not (Test-Path -LiteralPath $pluginSync)) {
  throw "CCG plugin sync script not found: $pluginSync"
}

$arguments = @{}
if (-not [string]::IsNullOrWhiteSpace($CodexHome)) {
  $arguments["CodexHome"] = $CodexHome
}
if (-not [string]::IsNullOrWhiteSpace($PluginRoot)) {
  $arguments["PluginRoot"] = $PluginRoot
}
if (-not [string]::IsNullOrWhiteSpace($MarketplaceName)) {
  $arguments["MarketplaceName"] = $MarketplaceName
}
if (-not [string]::IsNullOrWhiteSpace($PluginName)) {
  $arguments["PluginName"] = $PluginName
}
if ($WhatIfPreference) {
  $arguments["WhatIf"] = $true
}
if ($PSCmdlet.MyInvocation.BoundParameters.ContainsKey("Verbose")) {
  $arguments["Verbose"] = $true
}

& $pluginSync @arguments
exit $LASTEXITCODE
