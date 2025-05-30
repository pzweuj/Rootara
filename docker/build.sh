#!/bin/bash

# Docker构建脚本
# 用于构建优化的Rootara Next.js应用镜像

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
IMAGE_NAME="rootara"
TAG="latest"
DOCKERFILE="docker/dockerfile"
CONTEXT="."

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -n, --name NAME     设置镜像名称 (默认: rootara)"
    echo "  -t, --tag TAG       设置镜像标签 (默认: latest)"
    echo "  -f, --file FILE     指定Dockerfile路径 (默认: docker/dockerfile)"
    echo "  -c, --context PATH  设置构建上下文 (默认: .)"
    echo "  --no-cache          不使用缓存构建"
    echo "  --push              构建后推送到registry"
    echo "  --multi-platform    构建多平台镜像 (linux/amd64,linux/arm64)"
    echo "  -h, --help          显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                                    # 基本构建"
    echo "  $0 -n myapp -t v1.0.0               # 自定义名称和标签"
    echo "  $0 --no-cache                        # 无缓存构建"
    echo "  $0 --multi-platform --push          # 多平台构建并推送"
}

# 解析命令行参数
NO_CACHE=""
PUSH=""
MULTI_PLATFORM=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -f|--file)
            DOCKERFILE="$2"
            shift 2
            ;;
        -c|--context)
            CONTEXT="$2"
            shift 2
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        --push)
            PUSH="--push"
            shift
            ;;
        --multi-platform)
            MULTI_PLATFORM="--platform linux/amd64,linux/arm64"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}错误: 未知选项 $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 完整镜像名称
FULL_IMAGE_NAME="${IMAGE_NAME}:${TAG}"

echo -e "${BLUE}=== Docker镜像构建脚本 ===${NC}"
echo -e "${YELLOW}镜像名称:${NC} ${FULL_IMAGE_NAME}"
echo -e "${YELLOW}Dockerfile:${NC} ${DOCKERFILE}"
echo -e "${YELLOW}构建上下文:${NC} ${CONTEXT}"

# 检查Dockerfile是否存在
if [[ ! -f "${DOCKERFILE}" ]]; then
    echo -e "${RED}错误: Dockerfile不存在: ${DOCKERFILE}${NC}"
    exit 1
fi

# 检查构建上下文是否存在
if [[ ! -d "${CONTEXT}" ]]; then
    echo -e "${RED}错误: 构建上下文目录不存在: ${CONTEXT}${NC}"
    exit 1
fi

# 构建命令
BUILD_CMD="docker build"

# 添加选项
if [[ -n "${NO_CACHE}" ]]; then
    BUILD_CMD="${BUILD_CMD} ${NO_CACHE}"
    echo -e "${YELLOW}使用无缓存构建${NC}"
fi

if [[ -n "${MULTI_PLATFORM}" ]]; then
    BUILD_CMD="docker buildx build ${MULTI_PLATFORM}"
    echo -e "${YELLOW}构建多平台镜像: linux/amd64,linux/arm64${NC}"
fi

if [[ -n "${PUSH}" ]]; then
    BUILD_CMD="${BUILD_CMD} ${PUSH}"
    echo -e "${YELLOW}构建完成后将推送到registry${NC}"
fi

# 完整构建命令
BUILD_CMD="${BUILD_CMD} -f ${DOCKERFILE} -t ${FULL_IMAGE_NAME} ${CONTEXT}"

echo -e "${BLUE}开始构建...${NC}"
echo -e "${YELLOW}执行命令:${NC} ${BUILD_CMD}"

# 执行构建
if eval "${BUILD_CMD}"; then
    echo -e "${GREEN}✅ 镜像构建成功!${NC}"
    
    # 显示镜像信息
    if [[ -z "${MULTI_PLATFORM}" && -z "${PUSH}" ]]; then
        echo -e "${BLUE}镜像信息:${NC}"
        docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
        
        echo -e "${BLUE}运行命令:${NC}"
        echo "docker run -p 3000:3000 ${FULL_IMAGE_NAME}"
        echo ""
        echo -e "${BLUE}或使用docker-compose:${NC}"
        echo "docker-compose up"
    fi
else
    echo -e "${RED}❌ 镜像构建失败!${NC}"
    exit 1
fi
