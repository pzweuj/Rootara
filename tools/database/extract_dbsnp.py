# coding=utf-8
# pzw
# 20250121
# 用于从dbNSFP v4.9a中提取出dbsnp数据
# 版本对应dbsnp 156

import gzip

# 输入文件和输出文件
input_file = "dbNSFP4.9a_grch37.gz"
output_file = "dbsnp_grch37.vcf.gz"  # 输出为 .gz 文件

chrom_list = [str(i) for i in range(1, 23)] + ["X", "Y", "MT"]

# 打开输入文件和输出文件（输出文件使用 gzip 压缩）
with gzip.open(input_file, "rt") as infile, gzip.open(output_file, "wt") as outfile:
    # 读取文件头（列名）
    outfile.write("##fileformat=VCFv4.2\n")
    outfile.write("##source=dbNSFP4.9a\n")
    outfile.write("##reference=GRCh37\n")
    outfile.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n")

    # 读取数据行
    for line in infile:
        if line.startswith("#"):
            continue  # 跳过注释行

        fields = line.strip().split("\t")

        if fields[6] == ".":
            continue  # 跳过没有 rsid 的行
        
        if fields[0] not in chrom_list:
            continue  # 跳过非标准染色体的行

        # 提取并格式化VCF字段
        chrom = fields[7]
        pos = fields[8]
        rsid = fields[6]
        ref = fields[2]
        alt = fields[3]
        
        # 写入VCF格式行
        outfile.write(f"{chrom}\t{pos}\t{rsid}\t{ref}\t{alt}\t.\t.\t.\n")

# end
