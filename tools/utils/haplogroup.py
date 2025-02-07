# coding=utf-8
# pzw
# 20250207
# haplogrouper的套壳程序

import os
import sys
import argparse

def haplogrouper_pipe(input_vcf, output_file, type="Y"):
    grouper = "haploGrouper.py"
    tree_dict = {
        "Y": "chrY_isogg2019_tree.txt",
        "MT": "chrMT_phylotree17_tree.txt"
    }
    loci_dict = {
        "Y": "chrY_isogg2019-decode1_loci_b37.txt",
        "MT": "chrMT_phylotree17_loci.txt"
    }

    tree = tree_dict[type]
    loci = loci_dict[type]

    cmd = f"""
        python3 {grouper} -v {input_vcf} -o {output_file} -t {tree} -l {loci}
    """
    os.system(cmd)

def haplogroupeMain():
    parser = argparse.ArgumentParser(
        usage = "python3 haplogroup.py -i <vcf file> -o <group.txt>",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("-i", "--input", type=str, help="vcf file")
    parser.add_argument("-o", "--output", type=str, help="group.txt")
    parser.add_argument("-g", "--group", type=str, help="Y or MT, default=MT", default="MT")   

    if len(sys.argv[1:]) == 0:
        parser.print_help()
        parser.exit()
    
    args = parser.parse_args()
    input = args.input
    output = args.output
    group = args.model
    haplogrouper_pipe(input, output, group)

if __name__ == "__main__":
    haplogroupeMain()


