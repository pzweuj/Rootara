# Rootara

**[English](README.md) | 中文**

## 介绍
Rootara 是一个易于部署的消费级基因数据托管平台，用户可自部署在自己的服务器中，确保数据安全。Rootara 支持导入23andMe、WeGene等检测服务商的个人基因数据。通过使用Docker Compose进行快速安装和配置，用户可以在本地环境中安全地执行祖源分析、遗传特征解析以及ClinVar数据库查询等多种操作。

## 特性
- **多源兼容**：支持多种格式的基因数据文件上传
- **全面分析**：
  - 祖先起源探索
  - 遗传特征评估
  - 可自定义的特征内容
  - ClinVar变异解读
- **隐私保护**：所有处理都在本地完成，确保您的个人信息不被泄露

## 快速开始
### 系统要求
- **内存**：≥ 2GB RAM（在进行报告分析时，可能占用约1GB RAM）
- **存储空间**：≥ 5GB 可用空间

### 安装步骤

#### 1. 克隆项目
```bash
git clone https://github.com/pzweuj/rootara.git
cd rootara
```

#### 2. 使用Docker Compose启动服务
```bash
# 启动所有服务（前端 + 后端）
docker-compose -f docker/docker-compose.yml up -d

# 查看服务状态
docker-compose -f docker/docker-compose.yml ps

# 查看服务日志
docker-compose -f docker/docker-compose.yml logs -f
```

#### 3. 访问应用
- 打开浏览器访问：http://localhost:3000
- 默认管理员账户：
  - 邮箱：`admin@rootara.app`
  - 密码：`rootara123`

#### 4. 停止服务
```bash
docker-compose -f docker/docker-compose.yml down
```


### 环境变量配置（可选）
建议修改 `docker/docker-compose.yml` 文件中的环境变量：

```yaml
environment:
  - ADMIN_EMAIL=admin@rootara.app                            # 管理员邮箱
  - ADMIN_PASSWORD=rootara123                                # 管理员密码
  - JWT_SECRET=rootara_jwt_secret                            # JWT密钥
  - ROOTARA_BACKEND_API_KEY=rootara_api_key_default_001      # 后端API密钥
```

## 使用指南

### 数据上传
1. 登录系统后，点击"上传数据"
2. 支持的文件格式：
   - 23andMe 原始数据文件（.txt）
   - WeGene 原始数据文件（.txt）

### 分析功能
- **祖源分析**：查看您的祖先地理分布
- **单倍群分析**：父系和母系单倍群分析
- **遗传特征**：了解基因对个人特征的影响
- **健康风险**：基于ClinVar数据库的变异解读

## 贡献
欢迎任何形式的特征贡献，核对后会加入到Rootara默认特征中。

## 许可证
本项目采用AGPLv3许可证发布。请参阅 [LICENSE](LICENSE) 文件获取更多信息。

## 致谢
本项目使用以下开源项目：
- [pysam](https://pysam.readthedocs.io/en/latest/index.html) - 高性能的基因组数据处理库
- [haplogrouper](https://gitlab.com/bio_anth_decode/haploGrouper) - 单倍群分析工具
- [admix](https://github.com/stevenliuyi/admix) - 祖源成分分析算法
- [pandas](https://pandas.pydata.org/) - 强大的数据分析工具
- [FastAPI](https://fastapi.tiangolo.com/) - 现代Python Web框架


