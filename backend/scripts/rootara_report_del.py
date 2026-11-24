# coding=utf-8
# pzw
# 删除报告
# 会从sqlite数据库中删除对应的报告
# 并会重新设定默认报告

import sqlite3
import argparse
from scripts.runtime_config import RAWDATA_DIR
from scripts.rootara_table_info import validate_report_table_name

def delete_report(report_id, db_file):
    validate_report_table_name(report_id)
    print("删除报告：{report_id}".format(report_id=report_id))

    if report_id == 'RPT_TEMPLATE01':
        print("模板报告不能删除")
        return

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    # 删除报告表 - 使用引用标识符语法
    cursor.execute("DROP TABLE IF EXISTS [{}]".format(report_id))

    # 删除admixture表记录
    cursor.execute("DELETE FROM admixture WHERE report_id = ?", (report_id,))

    # 删除单倍群表记录
    cursor.execute("DELETE FROM haplogroup WHERE report_id =?", (report_id,))

    # 删除报告记录
    # 首先先查看这个报告是不是默认报告
    cursor.execute("SELECT select_default FROM reports WHERE report_id =?", (report_id,))
    result = cursor.fetchone()
    
    # 如果是，则先需要将其他报告设置为默认报告
    if result and result[0]:
        # 按上传时间排序选择最新的报告作为默认报告，排除当前要删除的报告
        cursor.execute("""
            UPDATE reports 
            SET select_default = True 
            WHERE report_id = (
                SELECT report_id 
                FROM reports 
                WHERE report_id != ? 
                ORDER BY upload_date DESC 
                LIMIT 1
            )
        """, (report_id,))

    cursor.execute("DELETE FROM reports WHERE report_id = ?", (report_id,))
    if cursor.execute("SELECT 1 FROM sqlite_master WHERE name='report_trait_import_state'").fetchone():
        cursor.execute("DELETE FROM report_trait_import_state WHERE report_id=?", (report_id,))
    if cursor.execute("SELECT 1 FROM sqlite_master WHERE name='import_jobs'").fetchone():
        cursor.execute("DELETE FROM import_jobs WHERE report_id=?", (report_id,))
    conn.commit()
    conn.close()
    for path in RAWDATA_DIR.glob(f"RDT_{report_id[4:]}.*"):
        if path.suffix in {".txt", ".parquet"}:
            path.unlink(missing_ok=True)

def main():
    parser = argparse.ArgumentParser(description='删除报告')
    parser.add_argument('--db', type=str, help='数据库文件')
    parser.add_argument('--report', type=str, help='报告ID')
    args = parser.parse_args()

    # 检查是否提供了所有必需参数
    if not all([args.db, args.report]):
        parser.print_help()
        sys.exit(1)

    delete_report(args.report, args.db)

if __name__ == '__main__':
    main()


