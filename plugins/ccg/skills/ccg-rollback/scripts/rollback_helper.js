#!/usr/bin/env node
"use strict";

function hasDangerousIntent(argv) {
  const text = argv.join(" ");
  return /reset\s+--hard|clean\s+-fd|push\s+--force|push\s+-f/i.test(text);
}

function plan(argv = process.argv.slice(2)) {
  if (hasDangerousIntent(argv) && !(argv.includes("--confirm") && argv.includes("--i-understand"))) {
    throw new Error("refusing destructive rollback without explicit --confirm --i-understand");
  }
  if (argv.includes("--file")) {
    const index = argv.indexOf("--file");
    const file = argv[index + 1];
    const commit = argv.find((arg) => /^[0-9a-f]{7,40}$/i.test(arg)) || "HEAD";
    if (!file) throw new Error("--file requires a path");
    return { dryRun: !argv.includes("--confirm"), commands: [`git restore --source=${commit} -- ${file}`] };
  }
  const commit = argv.includes("--last") ? "HEAD" : (argv.find((arg) => /^[0-9a-f]{7,40}$/i.test(arg)) || "HEAD");
  return { dryRun: !argv.includes("--confirm"), commands: [`git revert --no-commit ${commit}`] };
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes("--json");
  const result = plan(argv.filter((arg) => arg !== "--json"));
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.dryRun ? "rollback dry-run" : "rollback confirmed");
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

module.exports = { hasDangerousIntent, plan };
