#!/bin/bash

# Rootara 停止脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Rootara 停止脚本 ===${NC}"

# 检查是否有运行的服务
if docker-compose ps | grep -q "Up"; then
    echo -e "${YELLOW}停止 Rootara 服务...${NC}"
    docker-compose down
    echo -e "${GREEN}服务已停止${NC}"
else
    echo -e "${YELLOW}没有运行中的 Rootara 服务${NC}"
fi

# 显示选项
echo ""
echo -e "${YELLOW}可选操作:${NC}"
echo -e "  1. 仅停止服务 (已完成)"
echo -e "  2. 停止并删除容器: ${BLUE}docker-compose down${NC}"
echo -e "  3. 停止并删除容器和镜像: ${BLUE}docker-compose down --rmi all${NC}"
echo -e "  4. 停止并删除所有数据: ${BLUE}docker-compose down -v${NC}"
