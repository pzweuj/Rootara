"""Build and materialize Rootara's single normalized trait catalog.

``trait-catalog.json`` is the runtime and review source.  The historical
``default-traits.json``, ``trait-evidence.json`` and locus registry remain
generated compatibility artifacts for one release cycle.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DATABASE = ROOT / "backend" / "database"
SOURCE = DATABASE / "trait-catalog.json"
DEFAULT = DATABASE / "default-traits.json"
EVIDENCE = DATABASE / "trait-evidence.json"
LOCI = DATABASE / "trait-locus-registry.json"


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, value: Any) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def _version(document: dict[str, Any]) -> str:
    versionless = {key: value for key, value in document.items() if key != "catalogVersion"}
    canonical = json.dumps(
        versionless, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()[:16]


def bootstrap_from_compatibility(
    default_path: Path = DEFAULT,
    evidence_path: Path = EVIDENCE,
    locus_path: Path = LOCI,
) -> dict[str, Any]:
    traits = _read(default_path)
    evidence_document = _read(evidence_path)
    locus_document = _read(locus_path)
    rules = evidence_document.get("rules", {})
    ids = [trait.get("id") for trait in traits]
    if len(ids) != len(set(ids)) or set(ids) != set(rules):
        raise ValueError("trait definitions and evidence records are not one-to-one")
    declared_rsids = {rsid for trait in traits for rsid in trait.get("rsids", [])}
    if declared_rsids != set(locus_document.get("loci", {})):
        raise ValueError("locus registry does not exactly match declared trait RSIDs")

    normalized_traits = []
    for trait in traits:
        normalized_traits.append({
            **copy.deepcopy(trait),
            "evidenceRecord": copy.deepcopy(rules[trait["id"]]),
        })
    document = {
        "schemaVersion": 1,
        "description": "Normalized, versioned Rootara production trait catalog.",
        "reviewedAt": locus_document.get("reviewedAt"),
        "evidenceMetadata": {
            key: copy.deepcopy(value)
            for key, value in evidence_document.items()
            if key != "rules"
        },
        "locusRegistry": copy.deepcopy(locus_document),
        "traits": normalized_traits,
    }
    document["catalogVersion"] = _version(document)
    return document


def materialize_compatibility(document: dict[str, Any]) -> tuple[list, dict, dict]:
    if document.get("catalogVersion") != _version(document):
        raise ValueError("normalized trait catalog version hash is stale")
    traits = []
    rules = {}
    for item in document.get("traits", []):
        trait = {key: copy.deepcopy(value) for key, value in item.items() if key != "evidenceRecord"}
        traits.append(trait)
        rules[trait["id"]] = copy.deepcopy(item.get("evidenceRecord", {}))
    evidence = {**copy.deepcopy(document.get("evidenceMetadata", {})), "rules": rules}
    loci = copy.deepcopy(document.get("locusRegistry", {}))
    return traits, evidence, loci


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--bootstrap",
        action="store_true",
        help="create the normalized source from the reviewed compatibility files",
    )
    parser.add_argument(
        "--update-version",
        action="store_true",
        help="refresh catalogVersion after an intentional source edit",
    )
    args = parser.parse_args()
    if args.bootstrap:
        document = bootstrap_from_compatibility()
        _write(SOURCE, document)
    else:
        document = _read(SOURCE)
        if args.update_version:
            document["catalogVersion"] = _version(document)
            _write(SOURCE, document)
    traits, evidence, loci = materialize_compatibility(document)
    _write(DEFAULT, traits)
    _write(EVIDENCE, evidence)
    _write(LOCI, loci)
    print(json.dumps({
        "version": document["catalogVersion"],
        "traits": len(traits),
        "loci": len(loci.get("loci", {})),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
