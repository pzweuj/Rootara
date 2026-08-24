# coding=utf-8
# 设计特征表的格式，用于读取默认的特征表形成一个特征表数据库
# 在需要渲染时，将特征表数据库输出为一个json文件

"""
id: 特征的id，默认的特征可以使用英文单词作为ID，自定义的特征使用随机生成的ID
name: {
    "en": "英文名称",
    "zh-CN": "中文名称",
    "default": ""
}
description: {
    "en": "",
    "zh-CN": "中文描述",
    "default": ""
}
icon: ""
confidence: ""
isDefault: true就是默认特征，false就是自定义特征
createdAt: ""
category: ""
rsids: []  用到的rsid列表
formula： "计算公式字符串"
scoreThresholds: {
    "default": {
        "cutoff": 0,
        "description": ""
    },
    "en": {},
    "zh-CN": {}
}
"""

import os
import sys
from datetime import datetime
import random
import json
import sqlite3
from functools import lru_cache
from pathlib import Path


TRAIT_EVIDENCE_PATH = Path(
    os.environ.get(
        "ROOTARA_TRAIT_EVIDENCE_PATH",
        str(Path(__file__).resolve().parents[1] / "database" / "trait-evidence.json"),
    )
)


@lru_cache(maxsize=1)
def _load_trait_evidence_catalog():
    """Load the reviewed evidence sidecar without making it a DB migration."""

    try:
        return json.loads(TRAIT_EVIDENCE_PATH.read_text(encoding="utf-8")).get("rules", {})
    except (OSError, ValueError, TypeError):
        return {}

# 根据脚本运行方式选择合适的导入路径
if __name__ == "__main__":
    # 将项目根目录添加到模块搜索路径
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from scripts.rootara_table_info import get_snp_info_by_rsid
else:
    # 作为模块导入时使用相对导入
    from scripts.rootara_table_info import get_snp_info_by_rsid

# 随机ID
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

# 新增特征 || 特征不支持修改
# data的格式与json的相同
# 在main中设定data的格式
def add_trait(data, db_path, add_mode=True):
    # 连接到SQLite数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 这个data是一个json格式
    print('Process: ', data)

    # 生成一个随机ID，如果是默认的特征，则使用原本的ID
    id = "TRA_" + generate_random_id() if add_mode else data['id']

    # 处理可能已经是字符串的JSON字段
    def ensure_json_string(field):
        if isinstance(field, dict):
            return json.dumps(field)
        elif isinstance(field, str):
            try:
                # 尝试解析，如果是有效的JSON字符串，直接返回
                json.loads(field)
                return field
            except:
                # 不是有效的JSON字符串，进行序列化
                return json.dumps(field)
        return json.dumps(field)

    # 区分'新增'和'默认'的特征插入
    name = ensure_json_string(data['name'])
    description = ensure_json_string(data['description'])
    score_thresholds = ensure_json_string(data['scoreThresholds'])
    result = ensure_json_string(data['result'])

    icon = data['icon']
    confidence = data['confidence']
    is_default = False if add_mode else True
    created_at = datetime.now().isoformat()
    category = data['category']
    rsids = ";".join(data['rsids'])               # 尽管在新增内容时，会出现当前样本的rsid基因型，但不需要保存到数据库中
    formula = data['formula']
    reference = ";".join(data['reference'])

    # 插入数据
    cursor.execute('''
    INSERT INTO traits (id, name, description, icon, confidence, isDefault, createdAt, category, rsids, formula, scoreThresholds, result, reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (id, name, description, icon, confidence, is_default, created_at, category, rsids, formula, score_thresholds, result, reference))

    conn.commit()
    conn.close()

# 转换默认json为默认特征表，用于初始化数据
def json_to_trait_table(json_file, db_path):
    data = json.load(open(json_file, 'r', encoding='utf-8'))

    # 连接到SQLite数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 创建特征表 || 这个表暂时不考虑拆分用户的特征，不过可以将用户ID作为保留字段
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS traits (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        icon TEXT,
        confidence TEXT,
        isDefault BOOLEAN,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        category TEXT,
        rsids TEXT,
        formula TEXT,
        scoreThresholds TEXT,
        result TEXT,
        reference TEXT
    )
    ''')
    conn.commit()
    conn.close()

    # 遍历JSON数据，插入特征数据
    for item in data:
        add_trait(item, db_path, False)

# 删除自定义的特征
def delete_trait(id, db_path):
    if not id.startswith('TRA_'):
        return

    # 连接到SQLite数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 删除数据
    cursor.execute('''
    DELETE FROM traits WHERE id = ?
    ''', (id,))

    # 提交更改并关闭连接
    conn.commit()
    conn.close()

# 导入自定义特征
def self_json_to_trait_table(data, db_path):
    # 遍历JSON数据，插入特征数据
    for item in data:
        # 数据现在应该已经是正确的字典格式
        if not isinstance(item, dict):
            print(f"警告: 期望字典格式，但收到: {type(item)}, 数据: {item}")
            continue
        add_trait(item, db_path, False)

# 导出自定义特征
def self_traits_to_json(db_path):
    # 将特征表处理为一个字典格式
    # 连接到SQLite数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 查询数据 ||  WHERE isDefault = 0
    cursor.execute('''
    SELECT * FROM traits WHERE isDefault = 0
    ''')
    rows = cursor.fetchall()

    # 关闭连接
    conn.close()

    # 转换为字典格式
    traits = []
    for row in rows:
        try:
            # 使用ast.literal_eval更安全地解析字符串字典
            name_dict = json.loads(row[1])
            description_dict = json.loads(row[2])
            score_thresholds_dict = json.loads(row[10])
            result_dict = json.loads(row[11])

            trait = {
                'id': row[0],
                'name': name_dict,
                'description': description_dict,
                'icon': row[3],
                'confidence': row[4],
                'isDefault': bool(row[5]),
                'createdAt': row[6],
                'category': row[7],
                'rsids': row[8].split(';') if row[8] else [],
                'formula': row[9],
                'scoreThresholds': score_thresholds_dict,
                'result': result_dict,
                'reference': row[12].split(';') if row[12] else []
            }
            evidence_rule = _load_trait_evidence_catalog().get(trait['id'])
            if evidence_rule:
                trait['evidenceStatus'] = evidence_rule.get('status')
                trait['evidenceGrade'] = evidence_rule.get('evidence_grade')
                trait['evidence'] = evidence_rule.get('evidence', [])
                trait['limitations'] = evidence_rule.get('limitations', [])
                trait['reviewBlockers'] = evidence_rule.get('review_blockers', [])
                # Reviewed references supersede legacy placeholders in the DB.
                trait['reference'] = [
                    item['id']
                    for item in evidence_rule.get('evidence', [])
                    if item.get('type') == 'PMID' and item.get('id')
                ]
            else:
                trait['reference'] = [
                    reference
                    for reference in trait['reference']
                    if reference not in {'11111111', '222222222', '333333333'}
                ]
            traits.append(trait)
        except (ValueError, SyntaxError) as e:
            print(f"解析数据时出错: {e}")
            print(f"出错的行数据: {row}")
            continue

    # 将字典格式转换为JSON字符串
    json_str = json.dumps(traits, indent=4, ensure_ascii=False)
    return json_str

# 公式解析器
class InsufficientGeneticData(ValueError):
    """Raised when a rule cannot be evaluated from the available genotypes."""


def parse_formula(formula, genotype_dict):
    """
    解析公式并计算结果，支持SCORE、IF以及组合公式

    :param formula: 公式字符串，如 "SCORE(rs4988235:CT=5,CC=0,TT=10)" 或
                   "IF(rs4988235:CT=true,CC=false,TT=true)" 或
                   "IF(rs4988235:CT=true){SCORE(rs182549:CT=5,CC=0,TT=10)}ELSE{SCORE(rs182549:CT=0,CC=0,TT=5)}"
    :param genotype_dict: 包含位点对应结果的字典，如 {'rs4988235': 'CT'}
    :return: 计算得到的结果（得分或布尔值）
    """
    # 检查是否为组合公式（包含IF...ELSE结构）
    if formula.startswith("IF(") and "{" in formula:
        return _parse_combined_formula(formula, genotype_dict)
    # 检查是否为简单IF公式
    elif formula.startswith("IF("):
        return _parse_if_formula(formula, genotype_dict)
    # 检查是否为SCORE公式
    elif formula.startswith("SCORE("):
        return _parse_score_formula(formula, genotype_dict)
    else:
        raise ValueError("公式格式不正确，应以SCORE(或IF(开头")

def _parse_score_formula(formula, genotype_dict):
    """
    解析SCORE公式并计算得分

    :param formula: 公式字符串，如 "SCORE(rs4988235:CT=5,CC=0,TT=10; rs182549:CT=5,CC=0,TT=10)"
    :param genotype_dict: 包含位点对应结果的字典，如 {'rs4988235': 'CT'}
    :return: 计算得到的得分
    """
    # 检查公式是否以SCORE开头
    if not formula.startswith("SCORE(") or not formula.endswith(")"):
        raise ValueError("SCORE公式格式不正确，应以SCORE(开头并以)结尾")

    # 提取SCORE()括号内的内容
    content = formula[6:-1].strip()

    # 按分号分割不同的位点规则
    rsid_rules = content.split(';')

    total_score = 0

    for rule in rsid_rules:
        rule = rule.strip()
        if not rule:
            continue

        # 分离位点ID和得分规则
        parts = rule.split(':')
        if len(parts) != 2:
            raise ValueError(f"SCORE规则格式不正确: {rule}")

        rsid = parts[0].strip()
        score_rules = parts[1].strip()

        # 缺少位点时不能静默按零分处理，否则会产生虚假的结果
        if rsid not in genotype_dict:
            raise InsufficientGeneticData(f"缺少位点基因型: {rsid}")

        # 获取该位点的基因型
        genotype = genotype_dict[rsid]
        if not genotype:
            raise InsufficientGeneticData(f"位点基因型为空: {rsid}")

        # 解析得分规则
        score_pairs = score_rules.split(',')
        for pair in score_pairs:
            pair = pair.strip()
            if not pair:
                continue

            # 分离基因型和对应得分
            gt_score = pair.split('=')
            if len(gt_score) != 2:
                raise ValueError(f"SCORE基因型规则格式不正确: {pair}")

            gt = gt_score[0].strip()
            try:
                score = float(gt_score[1].strip())
            except ValueError:
                raise ValueError(f"SCORE分数不是数字: {pair}")

            # 如果基因型匹配，累加得分
            if gt == genotype:
                total_score += score
                break  # 找到匹配的基因型后，不再检查该位点的其他规则
        else:
            raise InsufficientGeneticData(
                f"位点基因型没有匹配规则: {rsid}={genotype}"
            )

    return total_score

def _parse_if_formula(formula, genotype_dict):
    """
    解析IF公式并返回布尔结果

    :param formula: 公式字符串，如 "IF(rs4988235:CT=true,CC=false,TT=true)"
    :param genotype_dict: 包含位点对应结果的字典，如 {'rs4988235': 'CT'}
    :return: 布尔值结果
    """
    # 检查公式是否以IF开头
    if not formula.startswith("IF(") or not formula.endswith(")"):
        raise ValueError("IF公式格式不正确，应以IF(开头并以)结尾")

    # 提取IF()括号内的内容
    content = formula[3:-1].strip()

    # 按分号分割不同的位点规则
    rsid_rules = content.split(';')

    # 对每个规则进行逻辑与操作，所有规则都为真时结果为真
    for rule in rsid_rules:
        rule = rule.strip()
        if not rule:
            continue

        # 分离位点ID和条件规则
        parts = rule.split(':')
        if len(parts) != 2:
            raise ValueError(f"IF规则格式不正确: {rule}")

        rsid = parts[0].strip()
        condition_rules = parts[1].strip()

        # 缺少位点时不能把整个 AND 表达式当成真
        if rsid not in genotype_dict:
            raise InsufficientGeneticData(f"缺少位点基因型: {rsid}")

        # 获取该位点的基因型
        genotype = genotype_dict[rsid]
        if not genotype:
            raise InsufficientGeneticData(f"位点基因型为空: {rsid}")

        # 解析条件规则
        condition_pairs = condition_rules.split(',')
        rule_result = False  # 默认该规则为假
        matched = False

        for pair in condition_pairs:
            pair = pair.strip()
            if not pair:
                continue

            # 分离基因型和对应条件
            gt_condition = pair.split('=')
            if len(gt_condition) != 2:
                raise ValueError(f"IF基因型规则格式不正确: {pair}")

            gt = gt_condition[0].strip()
            condition_str = gt_condition[1].strip().lower()

            # 将字符串转换为布尔值
            if condition_str == 'true':
                condition = True
            elif condition_str == 'false':
                condition = False
            else:
                raise ValueError(f"IF条件不是布尔值: {pair}")

            # 如果基因型匹配，获取条件结果
            if gt == genotype:
                matched = True
                rule_result = condition
                break  # 找到匹配的基因型后，不再检查该位点的其他规则

        if not matched:
            raise InsufficientGeneticData(
                f"位点基因型没有匹配规则: {rsid}={genotype}"
            )

        # 如果任一规则为假，整个结果为假（逻辑与）
        if not rule_result:
            return False

    if not any(rule.strip() for rule in rsid_rules):
        raise ValueError("IF公式不包含有效规则")

    # 所有规则都为真，结果为真
    return True

def _parse_combined_formula(formula, genotype_dict):
    """
    解析组合公式（IF...ELSE结构）

    :param formula: 公式字符串，如 "IF(rs4988235:CT=true){SCORE(rs182549:CT=5,CC=0,TT=10)}ELSE{SCORE(rs182549:CT=0,CC=0,TT=5)}"
    :param genotype_dict: 包含位点对应结果的字典，如 {'rs4988235': 'CT'}
    :return: 根据条件计算得到的结果
    """
    # 提取IF条件部分
    if_end_index = formula.find('{')
    if if_end_index == -1:
        raise ValueError("组合公式格式不正确，缺少{")

    if_condition = formula[:if_end_index]

    # 提取IF为真时执行的公式
    true_start_index = if_end_index + 1
    true_end_index = _find_matching_brace(formula, true_start_index)
    if true_end_index == -1:
        raise ValueError("组合公式格式不正确，缺少匹配的}")

    true_formula = formula[true_start_index:true_end_index]

    # 检查是否有ELSE部分
    else_formula = None
    if true_end_index + 1 < len(formula) and formula[true_end_index+1:].strip().startswith("ELSE{"):
        else_start_index = formula.find('{', true_end_index) + 1
        else_end_index = _find_matching_brace(formula, else_start_index)
        if else_end_index == -1:
            raise ValueError("组合公式格式不正确，ELSE部分缺少匹配的}")

        else_formula = formula[else_start_index:else_end_index]

    # 计算IF条件
    condition_result = _parse_if_formula(if_condition, genotype_dict)

    # 根据条件结果执行相应的公式
    if condition_result:
        return parse_formula(true_formula, genotype_dict)
    elif else_formula is not None:
        return parse_formula(else_formula, genotype_dict)
    else:
        return 0  # 如果条件为假且没有ELSE部分，返回0

def _find_matching_brace(text, start_index):
    """
    查找匹配的右花括号

    :param text: 文本字符串
    :param start_index: 左花括号后的起始索引
    :return: 匹配的右花括号索引，如果没有找到则返回-1
    """
    count = 1  # 已经找到一个左花括号
    for i in range(start_index, len(text)):
        if text[i] == '{':
            count += 1
        elif text[i] == '}':
            count -= 1
            if count == 0:
                return i
    return -1

# 获取当前特征表结果
def result_trait_data(report_id, db_path):
    # 将特征表处理为一个字典格式
    # 连接到SQLite数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 查询数据
    cursor.execute('''
    SELECT * FROM traits
    ''')
    rows = cursor.fetchall()

    # 关闭连接
    conn.close()

    # 转换为字典格式
    traits = []
    for row in rows:
        print(row)
        try:
            # 使用ast.literal_eval更安全地解析字符串字典
            name_dict = json.loads(row[1])
            description_dict = json.loads(row[2])
            score_thresholds_dict = json.loads(row[10])
            result_dict = json.loads(row[11])

            trait = {
                'id': row[0],
                'name': name_dict,
                'description': description_dict,
                'icon': row[3],
                'confidence': row[4],
                'isDefault': bool(row[5]),
                'createdAt': row[6],
                'category': row[7],
                'rsids': row[8].split(';') if row[8] else [],
                'formula': row[9],
                'scoreThresholds': score_thresholds_dict,
                'result': result_dict,
                'reference': row[12].split(';') if row[12] else []
            }
            evidence_rule = _load_trait_evidence_catalog().get(trait['id'])
            if evidence_rule:
                trait['evidenceStatus'] = evidence_rule.get('status')
                trait['evidenceGrade'] = evidence_rule.get('evidence_grade')
                trait['evidence'] = evidence_rule.get('evidence', [])
                trait['limitations'] = evidence_rule.get('limitations', [])
                trait['reviewBlockers'] = evidence_rule.get('review_blockers', [])
                # Reviewed references supersede legacy placeholders in the DB.
                trait['reference'] = [
                    item['id']
                    for item in evidence_rule.get('evidence', [])
                    if item.get('type') == 'PMID' and item.get('id')
                ]
            else:
                trait['reference'] = [
                    reference
                    for reference in trait['reference']
                    if reference not in {'11111111', '222222222', '333333333'}
                ]
            traits.append(trait)
        except (ValueError, SyntaxError) as e:
            print(f"解析数据时出错: {e}")
            print(f"出错的行数据: {row}")
            continue

    # 聚合所有的rsid，先查询
    rsids = []
    for item in traits:
        rsids.extend(item['rsids'])
    rsids = list(set(rsids))
    rsid_result = get_snp_info_by_rsid(rsids, report_id, db_path, True)
    rsid_gt_result = {}
    for i in rsid_result:
        rsid_gt_result[i] = rsid_result[i][1]

    for item in traits:
        # 保持位点和用户基因型对齐，即使该规则因缺失数据无法计算。
        declared_rsids = list(item['rsids'])
        item['rsids'] = declared_rsids
        item['referenceGenotypes'] = [
            rsid_result[rsid][0] if rsid in rsid_result else None
            for rsid in declared_rsids
        ]
        item['yourGenotypes'] = [
            rsid_result[rsid][1] if rsid in rsid_result else None
            for rsid in declared_rsids
        ]

        # A formula copied from an unreviewed/generated rule must not be
        # presented as a biological interpretation. Keep the genotype data
        # visible for audit, but withhold the calculated result until the
        # evidence catalog promotes the rule to curated/partial_evidence.
        evidence_status = item.get('evidenceStatus')
        if evidence_status in {'partial_evidence', 'review_required', 'do_not_import_unknown_formula'}:
            item['result_current'] = None
            item['evaluationStatus'] = 'review_required'
            continue

        # 计算得分或布尔值；缺少位点时明确返回不可用，不能静默给出结果
        try:
            score_or_bool = parse_formula(item['formula'], rsid_gt_result)
        except InsufficientGeneticData:
            item['result_current'] = None
            item['evaluationStatus'] = 'insufficient_data'
            continue
        except (TypeError, ValueError):
            item['result_current'] = None
            item['evaluationStatus'] = 'invalid_rule'
            continue

        item['evaluationStatus'] = 'ok'
        scoreThresholds = item['scoreThresholds']

        # 判断是得分还是布尔值
        result_key = None
        if isinstance(score_or_bool, bool):
            # 如果是布尔值，根据布尔值和阈值判断结果
            for threshold in scoreThresholds:
                if score_or_bool == scoreThresholds[threshold]:
                    result_key = threshold
                    break
        elif isinstance(score_or_bool, (int, float)):
            # 如果是得分，根据得分和阈值判断结果
            for threshold in scoreThresholds:
                if score_or_bool >= scoreThresholds[threshold]:
                    result_key = threshold
                    break

        # 根据结果键值获得结果
        if result_key is None:
            result = None
        else:
            result = item['result'].get(result_key, None)
        item['result_current'] = result

    return traits

