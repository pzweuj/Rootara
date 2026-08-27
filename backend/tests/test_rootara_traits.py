import json
import sqlite3

import pytest

from scripts.rootara_traits import (
    InsufficientGeneticData,
    get_trait_catalog_metadata,
    json_to_trait_table,
    parse_formula,
    persist_trait_catalog_metadata,
)


def test_score_formula_requires_every_declared_genotype():
    with pytest.raises(InsufficientGeneticData):
        parse_formula(
            "SCORE(rs1:AA=10,AG=5,GG=0; rs2:CC=5,CT=3,TT=0)",
            {"rs1": "AA"},
        )


def test_score_formula_rejects_unmapped_genotype():
    with pytest.raises(InsufficientGeneticData):
        parse_formula("SCORE(rs1:AA=10,AG=5,GG=0)", {"rs1": "NN"})


def test_if_formula_does_not_turn_missing_data_into_true():
    with pytest.raises(InsufficientGeneticData):
        parse_formula("IF(rs1:AA=true,GG=false)", {})


def test_body_odor_direction_matches_abcc11_evidence():
    assert parse_formula("SCORE(rs17822931:TT=0,CT=5,CC=10)", {"rs17822931": "TT"}) == 0
    assert parse_formula("SCORE(rs17822931:TT=0,CT=5,CC=10)", {"rs17822931": "CC"}) == 10


def test_unphased_heterozygotes_are_order_independent():
    assert parse_formula("SCORE(rs1:AG=7,AA=0,GG=0)", {"rs1": "GA"}) == 7


def test_default_catalog_sync_updates_defaults_and_preserves_custom(tmp_path):
    catalog = tmp_path / "default-traits.json"
    catalog.write_text(json.dumps([
        {
            "id": "new-default",
            "name": {"en": "New", "zh-CN": "新", "default": ""},
            "description": {"en": "", "zh-CN": "", "default": ""},
            "icon": "Dna",
            "confidence": "high",
            "category": "internal",
            "rsids": ["rs1"],
            "formula": "SCORE(rs1:AA=1,AG=0,GG=0)",
            "scoreThresholds": {"High": 1, "Low": 0},
            "result": {"High": {"en": "High", "zh-CN": "高", "default": ""},
                       "Low": {"en": "Low", "zh-CN": "低", "default": ""}},
            "reference": ["12345678"],
        }
    ], ensure_ascii=False), encoding="utf-8")
    db = tmp_path / "rootara.db"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE traits (id TEXT PRIMARY KEY, name TEXT, description TEXT, icon TEXT, confidence TEXT, isDefault BOOLEAN, createdAt TIMESTAMP, category TEXT, rsids TEXT, formula TEXT, scoreThresholds TEXT, result TEXT, reference TEXT)")
    conn.execute("INSERT INTO traits VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("old-default", "{}", "{}", "Dna", "low", 1, "2020", "internal", "rs2", "SCORE(rs2:AA=1,AG=0,GG=0)", "{}", "{}", ""))
    conn.execute("INSERT INTO traits VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("TRA_CUSTOM", "{}", "{}", "Dna", "low", 0, "2020", "internal", "rs3", "SCORE(rs3:AA=1,AG=0,GG=0)", "{}", "{}", ""))
    conn.commit()
    conn.close()

    json_to_trait_table(catalog, db)
    json_to_trait_table(catalog, db)
    conn = sqlite3.connect(db)
    rows = conn.execute("SELECT id, isDefault FROM traits ORDER BY id").fetchall()
    conn.close()
    assert rows == [("TRA_CUSTOM", 0), ("new-default", 1)]


def test_default_catalog_upgrade_from_legacy_count_keeps_custom_rows(tmp_path):
    from pathlib import Path

    shipped = json.loads(
        (Path(__file__).resolve().parents[1] / "database" / "default-traits.json").read_text(encoding="utf-8")
    )
    legacy = shipped[:53]
    catalog = tmp_path / "legacy-default.json"
    catalog.write_text(json.dumps(legacy, ensure_ascii=False), encoding="utf-8")
    db = tmp_path / "rootara.db"
    # Seed a 53-rule database plus a user rule and a report-like row. The
    # synchronization is only allowed to replace default rows.
    conn = sqlite3.connect(db)
    conn.execute("""CREATE TABLE traits (
        id TEXT PRIMARY KEY, name TEXT, description TEXT, icon TEXT,
        confidence TEXT, isDefault BOOLEAN, createdAt TIMESTAMP,
        category TEXT, rsids TEXT, formula TEXT, scoreThresholds TEXT,
        result TEXT, reference TEXT)""")
    for trait in legacy:
        conn.execute(
            "INSERT INTO traits VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (trait["id"], json.dumps(trait["name"]), json.dumps(trait["description"]), trait["icon"],
             trait["confidence"], 1, trait["createdAt"], trait["category"], ";".join(trait["rsids"]),
             trait["formula"], json.dumps(trait["scoreThresholds"]), json.dumps(trait["result"]), ";".join(trait["reference"])),
        )
    conn.execute("INSERT INTO traits VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                 ("TRA_CUSTOM", "{}", "{}", "Dna", "low", 0, "2020", "internal", "rs999", "SCORE(rs999:AA=1,AG=0,GG=0)", "{}", "{}", ""))
    conn.commit()
    conn.close()

    json_to_trait_table(Path(__file__).resolve().parents[1] / "database" / "default-traits.json", db)
    json_to_trait_table(Path(__file__).resolve().parents[1] / "database" / "default-traits.json", db)
    conn = sqlite3.connect(db)
    defaults = conn.execute("SELECT COUNT(*) FROM traits WHERE isDefault = 1").fetchone()[0]
    custom = conn.execute("SELECT COUNT(*) FROM traits WHERE isDefault = 0 AND id = 'TRA_CUSTOM'").fetchone()[0]
    conn.close()
    assert defaults == 150
    assert custom == 1


def test_trait_catalog_version_is_persisted_atomically(tmp_path):
    metadata = get_trait_catalog_metadata()
    target = persist_trait_catalog_metadata(metadata, tmp_path / "config" / "trait-catalog.json")
    assert target.read_text(encoding="utf-8").strip()
    assert json.loads(target.read_text(encoding="utf-8"))["version"] == metadata["version"]
    assert oct(target.stat().st_mode & 0o777) == "0o600"


def test_default_catalog_sync_rolls_back_when_sqlite_update_fails(tmp_path):
    catalog = tmp_path / "default-traits.json"
    catalog.write_text(json.dumps([
        {
            "id": "existing-default",
            "name": {"en": "New", "zh-CN": "新", "default": ""},
            "description": {"en": "", "zh-CN": "", "default": ""},
            "icon": "Dna",
            "confidence": "high",
            "category": "internal",
            "rsids": ["rs1"],
            "formula": "SCORE(rs1:AA=1,AG=0,GG=0)",
            "scoreThresholds": {"High": 1, "Low": 0},
            "result": {"High": {"en": "High", "zh-CN": "高", "default": ""},
                       "Low": {"en": "Low", "zh-CN": "低", "default": ""}},
            "reference": ["12345678"],
        }
    ], ensure_ascii=False), encoding="utf-8")
    db = tmp_path / "rootara.db"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE traits (id TEXT PRIMARY KEY, name TEXT, description TEXT, icon TEXT, confidence TEXT, isDefault BOOLEAN, createdAt TIMESTAMP, category TEXT, rsids TEXT, formula TEXT, scoreThresholds TEXT, result TEXT, reference TEXT)")
    conn.execute("INSERT INTO traits VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("existing-default", "old", "old", "Old", "low", 1, "2020", "internal", "rs0", "old", "{}", "{}", "old"))
    conn.execute("INSERT INTO traits VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("TRA_CUSTOM", "custom", "custom", "Dna", "low", 0, "2020", "internal", "rs3", "custom", "{}", "{}", ""))
    conn.execute("CREATE TRIGGER fail_trait_update BEFORE UPDATE ON traits BEGIN SELECT RAISE(ABORT, 'forced rollback'); END")
    conn.commit()
    conn.close()

    with pytest.raises(sqlite3.DatabaseError, match="forced rollback"):
        json_to_trait_table(catalog, db)

    conn = sqlite3.connect(db)
    rows = conn.execute("SELECT id, name, isDefault FROM traits ORDER BY id").fetchall()
    conn.close()
    assert rows == [("TRA_CUSTOM", "custom", 0), ("existing-default", "old", 1)]
