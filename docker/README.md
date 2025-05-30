# Rootara Docker 部署指南

本目录包含了 Rootara 项目的 Docker 配置文件，用于构建和部署前端应用。

## 文件说明

- `dockerfile` - 多阶段构建的 Dockerfile，用于构建优化的前端镜像
- `docker-compose.yml` - Docker Compose 配置，整合前端和后端服务
- `build.sh` - 构建脚本，提供便捷的镜像构建功能
- `README.md` - 本说明文件

## 快速开始

### 1. 构建前端镜像

```bash
# 基本构建
./docker/build.sh

# 自定义镜像名称和标签
./docker/build.sh -n rootara -t v1.0.0

# 无缓存构建
./docker/build.sh --no-cache
```

### 2. 使用 Docker Compose 部署

```bash
# 启动所有服务
docker-compose -f docker/docker-compose.yml up -d

# 查看服务状态
docker-compose -f docker/docker-compose.yml ps

# 查看日志
docker-compose -f docker/docker-compose.yml logs -f

# 停止服务
docker-compose -f docker/docker-compose.yml down
```

### 3. 环境变量配置

复制 `.env.example` 为 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

主要配置项：
- `ADMIN_EMAIL` - 管理员邮箱
- `ADMIN_PASSWORD` - 管理员密码
- `JWT_SECRET` - JWT 密钥
- `ROOTARA_BACKEND_URL` - 后端服务地址
- `ROOTARA_BACKEND_API_KEY` - 后端 API 密钥

## 服务说明

### 前端服务 (frontend)
- **镜像**: `ghcr.io/pzweuj/rootara:latest`
- **端口**: 3000
- **功能**: Next.js 前端应用

### 后端服务 (backend)
- **镜像**: `ghcr.io/pzweuj/rootara-backend:latest`
- **端口**: 8000
- **功能**: FastAPI 后端服务
- **数据卷**: `./data:/data`

## 镜像优化特性

- 🚀 **多阶段构建**: 分离构建和运行环境，减小镜像体积
- 📦 **Alpine Linux**: 使用轻量级基础镜像
- 🔒 **非 root 用户**: 提高安全性
- 🎯 **Standalone 输出**: Next.js 独立输出模式，优化部署
- 📋 **健康检查**: 自动监控服务状态
- 🔄 **自动重启**: 服务异常时自动重启

## 生产环境建议

1. **更改默认密码**: 修改 `.env` 文件中的默认密码
2. **使用 HTTPS**: 配置反向代理（如 Nginx）启用 HTTPS
3. **数据备份**: 定期备份 `./data` 目录
4. **监控日志**: 配置日志收集和监控
5. **资源限制**: 根据需要调整内存和 CPU 限制

## 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   netstat -tulpn | grep :3000
   netstat -tulpn | grep :8000
   ```

2. **权限问题**
   ```bash
   # 确保 data 目录权限正确
   sudo chown -R 1001:1001 ./data
   ```

3. **镜像拉取失败**
   ```bash
   # 手动拉取镜像
   docker pull ghcr.io/pzweuj/rootara:latest
   docker pull ghcr.io/pzweuj/rootara-backend:latest
   ```

### 查看日志

```bash
# 查看前端日志
docker logs rootara-frontend

# 查看后端日志
docker logs rootara-backend

# 实时查看所有日志
docker-compose -f docker/docker-compose.yml logs -f
```

## 开发环境

如需在开发环境中使用 Docker：

```bash
# 构建开发镜像
docker build -f docker/dockerfile --target builder -t rootara:dev .

# 运行开发容器
docker run -p 3000:3000 -v $(pwd):/app -v /app/node_modules rootara:dev pnpm dev
```
