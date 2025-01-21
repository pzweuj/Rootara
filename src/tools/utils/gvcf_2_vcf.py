# coding=utf-8
# pzw
# 20250121
# gvcf转为vcf格式
# 注，由于gvcf文件巨大，会转换出两个文件
# 1，核心区，包含wegene和23andme并集的所有位点
# 2，突变区，包含突变位点

import pysam
import gzip
import sys
import argparse

def gvcf_to_vcf(input_gvcf, core_bed, output_vcf):
    """
    将gvcf文件转换为两个vcf文件
    :param input_gvcf: 输入的gvcf文件路径
    :param core_bed: 核心区bed文件路径
    :param output_prefix: 输出文件前缀
    """

    # 打开输入文件
    vcf_in = pysam.VariantFile(input_gvcf)
    
    # 创建输出文件
    core_out = pysam.VariantFile(output_vcf, 'w', header=vcf_in.header)

    # 读取核心区bed文件
    core_regions = []
    open_func = gzip.open if core_bed.endswith('.gz') else open
    with open_func(core_bed, "rt") as f:
        for line in f:
            try:
                chrom, start, end = line.strip().split()[:3]
                core_regions.append((chrom, int(start), int(end)))
            except Exception as e:
                print("[Warning]", e)
                continue

    # 处理每个variant
    for record in vcf_in:
        # 检查是否在核心区
        in_core = any(
            region[0] == record.chrom and 
            region[1] <= record.pos <= region[2]
            for region in core_regions
        )

        # 如果是核心区变异
        if in_core:
            core_out.write(record)
        
        # 如果是突变（非参考基因型）
        elif any(sample["GT"] != (0, 0) for sample in record.samples.values()):
            core_out.write(record)
        
        else:
            continue

    # 关闭文件
    vcf_in.close()
    core_out.close()

def gvcf2VcfMain():
    parser = argparse.ArgumentParser(
        usage = "python3 gvcf_2_vcf.py -i <gvcf file> -o <output vcf> -b <core bed>",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("-i", "--input", type=str, help="gvcf format")
    parser.add_argument("-o", "--output", type=str, help="output vcf")
    parser.add_argument("-b", "--bed", type=str, help="core bed")

    if len(sys.argv[1:]) == 0:
        parser.print_help()
        parser.exit()
    
    args = parser.parse_args()
    input = args.input
    output = args.output
    bed = args.bed
    gvcf_to_vcf(input, bed, output)

if __name__ == "__main__":
    gvcf2VcfMain

# end
