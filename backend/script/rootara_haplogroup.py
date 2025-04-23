# coding=utf-8
# pzw
# 20250423
# 用于从vcf分析单倍型
# 使用 https://gitlab.com/bio_anth_decode/haploGrouper

import os
import sys
import argparse


def y_haplogroup(vcf_file, output_dir, rpt_id):
    data_dir = '/home/clinic/clinic_backup/software/haploGrouper/data'
    tool = '/home/clinic/clinic_backup/software/haploGrouper/haploGrouper.py'

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    cmd = f"""
        python3 {tool} \\
            -v {vcf_file} \\
            -t {data_dir}/chrY_isogg2019_tree.txt \\
            -l {data_dir}/chrY_isogg2019-decode1_loci_b37.txt \\
            -o {output_dir}/{rpt_id}.YHap.txt
    """

    os.system(cmd)

def mt_haplogroup(vcf_file, output_dir, rpt_id):
    data_dir = '/home/clinic/clinic_backup/software/haploGrouper/data'
    tool = '/home/clinic/clinic_backup/software/haploGrouper/haploGrouper.py'

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    cmd = f"""
        python3 {tool} \\
            -v {vcf_file} \\
            -t {data_dir}/chrMT_phylotree17_tree.txt \\
            -l {data_dir}/chrMT_phylotree17_loci.txt \\
            -o {output_dir}/{rpt_id}.MTHap.txt
    """

    os.system(cmd)

def haplogroup(vcf_file, output_dir, rpt_id, method="Y"):
    if method == "Y":
        y_haplogroup(vcf_file, output_dir, rpt_id)
    elif method == "MT":
        mt_haplogroup(vcf_file, output_dir, rpt_id)
    else:
        print("method not support")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='分析单倍型')
    parser.add_argument('--input', type=str, help='输入VCF文件')
    parser.add_argument('--output', type=str, help='输出文件夹')
    parser.add_argument('--id', type=str, help='报告样本编号')
    parser.add_argument('--method', type=str, choices=['MT', 'Y'], help='单倍群，可选MT/Y，默认为Y', default='Y')
    args = parser.parse_args()

    # 检查是否提供了所有必需参数
    if not all([args.input, args.output, args.id, args.method]):
        parser.print_help()
        sys.exit(1)

    try:
        haplogroup(args.input, args.output, args.id, args.method)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

