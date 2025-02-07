# coding=utf-8
# pzw
# 20250207
# 分析尼人位点数目和比例
# https://github.com/AprilWei001/NIM/blob/main/SupplementData/Data%20S8.txt
"""
下载好该列表后，与Rootara核心库取交集，获得Rootara库能覆盖的尼人位点
这个列表的位点太少了，正式版本中需要找另外的尼人位点列表

awk 'BEGIN {OFS=" "} !/^#/ {print $1"\t"$2-1"\t"$2}' Data%20S8.txt > output.bed
bedtools intersect -a Rootara.grch37.core.vcf.gz -b output.bed -header > Rootara.grch37.neanderthal.vcf
"""

import os
import sys
import argparse
import pandas as pd

def pre_data(input_vcf, output_tmp_file, db):
    bedtools = "bedtools"
    cmd = f"""
        {bedtools} intersect -a {input_vcf} -b {db} | uniq > {output_tmp_file}
    """
    os.system(cmd)
    header = ["chrom", "pos", "id", "ref", "alt", "qual", "filter", "info", "format", "sample"]
    df = pd.read_csv(output_tmp_file, sep="\t", names=header, low_memory=False)
    
    # 提取GT信息
    gt_list = []
    for index, row in df.iterrows():
        # 分割format和sample列
        format_fields = row['format'].split(':')
        sample_fields = row['sample'].split(':')
        
        # 找到GT在format中的位置
        gt_index = format_fields.index('GT')
        
        # 获取对应的GT值
        gt_value = sample_fields[gt_index]
        gt_list.append(gt_value)
    
    n = 0
    m = 1
    for gt in gt_list:
        for gt_sub in gt.split("/"):
            if gt_sub == "1":
                n += 1
            m += 1
    
    nean_pre = "%.2f" % (n / m * 100) + "%"
    return nean_pre

def nean_pipe(input_vcf, output_file, db):
    output_file = os.path.abspath(output_file)
    tmp_file = output_file + ".tmp.txt"
    nean_pre = pre_data(input_vcf, tmp_file, db)
    os.remove(tmp_file)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("# neanderthal_percentage:\t" + nean_pre + "\n")
    
def neanMain():
    parser = argparse.ArgumentParser(
        usage = "python3 neanderthal.py -i <vcf file> -o <txt file> -r <reference>",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("-i", "--input", type=str, help="vcf file")
    parser.add_argument("-o", "--output", type=str, help="txt file")
    parser.add_argument("-r", "--reference", type=str, help="reference.vcf.gz")

    if len(sys.argv[1:]) == 0:
        parser.print_help()
        parser.exit()
    
    args = parser.parse_args()
    input = args.input
    output = args.output
    reference = args.reference
    nean_pipe(input, output, reference)

if __name__ == "__main__":
    neanMain()

