<div align="center">
  <img src="public/rootara_logo_rmbg_small.svg" alt="Rootara Logo" width="300">
  <h1>Rootara - 可自托管基因组平台</h1>
  <p><a href="README.md">English</a> | <strong>中文</strong></p>
</div>

Rootara 是一个用于导入和探索个人基因数据的自托管平台。所有分析都在一个容器中本地执行。Next.js 在构建时生成静态页面，Rust 后端服务 `rootara-server` 提供页面、登录认证、浏览器接口与导入队列，生产镜像不再包含 Python 运行时。前端源码位于仓库根目录，后端位于 `backend/`。

> **测试状态：** 当前遗传特征结果仍为测试数据，不得用于医学、健康或其他重要决策。

默认目录包含 152 条已审核的相对倾向卡片，覆盖 154 个已核验
位点。每张卡片展示证据等级、来源链接、适用人群和局限；它们都不是
诊断或治疗建议。首发支持 `linux/amd64`。

生产环境由单个 `rootara-server` 进程（Axum/Tokio）在 3000 端口提供静态网页和浏览器接口，并在容器内的 `127.0.0.1:8000` 提供私有 API。原生分析工具随任务启动，完成后退出。

### v2.0.0 全 Rust 后端与分析引擎

启动初始化、数据卷迁移、HTTP 接口、持久化导入队列、特征公式求值与健康检查均由 Rust 服务 `rootara-server`（`backend/server/`）实现。新导入的报告由 `rootara-reader` 逐行匹配变异，`AdmixRS` 0.1.0 计算 K47 祖源，`HaploGrouperRS` 0.2.0 判定 GRCh37 Y 染色体和线粒体单倍群。构建镜像时通过 `rootara-server build-reference` 生成带索引的参考库，导入时只查询当前位点，在一个事务中写入报告。`rootara-archive` 分小批写入 Parquet，下载时只读原始字节列，查询特征位点时只读分型列。已有 SQLite 报告、TXT 和 Parquet 原始文件可以继续读取。重新导入会使用 Rust 求解器重新计算祖源百分比。

在本地验证当前代码可运行 `docker build -f dockerfile -t rootara-local:2.0.0 .`。测试条件、实测数据和复现命令见[导入资源基准](docs/import-memory-benchmark.md)。

Rootara 自身代码使用 AGPLv3。镜像内的 AdmixRS 使用 GPL-3.0-only；HaploGrouperRS 0.2.0 限非商业使用，随附的 ISOGG 参考数据使用 CC BY-NC-SA 3.0。镜像在 `/opt/rootara/licenses/` 提供这些组件的许可与数据来源说明。[AdmixRS](https://github.com/pzweuj/AdmixRS) · [HaploGrouperRS 许可原文](https://github.com/pzweuj/HaploGrouperRS/blob/70108d6844f7dbdaa6a483f1ff9c2bba6a035c27/LICENSE)

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

发布镜像会强制检查 `ROOTARA_EXPECTED_TRAIT_COUNT=152` 和
`ROOTARA_REQUIRE_CURATED_CATALOG=1`；目录不完整或包含审核阻塞项时会拒绝启动。

JWT 签名密钥首次启动时自动生成，并保存到 `/data/config/jwt-secret`。SQLite 数据库和上传的原始数据都在 `/data` 下，请保留该卷用于备份和升级。

私有 API 只在容器内部监听 `127.0.0.1:8000`，对外只开放 3000 端口。公开健康检查端点为：

- `GET /health/live`
- `GET /health/ready`
- `GET /health`

特征页将轻量目录和报告结果分开加载。对应的认证接口为
`GET /api/traits/catalog`、`GET /api/reports/{reportId}/traits/results` 和
`GET /api/traits/{traitId}?report_id=...`。缺失基因型会以
`insufficient_data` 返回具体缺失 RSID，绝不会进行推断填充。

## 本地存储与报告加载

新上传的文件按行保存为 Zstandard 压缩的 Parquet，原文件字节、行序和换行均可还原。特征回填只读取所需的位点列。SQLite 保留报告目录和带 RSID 索引的注释表，用于单点查询与分页。旧版 TXT 继续支持导出和回填。现有报告保留原导入结果；重新导入原文件可应用新的多候选位点匹配规则。

如需转换旧 TXT，可在服务停止时运行 `docker compose run --rm --no-deps rootara migrate-archives`。命令逐个校验 SHA-256，默认保留旧文件。追加 `--remove-text` 会在每个文件校验成功后删除对应 TXT。

导入任务在服务端排队，重启后继续处理。上传页面可以查看当前步骤。仪表盘在内存中按报告缓存五分钟，退出登录时清空。祖源地图只使用镜像内的国家边界数据。

如果旧部署在环境变量中显式设置了 `ROOTARA_EXPECTED_TRAIT_COUNT=150`，升级时请改为 `152`。

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

本机开发后端与导入流程时，执行 `cargo build --release --locked --manifest-path backend/reader/Cargo.toml` 和 `cargo build --release --locked --manifest-path backend/server/Cargo.toml`，并把 `rootara-server`、`rootara-reader`、`rootara-archive`、`admixrs` 和 `haplogrouper-rs` 放入 PATH。运行 `rootara-server build-reference backend/database/Rootara.core.202404.txt.gz backend/database/Rootara.core.sqlite` 生成参考索引。Dockerfile 中列有固定的上游提交、`backend/database/admix/` 的 K47 模型文件和 `backend/haploGrouper/data/` 的四张参考表，也可以从本地构建的镜像复制这些数据。

前端仍位于仓库根目录，Rust 后端位于 `backend/server/` 和 `backend/reader/`。为后端和前端进程设置 `ROOTARA_API_KEY=dev-only-key`、`ROOTARA_BACKEND_API_KEY=dev-only-key`、`ROOTARA_BACKEND_ROOT=$PWD/backend`、`ROOTARA_DATA_DIR=.data`、`ADMIN_PASSWORD=dev-only-password` 和 `JWT_SECRET=dev-only-jwt-secret`，运行 `ROOTARA_DISABLE_PUBLIC=1 cargo run --manifest-path backend/server/Cargo.toml -- serve` 在 `127.0.0.1:8000` 启动私有 API；另开终端在根目录执行 `pnpm dev`，并设置 `ROOTARA_BACKEND_URL=http://127.0.0.1:8000`。特征目录与候选清单审核校验可通过 `cargo run --locked --manifest-path backend/server/Cargo.toml -- validate-catalog` 执行。

## 版本与迁移

统一版本线从 `v1.0.0` 开始。本版本不提供旧双容器部署、旧 Compose 文件或旧环境变量的自动迁移。请在验证全新 `/data` 数据卷后再部署；用户数据只能通过单独验证过的备份流程迁移。

Rootara 使用 AGPLv3 许可证。
