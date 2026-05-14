[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Medium")]
param(
  [string]$CodexHome = $env:CODEX_HOME,
  [string]$PluginRoot = "",
  [switch]$Fix,
  [switch]$Json
)

$ErrorActionPreference = "Stop"
$script:Checks = @()

function Add-Check {
  param(
    [string]$Name,
    [ValidateSet("PASS", "WARN", "FAIL", "SKIP")]
    [string]$Status,
    [string]$Detail = "",
    [string]$Recommendation = ""
  )

  $script:Checks += [pscustomobject]@{
    name = $Name
    status = $Status
    detail = $Detail
    recommendation = $Recommendation
  }
}

function Invoke-CapturedCommand {
  param(
    [string]$Command,
    [string[]]$Arguments = @()
  )

  try {
    $output = & $Command @Arguments 2>&1 | Out-String
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    return [pscustomobject]@{
      ok = ($exitCode -eq 0)
      exitCode = $exitCode
      output = $output.Trim()
    }
  } catch {
    return [pscustomobject]@{
      ok = $false
      exitCode = -1
      output = $_.Exception.Message
    }
  }
}

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

function Test-JsonFile {
  param(
    [string]$Name,
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    Add-Check $Name "FAIL" "Missing: $Path" "Reinstall or restore the CCG plugin files."
    return $null
  }

  try {
    $parsed = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    Add-Check $Name "PASS" "Parsed: $Path"
    return $parsed
  } catch {
    Add-Check $Name "FAIL" "Invalid JSON: $Path ($($_.Exception.Message))" "Fix the manifest JSON and rerun doctor."
    return $null
  }
}

function Test-PathExists {
  param(
    [string]$Name,
    [string]$Path,
    [string]$Recommendation
  )

  if (Test-Path -LiteralPath $Path) {
    Add-Check $Name "PASS" "Found: $Path"
    return $true
  }

  Add-Check $Name "FAIL" "Missing: $Path" $Recommendation
  return $false
}

function Test-PromptSkill {
  param(
    [string]$Skill,
    [string]$PromptInput
  )

  if ([string]::IsNullOrWhiteSpace($PromptInput)) {
    Add-Check "skill visible: $Skill" "SKIP" "prompt-input was unavailable." "Fix Codex CLI or plugin installation first."
    return
  }

  if ($PromptInput -match [regex]::Escape($Skill)) {
    Add-Check "skill visible: $Skill" "PASS" "Found in codex debug prompt-input."
  } else {
    Add-Check "skill visible: $Skill" "FAIL" "Not found in codex debug prompt-input." "Run 'codex plugin marketplace add <repo-path>' and restart the Codex TUI session."
  }
}

function Test-McpName {
  param(
    [string]$Name,
    [string]$McpOutput,
    [switch]$Optional
  )

  if ([string]::IsNullOrWhiteSpace($McpOutput)) {
    Add-Check "mcp visible: $Name" "SKIP" "codex mcp list was unavailable." "Fix Codex CLI first."
    return
  }

  if ($McpOutput -match "(?m)^\s*$([regex]::Escape($Name))\s") {
    Add-Check "mcp visible: $Name" "PASS" "Found in codex mcp list."
  } elseif ($Optional) {
    Add-Check "mcp visible: $Name" "WARN" "Optional global MCP server is not visible." "Configure globally only if you need this optional MCP."
  } else {
    Add-Check "mcp visible: $Name" "WARN" "Expected MCP server is not visible." "Check plugin MCP loading or configure this MCP globally."
  }
}

function Test-BridgeFile {
  param(
    [string]$Name,
    [string]$Path
  )

  if (Test-Path -LiteralPath $Path) {
    Add-Check "command bridge: $Name" "PASS" "Found: $Path"
  } else {
    Add-Check "command bridge: $Name" "WARN" "Missing: $Path" "Optional: run scripts\install-codex-command-bridge.ps1 if your Codex build supports user command discovery."
  }
}

function Test-CacheKeyFile {
  param(
    [string]$RelativePath,
    [string]$CacheRoot
  )

  $path = $CacheRoot
  foreach ($part in ($RelativePath -split "[\\/]")) {
    $path = Join-Path $path $part
  }
  Test-PathExists "cached key file: $RelativePath" $path "Run scripts\sync-local-plugin-cache.ps1 from the repository root and restart Codex." | Out-Null
}

function Test-IgnoredDigestPath {
  param([string]$RelativePath)

  $normalized = $RelativePath.Replace("\", "/")
  $parts = $normalized -split "/"
  foreach ($part in $parts) {
    if ($part -in @(".git", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache")) {
      return $true
    }
  }

  foreach ($suffix in @(".pyc", ".pyo", ".log", ".tmp")) {
    if ($normalized.EndsWith($suffix, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }

  return $false
}

function Convert-BytesToHex {
  param([byte[]]$Bytes)

  return -join ($Bytes | ForEach-Object { $_.ToString("x2") })
}

function Get-TreeDigest {
  param([string]$Root)

  if (-not (Test-Path -LiteralPath $Root)) {
    return ""
  }

  $rootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  $entries = @()
  $files = Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Sort-Object FullName
  foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($rootPath.Length).Replace("\", "/")
    if (Test-IgnoredDigestPath $relativePath) {
      continue
    }

    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $entries += "$relativePath=$hash"
  }

  $digestInput = [System.Text.Encoding]::UTF8.GetBytes(($entries -join "`n"))
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return Convert-BytesToHex ($sha.ComputeHash($digestInput))
  } finally {
    $sha.Dispose()
  }
}

if ([string]::IsNullOrWhiteSpace($CodexHome)) {
  $CodexHome = Join-Path $HOME ".codex"
}
$CodexHome = [System.IO.Path]::GetFullPath($CodexHome)

if ([string]::IsNullOrWhiteSpace($PluginRoot)) {
  $PluginRoot = Join-Path $PSScriptRoot ".."
}
$PluginRoot = [System.IO.Path]::GetFullPath($PluginRoot)

Add-Check "codex home" "PASS" $CodexHome
Add-Check "plugin root" "PASS" $PluginRoot
$fixDryRun = $Fix -and $WhatIfPreference

if ($Fix) {
  $syncScript = Join-PathMany $PluginRoot "scripts" "sync-local-plugin-cache.ps1"
  if (-not (Test-Path -LiteralPath $syncScript)) {
    Add-Check "plugin cache fix" "FAIL" "Missing: $syncScript" "Restore plugins\ccg\scripts\sync-local-plugin-cache.ps1 and rerun doctor with -Fix."
  } else {
    $syncArguments = @{
      CodexHome = $CodexHome
      PluginRoot = $PluginRoot
    }
    if ($WhatIfPreference) {
      $syncArguments["WhatIf"] = $true
    }
    try {
      $syncOutput = & $syncScript @syncArguments 2>&1 | Out-String
      Add-Check "plugin cache fix" "PASS" $syncOutput.Trim()
    } catch {
      Add-Check "plugin cache fix" "FAIL" $_.Exception.Message "Run scripts\sync-local-plugin-cache.ps1 manually from the source checkout and restart Codex."
    }
  }
}

$codexCommand = Get-Command "codex" -ErrorAction SilentlyContinue
if ($codexCommand) {
  Add-Check "codex CLI found" "PASS" $codexCommand.Source
  $version = Invoke-CapturedCommand "codex" @("--version")
  if ($version.ok) {
    Add-Check "codex --version" "PASS" $version.output
  } else {
    Add-Check "codex --version" "FAIL" $version.output "Repair or reinstall Codex CLI."
  }
} else {
  Add-Check "codex CLI found" "FAIL" "codex was not found in PATH." "Install Codex CLI or add it to PATH."
}

$pluginJson = Join-PathMany $PluginRoot ".codex-plugin" "plugin.json"
$mcpJson = Join-Path $PluginRoot ".mcp.json"
$pluginManifest = Test-JsonFile "plugin manifest" $pluginJson
$mcpManifest = Test-JsonFile "plugin MCP manifest" $mcpJson

$commandsDir = Join-Path $PluginRoot "commands"
$skillsDir = Join-Path $PluginRoot "skills"
Test-PathExists "plugin commands directory" $commandsDir "Restore plugins\ccg\commands from the repository." | Out-Null
Test-PathExists "plugin skills directory" $skillsDir "Restore plugins\ccg\skills from the repository." | Out-Null

foreach ($commandName in @("ccg.md", "plan.md", "execute.md", "doctor.md", "gemini-preview.md", "verify-change.md")) {
  $commandPath = Join-Path $commandsDir $commandName
  Test-PathExists "plugin command: $commandName" $commandPath "Restore or regenerate plugin command files." | Out-Null
}

foreach ($skillName in @("ccg-plan", "ccg-execute", "ccg-doctor", "ccg-gemini-preview", "verify-change")) {
  $skillPath = Join-PathMany $skillsDir $skillName "SKILL.md"
  Test-PathExists "plugin skill: $skillName" $skillPath "Restore or reinstall the CCG plugin skills." | Out-Null
}

if ($pluginManifest -and $pluginManifest.version) {
  $cacheRoot = Join-PathMany $CodexHome "plugins" "cache" "ccg-codex-workflow" "ccg" "$($pluginManifest.version)"
} else {
  $cacheRoot = Join-PathMany $CodexHome "plugins" "cache" "ccg-codex-workflow" "ccg" "0.1.0"
}

if (Test-Path -LiteralPath $cacheRoot) {
  Add-Check "plugin cache" "PASS" "Found: $cacheRoot"
  $cacheManifest = Test-JsonFile "plugin cache manifest" (Join-PathMany $cacheRoot ".codex-plugin" "plugin.json")
  if ($pluginManifest -and $cacheManifest) {
    $sourceVersion = [string]$pluginManifest.version
    $cacheVersion = [string]$cacheManifest.version
    if ($sourceVersion -eq $cacheVersion) {
      Add-Check "plugin cache version" "PASS" "source=$sourceVersion cache=$cacheVersion"
    } else {
      Add-Check "plugin cache version" "WARN" "source=$sourceVersion cache=$cacheVersion" "Run scripts\sync-local-plugin-cache.ps1 and restart the current Codex TUI session."
    }
  }

  foreach ($relativePath in @(
    ".codex-plugin\plugin.json",
    "commands\plan.md",
    "commands\doctor.md",
    "skills\ccg-plan\SKILL.md",
    "skills\ccg-doctor\SKILL.md",
    "skills\ccg-executor\scripts\invoke_gemini_preview.py",
    "scripts\doctor.ps1"
  )) {
    Test-CacheKeyFile $relativePath $cacheRoot
  }

  foreach ($skillName in @("ccg-plan", "ccg-execute", "ccg-doctor", "ccg-gemini-preview", "verify-change")) {
    $cachedSkill = Join-PathMany $cacheRoot "skills" $skillName "SKILL.md"
    Test-PathExists "cached skill: $skillName" $cachedSkill "Run 'codex plugin marketplace add <repo-path>' and restart Codex." | Out-Null
  }

  $sourceDigest = Get-TreeDigest $PluginRoot
  $cacheDigest = Get-TreeDigest $cacheRoot
  if ($sourceDigest -eq $cacheDigest) {
    Add-Check "plugin cache freshness" "PASS" "source/cache digest match: $sourceDigest"
  } else {
    Add-Check "plugin cache freshness" "WARN" "source=$sourceDigest cache=$cacheDigest" "Run scripts\sync-local-plugin-cache.ps1 and restart the current Codex TUI session."
  }
} else {
  if ($fixDryRun) {
    Add-Check "plugin cache" "WARN" "Missing after -Fix -WhatIf dry run: $cacheRoot" "Run doctor with -Fix without -WhatIf to refresh the cache, then restart Codex."
  } else {
    Add-Check "plugin cache" "FAIL" "Missing: $cacheRoot" "Run 'codex plugin marketplace add <repo-path>' and restart Codex."
  }
}

$promptInputOutput = ""
if ($codexCommand) {
  $promptInput = Invoke-CapturedCommand "codex" @("debug", "prompt-input")
  if ($promptInput.ok) {
    $promptInputOutput = $promptInput.output
    Add-Check "codex debug prompt-input" "PASS" "Command completed."
  } else {
    Add-Check "codex debug prompt-input" "FAIL" $promptInput.output "Update Codex CLI or inspect plugin loading errors."
  }
} else {
  Add-Check "codex debug prompt-input" "SKIP" "codex CLI is unavailable."
}

foreach ($skill in @("ccg:plan", "ccg:execute", "ccg:doctor", "ccg:gemini-preview", "ccg:verify-change")) {
  Test-PromptSkill $skill $promptInputOutput
}

$mcpOutput = ""
if ($codexCommand) {
  $mcpList = Invoke-CapturedCommand "codex" @("mcp", "list")
  if ($mcpList.ok) {
    $mcpOutput = $mcpList.output
    Add-Check "codex mcp list" "PASS" "Command completed."
  } else {
    Add-Check "codex mcp list" "WARN" $mcpList.output "MCP diagnostics unavailable; inspect Codex config manually."
  }
} else {
  Add-Check "codex mcp list" "SKIP" "codex CLI is unavailable."
}

Test-McpName "context7" $mcpOutput
Test-McpName "fast-context" $mcpOutput
Test-McpName "ace-tool" $mcpOutput -Optional
Test-McpName "grok-search" $mcpOutput -Optional

$commandsRoot = Join-Path $CodexHome "commands"
Test-BridgeFile "ccg.md" (Join-Path $commandsRoot "ccg.md")
$bridgeCommandDir = Join-Path $commandsRoot "ccg"
Test-BridgeFile "ccg\plan.md" (Join-Path $bridgeCommandDir "plan.md")
Test-BridgeFile "ccg\execute.md" (Join-Path $bridgeCommandDir "execute.md")
Test-BridgeFile "ccg\doctor.md" (Join-Path $bridgeCommandDir "doctor.md")
Test-BridgeFile "ccg\gemini-preview.md" (Join-Path $bridgeCommandDir "gemini-preview.md")

$geminiCommand = $null
foreach ($name in @("gemini.cmd", "gemini.exe", "gemini")) {
  $candidate = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($candidate) {
    $geminiCommand = $candidate
    break
  }
}

if ($geminiCommand) {
  Add-Check "Gemini CLI found" "PASS" $geminiCommand.Source
} else {
  Add-Check "Gemini CLI found" "WARN" "gemini CLI was not found in PATH." "Install or configure Gemini CLI before using /ccg:gemini-preview or Gemini-assisted /ccg:plan."
}

$counts = @{
  PASS = @($script:Checks | Where-Object { $_.status -eq "PASS" }).Count
  WARN = @($script:Checks | Where-Object { $_.status -eq "WARN" }).Count
  FAIL = @($script:Checks | Where-Object { $_.status -eq "FAIL" }).Count
  SKIP = @($script:Checks | Where-Object { $_.status -eq "SKIP" }).Count
}

$result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("s")
  codex_home = $CodexHome
  plugin_root = $PluginRoot
  counts = $counts
  checks = $script:Checks
}

if ($Json) {
  $result | ConvertTo-Json -Depth 6
} else {
  Write-Output "CCG Codex Doctor"
  Write-Output "Codex home : $CodexHome"
  Write-Output "Plugin root: $PluginRoot"
  Write-Output ""
  foreach ($check in $script:Checks) {
    $line = "[{0}] {1}" -f $check.status, $check.name
    if (-not [string]::IsNullOrWhiteSpace($check.detail)) {
      $line += " - $($check.detail)"
    }
    Write-Output $line
    if (($PSCmdlet.MyInvocation.BoundParameters.ContainsKey("Verbose") -or $VerbosePreference -ne "SilentlyContinue") -and
        -not [string]::IsNullOrWhiteSpace($check.recommendation)) {
      Write-Output "      recommendation: $($check.recommendation)"
    }
  }
  Write-Output ""
  Write-Output ("Summary: PASS={0} WARN={1} FAIL={2} SKIP={3}" -f $counts.PASS, $counts.WARN, $counts.FAIL, $counts.SKIP)
  Write-Output "Note: slash autocomplete cannot be proven by this script; use prompt-text invocation if autocomplete is absent."
}

if ($counts.FAIL -gt 0) {
  exit 1
}
exit 0
