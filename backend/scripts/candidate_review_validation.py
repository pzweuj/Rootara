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


def validate_manifest(manifest_path: str | Path = MANIFEST, source_path: str | Path = SOURCE) -> list[str]:
    manifest: dict[str, Any] = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    source: dict[str, Any] = json.loads(Path(source_path).read_text(encoding="utf-8"))
    errors: list[str] = []
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
    for candidate in candidates:
        cid = candidate.get("id", "<missing>")
        if candidate.get("disposition") != "do_not_import_unknown_formula":
            errors.append(f"{cid}: candidate is not blocked pending formula review")
        if candidate.get("formula_status") != "unknown":
            errors.append(f"{cid}: formula_status must remain unknown")
        if candidate.get("mapping_status") != "observed_only_incomplete":
            errors.append(f"{cid}: mapping_status must remain observed_only_incomplete")
        if not candidate.get("rsids"):
            errors.append(f"{cid}: candidate has no RSID")
        if cid in source_by_id and candidate.get("rsids") != source_by_id[cid].get("rsids"):
            errors.append(f"{cid}: manifest RSIDs differ from discovery source")
        if not candidate.get("review_blockers"):
            errors.append(f"{cid}: candidate has no review blockers")
    return errors


if __name__ == "__main__":
    errors = validate_manifest()
    print(json.dumps({"errors": errors, "valid": not errors}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if errors else 0)
