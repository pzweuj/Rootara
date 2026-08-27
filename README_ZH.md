<div align="center">
  <img src="public/rootara_logo_rmbg_small.svg" alt="Rootara Logo" width="300">
  <h1>Rootara - 可自托管基因组平台</h1>
  <p><a href="README.md">English</a> | <strong>中文</strong></p>
</div>

Rootara 是一个用于导入和探索个人基因数据的自托管平台。所有分析都在一个完整镜像中本地执行；浏览器访问 Next.js，Next.js 在容器内部调用私有 FastAPI 分析服务。前端仍位于仓库根目录，后端源码位于 `backend/`。

> **测试状态：** 当前遗传特征结果仍为测试数据，不得用于医学、健康或其他重要决策。

v1 默认目录恰好包含 150 条已审核的相对倾向卡片，覆盖 153 个已核验
位点。每张卡片展示证据等级、来源链接、适用人群和局限；它们都不是
诊断或治疗建议。首发支持 `linux/amd64`。

运行时不再依赖 Redis。私有 FastAPI 服务只在容器内监听
`127.0.0.1:8000`，对外只开放 Next.js 端口。

## 快速开始

需要 Docker 20+ 和 Docker Compose v2+。

```bash
git clone https://github.com/pzweuj/Rootara.git
cd Rootara
export ADMIN_PASSWORD='请替换为足够长的随机密码'
docker compose up -d
```

访问 <http://localhost:3000>。`ADMIN_EMAIL` 默认是 `admin@rootara.app`，启动前可以通过环境变量修改。

如需可复现的本地配置，可以将 `.env.example` 复制为 `.env`，替换
`ADMIN_PASSWORD` 后执行同样的 Compose 命令。不要提交 `.env`，也不要继续使用示例密码。

也可以不下载源码直接运行发布镜像：

```bash
docker run -d --name rootara \
  -p 3000:3000 \
  -v rootara_data:/data \
  -e ADMIN_PASSWORD='请替换为足够长的随机密码' \
  ghcr.io/pzweuj/rootara:latest
```

## 配置

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 必填 | 管理员密码，缺失时启动失败 |
| `ADMIN_EMAIL` | `admin@rootara.app` | 管理员邮箱 |
| `ROOTARA_PORT` | `3000` | `compose.yaml` 映射的宿主机端口 |
| `TZ` | `Asia/Shanghai` | 容器时区 |
| `CACHE_TTL` | `3600` | 内存缓存过期时间（秒） |
| `CACHE_MAX_ENTRIES` | `1024` | 内存缓存最大条目数 |

发布镜像会强制检查 `ROOTARA_EXPECTED_TRAIT_COUNT=150` 和
`ROOTARA_REQUIRE_CURATED_CATALOG=1`；目录不完整或包含审核阻塞项时会拒绝启动。

JWT 签名密钥首次启动时自动生成，并保存到 `/data/config/jwt-secret`。SQLite 数据库和上传的原始数据都在 `/data` 下，请保留该卷用于备份和升级。

FastAPI 只在容器内部监听 `127.0.0.1:8000`，对外只开放 3000 端口。公开健康检查端点为：

- `GET /health/live`
- `GET /health/ready`
- `GET /health`

特征页将轻量目录和报告结果分开加载。对应的认证接口为
`GET /api/traits/catalog`、`GET /api/reports/{reportId}/traits/results` 和
`GET /api/traits/{traitId}?report_id=...`。缺失基因型会以
`insufficient_data` 返回具体缺失 RSID，绝不会进行推断填充。

## 数据、备份与升级

请保留 `rootara_data` 数据卷，内容包括：

- `/data/rootara.db`：SQLite 数据库
- `/data/rawdata`：上传的原始文件
- `/data/temp`：分析临时文件
- `/data/config/jwt-secret`：自动生成的 JWT 签名密钥

升级前请备份数据卷。v1 不提供旧前后端分离部署、旧 Compose 文件或旧
环境变量名称的原地迁移。请先用全新数据卷验证，再通过单独测试过的备份流程恢复用户数据。

启动迁移幂等执行，并创建批量特征计算所需的 RSID 索引。如果目录核验
或迁移失败，容器会保持未 ready 状态，并在日志中说明原因。



## 开发

前端仍位于仓库根目录，后端源码位于 `backend/`。在仓库根目录使用 Python 3.11 虚拟环境安装锁定的 `backend/requirements.txt`，然后执行 `PYTHONPATH=backend python -m uvicorn main:app --host 127.0.0.1 --port 8000`。为后端和前端进程设置 `ROOTARA_API_KEY=dev-only-key`、`ROOTARA_BACKEND_API_KEY=dev-only-key`、`ROOTARA_DATA_DIR=.data`、`ADMIN_PASSWORD=dev-only-password` 和 `JWT_SECRET=dev-only-jwt-secret`。另开终端在根目录执行 `pnpm dev`，并设置 `ROOTARA_BACKEND_URL=http://127.0.0.1:8000`。

## 版本与迁移

统一版本线从 `v1.0.0` 开始。本版本不提供旧双容器部署、旧 Compose 文件或旧环境变量的自动迁移。请在验证全新 `/data` 数据卷后再部署；用户数据只能通过单独验证过的备份流程迁移。

Rootara 使用 AGPLv3 许可证。
