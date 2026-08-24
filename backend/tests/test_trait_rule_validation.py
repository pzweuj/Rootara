from pathlib import Path

from scripts.trait_rule_validation import (
    audit_legacy_traits,
    exhaustive_score_fixtures,
    load_json,
    validate_catalog,
)
from scripts.candidate_review_validation import validate_manifest


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TRAITS = ROOT / "backend" / "database" / "default-traits.json"
EVIDENCE = ROOT / "backend" / "database" / "trait-evidence.json"


def test_evidence_catalog_and_fixtures_are_valid():
    assert validate_catalog(DEFAULT_TRAITS, EVIDENCE) == []


def test_curated_catalog_contains_independent_sources():
    catalog = load_json(EVIDENCE)
    curated = [rule for rule in catalog["rules"].values() if rule["status"] == "curated"]
    assert len(curated) >= 6
    assert all(rule["evidence"] for rule in curated)
    assert all(item["type"] == "PMID" for rule in curated for item in rule["evidence"])


def test_every_default_rule_has_a_review_record_and_complete_mapping():
    traits = {trait["id"]: trait for trait in load_json(DEFAULT_TRAITS)}
    catalog = load_json(EVIDENCE)["rules"]
    assert set(catalog) == set(traits)
    for rule_id, trait in traits.items():
        record = catalog[rule_id]
        assert record["variants"]
        assert record.get("fixture_strategy") == "cartesian_exhaustive" or record.get("fixtures")
        for variant in record["variants"]:
            assert variant["genotype_map"]
        if record["status"] in {"review_required", "do_not_import_unknown_formula"}:
            assert record["review_blockers"]


def test_generated_fixtures_exercise_all_formula_genotypes():
    traits = load_json(DEFAULT_TRAITS)
    catalog = load_json(EVIDENCE)["rules"]
    for trait in traits:
        record = catalog[trait["id"]]
        fixtures = (
            exhaustive_score_fixtures(trait)
            if record.get("fixture_strategy") == "cartesian_exhaustive"
            else record["fixtures"]
        )
        observed = {rsid: set() for rsid in trait["rsids"]}
        for fixture in fixtures:
            for rsid, genotype in fixture["genotypes"].items():
                observed.setdefault(rsid, set()).add(genotype)
        for variant in record["variants"]:
            rsid = variant["rsid"]
            assert observed[rsid] == set(variant["genotype_map"])


def test_legacy_audit_keeps_unreviewed_rules_visible():
    report = audit_legacy_traits(DEFAULT_TRAITS)
    assert report["total"] == 53
    assert len(report["missing_references"]) >= 40
    assert report["placeholder_references"] == []
    assert report["formula_rsid_mismatches"] == []


def test_wegene_candidates_are_blocked_until_formula_review():
    assert validate_manifest() == []
