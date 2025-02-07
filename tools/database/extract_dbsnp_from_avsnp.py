# coding=utf-8
# pzw
# 20250122

def convert_to_vcf(input_file, output_file):
    # VCF header
    vcf_header = """##fileformat=VCFv4.2
##INFO=<ID=RSID,Number=1,Type=String,Description="dbSNP ID">
##contig=<ID=1,length=249250621>
##contig=<ID=2,length=243199373>
##contig=<ID=3,length=198022430>
##contig=<ID=4,length=191154276>
##contig=<ID=5,length=180915260>
##contig=<ID=6,length=171115067>
##contig=<ID=7,length=159138663>
##contig=<ID=8,length=146364022>
##contig=<ID=9,length=141213431>
##contig=<ID=10,length=135534747>
##contig=<ID=11,length=135006516>
##contig=<ID=12,length=133851895>
##contig=<ID=13,length=115169878>
##contig=<ID=14,length=107349540>
##contig=<ID=15,length=102531392>
##contig=<ID=16,length=90354753>
##contig=<ID=17,length=81195210>
##contig=<ID=18,length=78077248>
##contig=<ID=19,length=59128983>
##contig=<ID=20,length=63025520>
##contig=<ID=21,length=48129895>
##contig=<ID=22,length=51304566>
##contig=<ID=X,length=155270560>
##contig=<ID=Y,length=59373566>
##contig=<ID=MT,length=16569>
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO
"""
    chrom_list = [str(i) for i in range(1, 23)] + ["X", "Y", "MT"]
    # Open the input and output files
    with open(input_file, 'r') as infile, open(output_file, 'w') as outfile:
        # Write the VCF header to the output file
        outfile.write(vcf_header)

        # Process each line in the input file
        for line in infile:
            # Split the line into columns
            columns = line.strip().split()

            # Extract the relevant fields
            chrom = columns[0]  # Chromosome
            if chrom not in chrom_list:
                continue
            pos = columns[1]    # Position
            ref = columns[3]    # Reference allele
            alt = columns[4]    # Alternate allele
            rsid = columns[5]   # RSID

            # Write the VCF line
            vcf_line = f"{chrom}\t{pos}\t.\t{ref}\t{alt}\t.\t.\tRSID={rsid}\n"
            outfile.write(vcf_line)

# Input and output file paths
input_file = 'hg19_avsnp150.txt'  # Replace with your input file name
output_file = 'grch37_dbsnp150.vcf'  # Replace with your desired output file name

# Convert the file
convert_to_vcf(input_file, output_file)
print(f"VCF file has been written to {output_file}")

