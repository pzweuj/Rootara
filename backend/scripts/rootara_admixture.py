"""Run the K47 Rust estimator and publish a complete result atomically."""
import argparse
import sqlite3
import subprocess
from contextlib import closing

from scripts.runtime_config import ADMIX_DATA


def data_to_sqlite(input_file, rpt_id, method, db_path, force=False):
    with closing(sqlite3.connect(db_path)) as conn, conn:
        if not force and conn.execute(
            "SELECT 1 FROM admixture WHERE report_id=?", (rpt_id,)
        ).fetchone():
            return
        result = subprocess.run(
            ["admixrs", "--data-dir", ADMIX_DATA, "-f", input_file, "-v", method, "-m", "K47"],
            stdout=subprocess.PIPE, text=True, encoding="utf-8", check=True,
        )
        header, *rows = result.stdout.strip().splitlines()
        if header != "K47":
            raise ValueError("Expected an AdmixRS K47 report")
        expected = [row[1] for row in conn.execute("PRAGMA table_info(admixture)")
                    if row[1] != "report_id"]
        estimates = {}
        for row in rows:
            label, percent = row.split(": ")
            column = label.replace("-", "_")
            value = float(percent.removesuffix("%"))
            if not percent.endswith("%") or not 0 <= value <= 100 or column in estimates:
                raise ValueError(f"Invalid K47 estimate for {label}")
            estimates[column] = value
        if set(estimates) != set(expected) or len(expected) != 47:
            raise ValueError("K47 components do not match the report schema")
        columns = ", ".join(expected)
        placeholders = ", ".join("?" for _ in expected)
        conn.execute(f"INSERT OR REPLACE INTO admixture (report_id, {columns}) "
                     f"VALUES (?, {placeholders})", (rpt_id, *(estimates[k] for k in expected)))


def main():
    parser = argparse.ArgumentParser(description='Process input file and report ID.')
    parser.add_argument('--input', type=str, required=True, help='Path to the input file')
    parser.add_argument('--rpt_id', type=str, required=True, help='Report ID')
    parser.add_argument('--method', type=str, required=True, help='Source of data')
    parser.add_argument('--db_path', type=str, required=True, help='Path to the SQLite database')
    parser.add_argument('--force', help='Force overwrite existing results, default=False', action='store_true')
    args = parser.parse_args()

    data_to_sqlite(args.input, args.rpt_id, args.method, args.db_path, args.force)

if __name__ == "__main__":
    main()

