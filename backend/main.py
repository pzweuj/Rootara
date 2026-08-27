# coding=utf-8
import os
import secrets
import time
import uuid
import logging
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Header, Response, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, RootModel
from typing import List, Dict, Any, Union

# 初始化日志系统
from scripts.logging_config import init_logging, request_logger, performance_logger
from scripts.health_monitor import get_health_checker
from scripts.database_manager import get_db_pool, close_db_pool
from scripts.cache_manager import cache_manager
from scripts.runtime_config import DB_PATH, ensure_data_directories

# 初始化日志
init_logging()
logger = logging.getLogger(__name__)

# 生命周期管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    logger.info("Rootara API 服务启动中...")

    # 初始化数据库连接池
    db_pool = get_db_pool()
    logger.info("数据库连接池已初始化")

    # 初始化缓存
    logger.info(f"缓存系统已初始化: {cache_manager.get_stats()}")

    # 初始化健康检查器
    health_checker = get_health_checker()
    logger.info("健康检查器已初始化")

    logger.info("Rootara API 服务启动完成")

    yield

    # 关闭时清理
    logger.info("Rootara API 服务关闭中...")
    close_db_pool()
    logger.info("服务已关闭")

# 自定义脚本API
from scripts.rootara_get_user_id import get_user_id                                                  # 获取用户ID
from scripts.rootara_report_create import create_new_report                                          # 创建新报告
from scripts.rootara_report_del import delete_report                                                 # 删除报告
from scripts.rootara_report_set_default import set_default_report                                    # 设置默认报告
from scripts.rootara_rawdata_export import export_rawdata                                            # 导出原始数据
from scripts.rootara_reports_info import *                                                           # 报告信息相关
from scripts.rootara_table_info import get_snp_info_by_rsid, get_clinvar_data                        # 位点表信息相关
from scripts.rootara_get_admixture import get_admixture_info                                         # 查询祖源分析信息
from scripts.rootara_get_haplogroup import get_haplogroup_info                                       # 查询单倍群分析信息
from scripts.rootara_traits import *                                                                 # 查询特征分析信息
from scripts.trait_catalog_service import (
    get_catalog_payload,
    get_legacy_traits_payload,
    get_report_results,
    get_trait_detail,
)
from scripts.trait_report_migration import get_report_backfill_status

# API
app = FastAPI(
    lifespan=lifespan,
    title = 'Rootara API',
    description = 'Rootara API 基因数据分析平台',
    version = os.environ.get("ROOTARA_VERSION", "1.0.0"),
    docs_url=None if os.environ.get("ROOTARA_ENV", "production") == "production" else "/docs",
    redoc_url=None if os.environ.get("ROOTARA_ENV", "production") == "production" else "/redoc",
)

# 请求日志中间件
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """请求日志和性能监控中间件"""
    request_id = str(uuid.uuid4())
    start_time = time.time()

    # 添加请求ID到请求状态
    request.state.request_id = request_id

    try:
        response = await call_next(request)
        duration = time.time() - start_time

        # 记录请求日志
        request_logger.log_request(
            method=request.method,
            endpoint=str(request.url.path),
            request_id=request_id,
            start_time=start_time,
            duration=duration,
            status_code=response.status_code
        )

        # 添加响应头
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration:.3f}s"

        return response

    except Exception as e:
        duration = time.time() - start_time

        # 记录错误请求
        request_logger.log_request(
            method=request.method,
            endpoint=str(request.url.path),
            request_id=request_id,
            start_time=start_time,
            duration=duration,
            status_code=500,
            error=str(e)
        )

        # 重新抛出异常
        raise

# 设置API密钥 - 从环境变量读取
API_KEY = os.environ.get("ROOTARA_API_KEY")
if not API_KEY:
    raise RuntimeError("ROOTARA_API_KEY must be provided by the Rootara launcher")

# 验证API密钥的依赖函数
async def verify_api_key(x_api_key: str = Header(...)):
    if not secrets.compare_digest(x_api_key, API_KEY):
        raise HTTPException(
            status_code=401,
            detail="无效的API密钥"
        )
    return x_api_key

# 定义请求与响应类型
class ReportIdInput(BaseModel):
    report_id: str

class RsidInput(BaseModel):
    rsid: list[str]  # rsid列表，每个元素为字符串类型
    report_id: str

# 添加初始化数据库的请求模型
class InitDbInput(BaseModel):
    email: str
    name: str

# 标准输出
class StatusOutput(BaseModel):
    status_code: int

# 创建API路由
ensure_data_directories()

## 获取用户ID
@app.post("/user/id", tags=["user_id"])
async def api_get_user_id(api_key: str = Depends(verify_api_key)):
    """
    Get user ID.
    """
    user_id = get_user_id(DB_PATH)
    return {'status_code': 200, 'user_id': user_id}

# 添加创建报告的请求模型
class CreateReportInput(BaseModel):
    user_id: str
    input_data: str
    source_from: str
    report_name: str
    default_report: bool = False

## 创建报告
@app.post("/report/create", response_model=StatusOutput, tags=["report_create"])
async def api_create_new_report(input_data: CreateReportInput, api_key: str = Depends(verify_api_key)):
    """
    Create a new report.
    """
    create_new_report(
        input_data.user_id,
        input_data.input_data,
        input_data.source_from,
        input_data.report_name,
        DB_PATH,
        input_data.default_report,
        False
    )
    return StatusOutput(status_code=201)

## 导出原始数据
@app.post("/report/{report_id}/rawdata", tags=["report_rawdata"])
async def api_export_rawdata(report_id: str, api_key: str = Depends(verify_api_key)):
    """
    Export raw data.
    """
    filename, file_content = export_rawdata(report_id)

    if filename is None or file_content is None:
        raise HTTPException(status_code=404, detail="原始数据文件不存在或无法读取")

    # 返回文件内容作为响应
    return Response(
        content=file_content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

## 设置默认报告
@app.post("/report/default", response_model=StatusOutput, tags=["report_default"])
async def api_set_default_report(report_id: str, api_key: str = Depends(verify_api_key)):
    """
    Set default report.
    """
    set_default_report(report_id, DB_PATH)
    return StatusOutput(status_code=200)

## 删除报告
@app.post("/report/delete", response_model=StatusOutput, tags=["report_delete"])
async def api_delete_report(input_data: ReportIdInput, api_key: str = Depends(verify_api_key)):
    """
    Delete a report.
    """
    delete_report(input_data.report_id, DB_PATH)
    return StatusOutput(status_code=200)

## 更新报告自定义名称
@app.post("/report/rename", response_model=StatusOutput, tags=["report_rename"])
async def api_update_report_name(report_id: str, new_name: str, api_key: str = Depends(verify_api_key)):
    """
    Rename a report.
    """
    update_report_name(report_id, new_name, DB_PATH)
    return StatusOutput(status_code=200)

## 查询报告信息 - 从GET改为POST
@app.post("/report/{report_id}/info", tags=["report_info"])
async def api_get_report_info(report_id: str, api_key: str = Depends(verify_api_key)):
    """
    Get report info.
    """
    try:
        result = get_report_info(report_id, DB_PATH)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询报告信息失败: {str(e)}")

## 列出所有的报告ID - 从GET改为POST
@app.post("/report/id", tags=["report_id"])
async def api_list_all_report_ids(api_key: str = Depends(verify_api_key)):
    """
    List all reports ID.
    """
    try:
        result = list_all_report_ids(DB_PATH)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取报告列表失败: {str(e)}")

## 列出所有的报告
@app.post("/report/all", tags=["report_all"])
async def api_get_all_report_info(api_key: str = Depends(verify_api_key)):
    """
    List all reports.
    """
    try:
        result = get_all_report_info(DB_PATH)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取报告列表失败: {str(e)}")

## 查询祖源分析结果 - 从GET改为POST
@app.post("/report/{report_id}/admixture", tags=["admixture_info"])
async def api_get_admixture_info(report_id: str, api_key: str = Depends(verify_api_key)):
    """
    Admixture query.
    """
    try:
        result = get_admixture_info(report_id, DB_PATH)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询祖源分析结果失败: {str(e)}")

## 查询单倍群结果 - 从GET改为POST
@app.post("/report/{report_id}/haplogroup", tags=["haplogroup_info"])
async def api_get_haplogroup_info(report_id: str, api_key: str = Depends(verify_api_key)):
    """
    Haplogroup query.
    """
    try:
        result = get_haplogroup_info(report_id, DB_PATH)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询单倍群结果失败: {str(e)}")

## 查询位点信息
@app.post("/variant/rsid", tags=["variant_rsid"])
async def api_get_snp_info_by_rsid(input_data: RsidInput, api_key: str = Depends(verify_api_key)):
    """
    RSID query.
    """
    try:
        result = get_snp_info_by_rsid(input_data.rsid, input_data.report_id, DB_PATH)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询位点信息失败: {str(e)}")

# 添加表格数据查询的请求模型
class TableQueryInput(BaseModel):
    report_id: str
    page_size: int = 1000
    page: int = 1
    sort_by: str = ""  # 修改为空字符串，而不是 None
    sort_order: str = "asc"
    search_term: str = ""  # 同样修改为空字符串
    filters: dict = {}

## 查询表格数据
@app.post("/report/table", tags=["report_table"])
async def api_get_table_data(input_data: TableQueryInput, api_key: str = Depends(verify_api_key)):
    """
    查询报告表格数据，支持分页、排序、搜索和筛选。
    """
    try:
        from scripts.rootara_table_info import get_all_snp_info
        result = get_all_snp_info(
            input_data.report_id,
            DB_PATH,
            input_data.page_size,
            input_data.page,
            input_data.sort_by,
            input_data.sort_order,
            input_data.search_term,
            input_data.filters
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询表格数据失败: {str(e)}")

# 添加ClinVar数据查询的请求模型
class ClinvarQueryInput(BaseModel):
    report_id: str
    sort_by: str = ""  # 默认为空字符串
    sort_order: str = "asc"
    search_term: str = ""  # 默认为空字符串
    filters: dict = {}
    indel: bool = False  # 是否包含插入删除变异

## 查询ClinVar数据
@app.post("/report/clinvar", tags=["report_clinvar"])
async def api_get_clinvar_data(input_data: ClinvarQueryInput, api_key: str = Depends(verify_api_key)):
    """
    查询报告中的ClinVar数据，支持分页、排序、搜索和筛选。
    返回结果包含致病性分类统计信息。
    """
    try:
        result = get_clinvar_data(
            input_data.report_id,
            DB_PATH,
            input_data.sort_by,
            input_data.sort_order,
            input_data.search_term,
            input_data.filters,
            input_data.indel
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询ClinVar数据失败: {str(e)}")

# 请求模型
class TraitInput(BaseModel):
    name: str                  # 特征名称
    description: str           # 特征描述
    scoreThresholds: str       # 分数阈值
    icon: str                  # 图标
    confidence: str            # 置信度
    category: str              # 分类
    rsids: List[str]           # rsid列表
    formula: str               # 公式
    result: str                # 结果（不同语言下的结果）
    reference: List[str]       # 参考文献列表

# 新增自定义特征
@app.post("/traits/add", tags=["traits_add"])
async def api_add_trait(input_data: TraitInput, api_key: str = Depends(verify_api_key)):
    """
    新增特征
    """
    add_trait(input_data.model_dump(), DB_PATH)
    return StatusOutput(status_code=201)

# 删除自定义特征
@app.post("/traits/delete", tags=["traits_delete"])
async def api_delete_trait(traits_id, api_key: str = Depends(verify_api_key)):
    """
    删除特征
    """
    delete_trait(traits_id, DB_PATH)
    return StatusOutput(status_code=200)

# 导入自定义特征
class TraitImportItem(BaseModel):
    id: str = Field(..., description="特征ID，导入时使用原始ID")
    name: Union[Dict[str, str], str] = Field(..., description="特征名称，可以是字符串或多语言字典")
    description: Union[Dict[str, str], str] = Field(..., description="特征描述，可以是字符串或多语言字典")
    icon: str = Field(..., description="图标")
    confidence: str = Field(..., description="置信度")
    category: str = Field(..., description="分类")
    rsids: List[str] = Field(default=[], description="rsid列表")
    formula: str = Field(..., description="公式")
    scoreThresholds: Union[Dict[str, Any], str] = Field(..., description="分数阈值")
    result: Union[Dict[str, Any], str] = Field(..., description="结果（不同语言下的结果）")
    reference: List[str] = Field(default=[], description="参考文献列表")

class TraitImportRequest(RootModel):
    root: List[TraitImportItem] = Field(..., description="要导入的特征列表")

@app.post("/traits/import", tags=["traits_import"])
async def api_import_trait(input_data: TraitImportRequest, api_key: str = Depends(verify_api_key)):
    """
    导入特征
    """
    # 将Pydantic模型转换为字典列表
    traits_list = [trait.model_dump() for trait in input_data.root]
    self_json_to_trait_table(traits_list, DB_PATH)
    return StatusOutput(status_code=201)

# 导出自定义特征
class TraitExportItem(BaseModel):
    id: str = Field(..., description="特征ID")
    name: Dict[str, str] = Field(..., description="特征名称，多语言字典")
    description: Dict[str, str] = Field(..., description="特征描述，多语言字典")
    icon: str = Field(..., description="图标")
    confidence: str = Field(..., description="置信度")
    isDefault: bool = Field(..., description="是否为默认特征")
    createdAt: str = Field(..., description="创建时间")
    category: str = Field(..., description="分类")
    rsids: List[str] = Field(..., description="rsid列表")
    formula: str = Field(..., description="公式")
    scoreThresholds: Dict[str, Any] = Field(..., description="分数阈值")
    result: Dict[str, Any] = Field(..., description="结果（不同语言下的结果）")
    reference: List[str] = Field(..., description="参考文献列表")

class TraitExportResponse(RootModel):
    root: List[TraitExportItem] = Field(..., description="导出的特征列表")

# 导出自定义特征
@app.post("/traits/export", tags=["traits_export"], response_model=TraitExportResponse)
async def api_export_trait(api_key: str = Depends(verify_api_key)):
    """
    导出特征
    """
    traits_json = self_traits_to_json(DB_PATH)
    # 将JSON字符串转换为Python对象
    traits_data = json.loads(traits_json)
    return TraitExportResponse(root=traits_data)

# 特征结果数据表
@app.post("/traits/info", tags=["traits_info"])
async def api_get_traits_info(report_id, api_key: str = Depends(verify_api_key)):
    """
    特征结果数据表
    """
    result = get_legacy_traits_payload(report_id, DB_PATH)
    return result


@app.get("/traits/catalog", tags=["traits_catalog"])
async def api_get_trait_catalog(
    request: Request,
    api_key: str = Depends(verify_api_key),
):
    """Return report-independent card summaries with a stable ETag."""

    payload = get_catalog_payload(DB_PATH)
    etag = f'"{payload["version"]}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})
    return JSONResponse(
        payload,
        headers={
            "ETag": etag,
            "Cache-Control": "private, max-age=300, must-revalidate",
        },
    )


@app.get("/reports/{report_id}/traits/results", tags=["traits_results"])
async def api_get_trait_results(report_id: str, api_key: str = Depends(verify_api_key)):
    """Evaluate the full catalog with one indexed report query."""

    return get_report_results(report_id, DB_PATH)


@app.get("/traits/{trait_id}", tags=["traits_detail"])
async def api_get_trait_detail(
    trait_id: str,
    report_id: str,
    api_key: str = Depends(verify_api_key),
):
    detail = get_trait_detail(trait_id, report_id, DB_PATH)
    if detail is None:
        raise HTTPException(status_code=404, detail="trait not found")
    return detail

# ================================
# 健康检查和监控端点
# ================================

@app.get("/health", tags=["monitoring"])
async def health_check():
    """
    健康检查端点 (无需API密钥)
    """
    try:
        health_checker = get_health_checker(DB_PATH)
        health_status = health_checker.perform_health_check()

        # 根据健康状态设置HTTP状态码
        status_code = 200
        if health_status.status == 'degraded':
            status_code = 200  # 降级但仍可用
        elif health_status.status == 'unhealthy':
            status_code = 503  # 服务不可用

        return Response(
            content=health_status.model_dump_json() if hasattr(health_status, 'model_dump_json') else json.dumps(health_status, default=lambda value: value.__dict__, ensure_ascii=False),
            status_code=status_code,
            media_type="application/json"
        )

    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        return Response(
            content='{"status": "error", "message": "健康检查失败"}',
            status_code=500,
            media_type="application/json"
        )

@app.get("/health/live", tags=["monitoring"])
async def liveness_check():
    """
    存活性检查端点 (简单检查)
    """
    return {"status": "alive", "timestamp": time.time()}

@app.get("/health/ready", tags=["monitoring"])
async def readiness_check():
    """
    就绪性检查端点
    """
    try:
        # 检查数据库连接
        db_pool = get_db_pool(DB_PATH)
        with db_pool.get_connection_context() as conn:
            conn.execute("SELECT 1")

        catalog = get_trait_catalog_metadata()
        expected_count = os.environ.get("ROOTARA_EXPECTED_TRAIT_COUNT")
        if expected_count and catalog["count"] != int(expected_count):
            raise RuntimeError("trait catalog count does not match release contract")
        if catalog["statuses"].get("missing", 0):
            raise RuntimeError("trait catalog has missing evidence records")
        if not persisted_trait_catalog_matches(catalog):
            raise RuntimeError("persisted trait catalog metadata is missing or stale")
        if os.environ.get("ROOTARA_REQUIRE_CURATED_CATALOG") == "1":
            if catalog["statuses"].get("curated", 0) != catalog["count"]:
                raise RuntimeError("release requires a fully curated trait catalog")

        backfill = get_report_backfill_status(DB_PATH, catalog["locus_hash"])
        if not backfill["ready"]:
            raise RuntimeError("one or more reports have not passed the current trait import migration")

        return {
            "status": "ready",
            "timestamp": time.time(),
            "traitCatalog": catalog,
            "traitImporter": backfill,
        }

    except Exception as e:
        logger.error(f"就绪性检查失败: {e}")
        return Response(
            content=json.dumps({"status": "not_ready", "error": str(e)}, ensure_ascii=False),
            status_code=503,
            media_type="application/json"
        )

@app.get("/metrics", tags=["monitoring"])
async def get_metrics(api_key: str = Depends(verify_api_key)):
    """
    获取系统性能指标
    """
    try:
        health_checker = get_health_checker(DB_PATH)
        health_status = health_checker.perform_health_check()

        # 数据库连接池统计
        db_pool = get_db_pool(DB_PATH)
        db_stats = db_pool.get_stats()

        # 缓存统计
        cache_stats = cache_manager.get_stats()

        metrics = {
            "timestamp": time.time(),
            "health_status": health_status.status,
            "uptime_seconds": health_status.uptime_seconds,
            "system_metrics": health_status.details.get("system", {}),
            "database_pool": db_stats,
            "cache": cache_stats,
            "checks": health_status.checks
        }

        return metrics

    except Exception as e:
        logger.error(f"获取指标失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取指标失败: {str(e)}")

@app.post("/admin/cache/clear", tags=["admin"])
async def clear_cache(api_key: str = Depends(verify_api_key)):
    """
    清空缓存 (管理员功能)
    """
    try:
        result = cache_manager.clear_all()
        logger.info("管理员清空了所有缓存")

        return {
            "status": "success" if result else "failed",
            "message": "缓存已清空" if result else "清空缓存失败",
            "timestamp": time.time()
        }

    except Exception as e:
        logger.error(f"清空缓存失败: {e}")
        raise HTTPException(status_code=500, detail=f"清空缓存失败: {str(e)}")

@app.get("/admin/logs/recent", tags=["admin"])
async def get_recent_logs(api_key: str = Depends(verify_api_key), lines: int = 100):
    """
    获取最近的日志 (管理员功能)
    """
    try:
        log_file = os.environ.get('LOG_FILE')
        if not log_file or not os.path.exists(log_file):
            return {"error": "日志文件不存在或未配置"}

        # 读取最后N行日志
        with open(log_file, 'r', encoding='utf-8') as f:
            log_lines = f.readlines()

        recent_logs = log_lines[-lines:] if len(log_lines) > lines else log_lines

        return {
            "total_lines": len(log_lines),
            "returned_lines": len(recent_logs),
            "logs": [line.strip() for line in recent_logs]
        }

    except Exception as e:
        logger.error(f"获取日志失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取日志失败: {str(e)}")

# --- 运行应用 (通常在命令行中做，这里用于测试) ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=os.environ.get("ROOTARA_BACKEND_HOST", "127.0.0.1"),
        port=int(os.environ.get("ROOTARA_BACKEND_PORT", "8000")),
    )
