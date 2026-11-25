# coding=utf-8
# pzw
# 20250423
# 用于从vcf分析单倍型
# 使用 https://gitlab.com/bio_anth_decode/haploGrouper

import os
import sys
import argparse
import sqlite3
import tempfile
import csv
import subprocess
from scripts.runtime_config import HAPLOGROUPER_DIR, TEMP_DIR
from scripts.rootara_table_info import validate_report_table_name


def write_haplogroup_vcf(conn, report, path):
    table = validate_report_table_name(report)
    rows = conn.execute(f"""SELECT chromosome,position,ref,alt,gt FROM {table}
        WHERE chromosome IN ('Y','MT') AND gt != 'WT'
        AND genotype NOT IN ('DD','II','DI','ID','--')
        ORDER BY chromosome,position,rowid""")
    with path.open("w", encoding="utf-8", newline="\n") as output:
        output.write("##fileformat=VCFv4.2\n##reference=GRCh37\n")
        output.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tRootara\n")
        for chrom, pos, ref, alt, check in rows:
            gt = "0/1" if check == "HET" else "1/1"
            output.write(f"{chrom}\t{pos}\t.\t{ref}\t{alt}\t.\tPASS\t.\tGT\t{gt}\n")

def insert_haplogroup_to_db(rpt_id, vcf_file, db_file, force=False):
    with sqlite3.connect(db_file) as conn:
        if not force and conn.execute("SELECT 1 FROM haplogroup WHERE report_id=?", (rpt_id,)).fetchone():
            return
        data = HAPLOGROUPER_DIR / "data"
        results = []
        with tempfile.TemporaryDirectory(dir=TEMP_DIR) as work:
            for chrom, tree, loci in (("Y", "chrY_isogg2019_tree", "chrY_isogg2019-decode1_loci_b37"),
                                      ("MT", "chrMT_phylotree17_tree", "chrMT_phylotree17_loci")):
                output = os.path.join(work, tree + ".tsv")
                subprocess.run(["haplogrouper-rs", "-c", chrom,
                                "-v", str(vcf_file), "-t", str(data / (tree + ".txt")),
                                "-l", str(data / (loci + ".txt")), "-o", output], check=True)
                with open(output, newline="", encoding="utf-8") as handle:
                    rows = list(csv.DictReader(handle, delimiter="\t"))
                if len(rows) != 1 or not rows[0]["Haplogroup"]:
                    raise ValueError(f"Missing {chrom} haplogroup assignment")
                results.append(rows[0]["Haplogroup"])
        conn.execute("INSERT OR REPLACE INTO haplogroup (report_id,y_hap,mt_hap) VALUES (?,?,?)",
                     (rpt_id, *results))

def main():
    parser = argparse.ArgumentParser(description='分析单倍型')
    parser.add_argument('--input', type=str, help='输入VCF文件')
    parser.add_argument('--id', type=str, help='输入报告编号')
    parser.add_argument('--db', type=str, help='数据数据库文件')
    parser.add_argument('--force', type=bool, help='是否强制执行，默认False', default=False)
    args = parser.parse_args()

    # 检查是否提供了所有必需参数
    if not all([args.input, args.id, args.db]):
        parser.print_help()
        sys.exit(1)

    try:
        insert_haplogroup_to_db(args.id, args.input, args.db, args.force)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

