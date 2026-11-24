"""Build report artifacts before publishing the report in the SQLite catalog."""
import argparse
from contextlib import closing
from datetime import datetime
from pathlib import Path
import secrets
import sqlite3
import subprocess
import tempfile

from scripts.raw_archive import write_archive
from scripts.rootara_2_vcf import trans_rootara_to_vcf
from scripts.rootara_admixture import data_to_sqlite
from scripts.rootara_haplogroup import insert_haplogroup_to_db
from scripts.rootara_snp_2_db import csv_to_sqlite
from scripts.runtime_config import CORE_DATABASE_PATH, RAWDATA_DIR, READER_PATH, TEMP_DIR
from scripts.rootara_table_info import validate_report_table_name
from scripts.trait_report_migration import backfill_report, load_locus_registry


def create_new_report(user_id, input_data, source_from, report_name, db_path,
                      default_report=False, initail=False, *, report_id=None, progress=lambda stage: None):
    if source_from not in {"ancestry", "23andme", "wegene"}:
        raise ValueError("Unsupported data source")
    report_id = validate_report_table_name("RPT_TEMPLATE01" if initail else
                                           report_id or "RPT_" + secrets.token_hex(5).upper())
    archive = RAWDATA_DIR / f"RDT_{report_id[4:]}.{source_from}.parquet"
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(db_path)) as conn, tempfile.TemporaryDirectory(dir=TEMP_DIR) as folder:
        if not initail and conn.execute("SELECT 1 FROM reports WHERE report_id=?", (report_id,)).fetchone():
            return report_id
        if not initail:
            # A process may have stopped after writing derived rows but before publication.
            with conn:
                for table in ("haplogroup", "admixture"):
                    conn.execute(f"DELETE FROM {table} WHERE report_id=?", (report_id,))
        work = Path(folder)
        if initail or isinstance(input_data, Path):
            source = Path(input_data)
        else:
            source = work / "upload.txt"
            source.write_bytes(input_data.encode("utf-8"))
        output = work / "variants.csv"
        try:
            progress("variants")
            subprocess.run([str(READER_PATH), "-input", str(source), "-output", str(output),
                            "-method", source_from, "-rootara", str(CORE_DATABASE_PATH)], check=True)
            csv_to_sqlite(output, db_path, report_id, force=True)
            if not initail:
                progress("ancestry")
                data_to_sqlite(str(source), report_id, source_from, db_path, force=True)
                progress("haplogroups")
                vcf = str(work / "variants.vcf.gz")
                trans_rootara_to_vcf(str(output), vcf)
                insert_haplogroup_to_db(report_id, vcf, db_path, force=True)
                progress("archive")
                write_archive(source, archive, source_from)
                loci, registry_hash = load_locus_registry()
                backfill_report(db_path, report_id, source_from, loci, registry_hash)
            with conn:
                conn.execute("BEGIN IMMEDIATE")
                count = conn.execute(f"SELECT COUNT(*) FROM {report_id}").fetchone()[0]
                if not count:
                    raise ValueError("No variants matched this report")
                is_default = default_report or initail or not conn.execute(
                    "SELECT 1 FROM reports WHERE report_id != 'RPT_TEMPLATE01' LIMIT 1"
                ).fetchone()
                if is_default:
                    conn.execute("UPDATE reports SET select_default=0")
                conn.execute("""INSERT OR REPLACE INTO reports
                    (report_id,user_id,file_format,data_source,name,select_default,total_snps,upload_date)
                    VALUES (?,?,?,?,?,?,?,?)""",
                    (report_id,user_id,"txt",source_from,report_name,is_default,count,datetime.now().isoformat()))
        except Exception:
            with conn:
                conn.execute(f"DROP TABLE IF EXISTS {report_id}")
                for table in ("admixture", "haplogroup", "report_trait_import_state"):
                    if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
                        conn.execute(f"DELETE FROM {table} WHERE report_id=?", (report_id,))
            archive.unlink(missing_ok=True)
            raise
    return report_id


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import a local vendor report")
    for argument in ("user_id", "source_from", "report_name", "db_path"):
        parser.add_argument("--" + argument, required=True)
    parser.add_argument("--input_data", type=Path, required=True)
    for flag in ("default_report", "initail"):
        parser.add_argument("--" + flag, nargs="?", const=True, default=False,
                            type=lambda value: value.lower() in {"true","1","yes"})
    create_new_report(**vars(parser.parse_args()))
