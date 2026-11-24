# coding=utf-8
# 将数据进行转换，并写入数据库

import argparse
import csv
import sqlite3
from contextlib import closing

from scripts.rootara_table_info import validate_report_table_name


def csv_to_sqlite(file_path, db_path, table_name, force=False):
    table = validate_report_table_name(table_name)
    columns = ("Chrom","Start","Ref","Alt","RSID","gnomAD_AF","Gene","CLNSIG","CLNDN","Genotype","Check")
    with closing(sqlite3.connect(db_path)) as conn, conn, open(file_path, newline="", encoding="utf-8") as source:
        reader = csv.reader(source)
        header = next(reader)
        indexes = [header.index(col) for col in columns]
        conn.execute("BEGIN IMMEDIATE")
        if force:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.execute(f"""CREATE TABLE {table} (
            chromosome TEXT, position INTEGER, ref TEXT, alt TEXT, rsid TEXT, gnomAD_AF REAL,
            gene TEXT, clnsig TEXT, clndn TEXT, genotype TEXT, gt TEXT)""")
        rows = (tuple(row[i] or None for i in indexes) for row in reader)
        conn.executemany(f"INSERT INTO {table} VALUES (?,?,?,?,?,?,?,?,?,?,?)", rows)
        conn.execute(f"CREATE INDEX idx_{table}_rsid ON {table}(rsid)")

def main():
    parser = argparse.ArgumentParser(description='将Rootara CSV转换为SQLite数据库')
    parser.add_argument('--input', type=str, help='输入CSV文件路径')
    parser.add_argument('--db', type=str, help='输出数据库文件路径')
    parser.add_argument('--id', type=str, help='数据表名称')
    parser.add_argument('--force', type=bool, help='是否强制覆盖已存在的数据表，默认False', default=False)
    args = parser.parse_args()

    # 检查是否提供了所有必需参数
    if not all([args.input, args.db, args.id]):
        parser.print_help()
        sys.exit(1)

    csv_to_sqlite(file_path=args.input, db_path=args.db, table_name=args.id, force=args.force)

if __name__ == '__main__':
    main()
