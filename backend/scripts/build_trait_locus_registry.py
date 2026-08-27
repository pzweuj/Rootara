"""Build the reviewed locus registry used by the trait importer and evaluator.

The registry deliberately separates literature allele notation from the
GRCh38 forward-strand representation used at runtime.  NCBI RefSNP is the
primary source; Ensembl GRCh38/GRCh37 mappings are used as an independent
cross-check.  The generated file is committed so container startup never
depends on network access.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_PATH = ROOT / "backend" / "database" / "trait-evidence.json"
DEFAULT_OUTPUT = ROOT / "backend" / "database" / "trait-locus-registry.json"
OVERRIDE_PATH = ROOT / "backend" / "database" / "trait-locus-orientation-overrides.json"

COMPLEMENT = str.maketrans("ACGT", "TGCA")
IUPAC_ALLELES = {
    "R": ["A", "G"], "Y": ["C", "T"], "S": ["C", "G"],
    "W": ["A", "T"], "K": ["G", "T"], "M": ["A", "C"],
}
NCBI_URL = "https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/{numeric_id}"
CACHE_DIR = Path("/tmp/rootara-trait-locus-cache")
ENSEMBL_URLS = {
    "GRCh38": "https://rest.ensembl.org/variation/human/{rsid}?content-type=application/json",
    "GRCh37": "https://grch37.rest.ensembl.org/variation/human/{rsid}?content-type=application/json",
}
ENSEMBL_BATCH_URLS = {
    "GRCh38": "https://rest.ensembl.org/variation/homo_sapiens",
    "GRCh37": "https://grch37.rest.ensembl.org/variation/homo_sapiens",
}
NCBI_CHROMOSOMES = {
    "NC_000023.11": "X",
    "NC_000024.10": "Y",
    "NC_012920.1": "MT",
    # GRCh38 accessions differ for chromosomes 1-22.
    "NC_000001.11": "1", "NC_000002.12": "2", "NC_000003.12": "3",
    "NC_000004.12": "4", "NC_000005.10": "5", "NC_000006.12": "6",
    "NC_000007.14": "7", "NC_000008.11": "8", "NC_000009.12": "9",
    "NC_000010.11": "10", "NC_000011.10": "11", "NC_000012.12": "12",
    "NC_000013.11": "13", "NC_000014.9": "14", "NC_000015.10": "15",
    "NC_000016.10": "16", "NC_000017.11": "17", "NC_000018.10": "18",
    "NC_000019.10": "19", "NC_000020.11": "20", "NC_000021.9": "21",
    "NC_000022.11": "22",
    # GRCh37 primary chromosome accessions.
    "NC_000001.10": "1", "NC_000002.11": "2", "NC_000003.11": "3",
    "NC_000004.11": "4", "NC_000005.9": "5", "NC_000006.11": "6",
    "NC_000007.13": "7", "NC_000008.10": "8", "NC_000009.11": "9",
    "NC_000010.10": "10", "NC_000011.9": "11", "NC_000012.11": "12",
    "NC_000013.10": "13", "NC_000014.8": "14", "NC_000015.9": "15",
    "NC_000016.9": "16", "NC_000017.10": "17", "NC_000018.9": "18",
    "NC_000019.9": "19", "NC_000020.10": "20", "NC_000021.8": "21",
    "NC_000022.10": "22", "NC_000023.10": "X", "NC_000024.9": "Y",
}


def _fetch_json(
    url: str,
    retries: int = 4,
    *,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    encoded_payload = (
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        if payload is not None else None
    )
    cache_key = (
        url.encode("utf-8")
        if encoded_payload is None
        else url.encode("utf-8") + b"\0" + encoded_payload
    )
    cached = CACHE_DIR / (hashlib.sha256(cache_key).hexdigest() + ".json")
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))
    request = urllib.request.Request(
        url,
        data=encoded_payload,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Rootara/1.0 trait-locus-audit",
        },
        method="POST" if encoded_payload is not None else "GET",
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
                cached.write_text(json.dumps(payload), encoding="utf-8")
                return payload
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if attempt == retries - 1:
                raise
            # NCBI and Ensembl both throttle short request bursts.  Keep the
            # command resumable through the on-disk response cache and use a
            # bounded backoff instead of turning a transient 429/5xx into an
            # incomplete release registry.
            time.sleep(1.5 * (attempt + 1))
    raise AssertionError("unreachable")


def _read_overrides(path: Path = OVERRIDE_PATH) -> dict[str, dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("overrides", {})
    except FileNotFoundError:
        return {}


def _read_assembly_overrides(path: Path = OVERRIDE_PATH) -> dict[str, dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("assemblyOverrides", {})
    except FileNotFoundError:
        return {}


def _ncbi_placement(record: dict[str, Any], assembly: str) -> dict[str, Any] | None:
    placements = record.get("primary_snapshot_data", {}).get("placements_with_allele", [])
    for placement in placements:
        annotation = placement.get("placement_annot", {})
        assembly_traits = annotation.get("seq_id_traits_by_assembly", [])
        is_requested_top = any(
            str(item.get("assembly_name", "")).startswith(assembly)
            and item.get("is_top_level") is True
            and item.get("is_chromosome") is True
            and item.get("is_patch") is False
            for item in assembly_traits
        )
        if not is_requested_top:
            continue
        alleles = placement.get("alleles", [])
        if not alleles:
            continue
        spdis = [item.get("allele", {}).get("spdi", {}) for item in alleles]
        reference = spdis[0].get("deleted_sequence")
        alternatives = sorted(
            {
                item.get("inserted_sequence")
                for item in spdis[1:]
                if item.get("inserted_sequence") and item.get("inserted_sequence") != reference
            }
        )
        first = spdis[0]
        seq_id = placement.get("seq_id") or first.get("seq_id")
        return {
            "chromosome": NCBI_CHROMOSOMES.get(seq_id),
            "position": int(first["position"]) + 1,
            "reference": reference,
            "alternates": alternatives,
            "accession": seq_id,
            "oppositeOrientation": bool(annotation.get("is_aln_opposite_orientation")),
        }
    return None


def _ncbi_grch38(record: dict[str, Any]) -> dict[str, Any] | None:
    return _ncbi_placement(record, "GRCh38")


def _ensembl_mapping(record: dict[str, Any], assembly: str) -> dict[str, Any] | None:
    candidates = [
        mapping
        for mapping in record.get("mappings", [])
        if mapping.get("assembly_name") == assembly
        and mapping.get("coord_system") == "chromosome"
        and str(mapping.get("seq_region_name")) in {*(str(i) for i in range(1, 23)), "X", "Y", "MT"}
    ]
    if not candidates:
        return None
    mapping = sorted(candidates, key=lambda item: (item.get("seq_region_name"), item.get("start")))[0]
    alleles = str(mapping.get("allele_string", "")).split("/")
    primary_alleles = IUPAC_ALLELES.get(str(record.get("ambiguity", "")).upper(), [])
    return {
        "chromosome": str(mapping.get("seq_region_name")),
        "position": int(mapping.get("start")),
        "reference": alleles[0] if alleles else None,
        "alternates": sorted(set(alleles[1:])),
        "strand": int(mapping.get("strand", 1)),
        "primaryAlleles": primary_alleles,
    }


def _allele_pair(value: str | None) -> set[str]:
    if not value:
        return set()
    return {item for item in re.split(r"[>/|,]", value.upper()) if item in {"A", "C", "G", "T"}}


def _ncbi_common_alleles(record: dict[str, Any], allowed: set[str]) -> list[str]:
    """Rank the observed forward-strand alleles across NCBI frequency sets."""

    counts: dict[str, int] = {}
    annotations = record.get("primary_snapshot_data", {}).get("allele_annotations", [])
    for annotation in annotations:
        for frequency in annotation.get("frequency", []):
            allele = frequency.get("observation", {}).get("inserted_sequence")
            if allele not in allowed or allele not in {"A", "C", "G", "T"}:
                continue
            counts[allele] = counts.get(allele, 0) + int(frequency.get("allele_count") or 0)
    return [allele for allele, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])) if count > 0]


def _orientation(
    input_alleles: str | None,
    effect_allele: str | None,
    forward: set[str],
) -> str:
    reported = _allele_pair(input_alleles)
    effect = str(effect_allele or "").upper()
    effect_complement = effect.translate(COMPLEMENT)
    effect_is_forward = effect in forward
    complement_is_forward = effect_complement in forward

    # The literature effect allele is the strongest strand clue.  Comparing
    # complete dbSNP allele sets is incorrect because RefSNP includes rare and
    # historical alleles that are absent from the biallelic study record.
    if effect_is_forward and not complement_is_forward:
        return "identity"
    if complement_is_forward and not effect_is_forward:
        return "complement"

    identity_matches = bool(reported) and reported <= forward
    complemented = {allele.translate(COMPLEMENT) for allele in reported}
    complement_matches = bool(reported) and complemented <= forward
    if identity_matches and not complement_matches:
        return "identity"
    if complement_matches and not identity_matches:
        return "complement"
    if identity_matches and complement_matches:
        return "ambiguous"
    return "conflict"


def _fetch_one(
    rsid: str,
    variant: dict[str, Any],
    ensembl_records: dict[str, dict[str, Any]] | None = None,
    overrides: dict[str, dict[str, Any]] | None = None,
    assembly_overrides: dict[str, dict[str, Any]] | None = None,
) -> tuple[str, dict[str, Any]]:
    numeric = re.fullmatch(r"rs(\d+)", rsid)
    if not numeric:
        raise ValueError(f"invalid RSID: {rsid}")
    ncbi = _fetch_json(NCBI_URL.format(numeric_id=numeric.group(1)))
    ensembl: dict[str, Any] = {}
    for assembly, url in ENSEMBL_URLS.items():
        record = (ensembl_records or {}).get(assembly, {}).get(rsid)
        if record is None:
            record = _fetch_json(url.format(rsid=rsid))
        ensembl[assembly] = _ensembl_mapping(record, assembly)

    grch38 = _ncbi_grch38(ncbi)
    ncbi37 = _ncbi_placement(ncbi, "GRCh37")
    ensembl38 = ensembl.get("GRCh38")
    if not grch38 or not ensembl38:
        raise ValueError(f"{rsid}: missing primary GRCh38 chromosome placement")
    ncbi_forward = {grch38["reference"], *grch38["alternates"]}
    ensembl_forward = {ensembl38["reference"], *ensembl38["alternates"]}
    primary_alleles = list(ensembl38.get("primaryAlleles") or [])
    selection_method = "ensembl_iupac"
    if len(primary_alleles) != 2:
        common_alleles = _ncbi_common_alleles(ncbi, ensembl_forward)
        if len(common_alleles) >= 2:
            primary_alleles = common_alleles[:2]
            selection_method = "ncbi_frequency"
        elif len(ensembl_forward) == 2:
            primary_alleles = sorted(ensembl_forward)
            selection_method = "biallelic_record"
        else:
            primary_alleles = sorted(ensembl_forward)
            selection_method = "unresolved_multiallelic"
    study_forward = set(primary_alleles)
    source_agreement = (
        grch38.get("chromosome") == ensembl38.get("chromosome")
        and grch38.get("position") == ensembl38.get("position")
        and grch38.get("reference") == ensembl38.get("reference")
        and ensembl_forward <= ncbi_forward
    )
    override = (overrides or {}).get(rsid)
    assembly_override = (assembly_overrides or {}).get(rsid, {})
    orientation = (
        override["inputTransform"]
        if override else variant.get("strand_transform") or _orientation(
            variant.get("literature_alleles") or variant.get("input_alleles"),
            variant.get("literature_effect_allele") or variant.get("effect_allele"),
            study_forward,
        )
    )
    effect = str(variant.get("effect_allele", "")).upper()
    literature_effect = str(
        (override or {}).get("literatureEffectAllele")
        or variant.get("literature_effect_allele")
        or effect
    ).upper()
    forward_effect = (
        override["forwardEffectAllele"]
        if override else variant.get("forward_effect_allele")
        or (literature_effect.translate(COMPLEMENT) if orientation == "complement" else literature_effect)
    )
    transformed_reported = {
        allele.translate(COMPLEMENT) if orientation == "complement" else allele
        for allele in _allele_pair(
            (override or {}).get("literatureAlleles")
            or variant.get("literature_alleles")
            or variant.get("input_alleles")
        )
    }
    candidate_other = sorted((transformed_reported & study_forward) - {forward_effect})
    if not candidate_other and len(study_forward - {forward_effect}) == 1:
        candidate_other = sorted(study_forward - {forward_effect})
    trait_alleles = (
        sorted(override["traitAlleles"])
        if override else sorted({forward_effect, *candidate_other[:1]})
    )
    uses_study_encoding = (override or {}).get("alleleEncoding") == "insertion_deletion"
    allele_pair_is_valid = (
        len(trait_alleles) == 2
        and forward_effect in trait_alleles
        and (uses_study_encoding or set(trait_alleles) <= ensembl_forward)
    )
    status = "verified" if (
        source_agreement
        and orientation in {"identity", "complement"}
        and allele_pair_is_valid
    ) else "conflict"

    return rsid, {
        "rsid": rsid,
        "gene": variant.get("gene"),
        "status": status,
        "reviewedAt": date.today().isoformat(),
        "grch38": grch38,
        "grch37": ensembl.get("GRCh37") or ncbi37 or assembly_override.get("grch37"),
        "ensemblGRCh38": ensembl38,
        "traitAlleles": trait_alleles,
        "traitAlleleSelection": "manual_literature_review" if override else selection_method,
        "alleleEncoding": (override or {}).get("alleleEncoding", "nucleotide"),
        "traitReferenceAllele": (override or {}).get("traitReferenceAllele"),
        "literatureAlleles": (override or {}).get("literatureAlleles") or variant.get("literature_alleles"),
        "literatureEffectAllele": literature_effect,
        "previousInputAlleles": variant.get("input_alleles"),
        "previousEffectAllele": effect,
        "forwardEffectAllele": forward_effect,
        "effectDirection": variant.get("direction"),
        "inputTransform": orientation,
        "sourceAgreement": source_agreement,
        "sources": {
            "ncbi": {
                "url": NCBI_URL.format(numeric_id=numeric.group(1)),
                "lastUpdate": ncbi.get("last_update_date"),
                "buildId": ncbi.get("last_update_build_id"),
            },
            "ensemblGRCh38": ENSEMBL_URLS["GRCh38"].format(rsid=rsid),
            "ensemblGRCh37": ENSEMBL_URLS["GRCh37"].format(rsid=rsid),
            "orientationResolution": {
                "url": override.get("source"),
                "rationale": override.get("rationale"),
            } if override else None,
            "assemblyResolution": {
                "url": assembly_override.get("source"),
                "rationale": assembly_override.get("rationale"),
            } if assembly_override else None,
        },
    }


def build_registry(evidence_path: Path = EVIDENCE_PATH, workers: int = 8) -> dict[str, Any]:
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))["rules"]
    variants: dict[str, dict[str, Any]] = {}
    for rule in evidence.values():
        for variant in rule.get("variants", []):
            variants.setdefault(variant["rsid"], variant)
    overrides = _read_overrides()
    assembly_overrides = _read_assembly_overrides()
    unknown_overrides = sorted(set(overrides) - set(variants))
    if unknown_overrides:
        raise ValueError(f"orientation overrides reference unknown loci: {unknown_overrides}")
    ensembl_records: dict[str, dict[str, Any]] = {}
    for assembly, url in ENSEMBL_BATCH_URLS.items():
        response: dict[str, Any] = {}
        try:
            response = _fetch_json(
                url, retries=1, payload={"ids": sorted(variants)}
            )
        except Exception:
            # The GRCh37 endpoint is less reliable for a 150-ID body. Smaller
            # deterministic chunks retain the latency benefit and are cached
            # independently for future audit runs.
            rsids = sorted(variants)
            for offset in range(0, len(rsids), 25):
                chunk = rsids[offset:offset + 25]
                try:
                    response.update(
                        _fetch_json(url, retries=2, payload={"ids": chunk})
                    )
                except Exception:
                    continue
        ensembl_records[assembly] = {
            rsid: record for rsid, record in response.items() if isinstance(record, dict)
        }
    loci: dict[str, Any] = {}
    errors: dict[str, str] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                _fetch_one, rsid, variant, ensembl_records, overrides, assembly_overrides
            ): rsid
            for rsid, variant in sorted(variants.items())
        }
        for future in concurrent.futures.as_completed(futures):
            rsid = futures[future]
            try:
                key, value = future.result()
                loci[key] = value
            except Exception as error:  # recorded so the generated audit is complete
                errors[rsid] = str(error)
    return {
        "schemaVersion": 1,
        "description": "Reviewed Rootara trait locus registry; runtime use requires status=verified.",
        "reviewedAt": date.today().isoformat(),
        "primarySource": "NCBI RefSNP",
        "crossCheckSource": "Ensembl GRCh38/GRCh37 variation APIs",
        "counts": {
            "expected": len(variants),
            "resolved": len(loci),
            "verified": sum(item.get("status") == "verified" for item in loci.values()),
            "conflicts": sum(item.get("status") != "verified" for item in loci.values()),
            "fetchErrors": len(errors),
        },
        "loci": dict(sorted(loci.items())),
        "fetchErrors": dict(sorted(errors.items())),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    registry = build_registry(workers=args.workers)
    output = args.output
    if registry["fetchErrors"]:
        output = args.output.with_suffix(".partial.json")
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output)
    print(json.dumps(registry["counts"], ensure_ascii=False))
    return 1 if registry["fetchErrors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
