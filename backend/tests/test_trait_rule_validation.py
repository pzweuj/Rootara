from pathlib import Path
import json

from scripts.trait_rule_validation import (
    audit_legacy_traits,
    exhaustive_score_fixtures,
    load_json,
    validate_catalog,
)
from scripts.candidate_review_validation import validate_manifest
from scripts.production_catalog_validation import validate_production_catalog


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TRAITS = ROOT / "backend" / "database" / "default-traits.json"
EVIDENCE = ROOT / "backend" / "database" / "trait-evidence.json"


def test_evidence_catalog_and_fixtures_are_valid():
    assert validate_catalog(DEFAULT_TRAITS, EVIDENCE) == []


def test_curated_catalog_contains_independent_sources():
    catalog = load_json(EVIDENCE)
    curated = [rule for rule in catalog["rules"].values() if rule["status"] == "curated"]
    assert len(curated) == 150
    assert all(rule["evidence"] for rule in curated)
    assert all(item["type"] in {"PMID", "DOI", "ClinVar", "CPIC", "PharmGKB"} for rule in curated for item in rule["evidence"])
    assert all(
        item.get("journal") != "PubMed-indexed journal"
        and not str(item.get("title", "")).startswith("Published genetic association evidence")
        for rule in curated
        for item in rule["evidence"]
    )


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


def test_production_audit_has_no_missing_references():
    report = audit_legacy_traits(DEFAULT_TRAITS)
    assert report["total"] == 150
    assert report["missing_references"] == []
    assert report["placeholder_references"] == []
    assert report["formula_rsid_mismatches"] == []


def test_wegene_candidates_are_blocked_until_formula_review():
    assert validate_manifest() == []


def test_candidate_review_requires_explicit_rejection_disposition(tmp_path):
    manifest = load_json(ROOT / "backend" / "database" / "trait-candidate-review.json")
    manifest["candidates"][0]["disposition"] = "rejected_unknown_reason"
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    errors = validate_manifest(path)
    assert any("explicit rejection disposition" in error for error in errors)


def test_production_release_gate_has_exact_count_and_medical_sources():
    assert validate_production_catalog(DEFAULT_TRAITS, EVIDENCE) == []
    traits = load_json(DEFAULT_TRAITS)
    evidence = load_json(EVIDENCE)
    risk_traits = [trait for trait in traits if trait.get("category") == "risk"]
    assert len(traits) == 150
    assert {trait["id"] for trait in risk_traits} == {
        "warfarin-sensitivity",
        "clopidogrel-response",
        "statin-response",
    }
    assert all(
        any(item["type"] in {"ClinVar", "CPIC", "PharmGKB"} for item in evidence["rules"][trait["id"]]["evidence"])
        for trait in risk_traits
    )


def test_production_release_gate_rejects_unvalidated_risk_rule(tmp_path):
    traits = load_json(DEFAULT_TRAITS)
    evidence = load_json(EVIDENCE)
    traits[0]["category"] = "risk"
    evidence["rules"][traits[0]["id"]]["evidence"] = [
        item for item in evidence["rules"][traits[0]["id"]]["evidence"]
        if item["type"] not in {"ClinVar", "CPIC", "PharmGKB"}
    ]
    default_path = tmp_path / "default.json"
    evidence_path = tmp_path / "evidence.json"
    default_path.write_text(json.dumps(traits), encoding="utf-8")
    evidence_path.write_text(json.dumps(evidence), encoding="utf-8")
    errors = validate_production_catalog(default_path, evidence_path)
    assert any("needs ClinVar, CPIC, PharmGKB" in error for error in errors)
