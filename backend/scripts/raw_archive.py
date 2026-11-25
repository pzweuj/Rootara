"""Lossless Parquet archives, streamed through the native archive worker."""
import json
from pathlib import Path
import subprocess
from contextlib import contextmanager

from scripts.runtime_config import ARCHIVE_TOOL


def write_archive(source_path: Path, destination: Path, vendor: str):
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([ARCHIVE_TOOL, "pack", source_path, destination, vendor], check=True)


@contextmanager
def _output(arguments):
    with subprocess.Popen([ARCHIVE_TOOL, *arguments], stdout=subprocess.PIPE) as process:
        try:
            yield process.stdout
            if process.wait():
                raise RuntimeError(f"Archive {arguments[0]} failed")
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.terminate()


def archive_variants(path, rsids=None):
    selected = list(rsids) if rsids is not None else []
    if rsids is not None and not selected:
        return
    with _output(["variants", path, "--", *selected]) as output:
        for line in output:
            yield tuple(json.loads(line))


def original_bytes(path):
    if path.suffix == ".parquet":
        with _output(["export", path]) as handle:
            while chunk := handle.read(128 * 1024):
                yield chunk
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
