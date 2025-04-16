# Rootara

![Rootara Logo](path/to/your/logo.png) <!-- 如果有Logo的话，请替换路径 -->

## 介绍
Rootara 是一个易于部署且功能强大的基因检测分析平台，用户可自托管在自己的服务器中，确保数据安全。Rootara 支持导入23andMe、WeGene等检测服务商的个人基因数据。通过使用Docker Compose进行快速安装和配置，用户可以在本地环境中安全地执行祖源分析、疾病风险评估、遗传特征解析以及ClinVar数据库查询等多种操作。

## 特性
- **多源兼容**：支持多种格式的基因数据文件上传。
- **全面分析**：
  - 祖先起源探索
  - 基于遗传标记的健康状况预测
  - 个性特征如眼睛颜色、皮肤敏感度等的推断
  - ClinVar变异解读
- **隐私保护**：所有处理都在本地完成，确保您的个人信息不被泄露。
- **灵活扩展**：基于微服务架构设计，方便未来添加更多功能模块。
- **自定义内容**：用户可以在特征解读中加入自定义内容，以满足个性化需求。

## 快速开始
### 系统要求
- Docker >= 19.03
- Docker Compose >= 1.25.0

### 安装步骤
1. 克隆仓库到本地机器:
   ```bash
   git clone https://github.com/pzweuj/rootara.git
   cd rootara
   ```

2. 使用Docker Compose启动服务:
   ```bash
   docker-compose up -d
   ```
   这将自动下载所需的Docker镜像并启动应用。

3. 访问Web界面:
   打开浏览器访问 `http://localhost:8080` (默认端口)，按照提示登录或注册账户后即可开始使用。

### 配置选项
- 您可以通过修改 `docker-compose.yml` 文件来自定义某些设置，例如更改监听端口、增加资源限制等。

## 文档
完整的文档位于 [这里](docs/index.md) ，包括详细的安装指南、API参考及常见问题解答。

## 贡献
我们欢迎任何形式的贡献！如果您发现了bug或者有新的想法，请提交Issue或Pull Request。

## 联系方式
- Email: support@rootara.com
- Website: https://www.rootara.com

## 许可证
本项目采用AGPLv3许可证发布。请参阅 [LICENSE](LICENSE) 文件获取更多信息。

## 自定义内容
用户可以在特征解读中加入自定义内容。要了解如何添加自定义内容，请参阅 [自定义内容指南](docs/custom_content.md)。
