#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");

const PROTECTED_BRANCH_PATTERNS = [/^(main|master|production)$/i, /^release(?:[/-].+)?$/i];

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
  });
  if (!opts.allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
  }
  return result;
}

function getFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  return args[index + 1] || null;
}

function currentBranch(cwd = process.cwd()) {
  const result = git(["branch", "--show-current"], { cwd, allowFailure: true });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function isProtectedBranch(branchName) {
  return Boolean(branchName) && PROTECTED_BRANCH_PATTERNS.some((pattern) => pattern.test(branchName));
}

function hasDangerousForcePush(args) {
  const text = args.join(" ");
  return /push\s+--force|push\s+-f/i.test(text);
}

function hasDangerousClean(args) {
  const text = args.join(" ");
  return /clean\s+-fd/i.test(text);
}

function parseCompatibilityMode(args) {
  if (args.includes("reset") && args.includes("--hard")) return "reset";
  if (args.includes("restore")) return "restore";
  if (args.includes("revert")) return "revert";
  return null;
}

function buildResult(options) {
  return {
    dryRun: options.dryRun,
    executed: options.executed || false,
    manualOnly: options.manualOnly || false,
    blocked: options.blocked || false,
    mode: options.mode,
    target: options.target,
    branch: options.branch || null,
    protectedBranch: Boolean(options.branch && isProtectedBranch(options.branch)),
    file: options.file || null,
    commands: options.commands || [],
    reason: options.reason || null,
  };
}

function buildRevertSpec(target, depth) {
  if (depth > 1) {
    return `${target}~${depth}..${target}`;
  }
  return target;
}

function plan(argv = process.argv.slice(2), cwd = process.cwd()) {
  const args = argv.filter((arg) => arg !== "--json");
  const confirm = args.includes("--confirm");
  const understand = args.includes("--i-understand");
  const protectedBranchOk = args.includes("--protected-branch-ok");
  const file = getFlagValue(args, "--file");
  const explicitMode = getFlagValue(args, "--mode");
  const compatibilityMode = parseCompatibilityMode(args);
  const mode = explicitMode || compatibilityMode || (file ? "restore" : "revert");
  const depth = Math.max(1, Number(getFlagValue(args, "--depth") || 1));
  const branch = getFlagValue(args, "--branch") || currentBranch(cwd);
  const target =
    getFlagValue(args, "--target") ||
    args.find((arg) => /^[0-9a-f]{7,40}$/i.test(arg)) ||
    (args.includes("--last") ? "HEAD" : "HEAD");

  if (hasDangerousForcePush(args)) {
    return buildResult({
      dryRun: true,
      manualOnly: true,
      blocked: true,
      mode: "push",
      target,
      branch,
      commands: ["git push --force"],
      reason: "git push --force is always manual-only",
    });
  }

  if (hasDangerousClean(args)) {
    return buildResult({
      dryRun: true,
      manualOnly: true,
      blocked: true,
      mode: "clean",
      target,
      branch,
      commands: ["git clean -fd"],
      reason: "git clean -fd is always manual-only",
    });
  }

  if (!["revert", "restore", "reset"].includes(mode)) {
    throw new CliError(`unsupported rollback mode: ${mode}`);
  }

  if (confirm && isProtectedBranch(branch) && !protectedBranchOk) {
    throw new CliError(
      `protected branch requires --protected-branch-ok: ${branch}`,
      buildResult({
        dryRun: true,
        mode,
        target,
        branch,
        file,
        commands: [],
        reason: `protected branch requires explicit acknowledgment: ${branch}`,
      })
    );
  }

  if (mode === "reset") {
    if (!(confirm && understand)) {
      throw new CliError(
        "refusing destructive reset without explicit --confirm --i-understand",
        buildResult({
          dryRun: true,
          blocked: true,
          manualOnly: true,
          mode,
          target,
          branch,
          commands: [`git reset --hard ${target}`],
          reason: "destructive reset requires --confirm --i-understand",
        })
      );
    }
    return buildResult({
      dryRun: true,
      manualOnly: true,
      mode,
      target,
      branch,
      commands: [`git reset --hard ${target}`],
      reason: "git reset --hard remains manual-only",
    });
  }

  if (mode === "restore" && !file) {
    throw new CliError("--mode restore requires --file <path>");
  }

  if (mode === "restore") {
    const command = `git restore --source=${target} -- ${file}`;
    const result = buildResult({
      dryRun: !confirm,
      executed: false,
      mode,
      target,
      branch,
      file,
      commands: [command],
    });
    if (confirm) {
      git(["restore", `--source=${target}`, "--", file], { cwd });
      result.executed = true;
      result.dryRun = false;
    }
    return result;
  }

  const revertSpec = buildRevertSpec(target, depth);
  const command = `git revert --no-commit ${revertSpec}`;
  const result = buildResult({
    dryRun: !confirm,
    executed: false,
    mode: "revert",
    target: revertSpec,
    branch,
    commands: [command],
  });
  if (confirm) {
    git(["revert", "--no-commit", revertSpec], { cwd });
    result.executed = true;
    result.dryRun = false;
  }
  return result;
}

function formatHuman(result) {
  const lines = [result.dryRun ? "rollback dry-run" : "rollback confirmed"];
  lines.push(`mode: ${result.mode}`);
  if (result.branch) lines.push(`branch: ${result.branch}`);
  if (result.reason) lines.push(`reason: ${result.reason}`);
  for (const command of result.commands) lines.push(command);
  return lines.join("\n");
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const json = argv.includes("--json");
  const result = plan(argv, cwd);
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatHuman(result));
  if (result.blocked) process.exit(1);
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

module.exports = { currentBranch, hasDangerousClean, hasDangerousForcePush, isProtectedBranch, plan };
