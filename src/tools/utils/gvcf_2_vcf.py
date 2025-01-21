# coding=utf-8
# pzw
# 20250121
# gvcf转为vcf格式
# 注，由于gvcf文件巨大，会转换出两个文件
# 1，核心区，包含wegene和23andme并集的所有位点
# 2，突变区，包含突变位点
# 为提高效率，使用bcftools

import os
import sys
import argparse
import gzip

# bcftools路径
BCFTOOLS = "bcftools"

def extract_variants(gvcf_file, output_vcf):
    """提取 gVCF 文件中的突变位点。"""
    print("Extracting variant sites...")
    command = f"{BCFTOOLS} view -i 'FILTER=\"PASS\"' {gvcf_file} -Oz -o {output_vcf}"
    os.system(command)
    command = f"{BCFTOOLS} index {output_vcf}"
    os.system(command)
    print(f"Variant sites saved to {output_vcf}")

def extract_wildtype_sites(gvcf_file, bed_file, output_vcf):
    """提取 BED 区域内的野生型位点。"""
    print("Extracting wildtype sites in BED regions...")
    
    # 使用管道合并两个命令，直接提取bed区域并过滤
    command = f"{BCFTOOLS} view -R {bed_file} {gvcf_file} | " \
              f"{BCFTOOLS} view -i 'FILTER!=\"PASS\" && FORMAT/GT=\"0/0\"' | " \
              f"{BCFTOOLS} norm -d all -Oz -o {output_vcf}"
    os.system(command)
    command = f"{BCFTOOLS} index {output_vcf}"
    os.system(command)
    print(f"Wildtype sites saved to {output_vcf}")

def merge_vcfs(variant_vcf, wildtype_vcf, output_vcf):
    """合并突变位点和野生型位点。"""
    print("Merging variant and wildtype sites...")
    command = f"{BCFTOOLS} concat -a {variant_vcf} {wildtype_vcf} -Oz -o {output_vcf}"
    os.system(command)
    print(f"Merged VCF saved to {output_vcf}")

def gvcf_to_vcf(input_gvcf, core_bed, output_vcf):
    """
    将gvcf文件转换为两个vcf文件
    :param input_gvcf: 输入的gvcf文件路径
    :param core_bed: 核心区bed文件路径
    :param output_prefix: 输出文件前缀
    """
    # bcftools
    varaint_vcf = output_vcf.replace(".vcf", ".variant.vcf")
    extract_variants(input_gvcf, varaint_vcf)

    wild_type_vcf = output_vcf.replace(".vcf", ".wild_type.vcf")
    extract_wildtype_sites(input_gvcf, core_bed, wild_type_vcf)
    merge_vcfs(varaint_vcf, wild_type_vcf, output_vcf)
    
    # 清理临时文件
    os.remove(varaint_vcf)
    os.remove(varaint_vcf + ".csi")    
    os.remove(wild_type_vcf)
    os.remove(wild_type_vcf + ".csi")

def process_vcf(input_vcf, output_vcf):
    with gzip.open(input_vcf, "rt") as infile, gzip.open(output_vcf, "wt") as outfile:
        for line in infile:
            if line.startswith("#"):  # 保留注释行
                outfile.write(line)
                continue
            
            # 解析数据行
            parts = line.strip().split("\t")
            chrom, pos, id_, ref, alt, qual, filter_, info, format_, *samples = parts
            
            # 处理 ALT 字段
            if "<*>" in alt or "<NON_REF>" in alt:
                # 获取基因型（假设基因型在 FORMAT 字段的第一个位置）
                sample = samples[0]  # 假设只有一个样本
                format_fields = format_.split(":")
                gt_index = format_fields.index("GT")  # 找到 GT 字段的索引
                gt = sample.split(":")[gt_index]  # 提取基因型
                
                if gt == "0/0":  # 基因型是 0/0
                    alt = ref  # 将 ALT 替换为 REF
                else:  # 基因型不是 0/0
                    alt = alt.replace(",<*>", "").replace(",<NON_REF>", "")  # 去掉 ,<*> 或 ,<NON_REF>
                
                parts[4] = alt  # 更新 ALT 字段
            
            # 写入处理后的行
            outfile.write("\t".join(parts) + "\n")

def gvcf2VcfMain():
    parser = argparse.ArgumentParser(
        usage = "python3 gvcf_2_vcf.py -i <gvcf file> -o <output vcf> -b <core bed>",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("-i", "--input", type=str, help="gvcf format, gvcf.gz")
    parser.add_argument("-o", "--output", type=str, help="output vcf.gz")
    parser.add_argument("-b", "--bed", type=str, help="core bed")

    if len(sys.argv[1:]) == 0:
        parser.print_help()
        parser.exit()
    
    args = parser.parse_args()
    input = args.input
    output = args.output
    bed = args.bed
    gvcf_to_vcf(input, bed, output.replace(".vcf", ".pre.vcf"))
    process_vcf(output.replace(".vcf.gz", ".pre.vcf.gz"), output)
    os.remove(output.replace(".vcf.gz", ".pre.vcf.gz"))

if __name__ == "__main__":
    gvcf2VcfMain()

# end
