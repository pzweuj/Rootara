"""Validation for the WeGene candidate review manifest.

Candidate pages are a discovery source only. The validator makes it hard to
accidentally turn an observed demo genotype into a production rule without a
formula, complete mapping and independent evidence.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "backend" / "database" / "trait-candidate-review.json"
SOURCE = ROOT / "docs" / "wegene-demo-priority-candidates.json"

REJECTED_DISPOSITIONS = {
    "rejected_evidence_insufficient",
    "rejected_semantic_duplicate",
    "rejected_medical_model_insufficient",
}


def validate_manifest(manifest_path: str | Path = MANIFEST, source_path: str | Path = SOURCE) -> list[str]:
    manifest: dict[str, Any] = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    source: dict[str, Any] = json.loads(Path(source_path).read_text(encoding="utf-8"))
    errors: list[str] = []
    supplemental = manifest.get("source", {}).get("supplemental_discovery")
    if supplemental:
        supplemental_path = ROOT / supplemental.get("path", "")
        if not supplemental_path.exists():
            errors.append("supplemental discovery source does not exist")
        else:
            supplemental_data = json.loads(supplemental_path.read_text(encoding="utf-8"))
            expected = supplemental.get("count")
            actual = len(supplemental_data.get("traits", []))
            if expected != actual:
                errors.append(f"supplemental discovery count mismatch: {expected} != {actual}")
    candidates = manifest.get("candidates", [])
    source_traits = source.get("traits", [])
    if len(candidates) != len(source_traits):
        errors.append(f"candidate count mismatch: {len(candidates)} != {len(source_traits)}")
    source_by_id = {item.get("id"): item for item in source_traits}
    candidate_ids = {item.get("id") for item in candidates}
    if candidate_ids != set(source_by_id):
        errors.append("manifest candidate IDs do not match the discovery source")
    if manifest.get("counts", {}).get("selected_candidates") != len(candidates):
        errors.append("manifest counts.selected_candidates is stale")
    review_statuses = {"pending", "accepted", "rejected"}
    supplemental_count = manifest.get("source", {}).get("supplemental_discovery", {}).get("count", 0)
    if manifest.get("counts", {}).get("total_discovered") != len(candidates) + supplemental_count:
        errors.append("manifest counts.total_discovered is stale")
    supplemental_candidates = manifest.get("supplemental_candidates", [])
    statuses = {status: sum(1 for item in [*candidates, *supplemental_candidates]
                             if item.get("review_status", "pending") == status)
                for status in review_statuses}
    for status, count in statuses.items():
        declared = manifest.get("counts", {}).get(f"{status}_candidates")
        if declared is not None and declared != count:
            errors.append(f"manifest counts.{status}_candidates is stale")
    for candidate in candidates:
        cid = candidate.get("id", "<missing>")
        status = candidate.get("review_status", "pending")
        if status not in review_statuses:
            errors.append(f"{cid}: unsupported review_status {status!r}")
        if status == "pending":
            if candidate.get("disposition") != "do_not_import_unknown_formula":
                errors.append(f"{cid}: pending candidate must remain blocked")
            if candidate.get("formula_status") != "unknown":
                errors.append(f"{cid}: pending formula_status must remain unknown")
            if candidate.get("mapping_status") != "observed_only_incomplete":
                errors.append(f"{cid}: pending mapping_status must remain incomplete")
        elif status == "accepted":
            if candidate.get("disposition") != "accepted_independent_evidence":
                errors.append(f"{cid}: accepted candidate needs an explicit accepted disposition")
            if not candidate.get("production_trait_id"):
                errors.append(f"{cid}: accepted candidate needs production_trait_id")
            if not candidate.get("evidence"):
                errors.append(f"{cid}: accepted candidate needs independent evidence")
            for item in candidate.get("evidence", []):
                if not item.get("id") or not item.get("url"):
                    errors.append(f"{cid}: accepted evidence needs id and url")
                if not item.get("title") or not item.get("year"):
                    errors.append(f"{cid}: accepted evidence needs title and year")
            if candidate.get("mapping_status") not in {"complete", "literature_complete"}:
                errors.append(f"{cid}: accepted candidate needs a complete mapping")
        elif status == "rejected":
            if candidate.get("disposition") not in REJECTED_DISPOSITIONS:
                errors.append(f"{cid}: rejected candidate needs an explicit rejection disposition")
            if not candidate.get("rejection_reason"):
                errors.append(f"{cid}: rejected candidate needs rejection_reason")
            if not candidate.get("reviewed_at") or not candidate.get("reviewer"):
                errors.append(f"{cid}: rejected candidate needs reviewer and reviewed_at")
        if not candidate.get("rsids"):
            errors.append(f"{cid}: candidate has no RSID")
        if cid in source_by_id and candidate.get("rsids") != source_by_id[cid].get("rsids"):
            errors.append(f"{cid}: manifest RSIDs differ from discovery source")
        if not candidate.get("review_blockers"):
            if status == "pending":
                errors.append(f"{cid}: candidate has no review blockers")
    supplemental_path = ROOT / manifest.get("source", {}).get("supplemental_discovery", {}).get("path", "")
    supplemental_source = (
        json.loads(supplemental_path.read_text(encoding="utf-8"))
        if supplemental_candidates and supplemental_path.exists()
        else {"traits": []}
    )
    supplemental_by_id = {item.get("id"): item for item in supplemental_source.get("traits", [])}
    if {item.get("id") for item in supplemental_candidates} != set(supplemental_by_id):
        errors.append("supplemental candidate IDs do not match the discovery source")
    for candidate in supplemental_candidates:
        cid = candidate.get("id", "<missing>")
        if candidate.get("review_status") not in review_statuses:
            errors.append(f"{cid}: unsupported supplemental review_status")
        if candidate.get("review_status") == "rejected":
            if candidate.get("disposition") not in REJECTED_DISPOSITIONS:
                errors.append(f"{cid}: rejected supplemental candidate needs an explicit rejection disposition")
            if not candidate.get("rejection_reason"):
                errors.append(f"{cid}: rejected supplemental candidate needs rejection_reason")
            if not candidate.get("reviewed_at") or not candidate.get("reviewer"):
                errors.append(f"{cid}: rejected supplemental candidate needs reviewer and reviewed_at")
        if not candidate.get("rsids"):
            errors.append(f"{cid}: supplemental candidate has no RSID")
        if cid in supplemental_by_id and candidate.get("rsids") != supplemental_by_id[cid].get("rsids"):
            errors.append(f"{cid}: supplemental manifest RSIDs differ from discovery source")
    return errors


if __name__ == "__main__":
    errors = validate_manifest()
    print(json.dumps({"errors": errors, "valid": not errors}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if errors else 0)
