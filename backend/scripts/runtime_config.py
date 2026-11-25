"""Runtime paths shared by the backend application and analysis scripts."""

from __future__ import annotations

import os
from pathlib import Path


BACKEND_ROOT = Path(
    os.environ.get("ROOTARA_BACKEND_ROOT", str(Path(__file__).resolve().parents[1]))
).resolve()
DATA_DIR = Path(os.environ.get("ROOTARA_DATA_DIR", "/data")).resolve()
DATABASE_DIR = BACKEND_ROOT / "database"
DB_PATH = Path(os.environ.get("DB_PATH", str(DATA_DIR / "rootara.db"))).resolve()
CORE_DATABASE_PATH = DATABASE_DIR / "Rootara.core.sqlite"
TEMPLATE_PATH = DATABASE_DIR / "TEMPLATE01.txt"
DEFAULT_TRAITS_PATH = DATABASE_DIR / "default-traits.json"
READER_PATH = os.environ.get("ROOTARA_READER", "rootara-reader")
ARCHIVE_TOOL = os.environ.get("ROOTARA_ARCHIVE_TOOL", "rootara-archive")
ADMIX_DATA = DATABASE_DIR / "admix"
HAPLOGROUPER_DIR = BACKEND_ROOT / "haploGrouper"
TEMP_DIR = DATA_DIR / "temp"
RAWDATA_DIR = DATA_DIR / "rawdata"


def ensure_data_directories() -> None:
    for directory in (DATA_DIR, TEMP_DIR, RAWDATA_DIR, DB_PATH.parent):
        directory.mkdir(parents=True, exist_ok=True)
