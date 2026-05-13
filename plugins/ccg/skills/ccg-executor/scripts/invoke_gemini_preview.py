#!/usr/bin/env python3
"""Run Gemini with a local browser preview.

This is the Codex-side equivalent of CCG's codeagent-wrapper Web UI behavior:
Gemini remains read-only, Codex owns the workspace, and the user can watch
streaming output in a browser while the subprocess runs.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.backend = "gemini"
        self.model = ""
        self.prompt_preview = ""
        self.session_id = ""
        self.content = ""
        self.raw = ""
        self.status = "starting"
        self.done = False
        self.exit_code: int | None = None
        self.started_at = time.strftime("%Y-%m-%d %H:%M:%S")

    def update(self, **kwargs: object) -> None:
        with self.lock:
            for key, value in kwargs.items():
                setattr(self, key, value)

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
                "status": self.status,
                "done": self.done,
                "exit_code": self.exit_code,
                "started_at": self.started_at,
            }


STATE = State()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Gemini with browser preview")
    parser.add_argument("--model", default=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
    parser.add_argument("--workdir", default=os.getcwd())
    parser.add_argument("--prompt", default="")
    parser.add_argument("--prompt-file", default="")
    parser.add_argument("--output-file", default="")
    parser.add_argument("--hold-seconds", type=int, default=10)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--detach", action="store_true", help="Start in the background and return PID/log paths")
    parser.add_argument("--preview-port", type=int, default=0, help=argparse.SUPPRESS)
    parser.add_argument("--approval-mode", default="plan", choices=["default", "auto_edit", "yolo", "plan"])
    parser.add_argument(
        "--direct-workdir",
        action="store_true",
        help="Run Gemini directly in --workdir instead of a disposable snapshot. Unsafe unless you trust the prompt.",
    )
    return parser.parse_args()


def get_prompt(args: argparse.Namespace) -> str:
    if args.prompt_file:
        return Path(args.prompt_file).read_text(encoding="utf-8")
    if args.prompt:
        return args.prompt
    if not sys.stdin.isatty():
        return sys.stdin.read()
    raise SystemExit("ERROR: provide --prompt, --prompt-file, or stdin")


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


def detach(args: argparse.Namespace, prompt: str, output_path: Path) -> int:
    root = output_path.parent
    root.mkdir(parents=True, exist_ok=True)
    stamp = output_path.stem
    prompt_file = Path(args.prompt_file) if args.prompt_file else root / f"{stamp}.prompt.txt"
    if not args.prompt_file:
        prompt_file.write_text(prompt, encoding="utf-8", errors="replace")

    launcher_log = output_path.with_suffix(".launcher.log")
    preview_port = args.preview_port or free_port()
    preview_url = f"http://127.0.0.1:{preview_port}/"
    child_args = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--workdir",
        str(Path(args.workdir).resolve()),
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
        "--preview-port",
        str(preview_port),
        "--no-browser",
    ]
    if args.direct_workdir:
        child_args.append("--direct-workdir")

    creationflags = 0
    if os.name == "nt" and hasattr(subprocess, "CREATE_NO_WINDOW"):
        creationflags = subprocess.CREATE_NO_WINDOW

    log_handle = launcher_log.open("w", encoding="utf-8", errors="replace")
    proc = subprocess.Popen(
        child_args,
        cwd=str(Path(args.workdir).resolve()),
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
    pre {{
      white-space: pre-wrap;
      word-break: break-word;
      font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      margin: 0;
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
    <pre id="output"></pre>
    <div id="done"></div>
  </div>
  <script>
    const output = document.getElementById('output');
    const statusEl = document.getElementById('status');
    const doneEl = document.getElementById('done');
    let lastContent = '';
    let userScrolled = false;
    window.addEventListener('scroll', () => {{
      userScrolled = window.innerHeight + window.scrollY < document.body.scrollHeight - 60;
    }});
    function scrollBottom() {{
      if (!userScrolled) window.scrollTo(0, document.body.scrollHeight);
    }}
    async function tick() {{
      try {{
        const res = await fetch('/state?ts=' + Date.now());
        const state = await res.json();
        statusEl.textContent = state.status + (state.session_id ? ' | ' + state.session_id : '');
        if (state.content !== lastContent) {{
          lastContent = state.content;
          output.textContent = state.content || state.raw || '';
          setTimeout(scrollBottom, 0);
        }}
        if (state.done) {{
          const ok = state.exit_code === 0;
          doneEl.className = ok ? 'done' : 'done failed';
          doneEl.textContent = ok ? 'Completed. You can close this page.' : 'Finished with exit code ' + state.exit_code;
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
    print(f"CCG_GEMINI_PREVIEW_URL={url}", flush=True)
    if open_browser:
        opened = open_preview_url(url)
        print(f"CCG_GEMINI_BROWSER_OPENED={1 if opened else 0}", flush=True)
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


def stream_reader(pipe, output_file, is_stderr: bool = False) -> None:
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

        if event_type == "init":
            STATE.update(status="running")
            continue

        if event_type == "message" and event.get("role") == "assistant":
            STATE.append_content(str(event.get("content", "")))
            continue

        if event_type == "result":
            status = str(event.get("status", "complete"))
            STATE.update(status=status)


def snapshot_ignore(_directory: str, names: list[str]) -> set[str]:
    ignored_names = {
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
    }
    ignored_suffixes = (".pyc", ".pyo", ".log", ".tmp")
    return {name for name in names if name in ignored_names or name.endswith(ignored_suffixes)}


def prepare_gemini_workdir(args: argparse.Namespace) -> tuple[Path, tempfile.TemporaryDirectory[str] | None]:
    source = Path(args.workdir).resolve()
    if args.direct_workdir:
        return source, None

    temp_dir = tempfile.TemporaryDirectory(prefix="ccg-gemini-snapshot-")
    snapshot_path = Path(temp_dir.name) / source.name
    STATE.update(status="snapshotting")
    shutil.copytree(source, snapshot_path, ignore=snapshot_ignore)
    STATE.update(status="snapshot-ready")
    return snapshot_path, temp_dir


def build_prompt_for_gemini(args: argparse.Namespace, prompt: str, gemini_workdir: Path) -> str:
    if args.direct_workdir:
        return prompt

    original = Path(args.workdir).resolve()
    return (
        "You are running inside a disposable read-only-style snapshot of the user's workspace.\n"
        f"Snapshot path: {gemini_workdir}\n"
        f"Original workspace path, for reference only: {original}\n"
        "Do not attempt to modify files. Provide analysis, review findings, test ideas, or unified diffs in your response.\n"
        "Codex will inspect your output and apply any final changes itself.\n\n"
        f"{prompt}"
    )


def run_gemini(args: argparse.Namespace, prompt: str, output_path: Path, gemini_workdir: Path) -> int:
    cmd = build_command(args, gemini_workdir)
    env = os.environ.copy()
    env.setdefault("GOOGLE_CLOUD_LOCATION", "global")
    STATE.update(model=args.model, status="starting")

    with output_path.open("w", encoding="utf-8", errors="replace") as out:
        out.write(f"$ {' '.join(cmd)}\n\n")
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

        stdout_thread = threading.Thread(target=stream_reader, args=(proc.stdout, out, False), daemon=True)
        stderr_thread = threading.Thread(target=stream_reader, args=(proc.stderr, out, True), daemon=True)
        stdout_thread.start()
        stderr_thread.start()

        proc.stdin.write(prompt)
        proc.stdin.close()
        code = proc.wait()
        stdout_thread.join(timeout=2)
        stderr_thread.join(timeout=2)
        return int(code)


def main() -> int:
    args = parse_args()
    prompt = get_prompt(args)
    prompt_preview = prompt[:1200] + ("..." if len(prompt) > 1200 else "")
    STATE.update(model=args.model, prompt_preview=prompt_preview)

    output_path = Path(args.output_file) if args.output_file else default_output_file()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if args.detach:
        return detach(args, prompt, output_path)

    print(f"CCG_GEMINI_OUTPUT_FILE={output_path}", flush=True)

    server, _ = start_server(open_browser=not args.no_browser, port=args.preview_port)
    temp_dir: tempfile.TemporaryDirectory[str] | None = None
    try:
        gemini_workdir, temp_dir = prepare_gemini_workdir(args)
        gemini_prompt = build_prompt_for_gemini(args, prompt, gemini_workdir)
        code = run_gemini(args, gemini_prompt, output_path, gemini_workdir)
        STATE.update(done=True, exit_code=code, status="complete" if code == 0 else "failed")
        response = str(STATE.snapshot().get("content", ""))
        response_path = output_path.with_suffix(".response.txt")
        response_path.write_text(response, encoding="utf-8", errors="replace")
        print(f"CCG_GEMINI_RESPONSE_FILE={response_path}", flush=True)
        print(f"CCG_GEMINI_EXIT_CODE={code}", flush=True)
        print("CCG_GEMINI_RESPONSE_BEGIN", flush=True)
        print(response, flush=True)
        print("CCG_GEMINI_RESPONSE_END", flush=True)
        time.sleep(max(0, args.hold_seconds))
        return code
    finally:
        server.shutdown()
        if temp_dir is not None:
            temp_dir.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
