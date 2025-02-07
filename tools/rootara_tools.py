# coding=utf-8
# pzw
# 20250121
# 工具库

import sys
import argparse

# 命令行参数
def tool_box():

    ################⬇️⬇️⬇️ 编辑区域 ⬇️⬇️⬇️#####################
    version = "Version 0.2 20250121"

    from utils.other_2_vcf import other2VcfMain
    from utils.vcf_2_rootara import vcf2RootaraMain

    function_dict = {
        "o2v": {"fun": other2VcfMain, "des": "rootara/other to vcf"},
        "v2r": {"fun": vcf2RootaraMain, "des": "vcf to rootara"}
    }
    
    ################⬆️⬆️⬆️ 编辑区域 ⬆️⬆️⬆️####################
    
    help_string = '\nselect：\n'
    for op in function_dict:
        help_string = help_string + '      ' + op.ljust(20) + function_dict[op]['des'] + "\n"
    parser = argparse.ArgumentParser(
        description = "使用示例：python3 rootara_tools.py [function]",
        prog = "rootara_tools.py",
        usage = "python3 rootara_tools.py <function> <args>",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("-v", "--version", action="version", version=version)    
    parser.add_argument('option', type=str, choices=list(function_dict.keys()), help=help_string)

    if len(sys.argv[1:]) == 0:
        parser.print_help()
        parser.exit()

    args = parser.parse_args(sys.argv[1:2])
    sys.argv = sys.argv[:1] + sys.argv[2:]
    option_set = args.option

    if option_set in function_dict:
        function_dict[option_set]["fun"]()
    else:
        print("[ERROR] function not found")
        parser.print_help()
        parser.exit()

# 调用
if __name__ == '__main__':
    tool_box()


