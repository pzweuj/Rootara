# coding=utf-8
# pzw
# 20250207
# 有Clinvar或mitomap描述的结果提取
# 注：当前发现第三方数据提供商的检测结果，Indel存在大量的纯合突变检出，结果可能不准确

import sys
import argparse
import pysam
import pandas as pd

def vcf_to_dataframe(vcf_path: str) -> pd.DataFrame:
    """
    将VCF文件读取为pandas DataFrame
    
    参数:
    vcf_path (str): VCF.gz文件路径
    
    返回:
    pd.DataFrame: 包含VCF信息的DataFrame
    """
    # 使用pysam打开VCF文件
    data_list = []
    with pysam.TabixFile(vcf_path, encoding='utf-8') as file:
        csq_header = []
        for header_line in file.header:
            if header_line.startswith("##INFO=<ID=CSQ,Number=.,Type=String"):
                csq_header = header_line.split("m Ensembl VEP. Format: ")[1].rstrip("\">").split("|")
          
        # 读取数据行
        for line in file.fetch():
            if not "athogenic" in line:
                continue
            
            line_split = line.strip().split("\t")

            row_dict = {
                "ID": line_split[2],
                "CHROM": line_split[0],
                "POS": line_split[1],
                "REF": line_split[3],
                "ALT": line_split[4]
            }

            csq = next((tag for tag in line_split[7].split(";") if "CSQ" in tag), "CSQ=" + "|" * (len(csq_header) - 1))
            csq_first = csq.lstrip("CSQ=").split(",")[0].split("|")
            csq_zip_dict = {}
            if len(csq_header) == len(csq_first):
                csq_zip_dict = {j[0]:j[1] for j in zip(csq_header, csq_first)}

            format_dict = {}
            format_tag = line_split[8].split(":")
            sample_tag = line_split[9].split(":")
            if len(format_tag) == len(sample_tag):
                format_dict = {j[0]:j[1] for j in zip(format_tag, sample_tag)}
            
            gt = format_dict.get("GT", "./.")
            if gt in ["./.", "0/0", "0"]:
                continue
            
            # 补充其他信息
            row_dict["Gene"] = csq_zip_dict.get("SYMBOL", ".")
            row_dict["Transcript"] = csq_zip_dict.get("Feature", ".")
            row_dict["AF"] = csq_zip_dict.get("MAX_AF", ".")
            row_dict["HGVSc"] = (".:." if csq_zip_dict.get("HGVSc", ".:.") == "" else csq_zip_dict.get("HGVSc", ".")).split(":")[1]
            row_dict["HGVSp"] = (".:." if csq_zip_dict.get("HGVSp", ".:.") == "" else csq_zip_dict.get("HGVSp", ".")).split(":")[1]
            row_dict["HGVSg"] = csq_zip_dict.get("HGVSg", ".")
            row_dict["cytoBand"] = csq_zip_dict.get("cytoBand", ".")
            row_dict["CLNSIG"] = csq_zip_dict.get("ClinVar_CLNSIG", ".")
            row_dict["CLNREVSTAT"] = csq_zip_dict.get("ClinVar_CLNREVSTAT", ".")
            row_dict["CLNDN"] = csq_zip_dict.get("ClinVar_CLNDN", ".")
            row_dict["GT"] = format_dict.get("GT", ".")

            data_list.append(row_dict)

    # 将data_list转换为datafarme

    df = pd.DataFrame(data_list)
    return df

# 类型判断
def judge_type(row):
    ref = row["REF"]
    alt = row["ALT"]
    if len(ref) == 1 and len(alt) == 1 and ref != "-" and alt != "-":
        return "SNP"
    if ref == "-":
        return "Insertion"
    if alt == "-":
        return "Deletion"
    return "Complex"

# Clinvar🌟确认
def clinvar_star(value: str) -> str:
    rating_mapping = {
        "guideline": "4",
        "reviewed_by_expert_panel": "3",
        "_multiple_submitters": "2",
        "_single_submitter": "1",
        "conflicting": "1",
    }
    
    # Check for each key in the mapping
    for key, rating in rating_mapping.items():
        if key in value:
            return rating

    return "."

# 怀疑插入确实的纯合检出不准
def need_to_hide(row):
    type = row["Type"]
    gt = row["GT"]
    if type in ["Insertion", "Deletion", "Complex"] and gt == "1/1":
        return True
    return False

# 结果过滤
def df_filter(input_df):
    df = input_df.copy()
    df = df[~df["CLNSIG"].str.contains("Conflicting_classifications_of_pathogenicity", na=False)]

    # 加入SNP、Insertion、Deletion判定
    # df["Type"] = "SNP"
    df.loc[:, "Type"] = df.apply(lambda x: judge_type(x), axis=1)

    # Clinvar🌟
    # df["Clinvar_Ranking"] = "."
    df.loc[:, "Clinvar_Ranking"] = df.loc[:, "CLNREVSTAT"].apply(lambda x: clinvar_star(x))

    # 怀疑论
    # df["Hide"] = False
    df.loc[:, "Hide"] = df.apply(lambda x: need_to_hide(x), axis=1)
    return df

# 读取VCF文件
def clinvar_pipe(input_vcf, output_file):
    df = vcf_to_dataframe(input_vcf)
    df = df_filter(df)
    df.to_csv(output_file, sep="\t", header=True, index=False)

def clinvarMain():
    parser = argparse.ArgumentParser(
        usage = "python3 clinvar_extract.py -i <vcf file> -o <txt file>",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("-i", "--input", type=str, help="vcf file")
    parser.add_argument("-o", "--output", type=str, help="txt file")

    if len(sys.argv[1:]) == 0:
        parser.print_help()
        parser.exit()
    
    args = parser.parse_args()
    input = args.input
    output = args.output
    clinvar_pipe(input, output)

if __name__ == "__main__":
    clinvarMain()



