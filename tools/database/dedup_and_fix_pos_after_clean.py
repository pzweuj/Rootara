# coding=utf-8
# pzw
# 20250207
# 对清理后的数据库进行二次清理
# 去重，调整位点的坐标

import sys
from collections import defaultdict

def parse_csq(csq: str, print_err=False):
    """
    从CSQ标签中提取chrom, pos, ref, alt
    改进版本：增加格式检查和错误处理
    """
    # 检查CSQ格式
    if not csq or '|' not in csq:
        if print_err:
            print(f"[WARNING] Invalid CSQ format: {csq}")
        return []
    
    # 提取第一部分：1_2160485_TCCGACCGC/-
    first_part = csq.split('|')[0]
    if print_err:
        print(first_part)
    
    # 检查第一部分格式
    if not first_part or '_' not in first_part:
        if print_err:
            print(f"[WARNING] Invalid first part format: {first_part}")
        return []
    
    # 拆分chrom, pos, ref_alt
    try:
        chrom, pos, ref_alt = first_part.split('_')
        if print_err:
            print(chrom, pos, ref_alt)
        if not chrom or not pos or not ref_alt:
            if print_err:
                print(f"[WARNING] Missing required fields in: {first_part}")
            return []
    except Exception as e:
        if print_err:
            print(f"[ERROR] Failed to split first part: {first_part}, error: {e}")
        return []
    
    # 检查ref_alt格式
    if '/' not in ref_alt:
        if print_err:
            print(f"[WARNING] Invalid ref_alt format: {ref_alt}")
        return []
    
    # 拆分ref和alt
    try:
        ref, alt = ref_alt.split('/')[0:2]
        if print_err:
            print(ref, alt)
        if not ref or not alt:
            if print_err:
                print(f"[WARNING] Missing ref or alt in: {ref_alt}")
            return []
    except Exception as e:
        if print_err:
            print(f"[ERROR] Failed to split ref_alt: {ref_alt}, error: {e}")
        return []
    
    # 清理掉所有没有注释出HGVSg的记录，这些记录的参考碱基是错误的
    # try:
    if print_err:
        print(csq)
    hgvsg = csq.split('|')[16]
    if hgvsg == "":
        if print_err:
            print("[WARNING] hgvsg missing, hgvsg: ", hgvsg)
        return []
    # else:
    #     print(hgvsg)
    # except:
    #     print("[WARNING] CSQ missing")
    #     return []
    
    return chrom, int(pos), ref, alt

def process_vcf(input_file: str, output_file: str):
    """
    处理VCF文件，去重并修正位置
    """
    seen = defaultdict(set)
    with open(input_file, 'r') as infile, open(output_file, 'w') as outfile:
        for line in infile:
            # 处理header
            if line.startswith('#'):
                outfile.write(line)
                continue
            
            # 处理数据行
            fields = line.strip().split('\t')
            info = fields[7]

            # 监控特例
            check = False
            if line.strip().split("\t")[2] == "rs10907177":
                check = True
                print(line)

            # 提取CSQ
            csq = [x.split('CSQ=')[1] for x in info.split(';') if x.startswith('CSQ=')][0]
            # 解析CSQ
            try:
                chrom, pos, ref, alt = parse_csq(csq, check)
            except Exception as e:
                if check:
                    print("[ERROR]", e)
                continue
            
            # 去掉ref或alt中存在N的记录
            if 'N' in ref:
                continue
            if 'N' in alt:
                continue
    
            # 检查是否重复
            key = (chrom, pos, ref, alt)
            if key in seen:
                continue
            seen[key].add(1)
            
            # 更新POS、REF和ALT字段
            fields[1] = str(pos)  # 更新POS
            fields[3] = ref       # 更新REF
            fields[4] = alt       # 更新ALT
            outfile.write('\t'.join(fields) + '\n')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python dedup_and_fix_pos_after_clean.py <input.vcf> <output.vcf>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    process_vcf(input_file, output_file)





