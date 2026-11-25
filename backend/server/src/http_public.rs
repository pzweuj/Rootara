use crate::auth::{
    constant_time_eq_sha256, decode_jwt_hs256, encode_jwt_hs256, extract_cookie, SessionClaims,
};
use crate::config::SESSION_SECONDS;
use crate::http_private::{
    add_trait_inner, admixture_inner, clinvar_inner, delete_trait_inner, handle_clinvar_data,
    handle_dashboard, handle_delete_report, handle_get_all_reports, handle_import_status,
    handle_submit_import, handle_table_data, handle_trait_catalog, handle_trait_detail,
    handle_trait_results, haplogroup_inner, import_traits_inner, json_error, priv_create_report,
    priv_get_user_id, rename_inner, report_info_inner, set_default_inner, stream_rawdata,
    traits_info_inner, variant_rsid_inner, ClinvarQueryInput,
};
use crate::state::AppState;
use crate::traits::export_custom_traits;
use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Path as AxumPath, Request, State};
use axum::http::header::{
    CACHE_CONTROL, CONTENT_DISPOSITION, CONTENT_LENGTH, CONTENT_TYPE, COOKIE, LOCATION, SET_COOKIE,
};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get, post};
use axum::{Extension, Json, Router};
use chrono::Local;
use http_body_util::BodyExt;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

const OPEN_PATHS: &[&str] = &[
    "/login",
    "/login.txt",
    "/login.html",
    "/health",
    "/health/live",
    "/health/ready",
    "/api/auth/login",
    "/api/auth/logout",
];

#[derive(Clone)]
struct SessionUser(Option<Value>);

pub fn build_public_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/auth/login", post(pub_login))
        .route("/api/auth/logout", post(pub_logout))
        .route("/api/auth/me", get(pub_me))
        .route("/health/live", get(pub_health_live))
        .route("/health/ready", get(pub_health_ready))
        .route("/health", get(pub_health))
        .route(
            "/api/imports/{job}",
            post(handle_submit_import).get(handle_import_status),
        )
        .route("/api/reports/{report_id}/dashboard", get(handle_dashboard))
        .route(
            "/api/reports/{report_id}/traits/results",
            get(handle_trait_results),
        )
        .route("/api/traits/catalog", get(handle_trait_catalog))
        .route("/api/traits/{trait_id}", get(handle_trait_detail))
        .route("/api/user/id", post(priv_get_user_id))
        .route("/api/report/all", post(handle_get_all_reports))
        .route("/api/report/create", post(priv_create_report))
        .route("/api/report/delete", post(handle_delete_report))
        .route("/api/report/table", post(handle_table_data))
        .route("/api/report/clinvar", post(handle_clinvar_data))
        .route(
            "/api/report/{report_id}/rawdata",
            get(pub_rawdata).post(pub_rawdata),
        )
        .route("/api/report/info", post(pub_report_info))
        .route("/api/report/default", post(pub_default_report))
        .route("/api/report/rename", post(pub_rename))
        .route("/api/ancestry/admixture", post(pub_admixture))
        .route("/api/ancestry/haplogroup", post(pub_haplogroup))
        .route("/api/report/clinvar-summary", post(pub_clinvar_summary))
        .route("/api/variant/rsid", post(pub_variant))
        .route("/api/traits/info", post(pub_traits_info))
        .route("/api/traits/delete", post(pub_delete_trait))
        .route("/api/traits/add", post(pub_add_trait))
        .route("/api/traits/import", post(pub_import_traits))
        .route("/api/traits/export", post(pub_export_traits))
        .fallback(any(serve_exported_pages))
        .layer(DefaultBodyLimit::disable())
        .layer(middleware::from_fn_with_state(
            state.clone(),
            public_auth_and_limit_middleware,
        ))
        .with_state(state)
}

fn is_static_asset_path(path: &str) -> bool {
    if path.starts_with("/api/") {
        return false;
    }
    if path.starts_with("/_next/static/") {
        return true;
    }
    const EXTS: &[&str] = &[".svg", ".png", ".ico", ".jpg", ".jpeg", ".gif"];
    EXTS.iter().any(|ext| path.ends_with(ext))
}

fn redirect_response(location: &str, clear_cookie: bool) -> Response {
    let mut resp = Response::new(Body::empty());
    *resp.status_mut() = StatusCode::TEMPORARY_REDIRECT;
    if let Ok(v) = HeaderValue::from_str(location) {
        resp.headers_mut().insert(LOCATION, v);
    }
    if clear_cookie {
        resp.headers_mut().insert(
            SET_COOKIE,
            HeaderValue::from_static("auth_token=; Max-Age=0; Path=/; HttpOnly"),
        );
    }
    resp
}

async fn public_auth_and_limit_middleware(
    State(state): State<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();

    if path.split('/').any(|seg| seg == "..") {
        return StatusCode::NOT_FOUND.into_response();
    }

    if is_static_asset_path(&path) {
        req.extensions_mut().insert(SessionUser(None));
        return next.run(req).await;
    }

    let cookie_header = req
        .headers()
        .get(COOKIE)
        .and_then(|v| v.to_str().ok())
        .map(String::from);
    let has_auth_cookie = cookie_header
        .as_deref()
        .and_then(|h| extract_cookie(h, "auth_token"))
        .is_some();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let user = cookie_header
        .as_deref()
        .and_then(|h| extract_cookie(h, "auth_token"))
        .and_then(|tok| decode_jwt_hs256(tok, &state.cfg.jwt_secret, now));

    let trimmed = path.trim_end_matches('/');
    if trimmed == "/login" && user.is_some() {
        return redirect_response("/", false);
    }

    let is_open = OPEN_PATHS.contains(&trimmed);
    if user.is_none() && !is_open {
        if path.starts_with("/api/") {
            let mut resp = (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Unauthorized" })),
            )
                .into_response();
            if has_auth_cookie {
                resp.headers_mut().insert(
                    SET_COOKIE,
                    HeaderValue::from_static("auth_token=; Max-Age=0; Path=/; HttpOnly"),
                );
            }
            return resp;
        }
        return redirect_response("/login", has_auth_cookie);
    }

    req.extensions_mut().insert(SessionUser(user));

    // Enforce MAX_BODY on POST requests before body ingestion.
    // Streaming upload `/api/imports/{job}` enforces the same MAX_BODY while spooling to disk.
    if req.method() == Method::POST {
        let max_body = state.cfg.max_body;
        if let Some(cl) = req
            .headers()
            .get(CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<usize>().ok())
        {
            if cl > max_body {
                return json_error(
                    StatusCode::PAYLOAD_TOO_LARGE,
                    "Maximum upload size is 50 MiB",
                );
            }
        }
        if !path.starts_with("/api/imports/") {
            let (parts, body) = req.into_parts();
            let mut collected: Vec<u8> = Vec::new();
            let mut stream = body.into_data_stream();
            while let Some(chunk_res) = futures_util::StreamExt::next(&mut stream).await {
                match chunk_res {
                    Ok(chunk) => {
                        if collected.len().saturating_add(chunk.len()) > max_body {
                            return json_error(
                                StatusCode::PAYLOAD_TOO_LARGE,
                                "Maximum upload size is 50 MiB",
                            );
                        }
                        collected.extend_from_slice(&chunk);
                    }
                    Err(e) => return json_error(StatusCode::BAD_REQUEST, e.to_string()),
                }
            }
            req = Request::from_parts(parts, Body::from(collected));
        }
    }

    next.run(req).await
}

async fn pub_login(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(creds): Json<Value>,
) -> Response {
    let email = creds.get("email").and_then(Value::as_str);
    let password = creds.get("password").and_then(Value::as_str);
    let expected_email = &state.cfg.admin_email;
    let expected_password = &state.cfg.admin_password;

    let valid = match (email, password) {
        (Some(em), Some(pw)) => {
            em == expected_email.as_str() && constant_time_eq_sha256(pw, expected_password)
        }
        _ => false,
    };
    if !valid {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Invalid credentials" })),
        )
            .into_response();
    }

    let name = expected_email
        .split('@')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("Admin")
        .to_string();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let claims = SessionClaims {
        email: expected_email.clone(),
        name: name.clone(),
        iat: now,
        exp: now + SESSION_SECONDS,
    };
    let token = match encode_jwt_hs256(&claims, &state.cfg.jwt_secret) {
        Ok(t) => t,
        Err(e) => return json_error(StatusCode::INTERNAL_SERVER_ERROR, e),
    };

    let secure = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        == Some("https");
    let cookie = if secure {
        format!(
            "auth_token={token}; Max-Age={SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict"
        )
    } else {
        format!("auth_token={token}; Max-Age={SESSION_SECONDS}; Path=/; HttpOnly; SameSite=Lax")
    };

    let mut resp = Json(json!({ "email": expected_email, "name": name })).into_response();
    if let Ok(v) = HeaderValue::from_str(&cookie) {
        resp.headers_mut().insert(SET_COOKIE, v);
    }
    resp
}

async fn pub_logout() -> Response {
    let mut resp = Json(json!({ "success": true })).into_response();
    resp.headers_mut().insert(
        SET_COOKIE,
        HeaderValue::from_static("auth_token=; Max-Age=0; Path=/; HttpOnly"),
    );
    resp
}

async fn pub_me(Extension(user): Extension<SessionUser>) -> Response {
    match user.0 {
        Some(claims) => Json(claims).into_response(),
        None => (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Unauthorized" })),
        )
            .into_response(),
    }
}

async fn pub_health_live() -> Response {
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    Json(json!({ "status": "alive", "timestamp": ms })).into_response()
}

async fn pub_health_ready(State(state): State<Arc<AppState>>) -> Response {
    let state_clone = state.clone();
    let (code, backend) = tokio::task::spawn_blocking(move || {
        state_clone
            .health
            .readiness(&state_clone.cfg, &state_clone.db_pool)
    })
    .await
    .unwrap_or_else(|e| {
        (
            503,
            json!({ "status": "not_ready", "error": e.to_string() }),
        )
    });

    if code != 200 {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "status": "not_ready", "backend": backend })),
        )
            .into_response();
    }
    Json(json!({ "status": "ready", "backend": backend })).into_response()
}

async fn pub_health(State(state): State<Arc<AppState>>) -> Response {
    let state_clone = state.clone();
    let version = state.cfg.version.clone();
    let (code, payload) = tokio::task::spawn_blocking(move || {
        state_clone
            .health
            .full_health(&state_clone.cfg, &state_clone.db_pool, &state_clone.cache)
    })
    .await
    .unwrap_or_else(|_| (500, json!({ "status": "error", "message": "健康检查失败" })));

    let trait_catalog = payload
        .get("checks")
        .and_then(|c| c.get("trait_catalog"))
        .cloned()
        .unwrap_or(Value::Null);
    (
        StatusCode::from_u16(code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
        Json(json!({
            "status": if code == 200 { "healthy" } else { "degraded" },
            "version": version,
            "backend": payload,
            "traitCatalog": trait_catalog,
        })),
    )
        .into_response()
}

async fn pub_rawdata(
    State(state): State<Arc<AppState>>,
    AxumPath(report_id): AxumPath<String>,
) -> Response {
    stream_rawdata(state, report_id, "application/octet-stream", true).await
}

#[derive(Deserialize)]
struct ReportIdCamel {
    #[serde(rename = "reportId")]
    report_id: String,
}

async fn pub_report_info(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ReportIdCamel>,
) -> Response {
    report_info_inner(state, body.report_id).await
}

#[derive(Deserialize)]
struct ReportIdSnake {
    report_id: String,
}

async fn pub_default_report(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ReportIdSnake>,
) -> Response {
    set_default_inner(state, body.report_id).await
}

#[derive(Deserialize)]
struct RenameBody {
    report_id: String,
    new_name: String,
}

async fn pub_rename(State(state): State<Arc<AppState>>, Json(body): Json<RenameBody>) -> Response {
    rename_inner(state, body.report_id, body.new_name).await
}

async fn pub_admixture(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ReportIdCamel>,
) -> Response {
    admixture_inner(state, body.report_id).await
}

async fn pub_haplogroup(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ReportIdCamel>,
) -> Response {
    haplogroup_inner(state, body.report_id).await
}

async fn pub_clinvar_summary(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ReportIdCamel>,
) -> Response {
    clinvar_inner(
        state,
        ClinvarQueryInput {
            page: None,
            page_size: 10,
            summary: true,
            classification: None,
            report_id: body.report_id,
            sort_by: String::new(),
            sort_order: "asc".to_string(),
            search_term: String::new(),
            filters: Map::new(),
            indel: false,
        },
    )
    .await
}

#[derive(Deserialize)]
struct VariantBody {
    rsid: String,
    #[serde(rename = "reportId")]
    report_id: String,
}

async fn pub_variant(
    State(state): State<Arc<AppState>>,
    Json(body): Json<VariantBody>,
) -> Response {
    variant_rsid_inner(state, vec![body.rsid], body.report_id).await
}

async fn pub_traits_info(State(state): State<Arc<AppState>>, req: Request) -> Response {
    let query_report = req.uri().query().and_then(|q| {
        q.split('&').find_map(|pair| {
            let (k, v) = pair.split_once('=')?;
            (k == "report_id").then(|| percent_decode(v))
        })
    });
    let bytes = req
        .into_body()
        .collect()
        .await
        .map(|c| c.to_bytes())
        .unwrap_or_default();
    let body_report = serde_json::from_slice::<Value>(&bytes)
        .ok()
        .and_then(|v| v.get("report_id").and_then(Value::as_str).map(String::from));

    let report_id = body_report
        .filter(|s| !s.is_empty())
        .or_else(|| query_report.filter(|s| !s.is_empty()));
    let Some(rid) = report_id else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "report_id is required" })),
        )
            .into_response();
    };
    traits_info_inner(state, rid).await
}

#[derive(Deserialize)]
struct DeleteTraitBody {
    traits_id: String,
}

async fn pub_delete_trait(
    State(state): State<Arc<AppState>>,
    Json(body): Json<DeleteTraitBody>,
) -> Response {
    delete_trait_inner(state, body.traits_id).await
}

#[derive(Deserialize)]
struct AddTraitWrapper {
    #[serde(rename = "traitData")]
    trait_data: Map<String, Value>,
}

async fn pub_add_trait(
    State(state): State<Arc<AppState>>,
    Json(wrapper): Json<AddTraitWrapper>,
) -> Response {
    let mut data = wrapper.trait_data;
    for key in ["name", "description", "scoreThresholds", "result"] {
        if let Some(val) = data.get(key) {
            if !val.is_string() {
                if let Ok(s) = serde_json::to_string(val) {
                    data.insert(key.to_string(), Value::String(s));
                }
            }
        }
    }
    let is_falsy = |v: Option<&Value>| match v {
        None | Some(Value::Null) => true,
        Some(Value::String(s)) => s.is_empty(),
        Some(Value::Array(a)) => a.is_empty(),
        Some(Value::Bool(b)) => !b,
        _ => false,
    };
    for (key, default) in [
        ("icon", Value::String("AlertCircle".to_string())),
        ("confidence", Value::String("medium".to_string())),
        ("category", Value::String("appearance".to_string())),
        ("rsids", Value::Array(Vec::new())),
        ("formula", Value::String(String::new())),
    ] {
        if is_falsy(data.get(key)) {
            data.insert(key.to_string(), default);
        }
    }

    let refs_normalized: Vec<Value> = data
        .get("reference")
        .and_then(Value::as_array)
        .filter(|arr| arr.iter().all(|v| v.is_string()))
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .flat_map(|s| s.split(','))
                .map(|p| Value::String(p.trim().to_string()))
                .collect()
        })
        .unwrap_or_default();
    data.insert("reference".to_string(), Value::Array(refs_normalized));

    // Validate required TraitInput fields
    let required_str = [
        "name",
        "description",
        "scoreThresholds",
        "icon",
        "confidence",
        "category",
        "formula",
        "result",
    ];
    for k in required_str {
        if !data.get(k).map(Value::is_string).unwrap_or(false) {
            return json_error(StatusCode::UNPROCESSABLE_ENTITY, "Invalid trait");
        }
    }
    if !data
        .get("rsids")
        .and_then(Value::as_array)
        .map(|a| a.iter().all(Value::is_string))
        .unwrap_or(false)
    {
        return json_error(StatusCode::UNPROCESSABLE_ENTITY, "Invalid trait");
    }

    add_trait_inner(state, Value::Object(data)).await
}

#[derive(Deserialize)]
struct ImportTraitsWrapper {
    input_data: String,
}

async fn pub_import_traits(
    State(state): State<Arc<AppState>>,
    Json(wrapper): Json<ImportTraitsWrapper>,
) -> Response {
    let parsed: Result<Vec<Value>, _> = serde_json::from_str(&wrapper.input_data);
    let Ok(items) = parsed else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Expected a JSON array of traits" })),
        )
            .into_response();
    };
    for item in &items {
        let ok = item.is_object()
            && item.get("id").map(Value::is_string).unwrap_or(false)
            && item.get("icon").map(Value::is_string).unwrap_or(false)
            && item
                .get("confidence")
                .map(Value::is_string)
                .unwrap_or(false)
            && item.get("category").map(Value::is_string).unwrap_or(false)
            && item.get("formula").map(Value::is_string).unwrap_or(false)
            && item.get("name").is_some()
            && item.get("description").is_some()
            && item.get("scoreThresholds").is_some()
            && item.get("result").is_some();
        if !ok {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Expected a JSON array of traits" })),
            )
                .into_response();
        }
    }
    import_traits_inner(state, items).await
}

async fn pub_export_traits(State(state): State<Arc<AppState>>) -> Response {
    let cfg = state.cfg.clone();
    let items =
        match tokio::task::spawn_blocking(move || export_custom_traits(&cfg, &cfg.db_path)).await {
            Ok(Ok(v)) => v,
            Ok(Err(e)) => return json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            Err(e) => return json_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        };
    let body = serde_json::to_string_pretty(&items).unwrap_or_else(|_| "[]".to_string());
    let today = Local::now().format("%Y-%m-%d");
    let mut resp = Response::new(Body::from(body));
    resp.headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    if let Ok(cd) = HeaderValue::from_str(&format!(
        "attachment; filename=\"traits-export-{today}.json\""
    )) {
        resp.headers_mut().insert(CONTENT_DISPOSITION, cd);
    }
    resp
}

fn percent_encode_query(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push('+'),
            _ => {
                use std::fmt::Write;
                let _ = write!(&mut out, "%{b:02X}");
            }
        }
    }
    out
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
        } else if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(v) = u8::from_str_radix(hex, 16) {
                    out.push(v);
                    i += 3;
                    continue;
                }
            }
            out.push(bytes[i]);
            i += 1;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

async fn serve_exported_pages(State(state): State<Arc<AppState>>, req: Request) -> Response {
    if req.method() != Method::GET && req.method() != Method::HEAD {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }
    let raw_path = req.uri().path().trim_start_matches('/');
    let mut rel = raw_path.to_string();

    if rel.is_empty() || rel == "." {
        rel = "index.html".to_string();
    } else if rel.starts_with("analysis/traits/") && rel.matches('/').count() == 2 {
        let last = rel.rsplit('/').next().unwrap_or("");
        if !matches!(last, "detail" | "detail.html" | "detail.txt") {
            let target = format!("/analysis/traits/detail?id={}", percent_encode_query(last));
            return redirect_response(&target, false);
        }
        if !last.contains('.') {
            rel.push_str(".html");
        }
    } else {
        let last = rel.rsplit('/').next().unwrap_or("");
        if !last.contains('.') {
            rel.push_str(".html");
        }
    }

    if rel.contains("..") || rel.contains('\\') || rel.contains('\0') {
        return StatusCode::NOT_FOUND.into_response();
    }

    let mut full_path: PathBuf = state.cfg.web_root.clone();
    for seg in rel.split('/') {
        if !seg.is_empty() {
            full_path.push(seg);
        }
    }

    let bytes = match tokio::fs::read(&full_path).await {
        Ok(b) => b,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    let mime = mime_guess::from_path(&full_path).first_or_octet_stream();
    let cache_ctrl = if rel.starts_with("_next/static/") {
        "public, max-age=31536000, immutable"
    } else {
        "private, no-cache"
    };

    let mut resp = if req.method() == Method::HEAD {
        Response::new(Body::empty())
    } else {
        Response::new(Body::from(bytes))
    };
    if let Ok(ct) = HeaderValue::from_str(mime.as_ref()) {
        resp.headers_mut().insert(CONTENT_TYPE, ct);
    }
    resp.headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static(cache_ctrl));
    resp
}
