[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Medium")]
param(
  [string]$CodexHome = $env:CODEX_HOME,
  [string]$PluginRoot = "",
  [switch]$Fix,
  [switch]$CheckGeminiModel,
  [string]$GeminiModel = "",
  [switch]$Json
)

$ErrorActionPreference = "Stop"

$pluginDoctor = Join-Path (Join-Path (Join-Path $PSScriptRoot "..") "plugins") "ccg"
$pluginDoctor = Join-Path (Join-Path $pluginDoctor "scripts") "doctor.ps1"
if (-not (Test-Path -LiteralPath $pluginDoctor)) {
  throw "CCG plugin doctor not found: $pluginDoctor"
}

$arguments = @{}

if (-not [string]::IsNullOrWhiteSpace($CodexHome)) {
  $arguments["CodexHome"] = $CodexHome
}

if (-not [string]::IsNullOrWhiteSpace($PluginRoot)) {
  $arguments["PluginRoot"] = $PluginRoot
}

if ($Fix) {
  $arguments["Fix"] = $true
}

if ($CheckGeminiModel) {
  $arguments["CheckGeminiModel"] = $true
}

if (-not [string]::IsNullOrWhiteSpace($GeminiModel)) {
  $arguments["GeminiModel"] = $GeminiModel
}

if ($Json) {
  $arguments["Json"] = $true
}

if ($WhatIfPreference) {
  $arguments["WhatIf"] = $true
}

if ($PSCmdlet.MyInvocation.BoundParameters.ContainsKey("Verbose")) {
  $arguments["Verbose"] = $true
}

& $pluginDoctor @arguments
exit $LASTEXITCODE
