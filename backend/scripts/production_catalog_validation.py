"""Release-gate checks for the fully reviewed production trait catalog."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from scripts.trait_rule_validation import extract_formula_maps, validate_catalog
from scripts.materialize_trait_catalog import SOURCE, materialize_compatibility


ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "backend" / "database" / "default-traits.json"
EVIDENCE = ROOT / "backend" / "database" / "trait-evidence.json"
LOCI = ROOT / "backend" / "database" / "trait-locus-registry.json"
RSID_RE = re.compile(r"^rs\d+$")
def _canonical_genotype(genotype: str) -> str:
    if len(genotype) != 2 or genotype == "--":
        return genotype
    return "".join(sorted(genotype))


def _mapping_is_complete(mapping: dict[str, Any]) -> bool:
    """Require both homozygotes and the unordered heterozygote.

    The reader may emit either order for a heterozygote.  Production records
    store one canonical spelling, so a three-entry map is complete without
    pretending that every A/C/G/T combination is biologically possible at the
    locus.
    """

    canonical = {_canonical_genotype(key) for key in mapping}
    alleles = {base for genotype in canonical for base in genotype if base in "ACGTDI"}
    if alleles == {"D", "I"}:
        return canonical == {"DD", "DI", "II"}
    if len(alleles) != 2 or not alleles <= set("ACGT"):
        return False
    first, second = sorted(alleles)
    return canonical == {first + first, first + second, second + second}


def validate_production_catalog(
    default_path: str | Path = DEFAULT,
    evidence_path: str | Path = EVIDENCE,
    locus_path: str | Path = LOCI,
    expected_count: int = 150,
) -> list[str]:
    """Return errors that must block a production release.

    The existing sidecar validator checks formula parity and executable
    fixtures. This release gate adds the stronger launch contract: exact
    catalog size, curated evidence only, complete bibliographic records, and
    direct support for every declared locus.
    """

    traits: list[dict[str, Any]] = json.loads(Path(default_path).read_text(encoding="utf-8"))
    catalog = json.loads(Path(evidence_path).read_text(encoding="utf-8"))
    locus_document = json.loads(Path(locus_path).read_text(encoding="utf-8"))
    normalized_document = json.loads(SOURCE.read_text(encoding="utf-8"))
    generated_traits, generated_evidence, generated_loci = materialize_compatibility(
        normalized_document
    )
    loci = locus_document.get("loci", {})
    errors = validate_catalog(default_path, evidence_path)
    if generated_traits != traits or generated_evidence != catalog or generated_loci != locus_document:
        errors.append("normalized trait catalog and compatibility artifacts are out of sync")
    if len(traits) != expected_count:
        errors.append(f"production count {len(traits)} != {expected_count}")

    ids = [trait.get("id") for trait in traits]
    declared_rsids = {rsid for trait in traits for rsid in trait.get("rsids", [])}
    if len(declared_rsids) != 153:
        errors.append(f"production locus count {len(declared_rsids)} != 153")
    if set(loci) != declared_rsids:
        errors.append("trait locus registry does not exactly match production RSIDs")
    for rsid, locus in loci.items():
        if locus.get("status") != "verified":
            errors.append(f"{rsid}: locus registry status is not verified")
        if locus.get("sourceAgreement") is not True:
            errors.append(f"{rsid}: NCBI and Ensembl GRCh38 placements disagree")
        for assembly in ("grch37", "grch38"):
            placement = locus.get(assembly) or {}
            if not placement.get("chromosome") or not placement.get("position"):
                errors.append(f"{rsid}: missing {assembly} chromosome placement")
        grch38 = locus.get("grch38") or {}
        if not grch38.get("reference") or not grch38.get("alternates", []):
            errors.append(f"{rsid}: missing GRCh38 reference/alternate alleles")
        trait_alleles = set(locus.get("traitAlleles", []))
        forward_alleles = {grch38.get("reference"), *grch38.get("alternates", [])}
        encoded_indel = locus.get("alleleEncoding") == "insertion_deletion"
        if len(trait_alleles) != 2 or (
            not encoded_indel and not trait_alleles <= forward_alleles
        ):
            errors.append(f"{rsid}: reviewed trait allele pair is incomplete or not forward-strand")
        if not locus.get("forwardEffectAllele"):
            errors.append(f"{rsid}: missing forward-strand effect allele")
        if locus.get("forwardEffectAllele") not in trait_alleles:
            errors.append(f"{rsid}: effect allele is outside the reviewed trait allele pair")
        if locus.get("inputTransform") not in {"identity", "complement"}:
            errors.append(f"{rsid}: unresolved literature allele orientation")
    if len(ids) != len(set(ids)):
        errors.append("production catalog contains duplicate ids")
    names: set[tuple[str, str]] = set()
    rules = catalog.get("rules", {})
    if set(rules) != set(ids):
        missing = sorted(set(ids) - set(rules))
        extra = sorted(set(rules) - set(ids))
        if missing:
            errors.append(f"production evidence missing ids: {missing}")
        if extra:
            errors.append(f"production evidence has unknown ids: {extra}")
    for trait in traits:
        name = trait.get("name", {})
        if trait.get("id", "").startswith("gwas-") and "GWAS" in str(name.get("en", "")):
            errors.append(f"{trait.get('id')}: generated GWAS suffix must not appear in title")
        if not re.search(r"[\u4e00-\u9fff]", str(name.get("zh-CN", ""))):
            errors.append(f"{trait.get('id')}: Chinese name is not localized")
        if str(name.get("zh-CN", "")).strip().casefold() == str(name.get("en", "")).strip().casefold():
            errors.append(f"{trait.get('id')}: Chinese name duplicates English")
        description = trait.get("description", {})
        if not re.search(r"[\u4e00-\u9fff]", str(description.get("zh-CN", ""))):
            errors.append(f"{trait.get('id')}: Chinese description is not localized")
        normalized = (
            str(name.get("en", "")).strip().casefold(),
            str(name.get("zh-CN", "")).strip(),
        )
        if normalized in names:
            errors.append(f"duplicate normalized trait name: {normalized}")
        names.add(normalized)

        rule = rules.get(trait.get("id"), {})
        if trait.get("category") == "risk":
            authoritative = {str(item.get("type")) for item in rule.get("evidence", [])}
            has_validated_model = (
                isinstance(rule.get("validated_model"), dict)
                and rule["validated_model"].get("complete") is True
                and bool(rule["validated_model"].get("source"))
            )
            if not authoritative.intersection({"ClinVar", "CPIC", "PharmGKB"}) and not has_validated_model:
                errors.append(
                    f"{trait.get('id')}: medical/risk rule needs ClinVar, CPIC, PharmGKB, or a complete validated model"
                )
            if not rule.get("medical_disclaimer"):
                errors.append(f"{trait.get('id')}: medical/risk rule needs an explicit disclaimer")
        if rule.get("status") != "curated":
            errors.append(f"{trait.get('id')}: production rule is not curated")
        if rule.get("evidence_grade") not in {"A", "B"}:
            errors.append(f"{trait.get('id')}: unsupported production evidence grade")
        if not rule.get("population_scope"):
            errors.append(f"{trait.get('id')}: missing population scope")
        if rule.get("review_blockers"):
            errors.append(f"{trait.get('id')}: curated rule still has review blockers")
        if not rule.get("limitations"):
            errors.append(f"{trait.get('id')}: curated rule needs explicit limitations")
        if not rule.get("population_scope_i18n", {}).get("zh-CN"):
            errors.append(f"{trait.get('id')}: missing Chinese population scope")
        if not rule.get("limitations_i18n", {}).get("zh-CN"):
            errors.append(f"{trait.get('id')}: missing Chinese limitations")
        if not rule.get("evidence"):
            errors.append(f"{trait.get('id')}: curated rule needs evidence")
        for evidence in rule.get("evidence", []):
            required = ("id", "url", "title", "journal", "year", "studyType", "supports")
            missing = [field for field in required if not evidence.get(field)]
            if missing:
                errors.append(
                    f"{trait.get('id')}: evidence {evidence.get('id')!r} missing {missing}"
                )
            if not isinstance(evidence.get("supports"), list):
                errors.append(f"{trait.get('id')}: evidence supports must be a list")
        supported = {
            term
            for item in rule.get("evidence", [])
            for term in item.get("supports", [])
        }
        for variant in rule.get("variants", []):
            rsid = variant.get("rsid")
            if not RSID_RE.fullmatch(str(rsid)):
                errors.append(f"{trait.get('id')}: invalid production RSID {rsid!r}")
            if rule.get("status") == "curated" and rsid not in supported:
                errors.append(f"{trait.get('id')}/{rsid}: no direct supporting source")
            mapping = variant.get("genotype_map", {})
            if not mapping:
                errors.append(f"{trait.get('id')}/{rsid}: empty genotype mapping")
            if rule.get("status") == "curated" and variant.get("mapping_status") not in {"complete", "literature_complete"}:
                errors.append(
                    f"{trait.get('id')}/{rsid}: mapping_status must be complete"
                )
            if rule.get("status") == "curated":
                if not variant.get("gene"):
                    errors.append(f"{trait.get('id')}/{rsid}: missing gene annotation")
                if not variant.get("literature_alleles") or not variant.get("input_alleles"):
                    errors.append(f"{trait.get('id')}/{rsid}: missing allele orientation")
                if not variant.get("effect_allele"):
                    errors.append(f"{trait.get('id')}/{rsid}: missing effect allele")
                if variant.get("direction") not in {"increase", "decrease", "protective", "risk"}:
                    errors.append(f"{trait.get('id')}/{rsid}: missing effect direction")
            if rule.get("status") == "curated" and not _mapping_is_complete(mapping):
                errors.append(
                    f"{trait.get('id')}/{rsid}: genotype mapping is incomplete; "
                    "expected both homozygotes and the unordered heterozygote"
                )
            registered = loci.get(rsid, {})
            forward_alleles = set(registered.get("traitAlleles", []))
            formula_map = extract_formula_maps(trait.get("formula", "")).get(rsid, {})
            formula_alleles = {base for genotype in formula_map for base in genotype}
            if formula_alleles != forward_alleles:
                errors.append(
                    f"{trait.get('id')}/{rsid}: formula alleles {sorted(formula_alleles)} "
                    f"do not match GRCh38 forward alleles {sorted(str(x) for x in forward_alleles)}"
                )
            for evidence in rule.get("evidence", []):
                if not evidence.get("id") or not evidence.get("url"):
                    errors.append(f"{trait.get('id')}: incomplete evidence citation")
                if not evidence.get("title") or not evidence.get("year"):
                    errors.append(f"{trait.get('id')}: evidence needs title and year")
    return sorted(set(errors))


if __name__ == "__main__":
    issues = validate_production_catalog()
    print(json.dumps({"errors": issues, "valid": not issues}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if issues else 0)
