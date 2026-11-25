import asyncio
from contextlib import suppress
from pathlib import Path
import sys

from scripts.runtime_config import ARCHIVE_TOOL, RAWDATA_DIR
from scripts.rootara_table_info import validate_report_table_name


_download_slot = asyncio.Semaphore(1)


async def parquet_bytes(path):
    async with _download_slot:
        process = await asyncio.create_subprocess_exec(
            ARCHIVE_TOOL, "export", path,
            stdout=asyncio.subprocess.PIPE,
        )
        try:
            while chunk := await process.stdout.read(128 * 1024):
                yield chunk
            if await process.wait():
                raise RuntimeError("Parquet export failed")
        finally:
            if process.returncode is None:
                with suppress(ProcessLookupError):
                    process.kill()
                # Drain the pipe before waiting if the client disconnected.
                await process.communicate()


def text_bytes(path):
    with path.open("rb") as handle:
        while chunk := handle.read(128 * 1024):
            yield chunk


def export_rawdata(report_id):
    validate_report_table_name(report_id)
    if report_id == "RPT_TEMPLATE01":
        return None, None
    prefix = "RDT_" + report_id[4:]
    for extension in ("parquet", "txt"):
        for path in sorted(RAWDATA_DIR.glob(f"{prefix}.*.{extension}")):
            chunks = parquet_bytes(path) if extension == "parquet" else text_bytes(path)
            return path.with_suffix(".txt").name, chunks
    return None, None


if __name__ == "__main__":
    from scripts.raw_archive import original_bytes

    for block in original_bytes(Path(sys.argv[1])):
        sys.stdout.buffer.write(block)
