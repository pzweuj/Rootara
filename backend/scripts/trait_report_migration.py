"""Backfill trait loci discarded by the legacy coordinate-only importer."""

from __future__ import annotations

import csv
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from scripts.rootara_table_info import validate_report_table_name
from scripts.runtime_config import BACKEND_ROOT, RAWDATA_DIR


IMPORTER_VERSION = "3"
REGISTRY_PATH = BACKEND_ROOT / "database" / "trait-locus-registry.json"
TEMPLATE_PATH = BACKEND_ROOT / "database" / "TEMPLATE01.txt"
COMPLEMENT = str.maketrans("ACGT", "TGCA")
SOURCE_PROFILES = {
    # These exports use the reference-assembly forward strand.  Build is
    # determined per row by matching the reviewed GRCh37/GRCh38 placement.
    "23andme": {"strand": "forward"},
    "wegene": {"strand": "forward"},
    "ancestry": {"strand": "forward"},
}


def _normalize_genotype(value: str) -> str | None:
    genotype = value.strip().upper().replace("/", "").replace("|", "")
    if genotype in {"", "--", "00", "NN"}:
        return None
    if len(genotype) == 1 and genotype in "ACGTDI":
        genotype *= 2
    if len(genotype) != 2 or any(base not in "ACGTDI" for base in genotype):
        return None
    return "".join(sorted(genotype))


def _normalize_chromosome(value: str) -> str | None:
    chromosome = value.strip().removeprefix("chr")
    chromosome = {"23": "X", "24": "Y", "25": None, "26": "MT", "M": "MT"}.get(
        chromosome, chromosome
    )
    return chromosome


def _iter_four_column(path: Path) -> Iterator[tuple[str, str, int, str]]:
    with path.open("r", encoding="utf-8-sig", errors="replace") as handle:
        for line in handle:
            if not line.strip() or line.startswith("#"):
                continue
            fields = line.rstrip("\n").replace(",", "\t").split("\t")
            if len(fields) < 4 or not fields[0].lower().startswith("rs"):
                continue
            try:
                chromosome = _normalize_chromosome(fields[1])
                if chromosome:
                    yield fields[0], chromosome, int(fields[2]), fields[3]
            except ValueError:
                continue


def _iter_ancestry(path: Path) -> Iterator[tuple[str, str, int, str]]:
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as handle:
        reader = csv.DictReader(
            (line for line in handle if not line.startswith("#")), delimiter="\t"
        )
        for row in reader:
            try:
                chromosome = _normalize_chromosome(row["chromosome"])
                if chromosome:
                    yield (
                        row["rsid"], chromosome, int(row["position"]),
                        row["allele1"] + row["allele2"],
                    )
            except (KeyError, TypeError, ValueError):
                continue


def iter_raw_variants(path: Path, source: str) -> Iterator[tuple[str, str, int, str]]:
    if source.lower() == "ancestry":
        yield from _iter_ancestry(path)
    else:
        yield from _iter_four_column(path)


def load_locus_registry(path: Path = REGISTRY_PATH) -> tuple[dict, str]:
    raw = path.read_bytes()
    document = json.loads(raw.decode("utf-8"))
    loci = document.get("loci", {})
    expected = int(document.get("counts", {}).get("expected", 0))
    if expected != 153 or len(loci) != expected:
        raise RuntimeError(f"trait locus registry is incomplete: {len(loci)}/{expected or 153}")
    unverified = sorted(rsid for rsid, locus in loci.items() if locus.get("status") != "verified")
    if unverified:
        raise RuntimeError(f"trait locus registry has unverified entries: {unverified[:10]}")
    return loci, hashlib.sha256(raw).hexdigest()


def _raw_path(report_id: str, source: str) -> Path:
    if report_id == "RPT_TEMPLATE01":
        return TEMPLATE_PATH
    suffix = report_id.removeprefix("RPT_")
    matches = sorted(RAWDATA_DIR.glob(f"RDT_{suffix}.*"))
    source_matches = [path for path in matches if f".{source}." in path.name]
    candidates = source_matches or matches
    if len(candidates) != 1:
        raise RuntimeError(f"raw file for {report_id} is missing or ambiguous")
    return candidates[0]


def _forward_genotype(genotype: str, locus: dict, source_strand: str = "auto") -> str:
    normalized = _normalize_genotype(genotype)
    if not normalized:
        raise ValueError("empty or unsupported genotype")
    alleles = set(locus.get("traitAlleles", []))
    if not alleles:
        grch38 = locus["grch38"]
        alleles = {grch38["reference"], *grch38["alternates"]}
    if source_strand == "forward":
        if set(normalized) <= alleles:
            return normalized
        raise ValueError(f"forward genotype {normalized} does not match {sorted(alleles)}")
    if source_strand == "reverse":
        if not set(normalized) <= set("ACGT"):
            raise ValueError("reverse-strand conversion is unavailable for encoded indels")
        complemented = "".join(sorted(normalized.translate(COMPLEMENT)))
        if set(complemented) <= alleles:
            return complemented
        raise ValueError(f"reverse genotype {normalized} does not match {sorted(alleles)}")

    identity_matches = set(normalized) <= alleles
    complemented = (
        "".join(sorted(normalized.translate(COMPLEMENT)))
        if set(normalized) <= set("ACGT") else normalized
    )
    complement_matches = set(complemented) <= alleles
    if identity_matches and not complement_matches:
        return normalized
    if complement_matches and not identity_matches:
        return complemented
    if identity_matches and complement_matches and normalized != complemented:
        raise ValueError(
            f"genotype {normalized} is strand-ambiguous without a source adapter"
        )
    if identity_matches:
        return normalized
    raise ValueError(f"genotype {normalized} does not match forward alleles {sorted(alleles)}")


def _position_matches(chromosome: str, position: int, locus: dict) -> bool:
    for assembly in ("grch37", "grch38"):
        placement = locus.get(assembly) or {}
        if str(placement.get("chromosome")) == chromosome and placement.get("position") == position:
            return True
    return False


def _classification(genotype: str, reference: str) -> str:
    reference_count = genotype.count(reference)
    return "WT" if reference_count == 2 else "HET" if reference_count == 1 else "HOM"


def _ensure_state_table(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS report_trait_import_state (
            report_id TEXT PRIMARY KEY,
            importer_version TEXT NOT NULL,
            registry_hash TEXT NOT NULL,
            added_count INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)


def backfill_report(
    db_path: str | Path,
    report_id: str,
    source: str,
    loci: dict,
    registry_hash: str,
) -> int:
    report_id = validate_report_table_name(report_id)
    raw_path = _raw_path(report_id, source)
    profile = SOURCE_PROFILES.get(source.lower())
    if profile is None:
        raise RuntimeError(f"unsupported raw-data source adapter: {source}")
    wanted = set(loci)
    raw_rows = {}
    for rsid, chromosome, position, raw_genotype in iter_raw_variants(raw_path, source):
        if rsid not in wanted:
            continue
        locus = loci[rsid]
        if not _position_matches(chromosome, position, locus):
            raise RuntimeError(
                f"{report_id}/{rsid}: source position {chromosome}:{position} "
                "matches neither GRCh37 nor GRCh38"
            )
        try:
            genotype = _forward_genotype(raw_genotype, locus, profile["strand"])
        except ValueError as error:
            raise RuntimeError(f"{report_id}/{rsid}: {error}") from error
        if rsid in raw_rows and raw_rows[rsid] != genotype:
            raise RuntimeError(f"{report_id}/{rsid}: conflicting duplicate raw genotypes")
        raw_rows[rsid] = genotype

    conn = sqlite3.connect(db_path)
    try:
        _ensure_state_table(conn)
        previous = conn.execute(
            "SELECT importer_version, registry_hash FROM report_trait_import_state WHERE report_id=?",
            (report_id,),
        ).fetchone()
        if previous == (IMPORTER_VERSION, registry_hash):
            conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{report_id}_rsid ON {report_id}(rsid)")
            conn.commit()
            return 0

        existing = dict(conn.execute(f"SELECT rsid, genotype FROM {report_id} WHERE rsid IS NOT NULL"))
        additions = []
        for rsid, genotype in raw_rows.items():
            if rsid in existing:
                if _normalize_genotype(existing[rsid]) != genotype:
                    raise RuntimeError(
                        f"{report_id}/{rsid}: stored genotype conflicts with preserved raw data"
                    )
                continue
            locus = loci[rsid]
            placement = locus["grch38"]
            alternatives = placement.get("alternates", [])
            if not alternatives:
                raise RuntimeError(f"{rsid}: registry has no alternate allele")
            reference = locus.get("traitReferenceAllele") or placement["reference"]
            if locus.get("alleleEncoding") == "insertion_deletion":
                alternatives = [
                    allele for allele in locus.get("traitAlleles", []) if allele != reference
                ]
            additions.append((
                placement["chromosome"], placement["position"], reference,
                ",".join(alternatives), None, locus.get("gene"), None, None, rsid,
                genotype, _classification(genotype, reference),
            ))

        conn.commit()
        conn.execute("BEGIN IMMEDIATE")
        conn.executemany(
            f"""INSERT INTO {report_id}
                (chromosome, position, ref, alt, gnomAD_AF, gene, clnsig, clndn, rsid, genotype, gt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            additions,
        )
        conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{report_id}_rsid ON {report_id}(rsid)")
        conn.execute(
            """INSERT INTO report_trait_import_state
                (report_id, importer_version, registry_hash, added_count, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(report_id) DO UPDATE SET
                    importer_version=excluded.importer_version,
                    registry_hash=excluded.registry_hash,
                    added_count=excluded.added_count,
                    updated_at=excluded.updated_at""",
            (
                report_id, IMPORTER_VERSION, registry_hash, len(additions),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
        return len(additions)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def backfill_all_reports(db_path: str | Path) -> dict[str, int]:
    loci, registry_hash = load_locus_registry()
    conn = sqlite3.connect(db_path)
    try:
        reports = conn.execute("SELECT report_id, data_source FROM reports ORDER BY report_id").fetchall()
    finally:
        conn.close()
    return {
        report_id: backfill_report(db_path, report_id, source, loci, registry_hash)
        for report_id, source in reports
    }


def report_backfill_is_current(db_path: str | Path, report_id: str, registry_hash: str) -> bool:
    """Return whether a report passed the current importer/registry migration."""

    report_id = validate_report_table_name(report_id)
    conn = sqlite3.connect(db_path)
    try:
        row = conn.execute(
            """SELECT importer_version, registry_hash
               FROM report_trait_import_state WHERE report_id=?""",
            (report_id,),
        ).fetchone()
    except sqlite3.OperationalError:
        return False
    finally:
        conn.close()
    return row == (IMPORTER_VERSION, registry_hash)


def get_report_backfill_status(db_path: str | Path, registry_hash: str) -> dict:
    """Summarize readiness without exposing report names in the health API."""

    conn = sqlite3.connect(db_path)
    try:
        report_ids = [row[0] for row in conn.execute("SELECT report_id FROM reports")]
        try:
            current_ids = {
                row[0]
                for row in conn.execute(
                    """SELECT report_id FROM report_trait_import_state
                       WHERE importer_version=? AND registry_hash=?""",
                    (IMPORTER_VERSION, registry_hash),
                )
            }
        except sqlite3.OperationalError:
            current_ids = set()
    finally:
        conn.close()
    stale = sorted(set(report_ids) - current_ids)
    return {
        "importerVersion": IMPORTER_VERSION,
        "total": len(report_ids),
        "current": len(report_ids) - len(stale),
        "staleCount": len(stale),
        "ready": not stale,
    }
