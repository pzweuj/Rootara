"""Render a deterministic evidence-review queue for maintainers."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "backend/database/default-traits.json"
EVIDENCE = ROOT / "backend/database/trait-evidence.json"
MANIFEST = ROOT / "backend/database/trait-candidate-review.json"


def render(default_path: Path = DEFAULT, evidence_path: Path = EVIDENCE, manifest_path: Path = MANIFEST) -> str:
    traits = json.loads(default_path.read_text(encoding="utf-8"))
    rules = json.loads(evidence_path.read_text(encoding="utf-8")).get("rules", {})
    evidence_catalog = json.loads(evidence_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    status_counts = Counter(rule.get("status", "missing") for rule in rules.values())
    candidates = manifest.get("candidates", [])
    supplemental = manifest.get("supplemental_candidates", [])
    all_candidates = [*candidates, *supplemental]
    candidate_counts = Counter(item.get("review_status", "pending") for item in all_candidates)
    supplemental_count = manifest.get("source", {}).get("supplemental_discovery", {}).get("count", 0)

    lines = [
        "# Rootara trait evidence audit",
        "",
        f"- Production rules: **{len(traits)}**",
        f"- Production evidence statuses: **{dict(status_counts)}**",
        f"- Discovery candidates: **{len(candidates) + supplemental_count}** ({len(candidates)} priority + {supplemental_count} supplemental)",
        f"- Candidate review statuses: **{dict(candidate_counts)}**",
        "",
        "## Production queue",
        "",
        "| ID | Category | Status | Grade | RSIDs | Blockers |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for trait in traits:
        rule = rules.get(trait["id"], {})
        blockers = "; ".join(rule.get("review_blockers", [])) or "—"
        lines.append(
            f"| `{trait['id']}` | {trait.get('category', '')} | "
            f"`{rule.get('status', 'missing')}` | `{rule.get('evidence_grade', 'missing')}` | "
            f"{', '.join(trait.get('rsids', []))} | {blockers} |"
        )
    audit = evidence_catalog.get("review_audit", {})
    lines.extend(["", "## Production audit decisions", "", "| ID | Decision | Reason |", "| --- | --- | --- |"])
    for item in [
        *audit.get("removed_from_production", []),
        *audit.get("reclassified_from_risk", []),
        *audit.get("formula_reductions", []),
    ]:
        replacement = item.get("replacement_id")
        reason = item.get("reason", "")
        if replacement:
            reason = f"replacement: `{replacement}`; {reason}"
        lines.append(f"| `{item.get('id', '')}` | `{item.get('decision', '')}` | {reason} |")
    lines.extend(["", "## Candidate queue", "", "| ID | Name | Review status | Disposition/reason |", "| --- | --- | --- | --- |"])
    for candidate in all_candidates:
        status = candidate.get("review_status", "pending")
        disposition = candidate.get("disposition", "")
        reason = candidate.get("rejection_reason", "")
        reason = f"`{disposition}`: {reason}" if disposition and reason else disposition or reason
        name = candidate.get("name", {}).get("zh-CN", candidate.get("id", ""))
        lines.append(f"| `{candidate.get('id', '')}` | {name} | `{status}` | {reason} |")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path)
    args = parser.parse_args()
    rendered = render()
    if args.write:
        args.write.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
