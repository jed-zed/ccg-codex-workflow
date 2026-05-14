#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const node = process.execPath;

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
    "scripts/install-codex-command-bridge.ps1",
    "scripts/uninstall-codex-command-bridge.ps1",
  ];
  for (const file of files) {
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full)) fail(`missing script: ${file}`);
  }
  console.log(`scripts ok - ${files.length} file(s)`);
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
  validateSkills();
  nodeCheck();
}

main();
