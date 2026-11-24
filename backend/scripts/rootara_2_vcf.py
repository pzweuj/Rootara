# coding=utf-8
# pzw
# 20250423
# 用于把rootara生成的csv结果文件转换为vcf格式
# 仅保留SNP
# vcf文件用于单倍群计算

import sys
import csv
import pysam
import argparse

def trans_rootara_to_vcf(rootara_csv, vcf_file):
    # 首先生成临时VCF文件
    if vcf_file.endswith('.vcf.gz'):
        vcf_file = vcf_file.replace('.vcf.gz', '.vcf')

    temp_vcf = vcf_file.replace('.vcf', '_temp.vcf')
    with open(temp_vcf, 'w', encoding='utf-8') as f:
        f.write('##fileformat=VCFv4.2\n')
        f.write('##source=rootara\n')
        f.write('##reference=GRCh37\n')
        f.write('#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tRootara\n')

        with open(rootara_csv, newline="", encoding="utf-8") as source:
            for row in csv.DictReader(source):
                if row["Check"] == "WT" or row["Genotype"] in {"DD","II","DI","ID","--"}:
                    continue
                gt = {"HET": "0/1", "HOM": "1/1"}.get(row["Check"], "0/0")
                f.write(f"{row['Chrom']}\t{row['Start']}\t.\t{row['Ref']}\t{row['Alt']}\t.\tPASS\t.\tGT\t{gt}\n")

    # 使用pysam将VCF压缩为vcf.gz并创建索引
    pysam.tabix_compress(temp_vcf, vcf_file + '.gz', force=True)
    pysam.tabix_index(vcf_file + '.gz', preset='vcf', force=True)
    
    # 删除临时文件
    import os
    os.remove(temp_vcf)

def main():
    parser = argparse.ArgumentParser(description='转换CSV结果到VCF')
    parser.add_argument('--input', type=str, help='输入CSV文件')
    parser.add_argument('--output', type=str, help='输出VCF.gz文件')
    args = parser.parse_args()

    # 检查是否提供了所有必需参数
    if not all([args.input, args.output]):
        parser.print_help()
        sys.exit(1)

    trans_rootara_to_vcf(args.input, args.output)

if __name__ == '__main__':
    main()
