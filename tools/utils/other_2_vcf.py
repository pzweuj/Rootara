# coding=utf-8
# pzw
# 20250207
# 根据rootara核心库，将第三方结果转换为vcf格式

import os
import sys
import argparse
import pysam
import pandas as pd

# 读取文件，所有以此格式建立的文件理论都可读
def read_rsid_report(input_file):
    df = pd.read_csv(input_file, sep='\t', comment='#', header=None, names=['rsid', 'chromosome', 'position', 'genotype'], low_memory=False, skiprows=lambda x: x > 0 and str(x).startswith('rsid'))
    # 过滤掉无效的行（例如，染色体为0的行）
    df = df[df['chromosome'] != '0']
    # 将染色体名称转换为VCF格式（例如，'23' -> 'X', '24' -> 'Y', '25' -> 'MT'）
    df['chromosome'] = df['chromosome'].replace({'23': 'X', '24': 'Y', '25': 'MT'})
    df.loc[:, 'chromosome'] = df["chromosome"].str.replace("chr", "")
    df = df[df["genotype"] != "--"]

    # 使用pandas的apply方法替代循环
    df['variant_id'] = df.apply(lambda row: row['rsid'] if row['rsid'].startswith('rs') else f"rti_{row['chromosome']}_{row['position']}", axis=1)
    
    # 直接创建字典
    variant_dict = dict(zip(df['variant_id'], df['genotype']))
    return variant_dict

# ref/alt的判断方案
def ref_alt_get(input_genotype, chrom, ref, alt):
    check_variant = True

    if len(ref) > len(alt):
        ref = "I"
        alt = "D"
    elif len(ref) < len(alt):
        ref = "D"
        alt = "I"

    output_genotype = "./."
    ref_sum = input_genotype.count(ref)
    if ref_sum == 2:
        output_genotype = "0/0"
    elif ref_sum == 1:
        output_genotype = "0/1"
    elif ref_sum == 0:
        output_genotype = "1/1"

    # 线粒体和Y
    if chrom in ["MT", "Y"]:
        if len(input_genotype) == 1:
            if ref_sum == 1:
                output_genotype = "0"
            elif ref_sum == 0:
                output_genotype = "1"
    
    # 需要确认alt是否一致
    if output_genotype in ["0/1", "1/1"]:
        if input_genotype[1] != alt:
            check_variant = False

    return output_genotype, check_variant

# 遍历数据库
def read_rootara_core_and_write(db_file, output_vcf, input_dict):
    n = 0
    input_sum = len(input_dict)
    with pysam.TabixFile(db_file, encoding='utf-8') as file, open(output_vcf, "w", encoding="utf-8") as vcf:
        # 先写入header
        for header_line in file.header:
            if header_line.startswith("#CHROM"):
                vcf.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSAMPLE\n")
            else:
                vcf.write(header_line + "\n")
        
        # 读取数据行
        for line in file.fetch():
            line_split = line.strip().split("\t")
            id = line_split[2]
            genotype = input_dict.get(id, "--")

            # genotype是 -- ，可能是id无法匹配，需要使用坐标进行匹配 | 忽略掉rs类型的id
            if genotype == "--":
                check_id = "rti_" + line_split[0] + "_" + line_split[1]
                genotype = input_dict.get(check_id, "--")

            if genotype == "--":
                continue
            
            chrom = line_split[0]
            ref = line_split[3]
            alt = line_split[4]
            output_genotype, check_variant = ref_alt_get(genotype, chrom, ref, alt)
            if not check_variant:
                continue
            
            n += 1
            line_split.append("RAW=" + genotype)
            line_split.append(output_genotype)
            vcf.write("\t".join(line_split) + "\n")
    
    print("[Done] efficiency: ", "%.2f" % (n / input_sum * 100) + "%")

# 总流程
def convert_other_to_vcf(input_file, output_vcf_gz, db_file):
    output_vcf_gz = os.path.abspath(output_vcf_gz)
    output_vcf = output_vcf_gz.replace(".gz", "")
    input_dict = read_rsid_report(input_file)
    print("[Process] read data done!")    
    read_rootara_core_and_write(db_file, output_vcf, input_dict)

    # 清理临时文件
    pysam.tabix_compress(output_vcf, output_vcf_gz, force=True)
    pysam.tabix_index(output_vcf_gz, preset="vcf", force=True)
    os.remove(output_vcf)

# 
def other2VcfMain():
    parser = argparse.ArgumentParser(
        usage = "python3 other_2_vcf.py -i <txt file> -o <vcf file> -r <reference>",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("-i", "--input", type=str, help="rootara format")
    parser.add_argument("-o", "--output", type=str, help="vcf.gz format")
    parser.add_argument("-r", "--reference", type=str, help="reference.vcf.gz")

    if len(sys.argv[1:]) == 0:
        parser.print_help()
        parser.exit()
    
    args = parser.parse_args()
    input = args.input
    output = args.output
    reference = args.reference
    convert_other_to_vcf(input, output, reference)

if __name__ == "__main__":
    other2VcfMain()

# end
