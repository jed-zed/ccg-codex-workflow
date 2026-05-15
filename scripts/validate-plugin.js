#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const node = process.execPath;
const phaseOneCommands = ["feat", "frontend", "backend", "analyze", "debug", "optimize", "test", "enhance"];
const phaseOneCoreCommands = ["workflow", "plan", "execute", "codex-exec", "review", ...phaseOneCommands];
const gptproCommands = ["gptpro-plan", "gptpro-review", "gptpro-exc"];
const gptproSkills = ["ccg-gptpro-plan", "ccg-gptpro-review", "ccg-gptpro-exc", "ccg-gptpro-bridge"];
const gptproTemplates = ["base", "plan", "review", "exc", "followup"];
const geminiTemplates = [
  "base",
  "general",
  "plan",
  "prototype",
  "review",
  "frontend",
  "analyzer",
  "architect",
  "debugger",
  "optimizer",
  "tester",
];
const allowedArgs = new Set(["--phase-one", "--full-parity", "--full-parity-surface", "--full-parity-behavior"]);

function fail(message) {
  throw new Error(message);
}

function walk(dir, predicate, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walk(full, predicate, results);
    } else if (!predicate || predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

function validateJson() {
  const files = [
    ".agents/plugins/marketplace.json",
    ".claude-plugin/marketplace.json",
    ".codex-plugin/marketplace.json",
    "plugins/ccg/.codex-plugin/plugin.json",
    "plugins/ccg/.mcp.json",
  ];
  for (const file of files) {
    const full = path.join(repoRoot, file);
    JSON.parse(fs.readFileSync(full, "utf8"));
  }
  console.log(`json ok - ${files.length} file(s)`);
}

function validateScripts() {
  const files = [
    "scripts/doctor.ps1",
    "scripts/sync-local-plugin-cache.ps1",
    "plugins/ccg/scripts/sync-local-plugin-cache.ps1",
    "plugins/ccg/scripts/doctor.ps1",
    "plugins/ccg/commands/doctor.md",
    "plugins/ccg/skills/ccg-doctor/SKILL.md",
    "plugins/ccg/skills/ccg-doctor/agents/openai.yaml",
    "scripts/install-codex-command-bridge.ps1",
    "scripts/uninstall-codex-command-bridge.ps1",
  ];
  for (const file of files) {
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full)) fail(`missing script: ${file}`);
  }
  console.log(`scripts ok - ${files.length} file(s)`);
}

function validateGeminiDefaults() {
  const helper = fs.readFileSync(
    path.join(repoRoot, "plugins/ccg/skills/ccg-executor/scripts/invoke_gemini_preview.py"),
    "utf8"
  );
  if (!helper.includes('os.environ.get("GEMINI_MODEL", "gemini-3.1-pro-preview")')) {
    fail("Gemini preview helper default model must be gemini-3.1-pro-preview");
  }

  const planSkill = fs.readFileSync(path.join(repoRoot, "plugins/ccg/skills/ccg-plan/SKILL.md"), "utf8");
  for (const phrase of [
    "Gemini gate",
    "CCG_GEMINI_RESPONSE_FILE",
    "do not write or present a final plan",
    "gemini-3.1-pro-preview",
  ]) {
    if (!planSkill.includes(phrase)) fail(`ccg-plan skill is missing Gemini gate phrase: ${phrase}`);
  }

  const previewSkill = fs.readFileSync(
    path.join(repoRoot, "plugins/ccg/skills/ccg-gemini-preview/SKILL.md"),
    "utf8"
  );
  if (!previewSkill.includes("gemini-3.1-pro-preview")) {
    fail("ccg-gemini-preview skill must document gemini-3.1-pro-preview as the default model");
  }
  for (const file of [
    "README.md",
    "plugins/ccg/skills/ccg-plan/SKILL.md",
    "plugins/ccg/skills/ccg-gemini-preview/SKILL.md",
    "plugins/ccg/skills/ccg-executor/SKILL.md",
    "plugins/ccg/commands/plan.md",
  ]) {
    const text = fs.readFileSync(path.join(repoRoot, file), "utf8");
    if (text.includes("gemini-2.5-flash")) fail(`old Gemini default remains in ${file}`);
  }
  console.log("gemini defaults ok");
}

function validateGeminiTemplates() {
  const templateDir = path.join(repoRoot, "plugins/ccg/skills/ccg-executor/templates/gemini");
  for (const name of geminiTemplates) {
    const file = path.join(templateDir, `${name}.md`);
    if (!fs.existsSync(file)) fail(`missing Gemini prompt template: ${name}.md`);
  }

  const helper = fs.readFileSync(
    path.join(repoRoot, "plugins/ccg/skills/ccg-executor/scripts/invoke_gemini_preview.py"),
    "utf8"
  );
  for (const phrase of [
    "--prompt-template",
    "apply_prompt_template",
    "window.close()",
    "--no-auto-close-browser",
    "extract_event_text",
    "analyzer",
    "architect",
    "debugger",
    "optimizer",
    "tester",
    "--max-snapshot-bytes",
    "--files-from",
    "events",
    "Raw stream-json",
  ]) {
    if (!helper.includes(phrase)) fail(`Gemini preview helper missing template/auto-close phrase: ${phrase}`);
  }

  const executorSkill = fs.readFileSync(path.join(repoRoot, "plugins/ccg/skills/ccg-executor/SKILL.md"), "utf8");
  if (!executorSkill.includes("--prompt-template")) {
    fail("ccg-executor skill must document Gemini prompt templates");
  }
  for (const phrase of [
    "Every Gemini call in the CCG workflow must use the bundled preview helper",
    "Do not call the raw `gemini`, `gemini.cmd`, or `gemini.exe` CLI directly",
    "/ccg:gemini-preview` is only a manual smoke-test/debug entry",
  ]) {
    if (!executorSkill.includes(phrase)) fail(`ccg-executor skill is missing preview-helper rule: ${phrase}`);
  }
  console.log("gemini templates ok");
}

function validateGptProManualBridge() {
  const requiredFiles = [
    ...gptproCommands.map((command) => `plugins/ccg/commands/${command}.md`),
    ...gptproSkills.map((skill) => `plugins/ccg/skills/${skill}/SKILL.md`),
    ...gptproSkills.map((skill) => `plugins/ccg/skills/${skill}/agents/openai.yaml`),
    "plugins/ccg/skills/ccg-gptpro-bridge/scripts/gptpro_bridge.py",
    ...gptproTemplates.map(
      (template) => `plugins/ccg/skills/ccg-gptpro-bridge/templates/gptpro/${template}.md`
    ),
    "docs/gptpro-manual-bridge.md",
  ];
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(repoRoot, file))) fail(`missing GPT Pro manual bridge file: ${file}`);
  }

  const boundaryFiles = [
    "plugins/ccg/skills/ccg-gptpro-bridge/SKILL.md",
    "plugins/ccg/skills/ccg-gptpro-plan/SKILL.md",
    "plugins/ccg/skills/ccg-gptpro-review/SKILL.md",
    "plugins/ccg/skills/ccg-gptpro-exc/SKILL.md",
    "plugins/ccg/skills/ccg-gptpro-bridge/scripts/gptpro_bridge.py",
    "docs/gptpro-manual-bridge.md",
  ];
  const boundaryCorpus = boundaryFiles
    .map((file) => fs.readFileSync(path.join(repoRoot, file), "utf8"))
    .join("\n");
  for (const phrase of [
    "Do not automate ChatGPT web login",
    "Do not read ChatGPT web DOM",
    "Do not extract ChatGPT Output programmatically",
    "manual bridge",
    "Codex remains final owner",
    "Expected manual questions: 1",
    "Maximum manual questions: 2",
    "web_automation",
    "dom_extraction",
  ]) {
    if (!boundaryCorpus.includes(phrase)) fail(`GPT Pro manual bridge is missing boundary phrase: ${phrase}`);
  }

  const script = fs.readFileSync(
    path.join(repoRoot, "plugins/ccg/skills/ccg-gptpro-bridge/scripts/gptpro_bridge.py"),
    "utf8"
  );
  for (const phrase of [
    "ThreadingHTTPServer",
    "GET /state",
    "POST /save-response",
    "POST /mark-copied",
    "manual_questions_expected",
    "manual_questions_max",
    "webbrowser.open(\"https://chatgpt.com/\")",
  ]) {
    if (!script.includes(phrase)) fail(`gptpro_bridge.py is missing behavior phrase: ${phrase}`);
  }

  const ccgCommand = fs.readFileSync(path.join(repoRoot, "plugins/ccg/commands/ccg.md"), "utf8");
  const ccgSkill = fs.readFileSync(path.join(repoRoot, "plugins/ccg/skills/ccg/SKILL.md"), "utf8");
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const bridge = fs.readFileSync(path.join(repoRoot, "scripts/install-codex-command-bridge.ps1"), "utf8");
  const doctor = fs.readFileSync(path.join(repoRoot, "plugins/ccg/scripts/doctor.ps1"), "utf8");
  const fixtures = fs.readFileSync(path.join(repoRoot, "scripts/run-fixture-tests.js"), "utf8");
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");

  for (const command of gptproCommands) {
    for (const [label, text, expected] of [
      ["command index", ccgCommand, `/ccg:${command}`],
      ["skill index", ccgSkill, `/ccg:${command}`],
      ["README", readme, `/ccg:${command}`],
      ["bridge installer", bridge, `${command}.md`],
      ["doctor script", doctor, `${command}.md`],
      ["fixture coverage", fixtures, `fixture:gptpro`],
    ]) {
      if (!text.includes(expected)) {
        fail(`${label} missing GPT Pro manual bridge coverage for ${command}: ${expected}`);
      }
    }
  }

  for (const phrase of [
    "GPT Pro manual bridge",
    "ChatGPT web automation",
    "intentionally unsupported",
  ]) {
    if (!doctor.includes(phrase)) fail(`doctor.ps1 is missing GPT Pro diagnostic phrase: ${phrase}`);
  }
  if (!workflow.includes("Compile GPT Pro manual bridge helper")) {
    fail("CI workflow must compile GPT Pro manual bridge helper");
  }
  console.log("GPT Pro manual bridge ok");
}

function validateOriginalCcgParityPhaseOne() {
  const matrixPath = path.join(repoRoot, "docs/original-ccg-parity-matrix.md");
  if (!fs.existsSync(matrixPath)) fail("missing original CCG parity matrix");
  const matrix = fs.readFileSync(matrixPath, "utf8");
  for (const command of [
    "workflow",
    "plan",
    "execute",
    "feat",
    "frontend",
    "backend",
    "analyze",
    "debug",
    "optimize",
    "test",
    "enhance",
    "spec-init",
    "team-review",
    "codeagent-wrapper",
  ]) {
    if (!matrix.includes(`/ccg:${command}`) && command !== "codeagent-wrapper") {
      fail(`parity matrix is missing command: ${command}`);
    }
    if (command === "codeagent-wrapper" && !matrix.includes(command)) {
      fail("parity matrix must explain codeagent-wrapper is not copied");
    }
  }

  const ccgCommand = fs.readFileSync(path.join(repoRoot, "plugins/ccg/commands/ccg.md"), "utf8");
  const ccgSkill = fs.readFileSync(path.join(repoRoot, "plugins/ccg/skills/ccg/SKILL.md"), "utf8");
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const bridge = fs.readFileSync(path.join(repoRoot, "scripts/install-codex-command-bridge.ps1"), "utf8");
  const doctor = fs.readFileSync(path.join(repoRoot, "plugins/ccg/scripts/doctor.ps1"), "utf8");

  for (const command of phaseOneCommands) {
    for (const file of [
      `plugins/ccg/commands/${command}.md`,
      `plugins/ccg/skills/ccg-${command}/SKILL.md`,
      `plugins/ccg/skills/ccg-${command}/agents/openai.yaml`,
    ]) {
      if (!fs.existsSync(path.join(repoRoot, file))) fail(`missing phase-one command file: ${file}`);
    }
    for (const [name, text] of [
      ["ccg command index", ccgCommand],
      ["ccg skill index", ccgSkill],
      ["README", readme],
      ["bridge installer", bridge],
      ["doctor script", doctor],
      ["parity matrix", matrix],
    ]) {
      if (!text.includes(`/ccg:${command}`) && !text.includes(`${command}.md`) && !text.includes(`ccg-${command}`)) {
        fail(`${name} is missing phase-one command: ${command}`);
      }
    }
  }

  const frontendSkill = fs.readFileSync(path.join(repoRoot, "plugins/ccg/skills/ccg-frontend/SKILL.md"), "utf8");
  if (!frontendSkill.includes("--prompt-template frontend")) {
    fail("ccg-frontend must require the frontend Gemini template for substantial UI work");
  }
  const backendSkill = fs.readFileSync(path.join(repoRoot, "plugins/ccg/skills/ccg-backend/SKILL.md"), "utf8");
  if (!backendSkill.includes("Gemini is optional")) {
    fail("ccg-backend must keep Gemini optional for simple backend work");
  }
  console.log(`original CCG phase-one parity ok - ${phaseOneCommands.length} command(s)`);
}

function validatePlanLanguageContract() {
  const planSkill = fs.readFileSync(path.join(repoRoot, "plugins/ccg/skills/ccg-plan/SKILL.md"), "utf8");
  for (const phrase of [
    "Language Contract",
    "user-facing output must be Chinese",
    "generated plan file itself must also be Chinese",
    "Use this Chinese Markdown structure",
    "# CCG 计划",
    "usage/help",
    "failure reports",
    "handoff",
  ]) {
    if (!planSkill.includes(phrase)) fail(`ccg-plan skill is missing Chinese output phrase: ${phrase}`);
  }
  if (!planSkill.includes(".codex/ccg/plans/<slug>.md")) {
    fail("ccg-plan skill must write new plans under .codex/ccg/plans");
  }
  if (planSkill.includes("Write only `.claude/plan/*.md`")) {
    fail("ccg-plan skill still hard-codes .claude/plan as the default write target");
  }

  const command = fs.readFileSync(path.join(repoRoot, "plugins/ccg/commands/plan.md"), "utf8");
  if (!command.includes("user-facing output for this command must be Chinese")) {
    fail("plan command must reinforce Chinese user-facing output");
  }
  if (!command.includes("saved CCG plan content itself must be Chinese")) {
    fail("plan command must hard-code Chinese saved-plan content");
  }
  console.log("plan language contract ok");
}

function extractFullParityRows() {
  const matrixPath = path.join(repoRoot, "docs/original-ccg-parity-matrix.md");
  const matrix = fs.readFileSync(matrixPath, "utf8");
  const marker = "## Full Parity Required Commands";
  const start = matrix.indexOf(marker);
  if (start < 0) fail("parity matrix is missing Full Parity Required Commands section");
  const rest = matrix.slice(start + marker.length);
  const next = rest.search(/\n##\s+/);
  const section = next >= 0 ? rest.slice(0, next) : rest;
  return section
    .split(/\r?\n/)
    .filter((line) => /^\|\s*`?\/?ccg:|^\|\s*Claude|^\|\s*Legacy/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, "")))
    .filter((cells) => cells.length >= 6)
    .map(([command, required, status, group, reason, replacement]) => ({
      command,
      required: required.toLowerCase(),
      status: status.toLowerCase(),
      group,
      reason,
      replacement,
    }));
}

function commandName(command) {
  return command.replace(/^\/ccg:/, "");
}

function validateFullParitySurface() {
  const rows = extractFullParityRows();
  if (!rows.length) fail("full parity matrix did not yield any command rows");

  const ccgCommand = fs.readFileSync(path.join(repoRoot, "plugins/ccg/commands/ccg.md"), "utf8");
  const ccgSkill = fs.readFileSync(path.join(repoRoot, "plugins/ccg/skills/ccg/SKILL.md"), "utf8");
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const bridge = fs.readFileSync(path.join(repoRoot, "scripts/install-codex-command-bridge.ps1"), "utf8");
  const doctor = fs.readFileSync(path.join(repoRoot, "plugins/ccg/scripts/doctor.ps1"), "utf8");
  const fixtures = fs.readFileSync(path.join(repoRoot, "scripts/run-fixture-tests.js"), "utf8");

  const requiredRows = rows.filter((row) => row.required === "yes");
  for (const row of requiredRows) {
    const name = commandName(row.command);
    if (row.status === "planned") fail(`full parity required command is still planned: ${row.command}`);
    for (const file of [
      `plugins/ccg/commands/${name}.md`,
      `plugins/ccg/skills/ccg-${name}/SKILL.md`,
      `plugins/ccg/skills/ccg-${name}/agents/openai.yaml`,
    ]) {
      if (!fs.existsSync(path.join(repoRoot, file))) fail(`missing full parity file for ${row.command}: ${file}`);
    }
    for (const [label, text, expected] of [
      ["README", readme, row.command],
      ["command index", ccgCommand, row.command],
      ["skill index", ccgSkill, row.command],
      ["bridge installer", bridge, `${name}.md`],
      ["doctor script", doctor, `${name}.md`],
      ["fixture coverage", fixtures, `fixture:${row.group}`],
    ]) {
      if (!text.includes(expected)) fail(`${label} missing full parity coverage for ${row.command}: ${expected}`);
    }
  }

  for (const row of rows.filter((candidate) => candidate.status === "not-copied")) {
    if (!row.reason || row.reason === "-" || /tbd/i.test(row.reason)) {
      fail(`not-copied row needs a reason: ${row.command}`);
    }
    if (!row.replacement || row.replacement === "-" || /tbd/i.test(row.replacement)) {
      fail(`not-copied row needs a Codex-native replacement: ${row.command}`);
    }
  }

  for (const command of phaseOneCoreCommands) {
    if (!requiredRows.some((row) => row.command === `/ccg:${command}`)) {
      fail(`full parity matrix missing phase-one/core command: /ccg:${command}`);
    }
  }
  console.log(`original CCG full parity surface ok - ${requiredRows.length} required command(s)`);
}

function validateFullParityBehavior() {
  const requiredFiles = [
    "plugins/ccg/skills/ccg-spec-init/scripts/spec_manager.js",
    "plugins/ccg/skills/ccg-team/scripts/team_plan_checker.js",
  ];
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(repoRoot, file))) fail(`missing behavior helper: ${file}`);
  }

  const specManager = fs.readFileSync(
    path.join(repoRoot, "plugins/ccg/skills/ccg-spec-init/scripts/spec_manager.js"),
    "utf8"
  );
  for (const phrase of ["status.json", "requirement.md", "schema_version", "write-research", "write-constraints", "validate", "archive"]) {
    if (!specManager.includes(phrase)) fail(`spec_manager.js is missing behavior phrase: ${phrase}`);
  }

  const teamChecker = fs.readFileSync(
    path.join(repoRoot, "plugins/ccg/skills/ccg-team/scripts/team_plan_checker.js"),
    "utf8"
  );
  for (const phrase of ["same_file_conflicts", "can_execute", "blocking_reasons", "status.json", "--no-write-status", "--write-status"]) {
    if (!teamChecker.includes(phrase)) fail(`team_plan_checker.js is missing behavior phrase: ${phrase}`);
  }

  const commitHelper = fs.readFileSync(
    path.join(repoRoot, "plugins/ccg/skills/ccg-commit/scripts/commit_helper.js"),
    "utf8"
  );
  for (const phrase of [
    "--check-gates",
    "--scope",
    "--allow-gate-warnings",
    "gatedScanTargets",
    "scope_warnings",
    "CCG_VERIFY_CHANGE_SCRIPT",
    "CCG_VERIFY_QUALITY_SCRIPT",
    "CCG_VERIFY_SECURITY_SCRIPT",
    "verify-security",
  ]) {
    if (!commitHelper.includes(phrase)) fail(`commit_helper.js is missing behavior phrase: ${phrase}`);
  }

  const rollbackHelper = fs.readFileSync(
    path.join(repoRoot, "plugins/ccg/skills/ccg-rollback/scripts/rollback_helper.js"),
    "utf8"
  );
  for (const phrase of [
    "--protected-branch-ok",
    "--allow-dirty",
    "--only-if-clean",
    "dirtyPreflight",
    "git revert --no-commit",
    "git restore --source=",
    "git reset --hard remains manual-only",
    "git push --force is always manual-only",
  ]) {
    if (!rollbackHelper.includes(phrase)) fail(`rollback_helper.js is missing behavior phrase: ${phrase}`);
  }

  const fixtures = fs.readFileSync(path.join(repoRoot, "scripts/run-fixture-tests.js"), "utf8");
  for (const marker of [
    "fixture:spec-manager",
    "fixture:team-plan-checker",
    "fixture:rollback-confirm-exec",
    "fixture:commit-gate-runner",
    "--scope staged reports unstaged and untracked warnings",
    "restore refuses dirty touched file",
    "summarize and conflicts do not write status.json",
  ]) {
    if (!fixtures.includes(marker)) fail(`run-fixture-tests.js is missing behavior fixture marker: ${marker}`);
  }

  const specDocs = fs.readFileSync(path.join(repoRoot, "docs/spec-workflow.md"), "utf8");
  for (const phrase of ["status.json", "requirement.md", "schema_version", "spec_manager.js", "validate <spec-name> --json"]) {
    if (!specDocs.includes(phrase)) fail(`spec workflow docs are missing behavior phrase: ${phrase}`);
  }

  const teamDocs = fs.readFileSync(path.join(repoRoot, "docs/team-workflow.md"), "utf8");
  for (const phrase of ["team_plan_checker.js", "status.json", "can_execute", "--write-status", "--no-write-status"]) {
    if (!teamDocs.includes(phrase)) fail(`team workflow docs are missing behavior phrase: ${phrase}`);
  }

  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  for (const phrase of [
    "Behavior-depth parity:",
    "spec_manager.js",
    "team_plan_checker.js",
    "Rollback supports confirmed non-destructive revert/restore execution.",
    "Commit helper can collect CCG gate status before committing.",
  ]) {
    if (!readme.includes(phrase)) fail(`README is missing behavior parity phrase: ${phrase}`);
  }

  const matrix = fs.readFileSync(path.join(repoRoot, "docs/original-ccg-parity-matrix.md"), "utf8");
  for (const phrase of ["## Behavioral Depth Coverage", "spec_manager.js", "team_plan_checker.js"]) {
    if (!matrix.includes(phrase)) fail(`parity matrix is missing behavior coverage phrase: ${phrase}`);
  }

  const migration = fs.readFileSync(path.join(repoRoot, "docs/migration-from-claude-ccg.md"), "utf8");
  for (const phrase of [
    "spec_manager.js",
    "team_plan_checker.js",
    "safer Codex-native behavioral helpers",
    "Claude wrapper, Claude Agent Teams runtime, and legacy `SESSION_ID` resume are still intentionally not restored",
  ]) {
    if (!migration.includes(phrase)) fail(`migration guide is missing behavior parity phrase: ${phrase}`);
  }

  console.log("original CCG full parity behavior ok");
}

function validateFullParity() {
  validateFullParitySurface();
  validateFullParityBehavior();
}

function validateReleaseDocs() {
  const migration = path.join(repoRoot, "docs/migration-from-claude-ccg.md");
  if (!fs.existsSync(migration)) fail("missing migration guide");

  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  for (const phrase of [
    "CCG_OK",
    "release-readiness smoke test",
    ".ccgignore",
    "response file remains the source of truth",
    "heuristic gates",
    "migration-from-claude-ccg.md",
    "Codex Desktop",
    "Codex CLI 0.130",
    "prompt-text invocation",
    "doctor cannot prove slash autocomplete",
    "Desktop autocomplete smoke test",
    "CLI slash autocomplete is not required to pass",
    "Behavior-depth parity:",
    "spec_manager.js",
    "team_plan_checker.js",
  ]) {
    if (!readme.includes(phrase)) fail(`README is missing release-readiness phrase: ${phrase}`);
  }

  const parityMatrix = fs.readFileSync(path.join(repoRoot, "docs/original-ccg-parity-matrix.md"), "utf8");
  for (const phrase of ["Slash autocomplete is verified in Codex Desktop", "Codex CLI 0.130/TUI", "Behavioral Depth Coverage"]) {
    if (!parityMatrix.includes(phrase)) fail(`parity matrix is missing autocomplete phrase: ${phrase}`);
  }

  const doctorScript = fs.readFileSync(path.join(repoRoot, "plugins/ccg/scripts/doctor.ps1"), "utf8");
  for (const phrase of [
    "doctor cannot prove slash autocomplete",
    "Codex Desktop autocomplete needs a manual UI smoke test",
    "Codex CLI/TUI autocomplete is optional",
  ]) {
    if (!doctorScript.includes(phrase)) fail(`doctor.ps1 is missing autocomplete diagnostic phrase: ${phrase}`);
  }

  const optionalMcp = fs.readFileSync(path.join(repoRoot, "docs/optional-mcp.md"), "utf8");
  if (!optionalMcp.includes("Reproducible MCP Mode")) fail("optional MCP docs must mention reproducible mode");
  console.log("release docs ok");
}

function validateDoctorFixDocs() {
  const doctorSkill = fs.readFileSync(path.join(repoRoot, "plugins/ccg/skills/ccg-doctor/SKILL.md"), "utf8");
  for (const phrase of [
    "--fix",
    "source checkout",
    "read-only",
    "sync-local-plugin-cache.ps1",
    "-CheckGeminiModel",
    "--skip-trust",
  ]) {
    if (!doctorSkill.includes(phrase)) fail(`ccg-doctor skill is missing fix guidance phrase: ${phrase}`);
  }

  const doctorScript = fs.readFileSync(path.join(repoRoot, "plugins/ccg/scripts/doctor.ps1"), "utf8");
  for (const phrase of [
    "[switch]$Fix",
    "[switch]$CheckGeminiModel",
    "ShouldProcess",
    "sync-local-plugin-cache.ps1",
    "CCG_DOCTOR_MODEL_OK",
  ]) {
    if (!doctorScript.includes(phrase)) fail(`doctor.ps1 is missing fix implementation phrase: ${phrase}`);
  }

  const bridgeScript = fs.readFileSync(path.join(repoRoot, "scripts/install-codex-command-bridge.ps1"), "utf8");
  if (!bridgeScript.includes("SupportsShouldProcess")) {
    fail("install-codex-command-bridge.ps1 must support -WhatIf diagnostics");
  }
  console.log("doctor fix docs ok");
}

function validateCiActions() {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
  for (const phrase of ["strategy:", "matrix:", "ubuntu-latest", "windows-latest"]) {
    if (!workflow.includes(phrase)) fail(`CI workflow must include cross-platform matrix phrase: ${phrase}`);
  }
  for (const action of ["actions/checkout@v6", "actions/setup-node@v6", "actions/setup-python@v6"]) {
    if (!workflow.includes(action)) fail(`CI workflow must use Node 24-compatible action: ${action}`);
  }
  for (const action of ["actions/checkout@v4", "actions/setup-node@v4", "actions/setup-python@v5"]) {
    if (workflow.includes(action)) fail(`CI workflow still uses Node 20-backed action: ${action}`);
  }
  for (const phrase of [
    "Validate phase-one compatibility",
    "Validate full parity surface",
    "Validate full parity behavior",
    "node scripts/validate-plugin.js --full-parity-surface",
    "node scripts/validate-plugin.js --full-parity-behavior",
  ]) {
    if (!workflow.includes(phrase)) fail(`CI workflow must include behavior parity phrase: ${phrase}`);
  }
  console.log("ci actions ok");
}

function validateSkills() {
  const skillsDir = path.join(repoRoot, "plugins", "ccg", "skills");
  const skillFiles = walk(skillsDir, (file) => path.basename(file) === "SKILL.md");
  for (const file of skillFiles) {
    const text = fs.readFileSync(file, "utf8");
    if (!/^---\r?\n/.test(text)) fail(`missing frontmatter start: ${file}`);
    const endMatch = /\r?\n---\r?\n/.exec(text.slice(4));
    const end = endMatch ? 4 + endMatch.index : -1;
    if (end < 0) fail(`missing frontmatter end: ${file}`);
    const frontmatter = text.slice(4, end);
    if (!/^name:\s*\S+/m.test(frontmatter)) fail(`missing name: ${file}`);
    if (!/^description:\s*.+/m.test(frontmatter)) fail(`missing description: ${file}`);
  }
  console.log(`skills ok - ${skillFiles.length} skill(s)`);
}

function nodeCheck() {
  const jsFiles = walk(path.join(repoRoot, "plugins", "ccg", "skills"), (file) => file.endsWith(".js"))
    .concat(walk(path.join(repoRoot, "scripts"), (file) => file.endsWith(".js")));
  for (const file of jsFiles) {
    const result = spawnSync(node, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) {
      fail(`node --check failed for ${file}\n${result.stdout || ""}${result.stderr || ""}`);
    }
  }
  console.log(`node syntax ok - ${jsFiles.length} file(s)`);
}

function main() {
  for (const arg of process.argv.slice(2)) {
    if (!allowedArgs.has(arg)) fail(`unknown argument: ${arg}`);
  }
  const fullParity = process.argv.includes("--full-parity");
  const fullParitySurface = process.argv.includes("--full-parity-surface");
  const fullParityBehavior = process.argv.includes("--full-parity-behavior");
  validateJson();
  validateScripts();
  validateGeminiDefaults();
  validateGeminiTemplates();
  validateGptProManualBridge();
  validateOriginalCcgParityPhaseOne();
  validatePlanLanguageContract();
  validateReleaseDocs();
  validateDoctorFixDocs();
  validateCiActions();
  validateSkills();
  nodeCheck();
  if (fullParity) validateFullParity();
  else {
    if (fullParitySurface) validateFullParitySurface();
    if (fullParityBehavior) validateFullParityBehavior();
  }
}

main();
