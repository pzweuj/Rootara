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
import pandas as pd
import subprocess
from scripts.runtime_config import HAPLOGROUPER_DIR, TEMP_DIR

def insert_haplogroup_to_db(rpt_id, vcf_file, db_file, force=False):
    with sqlite3.connect(db_file) as conn:
        if not force and conn.execute("SELECT 1 FROM haplogroup WHERE report_id=?", (rpt_id,)).fetchone():
            return
        data = HAPLOGROUPER_DIR / "data"
        results = []
        with tempfile.TemporaryDirectory(dir=TEMP_DIR) as work:
            for tree, loci in (("chrY_isogg2019_tree", "chrY_isogg2019-decode1_loci_b37"),
                               ("chrMT_phylotree17_tree", "chrMT_phylotree17_loci")):
                output = os.path.join(work, tree + ".tsv")
                subprocess.run([sys.executable, str(HAPLOGROUPER_DIR / "haploGrouper.py"),
                                "-v", str(vcf_file), "-t", str(data / (tree + ".txt")),
                                "-l", str(data / (loci + ".txt")), "-o", output], check=True)
                results.append(pd.read_csv(output, sep="\t").iloc[0]["Haplogroup"])
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

