#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const node = process.execPath;

const DEFAULT_GATE_SCRIPTS = {
  "verify-change": path.join(__dirname, "..", "..", "verify-change", "scripts", "change_analyzer.js"),
  "verify-quality": path.join(__dirname, "..", "..", "verify-quality", "scripts", "quality_checker.js"),
  "verify-security": path.join(__dirname, "..", "..", "verify-security", "scripts", "security_scanner.js"),
};

const GATE_OVERRIDE_ENV = {
  "verify-change": "CCG_VERIFY_CHANGE_SCRIPT",
  "verify-quality": "CCG_VERIFY_QUALITY_SCRIPT",
  "verify-security": "CCG_VERIFY_SECURITY_SCRIPT",
};

class CliError extends Error {
  constructor(message, result) {
    super(message);
    this.result = result || null;
  }
}

function git(args, opts = {}) {
  const result = spawnSync("git", args, {
    cwd: opts.cwd || process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (!opts.allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
  }
  return result;
}

function lines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(items) {
  return [...new Set(items)];
}

function getFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  return args[index + 1] || null;
}

function isSecuritySensitive(file) {
  return /(auth|security|secret|token|permission|upload|network|shell|exec|\.env|key|credential)/i.test(file);
}

function conventionalCommitMessage(changed) {
  const firstName = changed[0] ? path.basename(changed[0]).replace(/\.[^.]+$/, "") : "workflow";
  return changed.length === 1 ? `chore: update ${firstName}` : "chore: update ccg workflow";
}

function resolveGateScript(name) {
  const override = process.env[GATE_OVERRIDE_ENV[name]];
  return override || DEFAULT_GATE_SCRIPTS[name];
}

function runNodeScript(scriptPath, args, opts = {}) {
  return spawnSync(node, [scriptPath, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...(opts.env || {}) },
  });
}

function parseJsonOutput(name, result) {
  try {
    return JSON.parse(result.stdout || "{}");
  } catch (error) {
    throw new Error(`${name} did not produce valid JSON:\n${result.stdout}\n${result.stderr}`);
  }
}

function gateStatusFromJson(name, json, exitStatus) {
  if (name === "verify-change") {
    const warningCount = Array.isArray(json.issues) ? json.issues.length : 0;
    return {
      passed: exitStatus === 0 && json.passed !== false,
      warnings: warningCount,
      summary: warningCount ? `${warningCount} issue(s)` : "clean",
      reason: exitStatus === 0 ? null : "change analyzer reported blocking issues",
    };
  }
  if (name === "verify-quality") {
    const warningCount = Number(json.warning_count || 0);
    const errorCount = Number(json.error_count || 0);
    return {
      passed: exitStatus === 0 && json.passed !== false,
      warnings: warningCount,
      summary: `errors=${errorCount}, warnings=${warningCount}`,
      reason: exitStatus === 0 ? null : "quality checker reported blocking issues",
    };
  }

  const counts = json.counts || {};
  const warningCount = Number(counts.medium || 0) + Number(counts.low || 0) + Number(counts.info || 0);
  const highCount = Number(counts.high || 0) + Number(counts.critical || 0);
  return {
    passed: exitStatus === 0 && json.passed !== false,
    warnings: warningCount,
    summary: `critical=${counts.critical || 0}, high=${counts.high || 0}, medium=${counts.medium || 0}, low=${counts.low || 0}`,
    reason: highCount > 0 ? "security scanner reported high severity findings" : exitStatus === 0 ? null : "security scanner failed",
  };
}

function runGate(name, targets, cwd = process.cwd(), options = {}) {
  const scriptPath = resolveGateScript(name);
  if (!fs.existsSync(scriptPath)) {
    return {
      ran: false,
      passed: false,
      warnings: 0,
      command: null,
      targets,
      reason: `missing gate script: ${scriptPath}`,
      details: [],
    };
  }

  if (!targets.length && name !== "verify-change") {
    return {
      ran: false,
      passed: true,
      warnings: 0,
      command: null,
      targets: [],
      reason: "no existing changed paths to scan",
      details: [],
    };
  }

  if (name === "verify-change") {
    const args = options.changeMode === "staged" ? ["--mode", "staged", "--json"] : ["--json"];
    const raw = runNodeScript(scriptPath, args, { cwd });
    const json = parseJsonOutput(name, raw);
    const status = gateStatusFromJson(name, json, raw.status);
    return {
      ran: true,
      passed: status.passed,
      warnings: status.warnings,
      command: `node ${scriptPath} ${args.join(" ")}`,
      targets: ["."],
      reason: status.reason,
      details: [{ target: ".", exit_status: raw.status, json, summary: status.summary }],
    };
  }

  const details = [];
  let passed = true;
  let warnings = 0;
  const commands = [];
  let firstReason = null;

  for (const target of targets) {
    const raw = runNodeScript(scriptPath, [target, "--json"], { cwd });
    const json = parseJsonOutput(name, raw);
    const status = gateStatusFromJson(name, json, raw.status);
    details.push({ target, exit_status: raw.status, json, summary: status.summary });
    commands.push(`node ${scriptPath} ${target} --json`);
    warnings += status.warnings;
    if (!status.passed) {
      passed = false;
      if (!firstReason) firstReason = `${status.reason} (${target})`;
    }
  }

  return {
    ran: true,
    passed,
    warnings,
    command: commands.length === 1 ? commands[0] : commands,
    targets,
    reason: firstReason,
    details,
  };
}

function analyze(cwd = process.cwd()) {
  const status = git(["status", "--short"], { cwd, allowFailure: true });
  if (status.status !== 0) throw new Error("not a git repository or git status failed");
  const staged = lines(git(["diff", "--cached", "--name-only"], { cwd }).stdout);
  const unstaged = lines(git(["diff", "--name-only"], { cwd }).stdout);
  const untracked = lines(status.stdout)
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3));
  const changed = unique([...staged, ...unstaged, ...untracked]);
  const securitySensitive = changed.some((file) => isSecuritySensitive(file));
  const scanTargets = unique(
    changed
      .map((file) => file.replace(/\\/g, "/"))
      .filter((file) => fs.existsSync(path.resolve(cwd, file)))
  );
  const securityTargets = scanTargets.filter((file) => isSecuritySensitive(file));
  const message = conventionalCommitMessage(changed);
  return {
    status: status.stdout,
    staged,
    unstaged,
    untracked,
    changed,
    scanTargets,
    securitySensitive,
    securityTargets,
    recommendedGates: [
      "/ccg:verify-change",
      changed.length ? `/ccg:verify-quality ${changed[0]}` : "/ccg:verify-quality <changed-path>",
      ...(securitySensitive
        ? [changed.length ? `/ccg:verify-security ${changed[0]}` : "/ccg:verify-security <changed-path>"]
        : []),
    ],
    message,
    command: `git commit -m "${message.replace(/"/g, '\\"')}"`,
  };
}

function scopeFields(result, scope, cwd = process.cwd()) {
  const gatedChanged = scope === "staged" ? result.staged : result.changed;
  const gatedScanTargets = unique(
    gatedChanged
      .map((file) => file.replace(/\\/g, "/"))
      .filter((file) => fs.existsSync(path.resolve(cwd, file)))
  );
  const gatedSecurityTargets = gatedScanTargets.filter((file) => isSecuritySensitive(file));
  const scopeWarnings = [];
  if (scope === "staged") {
    if (result.unstaged.length) scopeWarnings.push(`unstaged changes not gated: ${result.unstaged.join(", ")}`);
    if (result.untracked.length) scopeWarnings.push(`untracked files not gated: ${result.untracked.join(", ")}`);
  }
  return {
    scope,
    gatedChanged,
    gatedScanTargets,
    gatedSecuritySensitive: gatedChanged.some((file) => isSecuritySensitive(file)),
    gatedSecurityTargets,
    scope_warnings: scopeWarnings,
  };
}

function runGates(result, cwd = process.cwd()) {
  const changeMode = result.scope === "staged" ? "staged" : "working";
  const gates = {
    "verify-change": runGate("verify-change", ["."], cwd, { changeMode }),
    "verify-quality": runGate("verify-quality", result.gatedScanTargets, cwd),
    "verify-security": result.gatedSecuritySensitive
      ? runGate("verify-security", result.gatedSecurityTargets, cwd)
      : {
          ran: false,
          passed: true,
          warnings: 0,
          command: null,
          targets: [],
          reason: "no security-sensitive paths detected",
          details: [],
        },
  };
  const gateFailures = Object.entries(gates)
    .filter(([, gate]) => gate.ran && !gate.passed)
    .map(([name, gate]) => `${name}: ${gate.reason || "failed"}`);
  const gateWarnings = Object.entries(gates)
    .filter(([, gate]) => gate.warnings > 0)
    .map(([name, gate]) => `${name}: ${gate.warnings} warning(s)`);
  return {
    gates,
    gates_passed: gateFailures.length === 0 && gateWarnings.length === 0,
    gate_failures: gateFailures,
    gate_warnings: gateWarnings,
  };
}

function formatHuman(result) {
  const lines = [result.status || "clean", `message: ${result.message}`, `command: ${result.command}`];
  lines.push(`scope: ${result.scope}`);
  lines.push(`canCommit: ${result.canCommit}`);
  lines.push(`executed: ${result.executed}`);
  if (result.securitySensitive) lines.push("security-sensitive paths detected.");
  if (result.scope_warnings && result.scope_warnings.length) {
    lines.push("scope_warnings:");
    for (const warning of result.scope_warnings) lines.push(`- ${warning}`);
  }
  if (result.gate_failures && result.gate_failures.length) {
    lines.push("gate_failures:");
    for (const failure of result.gate_failures) lines.push(`- ${failure}`);
  }
  if (result.gate_warnings && result.gate_warnings.length) {
    lines.push("gate_warnings:");
    for (const warning of result.gate_warnings) lines.push(`- ${warning}`);
  }
  return lines.join("\n");
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const json = argv.includes("--json");
  const execute = argv.includes("--execute") || argv.includes("--confirm");
  const checkGates = argv.includes("--check-gates") || execute;
  const requireStaged = argv.includes("--require-staged");
  const allowGateWarnings = argv.includes("--allow-gate-warnings");
  const scope = getFlagValue(argv, "--scope") || (execute ? "staged" : "all");
  if (!["staged", "all"].includes(scope)) {
    throw new CliError(`unsupported commit scope: ${scope}`);
  }

  const result = analyze(cwd);
  Object.assign(result, scopeFields(result, scope, cwd));
  result.executed = false;
  result.gates = {};
  result.gates_passed = false;
  result.gate_failures = [];
  result.gate_warnings = [];
  result.canCommit = result.staged.length > 0;

  if (checkGates) {
    Object.assign(result, runGates(result, cwd));
    const hasGateFailures = result.gate_failures.length > 0;
    const hasOnlyGateWarnings = result.gate_warnings.length > 0 && !hasGateFailures;
    result.canCommit =
      result.staged.length > 0 &&
      (result.gates_passed || (allowGateWarnings && hasOnlyGateWarnings));
  }

  if (requireStaged && !result.staged.length) {
    throw new CliError("refusing to continue: no staged files", result);
  }

  if (execute) {
    if (!result.staged.length) {
      throw new CliError("refusing to commit: no staged files", result);
    }
    if (!result.canCommit) {
      throw new CliError("refusing to commit: gate requirements not satisfied", result);
    }
    git(["commit", "-m", result.message], { cwd });
    result.executed = true;
  }

  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatHuman(result));
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

module.exports = { analyze, runGates };
