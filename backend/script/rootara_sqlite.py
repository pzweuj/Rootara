# coding=utf-8
# sqlite3 初始化

import random
import sqlite3
import os
import datetime

# 已测试1000000次，没有重复
def generate_random_id():
    """
    生成10位随机编号，由大写字母和数字组成
    :return: 10位随机编号字符串
    """
    # 定义字符池：26个大写字母和10个数字
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    # 生成10位随机编号
    random_id = ''.join(random.choice(chars) for _ in range(10))
    return random_id


def init_sqlite_db(db_path):
    """
    初始化SQLite数据库，创建必要的表结构
    :param db_path: 数据库文件路径
    :return: 成功返回True，失败返回False
    """
    try:
        # 确保目录存在
        db_dir = os.path.dirname(db_path)
        if not os.path.exists(db_dir):
            os.makedirs(db_dir)
            
        # 连接到数据库（如果不存在则创建）
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 创建用户表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            user_id TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # 创建报告表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            report_id TEXT PRIMARY KEY,
            user_id INTEGER,
            file_format TEXT,
            data_source TEXT,
            total_snps INTEGER,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        ''')
        
        # 创建SNP数据表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS RPT_TEMPLATE01 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rsid TEXT,
            chromosome TEXT,
            position INTEGER,
            ref TEXT,
            alt TEXT,
            genotype TEXT,
            clnsig TEXT,
            clndn TEXT
        )
        ''')

        # 提交事务
        conn.commit()
        
        # 关闭连接
        conn.close()
        
        return True
    except Exception as e:
        print(f"初始化数据库失败: {e}")
        return False


# 使用示例
if __name__ == "__main__":
    # 数据库文件路径
    db_file = os.path.join(os.path.dirname(__file__), "rootara.db")
    
    # 初始化数据库
    if init_sqlite_db(db_file):
        print(f"数据库初始化成功: {db_file}")
    else:
        print("数据库初始化失败")




