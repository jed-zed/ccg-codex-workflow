#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const SECTION_ALIASES = {
  workers: ["Workers", "工作分工"],
  mergeStrategy: ["Merge Strategy", "合并策略"],
  verificationStrategy: ["Verification Strategy", "验证策略"],
  conflictRisks: ["Conflict Risks", "冲突风险"],
};

const CONFLICT_ACTION_PATTERNS = [
  /\breconcile\b/i,
  /\bresolve\b/i,
  /\bowner\b/i,
  /\bmerge\b/i,
  /\bconflict\b/i,
  /负责/,
  /协调/,
  /解决/,
  /收敛/,
  /合并/,
  /冲突/,
];

class CliError extends Error {
  constructor(message, result) {
    super(message);
    this.result = result || null;
  }
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(text) {
  return text.replace(/\r\n/g, "\n");
}

function normalizeHeading(text) {
  return text.trim().toLowerCase();
}

function parseSections(markdown) {
  const text = normalizeText(markdown);
  const lines = text.split("\n");
  const sections = [];
  let current = { heading: "__preamble__", lines: [] };
  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      sections.push(current);
      current = { heading: headingMatch[2].trim(), lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  sections.push(current);
  return sections;
}

function findSection(markdown, aliases) {
  const sections = parseSections(markdown);
  const aliasPatterns = aliases.map((alias) => new RegExp(`^${escapeRegex(alias)}$`, "i"));
  const match = sections.find((section) => aliasPatterns.some((pattern) => pattern.test(section.heading)));
  return match ? match.lines.join("\n").trim() : "";
}

function splitFiles(cell) {
  return cell
    .split(/<br\s*\/?>|,|;|\r?\n/g)
    .map((item) => item.trim().replace(/^`|`$/g, ""))
    .map((item) => item.replace(/\\/g, "/"))
    .map((item) => item.replace(/^\.\//, ""))
    .filter(Boolean);
}

function parseTableRow(line) {
  const cells = line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell, index, items) => !(index === 0 && cell === "") && !(index === items.length - 1 && cell === ""));
  return cells;
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function parseWorkers(markdown) {
  const section = findSection(markdown, SECTION_ALIASES.workers);
  if (!section) return [];
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith("|"));
  if (lines.length < 2) return [];
  const rows = lines.map(parseTableRow);
  const header = rows[0];
  if (header.length < 4) return [];

  const workers = [];
  for (const row of rows.slice(1)) {
    if (row.length < 4 || isSeparatorRow(row)) continue;
    workers.push({
      name: row[0],
      scope: row[1],
      files: splitFiles(row[2]),
      constraints: row[3],
    });
  }
  return workers.filter((worker) => worker.name);
}

function findConflicts(workers) {
  const ownership = new Map();
  for (const worker of workers) {
    for (const file of worker.files) {
      if (!ownership.has(file)) ownership.set(file, new Set());
      ownership.get(file).add(worker.name);
    }
  }
  return [...ownership.entries()]
    .filter(([, owners]) => owners.size > 1)
    .map(([file, owners]) => ({
      file,
      owners: [...owners].sort(),
    }));
}

function mergeStrategyCoversConflict(conflict, mergeStrategyText) {
  if (!mergeStrategyText.trim()) return false;
  const mentionsFile = mergeStrategyText.includes(conflict.file);
  const mentionsOwners = conflict.owners.every((owner) => mergeStrategyText.includes(owner));
  const hasAction = CONFLICT_ACTION_PATTERNS.some((pattern) => pattern.test(mergeStrategyText));
  return hasAction && (mentionsFile || mentionsOwners);
}

function extractVerificationCommands(sectionText) {
  return sectionText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("```"))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) =>
      /^(?:\/ccg:|node\b|python\b|powershell\b|pwsh\b|git\b)/i.test(line) || line.includes("--")
    );
}

function statusPathForPlan(planPath) {
  const normalized = path.resolve(planPath);
  if (path.basename(normalized).toLowerCase() !== "plan.md") return null;
  return path.join(path.dirname(normalized), "status.json");
}

function writeStatus(planPath, result) {
  const statusPath = statusPathForPlan(planPath);
  if (!statusPath) return null;
  const task = path.basename(path.dirname(path.resolve(planPath)));
  const status = {
    task,
    workers: Object.fromEntries(
      result.workers.map((worker) => [
        worker.name,
        {
          status: "planned",
          files: worker.files,
        },
      ])
    ),
    conflicts: result.same_file_conflicts,
    verification: {
      required: result.has_verification_strategy,
      commands: extractVerificationCommands(result.verification_strategy_text),
    },
  };
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2) + "\n", "utf8");
  return statusPath;
}

function validatePlan(planPath, options = {}) {
  if (!planPath) throw new CliError("plan path is required");
  if (!fs.existsSync(planPath)) throw new CliError(`plan does not exist: ${planPath}`);
  const markdown = fs.readFileSync(planPath, "utf8");
  const workers = parseWorkers(markdown);
  const mergeStrategyText = findSection(markdown, SECTION_ALIASES.mergeStrategy);
  const verificationStrategyText = findSection(markdown, SECTION_ALIASES.verificationStrategy);
  const conflictRisksText = findSection(markdown, SECTION_ALIASES.conflictRisks);
  const sameFileConflicts = findConflicts(workers);

  const blockingReasons = [];
  if (!workers.length) blockingReasons.push("workers table is missing or empty");
  if (!mergeStrategyText) blockingReasons.push("missing Merge Strategy section");
  if (!verificationStrategyText) blockingReasons.push("missing Verification Strategy section");
  if (!conflictRisksText) blockingReasons.push("missing Conflict Risks section");

  for (const conflict of sameFileConflicts) {
    if (!mergeStrategyCoversConflict(conflict, mergeStrategyText)) {
      blockingReasons.push(`same file conflict without explicit merge strategy: ${conflict.file}`);
    }
  }

  const result = {
    plan_path: path.resolve(planPath),
    workers,
    same_file_conflicts: sameFileConflicts,
    has_merge_strategy: Boolean(mergeStrategyText),
    has_verification_strategy: Boolean(verificationStrategyText),
    has_conflict_risks: Boolean(conflictRisksText),
    can_execute: blockingReasons.length === 0,
    blocking_reasons: blockingReasons,
    merge_strategy_text: mergeStrategyText,
    verification_strategy_text: verificationStrategyText,
    conflict_risks_text: conflictRisksText,
  };

  result.status_path = options.writeStatus === false ? null : writeStatus(planPath, result);
  result.status_written = Boolean(result.status_path);
  return result;
}

function summarizePlan(planPath, options = {}) {
  const result = validatePlan(planPath, { writeStatus: Boolean(options.writeStatus) });
  return {
    plan_path: result.plan_path,
    worker_count: result.workers.length,
    workers: result.workers,
    files: [...new Set(result.workers.flatMap((worker) => worker.files))].sort(),
    same_file_conflicts: result.same_file_conflicts,
    has_merge_strategy: result.has_merge_strategy,
    has_verification_strategy: result.has_verification_strategy,
    has_conflict_risks: result.has_conflict_risks,
    can_execute: result.can_execute,
    status_path: result.status_path,
    status_written: result.status_written,
  };
}

function conflictsOnly(planPath, options = {}) {
  const result = validatePlan(planPath, { writeStatus: Boolean(options.writeStatus) });
  return {
    plan_path: result.plan_path,
    same_file_conflicts: result.same_file_conflicts,
    merge_strategy_text: result.merge_strategy_text,
    blocking_reasons: result.blocking_reasons.filter((reason) => reason.includes("same file conflict")),
    can_execute: result.can_execute,
    status_path: result.status_path,
    status_written: result.status_written,
  };
}

function formatHuman(result) {
  const lines = [`plan: ${result.plan_path}`];
  if (typeof result.can_execute === "boolean") lines.push(`can_execute: ${result.can_execute}`);
  if (result.worker_count != null) lines.push(`workers: ${result.worker_count}`);
  if (result.same_file_conflicts) lines.push(`same_file_conflicts: ${result.same_file_conflicts.length}`);
  if (result.blocking_reasons && result.blocking_reasons.length) {
    lines.push("blocking_reasons:");
    for (const reason of result.blocking_reasons) lines.push(`- ${reason}`);
  }
  return lines.join("\n");
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes("--json");
  const args = argv.filter((arg) => arg !== "--json");
  const command = args.shift();
  const planPath = args.shift();
  if (!command) {
    throw new CliError(
      "usage: team_plan_checker.js <validate|summarize|conflicts> <plan.md> [--json] [--write-status|--no-write-status]"
    );
  }
  const writeStatusFlag = args.includes("--write-status");
  const noWriteStatusFlag = args.includes("--no-write-status");
  const shouldWriteStatus = writeStatusFlag || (command === "validate" && !noWriteStatusFlag);

  let result;
  if (command === "validate") result = validatePlan(planPath, { writeStatus: shouldWriteStatus });
  else if (command === "summarize") result = summarizePlan(planPath, { writeStatus: shouldWriteStatus });
  else if (command === "conflicts") result = conflictsOnly(planPath, { writeStatus: shouldWriteStatus });
  else throw new CliError(`unknown command: ${command}`);

  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatHuman(result));

  if (command === "validate" && !result.can_execute) process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const json = process.argv.slice(2).includes("--json");
    if (json && error && error.result) console.log(JSON.stringify(error.result, null, 2));
    else if (json) console.log(JSON.stringify({ error: error.message }, null, 2));
    else console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  conflictsOnly,
  parseWorkers,
  summarizePlan,
  validatePlan,
  writeStatus,
};
