import sqlite3

import pytest

from scripts.raw_archive import archive_variants, migrate_text_archives, original_bytes, write_archive
from scripts.rootara_table_info import get_all_snp_info, get_clinvar_data
from scripts.trait_report_migration import iter_raw_variants


@pytest.mark.parametrize("source,raw", [
    ("23andme", b"\xef\xbb\xbf# 23andMe\r\nrs91\t1\t55\tAG\r\nrs92\tX\t42\tA"),
    ("ancestry", b"# comment\nrsid\tchromosome\tposition\tallele1\tallele2\nrs91\t23\t55\tA\tG\n"),
    ("wegene", b"# header\r\nrs91,1,55,AG\r\n"),
])
def test_lossless_archive_and_projection(tmp_path, source, raw):
    upload = tmp_path / "source.txt"
    upload.write_bytes(raw)
    archive = tmp_path / "raw.parquet"
    write_archive(upload, archive, source)
    assert b"".join(original_bytes(archive)) == raw
    assert list(archive_variants(archive, ["rs91"])) == [
        r for r in iter_raw_variants(upload, source) if r[0] == "rs91"
    ]


def test_clinvar_summary_and_search_preserve_rows(tmp_path):
    path = tmp_path / "sample.db"
    table = "RPT_TEMPLATE01"
    with sqlite3.connect(path) as conn:
        conn.execute(f"CREATE TABLE {table}(rsid TEXT,clnsig TEXT,clndn TEXT,gt TEXT,ref TEXT,alt TEXT,gene TEXT)")
        conn.executemany(f"INSERT INTO {table} VALUES (?,?,?,?,?,?,?)",
                         [("rs91","Likely_pathogenic/Likely_risk_allele","Two_words","HET","A","G","G1")] * 7)
    summary = get_clinvar_data(table, path, summary=True)
    assert summary["total"] == 7 and len(summary["data"]) == 4
    assert summary["statistics"]["likely_pathogenic"] == 7
    page = get_clinvar_data(table, path, page=2, page_size=3, search_term="two wor", classification="likely_pathogenic")
    assert [row["row_id"] for row in page["data"].values()] == [4,5,6]
    assert all(row["classification"] == "likely_pathogenic" for row in page["data"].values())
    snps = get_all_snp_info(table, path, search_term="RS91")
    assert snps["pagination"]["total"] == len(snps["data"]) == 7

def test_legacy_archive_conversion_retries_without_losing_text(tmp_path):
    source = tmp_path / "RDT_0123456789.23andme.txt"
    source.write_bytes(b"# vendor\r\nrs1\t1\t9\tAG\r\n")
    assert len(list(migrate_text_archives(tmp_path))) == 1
    assert source.is_file()
    source.write_bytes(b"updated")
    with pytest.raises(ValueError, match="differs"):
        list(migrate_text_archives(tmp_path, remove_text=True))
    assert source.read_bytes() == b"updated"
    source.write_bytes(b"# vendor\r\nrs1\t1\t9\tAG\r\n")
    list(migrate_text_archives(tmp_path, remove_text=True))
    assert not source.exists()
