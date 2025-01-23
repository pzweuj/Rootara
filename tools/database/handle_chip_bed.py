# coding=utf-8
# pzw
# 20250122
# 对illumina的全球、亚洲、中国SNP芯片bed文件进行处理，取得并集
# 脚本逻辑是合并后去重，形成一个vcf文件
# 后续将对这个vcf进行注释，以此获得芯片通用型注释库

import pandas as pd

def txt_to_vcf(input_txt_path, output_vcf_path):
    # 定义VCF文件头
    vcf_header = """##fileformat=VCFv4.2
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO
"""

    chrom_list = [str(i) for i in range(1, 23)] + ["X", "Y", "MT"]

    # 打开TXT文件并读取内容
    with open(input_txt_path, "r") as txt_file:
        lines = txt_file.readlines()

    # 解析TXT文件并生成VCF内容
    vcf_content = vcf_header
    for line in lines[1:]:  # 跳过表头行
        fields = line.strip().split("\t")
        if len(fields) < 8:
            continue  # 跳过不完整的行

        # 解析字段
        name = "."
        chrom = fields[1]

        if not chrom in chrom_list:
            continue

        pos = fields[2]
        alleles = fields[3].strip("[]").split("/")
        ref = alleles[0]
        alt = alleles[1]

        # 构建INFO字段
        info_str = "."

        # 添加到VCF内容
        vcf_content += f"{chrom}\t{pos}\t{name}\t{ref}\t{alt}\t.\t.\t{info_str}\n"

    # 写入VCF文件
    with open(output_vcf_path, "w") as vcf_file:
        vcf_file.write(vcf_content)

    print(f"VCF文件已生成：{output_vcf_path}")


def merge_vcf_files(vcf_files, output_path):
    """
    合并多个VCF文件并去重
    :param vcf_files: 要合并的VCF文件路径列表
    :param output_path: 输出文件路径
    """
    # 读取所有VCF文件
    dfs = []
    for vcf_file in vcf_files:
        # 读取VCF文件，跳过注释行
        df = pd.read_csv(vcf_file, 
                        comment='#', 
                        sep='\t', 
                        header=None,
                        names=['#CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO'],
                        low_memory=False)
        dfs.append(df)
    
    # 合并所有DataFrame
    merged_df = pd.concat(dfs, ignore_index=True)
    
    # 去重（基于染色体、位置、REF和ALT）
    merged_df.drop_duplicates(subset=['#CHROM', 'POS', 'REF', 'ALT'], inplace=True)
    
    # 排序（先按染色体，再按位置）
    merged_df.sort_values(by=['#CHROM', 'POS'], inplace=True)
    merged_df.loc[:, 'INFO'] = merged_df['INFO'].str.replace('\n', '')
    
    # 写入新的VCF文件
    with open(output_path, 'w') as f:
        # 写入VCF头
        f.write("##fileformat=VCFv4.2\n")
        f.write("##reference=hg19\n")
        f.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n")
        # 写入数据
        merged_df.to_csv(f, sep='\t', index=False, header=False, lineterminator='\n')

    print(f"合并后的VCF文件已生成：{output_path}")


# 使用
txt_to_vcf("illumina_chip_annotated/ASA-24v1-0_A1.hg19.annotated.txt", "ASA.vcf")
txt_to_vcf("illumina_chip_annotated/CGA-24v1-0_A1.hg19.annotated.txt", "CGA.vcf")
txt_to_vcf("illumina_chip_annotated/GSA-24v3-0_A1.hg19.annotated.txt", "GSA.vcf")
merge_vcf_files(["GSA.vcf", "ASA.vcf", "CGA.vcf"], "Rootara.vcf")

# end
