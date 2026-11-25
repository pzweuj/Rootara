"""Exercise the production reader against the same reference builder used by Docker."""
import gzip
import sqlite3
import subprocess
import sys

import pytest

from scripts.build_reference import build
from scripts.runtime_config import READER_PATH


@pytest.mark.parametrize("vendor,rows,expected_mt", [
    ("23andme", "rs2\t1\t50\tAA\nunknown\t1\t50\tAA\nmt\tMT\t10\tG\n", True),
    ("wegene", "rs2\t1\t50\tAA\nunknown\t1\t50\tAA\nmt\tMT\t10\tG\n", False),
    ("ancestry", "rsid\tposition\tchromosome\tallele2\tallele1\n"
     "rs2\t50\t1\tA\tA\nunknown\t50\t1\tA\tA\nmt\t10\t26\tG\tG\n", True),
])
def test_vendor_multiallelic_and_haploid_matching(tmp_path, vendor, rows, expected_mt):
    core = tmp_path / "core.gz"
    with gzip.open(core, "wt") as handle:
        handle.write("Chrom\tStart\tRef\tAlt\tGene\tRSID\tgnomAD_AF\tCLNSIG\tCLNDN\n")
        for chrom, pos, alt, rsid in [("chr1", 50, "C", "rs1"), ("chr1", 50, "G", "rs2"),
                                      ("chrM", 10, "G", "mt")]:
            handle.write(f"{chrom}\t{pos}\tA\t{alt}\tgene\t{rsid}\t0.0004735077378849575\t.\t.\n")
    reference = tmp_path / "reference.db"
    build(core, reference)
    source = tmp_path / "input.txt"
    source.write_text("# comment\n" + rows)
    report = tmp_path / "out.db"
    command = [READER_PATH, "--input", source, "--db", report, "--reference", reference,
               "--method", vendor, "--report", "RPT_TEMPLATE01"]
    subprocess.run(command, check=True)
    with sqlite3.connect(report) as conn:
        expected = [("rs2", "1", "AA", "WT")]
        if expected_mt:
            expected.append(("mt", "MT", "GG", "HOM"))
        assert conn.execute("SELECT rsid,chromosome,genotype,gt FROM RPT_TEMPLATE01 ORDER BY rowid").fetchall() == expected
        if sys.platform == "linux":
            assert conn.execute("""SELECT gnomAD_AF = CAST('0.0004735077378849575' AS REAL)
                                   FROM RPT_TEMPLATE01 WHERE rsid='rs2'""").fetchone() == (1,)
        # A failed replacement must roll back the old table and its index.
        source.write_bytes(source.read_bytes() + b"bad\t1\t50\t\xff\n")
        assert subprocess.run(command).returncode
        assert conn.execute("SELECT COUNT(*) FROM RPT_TEMPLATE01").fetchone()[0] == len(expected)
