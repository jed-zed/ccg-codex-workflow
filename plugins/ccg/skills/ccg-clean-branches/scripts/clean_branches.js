#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");

const protectedNames = new Set(["main", "master", "develop", "dev"]);
const protectedPatterns = [/^release\//, /^hotfix\//, /^prod\//];

function git(args, opts = {}) {
  const result = spawnSync("git", args, { cwd: opts.cwd || process.cwd(), encoding: "utf8" });
  if (!opts.allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
  }
  return result;
}

function parseBranches(text) {
  return text.split(/\r?\n/).map((line) => ({
    current: line.trimStart().startsWith("*"),
    name: line.replace(/^\*/, "").trim(),
  })).filter((branch) => branch.name);
}

function isProtected(branch) {
  return branch.current || protectedNames.has(branch.name) || protectedPatterns.some((pattern) => pattern.test(branch.name));
}

function candidates(cwd = process.cwd()) {
  const merged = parseBranches(git(["branch", "--merged"], { cwd }).stdout);
  return merged.filter((branch) => !isProtected(branch)).map((branch) => branch.name);
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const json = argv.includes("--json");
  const execute = argv.includes("--delete") || argv.includes("--confirm");
  const branches = candidates(cwd);
  const result = { dryRun: !execute, branches, commands: branches.map((branch) => `git branch -d ${branch}`) };
  if (execute) {
    for (const branch of branches) git(["branch", "-d", branch], { cwd });
  }
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(execute ? "deleted merged branches:" : "branch cleanup dry-run:");
    for (const command of result.commands) console.log(command);
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

module.exports = { candidates, isProtected };
