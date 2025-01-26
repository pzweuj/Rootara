# coding=utf-8
# pzw
# 20250126
# 创建单倍群树json
# 降低计算量，使用haploGrouper（https://gitlab.com/bio_anth_decode/haploGrouper）
# 使用haploGrouper的json文件，创建单倍群树
# https://gitlab.com/bio_anth_decode/haploGrouper/-/blob/master/data/chrMT_phylotree17_tree.txt
# https://gitlab.com/bio_anth_decode/haploGrouper/-/blob/master/data/chrY_isogg2019_tree.txt

import json

def txt_to_json(input_file, output_file, root_name):
    # 读取文件并构建父子关系字典
    parent_child_map = {}
    with open(input_file, 'r') as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) < 2:  # 跳过不完整的行
                continue
            child, parent = parts[0], parts[1]
            if parent not in parent_child_map:
                parent_child_map[parent] = []
            parent_child_map[parent].append(child)

    # 递归构建嵌套结构
    def build_tree(node):
        if node not in parent_child_map:
            return {"name": node}
        return {
            "name": node,
            "children": [build_tree(child) for child in parent_child_map[node]]
        }

    # 从根节点开始构建树
    root = root_name  # 根据你的文件，根节点是YRoot
    tree = build_tree(root)

    # 保存为JSON文件
    with open(output_file, 'w') as f:
        json.dump(tree, f, indent=2)

def txt_to_simple_json(input_file, output_file, root_name):
    # 读取文件并构建父子关系字典
    parent_child_map = {}
    with open(input_file, 'r') as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) < 2:  # 跳过不完整的行
                continue
            child, parent = parts[0], parts[1]
            if parent not in parent_child_map:
                parent_child_map[parent] = []
            parent_child_map[parent].append(child)

    # 递归构建简化结构
    def build_simple_tree(node):
        if node not in parent_child_map:
            return {}
        return {
            child: build_simple_tree(child) for child in parent_child_map[node]
        }

    # 从根节点开始构建树
    root = root_name
    tree = {root: build_simple_tree(root)}

    # 保存为JSON文件
    with open(output_file, 'w') as f:
        json.dump(tree, f, indent=2)

# 使用示例
# txt_to_json('chrY_isogg2019_tree.txt', 'y_tree.json', 'YRoot')
txt_to_simple_json('chrY_isogg2019_tree.txt', 'y_tree.json', 'YRoot')
txt_to_simple_json('chrMT_phylotree17_tree.txt', 'mt_tree.json', 'mt-MRCA')








