#!/usr/bin/env python3
"""Manual ChatGPT Pro bridge for Codex-native CCG workflows.

This helper creates local prompt/response artifacts and, when requested, a
localhost page where the user manually copies a prompt into ChatGPT Pro and
manually pastes the response back. It intentionally does not automate ChatGPT
web login, prompt submission, DOM reading, or output extraction.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

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
GEMINI_POLICIES = ("required", "optional", "none")
GEMINI_EVIDENCE_ROLES = ("gate", "frontend-prototype", "frontend-review")
CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")
WINDOWS_DRIVE_PATTERN = re.compile(r"^[A-Za-z]:[\\/]")
SCP_LIKE_REMOTE_PATTERN = re.compile(r"^(?:([^@/:\\]+)@)?([A-Za-z0-9.-]+):(.+)$")


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


def display_gate_response_file(gemini_gate: dict[str, Any], workdir: Path) -> str:
    response_value = str(gemini_gate.get("response_file") or "")
    if not response_value:
        return ""
    response_path = Path(response_value)
    if not response_path.is_absolute():
        return response_value
    return display_path(response_path, workdir)


def run_git_result(workdir: Path, args: list[str]) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            ["git", "-C", str(workdir), *args],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return False, ""
    if result.returncode != 0:
        return False, ""
    return True, result.stdout.strip()


def run_git(workdir: Path, args: list[str]) -> str:
    ok, output = run_git_result(workdir, args)
    return output if ok else ""


def is_local_path_like(value: str) -> bool:
    candidate = value.strip()
    if not candidate:
        return False
    return (
        candidate.startswith("/")
        or candidate.startswith("~")
        or candidate.startswith("\\\\")
        or WINDOWS_DRIVE_PATTERN.match(candidate) is not None
        or ("\\" in candidate and "://" not in candidate)
    )


def normalize_remote_path(path_value: str) -> str:
    path = path_value.strip().split("?", 1)[0].split("#", 1)[0].lstrip("/").removesuffix(".git")
    if not path or path.startswith((".", "~")) or "\\" in path:
        return ""
    return path


def sanitize_repository_url(value: str) -> str:
    raw = value.strip()
    if not raw or CONTROL_CHAR_PATTERN.search(raw):
        return ""
    if raw.lower().startswith("file:") or is_local_path_like(raw):
        return ""

    scp_match = SCP_LIKE_REMOTE_PATTERN.match(raw) if "://" not in raw else None
    if scp_match:
        host = scp_match.group(2).lower()
        path = normalize_remote_path(scp_match.group(3))
        if not path:
            return ""
        return f"https://{host}/{path}"

    try:
        parsed = urlsplit(raw)
    except ValueError:
        return ""
    if not parsed.scheme and not parsed.netloc:
        return ""
    if parsed.scheme not in {"http", "https", "ssh", "git"}:
        return ""
    if not parsed.hostname:
        return ""
    path = normalize_remote_path(parsed.path)
    if not path:
        return ""
    host = parsed.hostname.lower()
    if parsed.port:
        host = f"{host}:{parsed.port}"
    scheme = "https" if parsed.scheme in {"ssh", "git"} else parsed.scheme
    return urlunsplit((scheme, host, "/" + path, "", ""))


def detect_project_context(workdir: str | Path, repo_url: str = "") -> dict[str, Any]:
    workdir_path = Path(workdir).resolve()
    git_root = run_git(workdir_path, ["rev-parse", "--show-toplevel"])
    is_git_worktree = bool(git_root)
    git_root_path = Path(git_root).resolve() if is_git_worktree else workdir_path
    detected_url = repo_url or run_git(git_root_path, ["remote", "get-url", "origin"])
    status_ok, status_short = run_git_result(git_root_path, ["status", "--short"])
    if not is_git_worktree:
        status_summary = "not_git"
        dirty: bool | None = None
    elif not status_ok:
        status_summary = "unknown"
        dirty = None
    elif status_short:
        status_summary = "dirty"
        dirty = True
    else:
        status_summary = "clean"
        dirty = False
    context = {
        "project_name": git_root_path.name,
        "repository_url": sanitize_repository_url(detected_url),
        "branch": run_git(git_root_path, ["branch", "--show-current"]) or "",
        "commit": run_git(git_root_path, ["rev-parse", "HEAD"]) or "",
        "dirty": dirty,
        "status_summary": status_summary,
    }
    context["github_context_hint"] = bool(context["repository_url"])
    return context


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for_port(port: int, timeout_seconds: float = 10.0) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.1)
    return False


def read_template(name: str) -> str:
    file_path = TEMPLATE_DIR / f"{name}.md"
    if not file_path.exists():
        return ""
    return file_path.read_text(encoding="utf-8").strip()


def default_gemini_policy(mode: str) -> str:
    return "optional" if mode == "exc" else "required"


def default_gemini_evidence_role(mode: str) -> str:
    return "frontend-prototype" if mode == "exc" else "gate"


def normalize_gemini_policy(policy: str) -> str:
    normalized = (policy or "").strip() or "required"
    if normalized not in GEMINI_POLICIES:
        raise ValueError(f"Invalid Gemini evidence policy: {normalized}")
    return normalized


def normalize_gemini_evidence_role(role: str) -> str:
    normalized = (role or "").strip() or "gate"
    if normalized not in GEMINI_EVIDENCE_ROLES:
        raise ValueError(f"Invalid Gemini evidence role: {normalized}")
    return normalized


def validate_mode_gemini_policy(mode: str, policy: str, role: str) -> None:
    if mode in {"plan", "review"} and (policy != "required" or role != "gate"):
        raise ValueError(
            "Gemini Gate Before GPT Pro is required for plan/review sessions; "
            "use --gemini-policy required --gemini-evidence-role gate."
        )


def empty_gemini_evidence(policy: str, role: str) -> dict[str, Any]:
    return {
        "required": policy == "required",
        "policy": policy,
        "role": role,
        "available": False,
        "response_file": "",
        "response_non_empty": False,
        "response_chars": 0,
        "response_sha256": "",
        "summary": "",
    }


def normalize_gemini_evidence(gemini_evidence: dict[str, Any], policy: str, role: str) -> dict[str, Any]:
    normalized = dict(gemini_evidence)
    normalized.setdefault("policy", policy)
    normalized.setdefault("role", role)
    normalized.setdefault("available", bool(normalized.get("response_non_empty")))
    normalized.setdefault("required", str(normalized.get("policy")) == "required")
    normalized.setdefault("response_file", "")
    normalized.setdefault("response_non_empty", bool(normalized.get("available")))
    normalized.setdefault("response_chars", 0)
    normalized.setdefault("response_sha256", "")
    normalized.setdefault("summary", "")
    return normalized


def gemini_evidence_title(role: str) -> str:
    if role == "frontend-prototype":
        return "## Gemini Frontend Prototype Evidence"
    if role == "frontend-review":
        return "## Gemini Frontend Review Evidence"
    return "## Gemini Gate Evidence"


def gemini_summary_label(role: str) -> str:
    if role == "frontend-prototype":
        return "Gemini frontend prototype summary:"
    if role == "frontend-review":
        return "Gemini frontend review summary:"
    return "Gemini findings summary:"


def compose_gemini_evidence(gemini_gate: dict[str, Any]) -> str:
    if not gemini_gate.get("available", True):
        return ""
    role = str(gemini_gate.get("role") or "gate")
    return "\n".join(
        [
            gemini_evidence_title(role),
            "",
            f"Gemini response file: {gemini_gate.get('response_file') or ''}",
            f"Gemini response SHA-256: {gemini_gate.get('response_sha256') or ''}",
            f"Gemini response characters: {gemini_gate.get('response_chars') or 0}",
            "",
            gemini_summary_label(role),
            str(gemini_gate.get("summary") or ""),
        ]
    )


def compose_project_context(project_context: dict[str, Any]) -> str:
    repo_url = str(project_context.get("repository_url") or "not provided")
    branch = str(project_context.get("branch") or "unknown")
    commit = str(project_context.get("commit") or "unknown")
    status_summary = str(project_context.get("status_summary") or "unknown")
    return "\n".join(
        [
            "## Project Access Context",
            "",
            f"Project name: {project_context.get('project_name') or 'unknown'}",
            f"Repository URL: {repo_url}",
            f"Current branch: {branch}",
            f"Current commit: {commit}",
            f"Local git status: {status_summary}",
            "",
            "Repository URL is optional context, not the source of truth.",
            (
                "If you can use ChatGPT GitHub connector, Deep Research, or browsing, you may inspect "
                "the repository URL for extra context and cite exact file paths or commits you used."
            ),
            (
                "If you cannot access the repository URL, do not guess. Rely on the pasted CCG input, "
                "Gemini evidence when provided, and any included diffs or file excerpts."
            ),
            (
                "The repository URL may not include uncommitted local changes; pasted context has "
                "priority for current work."
            ),
        ]
    )


def compose_prompt(
    mode: str,
    raw_prompt: str,
    round_number: int,
    followup_reason: str | None,
    gemini_gate: dict[str, Any],
    project_context: dict[str, Any],
) -> str:
    sections = [read_template("base")]
    if round_number == 2:
        sections.append(read_template("followup"))
        if followup_reason:
            sections.append(f"## Follow-up Reason\n\n{followup_reason.strip()}")
    sections.append(read_template(mode))
    sections.append(compose_project_context(project_context))
    gemini_section = compose_gemini_evidence(gemini_gate)
    if gemini_section:
        sections.append(gemini_section)
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


def read_gemini_gate(
    workdir: str | Path,
    response_file: str,
    summary: str = "",
    summary_file: str = "",
) -> dict[str, Any]:
    return read_gemini_evidence(
        workdir,
        response_file,
        summary,
        summary_file,
        policy="required",
        role="gate",
    )


def read_gemini_evidence(
    workdir: str | Path,
    response_file: str,
    summary: str = "",
    summary_file: str = "",
    *,
    policy: str = "required",
    role: str = "gate",
) -> dict[str, Any]:
    policy = normalize_gemini_policy(policy)
    role = normalize_gemini_evidence_role(role)
    if not response_file:
        if summary or summary_file:
            raise ValueError("Gemini response file is required when Gemini summary evidence is provided.")
        if policy != "required":
            return empty_gemini_evidence(policy, role)
        raise ValueError("CCG_GEMINI_RESPONSE_FILE is required before GPT Pro bridge session creation.")

    workdir_path = Path(workdir).resolve()
    gemini_path = Path(response_file).expanduser()
    if not gemini_path.is_absolute():
        gemini_path = workdir_path / gemini_path
    gemini_path = gemini_path.resolve()
    if not gemini_path.exists():
        raise ValueError(f"Gemini response file not found: {gemini_path}")

    gemini_text = gemini_path.read_text(encoding="utf-8").strip()
    if not gemini_text:
        raise ValueError(f"Gemini response file is empty: {gemini_path}")

    summary_parts: list[str] = []
    if summary_file:
        summary_path = Path(summary_file).expanduser()
        if not summary_path.is_absolute():
            summary_path = workdir_path / summary_path
        summary_parts.append(summary_path.read_text(encoding="utf-8"))
    if summary:
        summary_parts.append(summary)
    summary_text = "\n\n".join(part.strip() for part in summary_parts if part.strip()).strip()
    if not summary_text:
        raise ValueError("A concise Gemini findings summary is required before GPT Pro bridge session creation.")

    gemini_bytes = gemini_path.read_bytes()
    return {
        "required": policy == "required",
        "policy": policy,
        "role": role,
        "available": True,
        "response_file": str(gemini_path),
        "response_non_empty": True,
        "response_chars": len(gemini_text),
        "response_sha256": hashlib.sha256(gemini_bytes).hexdigest(),
        "summary": summary_text,
    }


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
    gemini_gate: dict[str, Any] | None = None,
    gemini_evidence: dict[str, Any] | None = None,
    gemini_policy: str = "",
    gemini_evidence_role: str = "",
    project_context: dict[str, Any] | None = None,
) -> BridgeSession:
    if round_number > MANUAL_QUESTIONS_MAX:
        raise ValueError("Maximum manual questions: 2. Decompose the task or return to Codex-native CCG workflows.")
    if round_number < 1:
        raise ValueError("Round must be 1 or 2.")
    if round_number == 2 and not followup_session:
        raise ValueError("Round 2 requires --followup-session. Create round 1 first.")

    workdir_path = Path(workdir).resolve()
    policy = normalize_gemini_policy(gemini_policy or default_gemini_policy(mode))
    role = normalize_gemini_evidence_role(gemini_evidence_role or default_gemini_evidence_role(mode))
    validate_mode_gemini_policy(mode, policy, role)
    output_root_path = resolve_output_root(workdir_path, Path(output_root)).resolve()
    output_root_path.mkdir(parents=True, exist_ok=True)
    if gemini_evidence is None and gemini_gate is not None:
        gemini_evidence = gemini_gate

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
        if gemini_evidence is None:
            inherited_evidence = status.get("gemini_evidence") or status.get("gemini_gate")
            if not inherited_evidence:
                if policy == "required":
                    raise ValueError("Gemini Gate Before GPT Pro is required for follow-up sessions.")
                inherited_evidence = empty_gemini_evidence(policy, role)
            gemini_evidence = dict(inherited_evidence)
            gemini_evidence["inherited_from_round"] = 1
    else:
        slug_value = slugify(slug or prompt[:60])
        session_dir = ensure_unique_session_dir(output_root_path, mode, slug_value).resolve()
        status_file = session_dir / "status.json"
        status = {}
        created_at = utc_now()

    if gemini_evidence is None:
        if policy != "required":
            gemini_evidence = empty_gemini_evidence(policy, role)
        else:
            raise ValueError("CCG_GEMINI_RESPONSE_FILE is required before GPT Pro bridge session creation.")
    gemini_evidence = normalize_gemini_evidence(gemini_evidence, policy, role)
    if policy == "required" and not gemini_evidence.get("available"):
        raise ValueError("CCG_GEMINI_RESPONSE_FILE is required before GPT Pro bridge session creation.")
    if project_context is None:
        project_context = detect_project_context(workdir_path)

    round_name = f"round-{round_number}"
    round_dir = session_dir / round_name
    round_dir.mkdir(parents=True, exist_ok=True)
    prompt_file = round_dir / "prompt.md"
    response_file = round_dir / "response.md"
    prompt_gate = dict(gemini_evidence)
    prompt_gate["response_file"] = display_gate_response_file(prompt_gate, workdir_path)
    prompt_file.write_text(
        compose_prompt(mode, prompt, round_number, followup_reason, prompt_gate, project_context),
        encoding="utf-8",
    )
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
        "project_context": project_context,
        "gemini_evidence": {
            **gemini_evidence,
            "response_file": display_gate_response_file(gemini_evidence, workdir_path),
        },
    }
    if gemini_evidence.get("role") == "gate" and gemini_evidence.get("available"):
        new_status["gemini_gate"] = {
            **gemini_evidence,
            "response_file": display_gate_response_file(gemini_evidence, workdir_path),
        }
    status_file.write_text(json.dumps(new_status, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return BridgeSession(mode, workdir_path, session_dir, round_name, prompt_file, response_file, status_file)


def load_session(session_dir: Path) -> BridgeSession:
    session_dir = resolve_existing_session_dir(session_dir)
    status_file = session_dir / "status.json"
    status = json.loads(status_file.read_text(encoding="utf-8"))
    round_name = f"round-{status.get('current_round', 1)}"
    return BridgeSession(
        str(status.get("mode", "plan")),
        session_dir,
        session_dir,
        round_name,
        session_dir / round_name / "prompt.md",
        session_dir / round_name / "response.md",
        status_file,
    )


def resolve_existing_session_dir(session_value: str | Path) -> Path:
    session_dir = Path(str(session_value)).expanduser().resolve()
    status_file = session_dir / "status.json"
    if not status_file.exists():
        raise ValueError(f"Session status file not found: {status_file}")
    status = json.loads(status_file.read_text(encoding="utf-8"))
    if status.get("provider") != PROVIDER:
        raise ValueError("Session is not a GPT Pro manual bridge session.")
    if session_dir.parent.name != "gptpro" or session_dir.parent.parent.name != "ccg":
        raise ValueError("Session must be inside a .codex/ccg/gptpro output root.")
    return session_dir


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


def start_server(session: BridgeSession, open_browser: bool = False, port: int = 0) -> tuple[ThreadingHTTPServer, str]:
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

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    host, port = server.server_address
    url = f"http://{host}:{port}/"
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    if open_browser:
        webbrowser.open(url)
    return server, url


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a manual ChatGPT Pro bridge session")
    parser.add_argument("--mode", choices=["plan", "review", "exc"])
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
    parser.add_argument("--detach-preview", action="store_true")
    parser.add_argument("--print-prompt", action="store_true")
    parser.add_argument("--gemini-response-file", default="")
    parser.add_argument("--gemini-summary", default="")
    parser.add_argument("--gemini-summary-file", default="")
    parser.add_argument("--gemini-policy", choices=GEMINI_POLICIES, default="")
    parser.add_argument("--gemini-evidence-role", choices=GEMINI_EVIDENCE_ROLES, default="")
    parser.add_argument("--repo-url", default="")
    parser.add_argument("--wait-response", action="store_true")
    parser.add_argument("--hold-seconds", type=int, default=0)
    parser.add_argument("--serve-session", help=argparse.SUPPRESS)
    parser.add_argument("--preview-port", type=int, default=0, help=argparse.SUPPRESS)
    parser.add_argument("--serve-timeout-seconds", type=int, default=14400, help=argparse.SUPPRESS)
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
    if status.get("preview_pid"):
        print(f"CCG_GPTPRO_PREVIEW_PID={status['preview_pid']}", flush=True)
    if status.get("preview_log"):
        print(f"CCG_GPTPRO_PREVIEW_LOG={status['preview_log']}", flush=True)
    print("CCG_GPTPRO_MANUAL_BRIDGE=1", flush=True)
    print("CCG_GPTPRO_WEB_AUTOMATION=0", flush=True)
    print("CCG_GPTPRO_DOM_EXTRACTION=0", flush=True)
    print(f"CCG_GPTPRO_MANUAL_QUESTIONS_EXPECTED={MANUAL_QUESTIONS_EXPECTED}", flush=True)
    print(f"CCG_GPTPRO_MANUAL_QUESTIONS_MAX={MANUAL_QUESTIONS_MAX}", flush=True)


def print_prompt(session: BridgeSession) -> None:
    print("CCG_GPTPRO_PROMPT_BEGIN", flush=True)
    print(session.prompt_file.read_text(encoding="utf-8"), flush=True)
    print("CCG_GPTPRO_PROMPT_END", flush=True)


def start_detached_preview(
    session: BridgeSession,
    *,
    open_browser: bool,
    preview_port: int,
    timeout_seconds: int,
) -> str:
    port = preview_port or free_port()
    url = f"http://127.0.0.1:{port}/"
    log_path = session.session_dir / "preview-server.log"
    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--serve-session",
        str(session.session_dir),
        "--preview-port",
        str(port),
        "--serve-timeout-seconds",
        str(timeout_seconds),
    ]
    if open_browser:
        command.append("--open-preview")

    with log_path.open("ab") as log_file:
        process_options: dict[str, Any] = {
            "cwd": str(session.workdir),
            "stdin": subprocess.DEVNULL,
            "stdout": log_file,
            "stderr": subprocess.STDOUT,
        }
        if sys.platform == "win32":
            process_options["creationflags"] = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(
                subprocess, "CREATE_NEW_PROCESS_GROUP", 0
            )
        else:
            process_options["start_new_session"] = True
        process_factory = getattr(subprocess, "Popen")
        process = process_factory(command, **process_options)

    ready = wait_for_port(port)
    status = session.status()
    status["preview_url"] = url
    status["preview_pid"] = process.pid
    status["preview_log"] = str(log_path)
    status["preview_ready"] = ready
    session.write_status(status)
    return url


def serve_existing_session(args: argparse.Namespace) -> int:
    session_value = str(args.serve_session)
    session = load_session(resolve_existing_session_dir(session_value))
    server, url = start_server(session, open_browser=args.open_preview, port=args.preview_port)
    print(f"CCG_GPTPRO_PREVIEW_URL={url}", flush=True)
    deadline = time.time() + args.serve_timeout_seconds if args.serve_timeout_seconds > 0 else None
    try:
        while not session.state()["response_saved"]:
            if deadline and time.time() >= deadline:
                break
            time.sleep(1)
    except KeyboardInterrupt:
        return 130
    finally:
        server.shutdown()
        server.server_close()
    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.serve_session:
        return serve_existing_session(args)
    if not args.mode:
        print("--mode is required unless --serve-session is used", file=sys.stderr)
        return 2
    if args.round > MANUAL_QUESTIONS_MAX:
        print(
            "Maximum manual questions: 2. Decompose the task or return to Codex-native CCG workflows.",
            file=sys.stderr,
        )
        return 2
    if args.round < 1:
        print("Round must be 1 or 2.", file=sys.stderr)
        return 2
    if args.round == 2 and not args.followup_session:
        print("Round 2 requires --followup-session. Create round 1 first.", file=sys.stderr)
        return 2
    try:
        raw_prompt = read_prompt(args.prompt, args.prompt_file)
        gemini_policy = args.gemini_policy or default_gemini_policy(args.mode)
        gemini_evidence_role = args.gemini_evidence_role or default_gemini_evidence_role(args.mode)
        gemini_policy = normalize_gemini_policy(gemini_policy)
        gemini_evidence_role = normalize_gemini_evidence_role(gemini_evidence_role)
        validate_mode_gemini_policy(args.mode, gemini_policy, gemini_evidence_role)
        gemini_evidence = None
        has_gemini_args = bool(args.gemini_response_file or args.gemini_summary or args.gemini_summary_file)
        if has_gemini_args or not args.followup_session:
            gemini_evidence = read_gemini_evidence(
                args.workdir,
                args.gemini_response_file,
                args.gemini_summary,
                args.gemini_summary_file,
                policy=gemini_policy,
                role=gemini_evidence_role,
            )
        project_context = detect_project_context(args.workdir, args.repo_url)
        session = create_session(
            mode=args.mode,
            workdir=args.workdir,
            prompt=raw_prompt,
            slug=args.slug,
            output_root=args.output_root,
            round_number=args.round,
            followup_session=args.followup_session or None,
            followup_reason=args.followup_reason or None,
            gemini_evidence=gemini_evidence,
            gemini_policy=gemini_policy,
            gemini_evidence_role=gemini_evidence_role,
            project_context=project_context,
        )
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 2

    server: ThreadingHTTPServer | None = None
    preview_url = ""
    try:
        if args.detach_preview:
            preview_url = start_detached_preview(
                session,
                open_browser=args.open_preview,
                preview_port=args.preview_port,
                timeout_seconds=args.serve_timeout_seconds,
            )
        elif args.open_preview or args.wait_response or args.hold_seconds > 0:
            server, preview_url = start_server(session, open_browser=args.open_preview, port=args.preview_port)
        if args.open_chatgpt:
            webbrowser.open("https://chatgpt.com/")
        if args.copy_prompt:
            status = session.status()
            status["prompt_copy_requested"] = True
            session.write_status(status)
        print_outputs(session, preview_url)
        if args.print_prompt:
            print_prompt(session)

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
