"""Materialize the evidence status into the legacy default-traits format.

The runtime still reads the legacy array format. This command keeps that file
auditable by copying the reviewed status, evidence grade and limitations from
the sidecar while leaving the existing formula/result shape intact.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "backend" / "database" / "default-traits.json"
EVIDENCE = ROOT / "backend" / "database" / "trait-evidence.json"


def materialize(default_path: Path = DEFAULT, evidence_path: Path = EVIDENCE) -> list[dict]:
    traits = json.loads(default_path.read_text(encoding="utf-8"))
    rules = json.loads(evidence_path.read_text(encoding="utf-8")).get("rules", {})
    for trait in traits:
        review = rules.get(trait.get("id"))
        if not review:
            continue
        trait["evidenceStatus"] = review.get("status")
        trait["evidenceGrade"] = review.get("evidence_grade")
        trait["limitations"] = review.get("limitations", [])
        trait["reviewBlockers"] = review.get("review_blockers", [])
        if review.get("status") != "curated":
            # Preserve the legacy formula for review, but do not expose its
            # historical confidence label as if it were evidence-backed.
            trait["confidence"] = "low"
        # PMID identifiers remain in the legacy `reference` field so existing
        # import/export clients keep working.
        pmids = [
            item["id"]
            for item in review.get("evidence", [])
            if item.get("type") == "PMID" and item.get("id")
        ]
        if pmids:
            trait["reference"] = pmids
    return traits


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--default", type=Path, default=DEFAULT)
    parser.add_argument("--evidence", type=Path, default=EVIDENCE)
    parser.add_argument("--write", type=Path)
    args = parser.parse_args()
    rendered = json.dumps(materialize(args.default, args.evidence), ensure_ascii=False, indent=2) + "\n"
    if args.write:
        args.write.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
