"""Archive a vendor upload and backfill its catalog loci."""
from pathlib import Path
import sys

from scripts.raw_archive import write_archive
from scripts.trait_report_migration import backfill_report, load_locus_registry


def archive_report(source, destination, vendor, db_path, report):
    write_archive(Path(source), Path(destination), vendor)
    loci, registry_hash = load_locus_registry()
    backfill_report(db_path, report, vendor, loci, registry_hash)


if __name__ == "__main__":
    archive_report(*sys.argv[1:])
