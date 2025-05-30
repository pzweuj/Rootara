#!/bin/bash

# Rootara 快速启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Rootara 快速启动脚本 ===${NC}"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装，请先安装 Docker Compose${NC}"
    exit 1
fi

# 创建 data 目录
if [ ! -d "./data" ]; then
    echo -e "${YELLOW}创建 data 目录...${NC}"
    mkdir -p ./data
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}复制环境变量模板文件...${NC}"
        cp .env.example .env
        echo -e "${YELLOW}请编辑 .env 文件配置您的环境变量${NC}"
    else
        echo -e "${YELLOW}未找到环境变量文件，使用默认配置${NC}"
    fi
fi

# 拉取最新镜像
echo -e "${BLUE}拉取最新镜像...${NC}"
docker-compose pull

# 启动服务
echo -e "${BLUE}启动服务...${NC}"
docker-compose up -d

# 等待服务启动
echo -e "${YELLOW}等待服务启动...${NC}"
sleep 10

# 检查服务状态
echo -e "${BLUE}检查服务状态...${NC}"
docker-compose ps

# 显示访问信息
echo -e "${GREEN}=== 启动完成 ===${NC}"
echo -e "${GREEN}前端访问地址: http://localhost:3000${NC}"
echo -e "${GREEN}后端访问地址: http://localhost:8000${NC}"
echo ""
echo -e "${YELLOW}常用命令:${NC}"
echo -e "  查看日志: ${BLUE}docker-compose logs -f${NC}"
echo -e "  停止服务: ${BLUE}docker-compose down${NC}"
echo -e "  重启服务: ${BLUE}docker-compose restart${NC}"
echo -e "  查看状态: ${BLUE}docker-compose ps${NC}"
