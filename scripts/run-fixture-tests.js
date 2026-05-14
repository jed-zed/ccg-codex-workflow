#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const node = process.execPath;
const python = process.env.PYTHON || "python";

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
