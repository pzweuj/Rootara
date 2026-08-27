"""Versioned, cached trait catalog and report evaluation service."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from functools import lru_cache
from pathlib import Path
from typing import Any

from scripts.rootara_table_info import get_snp_info_by_rsid, validate_report_table_name
from scripts.rootara_traits import InsufficientGeneticData, parse_formula
from scripts.runtime_config import BACKEND_ROOT


DATABASE_DIR = BACKEND_ROOT / "database"
CATALOG_PATH = DATABASE_DIR / "trait-catalog.json"


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


@lru_cache(maxsize=1)
def load_compiled_catalog() -> dict[str, Any]:
    """Load immutable release data once per backend process."""

    document = _read_json(CATALOG_PATH, {})
    entries = document.get("traits", [])
    traits = [
        {key: value for key, value in entry.items() if key != "evidenceRecord"}
        for entry in entries
    ]
    evidence = {
        entry["id"]: entry.get("evidenceRecord", {}) for entry in entries
    }
    loci = document.get("locusRegistry", {}).get("loci", {})
    version = document.get("catalogVersion") or hashlib.sha256(
        CATALOG_PATH.read_bytes()
    ).hexdigest()[:16]
    by_id = {trait["id"]: trait for trait in traits}
    all_rsids = sorted({rsid for trait in traits for rsid in trait.get("rsids", [])})
    summary = {
        "version": version,
        "traits": traits,
        "byId": by_id,
        "evidence": evidence,
        "loci": loci,
        "allRsids": all_rsids,
    }
    return summary


def _locus_view(
    rsid: str,
    evidence_rule: dict[str, Any],
    loci: dict[str, Any],
    *,
    include_sources: bool = False,
) -> dict[str, Any]:
    evidence_variant = next(
        (item for item in evidence_rule.get("variants", []) if item.get("rsid") == rsid),
        {},
    )
    registered = loci.get(rsid, {})
    grch38 = registered.get("grch38") or {}
    grch37 = registered.get("grch37") or {}
    assemblies = {
        "GRCh38": {
            "chromosome": grch38.get("chromosome"),
            "position": grch38.get("position"),
        },
    }
    if include_sources:
        assemblies["GRCh37"] = {
            "chromosome": grch37.get("chromosome"),
            "position": grch37.get("position"),
        }
    result = {
        "rsid": rsid,
        "gene": registered.get("gene") or evidence_variant.get("gene"),
        "assembly": assemblies,
        "referenceAllele": grch38.get("reference"),
        "alternateAlleles": grch38.get("alternates", []),
        "effectAllele": registered.get("forwardEffectAllele") or evidence_variant.get("effect_allele"),
        "effectDirection": registered.get("effectDirection") or evidence_variant.get("direction"),
    }
    if include_sources:
        result["inputTransform"] = registered.get("inputTransform")
        result["verificationStatus"] = registered.get("status", "registry_missing")
        result["traitAlleles"] = registered.get("traitAlleles", [])
        result["sources"] = registered.get("sources", {})
        result["reviewedAt"] = registered.get("reviewedAt")
    return result


def _summary(trait: dict[str, Any], compiled: dict[str, Any]) -> dict[str, Any]:
    evidence_rule = compiled["evidence"].get(trait["id"], {})
    summary = {
        "id": trait["id"],
        "name": {key: value for key, value in trait["name"].items() if value},
        "description": {key: value for key, value in trait["description"].items() if value},
        "icon": trait.get("icon") if trait.get("icon", "Dna") != "Dna" else None,
        "confidence": trait.get("confidence") if trait.get("confidence", "low") != "low" else None,
        "isDefault": False if trait.get("isDefault") is False else None,
        "category": trait.get("category", "internal"),
        "evidenceGrade": evidence_rule.get("evidence_grade") or trait.get("evidenceGrade"),
        "sourceLabel": trait.get("sourceLabel"),
        "loci": [
            _locus_view(rsid, evidence_rule, compiled["loci"])
            for rsid in trait.get("rsids", [])
        ],
    }
    return {key: value for key, value in summary.items() if value is not None}


def _load_custom_traits(db_path: str | Path) -> list[dict[str, Any]]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        exists = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='traits'"
        ).fetchone()
        if not exists:
            return []
        rows = conn.execute("SELECT * FROM traits WHERE isDefault = 0 ORDER BY id").fetchall()
    finally:
        conn.close()
    custom = []
    for row in rows:
        try:
            custom.append({
                "id": row["id"],
                "name": json.loads(row["name"]),
                "description": json.loads(row["description"]),
                "icon": row["icon"],
                "confidence": row["confidence"],
                "isDefault": False,
                "createdAt": row["createdAt"],
                "category": row["category"],
                "rsids": row["rsids"].split(";") if row["rsids"] else [],
                "formula": row["formula"],
                "scoreThresholds": json.loads(row["scoreThresholds"]),
                "result": json.loads(row["result"]),
                "reference": row["reference"].split(";") if row["reference"] else [],
                "sourceLabel": "Custom",
            })
        except (json.JSONDecodeError, TypeError):
            continue
    return custom


def _custom_revision(db_path: str | Path) -> int:
    conn = sqlite3.connect(db_path)
    try:
        row = conn.execute(
            "SELECT revision FROM trait_catalog_revision WHERE singleton = 1"
        ).fetchone()
    except sqlite3.OperationalError:
        return 0
    finally:
        conn.close()
    return int(row[0]) if row else 0


@lru_cache(maxsize=16)
def _catalog_for_revision(db_path: str, revision: int) -> dict[str, Any]:
    del revision  # Revision is deliberately part of the cache key.
    compiled = load_compiled_catalog()
    custom = _load_custom_traits(db_path)
    traits = [*compiled["traits"], *custom]
    custom_hash = hashlib.sha256(
        json.dumps(custom, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:16]
    version = hashlib.sha256(
        f'{compiled["version"]}:{custom_hash}'.encode("utf-8")
    ).hexdigest()[:16]
    return {
        **compiled,
        "version": version,
        "traits": traits,
        "byId": {trait["id"]: trait for trait in traits},
        "allRsids": sorted({rsid for trait in traits for rsid in trait.get("rsids", [])}),
    }


def _catalog_for_db(db_path: str | Path) -> dict[str, Any]:
    normalized_path = str(Path(db_path).resolve())
    return _catalog_for_revision(normalized_path, _custom_revision(normalized_path))


@lru_cache(maxsize=16)
def _catalog_payload_cached(db_path: str, revision: int) -> dict[str, Any]:
    compiled = _catalog_for_revision(db_path, revision)
    return {
        "version": compiled["version"],
        "count": len(compiled["traits"]),
        "traits": [_summary(trait, compiled) for trait in compiled["traits"]],
    }


def get_catalog_payload(db_path: str | Path) -> dict[str, Any]:
    normalized_path = str(Path(db_path).resolve())
    return _catalog_payload_cached(normalized_path, _custom_revision(normalized_path))


def _evaluate_trait(
    trait: dict[str, Any],
    genotypes: dict[str, str | None],
    loci: dict[str, Any] | None = None,
) -> dict[str, Any]:
    required = list(trait.get("rsids", []))
    present = {rsid: genotypes.get(rsid) for rsid in required if genotypes.get(rsid)}
    missing = [rsid for rsid in required if not genotypes.get(rsid)]
    base = {
        "traitId": trait["id"],
        "genotypes": {rsid: genotype for rsid, genotype in present.items()},
    }
    if missing:
        return {
            **base,
            "status": "insufficient_data",
            "missingRsids": missing,
            "detectedCount": len(present),
            "requiredCount": len(required),
        }
    for rsid, genotype in present.items():
        registered = (loci or {}).get(rsid, {})
        allowed = set(registered.get("traitAlleles", []))
        if allowed and (len(str(genotype)) != 2 or not set(str(genotype).upper()) <= allowed):
            return {
                **base,
                "status": "invalid_orientation",
            }
    try:
        value = parse_formula(trait["formula"], present)
    except InsufficientGeneticData:
        return {**base, "status": "insufficient_data"}
    except (TypeError, ValueError):
        return {**base, "status": "invalid_rule"}

    result_key = None
    thresholds = list(trait.get("scoreThresholds", {}).items())
    thresholds.sort(
        key=lambda item: float(item[1])
        if isinstance(item[1], (int, float)) and not isinstance(item[1], bool)
        else 0.0,
        reverse=True,
    )
    for key, threshold in thresholds:
        if isinstance(value, bool) and value == threshold:
            result_key = key
            break
        if not isinstance(value, bool) and isinstance(threshold, (int, float)) and value >= threshold:
            result_key = key
            break
    result_current = trait.get("result", {}).get(result_key) if result_key else None
    if isinstance(result_current, dict):
        result_current = {
            key: value
            for key, value in result_current.items()
            if value and (key != "default" or value not in {
                result_current.get("en"), result_current.get("zh-CN")
            })
        }
    return {
        **base,
        "status": "ok" if result_key is not None else "invalid_rule",
        "resultKey": result_key,
        "resultCurrent": result_current,
    }


def _report_revision(db_path: str, report_id: str) -> tuple[Any, ...]:
    report_id = validate_report_table_name(report_id)
    conn = sqlite3.connect(db_path)
    try:
        report = conn.execute(
            "SELECT total_snps, upload_date FROM reports WHERE report_id=?", (report_id,)
        ).fetchone()
        try:
            migration = conn.execute(
                """SELECT importer_version, registry_hash, added_count, updated_at
                   FROM report_trait_import_state WHERE report_id=?""",
                (report_id,),
            ).fetchone()
        except sqlite3.OperationalError:
            migration = None
    finally:
        conn.close()
    return (*report, *migration) if report and migration else tuple(report or ())


@lru_cache(maxsize=64)
def _report_results_cached(
    report_id: str,
    db_path: str,
    catalog_version: str,
    report_revision: tuple[Any, ...],
) -> dict[str, Any]:
    del catalog_version, report_revision
    compiled = _catalog_for_db(db_path)
    rows = get_snp_info_by_rsid(compiled["allRsids"], report_id, db_path, concise=True)
    genotypes = {rsid: row[1] for rsid, row in rows.items()}
    evaluations = [
        _evaluate_trait(trait, genotypes, compiled["loci"])
        for trait in compiled["traits"]
    ]
    return {
        "catalogVersion": compiled["version"],
        "reportId": report_id,
        "count": len(evaluations),
        "results": evaluations,
    }


def get_report_results(report_id: str, db_path: str | Path) -> dict[str, Any]:
    report_id = validate_report_table_name(report_id)
    normalized_path = str(Path(db_path).resolve())
    compiled = _catalog_for_db(normalized_path)
    return _report_results_cached(
        report_id,
        normalized_path,
        compiled["version"],
        _report_revision(normalized_path, report_id),
    )


def get_trait_detail(trait_id: str, report_id: str, db_path: str | Path) -> dict[str, Any] | None:
    compiled = _catalog_for_db(db_path)
    trait = compiled["byId"].get(trait_id)
    if trait is None:
        return None
    rows = get_snp_info_by_rsid(trait.get("rsids", []), report_id, db_path, concise=True)
    evaluation = _evaluate_trait(
        trait,
        {rsid: row[1] for rsid, row in rows.items()},
        compiled["loci"],
    )
    evidence_rule = compiled["evidence"].get(trait_id, {})
    return {
        **_summary(trait, compiled),
        "loci": [
            _locus_view(rsid, evidence_rule, compiled["loci"], include_sources=True)
            for rsid in trait.get("rsids", [])
        ],
        "catalogVersion": compiled["version"],
        "createdAt": trait.get("createdAt"),
        "formula": trait.get("formula"),
        "scoreThresholds": trait.get("scoreThresholds", {}),
        "result": trait.get("result", {}),
        "populationScope": evidence_rule.get("population_scope_i18n") or {
            "en": evidence_rule.get("population_scope", ""), "zh-CN": "", "default": "",
        },
        "limitations": evidence_rule.get("limitations_i18n") or {
            "en": evidence_rule.get("limitations", []), "zh-CN": [], "default": [],
        },
        "evidenceSummary": evidence_rule.get("evidence_summary_i18n"),
        "evidence": evidence_rule.get("evidence", []),
        "medicalDisclaimer": evidence_rule.get("medical_disclaimer"),
        "evaluation": evaluation,
    }


def get_legacy_traits_payload(report_id: str, db_path: str | Path) -> list[dict[str, Any]]:
    """One-release adapter for the former ``POST /traits/info`` response."""

    compiled = _catalog_for_db(db_path)
    results = get_report_results(report_id, db_path)
    by_id = {item["traitId"]: item for item in results["results"]}
    payload: list[dict[str, Any]] = []
    for source in compiled["traits"]:
        trait = dict(source)
        evaluation = by_id[source["id"]]
        evidence = compiled["evidence"].get(source["id"], {})
        trait["referenceGenotypes"] = [
            ((compiled["loci"].get(rsid, {}).get("grch38") or {}).get("reference") or "") * 2
            or None
            for rsid in source.get("rsids", [])
        ]
        trait["yourGenotypes"] = [
            evaluation["genotypes"].get(rsid) for rsid in source.get("rsids", [])
        ]
        trait["result_current"] = evaluation.get("resultCurrent")
        trait["evaluationStatus"] = evaluation["status"]
        if evidence:
            trait["evidenceStatus"] = evidence.get("status")
            trait["evidenceGrade"] = evidence.get("evidence_grade")
            trait["evidence"] = evidence.get("evidence", [])
            trait["populationScope"] = evidence.get("population_scope")
            trait["limitations"] = evidence.get("limitations", [])
            trait["reviewBlockers"] = evidence.get("review_blockers", [])
            trait["medicalDisclaimer"] = evidence.get("medical_disclaimer")
        payload.append(trait)
    return payload


def ensure_report_rsid_indexes(db_path: str | Path) -> None:
    """Add missing RSID indexes to legacy per-report tables."""

    conn = sqlite3.connect(db_path)
    try:
        tables = [
            row[0]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'RPT_%'")
        ]
        for table in tables:
            if not table.replace("_", "").isalnum():
                raise ValueError(f"unsafe report table name: {table}")
            conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_rsid ON {table}(rsid)")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
