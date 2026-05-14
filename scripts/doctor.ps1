[CmdletBinding()]
param(
  [string]$CodexHome = $env:CODEX_HOME,
  [string]$PluginRoot = "",
  [switch]$Json
)

$ErrorActionPreference = "Stop"

$pluginDoctor = Join-Path $PSScriptRoot "..\plugins\ccg\scripts\doctor.ps1"
if (-not (Test-Path -LiteralPath $pluginDoctor)) {
  throw "CCG plugin doctor not found: $pluginDoctor"
}

$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  $pluginDoctor
)

if (-not [string]::IsNullOrWhiteSpace($CodexHome)) {
  $arguments += @("-CodexHome", $CodexHome)
}

if (-not [string]::IsNullOrWhiteSpace($PluginRoot)) {
  $arguments += @("-PluginRoot", $PluginRoot)
}

if ($Json) {
  $arguments += "-Json"
}

if ($PSCmdlet.MyInvocation.BoundParameters.ContainsKey("Verbose")) {
  $arguments += "-Verbose"
}

& powershell @arguments
exit $LASTEXITCODE
