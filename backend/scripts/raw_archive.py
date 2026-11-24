"""Lossless upload archives with projected, typed columns for trait lookup."""
import csv
import os
import tempfile
from pathlib import Path

import pyarrow as pa
import pyarrow.dataset as ds
import pyarrow.parquet as pq


SCHEMA = pa.schema([
    ("original_line", pa.binary()), ("rsid", pa.string()), ("chromosome", pa.string()),
    ("position", pa.int64()), ("genotype", pa.string()),
])
VARIANT_COLUMNS = SCHEMA.names[1:]


def write_archive(source_path: Path, destination: Path, vendor: str):
    from scripts.trait_report_migration import _normalize_chromosome
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as tmp:
        temporary = Path(tmp.name)
    try:
        with pq.ParquetWriter(temporary, SCHEMA, compression="zstd",
                              use_dictionary=["chromosome", "genotype"]) as writer, source_path.open("rb") as raw:
            batch = [[] for _ in SCHEMA]
            header = None
            for line in raw:
                text = line.decode("utf-8-sig", errors="replace").rstrip("\r\n")
                values = (None,) * 4
                if text and not text.startswith("#"):
                    if vendor == "ancestry":
                        fields = next(csv.reader([text], delimiter="\t"))
                        if header is None:
                            header = [fields.index(name) for name in ("rsid", "chromosome", "position", "allele1", "allele2")]
                        else:
                            try:
                                rsid, chrom, position, a, b = (fields[i] for i in header)
                                values = rsid, _normalize_chromosome(chrom), int(position), a + b
                            except (IndexError, ValueError):
                                pass
                    else:
                        fields = text.replace(",", "\t").split("\t")
                        if len(fields) >= 4 and fields[0].lower().startswith("rs"):
                            try:
                                values = fields[0], _normalize_chromosome(fields[1]), int(fields[2]), fields[3]
                            except ValueError:
                                pass
                for column, item in zip(batch, (line, *values)):
                    column.append(item)
                if len(batch[0]) >= 32768:
                    writer.write_table(pa.table(batch, schema=SCHEMA))
                    batch = [[] for _ in SCHEMA]
            if batch[0]:
                writer.write_table(pa.table(batch, schema=SCHEMA))
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def archive_variants(path, rsids=None):
    predicate = ds.field("chromosome").is_valid()
    if rsids is not None:
        predicate = predicate & ds.field("rsid").isin(list(rsids))
    for batch in ds.dataset(path, format="parquet").to_batches(columns=VARIANT_COLUMNS, filter=predicate):
        yield from zip(*(column.to_pylist() for column in batch.columns))


def original_bytes(path):
    if path.suffix == ".parquet":
        with pq.ParquetFile(path) as archive:
            for batch in archive.iter_batches(batch_size=8192, columns=["original_line"]):
                yield b"".join(batch.column(0).to_pylist())
    else:
        with path.open("rb") as handle:
            while chunk := handle.read(128 * 1024):
                yield chunk


def migrate_text_archives(directory: Path, remove_text=False):
    """Convert saved vendor files, verifying byte identity before optional removal."""
    import hashlib
    import re

    for source in sorted(directory.glob("RDT_*.txt")):
        match = re.fullmatch(r"RDT_[A-Z0-9]{10}\.(23andme|ancestry|wegene)\.txt", source.name)
        if not match:
            continue
        archive = source.with_suffix(".parquet")
        with source.open("rb") as handle:
            digest = hashlib.file_digest(handle, "sha256").digest()
        if not archive.exists():
            write_archive(source, archive, match[1])
        check = hashlib.sha256()
        for chunk in original_bytes(archive):
            check.update(chunk)
        if check.digest() != digest:
            raise ValueError(f"Archive differs from {source.name}")
        if remove_text:
            source.unlink()
        yield archive.name


if __name__ == "__main__":
    import argparse
    from scripts.runtime_config import RAWDATA_DIR

    parser = argparse.ArgumentParser(description="Convert legacy uploads while the service is stopped")
    parser.add_argument("--remove-text", action="store_true",
                        help="remove each original TXT after its archive passes SHA-256 verification")
    for filename in migrate_text_archives(RAWDATA_DIR, parser.parse_args().remove_text):
        print(filename)
