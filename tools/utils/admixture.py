# coding=utf-8
# pzw
# 20250207
# admix的套壳程序，形成一个json文件

import os
import sys
import argparse
import json

def admix_pipe(input_file, output_json, type="23andme", model="K47"):
    admix = "admix"
    input_file = os.path.abspath(input_file)
    output_json = os.path.abspath(output_json)
    tmp_file = output_json + ".tmp.txt"
    cmd = f"""
        {admix} -f {input_file} -o {tmp_file} -m {model} -v {type}
    """
    os.system(cmd)

    output_dict = {}
    with open(tmp_file, "r", encoding="utf-8") as f:
        for line in f:
            if not ": " in line:
                continue
            line_split = line.strip().split(": ")
            region = line_split[0]
            percentage = float(line_split[1].rstrip("%"))
            output_dict[region] = percentage

    # 将字典输出为格式化的 JSON 文件
    with open(output_json, "w", encoding="utf-8") as json_file:
        json.dump(output_dict, json_file, indent=4, ensure_ascii=False)
    os.remove(tmp_file)

def admixMain():
    parser = argparse.ArgumentParser(
        usage = "python3 admixture.py -i <rootara file> -o <admix json>",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("-i", "--input", type=str, help="rootara file")
    parser.add_argument("-o", "--output", type=str, help="json file")
    parser.add_argument("-m", "--model", type=str, help="select model, recommend: K47, K12b, default=K47", default="K47")   

    if len(sys.argv[1:]) == 0:
        parser.print_help()
        parser.exit()
    
    args = parser.parse_args()
    input = args.input
    output = args.output
    model = args.model
    admix_pipe(input, output, model=model)

if __name__ == "__main__":
    admixMain()

