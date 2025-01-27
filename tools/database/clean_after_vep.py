# coding=utf-8
# pzw
# 20250122
# 获得全球、亚洲、中国SNP芯片的注释库
# 从23andme的结果和wegene结果整合得到rsid，使用annovar反注释
# 加入Clinvar现版本所有的P和LP位点
# 解析反注释文件，形成vcf，使用vep注释
# 对使用VEP注释后的vcf文件进行调整
# 每行的注释都仅保留mane转录本的条目
# 注意当前直接使用序号，按固定的顺序取值，没有优化

vcf_input = "Rootara.vep.vcf"
vcf_output = "Rootara.core.vcf"
transcript = "transcript.txt"
gsa = "GSA-24v3-0_A1.hg19.annotated.txt"

transcript_dict = {}
with open(transcript, "r", encoding="utf-8") as t:
    for line in t:
        if line.startswith("#"):
            continue
        lines = line.rstrip("\n").split("\t")
        transcript_dict[lines[0]] = lines[1]

gsa_dict = {}
with open(gsa, "r", encoding="utf-8") as g:
    for line in g:
        if line.startswith("track"):
            continue
        lines = line.rstrip("\n").split("\t")
        rs_id = lines[0]
        if rs_id.startswith("rs"):
            gsa_dict[lines[1] + "_" + lines[2]] = lines[0]
        elif rs_id.startswith("GSA-"):
            rs_id = rs_id.lstrip("GSA-")
            if rs_id.startswith("rs"):
                gsa_dict[lines[1] + "_" + lines[2]] = rs_id

with open(vcf_input, "r", encoding="utf-8") as fi, open(vcf_output, "w", encoding="utf-8") as fo:
    for line in fi:
        if line.startswith("#"):
            fo.write(line)
        else:
            rs_id = "."
            lines = line.rstrip("\n").split("\t")
            info = lines[7].split(";")
            csq_keep = []
            csq_first = "CSQ="
            # max_col = 0
            for info_tag in info:
                if info_tag.startswith("CSQ="):
                    csq = info_tag.lstrip("CSQ=").split(",")
                    csq_first = csq[0]
                    for c in csq:
                        # print(c)
                        c_spl = c.split("|")
                        # if max_col < len(c_spl):
                        #     max_col = len(c_spl)
                        symbol = c_spl[11]
                        feature = c_spl[7]
                        exist_v = c_spl[22]
                        for ev in exist_v.split("&"):
                            if ev.startswith("rs"):
                                rs_id = ev
                        
                        rsid = c_spl[32]
                        if rsid.startswith("rs"):
                            rs_id = rsid

                        if feature == transcript_dict.get(symbol, "."):
                            csq_keep.append(c)
            # print(csq_keep)
            csq_fix = "CSQ=" + (",".join(csq_keep) if len(csq_keep) > 0 else csq_first)
            lines[7] = csq_fix
            rs_id = rs_id if rs_id != "." else gsa_dict.get(lines[0] + "_" + lines[1], ".")
            lines[2] = rs_id if rs_id != "." else "rti_" + lines[0] + "_" + lines[1]
            fo.write("\t".join(lines) + "\n")

# end
