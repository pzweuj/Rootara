use crate::archive::{find_rawdata_export, RawdataSource};
use crate::auth::constant_time_eq_str;
use crate::reports::{
    delete_report, get_admixture_info, get_all_report_info, get_clinvar_data, get_haplogroup_info,
    get_report_info, get_snp_info_by_rsid, get_user_id, list_all_report_ids, set_default_report,
    update_report_name, ClinvarQueryParams, TableQueryParams,
};
use crate::state::AppState;
use crate::traits::{
    add_trait, catalog_for_db, custom_revision, delete_trait, export_custom_traits,
    get_catalog_payload, get_legacy_traits_payload, get_report_results, get_trait_detail,
    get_trait_highlights, import_custom_traits, report_revision_key,
};
use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Path as AxumPath, Query, Request, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_DISPOSITION, CONTENT_TYPE, ETAG, IF_NONE_MATCH};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use bytes::Bytes;
use futures_util::StreamExt;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::fs;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command as TokioCommand;
use tokio::sync::mpsc;
use tokio_util::io::ReaderStream;
use uuid::Uuid;

pub fn build_private_router(state: Arc<AppState>) -> Router {
    let protected = Router::new()
        .route("/user/id", post(priv_get_user_id))
        .route("/report/create", post(priv_create_report))
        .route(
            "/imports/{job}",
            post(handle_submit_import).get(handle_import_status),
        )
        .route("/report/{report_id}/rawdata", post(priv_export_rawdata))
        .route("/report/default", post(priv_set_default_report))
        .route("/report/delete", post(handle_delete_report))
        .route("/report/rename", post(priv_rename_report))
        .route("/report/{report_id}/info", post(priv_get_report_info))
        .route("/report/id", post(priv_list_report_ids))
        .route("/report/all", post(handle_get_all_reports))
        .route("/reports/{report_id}/dashboard", get(handle_dashboard))
        .route("/report/{report_id}/admixture", post(priv_get_admixture))
        .route("/report/{report_id}/haplogroup", post(priv_get_haplogroup))
        .route("/variant/rsid", post(handle_variant_rsid))
        .route("/report/table", post(handle_table_data))
        .route("/report/clinvar", post(handle_clinvar_data))
        .route("/traits/add", post(priv_add_trait))
        .route("/traits/delete", post(priv_delete_trait))
        .route("/traits/import", post(priv_import_traits))
        .route("/traits/export", post(priv_export_traits))
        .route("/traits/info", post(priv_traits_info))
        .route("/traits/catalog", get(handle_trait_catalog))
        .route(
            "/reports/{report_id}/traits/results",
            get(handle_trait_results),
        )
        .route("/traits/{trait_id}", get(handle_trait_detail))
        .route("/metrics", get(priv_metrics))
        .route("/admin/cache/clear", post(priv_clear_cache))
        .route("/admin/logs/recent", get(priv_recent_logs))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            require_api_key,
        ));

    Router::new()
        .route("/health", get(priv_health))
        .route("/health/live", get(priv_health_live))
        .route("/health/ready", get(priv_health_ready))
        .merge(protected)
        .layer(DefaultBodyLimit::disable())
        .layer(middleware::from_fn(request_headers_middleware))
        .with_state(state)
}

async fn request_headers_middleware(req: Request, next: Next) -> Response {
    let request_id = Uuid::new_v4().to_string();
    let start = Instant::now();
    let mut response = next.run(req).await;
    let duration = start.elapsed().as_secs_f64();
    if let Ok(v) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", v);
    }
    if let Ok(v) = HeaderValue::from_str(&format!("{duration:.3}s")) {
        response.headers_mut().insert("x-response-time", v);
    }
    response
}

async fn require_api_key(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    req: Request,
    next: Next,
) -> Response {
    let provided = headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if provided.is_empty() || !constant_time_eq_str(provided, &state.cfg.api_key) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "detail": "无效的API密钥" })),
        )
            .into_response();
    }
    next.run(req).await
}

pub fn json_error(status: StatusCode, detail: impl Into<String>) -> Response {
    (status, Json(json!({ "detail": detail.into() }))).into_response()
}

// =========================================================================
// Shared handlers (used by both private :8000 and public :3000)
// =========================================================================

pub async fn priv_get_user_id(State(state): State<Arc<AppState>>) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || get_user_id(&db_path)).await {
        Ok(Ok(uid)) => Json(json!({ "status_code": 200, "user_id": uid })).into_response(),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Deserialize)]
pub struct CreateReportInput {
    pub user_id: String,
    pub input_data: String,
    pub source_from: String,
    pub report_name: String,
    #[serde(default)]
    pub default_report: bool,
}

pub async fn priv_create_report(
    State(state): State<Arc<AppState>>,
    Json(input): Json<CreateReportInput>,
) -> Response {
    if !matches!(
        input.source_from.as_str(),
        "ancestry" | "23andme" | "wegene"
    ) {
        return json_error(StatusCode::UNPROCESSABLE_ENTITY, "Unsupported data source");
    }
    match state
        .import_queue
        .submit_direct_report(
            input.user_id,
            input.input_data,
            input.source_from,
            input.report_name,
            input.default_report,
        )
        .await
    {
        Ok(_) => Json(json!({ "status_code": 201 })).into_response(),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Deserialize)]
pub struct SubmitImportQuery {
    pub source: String,
    pub name: String,
    #[serde(default)]
    pub default: bool,
}

pub async fn handle_submit_import(
    State(state): State<Arc<AppState>>,
    AxumPath(job): AxumPath<Uuid>,
    Query(query): Query<SubmitImportQuery>,
    body: Body,
) -> Response {
    if !matches!(query.source.as_str(), "23andme" | "ancestry" | "wegene") {
        return json_error(StatusCode::UNPROCESSABLE_ENTITY, "Invalid source");
    }
    if query.name.trim().is_empty() || query.name.len() > 200 {
        return json_error(StatusCode::UNPROCESSABLE_ENTITY, "Invalid report name");
    }

    if let Err(e) = tokio::fs::create_dir_all(&state.cfg.imports_dir).await {
        return json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string());
    }
    let part_path = state
        .cfg
        .imports_dir
        .join(format!("receiving-{}.part", Uuid::new_v4()));

    let write_res: Result<usize, Response> = async {
        let mut file = tokio::fs::File::create(&part_path)
            .await
            .map_err(|e| json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        let mut stream = body.into_data_stream();
        let mut size: usize = 0;
        let max_body = state.cfg.max_body;
        while let Some(chunk_res) = stream.next().await {
            let chunk =
                chunk_res.map_err(|e| json_error(StatusCode::BAD_REQUEST, e.to_string()))?;
            size = size.saturating_add(chunk.len());
            if size > max_body {
                return Err(json_error(
                    StatusCode::PAYLOAD_TOO_LARGE,
                    "Maximum upload size is 50 MiB",
                ));
            }
            file.write_all(&chunk)
                .await
                .map_err(|e| json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
        file.flush()
            .await
            .map_err(|e| json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        Ok(size)
    }
    .await;

    let size = match write_res {
        Ok(s) => s,
        Err(resp) => {
            let _ = tokio::fs::remove_file(&part_path).await;
            return resp;
        }
    };

    if size == 0 {
        let _ = tokio::fs::remove_file(&part_path).await;
        return json_error(StatusCode::UNPROCESSABLE_ENTITY, "Empty upload");
    }

    let job_str = job.to_string();
    let state_clone = state.clone();
    let part_clone = part_path.clone();
    let source = query.source;
    let name = query.name;
    let is_default = query.default;
    let job_for_task = job_str.clone();

    let enqueue_res = tokio::task::spawn_blocking(move || {
        let user_id = get_user_id(&state_clone.cfg.db_path)?.unwrap_or_default();
        state_clone.import_queue.enqueue(
            &job_for_task,
            &part_clone,
            &user_id,
            &source,
            &name,
            is_default,
        )
    })
    .await;

    let _ = tokio::fs::remove_file(&part_path).await;

    match enqueue_res {
        Ok(Ok(())) => (StatusCode::ACCEPTED, Json(json!({ "id": job_str }))).into_response(),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

pub async fn handle_import_status(
    State(state): State<Arc<AppState>>,
    AxumPath(job): AxumPath<Uuid>,
) -> Response {
    let job_str = job.to_string();
    let queue = state.import_queue.clone();
    match tokio::task::spawn_blocking(move || queue.status(&job_str)).await {
        Ok(Ok(Some(val))) => Json(val).into_response(),
        Ok(Ok(None)) => json_error(StatusCode::NOT_FOUND, "Import not found"),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

pub async fn stream_rawdata(
    state: Arc<AppState>,
    report_id: String,
    content_type: &'static str,
    no_store: bool,
) -> Response {
    let rawdata_dir = state.cfg.rawdata_dir.clone();
    let found =
        match tokio::task::spawn_blocking(move || find_rawdata_export(&rawdata_dir, &report_id))
            .await
        {
            Ok(Ok(opt)) => opt,
            Ok(Err(e)) => return json_error(StatusCode::BAD_REQUEST, e.to_string()),
            Err(e) => return json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        };

    let Some(source) = found else {
        return json_error(StatusCode::NOT_FOUND, "原始数据文件不存在或无法读取");
    };

    let (download_name, body) = match source {
        RawdataSource::Text {
            path,
            download_name,
        } => {
            let file = match tokio::fs::File::open(&path).await {
                Ok(f) => f,
                Err(_) => {
                    return json_error(StatusCode::NOT_FOUND, "原始数据文件不存在或无法读取");
                }
            };
            let stream = ReaderStream::with_capacity(file, 128 * 1024);
            (download_name, Body::from_stream(stream))
        }
        RawdataSource::Parquet {
            path,
            download_name,
        } => {
            let permit = match state.download_slot.clone().acquire_owned().await {
                Ok(p) => p,
                Err(e) => return json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            };
            let archive_tool = state.cfg.archive_tool.clone();
            let (tx, rx) = mpsc::channel::<std::io::Result<Bytes>>(4);
            tokio::spawn(async move {
                let _permit = permit;
                let child_res = TokioCommand::new(&archive_tool)
                    .arg("export")
                    .arg(&path)
                    .stdout(Stdio::piped())
                    .kill_on_drop(true)
                    .spawn();
                let mut child = match child_res {
                    Ok(c) => c,
                    Err(e) => {
                        let _ = tx.send(Err(e)).await;
                        return;
                    }
                };
                let Some(mut stdout) = child.stdout.take() else {
                    let _ = tx
                        .send(Err(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            "missing stdout",
                        )))
                        .await;
                    return;
                };
                let mut buf = vec![0u8; 128 * 1024];
                loop {
                    match stdout.read(&mut buf).await {
                        Ok(0) => break,
                        Ok(n) => {
                            if tx
                                .send(Ok(Bytes::copy_from_slice(&buf[..n])))
                                .await
                                .is_err()
                            {
                                let _ = child.kill().await;
                                let _ = child.wait().await;
                                return;
                            }
                        }
                        Err(e) => {
                            let _ = tx.send(Err(e)).await;
                            let _ = child.kill().await;
                            let _ = child.wait().await;
                            return;
                        }
                    }
                }
                if let Ok(status) = child.wait().await {
                    if !status.success() {
                        let _ = tx
                            .send(Err(std::io::Error::new(
                                std::io::ErrorKind::Other,
                                "Parquet export failed",
                            )))
                            .await;
                    }
                }
            });
            let stream = futures_util::stream::unfold(rx, |mut rx| async move {
                rx.recv().await.map(|item| (item, rx))
            });
            (download_name, Body::from_stream(stream))
        }
    };

    let mut resp = Response::new(body);
    resp.headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static(content_type));
    if let Ok(cd) = HeaderValue::from_str(&format!("attachment; filename={download_name}")) {
        resp.headers_mut().insert(CONTENT_DISPOSITION, cd);
    }
    if no_store {
        resp.headers_mut()
            .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    }
    resp
}

async fn priv_export_rawdata(
    State(state): State<Arc<AppState>>,
    AxumPath(report_id): AxumPath<String>,
) -> Response {
    stream_rawdata(state, report_id, "text/plain", false).await
}

#[derive(Deserialize)]
struct ReportIdQuery {
    report_id: String,
}

async fn priv_set_default_report(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ReportIdQuery>,
) -> Response {
    set_default_inner(state, q.report_id).await
}

pub async fn set_default_inner(state: Arc<AppState>, report_id: String) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || set_default_report(&report_id, &db_path)).await {
        Ok(Ok(())) => Json(json!({ "status_code": 200 })).into_response(),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Deserialize)]
pub struct ReportIdBody {
    pub report_id: String,
}

pub async fn handle_delete_report(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ReportIdBody>,
) -> Response {
    let db_path = state.cfg.db_path.clone();
    let rawdata_dir = state.cfg.rawdata_dir.clone();
    let rid = body.report_id.clone();
    let res =
        tokio::task::spawn_blocking(move || delete_report(&rid, &db_path, &rawdata_dir)).await;
    state.cache.delete("admixture", &body.report_id);
    match res {
        Ok(Ok(())) => Json(json!({ "status_code": 200 })).into_response(),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Deserialize)]
struct RenameQuery {
    report_id: String,
    new_name: String,
}

async fn priv_rename_report(
    State(state): State<Arc<AppState>>,
    Query(q): Query<RenameQuery>,
) -> Response {
    rename_inner(state, q.report_id, q.new_name).await
}

pub async fn rename_inner(state: Arc<AppState>, report_id: String, new_name: String) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || update_report_name(&report_id, &new_name, &db_path))
        .await
    {
        Ok(Ok(())) => Json(json!({ "status_code": 200 })).into_response(),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn priv_get_report_info(
    State(state): State<Arc<AppState>>,
    AxumPath(report_id): AxumPath<String>,
) -> Response {
    report_info_inner(state, report_id).await
}

pub async fn report_info_inner(state: Arc<AppState>, report_id: String) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || get_report_info(&report_id, &db_path)).await {
        Ok(Ok(val)) => Json(val).into_response(),
        Ok(Err(e)) => json_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("查询报告信息失败: {e}"),
        ),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn priv_list_report_ids(State(state): State<Arc<AppState>>) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || list_all_report_ids(&db_path)).await {
        Ok(Ok(ids)) => Json(ids).into_response(),
        Ok(Err(e)) => json_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("获取报告列表失败: {e}"),
        ),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

pub async fn handle_get_all_reports(State(state): State<Arc<AppState>>) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || get_all_report_info(&db_path)).await {
        Ok(Ok(list)) => Json(list).into_response(),
        Ok(Err(e)) => json_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("获取报告列表失败: {e}"),
        ),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

pub async fn handle_dashboard(
    State(state): State<Arc<AppState>>,
    AxumPath(report_id): AxumPath<String>,
) -> Response {
    let state_clone = state.clone();
    let res = tokio::task::spawn_blocking(move || -> anyhow::Result<Option<Value>> {
        let info = get_report_info(&report_id, &state_clone.cfg.db_path)?;
        let Some(info_row) = info else {
            return Ok(None);
        };
        let total_snps = info_row.get(6).cloned().unwrap_or(Value::Null);
        let cat_ver = catalog_for_db(&state_clone.cfg, &state_clone.cfg.db_path)?.version;
        let rep_rev = report_revision_key(&state_clone.cfg.db_path, &report_id)?;
        let cache_key = format!("{report_id}|{total_snps}|{cat_ver}|{rep_rev}");

        if let Some(hit) = state_clone.dashboard_cache.lock().unwrap().get(&cache_key) {
            return Ok(Some(hit));
        }

        let ancestry = get_admixture_info(
            &report_id,
            &state_clone.cfg.db_path,
            Some(&state_clone.cache),
        )?;
        let haplogroups = get_haplogroup_info(&report_id, &state_clone.cfg.db_path)?;
        let clinvar = get_clinvar_data(
            &ClinvarQueryParams {
                report_id: report_id.clone(),
                page: None,
                page_size: 10,
                summary: true,
                classification: None,
                sort_by: String::new(),
                sort_order: "asc".to_string(),
                search_term: String::new(),
                filters: Map::new(),
                indel: false,
            },
            &state_clone.cfg.db_path,
        )?;
        let traits = get_trait_highlights(&state_clone.cfg, &report_id, &state_clone.cfg.db_path)?;
        let snapshot = json!({
            "totalSnps": total_snps,
            "ancestry": ancestry,
            "haplogroups": haplogroups,
            "clinvar": clinvar,
            "traits": traits,
        });
        state_clone
            .dashboard_cache
            .lock()
            .unwrap()
            .put(cache_key, snapshot.clone());
        Ok(Some(snapshot))
    })
    .await;

    match res {
        Ok(Ok(Some(val))) => Json(val).into_response(),
        Ok(Ok(None)) => json_error(StatusCode::NOT_FOUND, "Report not found"),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn priv_get_admixture(
    State(state): State<Arc<AppState>>,
    AxumPath(report_id): AxumPath<String>,
) -> Response {
    admixture_inner(state, report_id).await
}

pub async fn admixture_inner(state: Arc<AppState>, report_id: String) -> Response {
    let db_path = state.cfg.db_path.clone();
    let cache = state.cache.clone();
    match tokio::task::spawn_blocking(move || {
        get_admixture_info(&report_id, &db_path, Some(&cache))
    })
    .await
    {
        Ok(Ok(val)) => Json(val).into_response(),
        Ok(Err(e)) => json_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("查询祖源分析结果失败: {e}"),
        ),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn priv_get_haplogroup(
    State(state): State<Arc<AppState>>,
    AxumPath(report_id): AxumPath<String>,
) -> Response {
    haplogroup_inner(state, report_id).await
}

pub async fn haplogroup_inner(state: Arc<AppState>, report_id: String) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || get_haplogroup_info(&report_id, &db_path)).await {
        Ok(Ok(val)) => Json(val).into_response(),
        Ok(Err(e)) => json_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("查询单倍群结果失败: {e}"),
        ),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Deserialize)]
pub struct RsidInput {
    pub rsid: Vec<String>,
    pub report_id: String,
}

pub async fn handle_variant_rsid(
    State(state): State<Arc<AppState>>,
    Json(input): Json<RsidInput>,
) -> Response {
    variant_rsid_inner(state, input.rsid, input.report_id).await
}

pub async fn variant_rsid_inner(
    state: Arc<AppState>,
    rsids: Vec<String>,
    report_id: String,
) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || get_snp_info_by_rsid(&rsids, &report_id, &db_path))
        .await
    {
        Ok(Ok(val)) => Json(val).into_response(),
        Ok(Err(e)) => json_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("查询位点信息失败: {e}"),
        ),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Deserialize)]
pub struct TableQueryInput {
    pub report_id: String,
    #[serde(default = "default_table_page_size")]
    pub page_size: usize,
    #[serde(default = "default_page_one")]
    pub page: usize,
    #[serde(default)]
    pub sort_by: String,
    #[serde(default = "default_asc")]
    pub sort_order: String,
    #[serde(default)]
    pub search_term: String,
    #[serde(default)]
    pub filters: Map<String, Value>,
}

fn default_table_page_size() -> usize {
    1000
}
fn default_page_one() -> usize {
    1
}
fn default_asc() -> String {
    "asc".to_string()
}

pub async fn handle_table_data(
    State(state): State<Arc<AppState>>,
    Json(input): Json<TableQueryInput>,
) -> Response {
    if input.page < 1 || input.page_size < 1 || input.page_size > 5000 {
        return json_error(StatusCode::UNPROCESSABLE_ENTITY, "Invalid pagination");
    }
    let db_path = state.cfg.db_path.clone();
    let params = TableQueryParams {
        report_id: input.report_id,
        page_size: input.page_size,
        page: input.page,
        sort_by: input.sort_by,
        sort_order: input.sort_order,
        search_term: input.search_term,
        filters: input.filters,
    };
    match tokio::task::spawn_blocking(move || crate::reports::get_all_snp_info(&params, &db_path))
        .await
    {
        Ok(Ok(val)) => Json(val).into_response(),
        Ok(Err(e)) => json_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("查询表格数据失败: {e}"),
        ),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Deserialize)]
pub struct ClinvarQueryInput {
    pub page: Option<usize>,
    #[serde(default = "default_clinvar_page_size")]
    pub page_size: usize,
    #[serde(default)]
    pub summary: bool,
    pub classification: Option<String>,
    pub report_id: String,
    #[serde(default)]
    pub sort_by: String,
    #[serde(default = "default_asc")]
    pub sort_order: String,
    #[serde(default)]
    pub search_term: String,
    #[serde(default)]
    pub filters: Map<String, Value>,
    #[serde(default)]
    pub indel: bool,
}

fn default_clinvar_page_size() -> usize {
    10
}

pub async fn handle_clinvar_data(
    State(state): State<Arc<AppState>>,
    Json(input): Json<ClinvarQueryInput>,
) -> Response {
    if input.page_size < 1 || input.page_size > 500 || input.page.is_some_and(|p| p < 1) {
        return json_error(StatusCode::UNPROCESSABLE_ENTITY, "Invalid pagination");
    }
    clinvar_inner(state, input).await
}

pub async fn clinvar_inner(state: Arc<AppState>, input: ClinvarQueryInput) -> Response {
    let db_path = state.cfg.db_path.clone();
    let params = ClinvarQueryParams {
        report_id: input.report_id,
        page: input.page,
        page_size: input.page_size,
        summary: input.summary,
        classification: input.classification,
        sort_by: input.sort_by,
        sort_order: input.sort_order,
        search_term: input.search_term,
        filters: input.filters,
        indel: input.indel,
    };
    match tokio::task::spawn_blocking(move || get_clinvar_data(&params, &db_path)).await {
        Ok(Ok(val)) => Json(val).into_response(),
        Ok(Err(e)) => json_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("查询ClinVar数据失败: {e}"),
        ),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn priv_add_trait(State(state): State<Arc<AppState>>, Json(input): Json<Value>) -> Response {
    add_trait_inner(state, input).await
}

pub async fn add_trait_inner(state: Arc<AppState>, input: Value) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || add_trait(&input, &db_path, true, false)).await {
        Ok(Ok(())) => Json(json!({ "status_code": 201 })).into_response(),
        Ok(Err(e)) => json_error(StatusCode::UNPROCESSABLE_ENTITY, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Deserialize)]
struct DeleteTraitQuery {
    traits_id: String,
}

async fn priv_delete_trait(
    State(state): State<Arc<AppState>>,
    Query(q): Query<DeleteTraitQuery>,
) -> Response {
    delete_trait_inner(state, q.traits_id).await
}

pub async fn delete_trait_inner(state: Arc<AppState>, traits_id: String) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || delete_trait(&traits_id, &db_path)).await {
        Ok(Ok(())) => Json(json!({ "status_code": 200 })).into_response(),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn priv_import_traits(
    State(state): State<Arc<AppState>>,
    Json(items): Json<Vec<Value>>,
) -> Response {
    import_traits_inner(state, items).await
}

pub async fn import_traits_inner(state: Arc<AppState>, items: Vec<Value>) -> Response {
    let db_path = state.cfg.db_path.clone();
    match tokio::task::spawn_blocking(move || import_custom_traits(&items, &db_path)).await {
        Ok(Ok(())) => Json(json!({ "status_code": 201 })).into_response(),
        Ok(Err(e)) => json_error(StatusCode::UNPROCESSABLE_ENTITY, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn priv_export_traits(State(state): State<Arc<AppState>>) -> Response {
    let cfg = state.cfg.clone();
    match tokio::task::spawn_blocking(move || export_custom_traits(&cfg, &cfg.db_path)).await {
        Ok(Ok(items)) => Json(items).into_response(),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn priv_traits_info(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ReportIdQuery>,
) -> Response {
    traits_info_inner(state, q.report_id).await
}

pub async fn traits_info_inner(state: Arc<AppState>, report_id: String) -> Response {
    let cfg = state.cfg.clone();
    match tokio::task::spawn_blocking(move || {
        get_legacy_traits_payload(&cfg, &report_id, &cfg.db_path)
    })
    .await
    {
        Ok(Ok(list)) => Json(list).into_response(),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

pub async fn handle_trait_catalog(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Response {
    let state_clone = state.clone();
    let payload = match tokio::task::spawn_blocking(move || -> anyhow::Result<Value> {
        let rev = custom_revision(&state_clone.cfg.db_path);
        let key = format!("{}|{rev}", state_clone.cfg.db_path.display());
        if let Some(hit) = state_clone.catalog_cache.lock().unwrap().get(&key) {
            return Ok(hit);
        }
        let val = get_catalog_payload(&state_clone.cfg, &state_clone.cfg.db_path)?;
        state_clone
            .catalog_cache
            .lock()
            .unwrap()
            .put(key, val.clone());
        Ok(val)
    })
    .await
    {
        Ok(Ok(val)) => val,
        Ok(Err(e)) => return json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => return json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };

    let version = payload.get("version").and_then(Value::as_str).unwrap_or("");
    let etag = format!("\"{version}\"");
    if headers.get(IF_NONE_MATCH).and_then(|v| v.to_str().ok()) == Some(etag.as_str()) {
        let mut resp = Response::new(Body::empty());
        *resp.status_mut() = StatusCode::NOT_MODIFIED;
        if let Ok(v) = HeaderValue::from_str(&etag) {
            resp.headers_mut().insert(ETAG, v);
        }
        return resp;
    }

    let mut resp = Json(payload).into_response();
    if let Ok(v) = HeaderValue::from_str(&etag) {
        resp.headers_mut().insert(ETAG, v);
    }
    resp.headers_mut().insert(
        CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=300, must-revalidate"),
    );
    resp
}

pub async fn handle_trait_results(
    State(state): State<Arc<AppState>>,
    AxumPath(report_id): AxumPath<String>,
) -> Response {
    let state_clone = state.clone();
    let res = tokio::task::spawn_blocking(move || -> anyhow::Result<Option<Value>> {
        if get_report_info(&report_id, &state_clone.cfg.db_path)?.is_none() {
            return Ok(None);
        }
        let cat_ver = catalog_for_db(&state_clone.cfg, &state_clone.cfg.db_path)?.version;
        let rep_rev = report_revision_key(&state_clone.cfg.db_path, &report_id)?;
        let cache_key = format!(
            "{report_id}|{}|{cat_ver}|{rep_rev}",
            state_clone.cfg.db_path.display()
        );
        if let Some(hit) = state_clone.results_cache.lock().unwrap().get(&cache_key) {
            return Ok(Some(hit));
        }
        let val = get_report_results(&state_clone.cfg, &report_id, &state_clone.cfg.db_path)?;
        state_clone
            .results_cache
            .lock()
            .unwrap()
            .put(cache_key, val.clone());
        Ok(Some(val))
    })
    .await;

    match res {
        Ok(Ok(Some(val))) => Json(val).into_response(),
        Ok(Ok(None)) => json_error(StatusCode::NOT_FOUND, "Report not found"),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Deserialize)]
pub struct TraitDetailQuery {
    pub report_id: String,
}

pub async fn handle_trait_detail(
    State(state): State<Arc<AppState>>,
    AxumPath(trait_id): AxumPath<String>,
    Query(q): Query<TraitDetailQuery>,
) -> Response {
    let cfg = state.cfg.clone();
    match tokio::task::spawn_blocking(move || {
        get_trait_detail(&cfg, &trait_id, &q.report_id, &cfg.db_path)
    })
    .await
    {
        Ok(Ok(Some(val))) => Json(val).into_response(),
        Ok(Ok(None)) => json_error(StatusCode::NOT_FOUND, "trait not found"),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn priv_health(State(state): State<Arc<AppState>>) -> Response {
    let state_clone = state.clone();
    let (code, payload) = tokio::task::spawn_blocking(move || {
        state_clone
            .health
            .full_health(&state_clone.cfg, &state_clone.db_pool, &state_clone.cache)
    })
    .await
    .unwrap_or_else(|_| (500, json!({"status": "error", "message": "健康检查失败"})));
    (
        StatusCode::from_u16(code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
        Json(payload),
    )
        .into_response()
}

async fn priv_health_live() -> Response {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64();
    Json(json!({ "status": "alive", "timestamp": ts })).into_response()
}

async fn priv_health_ready(State(state): State<Arc<AppState>>) -> Response {
    let state_clone = state.clone();
    let (code, payload) = tokio::task::spawn_blocking(move || {
        state_clone
            .health
            .readiness(&state_clone.cfg, &state_clone.db_pool)
    })
    .await
    .unwrap_or_else(|e| (503, json!({"status": "not_ready", "error": e.to_string()})));
    (
        StatusCode::from_u16(code).unwrap_or(StatusCode::SERVICE_UNAVAILABLE),
        Json(payload),
    )
        .into_response()
}

async fn priv_metrics(State(state): State<Arc<AppState>>) -> Response {
    let state_clone = state.clone();
    let res = tokio::task::spawn_blocking(move || {
        let (_code, health_val) = state_clone.health.full_health(
            &state_clone.cfg,
            &state_clone.db_pool,
            &state_clone.cache,
        );
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs_f64();
        json!({
            "timestamp": ts,
            "health_status": health_val.get("status").cloned().unwrap_or(Value::Null),
            "uptime_seconds": health_val.get("uptime_seconds").cloned().unwrap_or(Value::Null),
            "system_metrics": health_val.get("details").and_then(|d| d.get("system")).cloned().unwrap_or_else(|| json!({})),
            "database_pool": state_clone.db_pool.stats(),
            "cache": state_clone.cache.get_stats(),
            "checks": health_val.get("checks").cloned().unwrap_or_else(|| json!({})),
        })
    })
    .await;

    match res {
        Ok(val) => Json(val).into_response(),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn priv_clear_cache(State(state): State<Arc<AppState>>) -> Response {
    state.clear_all_caches();
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64();
    Json(json!({
        "status": "success",
        "message": "缓存已清空",
        "timestamp": ts,
    }))
    .into_response()
}

#[derive(Deserialize)]
struct RecentLogsQuery {
    #[serde(default = "default_log_lines")]
    lines: usize,
}
fn default_log_lines() -> usize {
    100
}

async fn priv_recent_logs(
    State(state): State<Arc<AppState>>,
    Query(q): Query<RecentLogsQuery>,
) -> Response {
    let Some(path) = state.cfg.log_file.clone() else {
        return Json(json!({ "error": "日志文件不存在或未配置" })).into_response();
    };
    if !path.exists() {
        return Json(json!({ "error": "日志文件不存在或未配置" })).into_response();
    }
    match tokio::task::spawn_blocking(move || -> anyhow::Result<Value> {
        let content = fs::read_to_string(&path)?;
        let all: Vec<&str> = content.lines().collect();
        let start = all.len().saturating_sub(q.lines);
        let recent: Vec<String> = all[start..].iter().map(|s| s.trim().to_string()).collect();
        Ok(json!({
            "total_lines": all.len(),
            "returned_lines": recent.len(),
            "logs": recent,
        }))
    })
    .await
    {
        Ok(Ok(val)) => Json(val).into_response(),
        Ok(Err(e)) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}
