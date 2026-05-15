#!/usr/bin/env python3
"""Manual ChatGPT Pro bridge for Codex-native CCG workflows.

This helper creates local prompt/response artifacts and, when requested, a
localhost page where the user manually copies a prompt into ChatGPT Pro and
manually pastes the response back. It intentionally does not automate ChatGPT
web login, prompt submission, DOM reading, or output extraction.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import threading
import time
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

PROVIDER = "chatgpt-pro-manual"
MANUAL_QUESTIONS_EXPECTED = 1
MANUAL_QUESTIONS_MAX = 2
TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "gptpro"
ENDPOINTS = ("GET /", "GET /state", "POST /save-response", "POST /mark-copied")
BOUNDARIES = (
    "Do not automate ChatGPT web login",
    "Do not read ChatGPT web DOM",
    "Do not extract ChatGPT Output programmatically",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def slugify(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "gptpro-bridge"


def resolve_output_root(workdir: Path, output_root: Path) -> Path:
    if output_root.is_absolute():
        return output_root
    return workdir / output_root


def display_path(path: Path, workdir: Path) -> str:
    try:
        return path.resolve().relative_to(workdir.resolve()).as_posix()
    except ValueError:
        return str(path.resolve())


def read_template(name: str) -> str:
    file_path = TEMPLATE_DIR / f"{name}.md"
    if not file_path.exists():
        return ""
    return file_path.read_text(encoding="utf-8").strip()


def compose_prompt(mode: str, raw_prompt: str, round_number: int, followup_reason: str | None) -> str:
    sections = [read_template("base")]
    if round_number == 2:
        sections.append(read_template("followup"))
        if followup_reason:
            sections.append(f"## Follow-up Reason\n\n{followup_reason.strip()}")
    sections.append(read_template(mode))
    sections.append("## CCG Input\n\n" + raw_prompt.strip())
    return "\n\n".join(section for section in sections if section).strip() + "\n"


def read_prompt(prompt: str, prompt_file: str) -> str:
    parts: list[str] = []
    if prompt_file:
        parts.append(Path(prompt_file).read_text(encoding="utf-8"))
    if prompt:
        parts.append(prompt)
    combined = "\n\n".join(part.strip() for part in parts if part.strip())
    if not combined:
        raise ValueError("A prompt or --prompt-file is required for the manual bridge.")
    return combined


def ensure_unique_session_dir(output_root: Path, mode: str, slug: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = output_root / f"{stamp}-{mode}-{slug}"
    candidate = base
    counter = 2
    while candidate.exists():
        candidate = output_root / f"{base.name}-{counter}"
        counter += 1
    return candidate


class BridgeSession:
    def __init__(
        self,
        mode: str,
        workdir: Path,
        session_dir: Path,
        round_name: str,
        prompt_file: Path,
        response_file: Path,
        status_file: Path,
    ) -> None:
        self.mode = mode
        self.workdir = workdir
        self.session_dir = session_dir
        self.round_name = round_name
        self.prompt_file = prompt_file
        self.response_file = response_file
        self.status_file = status_file

    def status(self) -> dict[str, Any]:
        return json.loads(self.status_file.read_text(encoding="utf-8"))

    def write_status(self, status: dict[str, Any]) -> None:
        status["updated_at"] = utc_now()
        self.status_file.write_text(json.dumps(status, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def state(self) -> dict[str, Any]:
        status = self.status()
        return {
            "provider": PROVIDER,
            "mode": self.mode,
            "session_dir": str(self.session_dir),
            "round": status.get("current_round", 1),
            "round_name": self.round_name,
            "prompt_file": str(self.prompt_file),
            "response_file": str(self.response_file),
            "status_file": str(self.status_file),
            "prompt": self.prompt_file.read_text(encoding="utf-8"),
            "response_saved": bool(status["rounds"][self.round_name]["response_saved"]),
            "manual_questions_expected": MANUAL_QUESTIONS_EXPECTED,
            "manual_questions_max": MANUAL_QUESTIONS_MAX,
            "web_automation": False,
            "dom_extraction": False,
            "manual_copy_required": True,
        }


def create_session(
    *,
    mode: str,
    workdir: str | Path,
    prompt: str,
    slug: str | None,
    output_root: str | Path,
    round_number: int,
    followup_session: str | Path | None,
    followup_reason: str | None,
) -> BridgeSession:
    if round_number > MANUAL_QUESTIONS_MAX:
        raise ValueError("Maximum manual questions: 2. Decompose the task or return to Codex-native CCG workflows.")
    if round_number < 1:
        raise ValueError("Round must be 1 or 2.")
    if round_number == 2 and not followup_session:
        raise ValueError("Round 2 requires --followup-session. Create round 1 first.")

    workdir_path = Path(workdir).resolve()
    output_root_path = resolve_output_root(workdir_path, Path(output_root)).resolve()
    output_root_path.mkdir(parents=True, exist_ok=True)

    if followup_session:
        session_dir = Path(followup_session).resolve()
        if not session_dir.exists():
            raise ValueError(f"Follow-up session not found: {session_dir}")
        round_number = 2
        status_file = session_dir / "status.json"
        if not status_file.exists():
            raise ValueError(f"Follow-up status file not found: {status_file}")
        status = json.loads(status_file.read_text(encoding="utf-8"))
        slug_value = str(status.get("slug") or slugify(session_dir.name))
        created_at = str(status.get("created_at") or utc_now())
    else:
        slug_value = slugify(slug or prompt[:60])
        session_dir = ensure_unique_session_dir(output_root_path, mode, slug_value).resolve()
        status_file = session_dir / "status.json"
        status = {}
        created_at = utc_now()

    round_name = f"round-{round_number}"
    round_dir = session_dir / round_name
    round_dir.mkdir(parents=True, exist_ok=True)
    prompt_file = round_dir / "prompt.md"
    response_file = round_dir / "response.md"
    prompt_file.write_text(compose_prompt(mode, prompt, round_number, followup_reason), encoding="utf-8")
    if not response_file.exists():
        response_file.write_text("", encoding="utf-8")

    rounds = dict(status.get("rounds") or {})
    rounds[round_name] = {
        "prompt_file": display_path(prompt_file, workdir_path),
        "response_file": display_path(response_file, workdir_path),
        "response_saved": False,
    }

    new_status = {
        "schema_version": 1,
        "provider": PROVIDER,
        "mode": mode,
        "slug": slug_value,
        "created_at": created_at,
        "updated_at": utc_now(),
        "session_dir": display_path(session_dir, workdir_path),
        "current_round": round_number,
        "manual_questions_expected": MANUAL_QUESTIONS_EXPECTED,
        "manual_questions_max": MANUAL_QUESTIONS_MAX,
        "followup_allowed": True,
        "followup_reason": followup_reason,
        "rounds": rounds,
        "manual_copy_required": True,
        "web_automation": False,
        "dom_extraction": False,
        "cookie_storage": False,
        "auto_submit": False,
        "auto_output_read": False,
        "prompt_copied": bool(status.get("prompt_copied", False)),
    }
    status_file.write_text(json.dumps(new_status, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return BridgeSession(mode, workdir_path, session_dir, round_name, prompt_file, response_file, status_file)


def save_response(session: BridgeSession, response_text: str) -> None:
    if not response_text.strip():
        raise ValueError("Manual GPT Pro response cannot be empty.")
    session.response_file.write_text(response_text, encoding="utf-8")
    status = session.status()
    status["rounds"][session.round_name]["response_saved"] = True
    session.write_status(status)


def mark_copied(session: BridgeSession) -> None:
    status = session.status()
    status["prompt_copied"] = True
    session.write_status(status)


def render_page(session: BridgeSession) -> bytes:
    state = session.state()
    prompt = html.escape(str(state["prompt"]))
    response_saved = "yes" if state["response_saved"] else "no"
    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CCG GPT Pro Manual Bridge</title>
  <style>
    body {{
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      margin: 0;
      background: #f6f7f9;
      color: #17202a;
    }}
    main {{ max-width: 1100px; margin: 0 auto; padding: 24px; display: grid; gap: 18px; }}
    section {{ background: #fff; border: 1px solid #d7dde5; border-radius: 8px; padding: 18px; }}
    pre {{
      white-space: pre-wrap;
      word-break: break-word;
      background: #101828;
      color: #f9fafb;
      padding: 14px;
      border-radius: 6px;
      max-height: 45vh;
      overflow: auto;
    }}
    textarea {{
      width: 100%;
      min-height: 220px;
      font: 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      box-sizing: border-box;
    }}
    button, a.button {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-right: 8px;
      padding: 8px 12px;
      border: 1px solid #9aa6b2;
      border-radius: 6px;
      background: #fff;
      color: #17202a;
      text-decoration: none;
      cursor: pointer;
    }}
    button.primary {{ background: #0f766e; border-color: #0f766e; color: white; }}
    dl {{ display: grid; grid-template-columns: max-content 1fr; gap: 8px 14px; }}
    dt {{ font-weight: 700; }}
  </style>
</head>
<body>
<main>
  <section>
    <h1>CCG GPT Pro Manual Bridge</h1>
    <p>
      Manual copy is required. No ChatGPT web automation, no DOM extraction,
      no automatic prompt submission, and no automatic output reading.
    </p>
    <button id="copyPrompt" class="primary">Copy Prompt</button>
    <a class="button" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT</a>
  </section>
  <section>
    <h2>Prompt</h2>
    <pre id="prompt">{prompt}</pre>
  </section>
  <section>
    <h2>Manual Instructions</h2>
    <ol>
      <li>Open ChatGPT Pro.</li>
      <li>Paste the prompt manually.</li>
      <li>Send it manually.</li>
      <li>Copy the ChatGPT output manually.</li>
      <li>Paste it below and save the response.</li>
    </ol>
  </section>
  <section>
    <h2>Response</h2>
    <textarea id="response" placeholder="Paste the manual ChatGPT Pro output here"></textarea>
    <p>
      <button id="saveResponse" class="primary">Save Response</button>
      <span id="saveStatus">response_saved: {response_saved}</span>
    </p>
  </section>
  <section>
    <h2>Status</h2>
    <dl>
      <dt>Session</dt><dd>{html.escape(str(state["session_dir"]))}</dd>
      <dt>Round</dt><dd>{state["round"]}</dd>
      <dt>Prompt file</dt><dd>{html.escape(str(state["prompt_file"]))}</dd>
      <dt>Response file</dt><dd>{html.escape(str(state["response_file"]))}</dd>
      <dt>Manual questions</dt><dd>{MANUAL_QUESTIONS_EXPECTED} expected, {MANUAL_QUESTIONS_MAX} maximum</dd>
    </dl>
  </section>
</main>
<script>
const promptText = document.getElementById('prompt').innerText;
document.getElementById('copyPrompt').addEventListener('click', async () => {{
  await navigator.clipboard.writeText(promptText);
  await fetch('/mark-copied', {{ method: 'POST' }});
}});
document.getElementById('saveResponse').addEventListener('click', async () => {{
  const response = document.getElementById('response').value;
  const result = await fetch('/save-response', {{
    method: 'POST',
    headers: {{ 'Content-Type': 'application/json' }},
    body: JSON.stringify({{ response }})
  }});
  document.getElementById('saveStatus').innerText = result.ok ? 'response_saved: yes' : 'save failed';
}});
</script>
</body>
</html>
"""
    return page.encode("utf-8")


def start_server(session: BridgeSession, open_browser: bool = False) -> tuple[ThreadingHTTPServer, str]:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            return

        def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            if self.path in ("/", "/index.html"):
                body = render_page(session)
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if self.path == "/state":
                self.send_json(session.state())
                return
            self.send_error(404)

        def do_POST(self) -> None:
            if self.path == "/mark-copied":
                mark_copied(session)
                self.send_json({"ok": True})
                return
            if self.path == "/save-response":
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length).decode("utf-8") if length else "{}"
                try:
                    payload = json.loads(body)
                except json.JSONDecodeError:
                    self.send_json({"ok": False, "error": "Invalid JSON"}, status=400)
                    return
                try:
                    save_response(session, str(payload.get("response", "")))
                except ValueError as error:
                    self.send_json({"ok": False, "error": str(error)}, status=400)
                    return
                self.send_json({"ok": True, "response_file": str(session.response_file)})
                return
            self.send_error(404)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    host, port = server.server_address
    url = f"http://{host}:{port}/"
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    if open_browser:
        webbrowser.open(url)
    return server, url


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a manual ChatGPT Pro bridge session")
    parser.add_argument("--mode", choices=["plan", "review", "exc"], required=True)
    parser.add_argument("--workdir", default=".")
    parser.add_argument("--prompt", default="")
    parser.add_argument("--prompt-file", default="")
    parser.add_argument("--slug", default="")
    parser.add_argument("--output-root", default=".codex/ccg/gptpro")
    parser.add_argument("--round", type=int, default=1)
    parser.add_argument("--followup-session", default="")
    parser.add_argument("--followup-reason", default="")
    parser.add_argument("--open-preview", action="store_true")
    parser.add_argument("--open-chatgpt", action="store_true")
    parser.add_argument("--copy-prompt", action="store_true")
    parser.add_argument("--wait-response", action="store_true")
    parser.add_argument("--hold-seconds", type=int, default=0)
    return parser.parse_args(argv)


def print_outputs(session: BridgeSession, preview_url: str) -> None:
    status = session.status()
    print(f"CCG_GPTPRO_PROVIDER={PROVIDER}", flush=True)
    print(f"CCG_GPTPRO_MODE={session.mode}", flush=True)
    print(f"CCG_GPTPRO_SESSION_DIR={session.session_dir}", flush=True)
    print(f"CCG_GPTPRO_ROUND={status['current_round']}", flush=True)
    print(f"CCG_GPTPRO_PROMPT_FILE={session.prompt_file}", flush=True)
    print(f"CCG_GPTPRO_RESPONSE_FILE={session.response_file}", flush=True)
    print(f"CCG_GPTPRO_STATUS_FILE={session.status_file}", flush=True)
    print(f"CCG_GPTPRO_PREVIEW_URL={preview_url}", flush=True)
    print("CCG_GPTPRO_MANUAL_BRIDGE=1", flush=True)
    print("CCG_GPTPRO_WEB_AUTOMATION=0", flush=True)
    print("CCG_GPTPRO_DOM_EXTRACTION=0", flush=True)
    print(f"CCG_GPTPRO_MANUAL_QUESTIONS_EXPECTED={MANUAL_QUESTIONS_EXPECTED}", flush=True)
    print(f"CCG_GPTPRO_MANUAL_QUESTIONS_MAX={MANUAL_QUESTIONS_MAX}", flush=True)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        raw_prompt = read_prompt(args.prompt, args.prompt_file)
        session = create_session(
            mode=args.mode,
            workdir=args.workdir,
            prompt=raw_prompt,
            slug=args.slug,
            output_root=args.output_root,
            round_number=args.round,
            followup_session=args.followup_session or None,
            followup_reason=args.followup_reason or None,
        )
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 2

    server: ThreadingHTTPServer | None = None
    preview_url = ""
    try:
        if args.open_preview or args.wait_response or args.hold_seconds > 0:
            server, preview_url = start_server(session, open_browser=args.open_preview)
        if args.open_chatgpt:
            webbrowser.open("https://chatgpt.com/")
        if args.copy_prompt:
            status = session.status()
            status["prompt_copy_requested"] = True
            session.write_status(status)
        print_outputs(session, preview_url)

        deadline = time.time() + args.hold_seconds if args.hold_seconds > 0 else None
        while args.wait_response and not session.state()["response_saved"]:
            if deadline and time.time() >= deadline:
                break
            time.sleep(1)
        if not args.wait_response and deadline:
            while time.time() < deadline:
                time.sleep(0.2)
    except KeyboardInterrupt:
        return 130
    finally:
        if server:
            server.shutdown()
            server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
