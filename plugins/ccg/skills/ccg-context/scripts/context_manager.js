#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function contextRoot(cwd = process.cwd()) {
  return path.join(cwd, ".codex", "ccg", "context");
}

function ensureContext(cwd = process.cwd()) {
  const root = contextRoot(cwd);
  const events = path.join(root, "events");
  ensureDir(events);
  const history = path.join(root, "history.md");
  const summary = path.join(root, "current-summary.md");
  if (!fs.existsSync(history)) fs.writeFileSync(history, "# CCG Context History\n", "utf8");
  if (!fs.existsSync(summary)) fs.writeFileSync(summary, "# Current CCG Summary\n\nNo summary yet.\n", "utf8");
  return { root, events, history, summary };
}

function eventName(timestamp) {
  return timestamp.replace(/[:.]/g, "-") + ".md";
}

function appendLog(note, cwd = process.cwd()) {
  if (!note.trim()) throw new Error("context log requires a note");
  const ctx = ensureContext(cwd);
  const timestamp = new Date().toISOString();
  const entry = `\n## ${timestamp}\n\n${note.trim()}\n`;
  fs.appendFileSync(ctx.history, entry, "utf8");
  fs.writeFileSync(path.join(ctx.events, eventName(timestamp)), `# ${timestamp}\n\n${note.trim()}\n`, "utf8");
  return { timestamp, history: ctx.history };
}

function summarize(cwd = process.cwd()) {
  const ctx = ensureContext(cwd);
  const history = fs.readFileSync(ctx.history, "utf8");
  const lines = history.trim().split(/\r?\n/).slice(-80).join("\n");
  const content = `# Current CCG Summary\n\nGenerated: ${new Date().toISOString()}\n\n${lines}\n`;
  fs.writeFileSync(ctx.summary, content, "utf8");
  return { summary: ctx.summary, history: ctx.history };
}

function clearContext({ confirm = false } = {}, cwd = process.cwd()) {
  const ctx = ensureContext(cwd);
  const targets = [ctx.summary, ...fs.readdirSync(ctx.events).map((name) => path.join(ctx.events, name))];
  if (!confirm) return { dryRun: true, targets };
  for (const target of targets) {
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
  }
  fs.writeFileSync(ctx.summary, "# Current CCG Summary\n\nCleared. Raw history preserved.\n", "utf8");
  return { dryRun: false, targets };
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const command = argv[0] || "history";
  if (command === "init") {
    const ctx = ensureContext(cwd);
    console.log(`CCG context initialized: ${ctx.root}`);
    return;
  }
  if (command === "log") {
    const result = appendLog(argv.slice(1).join(" "), cwd);
    console.log(`CCG context logged: ${result.timestamp}`);
    return;
  }
  if (command === "summarize") {
    const result = summarize(cwd);
    console.log(`CCG context summary written: ${result.summary}`);
    return;
  }
  if (command === "history") {
    const ctx = ensureContext(cwd);
    console.log(fs.readFileSync(ctx.history, "utf8"));
    return;
  }
  if (command === "clear") {
    const result = clearContext({ confirm: argv.includes("--confirm") }, cwd);
    if (result.dryRun) {
      console.log("CCG context clear dry-run:");
      for (const target of result.targets) console.log(target);
    } else {
      console.log("CCG context derived files cleared; raw history preserved.");
    }
    return;
  }
  throw new Error(`unknown context command: ${command}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { appendLog, clearContext, contextRoot, ensureContext, summarize };
