# coding=utf-8
# pzw
# 20250121
# 23andme, wegene等格式转换为vcf.gz

import sys
import pandas as pd
import pysam
import argparse

def convert_other_to_vcf(input_file, output_file, reference_vcf):
    # 读取23andMe数据文件
    df = pd.read_csv(input_file, sep='\t', comment='#', header=None, names=['rsid', 'chromosome', 'position', 'genotype'], low_memory=False)

    # 过滤掉无效的行（例如，染色体为0的行）
    df = df[df['chromosome'] != '0']

    # 将染色体名称转换为VCF格式（例如，'23' -> 'X', '24' -> 'Y', '25' -> 'MT'）
    df['chromosome'] = df['chromosome'].replace({'23': 'X', '24': 'Y', '25': 'MT'})

    # 打开参考VCF文件
    vcf_ref = pysam.VariantFile(reference_vcf)
    valid_chroms = set(vcf_ref.header.contigs)

    # 定义需要保留的染色体（排除小染色体）
    # 这里假设你只需要1-22, X, Y, MT染色体
    valid_main_chroms = {str(c) for c in range(1, 23)} | {'X', 'Y', 'MT'}
    if any(c.startswith('chr') for c in valid_chroms):
        valid_main_chroms = {f'chr{c}' for c in valid_main_chroms}

    # 检查参考基因组是否使用"chr"前缀
    has_chr_prefix = any(c.startswith('chr') for c in valid_chroms)

    # 转换染色体名称格式
    def format_chrom(chrom):
        chrom = str(chrom)
        # 处理MT染色体
        if chrom.upper() in ['MT', 'M']:
            return 'chrM' if has_chr_prefix else 'MT'
        # 处理X/Y染色体
        if chrom.upper() in ['X', 'Y']:
            return f'chr{chrom}' if has_chr_prefix else chrom
        # 处理数字染色体
        if chrom.isdigit():
            return f'chr{chrom}' if has_chr_prefix else chrom
        # 处理其他情况
        if chrom.startswith('chr'):
            return chrom if has_chr_prefix else chrom[3:]
        return chrom
    
    df['chromosome'] = df['chromosome'].apply(format_chrom)
    # 过滤掉不需要的小染色体
    df = df[df['chromosome'].isin(valid_main_chroms)]

    # 创建VCF文件头
    vcf_header = pysam.VariantHeader()
    vcf_header.add_line('##fileformat=VCFv4.2')
    vcf_header.add_line(f'##reference={reference_vcf}')

    def natural_sort_key(chrom):
        # 处理带chr前缀的情况
        if chrom.startswith('chr'):
            chrom = chrom[3:]
        
        # 特殊染色体的排序权重
        special_chroms = {
            'X': 23,
            'Y': 24,
            'MT': 25,
            'M': 25
        }
        
        # 如果是特殊染色体
        if chrom.upper() in special_chroms:
            return (special_chroms[chrom.upper()],)
        
        # 如果是数字染色体
        if chrom.isdigit():
            return (int(chrom),)
            
        # 其他情况按字符串排序
        return (26, chrom)
    
    sorted_chroms = sorted(valid_main_chroms, key=natural_sort_key)
    vcf_header.add_line('##INFO=<ID=RAW,Number=1,Type=String,Description="Raw Genotype">')
    vcf_header.add_line('##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">')
    # 动态添加contig信息
    for chrom in sorted_chroms:
        vcf_header.add_line(f'##contig=<ID={chrom}>')
    vcf_header.add_sample('SAMPLE')

    # 使用pysam创建压缩的VCF文件
    with pysam.VariantFile(output_file, mode='wz', header=vcf_header) as vcf_file:
        # 遍历每一行数据并写入VCF格式
        for _, row in df.iterrows():
            chrom = row['chromosome']
            pos = int(row['position'])
            rsid = row['rsid']
            genotype = row['genotype']

            if genotype == "--":
                continue

            # 从参考VCF中获取参考等位基因
            try:
                # 确保染色体名称与参考基因组一致
                chrom_str = str(chrom)
                if chrom_str not in valid_chroms:
                    print(f"Warning: Chromosome {chrom} not found in reference genome. Skipping.")
                    continue
                
                # 在参考VCF中查找匹配的位点
                ref_record = None
                for record in vcf_ref.fetch(chrom_str, pos-1, pos):
                    if record.pos == pos:
                        ref_record = record
                        break
                
                if ref_record is None:
                    print(f"Warning: Position {chrom}:{pos} not found in reference VCF. Skipping.")
                    continue
                    
                ref_allele = ref_record.ref
                alt_alleles = set(ref_record.alts) if ref_record.alts else set()

            except ValueError as e:
                print(f"Warning: {str(e)}. Skipping.")
                continue

            # 确定ALT等位基因
            sample_alleles = set(genotype) - {ref_allele}
            alt_alleles = alt_alleles | sample_alleles
            alt_allele = ','.join(alt_alleles) if alt_alleles else '.'

            # 确定基因型GT
            if chrom in ['MT', 'Y']:
                if alt_allele == '.':
                    gt = '0'
                else:
                    gt = '1'
            else:
                if alt_allele == '.':
                    gt = '0/0'
                elif len(genotype) == 1:
                    gt = '1/1'
                else:
                    if len(set(genotype)) == 1:
                        gt = '1/1'
                    else:
                        gt = '0/1'
            
            # 修复alt
            if gt in ['0/0', '0']:
                alt_allele = ref_allele
            
            # 创建VCF记录
            record = vcf_file.new_record()
            # 确保染色体名称与参考基因组一致
            if chrom_str not in valid_chroms:
                print(f"Warning: Chromosome {chrom} not found in reference genome. Skipping.")
                continue
            record.chrom = chrom_str
            record.pos = pos
            record.id = rsid
            record.ref = ref_allele
            record.alts = (alt_allele,) if alt_allele != '.' else None
            record.stop = pos
            record.info['RAW'] = genotype
            record.samples['SAMPLE']['GT'] = tuple(map(int, gt.replace('/', '|').split('|')))

            # 写入记录
            vcf_file.write(record)

    # 关闭参考VCF文件
    vcf_ref.close()

    # 创建tabix索引
    pysam.tabix_index(output_file, preset="vcf", force=True)

def other2VcfMain():
    parser = argparse.ArgumentParser(
        usage = "python3 other_2_vcf.py -i <txt file> -o <vcf file> -r <reference>",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("-i", "--input", type=str, help="23andme format")
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