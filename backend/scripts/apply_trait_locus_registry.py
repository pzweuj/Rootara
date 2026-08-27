"""Rewrite executable trait rules onto reviewed GRCh38 forward alleles."""

from __future__ import annotations

import argparse
import itertools
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "backend/database/default-traits.json"
EVIDENCE = ROOT / "backend/database/trait-evidence.json"
CURATED = ROOT / "backend/database/curated-trait-evidence.json"
REGISTRY = ROOT / "backend/database/trait-locus-registry.json"


def _write(path: Path, value: Any) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def _formula_maps(formula: str) -> dict[str, dict[str, float]]:
    maps = {}
    for rsid, body in re.findall(r"(rs\d+)\s*:\s*([^;)]+)", formula):
        maps[rsid] = {
            "".join(sorted(genotype.strip())): float(score.strip())
            for genotype, score in (item.split("=", 1) for item in body.split(","))
        }
    return maps


def _format_score(value: float) -> str:
    return str(int(value)) if value.is_integer() else str(value)


def _rewrite_group(formula: str, rsid: str, mapping: dict[str, float]) -> str:
    replacement = ",".join(
        f"{genotype}={_format_score(score)}" for genotype, score in mapping.items()
    )
    pattern = re.compile(rf"({re.escape(rsid)}\s*:\s*)[^;)]+")
    rewritten, count = pattern.subn(rf"\g<1>{replacement}", formula, count=1)
    if count != 1:
        raise ValueError(f"{rsid}: formula group not found")
    return rewritten


def _forward_mapping(
    old_mapping: dict[str, float], old_effect: str, new_effect: str, alleles: list[str]
) -> dict[str, float]:
    if len(alleles) != 2 or new_effect not in alleles:
        raise ValueError("reviewed forward allele pair is incomplete")
    old_alleles = sorted({base for genotype in old_mapping for base in genotype})
    if len(old_alleles) != 2 or old_effect not in old_alleles:
        raise ValueError("legacy formula does not contain the literature effect allele")
    old_other = next(allele for allele in old_alleles if allele != old_effect)
    new_other = next(allele for allele in alleles if allele != new_effect)
    old_heterozygote = "".join(sorted((old_effect, old_other)))
    new_heterozygote = "".join(sorted((new_effect, new_other)))
    return {
        new_effect * 2: old_mapping[old_effect * 2],
        new_heterozygote: old_mapping[old_heterozygote],
        new_other * 2: old_mapping[old_other * 2],
    }


def _result_key(trait: dict[str, Any], score: float) -> str | None:
    thresholds = sorted(
        trait.get("scoreThresholds", {}).items(), key=lambda item: float(item[1]), reverse=True
    )
    return next((key for key, threshold in thresholds if score >= float(threshold)), None)


def apply_registry() -> dict[str, int]:
    traits = json.loads(DEFAULT.read_text(encoding="utf-8"))
    evidence_document = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    rules = evidence_document["rules"]
    loci = json.loads(REGISTRY.read_text(encoding="utf-8"))["loci"]
    converted = 0
    blocked = 0

    for trait in traits:
        rule = rules[trait["id"]]
        formula_maps = _formula_maps(trait["formula"])
        executable_maps: dict[str, dict[str, float]] = {}
        for variant in rule.get("variants", []):
            rsid = variant["rsid"]
            locus = loci[rsid]
            old_map = formula_maps[rsid]
            if locus.get("status") != "verified":
                executable_maps[rsid] = old_map
                blocked += 1
                continue
            if (
                variant.get("strand_transform") in {"identity", "complement"}
                and variant.get("forward_effect_allele") == locus["forwardEffectAllele"]
                and set(base for genotype in old_map for base in genotype)
                == set(locus["traitAlleles"])
            ):
                variant["literature_alleles"] = locus.get("literatureAlleles") or variant.get("literature_alleles")
                variant["literature_effect_allele"] = locus.get("literatureEffectAllele") or variant.get("literature_effect_allele")
                variant["input_alleles"] = ">".join(locus["traitAlleles"])
                variant["strand_transform"] = locus["inputTransform"]
                executable_maps[rsid] = old_map
                continue
            new_map = _forward_mapping(
                old_map,
                str(variant["effect_allele"]).upper(),
                locus["forwardEffectAllele"],
                locus["traitAlleles"],
            )
            trait["formula"] = _rewrite_group(trait["formula"], rsid, new_map)
            executable_maps[rsid] = new_map
            literature_effect = locus.get("literatureEffectAllele") or variant["effect_allele"]
            variant["literature_alleles"] = locus.get("literatureAlleles") or variant.get("literature_alleles")
            variant["literature_effect_allele"] = literature_effect
            variant["forward_effect_allele"] = locus["forwardEffectAllele"]
            variant["effect_allele"] = locus["forwardEffectAllele"]
            variant["input_alleles"] = ">".join(locus["traitAlleles"])
            variant["strand_transform"] = locus["inputTransform"]
            variant["input_note"] = (
                "Executable genotypes use the reviewed GRCh38 forward strand; "
                "literature notation is preserved separately."
            )
            variant["genotype_map"] = {
                genotype: {"result_key": _result_key(trait, score), "score": score}
                for genotype, score in new_map.items()
            }
            for citation in rule.get("evidence", []):
                if rsid in citation.get("supports", []):
                    citation["forwardEffectAllele"] = locus["forwardEffectAllele"]
            converted += 1

        # Fixtures are executable release tests, so regenerate the complete
        # Cartesian space after any strand rewrite.
        keys = list(executable_maps)
        fixtures = []
        for genotypes in itertools.product(*(list(executable_maps[key]) for key in keys)):
            genotype_map = dict(zip(keys, genotypes))
            score = sum(executable_maps[key][genotype_map[key]] for key in keys)
            fixtures.append({
                "name": "forward_" + "_".join(genotypes),
                "genotypes": genotype_map,
                "expected_score": score,
                "expected_result_key": _result_key(trait, score),
            })
        rule["fixtures"] = fixtures
        if trait.get("referenceGenotypes"):
            trait["referenceGenotypes"] = [
                next(iter(executable_maps[rsid])) for rsid in trait.get("rsids", [])
            ]
        if trait.get("yourGenotypes"):
            trait["yourGenotypes"] = list(trait["referenceGenotypes"])

    _write(DEFAULT, traits)
    _write(EVIDENCE, evidence_document)
    _write(CURATED, rules)
    return {"converted": converted, "blocked": blocked}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args()
    result = apply_registry()
    print(json.dumps(result, ensure_ascii=False))
    return 1 if result["blocked"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
