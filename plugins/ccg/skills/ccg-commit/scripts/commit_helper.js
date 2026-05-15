#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

function git(args, opts = {}) {
  const result = spawnSync("git", args, { cwd: opts.cwd || process.cwd(), encoding: "utf8" });
  if (!opts.allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
  }
  return result;
}

function lines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function analyze(cwd = process.cwd()) {
  const status = git(["status", "--short"], { cwd, allowFailure: true });
  if (status.status !== 0) throw new Error("not a git repository or git status failed");
  const staged = lines(git(["diff", "--cached", "--name-only"], { cwd }).stdout);
  const unstaged = lines(git(["diff", "--name-only"], { cwd }).stdout);
  const untracked = lines(status.stdout).filter((line) => line.startsWith("?? ")).map((line) => line.slice(3));
  const changed = [...new Set([...staged, ...unstaged, ...untracked])];
  const securitySensitive = changed.some((file) =>
    /(auth|security|secret|token|permission|upload|network|shell|exec|\.env|key|credential)/i.test(file)
  );
  const firstName = changed[0] ? path.basename(changed[0]).replace(/\.[^.]+$/, "") : "workflow";
  const message = changed.length === 1 ? `chore: update ${firstName}` : "chore: update ccg workflow";
  return {
    status: status.stdout,
    staged,
    unstaged,
    untracked,
    changed,
    securitySensitive,
    recommendedGates: [
      "/ccg:verify-change",
      changed.length ? `/ccg:verify-quality ${changed[0]}` : "/ccg:verify-quality <changed-path>",
      ...(securitySensitive ? [changed.length ? `/ccg:verify-security ${changed[0]}` : "/ccg:verify-security <changed-path>"] : []),
    ],
    message,
    command: `git commit -m "${message.replace(/"/g, '\\"')}"`,
  };
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const json = argv.includes("--json");
  const execute = argv.includes("--execute") || argv.includes("--confirm");
  const result = analyze(cwd);
  if (execute) {
    if (!result.staged.length) throw new Error("refusing to commit: no staged files");
    git(["commit", "-m", result.message], { cwd });
    result.executed = true;
  } else {
    result.executed = false;
  }
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.status || "clean");
    console.log(`message: ${result.message}`);
    console.log(`command: ${result.command}`);
    console.log(`executed: ${result.executed}`);
    if (result.securitySensitive) console.log("security-sensitive paths detected; run verify-security.");
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { analyze };
