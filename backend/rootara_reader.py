# coding=utf-8
# pzw
# 20250422
# 这个脚本用于转换不同的厂商提供的结果文件，并储存到数据库中

"""
已支持：
- 23andme
- wegene
"""

"""
rootara = read_rootara_core('Rootara.core.202404.txt.gz')
df = read_wegene_result('pzw_wegene.txt', rootara)
print(df.head())

# Clinvar
df_clinvar = df[df['CLNSIG'].isin(['Pathogenic', 'Likely_pathogenic', 'Benign', 'Likely_benign', 'Uncertain_significance'])]
df_clinvar = df_clinvar[df_clinvar['Check'].isin(['HET', 'HOM'])]
df_clinvar.to_excel('pzw_wegene_clinvar.xlsx', index = False)

匹配逻辑需要改一下，不然会有很多致病位点

"""

import gzip
import pandas as pd
import random
import argparse
import requests
from typing import List, Dict
from tqdm import tqdm
import concurrent.futures
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

# 已测试1000000次，没有重复
def generate_random_id():
    """
    生成10位随机编号，由大写字母和数字组成
    :return: 10位随机编号字符串
    """
    # 定义字符池：26个大写字母和10个数字
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    # 生成8位随机编号
    random_id = ''.join(random.choice(chars) for _ in range(10))
    return random_id

# 读取rootara核心库
def read_rootara_core(file_path):
    """
    读取gzip压缩的文本文件，第一行为标题行
    :param file_path: 文件路径
    :param columns: 可选，列名列表。如果为None则使用文件第一行作为列名
    :return: pandas DataFrame
    """
    with gzip.open(file_path, 'rt') as f:
        df = pd.read_csv(
            f,
            sep = '\t',
            header = 0,
            low_memory=False
        )
    df.loc[:, 'Chrom'] = df['Chrom'].str.replace('chrM', 'MT')
    df.loc[:, 'Chrom'] = df['Chrom'].str.replace('chr', '')
    return df

# 基因型转换
def convert_genotype(row):
    ref = row['Ref']
    alt = row['Alt']
    genotype = row['Genotype']

    if len(ref) > len(alt):
        ref = 'I'
        alt = 'D'
    elif len(ref) < len(alt):
        ref = 'D'
        alt = 'I'
    elif len(ref) == len(alt):
        if len(ref) == 1:
            if alt == '-':
                ref = 'I'
                alt = 'D'
            elif ref == '-':
                ref = 'D'
                alt = 'I'
            else:
                alt = genotype[1] if genotype[0] == ref else genotype[0]
                row['Alt'] = alt
        # MNV
        else:
            return row
    
    if not ref in genotype and not alt in genotype:
        return row

    genotype_check = genotype.count(ref)
    if genotype == '--':
        return row
    elif genotype_check == 2:
        row['Check'] = 'WT'
        return row
    elif genotype_check == 1:
        row['Check'] = 'HET'
        return row
    elif genotype_check == 0:
        row['Check'] = 'HOM'
        return row
    
    return row

# 读取wegene结果
def read_wegene_result(file_path, rootara_df):
    # 定义列名
    columns = ['RSID', 'Chrom', 'Start', 'Genotype']
    
    # 读取文件，跳过#开头的行和空行
    df = pd.read_csv(
        file_path, 
        sep = '\t',
        comment = '#',
        skip_blank_lines = True,
        names = columns,
        low_memory = False
    )
    before_count = df.shape[0]
    df_merge = pd.merge(rootara_df, df, on=['Chrom', 'Start'])
    after_count = df_merge.shape[0]

    trans_rate = after_count / before_count
    print('转换率：', "%.2f" % (trans_rate * 100) + '%')
    print('转换前数量：', before_count)
    print('转换后数量：', after_count)

    # 基因型转换
    df_merge['Check'] = 'NA'
    df_merge = df_merge.apply(convert_genotype, axis = 1)
    
    col_need = ['Chrom', 'Start', 'Ref', 'Alt', 'Gene', 'RSID_x', 'CLNSIG', 'CLNDN', 'Genotype', 'Check']
    df_merge = df_merge[col_need]
    df_merge.rename(columns = {'RSID_x': 'RSID'}, inplace = True)
    return df_merge

# 添加PocketBase客户端类
class PocketBaseClient:
    def __init__(self, admin_url: str):
        """
        初始化PocketBase客户端
        """
        self.admin_url = admin_url
        self.auth_store = {
            "token": None,
            "record": None,
            "is_valid": False
        }
        
        # 配置重试策略
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504]
        )
        
        # 创建会话并配置连接池
        self.session = requests.Session()
        self.session.mount("http://", HTTPAdapter(max_retries=retry_strategy, pool_connections=100, pool_maxsize=100))
        self.session.mount("https://", HTTPAdapter(max_retries=retry_strategy, pool_connections=100, pool_maxsize=100))

    def auth_with_password(self, email: str, password: str) -> Dict:
        """
        使用邮箱和密码进行认证
        """
        try:
            response = self.session.post(
                f"{self.admin_url}/api/collections/users/auth-with-password",
                json={
                    "identity": email,
                    "password": password
                }
            )
            response.raise_for_status()
            auth_data = response.json()
            
            # 更新认证状态
            self.auth_store = {
                "token": auth_data.get("token"),
                "record": auth_data.get("record"),
                "is_valid": True
            }
            
            return auth_data
        except Exception as e:
            print(f"认证失败: {e}")
            self.auth_store["is_valid"] = False
            return None

    def clear_auth_store(self):
        """
        清除认证信息（登出）
        """
        self.auth_store = {
            "token": None,
            "record": None,
            "is_valid": False
        }

    @property
    def headers(self):
        """
        获取带认证信息的请求头
        """
        headers = {"Content-Type": "application/json"}
        if self.auth_store["token"]:
            headers["Authorization"] = f"Bearer {self.auth_store['token']}"
        return headers

    def validate_record(self, record: Dict) -> bool:
        """
        验证记录数据的有效性
        """
        required_fields = ['chrom', 'pos', 'genotype', 'check']
        for field in required_fields:
            if field not in record or record[field] is None:
                print(f"警告: 记录缺少必需字段 {field}")
                return False
        return True

    def batch_create_records(self, collection_name: str, records: List[Dict]) -> bool:
        """
        批量创建记录
        """
        try:
            success_count = 0
            for record in records:
                if not self.validate_record(record):
                    continue
                
                try:
                    response = self.session.post(
                        f"{self.admin_url}/api/collections/{collection_name}/records",
                        headers=self.headers,
                        json=record
                    )
                    response.raise_for_status()
                    success_count += 1
                except Exception as e:
                    print(f"记录创建失败: {e}")
                    continue
            
            return success_count > 0
        except Exception as e:
            print(f"批量创建失败: {e}")
            return False

    def delete_all_records(self, collection_name: str) -> bool:
        """
        删除集合中的所有记录
        """
        try:
            # 首先获取所有记录的ID
            response = self.session.get(
                f"{self.admin_url}/api/collections/{collection_name}/records",
                headers=self.headers,
                params={"fields": "id"}
            )
            response.raise_for_status()
            records = response.json()
            
            # 批量删除所有记录
            for record in tqdm(records.get("items", []), desc="删除记录"):
                delete_response = self.session.delete(
                    f"{self.admin_url}/api/collections/{collection_name}/records/{record['id']}",
                    headers=self.headers
                )
                delete_response.raise_for_status()
            
            print(f"成功删除集合 {collection_name} 中的所有记录")
            return True
        except Exception as e:
            print(f"删除失败: {e}")
            return False

def process_batch(pb_client: PocketBaseClient, batch: List[Dict], collection_name: str) -> bool:
    """
    处理单个批次的数据
    """
    return pb_client.batch_create_records(collection_name, batch)

def upload_dataframe_to_pocketbase(pb_client: PocketBaseClient, df: pd.DataFrame, collection_name: str, user_id: str):
    """
    将DataFrame上传到PocketBase数据库
    
    参数:
        pb_client: PocketBase客户端
        df: 要上传的DataFrame
        collection_name: 集合名称
        user_id: 用户ID
    """
    try:
        print(f"准备上传数据到集合 {collection_name}...")
        
        # 字段映射
        field_mapping = {
            'Chrom': 'chrom',
            'Start': 'pos',
            'Ref': 'ref',
            'Alt': 'alt',
            'Gene': 'gene',
            'RSID': 'rsid',
            'CLNSIG': 'clnsig',
            'CLNDN': 'clndn',
            'Genotype': 'genotype',
            'Check': 'check'
        }
        
        # 预处理所有数据为批次
        batch_size = 100
        all_batches = []
        batch = []
        
        for _, row in tqdm(df.iterrows(), total=len(df), desc="准备数据"):
            record = {}
            
            # 添加用户ID
            record['user_id'] = user_id
            
            # 添加随机ID作为样本ID
            record['sample_id'] = generate_random_id()
            
            # 映射字段
            for col in df.columns:
                if col in field_mapping:
                    mapped_field = field_mapping[col]
                    value = row[col]
                    
                    # 处理特殊值
                    if pd.isna(value) or value == '.':
                        value = None
                    elif mapped_field == 'pos':
                        value = int(value) if value and not pd.isna(value) else None
                    
                    record[mapped_field] = value
            
            batch.append(record)
            
            if len(batch) >= batch_size:
                all_batches.append(batch)
                batch = []
        
        if batch:
            all_batches.append(batch)
        
        # 使用线程池并发处理批次
        success_count = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for batch in all_batches:
                future = executor.submit(process_batch, pb_client, batch, collection_name)
                futures.append(future)
            
            for future in tqdm(concurrent.futures.as_completed(futures), 
                             total=len(futures), 
                             desc="上传进度"):
                if future.result():
                    success_count += 1
        
        total_uploaded = success_count * batch_size
        if success_count * batch_size > len(df):
            total_uploaded = len(df)
            
        print(f"成功上传 {total_uploaded}/{len(df)} 条记录到集合 {collection_name}")
        return True
    except Exception as e:
        print(f"上传失败: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='转换基因检测结果并上传到PocketBase数据库')
    parser.add_argument('--core', required=True, help='Rootara核心库文件路径')
    parser.add_argument('--input', required=True, help='输入的基因检测结果文件')
    parser.add_argument('--format', required=True, choices=['wegene', '23andme'], help='输入文件格式')
    parser.add_argument('--output', help='输出Excel文件路径（可选）')
    parser.add_argument('--admin-url', help='PocketBase服务器地址')
    parser.add_argument('--email', help='PocketBase用户邮箱')
    parser.add_argument('--password', help='PocketBase用户密码')
    parser.add_argument('--user-id', help='用户ID')
    parser.add_argument('--clear', action='store_true', help='清空集合中的所有记录')
    
    args = parser.parse_args()
    
    # 读取Rootara核心库
    print(f"读取Rootara核心库: {args.core}")
    rootara_df = read_rootara_core(args.core)
    
    # 根据格式读取基因检测结果
    print(f"读取基因检测结果: {args.input}")
    if args.format == 'wegene':
        result_df = read_wegene_result(args.input, rootara_df)
    elif args.format == '23andme':
        # 这里可以添加23andme的读取函数
        print("23andme格式暂未实现")
        return
    
    # 筛选Clinvar相关结果
    df_clinvar = result_df[result_df['CLNSIG'].isin(['Pathogenic', 'Likely_pathogenic', 'Benign', 'Likely_benign', 'Uncertain_significance'])]
    df_clinvar = df_clinvar[df_clinvar['Check'].isin(['HET', 'HOM'])]
    
    # 如果指定了输出文件，保存为Excel
    if args.output:
        print(f"保存结果到Excel: {args.output}")
        df_clinvar.to_excel(args.output, index=False)
    
    # 如果提供了PocketBase信息，上传到数据库
    if args.admin_url and args.email and args.password and args.user_id:
        print("连接到PocketBase数据库...")
        pb_client = PocketBaseClient(args.admin_url)
        auth_data = pb_client.auth_with_password(args.email, args.password)
        
        if not auth_data:
            print("认证失败，请检查邮箱和密码")
            return
        
        print("认证成功！")
        
        try:
            collection_name = 'User_Genetic_Data'
            
            if args.clear:
                # 如果指定了clear参数，先清空集合
                pb_client.delete_all_records(collection_name)
            
            # 上传数据
            upload_dataframe_to_pocketbase(
                pb_client,
                df_clinvar,
                collection_name,
                args.user_id
            )
        finally:
            # 操作完成后清除认证信息
            pb_client.clear_auth_store()

if __name__ == "__main__":

    rootara = read_rootara_core('Rootara.core.202404.txt.gz')
    df = read_wegene_result('pzw_wegene.txt', rootara)
    print(df.head())

    # Clinvar
    df_clinvar = df[df['CLNSIG'].isin(['Pathogenic', 'Likely_pathogenic', 'Benign', 'Likely_benign', 'Uncertain_significance'])]
    df_clinvar = df_clinvar[df_clinvar['Check'].isin(['HET', 'HOM'])]
    df_clinvar.to_excel('pzw_wegene_clinvar.xlsx', index = False)
    main()




