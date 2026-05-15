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

function createDirectoryLink(linkPath, targetPath) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  if (process.platform === "win32") {
    const result = run("cmd", ["/c", "mklink", "/J", linkPath, targetPath], { allowFailure: true });
    return result.status === 0;
  }
  try {
    fs.symlinkSync(targetPath, linkPath, "dir");
    return true;
  } catch {
    return false;
  }
}

function createFakeGemini(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  if (process.platform === "win32") {
    const scriptPath = path.join(binDir, "gemini.cmd");
    fs.writeFileSync(
      scriptPath,
      [
        "@echo off",
        "set FOUND_SKIP_TRUST=0",
        ":loop",
        "if \"%~1\"==\"\" goto done",
        "if \"%~1\"==\"--skip-trust\" set FOUND_SKIP_TRUST=1",
        "shift",
        "goto loop",
        ":done",
        "if \"%FOUND_SKIP_TRUST%\"==\"1\" (",
        "  echo CCG_DOCTOR_MODEL_OK %*",
        "  exit /b 0",
        ")",
        "echo missing --skip-trust 1>&2",
        "exit /b 3",
        "",
      ].join("\r\n"),
      "utf8"
    );
    return scriptPath;
  }
  const scriptPath = path.join(binDir, "gemini");
  fs.writeFileSync(
    scriptPath,
    "#!/bin/sh\n" +
      "found=0\n" +
      "for arg in \"$@\"; do [ \"$arg\" = \"--skip-trust\" ] && found=1; done\n" +
      "if [ \"$found\" = \"1\" ]; then echo CCG_DOCTOR_MODEL_OK \"$@\"; exit 0; fi\n" +
      "echo missing --skip-trust >&2\n" +
      "exit 3\n",
    "utf8"
  );
  fs.chmodSync(scriptPath, 0o755);
  return scriptPath;
}

function createFakeGeminiWithoutMarker(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  if (process.platform === "win32") {
    const scriptPath = path.join(binDir, "gemini.cmd");
    fs.writeFileSync(scriptPath, "@echo off\r\necho model command exited zero\r\nexit /b 0\r\n", "utf8");
    return scriptPath;
  }
  const scriptPath = path.join(binDir, "gemini");
  fs.writeFileSync(scriptPath, "#!/bin/sh\necho model command exited zero\nexit 0\n", "utf8");
  fs.chmodSync(scriptPath, 0o755);
  return scriptPath;
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

function createFakeGateScript(filePath, payload, exitCode = 0) {
  writeFile(
    filePath,
    [
      "#!/usr/bin/env node",
      "\"use strict\";",
      "const fs = require(\"fs\");",
      "if (process.env.CCG_GATE_LOG) {",
      "  fs.appendFileSync(process.env.CCG_GATE_LOG, JSON.stringify({",
      `    script: ${JSON.stringify(path.basename(filePath))},`,
      "    argv: process.argv.slice(2),",
      "    cwd: process.cwd()",
      "  }) + \"\\n\");",
      "}",
      `console.log(JSON.stringify(${JSON.stringify(payload)}, null, 2));`,
      `process.exit(${exitCode});`,
      "",
    ].join("\n")
  );
  return filePath;
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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
const geminiTemplateDir = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-executor", "templates", "gemini");
const pluginDoctor = path.join(repoRoot, "plugins", "ccg", "scripts", "doctor.ps1");
const syncLocalPluginCache = path.join(repoRoot, "scripts", "sync-local-plugin-cache.ps1");
const pluginSyncLocalPluginCache = path.join(repoRoot, "plugins", "ccg", "scripts", "sync-local-plugin-cache.ps1");
const ccgPlanSkill = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-plan", "SKILL.md");
const ccgExecutorSkill = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-executor", "SKILL.md");
const ccgDoctorSkill = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-doctor", "SKILL.md");
const realPluginRoot = path.join(repoRoot, "plugins", "ccg");
const phaseOneCommands = ["feat", "frontend", "backend", "analyze", "debug", "optimize", "test", "enhance"];
const fullParityCommands = [
  "workflow",
  "plan",
  "execute",
  "codex-exec",
  "review",
  ...phaseOneCommands,
  "init",
  "context",
  "commit",
  "rollback",
  "clean-branches",
  "worktree",
  "spec-init",
  "spec-research",
  "spec-plan",
  "spec-impl",
  "spec-review",
  "team",
  "team-research",
  "team-plan",
  "team-exec",
  "team-review",
];
const contextManager = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-context", "scripts", "context_manager.js");
const commitHelper = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-commit", "scripts", "commit_helper.js");
const rollbackHelper = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-rollback", "scripts", "rollback_helper.js");
const specManager = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-spec-init", "scripts", "spec_manager.js");
const teamPlanChecker = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-team", "scripts", "team_plan_checker.js");
const cleanBranchesHelper = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-clean-branches", "scripts", "clean_branches.js");
const worktreeHelper = path.join(repoRoot, "plugins", "ccg", "skills", "ccg-worktree", "scripts", "worktree_helper.js");
const extendedGeminiTemplates = [
  "base",
  "general",
  "plan",
  "prototype",
  "review",
  "frontend",
  "analyzer",
  "architect",
  "debugger",
  "optimizer",
  "tester",
];

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

function realPluginVersion() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(realPluginRoot, ".codex-plugin", "plugin.json"), "utf8")
  );
  return String(manifest.version);
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

test("verify-change default working mode includes staged numstat additions", () => {
  const dir = initGitRepo();
  writeFile(
    path.join(dir, "src", "app.js"),
    Array.from({ length: 37 }, (_, i) => `console.log('default-staged-${i}');`).join("\n") + "\n"
  );
  run("git", ["add", "src/app.js"], { cwd: dir });
  const result = run(node, [changeAnalyzer, "--json"], { cwd: dir });
  const json = parseJsonOutput(result);
  assert(json.total_additions >= 37, `expected default additions >= 37, got ${json.total_additions}`);
  assert(
    json.changes.some((change) => change.path === "src/app.js" && change.additions >= 37),
    "expected default mode to include staged additions"
  );
});

test("verify-change default working mode estimates untracked file additions", () => {
  const dir = initGitRepo();
  writeFile(
    path.join(dir, "src", "new-feature.js"),
    Array.from({ length: 38 }, (_, i) => `export const value${i} = ${i};`).join("\n") + "\n"
  );
  const result = run(node, [changeAnalyzer, "--json"], { cwd: dir });
  const json = parseJsonOutput(result);
  assert(json.total_additions >= 38, `expected untracked additions >= 38, got ${json.total_additions}`);
  assert(
    json.changes.some((change) => change.path === "src/new-feature.js" && change.additions >= 38),
    "expected default mode to estimate additions for untracked code files"
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

test("verify-security scans secrets inside test fixtures", () => {
  const dir = tempDir("ccg-security-tests-fixture-");
  const privateKeyHeader = "-----BEGIN " + "PRIVATE KEY-----";
  const privateKeyFooter = "-----END " + "PRIVATE KEY-----";
  writeFile(path.join(dir, "tests", "fixtures", "sample.key"), `${privateKeyHeader}\nabc\n${privateKeyFooter}\n`);
  const result = run(node, [securityScanner, dir, "--json"], { allowFailure: true });
  const json = parseJsonOutput(result);
  assert(
    json.findings.some((finding) => finding.file_path.includes(path.join("tests", "fixtures", "sample.key"))),
    "expected secret finding inside tests/fixtures"
  );
});

test("verify-security does not treat parent test directories as project test paths", () => {
  const root = tempDir("ccg-security-parent-test-");
  const project = path.join(root, "test", "project");
  writeFile(path.join(project, "src", "app.js"), "document.body.innerHTML = userInput;\n");
  const result = run(node, [securityScanner, project, "--json"], { allowFailure: true });
  const json = parseJsonOutput(result);
  assert(
    json.findings.some((finding) => finding.category === "XSS"),
    "expected non-secret rule to apply outside in-repository test directories"
  );
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
  writeFile(path.join(dir, "Button.tsx"), "export const Button = () => (<button>Click</button>);\n");
  const result = run(node, [qualityChecker, dir, "--json"]);
  const json = parseJsonOutput(result);
  assert(json.files_scanned === 3, `expected 3 frontend files scanned, got ${json.files_scanned}`);
  assert(Array.isArray(json.file_metrics), "expected file metrics in JSON output");
  const totalFunctions = json.file_metrics.reduce((sum, metric) => sum + metric.functions, 0);
  assert(totalFunctions === 3, `expected 3 frontend functions, got ${totalFunctions}`);
});

test("verify-quality computes JS and TS structural metrics", () => {
  const dir = tempDir("ccg-quality-js-ts-ast-");
  const filler = Array.from({ length: 51 }, (_, index) => `  const pad${index} = ${index};`).join("\n");
  writeFile(
    path.join(dir, "risky.ts"),
    `export function riskyFlow(a: string, b: string, c: string, d: string, e: string, f: string) {
  const fake = "if for while switch function fake() {}";
  const templated = \`while catch case function nope() {}\`;
  type LocalConfig = { retry?: boolean };
  // if for while switch function hiddenInComment() {}
  if (a) {}
  if (b) {}
  if (c) {}
  if (d) {}
  if (e) {}
  if (f) {}
  for (const item of [a]) {}
  while (false) {}
  switch (a) { case "x": break; }
${filler}
  return templated;
}

type Callback = (value: string) => void;
interface Runner {
  run(value: string): void;
}
`
  );
  writeFile(
    path.join(dir, "Service.mts"),
    `export class GoodService {
  async loadItems<T>(source: T, options: { retry: boolean }) {
    if (options.retry) {}
    return source;
  }

  onClick = () => {
    if (this) {}
  };
}
`
  );
  writeFile(
    path.join(dir, "false-positive.js"),
    `const functions = [1, 2, 3];
if (functions.length > 0) {
  console.log(functions.reduce((sum, value) => sum + value, 0));
}
`
  );

  const result = run(node, [qualityChecker, dir, "--json"]);
  const json = parseJsonOutput(result);
  const riskyMetric = json.file_metrics.find((metric) => metric.path.endsWith("risky.ts"));
  const serviceMetric = json.file_metrics.find((metric) => metric.path.endsWith("Service.mts"));
  const falsePositiveMetric = json.file_metrics.find((metric) => metric.path.endsWith("false-positive.js"));
  assert(riskyMetric, "expected risky.ts metrics");
  assert(serviceMetric, "expected Service.mts metrics");
  assert(falsePositiveMetric, "expected false-positive.js metrics");
  assert(riskyMetric.functions === 1, `expected only riskyFlow as a function, got ${riskyMetric.functions}`);
  assert(riskyMetric.max_complexity === 11, `expected masked complexity 11, got ${riskyMetric.max_complexity}`);
  assert(riskyMetric.avg_function_length > 50, "expected long TypeScript function length");
  assert(serviceMetric.classes === 1, `expected one class, got ${serviceMetric.classes}`);
  assert(serviceMetric.functions === 2, `expected method and class field arrow, got ${serviceMetric.functions}`);
  assert(
    falsePositiveMetric.functions === 0,
    `expected no functions false positive, got ${falsePositiveMetric.functions}`
  );
  const messages = json.issues.map((issue) => issue.message).join("\n");
  assert(messages.includes("Function 'riskyFlow' is too long"), "expected function length warning");
  assert(messages.includes("Function 'riskyFlow' cyclomatic complexity is high"), "expected complexity warning");
  assert(messages.includes("Function 'riskyFlow' has too many parameters"), "expected parameter warning");
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

test("Gemini snapshot ignores symlinked or junction directories", () => {
  const source = tempDir("ccg-gemini-symlink-source-");
  const outside = tempDir("ccg-gemini-symlink-outside-");
  writeFile(path.join(source, "src", "safe.txt"), "safe\n");
  writeFile(path.join(outside, "secret.txt"), "external secret\n");
  const linkCreated = createDirectoryLink(path.join(source, "linked-secrets"), outside);
  assert(linkCreated, "expected test environment to support directory symlink or junction creation");

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
    print("SAFE_EXISTS=" + str((snapshot / "src" / "safe.txt").exists()))
    print("LINK_EXISTS=" + str((snapshot / "linked-secrets").exists()))
    print("LINK_SECRET_EXISTS=" + str((snapshot / "linked-secrets" / "secret.txt").exists()))
finally:
    temp_dir.cleanup()
`;
  const result = run(python, ["-c", snippet, geminiPreview, source]);
  assert(result.stdout.includes("SAFE_EXISTS=True"), `expected safe file in snapshot:\n${result.stdout}`);
  assert(result.stdout.includes("LINK_EXISTS=False"), `expected linked directory excluded:\n${result.stdout}`);
  assert(
    result.stdout.includes("LINK_SECRET_EXISTS=False"),
    `expected symlink target content excluded:\n${result.stdout}`
  );
});

test("Gemini snapshot treats Windows reparse points as links on Python without Path.is_junction", () => {
  const snippet = `
import importlib.util, pathlib, stat, sys
script = pathlib.Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("gemini_preview", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if not hasattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT"):
    stat.FILE_ATTRIBUTE_REPARSE_POINT = 0x400
class FakeReparsePoint:
    def is_symlink(self):
        return False
    def lstat(self):
        class StatResult:
            st_file_attributes = stat.FILE_ATTRIBUTE_REPARSE_POINT
        return StatResult()
original_name = module.os.name
original_is_junction = getattr(FakeReparsePoint, "is_junction", None)
module.os.name = "nt"
try:
    if original_is_junction is not None:
        delattr(FakeReparsePoint, "is_junction")
    print("REPARSE_LINK=" + str(module.is_snapshot_link(FakeReparsePoint())))
finally:
    module.os.name = original_name
`;
  const result = run(python, ["-c", snippet, geminiPreview]);
  assert(result.stdout.includes("REPARSE_LINK=True"), `expected reparse point fallback:\n${result.stdout}`);
});

test("Gemini stream parser extracts nested and chunked assistant text", () => {
  const snippet = `
import importlib.util, pathlib, sys
script = pathlib.Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("gemini_preview", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
events = [
    {"type": "message", "role": "assistant", "content": "direct "},
    {"type": "message", "role": "assistant", "content": [{"type": "text", "text": "array "}, {"parts": [{"text": "parts "}]}]},
    {"type": "delta", "delta": {"text": "delta "}},
    {"type": "result", "status": "complete", "output_text": "result"},
    {"type": "init", "session_id": "metadata-only", "status": "running"},
    {"type": "message", "role": "user", "content": "ignored user text"},
]
print("TEXT=" + "".join(module.extract_event_text(event) for event in events))
print("META_EMPTY=" + str(module.extract_event_text({"type": "result", "status": "complete", "session_id": "abc"}) == ""))
`;
  const result = run(python, ["-c", snippet, geminiPreview]);
  assert(
    result.stdout.includes("TEXT=direct array parts delta result"),
    `expected nested stream-json text extraction:\n${result.stdout}`
  );
  assert(result.stdout.includes("META_EMPTY=True"), `expected metadata-only event ignored:\n${result.stdout}`);
});

test("Gemini snapshot honors ccgignore, optional gitignore, and size caps", () => {
  const source = tempDir("ccg-gemini-ignore-source-");
  const target = tempDir("ccg-gemini-ignore-target-");
  writeFile(path.join(source, ".ccgignore"), "ignored.txt\n");
  writeFile(path.join(source, ".gitignore"), "gitignored.txt\n");
  writeFile(path.join(source, "keep.txt"), "safe\n");
  writeFile(path.join(source, "ignored.txt"), "ignored\n");
  writeFile(path.join(source, "gitignored.txt"), "git ignored\n");
  writeFile(path.join(source, ".env"), "TOKEN=secret\n");
  writeFile(path.join(source, "huge.bin"), "x".repeat(2048));

  const snippet = `
import importlib.util, json, pathlib, sys
script = pathlib.Path(sys.argv[1])
source = pathlib.Path(sys.argv[2])
target = pathlib.Path(sys.argv[3]) / "snapshot"
spec = importlib.util.spec_from_file_location("gemini_preview", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class Args:
    files_from = ""
    respect_gitignore = True
    max_snapshot_bytes = 512
    max_snapshot_files = 0
stats = module.copy_snapshot_tree(source, target, Args())
print("KEEP_EXISTS=" + str((target / "keep.txt").exists()))
print("IGNORED_EXISTS=" + str((target / "ignored.txt").exists()))
print("GITIGNORED_EXISTS=" + str((target / "gitignored.txt").exists()))
print("ENV_EXISTS=" + str((target / ".env").exists()))
print("HUGE_EXISTS=" + str((target / "huge.bin").exists()))
print("CAP_SKIPPED=" + str(stats["skipped_cap"] > 0))
`;
  const result = run(python, ["-c", snippet, geminiPreview, source, target]);
  assert(result.stdout.includes("KEEP_EXISTS=True"), `expected keep.txt copied:\n${result.stdout}`);
  assert(result.stdout.includes("IGNORED_EXISTS=False"), `expected .ccgignore pattern honored:\n${result.stdout}`);
  assert(result.stdout.includes("GITIGNORED_EXISTS=False"), `expected .gitignore pattern honored:\n${result.stdout}`);
  assert(result.stdout.includes("ENV_EXISTS=False"), `expected secret exclusion to win:\n${result.stdout}`);
  assert(result.stdout.includes("HUGE_EXISTS=False"), `expected size cap to skip huge file:\n${result.stdout}`);
  assert(result.stdout.includes("CAP_SKIPPED=True"), `expected cap skip count:\n${result.stdout}`);
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

test("Gemini prompt templates are bundled and referenced", () => {
  for (const name of extendedGeminiTemplates) {
    const file = path.join(geminiTemplateDir, `${name}.md`);
    assert(fs.existsSync(file), `expected bundled Gemini prompt template ${name}.md`);
  }
  const base = fs.readFileSync(path.join(geminiTemplateDir, "base.md"), "utf8");
  assert(base.includes("Codex owns"), "expected Codex ownership in base template");
  assert(base.includes("read-only"), "expected read-only boundary in base template");
  assert(base.includes("original CCG"), "expected original CCG provenance in base template");
  const prototype = fs.readFileSync(path.join(geminiTemplateDir, "prototype.md"), "utf8");
  assert(prototype.includes("Unified Diff Patch"), "expected prototype template to request unified diff patches");
  const executorSkill = fs.readFileSync(ccgExecutorSkill, "utf8");
  assert(executorSkill.includes("--prompt-template"), "expected executor skill to document prompt templates");
  for (const name of ["analyzer", "architect", "debugger", "optimizer", "tester"]) {
    assert(executorSkill.includes(`\`${name}\``), `expected executor skill to document ${name} template`);
  }
});

test("Gemini preview helper defaults to templates and browser auto-close", () => {
  const snippet = `
import importlib.util, pathlib, sys
script = pathlib.Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("gemini_preview", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
sys.argv = ["tool"]
args = module.parse_args()
print("TEMPLATE=" + args.prompt_template)
print("AUTO_CLOSE=" + str(args.auto_close_browser_seconds))
print("MIN_HOLD=" + str(args.min_preview_hold_seconds))
wrapped = module.apply_prompt_template(args, "Implement the feature")
print("HAS_CODEX_OWNS=" + str("Codex owns" in wrapped))
print("HAS_TASK=" + str("Implement the feature" in wrapped))
html = module.make_handler().index_html()
print("HAS_WINDOW_CLOSE=" + str("window.close()" in html))
print("HAS_TIMELINE=" + str("timeline" in html and "Process" in html))
print("HAS_RAW_STREAM=" + str("Raw stream-json" in html))
args.no_browser = True
args.preview_port = 0
args.hold_seconds = 0
print("HEADLESS_HOLD=" + str(module.effective_hold_seconds(args)))
args.preview_port = 12345
print("PREVIEW_HOLD=" + str(module.effective_hold_seconds(args)))
`;
  const result = run(python, ["-c", snippet, geminiPreview]);
  assert(result.stdout.includes("TEMPLATE=general"), `expected general template default:\n${result.stdout}`);
  assert(result.stdout.includes("AUTO_CLOSE=3"), `expected 3s browser auto-close default:\n${result.stdout}`);
  assert(result.stdout.includes("MIN_HOLD=5"), `expected preview final-state grace default:\n${result.stdout}`);
  assert(result.stdout.includes("HAS_CODEX_OWNS=True"), `expected template wrapping:\n${result.stdout}`);
  assert(result.stdout.includes("HAS_TASK=True"), `expected original prompt preserved:\n${result.stdout}`);
  assert(result.stdout.includes("HAS_WINDOW_CLOSE=True"), `expected preview page to close itself:\n${result.stdout}`);
  assert(result.stdout.includes("HAS_TIMELINE=True"), `expected live process timeline in preview:\n${result.stdout}`);
  assert(result.stdout.includes("HAS_RAW_STREAM=True"), `expected raw stream pane in preview:\n${result.stdout}`);
  assert(result.stdout.includes("HEADLESS_HOLD=0"), `expected headless smoke to remain fast:\n${result.stdout}`);
  assert(result.stdout.includes("PREVIEW_HOLD=5"), `expected visible preview to keep final state:\n${result.stdout}`);
});

test("CCG skills require browser preview for every workflow Gemini call", () => {
  const executorSkill = fs.readFileSync(ccgExecutorSkill, "utf8");
  const executeSkill = fs.readFileSync(
    path.join(repoRoot, "plugins", "ccg", "skills", "ccg-execute", "SKILL.md"),
    "utf8"
  );
  const reviewSkill = fs.readFileSync(
    path.join(repoRoot, "plugins", "ccg", "skills", "ccg-review", "SKILL.md"),
    "utf8"
  );
  const geminiPreviewSkill = fs.readFileSync(
    path.join(repoRoot, "plugins", "ccg", "skills", "ccg-gemini-preview", "SKILL.md"),
    "utf8"
  );
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

  for (const [name, text] of [
    ["executor", executorSkill],
    ["execute", executeSkill],
    ["review", reviewSkill],
  ]) {
    assert(
      text.includes("Every Gemini call in the CCG workflow must use the bundled preview helper"),
      `expected ${name} skill to require the preview helper for every Gemini call`
    );
    assert(
      text.includes("Do not call the raw `gemini`, `gemini.cmd`, or `gemini.exe` CLI directly"),
      `expected ${name} skill to forbid raw Gemini CLI calls`
    );
  }

  assert(
    geminiPreviewSkill.includes("manual smoke-test and debugging entry"),
    "expected /ccg:gemini-preview to be documented as a manual smoke/debug entry"
  );
  assert(
    readme.includes("`/ccg:gemini-preview` is only the manual smoke-test/debug entry"),
    "expected README to clarify that workflow Gemini calls open the preview automatically"
  );
});

test("fixture:phase-one original CCG phase-one commands have command, skill, agent, and index coverage", () => {
  const ccgCommand = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "commands", "ccg.md"), "utf8");
  const ccgSkill = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg", "SKILL.md"), "utf8");
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const bridge = fs.readFileSync(path.join(repoRoot, "scripts", "install-codex-command-bridge.ps1"), "utf8");
  const doctor = fs.readFileSync(pluginDoctor, "utf8");
  const parityMatrix = fs.readFileSync(path.join(repoRoot, "docs", "original-ccg-parity-matrix.md"), "utf8");

  for (const command of phaseOneCommands) {
    assert(
      fs.existsSync(path.join(repoRoot, "plugins", "ccg", "commands", `${command}.md`)),
      `expected /ccg:${command} command file`
    );
    assert(
      fs.existsSync(path.join(repoRoot, "plugins", "ccg", "skills", `ccg-${command}`, "SKILL.md")),
      `expected ccg-${command} skill`
    );
    assert(
      fs.existsSync(path.join(repoRoot, "plugins", "ccg", "skills", `ccg-${command}`, "agents", "openai.yaml")),
      `expected ccg-${command} agent prompt`
    );
    assert(ccgCommand.includes(`/ccg:${command}`), `expected command index to include /ccg:${command}`);
    assert(ccgSkill.includes(`/ccg:${command}`), `expected skill index to include /ccg:${command}`);
    assert(readme.includes(`/ccg:${command}`), `expected README to include /ccg:${command}`);
    assert(bridge.includes(`${command}.md`), `expected bridge installer to include ${command}.md`);
    assert(
      doctor.includes(`${command}.md`) || doctor.includes(`ccg-${command}`) || doctor.includes(`ccg:${command}`),
      `expected doctor diagnostics to include ${command}`
    );
    assert(parityMatrix.includes(`/ccg:${command}`), `expected parity matrix to include /ccg:${command}`);
  }
});

test("phase-one command semantics preserve Codex and Gemini boundaries", () => {
  const frontend = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-frontend", "SKILL.md"), "utf8");
  const backend = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-backend", "SKILL.md"), "utf8");
  const analyze = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-analyze", "SKILL.md"), "utf8");
  const debug = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-debug", "SKILL.md"), "utf8");
  const testSkill = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-test", "SKILL.md"), "utf8");

  assert(frontend.includes("--prompt-template frontend"), "expected frontend skill to use frontend Gemini template");
  assert(frontend.includes("Codex must adapt Gemini output"), "expected Codex ownership in frontend skill");
  assert(backend.includes("Gemini is optional"), "expected backend skill to keep Gemini optional");
  assert(analyze.includes("read-only"), "expected analyze skill to remain read-only");
  assert(debug.includes("Reproduce"), "expected debug skill to require reproduction");
  assert(testSkill.includes("--prompt-template tester"), "expected test skill to use tester Gemini template");
});

test("original CCG parity matrix tracks later phases and non-copied wrapper behavior", () => {
  const matrix = fs.readFileSync(path.join(repoRoot, "docs", "original-ccg-parity-matrix.md"), "utf8");
  for (const phrase of [
    "/ccg:spec-init",
    "/ccg:team-review",
    "/ccg:commit",
    "codeagent-wrapper",
    "not-copied",
    "SESSION_ID",
  ]) {
    assert(matrix.includes(phrase), `expected parity matrix to include ${phrase}`);
  }
});

test("verify-security scanFile defaults test-path checks to the file basename", () => {
  const root = tempDir("ccg-security-scanfile-test-");
  const filePath = path.join(root, "test", "project", "src", "app.js");
  writeFile(filePath, "document.body.innerHTML = userInput;\n");
  const snippet = `
const scanner = require(process.argv[1]);
const findings = scanner.scanFile(process.argv[2], scanner.SECURITY_RULES);
console.log(JSON.stringify(findings));
`;
  const result = run(node, ["-e", snippet, securityScanner, filePath]);
  const findings = parseJsonOutput(result);
  assert(
    findings.some((finding) => finding.category === "XSS"),
    "expected direct scanFile calls to avoid parent test-directory false positives"
  );
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

test("ccg-plan skill defines detached Gemini response polling", () => {
  const text = fs.readFileSync(ccgPlanSkill, "utf8");
  assert(text.includes("Poll `CCG_GEMINI_RESPONSE_FILE` every 5 seconds"), "expected response polling cadence");
  assert(text.includes("exists and has size > 0"), "expected non-empty response condition");
  assert(text.includes("10 minutes"), "expected timeout guidance");
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

test("doctor fix refreshes stale cache and reports fresh cache", () => {
  const codexHome = tempDir("ccg-doctor-fix-codex-");
  const version = realPluginVersion();
  const cacheRoot = path.join(codexHome, "plugins", "cache", "ccg-codex-workflow", "ccg", version);
  writeFile(path.join(cacheRoot, ".codex-plugin", "plugin.json"), JSON.stringify({ name: "ccg", version }, null, 2));
  writeFile(path.join(cacheRoot, "commands", "plan.md"), "# stale\n");

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
      realPluginRoot,
      "-Fix",
      "-Json",
    ],
    { allowFailure: true }
  );
  const json = parseJsonOutput(result);
  const freshness = json.checks.find((check) => check.name === "plugin cache freshness");
  assert(freshness && freshness.status === "PASS", "expected -Fix to refresh stale cache");
  assert(
    fs.existsSync(path.join(cacheRoot, "skills", "ccg-plan", "SKILL.md")),
    "expected -Fix to copy real plugin files into cache"
  );
});

test("doctor fix restores missing cached key file", () => {
  const codexHome = tempDir("ccg-doctor-fix-codex-");
  const version = realPluginVersion();
  const cacheRoot = path.join(codexHome, "plugins", "cache", "ccg-codex-workflow", "ccg", version);
  fs.cpSync(realPluginRoot, cacheRoot, { recursive: true });
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
      realPluginRoot,
      "-Fix",
      "-Json",
    ],
    { allowFailure: true }
  );
  const json = parseJsonOutput(result);
  assert(fs.existsSync(path.join(cacheRoot, "commands", "plan.md")), "expected -Fix to restore commands/plan.md");
  assert(
    json.checks.some((check) => check.name === "cached key file: commands\\plan.md" && check.status === "PASS"),
    "expected restored cached key file to pass"
  );
});

test("doctor fix does not install command bridge", () => {
  const codexHome = tempDir("ccg-doctor-fix-codex-");
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
      realPluginRoot,
      "-Fix",
      "-Json",
    ],
    { allowFailure: true }
  );
  const json = parseJsonOutput(result);
  assert(!fs.existsSync(path.join(codexHome, "commands", "ccg.md")), "did not expect -Fix to install bridge");
  assert(
    json.checks.some((check) => check.name === "command bridge: ccg.md" && check.status === "WARN"),
    "expected missing command bridge to remain a warning"
  );
});

test("doctor can optionally check Gemini model availability", () => {
  const codexHome = tempDir("ccg-doctor-model-codex-");
  const fakeBin = tempDir("ccg-doctor-model-bin-");
  const version = realPluginVersion();
  const cacheRoot = path.join(codexHome, "plugins", "cache", "ccg-codex-workflow", "ccg", version);
  fs.cpSync(realPluginRoot, cacheRoot, { recursive: true });
  createFakeGemini(fakeBin);

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
      realPluginRoot,
      "-CheckGeminiModel",
      "-GeminiModel",
      "fixture-model",
      "-Json",
    ],
    {
      allowFailure: true,
      env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ""}` },
    }
  );
  const json = parseJsonOutput(result);
  assert(
    json.checks.some(
      (check) => check.name === "Gemini model available: fixture-model" && check.status === "PASS"
    ),
    "expected optional Gemini model availability check to pass with fake Gemini"
  );
});

test("doctor warns when Gemini model probe exits zero without marker", () => {
  const codexHome = tempDir("ccg-doctor-model-marker-codex-");
  const fakeBin = tempDir("ccg-doctor-model-marker-bin-");
  const version = realPluginVersion();
  const cacheRoot = path.join(codexHome, "plugins", "cache", "ccg-codex-workflow", "ccg", version);
  fs.cpSync(realPluginRoot, cacheRoot, { recursive: true });
  createFakeGeminiWithoutMarker(fakeBin);

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
      realPluginRoot,
      "-CheckGeminiModel",
      "-GeminiModel",
      "fixture-model",
      "-Json",
    ],
    {
      allowFailure: true,
      env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ""}` },
    }
  );
  const json = parseJsonOutput(result);
  assert(
    json.checks.some(
      (check) => check.name === "Gemini model available: fixture-model" && check.status === "WARN"
    ),
    "expected missing marker to warn even when Gemini CLI exits zero"
  );
});

test("ccg-doctor skill keeps fix read-only outside source checkout", () => {
  const text = fs.readFileSync(ccgDoctorSkill, "utf8");
  assert(text.includes("--fix"), "expected /ccg:doctor --fix guidance");
  assert(text.includes("source checkout"), "expected source checkout guard");
  assert(text.includes("read-only"), "expected read-only fallback guidance");
});

test("fixture:artifact-path ccg-plan hard-codes Chinese Codex-native plan output", () => {
  const planSkill = fs.readFileSync(ccgPlanSkill, "utf8");
  const planCommand = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "commands", "plan.md"), "utf8");
  assert(planSkill.includes(".codex/ccg/plans/<slug>.md"), "expected new plan paths under .codex/ccg/plans");
  assert(planSkill.includes("The generated plan file itself must also be Chinese"), "expected saved-plan Chinese contract");
  assert(planSkill.includes("# CCG 计划"), "expected Chinese plan template heading");
  assert(planCommand.includes("saved CCG plan content itself must be Chinese"), "expected command to hard-code saved-plan Chinese output");
  assert(!planSkill.includes("Write only `.claude/plan/*.md`"), "did not expect .claude/plan as default write target");
});

test("fixture:artifact-path full parity command assets exist", () => {
  for (const command of fullParityCommands) {
    assert(
      fs.existsSync(path.join(repoRoot, "plugins", "ccg", "commands", `${command}.md`)),
      `expected command file for /ccg:${command}`
    );
    assert(
      fs.existsSync(path.join(repoRoot, "plugins", "ccg", "skills", `ccg-${command}`, "SKILL.md")),
      `expected skill file for /ccg:${command}`
    );
    assert(
      fs.existsSync(path.join(repoRoot, "plugins", "ccg", "skills", `ccg-${command}`, "agents", "openai.yaml")),
      `expected agent file for /ccg:${command}`
    );
  }
});

test("fixture:core core CCG commands remain indexed", () => {
  const ccgCommand = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "commands", "ccg.md"), "utf8");
  const ccgSkill = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg", "SKILL.md"), "utf8");
  for (const command of ["workflow", "plan", "execute", "codex-exec", "review"]) {
    assert(ccgCommand.includes(`/ccg:${command}`), `expected command index to include /ccg:${command}`);
    assert(ccgSkill.includes(`/ccg:${command}`), `expected skill index to include /ccg:${command}`);
  }
});

test("fixture:git-context context manager writes Codex context artifacts", () => {
  const dir = tempDir("ccg-context-fixture-");
  run(node, [contextManager, "init"], { cwd: dir });
  run(node, [contextManager, "log", "first note"], { cwd: dir });
  run(node, [contextManager, "summarize"], { cwd: dir });
  const contextRoot = path.join(dir, ".codex", "ccg", "context");
  assert(fs.existsSync(path.join(contextRoot, "history.md")), "expected history.md");
  assert(fs.existsSync(path.join(contextRoot, "current-summary.md")), "expected current-summary.md");
  assert(fs.readdirSync(path.join(contextRoot, "events")).length === 1, "expected one event file");
  const clear = run(node, [contextManager, "clear", "--dry-run"], { cwd: dir });
  assert(clear.stdout.includes("dry-run"), "expected clear dry-run by default");
  assert(fs.readFileSync(path.join(contextRoot, "history.md"), "utf8").includes("first note"), "expected raw history preserved");
});

test("fixture:git-context git helpers default to safe dry-run behavior", () => {
  const dir = initGitRepo();
  writeFile(path.join(dir, "src", "auth.js"), "export const token = 'fixture';\n");
  const commit = run(node, [commitHelper, "--json"], { cwd: dir });
  const commitJson = parseJsonOutput(commit);
  assert(commitJson.executed === false, "expected commit helper not to commit by default");
  assert(commitJson.securitySensitive === true, "expected security-sensitive path detection");

  const rollback = run(node, [rollbackHelper, "--last", "--json"], { cwd: dir });
  const rollbackJson = parseJsonOutput(rollback);
  assert(rollbackJson.dryRun === true, "expected rollback dry-run by default");
  assert(rollbackJson.commands[0].includes("git revert --no-commit"), "expected revert preview");

  const dangerous = run(node, [rollbackHelper, "reset", "--hard"], { cwd: dir, allowFailure: true });
  assert(dangerous.status !== 0, "expected destructive reset to be blocked");

  const clean = run(node, [cleanBranchesHelper, "--json"], { cwd: dir });
  const cleanJson = parseJsonOutput(clean);
  assert(cleanJson.dryRun === true, "expected branch cleanup dry-run by default");

  const worktree = run(node, [worktreeHelper, "list", "--json"], { cwd: dir });
  const worktreeJson = parseJsonOutput(worktree);
  assert(worktreeJson.command === "list", "expected worktree list command");
});

test("fixture:spec-manager init creates .codex/ccg/specs/README.md", () => {
  const dir = tempDir("ccg-spec-manager-init-");
  run(node, [specManager, "init"], { cwd: dir });
  assert(
    fs.existsSync(path.join(dir, ".codex", "ccg", "specs", "README.md")),
    "expected spec manager init to create README.md"
  );
});

test("fixture:spec-manager create creates status.json", () => {
  const dir = tempDir("ccg-spec-manager-create-");
  run(node, [specManager, "init"], { cwd: dir });
  const result = run(node, [specManager, "create", "audit-log", "--requirement", "Track audit logging", "--json"], {
    cwd: dir,
  });
  const json = parseJsonOutput(result);
  assert(json.status.name === "audit-log", "expected status.json to record the spec name");
  assert(
    fs.existsSync(path.join(dir, ".codex", "ccg", "specs", "audit-log", "status.json")),
    "expected status.json to be created"
  );
});

test("fixture:spec-manager validate fails without constraints.md", () => {
  const dir = tempDir("ccg-spec-manager-validate-fail-");
  run(node, [specManager, "init"], { cwd: dir });
  run(node, [specManager, "create", "audit-log", "--requirement", "Track audit logging"], { cwd: dir });
  const result = run(node, [specManager, "validate", "audit-log", "--json"], { cwd: dir, allowFailure: true });
  const json = parseJsonOutput(result);
  assert(result.status !== 0, "expected validation to fail without constraints.md");
  assert(json.valid === false, "expected validate result to be false");
  assert(
    json.errors.includes("constraints.md is required"),
    "expected missing constraints.md to block validation"
  );
});

test("fixture:spec-manager validate passes with required sections", () => {
  const dir = tempDir("ccg-spec-manager-validate-pass-");
  const researchFile = path.join(dir, "research-input.md");
  const constraintsFile = path.join(dir, "constraints-input.md");
  writeFile(researchFile, "# Research\n\nProblem framing.\n");
  writeFile(
    constraintsFile,
    [
      "## Goal",
      "Track audit logging.",
      "",
      "## Scope",
      "In-scope behaviors.",
      "",
      "## Out of Scope",
      "No schema rewrite.",
      "",
      "## Constraints",
      "Keep Codex-native paths.",
      "",
      "## Acceptance Criteria",
      "- Emits audit events.",
      "",
    ].join("\n")
  );
  run(node, [specManager, "init"], { cwd: dir });
  run(node, [specManager, "create", "audit-log", "--requirement", "Track audit logging"], { cwd: dir });
  run(node, [specManager, "write-research", "audit-log", "--file", researchFile], { cwd: dir });
  run(node, [specManager, "write-constraints", "audit-log", "--file", constraintsFile], { cwd: dir });
  const result = run(node, [specManager, "validate", "audit-log", "--json"], { cwd: dir });
  const json = parseJsonOutput(result);
  assert(json.valid === true, "expected validation to pass with required sections");
  assert(json.status.validation.has_goal === true, "expected goal validation flag");
  assert(json.status.validation.has_constraints === true, "expected constraints validation flag");
  assert(json.status.validation.has_acceptance_criteria === true, "expected acceptance criteria validation flag");
  assert(json.status.validation.has_out_of_scope === true, "expected out-of-scope validation flag");
});

test("fixture:spec-manager archive writes archive.md and updates status.json", () => {
  const dir = tempDir("ccg-spec-manager-archive-");
  const summaryFile = path.join(dir, "summary.md");
  writeFile(
    summaryFile,
    [
      "## Execution Summary",
      "Implemented audit logging.",
      "",
      "## Verification Results",
      "node scripts/run-fixture-tests.js",
      "",
      "## Residual Risks",
      "No production smoke yet.",
      "",
    ].join("\n")
  );
  run(node, [specManager, "init"], { cwd: dir });
  run(node, [specManager, "create", "audit-log", "--requirement", "Track audit logging"], { cwd: dir });
  run(node, [specManager, "archive", "audit-log", "--summary-file", summaryFile, "--json"], { cwd: dir });
  const status = JSON.parse(
    fs.readFileSync(path.join(dir, ".codex", "ccg", "specs", "audit-log", "status.json"), "utf8")
  );
  assert(status.artifacts.archive === true, "expected archive artifact flag to be true");
  assert(
    fs.existsSync(path.join(dir, ".codex", "ccg", "specs", "audit-log", "archive.md")),
    "expected archive.md to be written"
  );
});

test("fixture:spec-manager spec skills require validation and refusal gates", () => {
  const planSkill = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-spec-plan", "SKILL.md"), "utf8");
  const implSkill = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-spec-impl", "SKILL.md"), "utf8");
  const reviewSkill = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-spec-review", "SKILL.md"), "utf8");
  assert(planSkill.includes("spec_manager.js validate"), "expected spec-plan to mention spec_manager validation");
  assert(planSkill.includes("Refuse"), "expected spec-plan to refuse missing or invalid constraints");
  assert(implSkill.includes("Refuse to execute"), "expected spec-impl refusal guidance");
  assert(reviewSkill.includes("Require both constraints and plan"), "expected spec-review evidence requirement");
});

test("fixture:team-plan-checker parses worker table", () => {
  const dir = tempDir("ccg-team-checker-parse-");
  const planFile = path.join(dir, "plan.md");
  writeFile(
    planFile,
    [
      "## Workers",
      "| Worker | Scope | Files | Constraints |",
      "|--------|-------|-------|-------------|",
      "| backend-1 | API | src/api/a.ts, src/api/b.ts | no schema change |",
      "| frontend-1 | UI | src/app/page.tsx | use existing design system |",
      "",
      "## Merge Strategy",
      "backend-1 owns API files; frontend-1 owns UI files.",
      "",
      "## Verification Strategy",
      "- node scripts/run-fixture-tests.js",
      "",
      "## Conflict Risks",
      "Low.",
      "",
    ].join("\n")
  );
  const result = run(node, [teamPlanChecker, "summarize", planFile, "--json"], { cwd: dir });
  const json = parseJsonOutput(result);
  assert(json.worker_count === 2, `expected 2 workers, got ${json.worker_count}`);
  assert(json.workers[0].files.length === 2, "expected file list to be parsed");
});

test("fixture:team-plan-checker detects same-file conflicts", () => {
  const dir = tempDir("ccg-team-checker-conflict-");
  const planDir = path.join(dir, ".codex", "ccg", "team", "audit-log");
  const planFile = path.join(planDir, "plan.md");
  writeFile(
    planFile,
    [
      "## Workers",
      "| Worker | Scope | Files | Constraints |",
      "|--------|-------|-------|-------------|",
      "| backend-1 | API | src/api/a.ts | no schema change |",
      "| backend-2 | Jobs | src/api/a.ts | keep migrations untouched |",
      "",
      "## Merge Strategy",
      "Codex will look later.",
      "",
      "## Verification Strategy",
      "- node scripts/run-fixture-tests.js",
      "",
      "## Conflict Risks",
      "Two workers want the same file.",
      "",
    ].join("\n")
  );
  const result = run(node, [teamPlanChecker, "validate", planFile, "--json"], { cwd: dir, allowFailure: true });
  const json = parseJsonOutput(result);
  assert(result.status !== 0, "expected validate to fail without an explicit merge strategy");
  assert(json.same_file_conflicts.length === 1, "expected a same-file conflict to be detected");
  assert(
    json.blocking_reasons.some((reason) => reason.includes("same file conflict")),
    "expected a blocking reason for same-file conflict"
  );
  assert(
    fs.existsSync(path.join(planDir, "status.json")),
    "expected validate to write team status.json next to plan.md"
  );
});

test("fixture:team-plan-checker allows conflict with explicit merge strategy", () => {
  const dir = tempDir("ccg-team-checker-allow-");
  const planFile = path.join(dir, "plan.md");
  writeFile(
    planFile,
    [
      "## Workers",
      "| Worker | Scope | Files | Constraints |",
      "|--------|-------|-------|-------------|",
      "| backend-1 | API | src/api/a.ts | no schema change |",
      "| backend-2 | Jobs | src/api/a.ts | keep migrations untouched |",
      "",
      "## Merge Strategy",
      "Codex will reconcile src/api/a.ts after backend-1 and backend-2 finish, and backend-1 is the final owner.",
      "",
      "## Verification Strategy",
      "- node scripts/run-fixture-tests.js",
      "",
      "## Conflict Risks",
      "Managed by explicit ownership.",
      "",
    ].join("\n")
  );
  const result = run(node, [teamPlanChecker, "validate", planFile, "--json"], { cwd: dir });
  const json = parseJsonOutput(result);
  assert(json.can_execute === true, "expected explicit merge strategy to allow execution");
});

test("fixture:team-plan-checker team skills require checker and status evidence", () => {
  const execSkill = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-team-exec", "SKILL.md"), "utf8");
  const reviewSkill = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-team-review", "SKILL.md"), "utf8");
  assert(execSkill.includes("team_plan_checker.js validate"), "expected team-exec to require checker validation");
  assert(execSkill.includes("status.json"), "expected team-exec to mention status.json");
  assert(reviewSkill.includes("status.json"), "expected team-review to require status evidence");
});

test("fixture:rollback-confirm-exec confirm executes revert --no-commit", () => {
  const dir = initGitRepo();
  writeFile(path.join(dir, "src", "app.js"), "console.log('updated');\n");
  run("git", ["add", "src/app.js"], { cwd: dir });
  run("git", ["commit", "-m", "update"], { cwd: dir });
  const sha = run("git", ["rev-parse", "HEAD"], { cwd: dir }).stdout.trim();
  const result = run(
    node,
    [rollbackHelper, "--target", sha, "--mode", "revert", "--confirm", "--protected-branch-ok", "--json"],
    { cwd: dir }
  );
  const json = parseJsonOutput(result);
  assert(json.executed === true, "expected revert execution");
  const cached = run("git", ["diff", "--cached", "--name-only"], { cwd: dir }).stdout;
  assert(cached.includes("src/app.js"), "expected revert --no-commit to stage the reverted file");
});

test("fixture:rollback-confirm-exec confirm executes file restore", () => {
  const dir = initGitRepo();
  writeFile(path.join(dir, "src", "app.js"), "console.log('dirty');\n");
  const expected = run("git", ["show", "HEAD:src/app.js"], { cwd: dir }).stdout.replace(/\r\n/g, "\n");
  const result = run(
    node,
    [rollbackHelper, "--file", "src/app.js", "--target", "HEAD", "--confirm", "--protected-branch-ok", "--json"],
    { cwd: dir }
  );
  const json = parseJsonOutput(result);
  assert(json.executed === true, "expected file restore execution");
  const content = fs.readFileSync(path.join(dir, "src", "app.js"), "utf8").replace(/\r\n/g, "\n");
  assert(content === expected, "expected file content to be restored from HEAD");
});

test("fixture:rollback-confirm-exec refuses push --force always", () => {
  const dir = initGitRepo();
  const result = run(node, [rollbackHelper, "push", "--force", "--json"], { cwd: dir, allowFailure: true });
  const json = parseJsonOutput(result);
  assert(result.status !== 0, "expected force push refusal");
  assert(json.blocked === true, "expected blocked force push result");
  assert(json.manualOnly === true, "expected force push to remain manual-only");
});

test("fixture:rollback-confirm-exec protected branch requires --protected-branch-ok", () => {
  const dir = initGitRepo();
  writeFile(path.join(dir, "src", "app.js"), "console.log('updated');\n");
  run("git", ["add", "src/app.js"], { cwd: dir });
  run("git", ["commit", "-m", "update"], { cwd: dir });
  const sha = run("git", ["rev-parse", "HEAD"], { cwd: dir }).stdout.trim();
  const result = run(node, [rollbackHelper, "--target", sha, "--mode", "revert", "--branch", "main", "--confirm", "--json"], {
    cwd: dir,
    allowFailure: true,
  });
  const json = parseJsonOutput(result);
  assert(result.status !== 0, "expected protected branch guard to fail without explicit acknowledgment");
  assert(
    String(json.reason || "").includes("protected branch"),
    "expected protected branch reason in JSON output"
  );
});

test("fixture:commit-gate-runner detects staged, unstaged, and untracked files", () => {
  const dir = initGitRepo();
  writeFile(path.join(dir, "src", "app.js"), "console.log('unstaged');\n");
  writeFile(path.join(dir, "src", "staged.js"), "export const staged = true;\n");
  writeFile(path.join(dir, "src", "todo.js"), "export const todo = true;\n");
  run("git", ["add", "src/staged.js"], { cwd: dir });
  const result = run(node, [commitHelper, "--json"], { cwd: dir });
  const json = parseJsonOutput(result);
  assert(json.staged.includes("src/staged.js"), "expected staged file detection");
  assert(json.unstaged.includes("src/app.js"), "expected unstaged file detection");
  assert(json.untracked.includes("src/todo.js"), "expected untracked file detection");
});

test("fixture:commit-gate-runner --check-gates runs verify-change", () => {
  const dir = initGitRepo();
  const logFile = path.join(dir, "gate-log.jsonl");
  const fakeChange = createFakeGateScript(
    path.join(dir, "fake-change.js"),
    {
      passed: true,
      total_additions: 1,
      total_deletions: 0,
      affected_modules: ["src"],
      changes: [],
      issues: [],
    }
  );
  const fakeQuality = createFakeGateScript(
    path.join(dir, "fake-quality.js"),
    {
      scan_path: ".",
      files_scanned: 1,
      total_lines: 1,
      total_code_lines: 1,
      passed: true,
      error_count: 0,
      warning_count: 0,
      file_metrics: [],
      issues: [],
    }
  );
  writeFile(path.join(dir, "src", "app.js"), "console.log('gate');\n");
  run("git", ["add", "src/app.js"], { cwd: dir });
  const result = run(node, [commitHelper, "--check-gates", "--json"], {
    cwd: dir,
    env: {
      CCG_VERIFY_CHANGE_SCRIPT: fakeChange,
      CCG_VERIFY_QUALITY_SCRIPT: fakeQuality,
      CCG_GATE_LOG: logFile,
    },
  });
  const json = parseJsonOutput(result);
  const logs = readJsonLines(logFile);
  assert(json.gates["verify-change"].ran === true, "expected verify-change gate to run");
  assert(logs.some((entry) => entry.script === "fake-change.js"), "expected fake verify-change invocation");
});

test("fixture:commit-gate-runner security-sensitive path triggers verify-security", () => {
  const dir = initGitRepo();
  const logFile = path.join(dir, "gate-log.jsonl");
  const fakeChange = createFakeGateScript(
    path.join(dir, "fake-change.js"),
    {
      passed: true,
      total_additions: 1,
      total_deletions: 0,
      affected_modules: ["src"],
      changes: [],
      issues: [],
    }
  );
  const fakeQuality = createFakeGateScript(
    path.join(dir, "fake-quality.js"),
    {
      scan_path: ".",
      files_scanned: 1,
      total_lines: 1,
      total_code_lines: 1,
      passed: true,
      error_count: 0,
      warning_count: 0,
      file_metrics: [],
      issues: [],
    }
  );
  const fakeSecurity = createFakeGateScript(
    path.join(dir, "fake-security.js"),
    {
      scan_path: ".",
      files_scanned: 1,
      passed: true,
      counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      findings: [],
    }
  );
  writeFile(path.join(dir, "src", "auth.js"), "export const authToken = 'x';\n");
  run("git", ["add", "src/auth.js"], { cwd: dir });
  const result = run(node, [commitHelper, "--check-gates", "--json"], {
    cwd: dir,
    env: {
      CCG_VERIFY_CHANGE_SCRIPT: fakeChange,
      CCG_VERIFY_QUALITY_SCRIPT: fakeQuality,
      CCG_VERIFY_SECURITY_SCRIPT: fakeSecurity,
      CCG_GATE_LOG: logFile,
    },
  });
  const json = parseJsonOutput(result);
  const logs = readJsonLines(logFile);
  assert(json.gates["verify-security"].ran === true, "expected verify-security gate to run");
  assert(logs.some((entry) => entry.script === "fake-security.js"), "expected fake verify-security invocation");
});

test("fixture:commit-gate-runner refuses --execute with no staged files", () => {
  const dir = initGitRepo();
  writeFile(path.join(dir, "src", "app.js"), "console.log('no-stage');\n");
  const result = run(node, [commitHelper, "--execute", "--json"], { cwd: dir, allowFailure: true });
  const json = parseJsonOutput(result);
  assert(result.status !== 0, "expected execute refusal without staged files");
  assert(json.staged.length === 0, "expected staged list to be empty");
});

test("fixture:commit-gate-runner refuses --execute when gate fails", () => {
  const dir = initGitRepo();
  const fakeChange = createFakeGateScript(
    path.join(dir, "fake-change.js"),
    {
      passed: true,
      total_additions: 1,
      total_deletions: 0,
      affected_modules: ["src"],
      changes: [],
      issues: [],
    }
  );
  const fakeQuality = createFakeGateScript(
    path.join(dir, "fake-quality.js"),
    {
      scan_path: ".",
      files_scanned: 1,
      total_lines: 1,
      total_code_lines: 1,
      passed: false,
      error_count: 1,
      warning_count: 0,
      file_metrics: [],
      issues: [{ severity: "error", message: "blocked" }],
    },
    1
  );
  writeFile(path.join(dir, "src", "app.js"), "console.log('blocked');\n");
  run("git", ["add", "src/app.js"], { cwd: dir });
  const result = run(node, [commitHelper, "--execute", "--json"], {
    cwd: dir,
    allowFailure: true,
    env: {
      CCG_VERIFY_CHANGE_SCRIPT: fakeChange,
      CCG_VERIFY_QUALITY_SCRIPT: fakeQuality,
    },
  });
  const json = parseJsonOutput(result);
  assert(result.status !== 0, "expected execute refusal when a gate fails");
  assert(json.canCommit === false, "expected canCommit=false when a gate fails");
});

test("fixture:commit-gate-runner executes when staged files and gates pass", () => {
  const dir = initGitRepo();
  const fakeChange = createFakeGateScript(
    path.join(dir, "fake-change.js"),
    {
      passed: true,
      total_additions: 1,
      total_deletions: 0,
      affected_modules: ["src"],
      changes: [],
      issues: [],
    }
  );
  const fakeQuality = createFakeGateScript(
    path.join(dir, "fake-quality.js"),
    {
      scan_path: ".",
      files_scanned: 1,
      total_lines: 1,
      total_code_lines: 1,
      passed: true,
      error_count: 0,
      warning_count: 0,
      file_metrics: [],
      issues: [],
    }
  );
  writeFile(path.join(dir, "src", "app.js"), "console.log('commit');\n");
  run("git", ["add", "src/app.js"], { cwd: dir });
  const result = run(node, [commitHelper, "--execute", "--json"], {
    cwd: dir,
    env: {
      CCG_VERIFY_CHANGE_SCRIPT: fakeChange,
      CCG_VERIFY_QUALITY_SCRIPT: fakeQuality,
    },
  });
  const json = parseJsonOutput(result);
  const commitCount = Number(run("git", ["rev-list", "--count", "HEAD"], { cwd: dir }).stdout.trim());
  assert(json.executed === true, "expected commit execution");
  assert(commitCount === 2, `expected a second commit after execution, got ${commitCount}`);
});

test("fixture:spec spec skills require Codex spec storage", () => {
  for (const command of ["spec-init", "spec-research", "spec-plan", "spec-impl", "spec-review"]) {
    const text = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", `ccg-${command}`, "SKILL.md"), "utf8");
    assert(text.includes(".codex/ccg/specs"), `expected /ccg:${command} to use .codex/ccg/specs`);
  }
  const docs = fs.readFileSync(path.join(repoRoot, "docs", "spec-workflow.md"), "utf8");
  assert(docs.includes(".codex/ccg/specs/<spec-name>"), "expected spec workflow docs");
});

test("fixture:team team skills require ownership and conflict checks", () => {
  const exec = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-team-exec", "SKILL.md"), "utf8");
  const plan = fs.readFileSync(path.join(repoRoot, "plugins", "ccg", "skills", "ccg-team-plan", "SKILL.md"), "utf8");
  const docs = fs.readFileSync(path.join(repoRoot, "docs", "team-workflow.md"), "utf8");
  assert(exec.includes("same file") || exec.includes("same-file"), "expected same-file conflict guidance");
  assert(plan.includes("Workers"), "expected worker ownership plan structure");
  assert(docs.includes("Codex remains final owner"), "expected Codex final owner rule");
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
