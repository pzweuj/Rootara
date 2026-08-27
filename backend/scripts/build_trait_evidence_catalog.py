"""Build the review catalog for the legacy default trait formulas.

The historical trait file is deliberately kept as the executable input for
v1. This command creates an auditable sidecar entry for every rule. Entries
that have not been independently reviewed are explicit ``review_required``
records; they are never silently promoted to curated evidence.

Usage (from the repository root)::

    PYTHONPATH=backend python -m scripts.build_trait_evidence_catalog \
      --write backend/database/trait-evidence.json

The command is deterministic and preserves hand-curated entries already in
the sidecar.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from scripts.trait_rule_validation import extract_formula_maps


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TRAITS = ROOT / "backend" / "database" / "default-traits.json"
DEFAULT_EVIDENCE = ROOT / "backend" / "database" / "trait-evidence.json"
CURATED_EVIDENCE = ROOT / "backend" / "database" / "curated-trait-evidence.json"


def _generated_rule(trait: dict[str, Any]) -> dict[str, Any]:
    formula_maps = extract_formula_maps(trait.get("formula", ""))
    variants = []
    for rsid, mapping in formula_maps.items():
        variants.append(
            {
                "rsid": rsid,
                "gene": None,
                "literature_alleles": None,
                "input_alleles": None,
                "mapping_status": "formula_complete_only",
                "genotype_map": {
                    genotype: {"score": score}
                    for genotype, score in mapping.items()
                },
            }
        )
    # Medical/risk formulas receive the stricter disposition. They must not
    # be enabled merely because a locus has a published association; a
    # clinical model needs validated effect sizes, ancestry scope and an
    # appropriate clinical disclaimer.
    status = (
        "do_not_import_unknown_formula"
        if trait.get("category") == "risk"
        else "review_required"
    )
    result = {
        "status": status,
        "evidence_grade": "unverified",
        "rule_type": "legacy_score",
        "variants": variants,
        "evidence": [],
        "fixture_strategy": "cartesian_exhaustive",
        "review_blockers": [
            "No independent literature record has been manually verified for this exact formula.",
            "The legacy score direction, weights, threshold and population scope require review.",
            "A complete genotype map is derived from the legacy formula only; it is not evidence of a biological effect.",
        ],
        "limitations": [
            "Do not present this rule as a validated genetic interpretation until the blockers are resolved.",
        ],
    }


def build(default_path: Path = DEFAULT_TRAITS, evidence_path: Path = DEFAULT_EVIDENCE) -> dict[str, Any]:
    traits = json.loads(default_path.read_text(encoding="utf-8"))
    existing = json.loads(evidence_path.read_text(encoding="utf-8")) if evidence_path.exists() else {}
    curated = json.loads(CURATED_EVIDENCE.read_text(encoding="utf-8")) if CURATED_EVIDENCE.exists() else {}
    existing_rules = {**existing.get("rules", {}), **curated}
    rules: dict[str, Any] = {}
    for trait in traits:
        rule_id = trait["id"]
        rules[rule_id] = existing_rules.get(rule_id, _generated_rule(trait))
    result = {
        "schema_version": 1,
        "description": "Evidence, complete legacy genotype mappings and executable fixtures for every Rootara default rule.",
        "release_contract": {
            "target_count": 150,
            "requires_all_curated": True,
            "allowed_evidence_grades": ["A", "B"],
        },
        "review_policy": {
            "curated_requires": [
                "independent source per declared RSID",
                "explicit allele orientation and genotype mapping",
                "executable fixtures covering every genotype combination",
                "population scope and limitations",
            ],
            "unreviewed_behavior": "withhold result_current and expose evaluationStatus=review_required",
        },
        "rules": rules,
    }
    if existing.get("review_audit"):
        result["review_audit"] = existing["review_audit"]
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--default", type=Path, default=DEFAULT_TRAITS)
    parser.add_argument("--evidence", type=Path, default=DEFAULT_EVIDENCE)
    parser.add_argument("--write", type=Path)
    args = parser.parse_args()
    result = build(args.default, args.evidence)
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.write:
        args.write.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
