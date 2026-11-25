#!/usr/bin/env python3
"""Initialize the volume and start the single production web process."""

from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path


BACKEND_ROOT = Path(os.environ.get("ROOTARA_BACKEND_ROOT", "/opt/rootara/backend"))
DATA_DIR = Path(os.environ.get("ROOTARA_DATA_DIR", "/data"))
DB_PATH = Path(os.environ.get("DB_PATH", str(DATA_DIR / "rootara.db")))
JWT_SECRET_PATH = DATA_DIR / "config" / "jwt-secret"
VERSION = os.environ.get("ROOTARA_VERSION", "2.0.0")

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

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
    from scripts.rootara_initial import init_db

    email = os.environ["ADMIN_EMAIL"]
    init_db(email.split("@", 1)[0], email, str(DB_PATH), force=False)

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
    if catalog.get("locus_count") != 154 or catalog.get("verified_locus_count") != 154:
        raise RuntimeError(
            "release requires 154 verified trait loci; "
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


def main() -> int:
    try:
        _require_configuration()
        _ensure_data_directory()
        _configure_environment()
        os.chdir(BACKEND_ROOT)
        _initialize_database()
        os.execv(sys.executable, [sys.executable, "-m", "web_runtime"])
    except Exception as exc:
        print(f"Rootara startup failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--initialize"]:
        _initialize_database()
    else:
        raise SystemExit(main())
