#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function git(args, opts = {}) {
  const result = spawnSync("git", args, { cwd: opts.cwd || process.cwd(), encoding: "utf8" });
  if (!opts.allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
  }
  return result;
}

function ensureSafeRemove(target, cwd = process.cwd()) {
  const resolved = path.resolve(cwd, target);
  const current = path.resolve(cwd);
  if (resolved === current) throw new Error("refusing to remove the current directory");
  if (!fs.existsSync(resolved)) throw new Error(`worktree path does not exist: ${resolved}`);
  const status = git(["status", "--porcelain"], { cwd: resolved, allowFailure: true });
  if (status.status === 0 && status.stdout.trim()) throw new Error("refusing to remove a worktree with uncommitted changes");
  return resolved;
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const command = argv[0] || "list";
  const json = argv.includes("--json");
  let result;
  if (command === "list") {
    result = { command, output: git(["worktree", "list"], { cwd }).stdout };
  } else if (command === "add") {
    const branch = argv[1];
    if (!branch) throw new Error("worktree add requires a branch");
    result = { command, dryRun: !argv.includes("--confirm"), suggested: `git worktree add ../${branch} ${branch}` };
    if (!result.dryRun) git(["worktree", "add", `../${branch}`, branch], { cwd });
  } else if (command === "remove") {
    const target = argv[1];
    if (!target) throw new Error("worktree remove requires a path");
    const resolved = ensureSafeRemove(target, cwd);
    result = { command, dryRun: !argv.includes("--confirm"), target: resolved, suggested: `git worktree remove ${resolved}` };
    if (!result.dryRun) git(["worktree", "remove", resolved], { cwd });
  } else {
    throw new Error(`unknown worktree command: ${command}`);
  }
  if (json) console.log(JSON.stringify(result, null, 2));
  else if (result.output) console.log(result.output);
  else console.log(result.suggested);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { ensureSafeRemove };
