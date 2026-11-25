import sqlite3
from types import SimpleNamespace

import pytest

from scripts.rootara_admixture import data_to_sqlite
from scripts.rootara_haplogroup import write_haplogroup_vcf


def test_incomplete_k47_does_not_replace_previous_report(tmp_path, monkeypatch):
    database = tmp_path / "reports.db"
    with sqlite3.connect(database) as conn:
        components = ", ".join(f"k{i} REAL" for i in range(47))
        conn.execute(f"CREATE TABLE admixture(report_id TEXT PRIMARY KEY, {components})")
        conn.execute("INSERT INTO admixture(report_id,k0) VALUES ('existing',70)")
    monkeypatch.setattr("scripts.rootara_admixture.subprocess.run",
                        lambda *args, **kwargs: SimpleNamespace(stdout="K47\nk0: 51.00%\n"))
    with pytest.raises(ValueError, match="components"):
        data_to_sqlite("upload", "existing", "23andme", database, force=True)
    with sqlite3.connect(database) as conn:
        assert conn.execute("SELECT k0 FROM admixture").fetchall() == [(70,)]


def test_haplogroup_input_filters_and_sorts_vendor_calls(tmp_path):
    with sqlite3.connect(":memory:") as conn:
        conn.execute("CREATE TABLE RPT_TEMPLATE01(chromosome,position INTEGER,ref,alt,gt,genotype)")
        conn.executemany("INSERT INTO RPT_TEMPLATE01 VALUES (?,?,?,?,?,?)", [
            ("Y", 12, "A", "G", "HOM", "GG"), ("Y", 5, "A", "G", "HET", "AG"),
            ("MT", 2, "G", "C", "HOM", "CC"), ("1", 5, "A", "G", "HET", "AG"),
            ("Y", 10, "A", "G", "WT", "AA"), ("Y", 7, "D", "I", "HOM", "II"),
        ])
        path = tmp_path / "calls.vcf"
        write_haplogroup_vcf(conn, "RPT_TEMPLATE01", path)
    calls = [line.split("\t") for line in path.read_text().splitlines() if not line.startswith("#")]
    assert [(row[0], row[1], row[-1]) for row in calls] == [
        ("MT", "2", "1/1"), ("Y", "5", "0/1"), ("Y", "12", "1/1"),
    ]
