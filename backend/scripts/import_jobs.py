"""One importer per application instance, with durable restartable jobs."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import os
import secrets
import sqlite3

from scripts.rootara_report_create import create_new_report
from scripts.runtime_config import DB_PATH, DATA_DIR

SPOOL = DATA_DIR / "imports"
executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="report-import")


def initialize():
    SPOOL.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(DB_PATH)) as conn, conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS import_jobs (
            id TEXT PRIMARY KEY, report_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL,
            source TEXT NOT NULL, name TEXT NOT NULL, is_default INTEGER NOT NULL,
            stage TEXT NOT NULL, error TEXT)""")
        jobs = conn.execute("SELECT id,stage FROM import_jobs ORDER BY rowid").fetchall()
    for fragment in SPOOL.glob("receiving-*.part"):
        fragment.unlink(missing_ok=True)
    for job, stage in jobs:
        if stage in {"done", "failed"}:
            (SPOOL / job).unlink(missing_ok=True)
        else:
            executor.submit(run_job, job)


def enqueue(job, upload, user, source, name, is_default):
    with closing(sqlite3.connect(DB_PATH)) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        if conn.execute("SELECT 1 FROM import_jobs WHERE id=?", (job,)).fetchone():
            return
        os.replace(upload, SPOOL / job)
        conn.execute("INSERT INTO import_jobs VALUES (?,?,?,?,?,?,'queued',NULL)",
                     (job, "RPT_" + secrets.token_hex(5).upper(), user, source, name, is_default))
    executor.submit(run_job, job)


def status(job):
    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT id,report_id,stage,error FROM import_jobs WHERE id=?", (job,)).fetchone()
        return dict(row) if row else None


def run_job(job):
    def update(stage, error=None):
        with closing(sqlite3.connect(DB_PATH)) as conn, conn:
            conn.execute("UPDATE import_jobs SET stage=?,error=? WHERE id=?", (stage,error,job))
    with closing(sqlite3.connect(DB_PATH)) as conn:
        report, user, source, name, default = conn.execute(
            "SELECT report_id,user_id,source,name,is_default FROM import_jobs WHERE id=?", (job,)
        ).fetchone()
    path = SPOOL / job
    try:
        create_new_report(user, path, source, name, DB_PATH, default, report_id=report, progress=update)
    except Exception as exc:
        update("failed", str(exc))
    else:
        update("done")
    path.unlink(missing_ok=True)
