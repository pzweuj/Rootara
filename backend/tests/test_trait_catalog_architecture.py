import json
import sqlite3
from pathlib import Path

import pytest

from scripts.materialize_trait_catalog import SOURCE, materialize_compatibility
from scripts.trait_catalog_service import (
    ensure_report_rsid_indexes,
    get_catalog_payload,
    get_report_results,
)
from scripts.trait_report_migration import (
    _forward_genotype,
    backfill_report,
    iter_raw_variants,
    load_locus_registry,
)


ROOT = Path(__file__).resolve().parents[2]
DATABASE = ROOT / "backend" / "database"


def _report_database(path: Path, report_id: str = "RPT_ABCDEFGHIJ") -> None:
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE reports(report_id TEXT PRIMARY KEY, data_source TEXT, total_snps INTEGER, upload_date TEXT)"
    )
    conn.execute("INSERT INTO reports VALUES (?, '23andme', 0, '2026-01-01')", (report_id,))
    conn.execute(f"""
        CREATE TABLE {report_id}(
            id INTEGER PRIMARY KEY, chromosome TEXT, position INTEGER,
            ref TEXT, alt TEXT, gnomAD_AF REAL, gene TEXT, clnsig TEXT,
            clndn TEXT, rsid TEXT, genotype TEXT, gt TEXT
        )
    """)
    conn.commit()
    conn.close()


def test_normalized_catalog_round_trips_compatibility_artifacts():
    document = json.loads(SOURCE.read_text(encoding="utf-8"))
    traits, evidence, loci = materialize_compatibility(document)
    assert traits == json.loads((DATABASE / "default-traits.json").read_text(encoding="utf-8"))
    assert evidence == json.loads((DATABASE / "trait-evidence.json").read_text(encoding="utf-8"))
    assert loci == json.loads((DATABASE / "trait-locus-registry.json").read_text(encoding="utf-8"))


def test_registry_has_153_reviewed_forward_loci_and_rs495828_is_corrected():
    registry = json.loads((DATABASE / "trait-locus-registry.json").read_text(encoding="utf-8"))
    assert registry["counts"] == {
        "expected": 153, "resolved": 153, "verified": 153,
        "conflicts": 0, "fetchErrors": 0,
    }
    assert all(locus["status"] == "verified" for locus in registry["loci"].values())
    for locus in registry["loci"].values():
        assert locus["grch37"]["chromosome"]
        assert locus["grch37"]["position"]
        assert locus["grch38"]["chromosome"]
        assert locus["grch38"]["position"]
        assert len(locus["traitAlleles"]) == 2
        assert locus["sources"]["ncbi"]["url"]
        assert locus["sources"]["ensemblGRCh38"]

    rs495828 = registry["loci"]["rs495828"]
    assert rs495828["grch37"]["position"] == 136154867
    assert rs495828["grch38"]["position"] == 133279294
    assert rs495828["inputTransform"] == "complement"
    assert rs495828["forwardEffectAllele"] == "T"
    traits = json.loads((DATABASE / "default-traits.json").read_text(encoding="utf-8"))
    trait = next(item for item in traits if "rs495828" in item["rsids"])
    assert trait["formula"] == "SCORE(rs495828:TT=10,GT=5,GG=0)"


def test_catalog_and_empty_report_results_are_compact_and_never_use_na(tmp_path):
    db_path = tmp_path / "rootara.db"
    _report_database(db_path, "RPT_TEMPLATE01")
    ensure_report_rsid_indexes(db_path)
    catalog = get_catalog_payload(db_path)
    results = get_report_results("RPT_TEMPLATE01", db_path)
    assert catalog["count"] == results["count"] == 150
    assert all(item["status"] == "insufficient_data" for item in results["results"])
    assert all(item["missingRsids"] for item in results["results"])
    serialized = json.dumps(
        {"catalog": catalog, "results": results}, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")
    assert len(serialized) < 120_000
    assert '"N/A"' not in serialized.decode("utf-8")
    assert '"NA"' not in serialized.decode("utf-8")


def test_backfill_preserves_raw_rsid_and_is_idempotent(tmp_path, monkeypatch):
    from scripts import trait_report_migration as migration

    db_path = tmp_path / "rootara.db"
    report_id = "RPT_ABCDEFGHIJ"
    _report_database(db_path, report_id)
    raw_dir = tmp_path / "rawdata"
    raw_dir.mkdir()
    monkeypatch.setattr(migration, "RAWDATA_DIR", raw_dir)
    (raw_dir / "RDT_ABCDEFGHIJ.23andme.txt").write_text(
        "# rsid\tchromosome\tposition\tgenotype\nrs999\t1\t101\tAG\n",
        encoding="utf-8",
    )
    loci = {
        "rs999": {
            "status": "verified", "gene": "GENE1", "traitAlleles": ["A", "G"],
            "alleleEncoding": "nucleotide", "grch37": {"chromosome": "1", "position": 101},
            "grch38": {"chromosome": "1", "position": 201, "reference": "A", "alternates": ["G"]},
        }
    }
    assert backfill_report(db_path, report_id, "23andme", loci, "hash-1") == 1
    assert backfill_report(db_path, report_id, "23andme", loci, "hash-1") == 0
    conn = sqlite3.connect(db_path)
    assert conn.execute(f"SELECT rsid, genotype FROM {report_id}").fetchall() == [("rs999", "AG")]
    plan = conn.execute(
        f"EXPLAIN QUERY PLAN SELECT * FROM {report_id} WHERE rsid IN (?)", ("rs999",)
    ).fetchall()
    assert any("idx_RPT_ABCDEFGHIJ_rsid" in str(row) for row in plan)
    conn.close()


def test_template_backfill_restores_128_loci_and_evaluates_125_cards(tmp_path):
    db_path = tmp_path / "rootara.db"
    _report_database(db_path, "RPT_TEMPLATE01")
    loci, registry_hash = load_locus_registry()
    assert backfill_report(
        db_path, "RPT_TEMPLATE01", "23andme", loci, registry_hash
    ) == 128
    results = get_report_results("RPT_TEMPLATE01", db_path)
    assert sum(item["status"] == "ok" for item in results["results"]) == 125
    rs495828 = next(
        item for item in results["results"]
        if item["traitId"] == "gwas-gcst000565-rs495828"
    )
    assert rs495828["status"] == "ok"
    assert rs495828["genotypes"] == {"rs495828": "GG"}
    catalog = get_catalog_payload(db_path)
    total_bytes = sum(
        len(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        for payload in (catalog, results)
    )
    assert total_bytes < 120 * 1024


def test_orientation_normalization_handles_reverse_and_rejects_ambiguous_auto():
    locus = {"traitAlleles": ["A", "G"], "grch38": {"reference": "A", "alternates": ["G"]}}
    assert _forward_genotype("TC", locus, "reverse") == "AG"
    with pytest.raises(ValueError, match="strand-ambiguous"):
        _forward_genotype(
            "AA",
            {"traitAlleles": ["A", "T"], "grch38": {"reference": "A", "alternates": ["T"]}},
            "auto",
        )


@pytest.mark.parametrize(
    ("source", "content", "expected"),
    [
        ("23andme", "rs1\t1\t10\tGA\n", ("rs1", "1", 10, "GA")),
        ("wegene", "rs1,1,10,AG\n", ("rs1", "1", 10, "AG")),
        (
            "ancestry",
            "rsid\tchromosome\tposition\tallele1\tallele2\nrs1\t23\t10\tA\tG\n",
            ("rs1", "X", 10, "AG"),
        ),
    ],
)
def test_vendor_adapters_preserve_rsid_and_normalize_chromosome(
    tmp_path, source, content, expected
):
    raw = tmp_path / "raw.txt"
    raw.write_text(content, encoding="utf-8")
    assert list(iter_raw_variants(raw, source)) == [expected]


def test_backfill_position_conflict_rolls_back_report(tmp_path, monkeypatch):
    from scripts import trait_report_migration as migration

    db_path = tmp_path / "rootara.db"
    report_id = "RPT_ZYXWVUTSRQ"
    _report_database(db_path, report_id)
    raw_dir = tmp_path / "rawdata"
    raw_dir.mkdir()
    monkeypatch.setattr(migration, "RAWDATA_DIR", raw_dir)
    (raw_dir / "RDT_ZYXWVUTSRQ.23andme.txt").write_text(
        "rs999\t1\t999\tAG\n", encoding="utf-8"
    )
    loci = {
        "rs999": {
            "status": "verified", "gene": "GENE1", "traitAlleles": ["A", "G"],
            "grch37": {"chromosome": "1", "position": 101},
            "grch38": {"chromosome": "1", "position": 201, "reference": "A", "alternates": ["G"]},
        }
    }
    with pytest.raises(RuntimeError, match="matches neither GRCh37 nor GRCh38"):
        backfill_report(db_path, report_id, "23andme", loci, "hash-2")
    conn = sqlite3.connect(db_path)
    assert conn.execute(f"SELECT COUNT(*) FROM {report_id}").fetchone()[0] == 0
    assert not conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='report_trait_import_state'"
    ).fetchone()
    conn.close()
