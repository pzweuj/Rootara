# coding=utf-8
# pzw
# 20250121
# 用于从dbNSFP v4.9a中提取出dbsnp数据
# 版本对应dbsnp 156

import gzip

# 输入文件和输出文件
input_file = "dbNSFP4.9a_grch37.gz"
output_file = "dbsnp_grch37.txt.gz"  # 输出为 .gz 文件

# 需要提取的字段索引（从 0 开始）
columns_to_extract = [7, 8, 2, 3, 6]  # 对应 hg19_chr, hg19_pos, ref, alt, rs_dbSNP
chrom_list = [str(i) for i in range(1, 23)] + ["X", "Y", "MT"]

# 打开输入文件和输出文件（输出文件使用 gzip 压缩）
with gzip.open(input_file, "rt") as infile, gzip.open(output_file, "wt") as outfile:
    # 读取文件头（列名）
    outfile.write("\t".join(["#chrom", "start", "ref", "alt", "rsid"]) + "\n")

    # 读取数据行
    for line in infile:
        if line.startswith("#"):
            continue  # 跳过注释行

        fields = line.strip().split("\t")

        if fields[6] == ".":
            continue  # 跳过没有 rsid 的行
        
        if fields[0] not in chrom_list:
            continue  # 跳过非标准染色体的行

        extracted_fields = [fields[i] for i in columns_to_extract]
        outfile.write("\t".join(extracted_fields) + "\n")

# end
