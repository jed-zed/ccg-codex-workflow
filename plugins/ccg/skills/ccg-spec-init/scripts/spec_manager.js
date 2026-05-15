#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const SPEC_README = `# Codex CCG Specs

This directory stores Codex-native CCG spec artifacts.

Each spec lives under:

\`\`\`text
.codex/ccg/specs/<spec-name>/
  research.md
  constraints.md
  plan.md
  review.md
  archive.md
  status.json
\`\`\`
`;

const CONSTRAINT_SECTIONS = {
  goal: ["Goal", "目标"],
  scope: ["Scope", "范围"],
  outOfScope: ["Out of Scope", "Out-of-Scope", "非范围"],
  constraints: ["Constraints", "约束"],
  acceptanceCriteria: ["Acceptance Criteria", "Acceptance", "验收标准"],
};

const PLAN_SECTIONS = {
  keyFiles: ["Key Files", "关键文件"],
  implementationOrder: ["Implementation Order", "实施顺序"],
  verification: ["Verification Commands", "Verification", "验证命令", "验证"],
  risks: ["Risks", "Risk", "风险"],
};

const REVIEW_SECTIONS = {
  constraintsConsistency: ["Constraints Consistency", "Constraint Consistency", "约束一致性"],
  testsCoverage: ["Tests Coverage", "Test Coverage", "Tests", "测试覆盖"],
  scopeDrift: ["Scope Drift", "范围漂移"],
  securityDeltas: ["Security Deltas", "Security-sensitive Deltas", "安全增量", "安全变化"],
};

const ARCHIVE_SECTIONS = {
  executionSummary: ["Execution Summary", "执行摘要"],
  verificationResults: ["Verification Results", "Verification Result", "验证结果"],
  residualRisks: ["Residual Risks", "Residual Risk", "遗留风险"],
};

class CliError extends Error {
  constructor(message, result) {
    super(message);
    this.result = result || null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasPattern(alias) {
  return escapeRegex(alias.trim()).replace(/[\s_-]+/g, "[\\s_-]+");
}

function lineHasAlias(line, aliases) {
  return aliases.some((alias) => {
    const pattern = aliasPattern(alias);
    const matcher = new RegExp(`^\\s*(?:#{1,6}\\s*)?${pattern}\\s*(?:[:：].*)?$`, "i");
    return matcher.test(line.trim());
  });
}

function hasSection(text, aliases) {
  if (!text) return false;
  return text.split(/\r?\n/).some((line) => lineHasAlias(line, aliases));
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function assertSpecName(name) {
  if (!name) {
    throw new CliError("spec name is required");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new CliError(`invalid spec name: ${name}`);
  }
  return name;
}

function specsRoot(cwd = process.cwd()) {
  return path.join(cwd, ".codex", "ccg", "specs");
}

function specDir(specName, cwd = process.cwd()) {
  return path.join(specsRoot(cwd), assertSpecName(specName));
}

function statusPath(specName, cwd = process.cwd()) {
  return path.join(specDir(specName, cwd), "status.json");
}

function artifactPath(specName, artifactName, cwd = process.cwd()) {
  return path.join(specDir(specName, cwd), artifactName);
}

function ensureRoot(cwd = process.cwd()) {
  const root = specsRoot(cwd);
  ensureDirectory(root);
  const readmePath = path.join(root, "README.md");
  let createdReadme = false;
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, SPEC_README, "utf8");
    createdReadme = true;
  }
  return { root, readmePath, createdReadme };
}

function ensureSpecExists(specName, cwd = process.cwd()) {
  const dir = specDir(specName, cwd);
  if (!fs.existsSync(dir)) {
    throw new CliError(`spec does not exist: ${specName}`);
  }
  return dir;
}

function loadPreviousStatus(specName, cwd = process.cwd()) {
  const file = statusPath(specName, cwd);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function collectArtifacts(specName, cwd = process.cwd()) {
  return {
    research: fs.existsSync(artifactPath(specName, "research.md", cwd)),
    constraints: fs.existsSync(artifactPath(specName, "constraints.md", cwd)),
    plan: fs.existsSync(artifactPath(specName, "plan.md", cwd)),
    review: fs.existsSync(artifactPath(specName, "review.md", cwd)),
    archive: fs.existsSync(artifactPath(specName, "archive.md", cwd)),
  };
}

function collectValidation(specName, cwd = process.cwd()) {
  const errors = [];
  const warnings = [];

  const researchText = readText(artifactPath(specName, "research.md", cwd));
  const constraintsText = readText(artifactPath(specName, "constraints.md", cwd));
  const planText = readText(artifactPath(specName, "plan.md", cwd));
  const reviewText = readText(artifactPath(specName, "review.md", cwd));
  const archiveText = readText(artifactPath(specName, "archive.md", cwd));

  if (!researchText) errors.push("research.md is required");
  if (!constraintsText) errors.push("constraints.md is required");

  const validation = {
    has_goal: hasSection(constraintsText, CONSTRAINT_SECTIONS.goal),
    has_constraints: hasSection(constraintsText, CONSTRAINT_SECTIONS.constraints),
    has_acceptance_criteria: hasSection(constraintsText, CONSTRAINT_SECTIONS.acceptanceCriteria),
    has_out_of_scope: hasSection(constraintsText, CONSTRAINT_SECTIONS.outOfScope),
    has_test_strategy:
      hasSection(planText, ["Test Strategy", "测试策略"]) ||
      hasSection(planText, PLAN_SECTIONS.verification) ||
      hasSection(researchText, ["Test Strategy", "测试策略"]),
  };

  if (constraintsText) {
    if (!validation.has_goal) errors.push("constraints.md must include Goal/目标");
    if (!hasSection(constraintsText, CONSTRAINT_SECTIONS.scope)) {
      errors.push("constraints.md must include Scope/范围");
    }
    if (!validation.has_out_of_scope) errors.push("constraints.md must include Out of Scope/非范围");
    if (!validation.has_constraints) errors.push("constraints.md must include Constraints/约束");
    if (!validation.has_acceptance_criteria) {
      errors.push("constraints.md must include Acceptance Criteria/验收标准");
    }
  }

  if (planText) {
    if (!hasSection(planText, PLAN_SECTIONS.keyFiles)) errors.push("plan.md must include Key Files/关键文件");
    if (!hasSection(planText, PLAN_SECTIONS.implementationOrder)) {
      errors.push("plan.md must include Implementation Order/实施顺序");
    }
    if (!hasSection(planText, PLAN_SECTIONS.verification)) {
      errors.push("plan.md must include Verification/验证命令");
    }
    if (!hasSection(planText, PLAN_SECTIONS.risks)) errors.push("plan.md must include Risks/风险");
  }

  if (reviewText) {
    if (!hasSection(reviewText, REVIEW_SECTIONS.constraintsConsistency)) {
      errors.push("review.md must include Constraints Consistency/约束一致性");
    }
    if (!hasSection(reviewText, REVIEW_SECTIONS.testsCoverage)) {
      errors.push("review.md must include Tests Coverage/测试覆盖");
    }
    if (!hasSection(reviewText, REVIEW_SECTIONS.scopeDrift)) {
      errors.push("review.md must include Scope Drift/范围漂移");
    }
    if (!hasSection(reviewText, REVIEW_SECTIONS.securityDeltas)) {
      errors.push("review.md must include Security Deltas/安全增量");
    }
  }

  if (archiveText) {
    if (!hasSection(archiveText, ARCHIVE_SECTIONS.executionSummary)) {
      errors.push("archive.md must include Execution Summary/执行摘要");
    }
    if (!hasSection(archiveText, ARCHIVE_SECTIONS.verificationResults)) {
      errors.push("archive.md must include Verification Results/验证结果");
    }
    if (!hasSection(archiveText, ARCHIVE_SECTIONS.residualRisks)) {
      errors.push("archive.md must include Residual Risks/遗留风险");
    }
  }

  if (!planText) {
    warnings.push("plan.md is not present yet");
  }
  if (!reviewText) {
    warnings.push("review.md is not present yet");
  }
  if (!archiveText) {
    warnings.push("archive.md is not present yet");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validation,
  };
}

function saveStatus(specName, cwd = process.cwd()) {
  ensureRoot(cwd);
  ensureSpecExists(specName, cwd);
  const previous = loadPreviousStatus(specName, cwd);
  const status = {
    name: specName,
    created_at: previous && previous.created_at ? previous.created_at : nowIso(),
    updated_at: nowIso(),
    artifacts: collectArtifacts(specName, cwd),
    validation: collectValidation(specName, cwd).validation,
  };
  fs.writeFileSync(statusPath(specName, cwd), JSON.stringify(status, null, 2) + "\n", "utf8");
  return status;
}

function ensureParentSpec(specName, cwd = process.cwd()) {
  ensureRoot(cwd);
  ensureSpecExists(specName, cwd);
  return specDir(specName, cwd);
}

function readRequiredFile(flagName, filePath) {
  if (!filePath) throw new CliError(`${flagName} requires a file path`);
  if (!fs.existsSync(filePath)) throw new CliError(`file does not exist: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function getFlag(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  return args[index + 1] || null;
}

function formatHuman(result) {
  const lines = [`command: ${result.command}`];
  if (result.spec) lines.push(`spec: ${result.spec}`);
  if (typeof result.valid === "boolean") lines.push(`valid: ${result.valid}`);
  if (result.written) lines.push(`written: ${result.written}`);
  if (result.readmePath) lines.push(`readme: ${result.readmePath}`);
  if (result.errors && result.errors.length) {
    lines.push("errors:");
    for (const error of result.errors) lines.push(`- ${error}`);
  }
  if (result.warnings && result.warnings.length) {
    lines.push("warnings:");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  return lines.join("\n");
}

function run(command, args, cwd = process.cwd()) {
  if (command === "init") {
    const initResult = ensureRoot(cwd);
    return {
      command,
      root: initResult.root,
      readmePath: initResult.readmePath,
      createdReadme: initResult.createdReadme,
    };
  }

  if (command === "create") {
    const specName = assertSpecName(args[0]);
    const requirement = getFlag(args, "--requirement");
    if (!requirement) throw new CliError("--requirement is required for create");
    ensureRoot(cwd);
    const dir = specDir(specName, cwd);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
      throw new CliError(`spec already exists: ${specName}`);
    }
    ensureDirectory(dir);
    const status = saveStatus(specName, cwd);
    return { command, spec: specName, requirement, created: true, status };
  }

  if (command === "write-research" || command === "write-constraints") {
    const specName = assertSpecName(args[0]);
    const sourceFile = getFlag(args, "--file");
    const content = readRequiredFile("--file", sourceFile);
    ensureParentSpec(specName, cwd);
    const targetName = command === "write-research" ? "research.md" : "constraints.md";
    const targetPath = artifactPath(specName, targetName, cwd);
    fs.writeFileSync(targetPath, content, "utf8");
    const status = saveStatus(specName, cwd);
    return { command, spec: specName, written: targetPath, status };
  }

  if (command === "archive") {
    const specName = assertSpecName(args[0]);
    const sourceFile = getFlag(args, "--summary-file");
    const content = readRequiredFile("--summary-file", sourceFile);
    ensureParentSpec(specName, cwd);
    const targetPath = artifactPath(specName, "archive.md", cwd);
    fs.writeFileSync(targetPath, content, "utf8");
    const status = saveStatus(specName, cwd);
    return { command, spec: specName, written: targetPath, status };
  }

  if (command === "validate") {
    const specName = assertSpecName(args[0]);
    ensureParentSpec(specName, cwd);
    const status = saveStatus(specName, cwd);
    const validation = collectValidation(specName, cwd);
    return {
      command,
      spec: specName,
      valid: validation.valid,
      status,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  if (command === "status") {
    const specName = assertSpecName(args[0]);
    ensureParentSpec(specName, cwd);
    const status = saveStatus(specName, cwd);
    const validation = collectValidation(specName, cwd);
    return {
      command,
      spec: specName,
      valid: validation.valid,
      status,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  throw new CliError(`unknown command: ${command}`);
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const json = argv.includes("--json");
  const args = argv.filter((arg) => arg !== "--json");
  const command = args.shift();
  if (!command) {
    throw new CliError("usage: spec_manager.js <init|create|write-research|write-constraints|validate|archive|status> ...");
  }

  const result = run(command, args, cwd);
  if (command === "validate" && !result.valid) {
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatHuman(result));
    }
    process.exit(1);
  }

  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatHuman(result));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const json = process.argv.slice(2).includes("--json");
    if (json && error && error.result) {
      console.log(JSON.stringify(error.result, null, 2));
    } else if (json) {
      console.log(JSON.stringify({ error: error.message }, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

module.exports = {
  SPEC_README,
  collectArtifacts,
  collectValidation,
  hasSection,
  saveStatus,
  specDir,
  specsRoot,
};
