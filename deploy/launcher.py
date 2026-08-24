#!/usr/bin/env python3
"""Start and supervise the private FastAPI service and public Next.js server."""

from __future__ import annotations

import os
import secrets
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


BACKEND_ROOT = Path(os.environ.get("ROOTARA_BACKEND_ROOT", "/opt/rootara/backend"))
DATA_DIR = Path(os.environ.get("ROOTARA_DATA_DIR", "/data"))
DB_PATH = Path(os.environ.get("DB_PATH", str(DATA_DIR / "rootara.db")))
JWT_SECRET_PATH = DATA_DIR / "config" / "jwt-secret"
VERSION = os.environ.get("ROOTARA_VERSION", "1.0.0")

children: list[subprocess.Popen] = []
stopping = False


def _require_configuration() -> None:
    if not os.environ.get("ADMIN_PASSWORD"):
        raise RuntimeError("ADMIN_PASSWORD is required for the first Rootara startup")
    if not os.environ.get("ADMIN_EMAIL"):
        os.environ["ADMIN_EMAIL"] = "admin@rootara.app"


def _ensure_data_directory() -> None:
    for directory in (DATA_DIR, DATA_DIR / "config", DATA_DIR / "rawdata", DATA_DIR / "temp"):
        directory.mkdir(parents=True, exist_ok=True)
    probe = DATA_DIR / ".write-test"
    try:
        probe.write_text("ok", encoding="utf-8")
    finally:
        probe.unlink(missing_ok=True)


def _load_or_create_jwt_secret() -> str:
    if JWT_SECRET_PATH.exists():
        value = JWT_SECRET_PATH.read_text(encoding="utf-8").strip()
        if len(value) >= 32:
            JWT_SECRET_PATH.chmod(0o600)
            return value

    value = secrets.token_urlsafe(32)
    JWT_SECRET_PATH.write_text(value + "\n", encoding="utf-8")
    JWT_SECRET_PATH.chmod(0o600)
    return value


def _configure_environment() -> None:
    os.environ["ROOTARA_VERSION"] = VERSION
    os.environ["ROOTARA_BACKEND_ROOT"] = str(BACKEND_ROOT)
    os.environ["ROOTARA_DATA_DIR"] = str(DATA_DIR)
    os.environ["DB_PATH"] = str(DB_PATH)
    os.environ["JWT_SECRET"] = _load_or_create_jwt_secret()
    os.environ["ROOTARA_BACKEND_URL"] = os.environ.get(
        "ROOTARA_BACKEND_URL", "http://127.0.0.1:8000"
    )
    internal_key = secrets.token_urlsafe(32)
    os.environ["ROOTARA_API_KEY"] = internal_key
    os.environ["ROOTARA_BACKEND_API_KEY"] = internal_key


def _initialize_database() -> None:
    command = [
        sys.executable,
        "-m",
        "scripts.rootara_initial",
        "--name",
        os.environ["ADMIN_EMAIL"].split("@", 1)[0],
        "--email",
        os.environ["ADMIN_EMAIL"],
        "--db",
        str(DB_PATH),
        "--force",
        "false",
    ]
    subprocess.run(command, cwd=BACKEND_ROOT, env=os.environ.copy(), check=True)


def _wait_for_backend(timeout: float = 30.0) -> None:
    deadline = time.monotonic() + timeout
    request = urllib.request.Request("http://127.0.0.1:8000/health/live")
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(request, timeout=2) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.25)
    raise RuntimeError("FastAPI did not become ready within 30 seconds")


def _start_processes() -> None:
    backend = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
            "--workers",
            "1",
            "--loop",
            "uvloop",
            "--http",
            "httptools",
        ],
        cwd=BACKEND_ROOT,
        env=os.environ.copy(),
    )
    children.append(backend)
    _wait_for_backend()

    frontend_root = Path(os.environ.get("ROOTARA_WEB_ROOT", "/opt/rootara/web"))
    frontend = subprocess.Popen(
        ["node", "server.js"],
        cwd=frontend_root,
        env={
            **os.environ,
            "NODE_ENV": "production",
            "PORT": "3000",
            "HOSTNAME": "0.0.0.0",
        },
    )
    children.append(frontend)


def _stop_children() -> None:
    for child in children:
        if child.poll() is None:
            child.terminate()
    deadline = time.monotonic() + 15
    for child in children:
        remaining = max(0.0, deadline - time.monotonic())
        try:
            child.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()


def _signal_handler(signum, _frame) -> None:
    global stopping
    stopping = True
    _stop_children()


def main() -> int:
    global children
    try:
        _require_configuration()
        _ensure_data_directory()
        _configure_environment()
        _initialize_database()
        _start_processes()

        signal.signal(signal.SIGTERM, _signal_handler)
        signal.signal(signal.SIGINT, _signal_handler)
        while not stopping:
            for child in children:
                return_code = child.poll()
                if return_code is not None:
                    _stop_children()
                    return return_code or 1
            time.sleep(0.5)
        return 0
    except Exception as exc:
        print(f"Rootara startup failed: {exc}", file=sys.stderr)
        _stop_children()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
