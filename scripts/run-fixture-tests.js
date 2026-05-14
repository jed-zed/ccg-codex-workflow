#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const node = process.execPath;
const python = process.env.PYTHON || "python";
const powershell = process.env.POWERSHELL || (process.platform === "win32" ? "powershell" : "pwsh");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd || repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (!opts.allowFailure && result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}\n` +
        `${result.error ? result.error.message + "\n" : ""}` +
        `${result.stdout || ""}${result.stderr || ""}`
    );
  }
  return result;
}

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function initGitRepo() {
  const dir = tempDir("ccg-change-fixture-");
  run("git", ["init"], { cwd: dir });
  run("git", ["config", "user.email", "fixtures@example.test"], { cwd: dir });
  run("git", ["config", "user.name", "CCG Fixtures"], { cwd: dir });
  writeFile(path.join(dir, "src", "app.js"), "console.log('base');\n");
  run("git", ["add", "."], { cwd: dir });
  run("git", ["commit", "-m", "base"], { cwd: dir });
  return dir;
}

function parseJsonOutput(result) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Expected JSON output, got:\n${result.stdout}\n${result.stderr}`);
  }
}

const changeAnalyzer = path.join(
  repoRoot,
  "plugins",
  "ccg",
  "skills",
  "verify-change",
  "scripts",
  "change_analyzer.js"
);
const securityScanner = path.join(
  repoRoot,
  "plugins",
  "ccg",
  "skills",
  "verify-security",
  "scripts",
  "security_scanner.js"
);
const qualityChecker = path.join(
  repoRoot,
  "plugins",
  "ccg",
  "skills",
  "verify-quality",
  "scripts",
  "quality_checker.js"
);
const docGenerator = path.join(
  repoRoot,
  "plugins",
  "ccg",
  "skills",
  "gen-docs",
  "scripts",
  "doc_generator.js"
);
const geminiPreview = path.join(
  repoRoot,
  "plugins",
  "ccg",
  "skills",
  "ccg-executor",
  "scripts",
  "invoke_gemini_preview.py"
);
const pluginDoctor = path.join(repoRoot, "plugins", "ccg", "scripts", "doctor.ps1");
const syncLocalPluginCache = path.join(repoRoot, "scripts", "sync-local-plugin-cache.ps1");
const ccgPlanSkill = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-plan", "SKILL.md");

function createMinimalCcgPlugin(root, version = "9.9.9") {
  writeFile(
    path.join(root, ".codex-plugin", "plugin.json"),
    JSON.stringify({ name: "ccg", version }, null, 2)
  );
  writeFile(path.join(root, ".mcp.json"), "{}\n");
  for (const command of ["ccg", "plan", "execute", "doctor", "gemini-preview", "verify-change"]) {
    writeFile(path.join(root, "commands", `${command}.md`), `# ${command}\n`);
  }
  for (const skill of ["ccg-plan", "ccg-execute", "ccg-doctor", "ccg-gemini-preview", "verify-change"]) {
    writeFile(
      path.join(root, "skills", skill, "SKILL.md"),
      `---\nname: ${skill}\ndescription: ${skill}\n---\n`
    );
  }
  writeFile(path.join(root, "skills", "ccg-executor", "scripts", "invoke_gemini_preview.py"), "# helper\n");
  writeFile(path.join(root, "scripts", "doctor.ps1"), "# doctor\n");
}

test("verify-change working mode records numstat additions", () => {
  const dir = initGitRepo();
  writeFile(
    path.join(dir, "src", "app.js"),
    Array.from({ length: 35 }, (_, i) => `console.log(${i});`).join("\n") + "\n"
  );
  const result = run(node, [changeAnalyzer, "--mode", "working", "--json"], { cwd: dir });
  const json = parseJsonOutput(result);
  assert(json.total_additions >= 35, `expected working additions >= 35, got ${json.total_additions}`);
  assert(
    json.changes.some((change) => change.path === "src/app.js" && change.additions >= 35),
    "expected src/app.js working additions to be recorded"
  );
});

test("verify-change staged mode records cached numstat additions", () => {
  const dir = initGitRepo();
  writeFile(
    path.join(dir, "src", "app.js"),
    Array.from({ length: 36 }, (_, i) => `console.log('staged-${i}');`).join("\n") + "\n"
  );
  run("git", ["add", "src/app.js"], { cwd: dir });
  const result = run(node, [changeAnalyzer, "--mode", "staged", "--json"], { cwd: dir });
  const json = parseJsonOutput(result);
  assert(json.total_additions >= 36, `expected staged additions >= 36, got ${json.total_additions}`);
  assert(
    json.changes.some((change) => change.path === "src/app.js" && change.additions >= 36),
    "expected src/app.js staged additions to be recorded"
  );
});

test("verify-security scans env, key, and extensionless text secrets", () => {
  const dir = tempDir("ccg-security-fixture-");
  const envSecretName = "API_" + "KEY";
  const privateKeyHeader = "-----BEGIN " + "PRIVATE KEY-----";
  const privateKeyFooter = "-----END " + "PRIVATE KEY-----";
  const openSshHeader = "-----BEGIN " + "OPENSSH PRIVATE KEY-----";
  const openSshFooter = "-----END " + "OPENSSH PRIVATE KEY-----";
  writeFile(path.join(dir, ".env"), `${envSecretName}="1234567890abcdef"\n`);
  writeFile(path.join(dir, "server.pem"), `${privateKeyHeader}\nabc\n${privateKeyFooter}\n`);
  writeFile(path.join(dir, "id_rsa"), `${openSshHeader}\nabc\n${openSshFooter}\n`);
  const result = run(node, [securityScanner, dir, "--json"], { allowFailure: true });
  const json = parseJsonOutput(result);
  const foundPaths = new Set(json.findings.map((finding) => path.basename(finding.file_path)));
  assert(foundPaths.has(".env"), "expected .env secret finding");
  assert(foundPaths.has("server.pem"), "expected .pem private-key finding");
  assert(foundPaths.has("id_rsa"), "expected extensionless private-key finding");
});

test("gen-docs readme-only and design-only flags are honored", () => {
  const readmeDir = tempDir("ccg-doc-readme-");
  writeFile(path.join(readmeDir, "index.js"), "function hello() { return 'hi'; }\n");
  run(node, [docGenerator, readmeDir, "--readme-only", "--json"]);
  assert(fs.existsSync(path.join(readmeDir, "README.md")), "expected README.md to be generated");
  assert(!fs.existsSync(path.join(readmeDir, "DESIGN.md")), "did not expect DESIGN.md for --readme-only");

  const designDir = tempDir("ccg-doc-design-");
  writeFile(path.join(designDir, "index.js"), "function hello() { return 'hi'; }\n");
  run(node, [docGenerator, designDir, "--design-only", "--json"]);
  assert(fs.existsSync(path.join(designDir, "DESIGN.md")), "expected DESIGN.md to be generated");
  assert(!fs.existsSync(path.join(designDir, "README.md")), "did not expect README.md for --design-only");
});

test("verify-quality scans JSX and TSX files", () => {
  const dir = tempDir("ccg-quality-fixture-");
  writeFile(path.join(dir, "Component.tsx"), "export function Component() { return <div />; }\n");
  writeFile(path.join(dir, "Widget.jsx"), "export function Widget() { return <span />; }\n");
  const result = run(node, [qualityChecker, dir, "--json"]);
  const json = parseJsonOutput(result);
  assert(json.files_scanned === 2, `expected 2 frontend files scanned, got ${json.files_scanned}`);
});

test("Gemini snapshot excludes sensitive files", () => {
  const source = tempDir("ccg-gemini-source-");
  writeFile(path.join(source, "src", "safe.txt"), "safe\n");
  writeFile(path.join(source, ".env"), "TOKEN=secret\n");
  writeFile(path.join(source, "service-account.json"), "{\"private_key\":\"secret\"}\n");
  writeFile(path.join(source, ".aws", "credentials"), "aws_secret_access_key=secret\n");
  writeFile(path.join(source, "id_ed25519"), "-----BEGIN " + "OPENSSH PRIVATE KEY-----\nsecret\n");

  const snippet = `
import importlib.util, pathlib, sys
script = pathlib.Path(sys.argv[1])
source = pathlib.Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("gemini_preview", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class Args:
    workdir = str(source)
    direct_workdir = False
args = Args()
snapshot, temp_dir = module.prepare_gemini_workdir(args)
try:
    sensitive = [
        snapshot / ".env",
        snapshot / "service-account.json",
        snapshot / ".aws" / "credentials",
        snapshot / "id_ed25519",
    ]
    print("SAFE_EXISTS=" + str((snapshot / "src" / "safe.txt").exists()))
    print("SENSITIVE_EXISTS=" + str(any(p.exists() for p in sensitive)))
finally:
    temp_dir.cleanup()
`;
  const result = run(python, ["-c", snippet, geminiPreview, source]);
  assert(result.stdout.includes("SAFE_EXISTS=True"), `expected safe file in snapshot:\n${result.stdout}`);
  assert(result.stdout.includes("SENSITIVE_EXISTS=False"), `expected sensitive files excluded:\n${result.stdout}`);
});

test("Gemini preview helper default model supports environment and CLI overrides", () => {
  const snippet = `
import importlib.util, os, pathlib, sys
script = pathlib.Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("gemini_preview", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
os.environ.pop("GEMINI_MODEL", None)
sys.argv = ["tool"]
print("DEFAULT=" + module.parse_args().model)
os.environ["GEMINI_MODEL"] = "env-model"
sys.argv = ["tool"]
print("ENV=" + module.parse_args().model)
sys.argv = ["tool", "--model", "cli-model"]
print("CLI=" + module.parse_args().model)
`;
  const result = run(python, ["-c", snippet, geminiPreview]);
  assert(result.stdout.includes("DEFAULT=gemini-3.1-pro-preview"), `expected upgraded default:\n${result.stdout}`);
  assert(result.stdout.includes("ENV=env-model"), `expected GEMINI_MODEL override:\n${result.stdout}`);
  assert(result.stdout.includes("CLI=cli-model"), `expected --model override:\n${result.stdout}`);
});

test("sync-local-plugin-cache WhatIf does not create cache files", () => {
  const codexHome = tempDir("ccg-sync-codex-");
  const pluginRoot = tempDir("ccg-sync-plugin-");
  writeFile(
    path.join(pluginRoot, ".codex-plugin", "plugin.json"),
    JSON.stringify({ name: "ccg", version: "9.9.9" }, null, 2)
  );
  writeFile(path.join(pluginRoot, "skills", "sample", "SKILL.md"), "---\nname: sample\ndescription: sample\n---\n");

  run(powershell, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    syncLocalPluginCache,
    "-CodexHome",
    codexHome,
    "-PluginRoot",
    pluginRoot,
    "-MarketplaceName",
    "local-market",
    "-PluginName",
    "ccg",
    "-WhatIf",
  ]);

  const target = path.join(codexHome, "plugins", "cache", "local-market", "ccg", "9.9.9");
  assert(!fs.existsSync(target), "expected -WhatIf to leave cache target absent");
});

test("sync-local-plugin-cache refreshes only the versioned plugin cache", () => {
  const codexHome = tempDir("ccg-sync-codex-");
  const pluginRoot = tempDir("ccg-sync-plugin-");
  writeFile(
    path.join(pluginRoot, ".codex-plugin", "plugin.json"),
    JSON.stringify({ name: "ccg", version: "9.9.9" }, null, 2)
  );
  writeFile(path.join(pluginRoot, "commands", "ccg.md"), "# command\n");
  writeFile(path.join(pluginRoot, "skills", "sample", "SKILL.md"), "---\nname: sample\ndescription: sample\n---\n");

  const target = path.join(codexHome, "plugins", "cache", "local-market", "ccg", "9.9.9");
  writeFile(path.join(target, "stale.txt"), "stale\n");

  run(powershell, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    syncLocalPluginCache,
    "-CodexHome",
    codexHome,
    "-PluginRoot",
    pluginRoot,
    "-MarketplaceName",
    "local-market",
    "-PluginName",
    "ccg",
  ]);

  assert(fs.existsSync(path.join(target, ".codex-plugin", "plugin.json")), "expected manifest copied to cache");
  assert(fs.existsSync(path.join(target, "skills", "sample", "SKILL.md")), "expected skill copied to cache");
  assert(!fs.existsSync(path.join(target, "stale.txt")), "expected stale cache file removed during refresh");
});

test("sync-local-plugin-cache rejects unsafe cache path segments", () => {
  const codexHome = tempDir("ccg-sync-codex-");
  const pluginRoot = tempDir("ccg-sync-plugin-");
  writeFile(
    path.join(pluginRoot, ".codex-plugin", "plugin.json"),
    JSON.stringify({ name: "ccg", version: "9.9.9" }, null, 2)
  );

  const result = run(
    powershell,
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      syncLocalPluginCache,
      "-CodexHome",
      codexHome,
      "-PluginRoot",
      pluginRoot,
      "-MarketplaceName",
      "..\\outside",
      "-PluginName",
      "ccg",
    ],
    { allowFailure: true }
  );

  assert(result.status !== 0, "expected unsafe marketplace segment to fail");
});

test("ccg-plan skill requires a Gemini response gate", () => {
  const text = fs.readFileSync(ccgPlanSkill, "utf8");
  assert(text.includes("Gemini gate"), "expected Gemini gate section");
  assert(text.includes("CCG_GEMINI_RESPONSE_FILE"), "expected response file gate");
  assert(text.includes("do not write or present a final plan"), "expected no fake dual-model plan rule");
  assert(text.includes("gemini-3.1-pro-preview"), "expected upgraded default Gemini model");
});

test("doctor warns when source plugin and cache digests differ", () => {
  const codexHome = tempDir("ccg-doctor-codex-");
  const pluginRoot = tempDir("ccg-doctor-plugin-");
  createMinimalCcgPlugin(pluginRoot);
  const cacheRoot = path.join(codexHome, "plugins", "cache", "ccg-codex-workflow", "ccg", "9.9.9");
  fs.cpSync(pluginRoot, cacheRoot, { recursive: true });
  writeFile(path.join(cacheRoot, "commands", "plan.md"), "# stale plan\n");

  const result = run(powershell, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    pluginDoctor,
    "-CodexHome",
    codexHome,
    "-PluginRoot",
    pluginRoot,
    "-Json",
  ], { allowFailure: true });
  const json = parseJsonOutput(result);
  const freshness = json.checks.find((check) => check.name === "plugin cache freshness");
  assert(freshness && freshness.status === "WARN", "expected stale cache freshness warning");
});

test("doctor fails when cached key files are missing", () => {
  const codexHome = tempDir("ccg-doctor-codex-");
  const pluginRoot = tempDir("ccg-doctor-plugin-");
  createMinimalCcgPlugin(pluginRoot);
  const cacheRoot = path.join(codexHome, "plugins", "cache", "ccg-codex-workflow", "ccg", "9.9.9");
  fs.cpSync(pluginRoot, cacheRoot, { recursive: true });
  fs.rmSync(path.join(cacheRoot, "commands", "plan.md"), { force: true });

  const result = run(
    powershell,
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      pluginDoctor,
      "-CodexHome",
      codexHome,
      "-PluginRoot",
      pluginRoot,
      "-Json",
    ],
    { allowFailure: true }
  );
  assert(result.status !== 0, "expected missing cached key file to fail doctor");
  const json = parseJsonOutput(result);
  assert(
    json.checks.some((check) => check.name === "cached key file: commands\\plan.md" && check.status === "FAIL"),
    "expected cached commands\\plan.md failure"
  );
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures++;
    console.error(`not ok - ${name}`);
    console.error(error && error.stack ? error.stack : String(error));
  }
}

if (failures) {
  console.error(`${failures} fixture test(s) failed`);
  process.exit(1);
}

console.log(`${tests.length} fixture test(s) passed`);
