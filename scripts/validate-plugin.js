#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const node = process.execPath;
const phaseOneCommands = ["feat", "frontend", "backend", "analyze", "debug", "optimize", "test", "enhance"];
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
    "usage/help",
    "failure reports",
    "handoff",
  ]) {
    if (!planSkill.includes(phrase)) fail(`ccg-plan skill is missing Chinese output phrase: ${phrase}`);
  }

  const command = fs.readFileSync(path.join(repoRoot, "plugins/ccg/commands/plan.md"), "utf8");
  if (!command.includes("user-facing output for this command must be Chinese")) {
    fail("plan command must reinforce Chinese user-facing output");
  }
  console.log("plan language contract ok");
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
  ]) {
    if (!readme.includes(phrase)) fail(`README is missing release-readiness phrase: ${phrase}`);
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
  validateJson();
  validateScripts();
  validateGeminiDefaults();
  validateGeminiTemplates();
  validateOriginalCcgParityPhaseOne();
  validatePlanLanguageContract();
  validateReleaseDocs();
  validateDoctorFixDocs();
  validateCiActions();
  validateSkills();
  nodeCheck();
}

main();
