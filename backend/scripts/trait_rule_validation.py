"""Validation helpers for evidence-backed Rootara trait rules.

The legacy default-traits.json format remains the runtime format for now. This
module keeps evidence, genotype mappings, and executable fixtures in a sidecar
catalog so rules can be reviewed before they are migrated into a new schema.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from itertools import product
from typing import Any

from scripts.rootara_traits import parse_formula


RSID_RE = re.compile(r"^rs\d+$")
GENOTYPE_RE = re.compile(r"^(?:[ACGTDI-]{2}|--)$")
SCORE_RULE_RE = re.compile(r"(rs\d+)\s*:\s*([^;]+)")


def _canonical_genotype(genotype: str) -> str:
    """Compare unphased genotypes independent of allele order."""

    if not isinstance(genotype, str) or len(genotype) != 2:
        return genotype
    return "".join(sorted(genotype.upper()))


def extract_formula_maps(formula: str) -> dict[str, dict[str, float]]:
    """Extract the genotype-to-score table from a legacy SCORE formula.

    The legacy format has no separate mapping schema. Keeping this parser in
    the audit tool lets us compare the declared sidecar mapping with the
    executable formula instead of trusting a hand-copied table.
    """

    if not isinstance(formula, str) or not formula.startswith("SCORE("):
        return {}
    maps: dict[str, dict[str, float]] = {}
    for rsid, rules in SCORE_RULE_RE.findall(formula[6:-1]):
        mapping: dict[str, float] = {}
        for pair in rules.split(","):
            genotype, score = pair.strip().split("=", 1)
            mapping[genotype.strip()] = float(score.strip())
        maps[rsid] = mapping
    return maps


def _expected_result_key(trait: dict[str, Any], score: float | bool) -> str | None:
    thresholds = trait.get("scoreThresholds", {})
    if isinstance(score, bool):
        return next((key for key, value in thresholds.items() if value == score), None)
    if isinstance(score, (int, float)):
        for key, threshold in thresholds.items():
            if isinstance(threshold, (int, float)) and score >= threshold:
                return key
        return None
    return None


def exhaustive_score_fixtures(trait: dict[str, Any]) -> list[dict[str, Any]]:
    """Create deterministic fixtures for every genotype combination.

    This is intentionally generated from the formula, not from a user's
    report. It exercises every mapping entry and all multi-locus combinations.
    """

    maps = extract_formula_maps(trait.get("formula", ""))
    if not maps:
        return []
    rsids = list(maps)
    fixtures = []
    for values in product(*(list(maps[rsid]) for rsid in rsids)):
        genotypes = dict(zip(rsids, values))
        expected_score = sum(maps[rsid][genotypes[rsid]] for rsid in rsids)
        fixtures.append(
            {
                "name": "__generated__" + "_".join(values),
                "genotypes": genotypes,
                "expected_score": expected_score,
                "expected_result_key": _expected_result_key(trait, expected_score),
            }
        )
    return fixtures


def load_json(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def resolve_legacy_result(trait: dict[str, Any], genotypes: dict[str, str]) -> tuple[float | bool, str | None]:
    """Evaluate a legacy formula and resolve its ordered threshold key."""

    value = parse_formula(trait["formula"], genotypes)
    thresholds = trait.get("scoreThresholds", {})
    result_key = None
    if isinstance(value, bool):
        for key, threshold in thresholds.items():
            if value == threshold:
                result_key = key
                break
    elif isinstance(value, (int, float)):
        for key, threshold in thresholds.items():
            if value >= threshold:
                result_key = key
                break
    return value, result_key


def validate_catalog(
    default_traits_path: str | Path,
    evidence_path: str | Path,
) -> list[str]:
    """Return human-readable catalog errors; an empty list means valid."""

    traits = {trait["id"]: trait for trait in load_json(default_traits_path)}
    catalog = load_json(evidence_path)
    errors: list[str] = []

    if catalog.get("schema_version") != 1:
        errors.append("catalog.schema_version must be 1")
    policy = catalog.get("review_policy", {})
    if not policy.get("curated_requires"):
        errors.append("catalog.review_policy.curated_requires must be non-empty")

    catalog_rules = catalog.get("rules", {})
    allowed_statuses = {
        "curated",
        "partial_evidence",
        "review_required",
        "do_not_import_unknown_formula",
    }

    for rule_id in sorted(set(traits) - set(catalog_rules)):
        errors.append(f"{rule_id}: missing evidence catalog entry")

    for rule_id, rule in catalog_rules.items():
        trait = traits.get(rule_id)
        if trait is None:
            errors.append(f"{rule_id}: no matching legacy trait")
            continue

        if trait.get("evidenceStatus") != rule.get("status"):
            errors.append(
                f"{rule_id}: default trait evidenceStatus does not match sidecar status"
            )
        if trait.get("evidenceGrade") != rule.get("evidence_grade"):
            errors.append(
                f"{rule_id}: default trait evidenceGrade does not match sidecar grade"
            )
        if rule.get("status") != "curated" and trait.get("confidence") != "low":
            errors.append(
                f"{rule_id}: unreviewed/default-low-confidence rule has confidence "
                f"{trait.get('confidence')!r}"
            )

        if rule.get("status") not in allowed_statuses:
            errors.append(f"{rule_id}: unsupported status {rule.get('status')!r}")

        variant_ids = [variant.get("rsid") for variant in rule.get("variants", [])]
        if len(variant_ids) != len(set(variant_ids)):
            errors.append(f"{rule_id}: duplicate variant RSID")
        if set(variant_ids) != set(trait.get("rsids", [])):
            errors.append(
                f"{rule_id}: evidence variants {sorted(variant_ids)} do not cover "
                f"legacy RSIDs {sorted(trait.get('rsids', []))}"
            )

        for variant in rule.get("variants", []):
            rsid = variant.get("rsid")
            if not isinstance(rsid, str) or not RSID_RE.fullmatch(rsid):
                errors.append(f"{rule_id}: invalid RSID {rsid!r}")
            mapping = variant.get("genotype_map", {})
            if not mapping:
                errors.append(f"{rule_id}/{rsid}: empty genotype_map")
            if rule.get("status") == "curated" and variant.get("mapping_status") not in {
                "complete",
                "literature_complete",
            }:
                errors.append(f"{rule_id}/{rsid}: curated mapping_status must be complete")
            for genotype, mapping_value in mapping.items():
                if not GENOTYPE_RE.fullmatch(genotype):
                    errors.append(f"{rule_id}/{rsid}: invalid genotype {genotype!r}")
                if not isinstance(mapping_value, dict):
                    errors.append(f"{rule_id}/{rsid}/{genotype}: mapping must be object")
            if rule.get("status") == "curated":
                for field in ("gene", "literature_alleles", "input_alleles", "effect_allele", "direction"):
                    if not variant.get(field):
                        errors.append(f"{rule_id}/{rsid}: curated mapping needs {field}")

        formula_maps = extract_formula_maps(trait.get("formula", ""))
        for rsid, expected_map in formula_maps.items():
            sidecar_variant = next(
                (variant for variant in rule.get("variants", []) if variant.get("rsid") == rsid),
                None,
            )
            if sidecar_variant is None:
                continue
            actual_map = sidecar_variant.get("genotype_map", {})
            actual_keys = {_canonical_genotype(key) for key in actual_map}
            expected_keys = {_canonical_genotype(key) for key in expected_map}
            if actual_keys != expected_keys:
                errors.append(
                    f"{rule_id}/{rsid}: genotype_map must cover exactly "
                    f"{sorted(expected_map)}; got {sorted(actual_map)}"
                )
            for genotype, expected_score in expected_map.items():
                canonical = _canonical_genotype(genotype)
                actual_entry = next(
                    (
                        value
                        for key, value in actual_map.items()
                        if _canonical_genotype(key) == canonical
                    ),
                    {},
                )
                actual_score = actual_entry.get("score")
                if actual_score is not None and float(actual_score) != expected_score:
                    errors.append(
                        f"{rule_id}/{rsid}/{genotype}: sidecar score "
                        f"{actual_score!r} != formula score {expected_score!r}"
                    )

        evidence = rule.get("evidence", [])
        if rule.get("status") in {"curated", "partial_evidence"} and not evidence:
            errors.append(f"{rule_id}: curated rule has no evidence")
        supported_terms = {
            term
            for item in evidence
            for term in item.get("supports", [])
        }
        if rule.get("status") == "curated":
            for rsid in variant_ids:
                if rsid not in supported_terms:
                    errors.append(f"{rule_id}: no evidence explicitly supports {rsid}")
        elif rule.get("status") == "partial_evidence" and not supported_terms:
            errors.append(f"{rule_id}: partial rule has no supported terms")
        for item in evidence:
            if item.get("type") not in {"PMID", "DOI", "ClinVar", "CPIC", "PharmGKB"}:
                errors.append(f"{rule_id}: unsupported evidence type {item.get('type')!r}")
            if not item.get("id") or not item.get("url"):
                errors.append(f"{rule_id}: evidence item needs id and url")
            if rule.get("status") == "curated":
                for field in ("title", "journal", "year", "studyType", "supports"):
                    if not item.get(field):
                        errors.append(f"{rule_id}: curated evidence item needs {field}")
                for field in ("population", "effectAllele", "direction"):
                    if not item.get(field):
                        errors.append(f"{rule_id}: curated evidence item needs {field}")
            if str(item.get("id")) in {"11111111", "222222222", "333333333"}:
                errors.append(f"{rule_id}: placeholder evidence identifier is forbidden")

        if rule.get("status") in {"review_required", "do_not_import_unknown_formula"}:
            if not rule.get("review_blockers"):
                errors.append(f"{rule_id}: review-required rule needs review_blockers")

        fixtures = rule.get("fixtures", [])
        if rule.get("fixture_strategy") == "cartesian_exhaustive":
            fixtures = exhaustive_score_fixtures(trait)
        for fixture in fixtures:
            try:
                value, result_key = resolve_legacy_result(trait, fixture["genotypes"])
            except Exception as exc:  # pragma: no cover - error is reported below
                errors.append(f"{rule_id}/{fixture.get('name')}: evaluation failed: {exc}")
                continue
            if value != fixture.get("expected_score"):
                errors.append(
                    f"{rule_id}/{fixture.get('name')}: expected score "
                    f"{fixture.get('expected_score')!r}, got {value!r}"
                )
            if result_key != fixture.get("expected_result_key"):
                errors.append(
                    f"{rule_id}/{fixture.get('name')}: expected result "
                    f"{fixture.get('expected_result_key')!r}, got {result_key!r}"
                )

    return errors


def audit_legacy_traits(default_traits_path: str | Path) -> dict[str, Any]:
    """Summarize legacy rules that still need evidence or formula review."""

    traits = load_json(default_traits_path)
    report: dict[str, Any] = {
        "total": len(traits),
        "missing_references": [],
        "placeholder_references": [],
        "formula_rsid_mismatches": [],
        "duplicate_rsids": [],
        "formula_only_rsids": [],
    }
    for trait in traits:
        if not trait.get("reference"):
            report["missing_references"].append(trait["id"])
        if any(reference in {"11111111", "222222222", "333333333"} for reference in trait.get("reference", [])):
            report["placeholder_references"].append(trait["id"])
        formula_rsids = set(re.findall(r"rs\d+", trait.get("formula", "")))
        declared_rsids = set(trait.get("rsids", []))
        if formula_rsids != declared_rsids:
            report["formula_rsid_mismatches"].append(
                {
                    "id": trait["id"],
                    "declared_only": sorted(declared_rsids - formula_rsids),
                    "formula_only": sorted(formula_rsids - declared_rsids),
                }
            )
        if len(trait.get("rsids", [])) != len(set(trait.get("rsids", []))):
            report["duplicate_rsids"].append(trait["id"])
    return report


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--default", default="backend/database/default-traits.json")
    parser.add_argument("--evidence", default="backend/database/trait-evidence.json")
    args = parser.parse_args()
    print(json.dumps({"audit": audit_legacy_traits(args.default), "catalog_errors": validate_catalog(args.default, args.evidence)}, ensure_ascii=False, indent=2))
