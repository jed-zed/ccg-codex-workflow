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

function Limit-Text {
  param(
    [string]$Text,
    [int]$MaxLength = 500
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }
  $singleLine = ($Text -replace "\s+", " ").Trim()
  if ($singleLine.Length -le $MaxLength) {
    return $singleLine
  }
  return $singleLine.Substring(0, $MaxLength) + "..."
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

function Get-FileSha256Hex {
  param([string]$Path)

  $stream = [System.IO.File]::OpenRead($Path)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return Convert-BytesToHex ($sha.ComputeHash($stream))
  } finally {
    $sha.Dispose()
    $stream.Dispose()
  }
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

    $hash = Get-FileSha256Hex $file.FullName
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

foreach ($commandName in @(
  "ccg.md",
  "plan.md",
  "execute.md",
  "excute.md",
  "codex-exec.md",
  "workflow.md",
  "feat.md",
  "frontend.md",
  "backend.md",
  "analyze.md",
  "debug.md",
  "optimize.md",
  "test.md",
  "enhance.md",
  "review.md",
  "init.md",
  "context.md",
  "commit.md",
  "rollback.md",
  "clean-branches.md",
  "worktree.md",
  "spec-init.md",
  "spec-research.md",
  "spec-plan.md",
  "spec-impl.md",
  "spec-review.md",
  "team.md",
  "team-research.md",
  "team-plan.md",
  "team-exec.md",
  "team-review.md",
  "doctor.md",
  "gemini-preview.md",
  "gptpro-plan.md",
  "gptpro-review.md",
  "gptpro-exc.md",
  "verify-change.md"
)) {
  $commandPath = Join-Path $commandsDir $commandName
  Test-PathExists "plugin command: $commandName" $commandPath "Restore or regenerate plugin command files." | Out-Null
}

foreach ($skillName in @(
  "ccg-plan",
  "ccg-execute",
  "ccg-excute",
  "ccg-codex-exec",
  "ccg-workflow",
  "ccg-feat",
  "ccg-frontend",
  "ccg-backend",
  "ccg-analyze",
  "ccg-debug",
  "ccg-optimize",
  "ccg-test",
  "ccg-enhance",
  "ccg-review",
  "ccg-init",
  "ccg-context",
  "ccg-commit",
  "ccg-rollback",
  "ccg-clean-branches",
  "ccg-worktree",
  "ccg-spec-init",
  "ccg-spec-research",
  "ccg-spec-plan",
  "ccg-spec-impl",
  "ccg-spec-review",
  "ccg-team",
  "ccg-team-research",
  "ccg-team-plan",
  "ccg-team-exec",
  "ccg-team-review",
  "ccg-doctor",
  "ccg-gemini-preview",
  "ccg-gptpro-plan",
  "ccg-gptpro-review",
  "ccg-gptpro-exc",
  "ccg-gptpro-bridge",
  "verify-change"
)) {
  $skillPath = Join-PathMany $skillsDir $skillName "SKILL.md"
  Test-PathExists "plugin skill: $skillName" $skillPath "Restore or reinstall the CCG plugin skills." | Out-Null
}

$gptproRequiredPaths = @(
  (Join-PathMany $commandsDir "gptpro-plan.md"),
  (Join-PathMany $commandsDir "gptpro-review.md"),
  (Join-PathMany $commandsDir "gptpro-exc.md"),
  (Join-PathMany $skillsDir "ccg-gptpro-plan" "SKILL.md"),
  (Join-PathMany $skillsDir "ccg-gptpro-review" "SKILL.md"),
  (Join-PathMany $skillsDir "ccg-gptpro-exc" "SKILL.md"),
  (Join-PathMany $skillsDir "ccg-gptpro-bridge" "SKILL.md"),
  (Join-PathMany $skillsDir "ccg-gptpro-bridge" "scripts" "gptpro_bridge.py"),
  (Join-PathMany $skillsDir "ccg-gptpro-bridge" "templates" "gptpro" "base.md"),
  (Join-PathMany $skillsDir "ccg-gptpro-bridge" "templates" "gptpro" "plan.md"),
  (Join-PathMany $skillsDir "ccg-gptpro-bridge" "templates" "gptpro" "review.md"),
  (Join-PathMany $skillsDir "ccg-gptpro-bridge" "templates" "gptpro" "exc.md"),
  (Join-PathMany $skillsDir "ccg-gptpro-bridge" "templates" "gptpro" "followup.md")
)
$gptproMissing = @($gptproRequiredPaths | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($gptproMissing.Count -eq 0) {
  Add-Check "GPT Pro manual bridge" "PASS" "Required command, skill, script, and template files are present."
} else {
  Add-Check "GPT Pro manual bridge" "FAIL" ("Missing: " + ($gptproMissing -join "; ")) "Restore the GPT Pro manual bridge files."
}
Add-Check "ChatGPT web automation" "PASS" "intentionally unsupported"

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
    "commands\execute.md",
    "commands\excute.md",
    "commands\codex-exec.md",
    "commands\workflow.md",
    "commands\feat.md",
    "commands\frontend.md",
    "commands\backend.md",
    "commands\init.md",
    "commands\context.md",
    "commands\commit.md",
    "commands\rollback.md",
    "commands\clean-branches.md",
    "commands\worktree.md",
    "commands\spec-init.md",
    "commands\spec-research.md",
    "commands\spec-plan.md",
    "commands\spec-impl.md",
    "commands\spec-review.md",
    "commands\team.md",
    "commands\team-research.md",
    "commands\team-plan.md",
    "commands\team-exec.md",
    "commands\team-review.md",
    "commands\review.md",
    "commands\doctor.md",
    "commands\gptpro-plan.md",
    "commands\gptpro-review.md",
    "commands\gptpro-exc.md",
    "skills\ccg-plan\SKILL.md",
    "skills\ccg-execute\SKILL.md",
    "skills\ccg-excute\SKILL.md",
    "skills\ccg-codex-exec\SKILL.md",
    "skills\ccg-workflow\SKILL.md",
    "skills\ccg-feat\SKILL.md",
    "skills\ccg-frontend\SKILL.md",
    "skills\ccg-backend\SKILL.md",
    "skills\ccg-init\SKILL.md",
    "skills\ccg-context\SKILL.md",
    "skills\ccg-commit\SKILL.md",
    "skills\ccg-rollback\SKILL.md",
    "skills\ccg-clean-branches\SKILL.md",
    "skills\ccg-worktree\SKILL.md",
    "skills\ccg-spec-init\SKILL.md",
    "skills\ccg-spec-research\SKILL.md",
    "skills\ccg-spec-plan\SKILL.md",
    "skills\ccg-spec-impl\SKILL.md",
    "skills\ccg-spec-review\SKILL.md",
    "skills\ccg-team\SKILL.md",
    "skills\ccg-team-research\SKILL.md",
    "skills\ccg-team-plan\SKILL.md",
    "skills\ccg-team-exec\SKILL.md",
    "skills\ccg-team-review\SKILL.md",
    "skills\ccg-review\SKILL.md",
    "skills\ccg-doctor\SKILL.md",
    "skills\ccg-gptpro-plan\SKILL.md",
    "skills\ccg-gptpro-review\SKILL.md",
    "skills\ccg-gptpro-exc\SKILL.md",
    "skills\ccg-gptpro-bridge\SKILL.md",
    "skills\ccg-gptpro-bridge\scripts\gptpro_bridge.py",
    "skills\ccg-gptpro-bridge\templates\gptpro\base.md",
    "skills\ccg-gptpro-bridge\templates\gptpro\plan.md",
    "skills\ccg-gptpro-bridge\templates\gptpro\review.md",
    "skills\ccg-gptpro-bridge\templates\gptpro\exc.md",
    "skills\ccg-gptpro-bridge\templates\gptpro\followup.md",
    "skills\ccg-executor\scripts\invoke_gemini_preview.py",
    "scripts\doctor.ps1"
  )) {
    Test-CacheKeyFile $relativePath $cacheRoot
  }

  foreach ($skillName in @(
    "ccg-plan",
    "ccg-execute",
    "ccg-excute",
    "ccg-codex-exec",
    "ccg-workflow",
    "ccg-feat",
    "ccg-frontend",
    "ccg-backend",
    "ccg-analyze",
    "ccg-debug",
    "ccg-optimize",
    "ccg-test",
    "ccg-enhance",
    "ccg-review",
    "ccg-init",
    "ccg-context",
    "ccg-commit",
    "ccg-rollback",
    "ccg-clean-branches",
    "ccg-worktree",
    "ccg-spec-init",
    "ccg-spec-research",
    "ccg-spec-plan",
    "ccg-spec-impl",
    "ccg-spec-review",
    "ccg-team",
    "ccg-team-research",
    "ccg-team-plan",
    "ccg-team-exec",
    "ccg-team-review",
    "ccg-doctor",
    "ccg-gemini-preview",
    "ccg-gptpro-plan",
    "ccg-gptpro-review",
    "ccg-gptpro-exc",
    "ccg-gptpro-bridge",
    "verify-change"
  )) {
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

foreach ($skill in @(
  "ccg:plan",
  "ccg:execute",
  "ccg:excute",
  "ccg:codex-exec",
  "ccg:workflow",
  "ccg:feat",
  "ccg:frontend",
  "ccg:backend",
  "ccg:analyze",
  "ccg:debug",
  "ccg:optimize",
  "ccg:test",
  "ccg:enhance",
  "ccg:review",
  "ccg:init",
  "ccg:context",
  "ccg:commit",
  "ccg:rollback",
  "ccg:clean-branches",
  "ccg:worktree",
  "ccg:spec-init",
  "ccg:spec-research",
  "ccg:spec-plan",
  "ccg:spec-impl",
  "ccg:spec-review",
  "ccg:team",
  "ccg:team-research",
  "ccg:team-plan",
  "ccg:team-exec",
  "ccg:team-review",
  "ccg:doctor",
  "ccg:gemini-preview",
  "ccg:gptpro-plan",
  "ccg:gptpro-review",
  "ccg:gptpro-exc",
  "ccg:verify-change"
)) {
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
Test-BridgeFile "ccg\excute.md" (Join-Path $bridgeCommandDir "excute.md")
Test-BridgeFile "ccg\codex-exec.md" (Join-Path $bridgeCommandDir "codex-exec.md")
Test-BridgeFile "ccg\workflow.md" (Join-Path $bridgeCommandDir "workflow.md")
Test-BridgeFile "ccg\feat.md" (Join-Path $bridgeCommandDir "feat.md")
Test-BridgeFile "ccg\frontend.md" (Join-Path $bridgeCommandDir "frontend.md")
Test-BridgeFile "ccg\backend.md" (Join-Path $bridgeCommandDir "backend.md")
Test-BridgeFile "ccg\analyze.md" (Join-Path $bridgeCommandDir "analyze.md")
Test-BridgeFile "ccg\debug.md" (Join-Path $bridgeCommandDir "debug.md")
Test-BridgeFile "ccg\optimize.md" (Join-Path $bridgeCommandDir "optimize.md")
Test-BridgeFile "ccg\test.md" (Join-Path $bridgeCommandDir "test.md")
Test-BridgeFile "ccg\enhance.md" (Join-Path $bridgeCommandDir "enhance.md")
Test-BridgeFile "ccg\review.md" (Join-Path $bridgeCommandDir "review.md")
Test-BridgeFile "ccg\init.md" (Join-Path $bridgeCommandDir "init.md")
Test-BridgeFile "ccg\context.md" (Join-Path $bridgeCommandDir "context.md")
Test-BridgeFile "ccg\commit.md" (Join-Path $bridgeCommandDir "commit.md")
Test-BridgeFile "ccg\rollback.md" (Join-Path $bridgeCommandDir "rollback.md")
Test-BridgeFile "ccg\clean-branches.md" (Join-Path $bridgeCommandDir "clean-branches.md")
Test-BridgeFile "ccg\worktree.md" (Join-Path $bridgeCommandDir "worktree.md")
Test-BridgeFile "ccg\spec-init.md" (Join-Path $bridgeCommandDir "spec-init.md")
Test-BridgeFile "ccg\spec-research.md" (Join-Path $bridgeCommandDir "spec-research.md")
Test-BridgeFile "ccg\spec-plan.md" (Join-Path $bridgeCommandDir "spec-plan.md")
Test-BridgeFile "ccg\spec-impl.md" (Join-Path $bridgeCommandDir "spec-impl.md")
Test-BridgeFile "ccg\spec-review.md" (Join-Path $bridgeCommandDir "spec-review.md")
Test-BridgeFile "ccg\team.md" (Join-Path $bridgeCommandDir "team.md")
Test-BridgeFile "ccg\team-research.md" (Join-Path $bridgeCommandDir "team-research.md")
Test-BridgeFile "ccg\team-plan.md" (Join-Path $bridgeCommandDir "team-plan.md")
Test-BridgeFile "ccg\team-exec.md" (Join-Path $bridgeCommandDir "team-exec.md")
Test-BridgeFile "ccg\team-review.md" (Join-Path $bridgeCommandDir "team-review.md")
Test-BridgeFile "ccg\doctor.md" (Join-Path $bridgeCommandDir "doctor.md")
Test-BridgeFile "ccg\gemini-preview.md" (Join-Path $bridgeCommandDir "gemini-preview.md")
Test-BridgeFile "ccg\gptpro-plan.md" (Join-Path $bridgeCommandDir "gptpro-plan.md")
Test-BridgeFile "ccg\gptpro-review.md" (Join-Path $bridgeCommandDir "gptpro-review.md")
Test-BridgeFile "ccg\gptpro-exc.md" (Join-Path $bridgeCommandDir "gptpro-exc.md")

if ([string]::IsNullOrWhiteSpace($GeminiModel)) {
  if ([string]::IsNullOrWhiteSpace($env:GEMINI_MODEL)) {
    $GeminiModel = "gemini-3.1-pro-preview"
  } else {
    $GeminiModel = $env:GEMINI_MODEL
  }
}

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
  if ($CheckGeminiModel) {
    $modelArgs = @(
      "--model", $GeminiModel,
      "--skip-trust",
      "--approval-mode", "plan",
      "--output-format", "stream-json",
      "-p", "Return exactly CCG_DOCTOR_MODEL_OK."
    )
    $modelCheck = Invoke-CapturedCommand $geminiCommand.Source $modelArgs
    if ($modelCheck.ok -and $modelCheck.output -match "CCG_DOCTOR_MODEL_OK") {
      Add-Check "Gemini model available: $GeminiModel" "PASS" (Limit-Text $modelCheck.output)
    } else {
      $detail = Limit-Text $modelCheck.output
      if ($modelCheck.ok -and $modelCheck.output -notmatch "CCG_DOCTOR_MODEL_OK") {
        $detail = "Gemini CLI exited 0 but did not return CCG_DOCTOR_MODEL_OK. Output: $detail"
      }
      Add-Check "Gemini model available: $GeminiModel" "WARN" $detail "Check Gemini account permissions, model name, region, or use GEMINI_MODEL/--model override."
    }
  }
} else {
  Add-Check "Gemini CLI found" "WARN" "gemini CLI was not found in PATH." "Install or configure Gemini CLI before using /ccg:gemini-preview or Gemini-assisted /ccg:plan."
  if ($CheckGeminiModel) {
    Add-Check "Gemini model available: $GeminiModel" "SKIP" "Gemini CLI is unavailable." "Install or configure Gemini CLI before checking model availability."
  }
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
  Write-Output "Note: doctor cannot prove slash autocomplete. Codex Desktop autocomplete needs a manual UI smoke test; Codex CLI/TUI autocomplete is optional, so use prompt-text invocation if autocomplete is absent."
}

if ($counts.FAIL -gt 0) {
  exit 1
}
exit 0
