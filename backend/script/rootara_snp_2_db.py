# coding=utf-8
# 将数据进行转换，并写入数据库

import pandas as pd
import sqlite3


def convert_data_to_df(file_path):
    df = pd.read_csv(file_path, sep=',', header=0)
    return df

def dataframe_to_sqlite(df, db_path, table_name, if_exists='replace'):
    """
    将Pandas DataFrame转换为SQLite表
    
    :param df: Pandas DataFrame对象
    :param db_path: SQLite数据库文件路径
    :param table_name: 要创建的表名
    :param if_exists: 如果表已存在，执行的操作：'replace'(替换)、'append'(追加)或'fail'(报错)
    :return: 成功返回True，失败返回False
    """
    try:
        # 连接到数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 如果选择替换表且表已存在，则先删除
        if if_exists == 'replace':
            cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
        
        # 初始化表
        cursor.execute(f'''
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chromosome TEXT,
            position INTEGER,
            ref TEXT,
            alt TEXT,
            rsid TEXT DEFAULT null,
            gnomAD_AF FLOAT DEFAULT null,
            gene TEXT,
            clnsig TEXT DEFAULT null,
            clndn TEXT DEFAULT null,
            genotype TEXT,
            check TEXT
        )
        ''')

        # 遍历df的每一行，将行转换为set，插入到数据库中
        for index, row in df.iterrows():
            # 构建SQL语句
            sql = f"INSERT INTO {table_name} (chromosome, position, ref, alt, rsid, gnomAD_AF, gene, clnsig, clndn, genotype, check) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            values = (row['Chrom'], row['Start'], row['Ref'], row['Alt'], row['RSID'], row['gnomAD_AF'], row['Gene'], row['CLNSIG'], row['CLNDN'], row['Genotype'], row['Check'])

            # 执行SQL语句
            cursor.execute(sql, values) 

        # 提交事务并关闭连接
        conn.commit()
        conn.close()
        
        print(f"成功将DataFrame转换为SQLite表 '{table_name}'，共 {len(df)} 行")
        return True
    
    except Exception as e:
        print(f"将DataFrame转换为SQLite表失败: {e}")
        return False


df = convert_data_to_df('../Test/pzw_wegene.rootara.txt')
dataframe_to_sqlite(df, 'rootara.db', 'RPT_TEMPLATE01')


