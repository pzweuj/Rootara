"""Build the read-only variant lookup table once when packaging the image."""
import argparse
import csv
import gzip
import os
from pathlib import Path
import sqlite3
import tempfile
from contextlib import closing


def annotations(source):
    for sequence, row in enumerate(csv.DictReader(source, delimiter="\t")):
        ref, alt = row["Ref"], row["Alt"]
        if len(ref) > len(alt):
            ref, alt = "I", "D"
        elif len(ref) < len(alt):
            ref, alt = "D", "I"
        elif len(ref) != 1:
            continue
        elif alt == "-":
            ref, alt = "I", "D"
        elif ref == "-":
            ref, alt = "D", "I"
        chrom = row["Chrom"].replace("chrM", "MT").removeprefix("chr")
        yield (chrom, row["Start"], sequence, ref, alt, row["RSID"], row["gnomAD_AF"],
               row["Gene"], row["CLNSIG"], row["CLNDN"])


def build(source, destination):
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as tmp:
        path = Path(tmp.name)
    try:
        with closing(sqlite3.connect(path)) as db, db, gzip.open(source, "rt", newline="") as handle:
            db.execute("""CREATE TABLE variants (
                chrom TEXT, start TEXT, seq INTEGER, ref TEXT, alt TEXT, rsid TEXT, af TEXT,
                gene TEXT, clnsig TEXT, clndn TEXT, PRIMARY KEY(chrom,start,seq)
            ) WITHOUT ROWID""")
            db.executemany("INSERT INTO variants VALUES (?,?,?,?,?,?,?,?,?,?)", annotations(handle))
        os.replace(path, destination)
    finally:
        path.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    build(args.source, args.destination)
