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
VERSION = os.environ.get("ROOTARA_VERSION", "1.0.1")

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

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

    # Upgrade legacy report tables before publishing catalog readiness. The
    # migration preserves existing rows, restores catalog RSIDs from the saved
    # raw files, and creates the RSID indexes used by batch evaluation.
    from scripts.trait_catalog_service import ensure_report_rsid_indexes
    from scripts.trait_report_migration import backfill_all_reports

    ensure_report_rsid_indexes(DB_PATH)
    backfilled = backfill_all_reports(DB_PATH)
    print(f"Trait report backfill complete: {backfilled}")

    # Optional release gates are enabled for the final reviewed image. Keep
    # them opt-in during evidence collection so a development image can still
    # expose its audit queue without being mistaken for a release.
    from scripts.rootara_traits import get_trait_catalog_metadata, persist_trait_catalog_metadata

    catalog = get_trait_catalog_metadata()
    expected_count = os.environ.get("ROOTARA_EXPECTED_TRAIT_COUNT")
    if expected_count and catalog["count"] != int(expected_count):
        raise RuntimeError(
            f"trait catalog count {catalog['count']} does not match {expected_count}"
        )
    if catalog.get("locus_count") != 153 or catalog.get("verified_locus_count") != 153:
        raise RuntimeError(
            "release requires 153 verified trait loci; "
            f"found {catalog.get('verified_locus_count', 0)}/{catalog.get('locus_count', 0)}"
        )
    if os.environ.get("ROOTARA_REQUIRE_CURATED_CATALOG") == "1":
        if catalog["statuses"].get("curated", 0) != catalog["count"]:
            raise RuntimeError("release requires every production trait to be curated")
        from scripts.production_catalog_validation import validate_production_catalog

        catalog_errors = validate_production_catalog()
        if catalog_errors:
            raise RuntimeError(
                "production trait catalog validation failed: "
                + "; ".join(catalog_errors[:5])
            )
    persist_trait_catalog_metadata(catalog)


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
