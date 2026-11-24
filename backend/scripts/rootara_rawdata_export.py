from scripts.raw_archive import original_bytes
from scripts.runtime_config import RAWDATA_DIR
from scripts.rootara_table_info import validate_report_table_name


def export_rawdata(report_id):
    validate_report_table_name(report_id)
    if report_id == "RPT_TEMPLATE01":
        return None, None
    prefix = "RDT_" + report_id[4:]
    for extension in ("parquet", "txt"):
        for path in sorted(RAWDATA_DIR.glob(f"{prefix}.*.{extension}")):
            return path.with_suffix(".txt").name, original_bytes(path)
    return None, None
