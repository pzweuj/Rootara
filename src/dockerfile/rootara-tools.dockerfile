FROM ensemblorg/ensembl-vep:release_113.3

# 依赖的软件包
RUN apt-get update && apt-get install -y \
    tabix \
    bcftools \
    samtools \
    wget \
    unzip \
    make \
    gcc \
    zlib1g-dev \
    libbz2-dev \
    liblzma-dev \
    libcurl4-gnutls-dev \
    libssl-dev \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 安装 admix (假设你指的是 ADMIXTURE)
RUN wget https://www.genetics.ucla.edu/software/admixture/binaries/admixture_linux-1.3.0.tar.gz && \
    tar -xzf admixture_linux-1.3.0.tar.gz && \
    mv admixture_linux-1.3.0/admixture /usr/local/bin/ && \
    rm -rf admixture_linux-1.3.0 admixture_linux-1.3.0.tar.gz

# 安装 haploGrouper (假设你指的是 HaploGrep)
RUN wget https://github.com/genepi/haplogrep/releases/download/v2.4.0/haplogrep.zip && \
    unzip haplogrep.zip && \
    mv haplogrep /usr/local/bin/ && \
    rm haplogrep.zip

# 安装 Python 库 (pandas, openpyxl)
RUN pip3 install pandas openpyxl

# 设置工作目录
WORKDIR /workspace

# 默认命令
CMD ["bash"]
