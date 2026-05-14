#!/usr/bin/env python3
"""Run Gemini with a local browser preview.

This is the Codex-side equivalent of CCG's codeagent-wrapper Web UI behavior:
Gemini remains read-only, Codex owns the workspace, and the user can watch
streaming output in a browser while the subprocess runs.
"""

from __future__ import annotations

import argparse
import fnmatch
import html
import json
import os
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROMPT_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "gemini"
PROMPT_TEMPLATES = (
    "none",
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
)


class State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.backend = "gemini"
        self.model = ""
        self.prompt_preview = ""
        self.session_id = ""
        self.content = ""
        self.raw = ""
        self.events: list[dict[str, str]] = []
        self.status = "starting"
        self.done = False
        self.exit_code: int | None = None
        self.auto_close_browser_seconds = 3
        self.output_file = ""
        self.response_file = ""
        self.snapshot_path = ""
        self.snapshot_excludes = ""
        self.stream_events = 0
        self.started_at = time.strftime("%Y-%m-%d %H:%M:%S")

    def update(self, **kwargs: object) -> None:
        with self.lock:
            for key, value in kwargs.items():
                setattr(self, key, value)

    def add_event(self, message: str) -> None:
        if not message:
            return
        with self.lock:
            self.events.append(
                {
                    "time": time.strftime("%H:%M:%S"),
                    "message": message,
                }
            )
            self.events = self.events[-200:]

    def increment_stream_events(self) -> int:
        with self.lock:
            self.stream_events += 1
            return self.stream_events

    def append_content(self, text: str) -> None:
        if not text:
            return
        with self.lock:
            self.content += text

    def append_raw(self, text: str) -> None:
        if not text:
            return
        with self.lock:
            self.raw += text

    def snapshot(self) -> dict[str, object]:
        with self.lock:
            return {
                "backend": self.backend,
                "model": self.model,
                "prompt_preview": self.prompt_preview,
                "session_id": self.session_id,
                "content": self.content,
                "raw": self.raw,
                "events": list(self.events),
                "status": self.status,
                "done": self.done,
                "exit_code": self.exit_code,
                "auto_close_browser_seconds": self.auto_close_browser_seconds,
                "output_file": self.output_file,
                "response_file": self.response_file,
                "snapshot_path": self.snapshot_path,
                "snapshot_excludes": self.snapshot_excludes,
                "stream_events": self.stream_events,
                "started_at": self.started_at,
            }


STATE = State()

SNAPSHOT_IGNORED_NAMES = {
    ".git",
    ".hg",
    ".svn",
    ".idea",
    ".vscode",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".next",
    ".nuxt",
    ".turbo",
    ".cache",
    "node_modules",
    "vendor",
    "dist",
    "build",
    "target",
    "coverage",
    ".venv",
    "venv",
    "env",
    ".aws",
    ".gcp",
    ".azure",
    ".ssh",
    "id_rsa",
    "id_ed25519",
}
SNAPSHOT_IGNORED_SUFFIXES = (
    ".pyc",
    ".pyo",
    ".log",
    ".tmp",
    ".pem",
    ".key",
    ".p12",
    ".pfx",
    ".crt",
)
SNAPSHOT_IGNORED_PREFIXES = (
    ".env.",
    "credentials",
    "service-account",
)
SNAPSHOT_EXCLUDE_SUMMARY = (
    ".env,.env.*,*.pem,*.key,*.p12,*.pfx,*.crt,id_rsa,id_ed25519,"
    ".aws,.gcp,.azure,.ssh,credentials*,service-account*.json,symlinks,junctions"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Gemini with browser preview")
    parser.add_argument("--model", default=os.environ.get("GEMINI_MODEL", "gemini-3.1-pro-preview"))
    parser.add_argument("--workdir", default=os.getcwd())
    parser.add_argument("--prompt", default="")
    parser.add_argument("--prompt-file", default="")
    parser.add_argument("--output-file", default="")
    parser.add_argument("--hold-seconds", type=int, default=10)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--auto-close-browser-seconds", type=int, default=3)
    parser.add_argument("--no-auto-close-browser", action="store_true")
    parser.add_argument(
        "--min-preview-hold-seconds",
        type=int,
        default=5,
        help="Minimum final-state time for visible previews before shutting down the local server.",
    )
    parser.add_argument(
        "--max-snapshot-bytes",
        type=int,
        default=0,
        help="Optional cap for copied snapshot bytes. 0 means unlimited.",
    )
    parser.add_argument(
        "--max-snapshot-files",
        type=int,
        default=0,
        help="Optional cap for copied snapshot files. 0 means unlimited.",
    )
    parser.add_argument(
        "--files-from",
        default="",
        help="Optional newline-delimited file containing relative files/directories to include in the snapshot.",
    )
    parser.add_argument(
        "--respect-gitignore",
        action="store_true",
        help="Also apply a lightweight subset of .gitignore rules when creating the snapshot.",
    )
    parser.add_argument("--detach", action="store_true", help="Start in the background and return PID/log paths")
    parser.add_argument("--preview-port", type=int, default=0, help=argparse.SUPPRESS)
    parser.add_argument("--approval-mode", default="plan", choices=["default", "auto_edit", "yolo", "plan"])
    parser.add_argument("--prompt-template", default="general", choices=PROMPT_TEMPLATES)
    parser.add_argument(
        "--direct-workdir",
        action="store_true",
        help="Run Gemini directly in --workdir instead of a disposable snapshot. Unsafe unless you trust the prompt.",
    )
    return parser.parse_args()


def get_prompt(args: argparse.Namespace) -> str:
    if args.prompt_file:
        return resolve_cli_file(args.prompt_file).read_text(encoding="utf-8")
    if args.prompt:
        return args.prompt
    if not sys.stdin.isatty():
        return sys.stdin.read()
    raise SystemExit("ERROR: provide --prompt, --prompt-file, or stdin")


def read_prompt_template(name: str) -> str:
    path = PROMPT_TEMPLATE_DIR / f"{name}.md"
    if not path.exists():
        raise SystemExit(f"ERROR: Gemini prompt template not found: {path}")
    return path.read_text(encoding="utf-8")


def apply_prompt_template(args: argparse.Namespace, prompt: str) -> str:
    template_name = getattr(args, "prompt_template", "general")
    if template_name == "none":
        return prompt

    base = read_prompt_template("base")
    role = read_prompt_template(template_name)
    return (
        f"{base.rstrip()}\n\n"
        f"{role.rstrip()}\n\n"
        "# User Task\n\n"
        f"{prompt.strip()}\n"
    )


def resolve_cli_file(value: str) -> Path:
    return Path(value).expanduser().resolve()


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for_port(port: int, timeout_seconds: float = 10.0) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.3):
                return True
        except OSError:
            time.sleep(0.15)
    return False


def open_preview_url(url: str) -> bool:
    if os.name == "nt":
        creationflags = 0
        if hasattr(subprocess, "CREATE_NO_WINDOW"):
            creationflags = subprocess.CREATE_NO_WINDOW
        for command in (
            ["cmd", "/c", "start", "", url],
            ["explorer.exe", url],
        ):
            try:
                subprocess.Popen(
                    command,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=creationflags,
                )
                return True
            except Exception:
                continue

    try:
        if webbrowser.open_new_tab(url):
            return True
    except Exception:
        pass

    return False


def default_output_file() -> Path:
    root = Path.home() / ".codex" / "ccg" / "logs"
    root.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    return root / f"gemini-preview-{stamp}.txt"


def effective_hold_seconds(args: argparse.Namespace) -> int:
    hold = max(0, int(getattr(args, "hold_seconds", 0) or 0))
    min_preview_hold = max(0, int(getattr(args, "min_preview_hold_seconds", 0) or 0))
    preview_is_visible = not getattr(args, "no_browser", False) or int(getattr(args, "preview_port", 0) or 0) > 0
    if preview_is_visible:
        return max(hold, min_preview_hold)
    return hold


def detach(args: argparse.Namespace, prompt: str, output_path: Path) -> int:
    root = output_path.parent
    root.mkdir(parents=True, exist_ok=True)
    stamp = output_path.stem
    prompt_file = resolve_cli_file(args.prompt_file) if args.prompt_file else root / f"{stamp}.prompt.txt"
    if not args.prompt_file:
        prompt_file.write_text(prompt, encoding="utf-8", errors="replace")

    launcher_log = output_path.with_suffix(".launcher.log")
    preview_port = args.preview_port or free_port()
    preview_url = f"http://127.0.0.1:{preview_port}/"
    workdir_path = resolve_cli_file(args.workdir)
    child_args = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--workdir",
        str(workdir_path),
        "--model",
        args.model,
        "--prompt-file",
        str(prompt_file),
        "--output-file",
        str(output_path),
        "--hold-seconds",
        str(args.hold_seconds),
        "--approval-mode",
        args.approval_mode,
        "--prompt-template",
        args.prompt_template,
        "--auto-close-browser-seconds",
        str(args.auto_close_browser_seconds),
        "--min-preview-hold-seconds",
        str(args.min_preview_hold_seconds),
        "--max-snapshot-bytes",
        str(args.max_snapshot_bytes),
        "--max-snapshot-files",
        str(args.max_snapshot_files),
        "--preview-port",
        str(preview_port),
        "--no-browser",
    ]
    if args.files_from:
        child_args.extend(["--files-from", str(resolve_cli_file(args.files_from))])
    if args.respect_gitignore:
        child_args.append("--respect-gitignore")
    if args.direct_workdir:
        child_args.append("--direct-workdir")
    if args.no_auto_close_browser:
        child_args.append("--no-auto-close-browser")

    creationflags = 0
    if os.name == "nt" and hasattr(subprocess, "CREATE_NO_WINDOW"):
        creationflags = subprocess.CREATE_NO_WINDOW

    log_handle = launcher_log.open("w", encoding="utf-8", errors="replace")
    proc = subprocess.Popen(
        child_args,
        cwd=str(workdir_path),
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        creationflags=creationflags,
        close_fds=True,
    )
    log_handle.close()

    print(f"CCG_GEMINI_PREVIEW_PID={proc.pid}", flush=True)
    print(f"CCG_GEMINI_PREVIEW_URL={preview_url}", flush=True)
    print(f"CCG_GEMINI_OUTPUT_FILE={output_path}", flush=True)
    print(f"CCG_GEMINI_RESPONSE_FILE={output_path.with_suffix('.response.txt')}", flush=True)
    print(f"CCG_GEMINI_LAUNCHER_LOG={launcher_log}", flush=True)
    print(f"CCG_GEMINI_PROMPT_TEMPLATE={args.prompt_template}", flush=True)
    auto_close = 0 if args.no_auto_close_browser else max(0, args.auto_close_browser_seconds)
    print(f"CCG_GEMINI_AUTO_CLOSE_BROWSER_SECONDS={auto_close}", flush=True)
    if not args.no_browser:
        ready = wait_for_port(preview_port)
        opened = open_preview_url(preview_url) if ready else False
        print(f"CCG_GEMINI_PREVIEW_READY={1 if ready else 0}", flush=True)
        print(f"CCG_GEMINI_BROWSER_OPENED={1 if opened else 0}", flush=True)
    return 0


def make_handler() -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args: object) -> None:
            return

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/" or self.path.startswith("/?"):
                body = self.index_html().encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            if self.path.startswith("/state"):
                body = json.dumps(STATE.snapshot(), ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            self.send_response(404)
            self.end_headers()

        @staticmethod
        def index_html() -> str:
            snap = STATE.snapshot()
            model = html.escape(str(snap["model"]))
            prompt = html.escape(str(snap["prompt_preview"]))
            auto_close = int(snap.get("auto_close_browser_seconds", 0) or 0)
            return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Gemini Preview - {model}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: #0d1117;
      color: #c9d1d9;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
    }}
    header {{
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
      border-bottom: 1px solid #30363d;
      background: #161b22;
      position: sticky;
      top: 0;
    }}
    .badge {{
      background: #8957e5;
      color: white;
      font-weight: 700;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 12px;
    }}
    .title {{ color: #a371f7; font-weight: 650; }}
    .status {{ margin-left: auto; color: #8b949e; font-size: 12px; }}
    .wrap {{ padding: 16px 18px; }}
    .task {{
      color: #58a6ff;
      border-bottom: 1px solid #30363d;
      padding-bottom: 12px;
      margin-bottom: 14px;
      white-space: pre-wrap;
    }}
    .grid {{
      display: grid;
      grid-template-columns: minmax(260px, 0.9fr) minmax(320px, 1.6fr);
      gap: 14px;
      align-items: start;
    }}
    .panel {{
      border: 1px solid #30363d;
      border-radius: 8px;
      background: #0d1117;
      min-height: 120px;
      overflow: hidden;
    }}
    .panel h2 {{
      margin: 0;
      padding: 10px 12px;
      border-bottom: 1px solid #30363d;
      color: #c9d1d9;
      background: #161b22;
      font-size: 13px;
      font-weight: 650;
    }}
    .panel-body {{ padding: 12px; }}
    .meta {{
      display: grid;
      gap: 6px;
      color: #8b949e;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      overflow-wrap: anywhere;
    }}
    .timeline {{
      display: grid;
      gap: 8px;
      max-height: 360px;
      overflow: auto;
    }}
    .event {{
      display: grid;
      grid-template-columns: 64px 1fr;
      gap: 8px;
      color: #c9d1d9;
      font-size: 12px;
    }}
    .event-time {{ color: #8b949e; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }}
    details summary {{
      cursor: pointer;
      color: #8b949e;
      padding: 10px 12px;
      border-top: 1px solid #30363d;
      background: #161b22;
      font-size: 12px;
    }}
    pre {{
      white-space: pre-wrap;
      word-break: break-word;
      font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      margin: 0;
      max-height: 520px;
      overflow: auto;
    }}
    .done {{ margin-top: 16px; color: #3fb950; }}
    .failed {{ color: #f85149; }}
  </style>
</head>
<body>
  <header>
    <span class="badge">GEM</span>
    <span class="title">Gemini Live Output</span>
    <span class="status" id="status">starting</span>
  </header>
  <div class="wrap">
    <div class="task"><strong>Task preview</strong><br>{prompt}</div>
    <div class="grid">
      <section class="panel">
        <h2>Process</h2>
        <div class="panel-body">
          <div class="meta">
            <div>Started: <span id="started"></span></div>
            <div>Model: <span id="model"></span></div>
            <div>Stream events: <span id="streamEvents">0</span></div>
            <div>Snapshot: <span id="snapshotPath"></span></div>
            <div>Response file: <span id="responseFile"></span></div>
          </div>
        </div>
        <div class="panel-body timeline" id="timeline"></div>
      </section>
      <section class="panel">
        <h2>Parsed Gemini Output</h2>
        <div class="panel-body"><pre id="output"></pre></div>
        <details>
          <summary>Raw stream-json / stderr log</summary>
          <div class="panel-body"><pre id="rawOutput"></pre></div>
        </details>
      </section>
    </div>
    <div id="done"></div>
  </div>
  <script>
    const output = document.getElementById('output');
    const rawOutput = document.getElementById('rawOutput');
    const statusEl = document.getElementById('status');
    const doneEl = document.getElementById('done');
    const timeline = document.getElementById('timeline');
    const started = document.getElementById('started');
    const modelEl = document.getElementById('model');
    const streamEvents = document.getElementById('streamEvents');
    const snapshotPath = document.getElementById('snapshotPath');
    const responseFile = document.getElementById('responseFile');
    let lastContent = '';
    let lastRaw = '';
    let lastEvents = '';
    let userScrolled = false;
    window.addEventListener('scroll', () => {{
      userScrolled = window.innerHeight + window.scrollY < document.body.scrollHeight - 60;
    }});
    function scrollBottom() {{
      if (!userScrolled) window.scrollTo(0, document.body.scrollHeight);
    }}
    function escapeHtml(value) {{
      const map = {{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}};
      return String(value || '').replace(/[&<>"']/g, c => map[c]);
    }}
    async function tick() {{
      try {{
        const res = await fetch('/state?ts=' + Date.now());
        const state = await res.json();
        statusEl.textContent = state.status + (state.session_id ? ' | ' + state.session_id : '');
        started.textContent = state.started_at || '';
        modelEl.textContent = state.model || '';
        streamEvents.textContent = String(state.stream_events || 0);
        snapshotPath.textContent = state.snapshot_path || '';
        responseFile.textContent = state.response_file || '';
        const eventKey = JSON.stringify(state.events || []);
        if (eventKey !== lastEvents) {{
          lastEvents = eventKey;
          timeline.innerHTML = (state.events || []).map((event) => (
            '<div class="event"><span class="event-time">' +
            escapeHtml(event.time) +
            '</span><span>' +
            escapeHtml(event.message) +
            '</span></div>'
          )).join('');
          timeline.scrollTop = timeline.scrollHeight;
        }}
        if (state.content !== lastContent) {{
          lastContent = state.content;
          output.textContent = state.content || '';
          setTimeout(scrollBottom, 0);
        }}
        if (state.raw !== lastRaw) {{
          lastRaw = state.raw;
          rawOutput.textContent = state.raw || '';
        }}
        if (state.done) {{
          const ok = state.exit_code === 0;
          doneEl.className = ok ? 'done' : 'done failed';
          const autoClose = Number(state.auto_close_browser_seconds || {auto_close});
          doneEl.textContent = ok
            ? (autoClose > 0 ? 'Completed. Closing preview...' : 'Completed. You can close this page.')
            : 'Finished with exit code ' + state.exit_code;
          if (autoClose > 0) {{
            setTimeout(() => {{
              window.close();
              setTimeout(() => {{
                doneEl.textContent = ok ? 'Completed. You can close this page.' : doneEl.textContent;
              }}, 700);
            }}, autoClose * 1000);
          }}
          return;
        }}
      }} catch (e) {{}}
      setTimeout(tick, 500);
    }}
    tick();
  </script>
</body>
</html>"""

    return Handler


def start_server(open_browser: bool, port: int = 0) -> tuple[ThreadingHTTPServer, str]:
    port = port or free_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler())
    url = f"http://127.0.0.1:{port}/"
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    STATE.add_event(f"Preview server started: {url}")
    print(f"CCG_GEMINI_PREVIEW_URL={url}", flush=True)
    if open_browser:
        opened = open_preview_url(url)
        print(f"CCG_GEMINI_BROWSER_OPENED={1 if opened else 0}", flush=True)
        STATE.add_event(f"Browser open attempted: {'yes' if opened else 'no'}")
    return server, url


def build_command(args: argparse.Namespace, gemini_workdir: Path) -> list[str]:
    cmd = resolve_gemini_invocation() + [
        "-m",
        args.model,
        "--approval-mode",
        args.approval_mode,
        "--output-format",
        "stream-json",
        "--skip-trust",
    ]
    workdir = str(gemini_workdir.resolve())
    if workdir:
        cmd.extend(["--include-directories", workdir])
    cmd.extend(["-p", "Read the complete task from stdin and respond with the requested output."])
    return cmd


def resolve_gemini_invocation() -> list[str]:
    for name in ("gemini.cmd", "gemini.exe", "gemini"):
        path = shutil.which(name)
        if path:
            return [path]

    ps1 = shutil.which("gemini.ps1")
    if ps1:
        return ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1]

    raise SystemExit("ERROR: gemini CLI not found in PATH")


def extract_text_node(node: object) -> str:
    if node is None:
        return ""
    if isinstance(node, str):
        return node
    if isinstance(node, (int, float, bool)):
        return ""
    if isinstance(node, list):
        return "".join(extract_text_node(item) for item in node)
    if isinstance(node, dict):
        text = []
        node_type = str(node.get("type", "")).lower()
        if node_type in {"text", "output_text"} and isinstance(node.get("text"), str):
            text.append(str(node.get("text", "")))
        for key in ("text", "output_text", "content", "parts", "delta"):
            if key in node:
                if key == "text" and node_type in {"text", "output_text"}:
                    continue
                text.append(extract_text_node(node.get(key)))
        return "".join(text)
    return ""


def extract_event_text(event: object) -> str:
    if not isinstance(event, dict):
        return ""

    event_type = str(event.get("type", "")).lower()
    role = str(event.get("role", "")).lower()
    if role and role not in {"assistant", "model", "gemini"}:
        return ""

    if event_type == "message":
        return "".join(
            extract_text_node(event.get(key))
            for key in ("content", "parts", "delta", "text", "output_text")
            if key in event
        )

    if event_type in {"content", "delta", "chunk", "text", "output_text", "response"}:
        return "".join(
            extract_text_node(event.get(key))
            for key in ("content", "parts", "delta", "text", "output_text")
            if key in event
        ) or extract_text_node(event)

    if event_type == "result":
        return "".join(
            extract_text_node(event.get(key))
            for key in ("content", "parts", "response", "text", "output_text")
            if key in event
        )

    return ""


def stream_output(pipe, output_file, is_stderr: bool = False) -> None:
    for line in pipe:
        if not line:
            continue
        STATE.append_raw(line)
        output_file.write(line)
        output_file.flush()

        if is_stderr:
            continue

        raw = line.strip()
        if "{" in raw and not raw.startswith("{"):
            raw = raw[raw.find("{") :]
        try:
            event = json.loads(raw)
        except Exception:
            continue

        event_type = event.get("type", "")
        session_id = event.get("session_id") or event.get("sessionId")
        if session_id:
            STATE.update(session_id=session_id)
        event_count = STATE.increment_stream_events()
        if event_count <= 5 or event_count % 25 == 0:
            STATE.add_event(f"stream event {event_count}: {event_type or 'unknown'}")

        if event_type == "init":
            STATE.update(status="running")
            STATE.add_event("Gemini stream initialized")
            continue

        extracted = extract_event_text(event)
        if extracted:
            STATE.update(status="streaming")
            STATE.append_content(extracted)
            STATE.add_event(f"parsed assistant text chunk: {len(extracted)} chars")

        if event_type == "result":
            status = str(event.get("status", "complete"))
            STATE.update(status=status)
            STATE.add_event(f"Gemini result status: {status}")


def is_snapshot_ignored(name: str) -> bool:
    lower = name.lower()
    if lower in SNAPSHOT_IGNORED_NAMES:
        return True
    if lower == ".env" or lower.startswith(SNAPSHOT_IGNORED_PREFIXES):
        return True
    if lower.endswith(SNAPSHOT_IGNORED_SUFFIXES):
        return True
    if lower.startswith("service-account") and lower.endswith(".json"):
        return True
    return False


def is_snapshot_link(path: Path) -> bool:
    try:
        if path.is_symlink():
            return True
        is_junction = getattr(path, "is_junction", None)
        if is_junction and is_junction():
            return True
        if os.name == "nt":
            attrs = getattr(path.lstat(), "st_file_attributes", 0)
            reparse = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
            return bool(attrs & reparse)
        return False
    except OSError:
        return True


def normalize_relative_path(value: str) -> str:
    return value.replace("\\", "/").strip("/")


def load_pattern_file(path: Path) -> list[str]:
    if not path.exists() or not path.is_file():
        return []
    patterns = []
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        patterns.append(line)
    return patterns


def load_snapshot_patterns(source: Path, respect_gitignore: bool) -> list[str]:
    patterns = load_pattern_file(source / ".ccgignore")
    if respect_gitignore:
        patterns.extend(load_pattern_file(source / ".gitignore"))
    return patterns


def pattern_matches(pattern: str, rel_path: str, name: str, is_dir: bool) -> bool:
    directory_only = pattern.strip().endswith("/")
    normalized = normalize_relative_path(pattern)
    if not normalized:
        return False
    if directory_only:
        if not is_dir:
            return False
    if normalized.startswith("/"):
        normalized = normalized.lstrip("/")

    candidates = {rel_path, name}
    if fnmatch.fnmatch(rel_path, normalized) or fnmatch.fnmatch(name, normalized):
        return True
    if "/" in normalized:
        return rel_path == normalized or rel_path.startswith(normalized + "/")
    return normalized in candidates


def is_user_ignored(patterns: list[str], rel_path: str, name: str, is_dir: bool) -> bool:
    return any(pattern_matches(pattern, rel_path, name, is_dir) for pattern in patterns)


def load_include_paths(files_from: str, source: Path) -> set[str]:
    if not files_from:
        return set()
    include_file = resolve_cli_file(files_from)
    includes = set()
    for raw in include_file.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        candidate = Path(line)
        if candidate.is_absolute():
            try:
                line = str(candidate.resolve().relative_to(source.resolve()))
            except ValueError:
                continue
        includes.add(normalize_relative_path(line))
    return includes


def is_included_by_files_from(rel_path: str, includes: set[str], is_dir: bool) -> bool:
    if not includes:
        return True
    if rel_path in includes:
        return True
    for include in includes:
        if rel_path.startswith(include + "/"):
            return True
        if is_dir and include.startswith(rel_path + "/"):
            return True
    return False


def copy_snapshot_tree(source: Path, target: Path, args: argparse.Namespace) -> dict[str, object]:
    patterns = load_snapshot_patterns(source, bool(getattr(args, "respect_gitignore", False)))
    includes = load_include_paths(str(getattr(args, "files_from", "") or ""), source)
    max_bytes = max(0, int(getattr(args, "max_snapshot_bytes", 0) or 0))
    max_files = max(0, int(getattr(args, "max_snapshot_files", 0) or 0))
    stats: dict[str, object] = {
        "files": 0,
        "dirs": 0,
        "bytes": 0,
        "skipped_secret_or_link": 0,
        "skipped_user_ignore": 0,
        "skipped_include_filter": 0,
        "skipped_cap": 0,
        "skipped_error": 0,
        "patterns": len(patterns),
        "includes": len(includes),
    }

    def bump(key: str, amount: int = 1) -> None:
        stats[key] = int(stats.get(key, 0)) + amount

    def copy_dir(src: Path, dst: Path, rel: str = "") -> None:
        try:
            entries = sorted(src.iterdir(), key=lambda item: item.name.lower())
        except OSError:
            bump("skipped_error")
            return

        dst.mkdir(parents=True, exist_ok=True)
        bump("dirs")
        for entry in entries:
            entry_rel = normalize_relative_path(f"{rel}/{entry.name}" if rel else entry.name)
            is_dir = entry.is_dir() and not is_snapshot_link(entry)

            if is_snapshot_ignored(entry.name) or is_snapshot_link(entry):
                bump("skipped_secret_or_link")
                continue
            if not is_included_by_files_from(entry_rel, includes, is_dir):
                bump("skipped_include_filter")
                continue
            if is_user_ignored(patterns, entry_rel, entry.name, is_dir):
                bump("skipped_user_ignore")
                continue

            if is_dir:
                copy_dir(entry, dst / entry.name, entry_rel)
                continue
            if not entry.is_file():
                bump("skipped_error")
                continue

            try:
                size = entry.stat().st_size
            except OSError:
                bump("skipped_error")
                continue
            if max_files and int(stats["files"]) + 1 > max_files:
                bump("skipped_cap")
                continue
            if max_bytes and int(stats["bytes"]) + size > max_bytes:
                bump("skipped_cap")
                continue

            try:
                target_file = dst / entry.name
                target_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(entry, target_file)
                bump("files")
                bump("bytes", int(size))
            except OSError:
                bump("skipped_error")

    copy_dir(source, target)
    return stats


def snapshot_ignore(directory: str, names: list[str]) -> set[str]:
    ignored = set()
    base = Path(directory)
    for name in names:
        if is_snapshot_ignored(name) or is_snapshot_link(base / name):
            ignored.add(name)
    return ignored


def prepare_gemini_workdir(args: argparse.Namespace) -> tuple[Path, tempfile.TemporaryDirectory[str] | None]:
    source = resolve_cli_file(args.workdir)
    if args.direct_workdir:
        STATE.add_event(f"Using direct workdir: {source}")
        return source, None

    temp_dir = tempfile.TemporaryDirectory(prefix="ccg-gemini-snapshot-")
    snapshot_path = Path(temp_dir.name) / source.name
    STATE.update(status="snapshotting")
    STATE.add_event(f"Creating Gemini snapshot from {source}")
    stats = copy_snapshot_tree(source, snapshot_path, args)
    print(f"CCG_GEMINI_SNAPSHOT_PATH={snapshot_path}", flush=True)
    print(f"CCG_GEMINI_SNAPSHOT_EXCLUDES={SNAPSHOT_EXCLUDE_SUMMARY}", flush=True)
    print(f"CCG_GEMINI_SNAPSHOT_FILES={stats['files']}", flush=True)
    print(f"CCG_GEMINI_SNAPSHOT_BYTES={stats['bytes']}", flush=True)
    print(
        "CCG_GEMINI_SNAPSHOT_SKIPPED="
        f"secret_or_link:{stats['skipped_secret_or_link']},"
        f"user_ignore:{stats['skipped_user_ignore']},"
        f"include_filter:{stats['skipped_include_filter']},"
        f"cap:{stats['skipped_cap']},"
        f"error:{stats['skipped_error']}",
        flush=True,
    )
    STATE.update(
        snapshot_path=str(snapshot_path),
        snapshot_excludes=SNAPSHOT_EXCLUDE_SUMMARY,
        status="snapshot-ready",
    )
    STATE.add_event(
        f"Snapshot ready: {stats['files']} files, {stats['bytes']} bytes, "
        f"skipped cap={stats['skipped_cap']}"
    )
    STATE.update(status="snapshot-ready")
    return snapshot_path, temp_dir


def build_prompt_for_gemini(args: argparse.Namespace, prompt: str, gemini_workdir: Path) -> str:
    if args.direct_workdir:
        return prompt

    original = resolve_cli_file(args.workdir)
    return (
        "You are running inside a disposable read-only-style snapshot of the user's workspace.\n"
        f"Snapshot path: {gemini_workdir}\n"
        f"Original workspace path, for reference only: {original}\n"
        "Do not attempt to modify files. Provide analysis, review findings, "
        "test ideas, or unified diffs in your response.\n"
        "Codex will inspect your output and apply any final changes itself.\n\n"
        f"{prompt}"
    )


def run_gemini(args: argparse.Namespace, prompt: str, output_path: Path, gemini_workdir: Path) -> int:
    cmd = build_command(args, gemini_workdir)
    env = os.environ.copy()
    env.setdefault("GOOGLE_CLOUD_LOCATION", "global")
    STATE.update(model=args.model, status="starting")
    STATE.add_event(f"Launching Gemini model {args.model}")

    with output_path.open("w", encoding="utf-8", errors="replace") as out:
        out.write(f"$ {' '.join(cmd)}\n\n")
        STATE.add_event("Gemini process started")
        proc = subprocess.Popen(
            cmd,
            cwd=str(gemini_workdir.resolve()),
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )

        assert proc.stdin is not None
        assert proc.stdout is not None
        assert proc.stderr is not None

        stdout_thread = threading.Thread(
            target=stream_output,
            args=(proc.stdout, out, False),
            daemon=True,
        )
        stderr_thread = threading.Thread(
            target=stream_output,
            args=(proc.stderr, out, True),
            daemon=True,
        )
        stdout_thread.start()
        stderr_thread.start()

        proc.stdin.write(prompt)
        proc.stdin.close()
        STATE.add_event("Prompt sent to Gemini stdin")
        code = proc.wait()
        stdout_thread.join(timeout=2)
        stderr_thread.join(timeout=2)
        STATE.add_event(f"Gemini process exited with code {code}")
        return int(code)


def main() -> int:
    args = parse_args()
    raw_prompt = get_prompt(args)
    prompt_preview = raw_prompt[:1200] + ("..." if len(raw_prompt) > 1200 else "")
    STATE.update(model=args.model, prompt_preview=prompt_preview)
    auto_close = 0 if args.no_auto_close_browser else max(0, args.auto_close_browser_seconds)
    STATE.update(auto_close_browser_seconds=auto_close)

    output_path = resolve_cli_file(args.output_file) if args.output_file else default_output_file()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    response_path = output_path.with_suffix(".response.txt")
    STATE.update(output_file=str(output_path), response_file=str(response_path))
    STATE.add_event(f"Output file: {output_path}")
    STATE.add_event(f"Response file: {response_path}")
    if args.detach:
        return detach(args, raw_prompt, output_path)

    prompt = apply_prompt_template(args, raw_prompt)

    print(f"CCG_GEMINI_OUTPUT_FILE={output_path}", flush=True)
    print(f"CCG_GEMINI_PROMPT_TEMPLATE={args.prompt_template}", flush=True)
    print(f"CCG_GEMINI_AUTO_CLOSE_BROWSER_SECONDS={auto_close}", flush=True)

    server, _ = start_server(open_browser=not args.no_browser, port=args.preview_port)
    temp_dir: tempfile.TemporaryDirectory[str] | None = None
    try:
        gemini_workdir, temp_dir = prepare_gemini_workdir(args)
        gemini_prompt = build_prompt_for_gemini(args, prompt, gemini_workdir)
        code = run_gemini(args, gemini_prompt, output_path, gemini_workdir)
        STATE.update(status="writing-response")
        STATE.add_event("Writing parsed Gemini response file")
        response = str(STATE.snapshot().get("content", ""))
        response_path.write_text(response, encoding="utf-8", errors="replace")
        STATE.add_event(f"Response file written: {response_path}")
        STATE.update(done=True, exit_code=code, status="complete" if code == 0 else "failed")
        STATE.add_event("Preview will auto-close after completion" if auto_close > 0 else "Preview auto-close disabled")
        print(f"CCG_GEMINI_RESPONSE_FILE={response_path}", flush=True)
        print(f"CCG_GEMINI_EXIT_CODE={code}", flush=True)
        print("CCG_GEMINI_RESPONSE_BEGIN", flush=True)
        print(response, flush=True)
        print("CCG_GEMINI_RESPONSE_END", flush=True)
        time.sleep(effective_hold_seconds(args))
        return code
    finally:
        server.shutdown()
        if temp_dir is not None:
            temp_dir.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
