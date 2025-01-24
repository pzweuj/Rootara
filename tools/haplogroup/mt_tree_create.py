# coding=utf-8
# pzw
# 20250124
# 解析从https://www.phylotree.org/获得
# https://www.phylotree.org/rCRS-oriented_version.htm 到 json
# 这个html就是一层一层画画出来的，因此按顺序来找就好
# 最终形成的json格式介绍
"""
每个节点中包含mutations和他的子节点，只要判断名称不是mutations的，就是他的子节点
"L0": {
    "mutations": [
        "0",
        "@263",
        "1048",
        "3516A",
        "5442",
        "6185",
        "9042",
        "9347",
        "10589",
        "12007",
        "12720"
    ],
    "L0a'b'f'g'k": {
        "mutations": [
            "0a",
            "189",
            "4586",
            "9818",
            "16172"
        ]
    }
}
"""

import json

# 不要用bs4了，直接解析
td_list = []
with open("mtDNA_tree.html", "r", encoding='windows-1252') as f:
    begin = False
    node = False
    td_list_child = []
    td_com_sig_tmp = ""
    for line in f:
        # 找到开始点
        if "</span>mt-MRCA" in line:
            begin = True
        
        if not begin:
            continue
        
        # 节点开始
        if " <tr class" in line:
            node = True
        
        if " </tr>" in line:
            node = False
            td_list.append(td_list_child)
            td_list_child = []

        # 解析tr
        if node:
            # <td>
            if "<td" in line:
                td_com_sig_tmp += line.strip()

                # <td></td>
                if "</td>" in line:
                    td_com_sig = td_com_sig_tmp
                    td_com_sig_tmp = ""
                    td_list_child.append(td_com_sig)

            # </td>
            elif "</td>" in line:
                td_com_sig_tmp += line.strip()
                td_com_sig = td_com_sig_tmp
                td_list_child.append(td_com_sig)
                td_com_sig_tmp = ""

            else:
                td_com_sig_tmp += line.strip()


# 解析td列表
def td_list_parse(child_list):
    mutations = []
    level = 0
    node_name = ""
    mut_sig = None
    for c in child_list:
        # print(c)
        if "&nbsp;" in c:
            level += 1
        elif "</span>" in c:
            level = level - 1
            break
        else:
            node_name = c.split(">")[1].split("<")[0]
            # 特例
            if ">L0<" in c:
                node_name = "L0"
            
            if ">L1'2'3'4'5'6<" in c:
                node_name = "L1'2'3'4'5'6"

            break

    for c in child_list:
        if "</span>" in c:
            mut_sig = c
            break
    
    if mut_sig:
        for j in mut_sig.split("</span>")[1:-1]:
            mut = j.split("<span")[0].strip()
            if not "\xa0" in mut:
                mutations.append(mut)

    return level, node_name, mutations



# print(td_list_parse(td_list[2]))

# 记录当前等级的节点
current_level_node = {}
mt_tree_dict = {}
n = 1
for i in td_list:
    level, node_name, mutations = td_list_parse(i)

    if level == 25 and len(mutations) == 0:
        continue

    if node_name == "":
        node_name = current_level_node.get(level - 1, "") + "_uk_" + str(n)
        n += 1

    # 按列表顺序进行填充
    current_level_node[level] = node_name
    # print(current_level_node)
    if level == 0:
        mt_tree_dict[node_name] = {"mutations": mutations}
    else:
        # 递归查找父节点
        parent = mt_tree_dict
        for l in range(0, level):
                parent = parent[current_level_node[l]]

        # 添加当前节点
        parent[node_name] = {"mutations": mutations}


def save_to_json(data, filename):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

save_to_json(mt_tree_dict, "mt_tree.json")

