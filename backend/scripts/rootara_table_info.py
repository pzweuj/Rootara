# coding=utf-8
# pzw
# 单个表格的信息查询和处理
import sqlite3
import re
from contextlib import closing


REPORT_TABLE_RE = re.compile(r"^RPT_(?:TEMPLATE01|[A-Z0-9]{10})$")


def validate_report_table_name(report_id):
    """Return a safe SQLite report-table identifier or raise ValueError."""

    if not isinstance(report_id, str) or not REPORT_TABLE_RE.fullmatch(report_id):
        raise ValueError("invalid report id")
    return report_id

# 根据RSID查询若干个SNP的信息
def get_snp_info_by_rsid(rsid_list, report_id, db_path, concise=False):
    report_id = validate_report_table_name(report_id)
    # 连接到数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 检查表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (report_id,))
    if not cursor.fetchone():
        # 表不存在时返回空结果
        empty_result = {}
        for rsid in rsid_list:
            empty_result[rsid] = {
                'chromosome': None,
                'position': None,
                'ref': None,
                'alt': None,
                'rsid': rsid,
                'gnomAD_AF': None,
                'gene': None,
                'clnsig': None,
                'clndn': None,
                'genotype': None,
                'check': None
            }
        conn.close()
        return empty_result
    
    # A trait page requests roughly 150 loci. Query them in one indexed scan
    # instead of scanning a 300k+ row report table once per RSID.
    requested = list(dict.fromkeys(rsid for rsid in rsid_list if isinstance(rsid, str)))
    result_dict = {}
    concise_dict = {}
    if requested:
        placeholders = ",".join("?" for _ in requested)
        cursor.execute(f"SELECT * FROM {report_id} WHERE rsid IN ({placeholders})", requested)
        column_names = [description[0] for description in cursor.description]
        for row in cursor.fetchall():
            snp_dict = dict(zip(column_names, row))
            rsid = snp_dict.get('rsid')
            if not rsid or rsid in result_dict:
                continue
            result_dict[rsid] = snp_dict
            reference = snp_dict.get('ref')
            concise_dict[rsid] = [reference + reference if reference else None, snp_dict.get('genotype')]

    for rsid in requested:
        if rsid in result_dict:
            continue
        result_dict[rsid] = {
            'chromosome': None,
            'position': None,
            'ref': None,
            'alt': None,
            'rsid': rsid,
            'gnomAD_AF': None,
            'gene': None,
            'clnsig': None,
            'clndn': None,
            'genotype': None,
            'check': None
        }
        concise_dict[rsid] = [None, None]
    
    # 关闭数据库连接
    conn.close()
    if concise:
        return concise_dict
    return result_dict

# 根据chromosome position ref alt查询若干个SNP的信息
# 这个输入是一个这样的列表[(chromosome, position, ref, alt), (chromosome, position, ref, alt)]
def get_snp_info_by_chromosome_position_ref_alt(query_list, report_id, db_path):
    report_id = validate_report_table_name(report_id)
    # 连接到数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 检查表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (report_id,))
    if not cursor.fetchone():
        # 表不存在时返回空结果
        empty_result = {}
        for query in query_list:
            chromosome, position, ref, alt = query
            empty_result[f"{chromosome}:{position}:{ref}:{alt}"] = {
                'chromosome': chromosome,
                'position': position,
                'ref': ref,
                'alt': alt,
                'rsid': None,
                'gnomAD_AF': None,
                'gene': None,
                'clnsig': None,
                'clndn': None,
                'genotype': None,
                'check': None
            }
        conn.close()
        return empty_result

    # 创建结果字典
    result_dict = {}

    # 查询每个chromosome position ref alt的SNP信息
    for query in query_list:
        chromosome, position, ref, alt = query
        cursor.execute(f"SELECT * FROM {report_id} WHERE chromosome=? AND position=? AND ref=? AND alt=?",  
                      (chromosome, position, ref, alt))
        snp_info = cursor.fetchone()

        if snp_info:
            # 获取列名
            column_names = [description[0] for description in cursor.description]
            # 将结果转换为字典
            snp_dict = dict(zip(column_names, snp_info))
            result_dict[f"{chromosome}:{position}:{ref}:{alt}"] = snp_dict
        else:
            # 如果没有找到该chromosome position ref alt的信息，添加空记录
            result_dict[f"{chromosome}:{position}:{ref}:{alt}"] = {
                'chromosome': chromosome,
                'position': position,
                'ref': ref,
                'alt': alt,
                'rsid': None,
                'gnomAD_AF': None,
                'gene': None,
                'clnsig': None,
                'clndn': None,
                'genotype': None,
                'check': None
            }

    # 关闭数据库连接
    conn.close()
    return result_dict

# 整张表的信息输出，表格很大，使用懒惰加载方式处理，支持前端表格展示、搜索和筛选
def get_all_snp_info(report_id, db_path, page_size=1000, page=1, sort_by="", sort_order='asc', 
                     search_term="", filters={}):
    report_id = validate_report_table_name(report_id)
    
    # 在函数内部添加检查
    if sort_by == "":
        sort_by = None
    if search_term == "":
        search_term = None
    if filters == {}:
        filters = None
    
    # 连接到数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 检查表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (report_id,))
    if not cursor.fetchone():
        # 表不存在时返回空结果
        empty_result = {
            "data": {},
            "columns": [],
            "pagination": {
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            }
        }
        conn.close()
        return empty_result
    
    # 获取表的列信息
    cursor.execute(f"PRAGMA table_info({report_id})")
    columns_info = cursor.fetchall()
    columns = [col[1] for col in columns_info]
    
    # 构建基本查询
    base_query = f"FROM {report_id}"
    count_query = f"SELECT COUNT(*) {base_query}"
    data_query = f"SELECT rowid AS row_id, * {base_query}"
    
    # 构建WHERE子句
    where_clauses = []
    query_params = []
    
    # 添加搜索条件 - 修改为完美匹配
    if search_term and re.fullmatch(r"rs[0-9]+", search_term, re.IGNORECASE):
        where_clauses.append("rsid = ?")
        query_params.append(search_term.lower())
    elif search_term:
        search_conditions = []
        for col in columns:
            search_conditions.append(f"{col} = ?")  # 使用等号而不是LIKE进行完美匹配
            query_params.append(search_term)  # 不再添加%通配符
        
        if search_conditions:
            where_clauses.append(f"({' OR '.join(search_conditions)})")
    
    # 添加筛选条件
    if filters and isinstance(filters, dict):
        for col, value in filters.items():
            if col in columns:
                if isinstance(value, list):
                    # 处理多选筛选
                    placeholders = ', '.join(['?'] * len(value))
                    where_clauses.append(f"{col} IN ({placeholders})")
                    query_params.extend(value)
                else:
                    # 处理单值筛选
                    where_clauses.append(f"{col} = ?")
                    query_params.append(value)
    
    # 组合WHERE子句
    if where_clauses:
        where_clause = " WHERE " + " AND ".join(where_clauses)
        count_query += where_clause
        data_query += where_clause
    
    # 添加排序
    if sort_by and sort_by in columns:
        sort_direction = "DESC" if sort_order.lower() == 'desc' else "ASC"
        data_query += f" ORDER BY {sort_by} {sort_direction}"
    
    # 计算总记录数（考虑筛选条件）
    cursor.execute(count_query, query_params)
    total_count = cursor.fetchone()[0]
    
    # 计算偏移量
    offset = (page - 1) * page_size
    
    # 添加分页
    data_query += " LIMIT ? OFFSET ?"
    query_params.extend([page_size, offset])
    
    # 执行查询
    cursor.execute(data_query, query_params)
    
    # 获取列名
    column_names = [description[0] for description in cursor.description]
    
    # 构建结果字典
    result = {
        "data": {},
        "columns": column_names,
        "pagination": {
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_count + page_size - 1) // page_size
        }
    }
    
    # 使用迭代器处理查询结果，避免一次性加载所有数据到内存
    for row in cursor:
        snp_dict = dict(zip(column_names, row))
        key = snp_dict["rsid"]
        if not key or key in result["data"]:
            key = f"row:{snp_dict['row_id']}"
        result["data"][key] = snp_dict
    
    # 关闭数据库连接
    conn.close()
    return result

CLINVAR_CLASSES = ("Pathogenic", "Likely_pathogenic", "Uncertain_significance", "Likely_benign", "Benign")


def get_clinvar_data(report_id, db_path, sort_by="", sort_order="asc", search_term="",
                     filters=None, indel=False, *, page=None, page_size=10, summary=False,
                     classification=None):
    table = validate_report_table_name(report_id)
    stats = {value.lower(): 0 for value in CLINVAR_CLASSES}
    result = {"data": {}, "columns": [], "total": 0, "statistics": stats}
    with closing(sqlite3.connect(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        columns = [r["name"] for r in conn.execute(f"PRAGMA table_info({table})")]
        if not columns:
            return result
        result["columns"] = columns
        primary = "substr(clnsig, 1, instr(clnsig || '/', '/') - 1)"
        marks = ",".join("?" for _ in CLINVAR_CLASSES)
        base = f"FROM {table} WHERE gt NOT IN ('.','WT') AND clndn != '.' AND {primary} IN ({marks})"
        if not indel:
            base += " AND ref NOT IN ('I','D') AND alt NOT IN ('I','D')"
        params = list(CLINVAR_CLASSES)
        for category, count in conn.execute(f"SELECT {primary}, COUNT(*) {base} GROUP BY {primary}", params):
            stats[category.lower()] = count
        query = base
        if classification and classification != "all":
            query += f" AND lower({primary}) = ?"
            params.append(classification.lower())
        if search_term:
            if page is None:
                query += " AND (" + " OR ".join(f"{col} = ?" for col in columns) + ")"
                params.extend([search_term] * len(columns))
            else:
                fields = ["rsid", "gene", "replace(clndn, '_', ' ')"]
                query += " AND (" + " OR ".join(f"instr(lower({field}), lower(?)) > 0" for field in fields) + ")"
                params.extend([search_term] * len(fields))
        for key, value in (filters or {}).items():
            if key in columns:
                values = value if isinstance(value, list) else [value]
                query += f" AND {key} IN (" + ",".join("?" for _ in values) + ")"
                params.extend(values)
        result["total"] = (sum(stats.values()) if query == base else
                           conn.execute(f"SELECT COUNT(*) {query}", params).fetchone()[0])
        if summary:
            query += f" ORDER BY CASE {primary} WHEN 'Pathogenic' THEN 0 WHEN 'Likely_pathogenic' THEN 1 WHEN 'Uncertain_significance' THEN 2 WHEN 'Likely_benign' THEN 3 ELSE 4 END, rowid LIMIT 4"
        else:
            if sort_by in columns:
                direction = "DESC" if sort_order.lower() == "desc" else "ASC"
                query += f" ORDER BY {sort_by} {direction}, rowid"
            else:
                query += " ORDER BY rowid"
            if page is not None:
                query += " LIMIT ? OFFSET ?"
                params.extend([page_size, (page - 1) * page_size])
        for row in conn.execute(f"SELECT rowid AS row_id, *, lower({primary}) AS classification {query}", params):
            key = row["rsid"]
            if not key or key in result["data"]:
                key = f"row:{row['row_id']}"
            result["data"][key] = dict(row)
    return result
