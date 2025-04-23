# coding=utf-8
# pzw
# Rootara核心库数据表构建 - PocketBase版本
# Clinvar版本：202404

import argparse
import gzip
import requests
from typing import List, Dict
from tqdm import tqdm
import concurrent.futures
from requests.adapters import HTTPAdapter
from urllib3.util import Retry  # Updated import statement

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
            response = self.session.post(  # 使用session而不是requests
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
            headers["Authorization"] = f"Bearer {self.auth_store['token']}"  # 添加Bearer前缀
        return headers

    def validate_record(self, record: Dict) -> bool:
        """
        验证记录数据的有效性
        """
        required_fields = ['chrom', 'pos', 'ref', 'alt']
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
                        json=record  # 发送单个记录
                    )
                    response.raise_for_status()
                    success_count += 1
                except Exception as e:
                    print(f"记录创建失败: {e}")
                    continue
            
            # print(f"本批次成功创建 {success_count}/{len(records)} 条记录")
            return success_count > 0
        except Exception as e:
            print(f"批量创建失败: {e}")
            return False

    def delete_all_records(self, collection_name: str) -> bool:
        """
        删除集合中的所有记录
        
        参数:
            collection_name (str): 集合名称
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

def import_data_from_txt(pb_client: PocketBaseClient, txt_file: str, collection_name: str):
    """
    从TXT文件导入数据到现有的PocketBase集合
    """
    try:
        print("开始读取文件...")
        open_func = gzip.open if txt_file.endswith('.gz') else open
        encoding = 'utf-8'
        
        with open_func(txt_file, 'rt', encoding=encoding) as f:
            headers = f.readline().strip().split('\t')
            headers = [h.strip().lower() for h in headers if h.strip()]
            print(f"检测到 {len(headers)} 列数据")
            print(f"表头内容: {headers}")
            
            # 字段映射（将start改为pos）
            field_mapping = {
                'start': 'pos',
                'chrom': 'chrom',
                'ref': 'ref',
                'alt': 'alt',
                'gene': 'gene',
                'rsid': 'rsid',
                'gnomad_af': 'gnomad_af',
                'clnsig': 'clnsig',
                'clndn': 'clndn'
            }
            
            print("正在导入数据...")
            batch_size = 100  # 减小批处理大小
            batch = []
            total_rows = 0
            all_batches = []
            
            # 预处理所有数据为批次
            for line in tqdm(f, desc="读取数据"):
                row = line.strip().split('\t')
                row = [field.strip().strip('"').strip() for field in row]
                
                if len(row) != len(headers):
                    continue
                
                record = {}
                for i, header in enumerate(headers):
                    mapped_field = field_mapping.get(header, header)
                    value = row[i]
                    
                    if value == '.':
                        value = None
                    elif mapped_field == 'pos':
                        value = int(value) if value else None
                    elif mapped_field == 'gnomad_af':
                        value = float(value) if value else None
                    
                    record[mapped_field] = value
                
                batch.append(record)
                total_rows += 1
                
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
                                 desc="导入进度"):
                    if future.result():
                        success_count += 1
            
            print(f"成功导入 {success_count * batch_size} 行数据到集合 {collection_name}")
            
    except Exception as e:
        print(f"错误: {e}")

def main():
    parser = argparse.ArgumentParser(description='将TXT文件导入到PocketBase数据库')
    parser.add_argument('--admin-url', required=True, help='PocketBase服务器地址')
    parser.add_argument('--email', required=True, help='用户邮箱')
    parser.add_argument('--password', required=True, help='用户密码')
    parser.add_argument('--file', required=True, help='要导入的TXT文件路径')
    parser.add_argument('--clear', action='store_true', help='清空集合中的所有记录')
    
    args = parser.parse_args()
    
    # 创建PocketBase客户端并进行认证
    pb_client = PocketBaseClient(args.admin_url)
    auth_data = pb_client.auth_with_password(args.email, args.password)
    
    if not auth_data:
        print("认证失败，请检查邮箱和密码")
        return
    
    print("认证成功！")
    
    try:
        if args.clear:
            # 如果指定了clear参数，先清空集合
            pb_client.delete_all_records('Rootara_Core')
        
        if args.file:
            # 导入新数据
            import_data_from_txt(
                pb_client,
                args.file,
                'Rootara_Core'
            )
    finally:
        # 操作完成后清除认证信息
        pb_client.clear_auth_store()

if __name__ == "__main__":
    main()