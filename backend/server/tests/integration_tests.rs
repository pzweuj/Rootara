use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use flate2::write::GzEncoder;
use flate2::Compression;
use http_body_util::BodyExt;
use rootara_server::auth::{encode_jwt_hs256, SessionClaims};
use rootara_server::cache::CacheManager;
use rootara_server::config::{load_or_create_jwt_secret, RuntimeConfig};
use rootara_server::db::{init_sqlite_schema, open_connection};
use rootara_server::http_private::build_private_router;
use rootara_server::http_public::build_public_router;
use rootara_server::reference::build_reference;
use rootara_server::reports::{
    get_all_snp_info, get_clinvar_data, write_haplogroup_vcf, ClinvarQueryParams, TableQueryParams,
};
use rootara_server::state::AppState;
use rootara_server::traits::{
    backfill_report, ensure_report_rsid_indexes, forward_genotype, get_catalog_payload,
    get_report_results, get_trait_catalog_metadata, json_to_trait_table, load_locus_registry,
    parse_formula, persist_trait_catalog_metadata, persisted_trait_catalog_matches,
    validate_production_catalog, FormulaError, FormulaValue,
};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tempfile::TempDir;
use tower::ServiceExt;

fn repo_backend_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf()
}

fn test_config(tmp: &Path) -> RuntimeConfig {
    let backend_root = repo_backend_root();
    let database_dir = backend_root.join("database");
    let data_dir = tmp.join("data");
    let web_root = tmp.join("web");
    fs::create_dir_all(&data_dir).unwrap();
    fs::create_dir_all(&web_root).unwrap();
    fs::create_dir_all(data_dir.join("config")).unwrap();
    fs::create_dir_all(data_dir.join("rawdata")).unwrap();
    fs::create_dir_all(data_dir.join("temp")).unwrap();
    fs::create_dir_all(data_dir.join("imports")).unwrap();

    RuntimeConfig {
        version: "2.0.0".to_string(),
        core_database_path: database_dir.join("Rootara.core.sqlite"),
        template_path: database_dir.join("TEMPLATE01.txt"),
        default_traits_path: database_dir.join("default-traits.json"),
        trait_evidence_path: database_dir.join("trait-evidence.json"),
        trait_locus_path: database_dir.join("trait-locus-registry.json"),
        normalized_trait_catalog_path: database_dir.join("trait-catalog.json"),
        trait_catalog_state_path: data_dir.join("config").join("trait-catalog.json"),
        admix_data: database_dir.join("admix"),
        haplogrouper_dir: backend_root.join("haploGrouper"),
        temp_dir: data_dir.join("temp"),
        rawdata_dir: data_dir.join("rawdata"),
        imports_dir: data_dir.join("imports"),
        jwt_secret_path: data_dir.join("config").join("jwt-secret"),
        db_path: data_dir.join("rootara.db"),
        backend_root,
        web_root,
        data_dir,
        database_dir,
        reader_path: "rootara-reader".to_string(),
        archive_tool: "rootara-archive".to_string(),
        admix_tool: "admixrs".to_string(),
        haplogrouper_tool: "haplogrouper-rs".to_string(),
        admin_email: "demo@example.invalid".to_string(),
        admin_password: "temporary password".to_string(),
        jwt_secret: "test-test-test-test-test-test-test-test-".to_string(),
        api_key: "test-internal-key".to_string(),
        public_host: "127.0.0.1".to_string(),
        public_port: 3000,
        backend_host: "127.0.0.1".to_string(),
        backend_port: 8000,
        disable_public: false,
        expected_trait_count: Some(152),
        require_curated_catalog: true,
        cache_ttl_secs: 3600.0,
        cache_max_entries: 1024,
        max_body: 50 * 1024 * 1024,
        log_file: None,
    }
}

fn seed_report_db(db_path: &Path, report_id: &str) {
    init_sqlite_schema(db_path).unwrap();
    let conn = open_connection(db_path).unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO reports(report_id, user_id, file_format, data_source, name, select_default, total_snps, upload_date)
         VALUES (?, 'ID_TEST123456', 'txt', '23andme', 'TEST', 1, 0, '2026-01-01')",
        [report_id],
    )
    .unwrap();
    conn.execute_batch(&format!(
        "DROP TABLE IF EXISTS {report_id};
         CREATE TABLE {report_id}(
            id INTEGER PRIMARY KEY, chromosome TEXT, position INTEGER,
            ref TEXT, alt TEXT, gnomAD_AF REAL, gene TEXT, clnsig TEXT,
            clndn TEXT, rsid TEXT, genotype TEXT, gt TEXT
         );"
    ))
    .unwrap();
}

#[test]
fn test_formula_parser_rules() {
    let mut map = HashMap::new();
    map.insert("rs1".to_string(), "AA".to_string());
    assert!(matches!(
        parse_formula("SCORE(rs1:AA=10,AG=5,GG=0; rs2:CC=5,CT=3,TT=0)", &map),
        Err(FormulaError::InsufficientData(_))
    ));

    let mut nn = HashMap::new();
    nn.insert("rs1".to_string(), "NN".to_string());
    assert!(matches!(
        parse_formula("SCORE(rs1:AA=10,AG=5,GG=0)", &nn),
        Err(FormulaError::InsufficientData(_))
    ));

    assert!(matches!(
        parse_formula("IF(rs1:AA=true,GG=false)", &HashMap::new()),
        Err(FormulaError::InsufficientData(_))
    ));

    let mut abcc_tt = HashMap::new();
    abcc_tt.insert("rs17822931".to_string(), "TT".to_string());
    assert!(matches!(
        parse_formula("SCORE(rs17822931:TT=0,CT=5,CC=10)", &abcc_tt),
        Ok(FormulaValue::Score(s)) if (s - 0.0).abs() < 1e-9
    ));

    let mut abcc_cc = HashMap::new();
    abcc_cc.insert("rs17822931".to_string(), "CC".to_string());
    assert!(matches!(
        parse_formula("SCORE(rs17822931:TT=0,CT=5,CC=10)", &abcc_cc),
        Ok(FormulaValue::Score(s)) if (s - 10.0).abs() < 1e-9
    ));

    let mut ga = HashMap::new();
    ga.insert("rs1".to_string(), "GA".to_string());
    assert!(matches!(
        parse_formula("SCORE(rs1:AG=7,AA=0,GG=0)", &ga),
        Ok(FormulaValue::Score(s)) if (s - 7.0).abs() < 1e-9
    ));

    let mut combined = HashMap::new();
    combined.insert("rs1".to_string(), "CT".to_string());
    combined.insert("rs2".to_string(), "TT".to_string());
    assert!(matches!(
        parse_formula(
            "IF(rs1:CT=true,CC=false,TT=false){SCORE(rs2:TT=10,CT=5,CC=0)}ELSE{SCORE(rs2:TT=1,CT=0,CC=0)}",
            &combined
        ),
        Ok(FormulaValue::Score(s)) if (s - 10.0).abs() < 1e-9
    ));
}

#[test]
fn test_jwt_secret_created_and_reused() {
    let tmp = TempDir::new().unwrap();
    let secret_path = tmp.path().join("config").join("jwt-secret");
    let first = load_or_create_jwt_secret(&secret_path).unwrap();
    let second = load_or_create_jwt_secret(&secret_path).unwrap();
    assert!(first.len() >= 32);
    assert_eq!(first, second);
}

#[test]
fn test_cache_manager_ttl_and_lru() {
    let cache = CacheManager::new(60.0, 2);
    cache.set("cat", "a", json!(1), None);
    cache.set("cat", "b", json!(2), None);
    assert_eq!(cache.get("cat", "a"), Some(json!(1)));
    cache.set("cat", "c", json!(3), None);
    assert_eq!(cache.get("cat", "b"), None);
    assert_eq!(cache.get("cat", "a"), Some(json!(1)));
    assert_eq!(cache.get("cat", "c"), Some(json!(3)));
    cache.clear_all();
    assert_eq!(cache.get("cat", "a"), None);
}

#[test]
fn test_production_catalog_validation_and_metadata() {
    let tmp = TempDir::new().unwrap();
    let cfg = test_config(tmp.path());
    let errors = validate_production_catalog(&cfg, 152);
    assert!(errors.is_empty(), "catalog errors: {errors:?}");

    let metadata = get_trait_catalog_metadata(&cfg).unwrap();
    assert_eq!(metadata["count"], 152);
    assert_eq!(metadata["locus_count"], 154);
    assert_eq!(metadata["verified_locus_count"], 154);
    assert_eq!(metadata["statuses"]["curated"], 152);

    persist_trait_catalog_metadata(&metadata, &cfg.trait_catalog_state_path).unwrap();
    assert!(persisted_trait_catalog_matches(&cfg, &metadata));
}

#[test]
fn test_default_catalog_sync_and_rollback() {
    let tmp = TempDir::new().unwrap();
    let cfg = test_config(tmp.path());
    init_sqlite_schema(&cfg.db_path).unwrap();
    let conn = open_connection(&cfg.db_path).unwrap();
    conn.execute_batch(
        "CREATE TABLE traits (id TEXT PRIMARY KEY, name TEXT, description TEXT, icon TEXT,
            confidence TEXT, isDefault BOOLEAN, createdAt TIMESTAMP, category TEXT, rsids TEXT,
            formula TEXT, scoreThresholds TEXT, result TEXT, reference TEXT);
         INSERT INTO traits VALUES ('old-default', '{}', '{}', 'Dna', 'low', 1, '2020', 'internal', 'rs2', 'SCORE(rs2:AA=1)', '{}', '{}', '');
         INSERT INTO traits VALUES ('TRA_CUSTOM', '{}', '{}', 'Dna', 'low', 0, '2020', 'internal', 'rs3', 'SCORE(rs3:AA=1)', '{}', '{}', '');",
    )
    .unwrap();
    drop(conn);

    json_to_trait_table(&cfg.default_traits_path, &cfg.db_path).unwrap();
    json_to_trait_table(&cfg.default_traits_path, &cfg.db_path).unwrap();

    let conn = open_connection(&cfg.db_path).unwrap();
    let defaults: i64 = conn
        .query_row("SELECT COUNT(*) FROM traits WHERE isDefault = 1", [], |r| {
            r.get(0)
        })
        .unwrap();
    let custom: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM traits WHERE isDefault = 0 AND id = 'TRA_CUSTOM'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(defaults, 152);
    assert_eq!(custom, 1);
}

#[test]
fn test_template_backfill_and_compact_catalog() {
    let tmp = TempDir::new().unwrap();
    let cfg = test_config(tmp.path());
    seed_report_db(&cfg.db_path, "RPT_TEMPLATE01");
    ensure_report_rsid_indexes(&cfg.db_path).unwrap();

    let catalog = get_catalog_payload(&cfg, &cfg.db_path).unwrap();
    let empty_results = get_report_results(&cfg, "RPT_TEMPLATE01", &cfg.db_path).unwrap();
    assert_eq!(catalog["count"], 152);
    assert_eq!(empty_results["count"], 152);
    let arr = empty_results["results"].as_array().unwrap();
    assert!(arr.iter().all(|item| item["status"] == "insufficient_data"));
    let serialized =
        serde_json::to_string(&json!({"catalog": catalog, "results": empty_results})).unwrap();
    assert!(
        serialized.len() < 120_000,
        "payload too large: {}",
        serialized.len()
    );
    assert!(!serialized.contains("\"N/A\""));
    assert!(!serialized.contains("\"NA\""));

    let (loci, registry_hash) = load_locus_registry(&cfg.trait_locus_path).unwrap();
    let added = backfill_report(
        &cfg,
        &cfg.db_path,
        "RPT_TEMPLATE01",
        "23andme",
        &loci,
        &registry_hash,
    )
    .unwrap();
    assert_eq!(added, 129);
    // Second run is idempotent and returns 0
    assert_eq!(
        backfill_report(
            &cfg,
            &cfg.db_path,
            "RPT_TEMPLATE01",
            "23andme",
            &loci,
            &registry_hash,
        )
        .unwrap(),
        0
    );

    let results = get_report_results(&cfg, "RPT_TEMPLATE01", &cfg.db_path).unwrap();
    let ok_count = results["results"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|i| i["status"] == "ok")
        .count();
    assert_eq!(ok_count, 127);
    let rs495828 = results["results"]
        .as_array()
        .unwrap()
        .iter()
        .find(|i| i["traitId"] == "gwas-gcst000565-rs495828")
        .unwrap();
    assert_eq!(rs495828["status"], "ok");
    assert_eq!(rs495828["genotypes"], json!({"rs495828": "GG"}));
}

#[test]
fn test_orientation_and_mmp1_spdi() {
    let locus =
        json!({"traitAlleles": ["A", "G"], "grch38": {"reference": "A", "alternates": ["G"]}});
    assert_eq!(forward_genotype("TC", &locus, "reverse").unwrap(), "AG");
    let ambig =
        json!({"traitAlleles": ["A", "T"], "grch38": {"reference": "A", "alternates": ["T"]}});
    assert!(forward_genotype("AA", &ambig, "auto").is_err());

    let tmp = TempDir::new().unwrap();
    let cfg = test_config(tmp.path());
    let report_id = "RPT_47Z37DVO3Y";
    seed_report_db(&cfg.db_path, report_id);
    fs::write(
        cfg.rawdata_dir.join("RDT_47Z37DVO3Y.23andme.txt"),
        "rs1799750\t11\t102670495\tDI\n",
    )
    .unwrap();
    let (loci, registry_hash) = load_locus_registry(&cfg.trait_locus_path).unwrap();
    assert_eq!(
        backfill_report(
            &cfg,
            &cfg.db_path,
            report_id,
            "23andme",
            &loci,
            &registry_hash
        )
        .unwrap(),
        1
    );
    let conn = open_connection(&cfg.db_path).unwrap();
    let row: (i64, String) = conn
        .query_row(
            &format!("SELECT position, genotype FROM {report_id}"),
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(row, (102799765, "DI".to_string()));
}

#[test]
fn test_clinvar_table_and_haplogroup_vcf() {
    let tmp = TempDir::new().unwrap();
    let db_path = tmp.path().join("sample.db");
    let table = "RPT_TEMPLATE01";
    let conn = open_connection(&db_path).unwrap();
    conn.execute_batch(&format!(
        "CREATE TABLE {table}(rsid TEXT, clnsig TEXT, clndn TEXT, gt TEXT, ref TEXT, alt TEXT, gene TEXT);"
    ))
    .unwrap();
    for _ in 0..7 {
        conn.execute(
            &format!("INSERT INTO {table} VALUES ('rs91','Likely_pathogenic/Likely_risk_allele','Two_words','HET','A','G','G1')"),
            [],
        )
        .unwrap();
    }
    drop(conn);

    let summary = get_clinvar_data(
        &ClinvarQueryParams {
            report_id: table.to_string(),
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
        &db_path,
    )
    .unwrap();
    assert_eq!(summary["total"], 7);
    assert_eq!(summary["data"].as_object().unwrap().len(), 4);
    assert_eq!(summary["statistics"]["likely_pathogenic"], 7);

    let page = get_clinvar_data(
        &ClinvarQueryParams {
            report_id: table.to_string(),
            page: Some(2),
            page_size: 3,
            summary: false,
            classification: Some("likely_pathogenic".to_string()),
            sort_by: String::new(),
            sort_order: "asc".to_string(),
            search_term: "two wor".to_string(),
            filters: Map::new(),
            indel: false,
        },
        &db_path,
    )
    .unwrap();
    let row_ids: Vec<i64> = page["data"]
        .as_object()
        .unwrap()
        .values()
        .map(|v| v["row_id"].as_i64().unwrap())
        .collect();
    assert_eq!(row_ids, vec![4, 5, 6]);

    let snps = get_all_snp_info(
        &TableQueryParams {
            report_id: table.to_string(),
            page_size: 1000,
            page: 1,
            sort_by: String::new(),
            sort_order: "asc".to_string(),
            search_term: "RS91".to_string(),
            filters: Map::new(),
        },
        &db_path,
    )
    .unwrap();
    assert_eq!(snps["pagination"]["total"], 7);
    assert_eq!(snps["data"].as_object().unwrap().len(), 7);

    // Haplogroup VCF test
    let vcf_db = tmp.path().join("vcf.db");
    let conn = open_connection(&vcf_db).unwrap();
    conn.execute_batch(
        "CREATE TABLE RPT_TEMPLATE01(chromosome TEXT, position INTEGER, ref TEXT, alt TEXT, gt TEXT, genotype TEXT);
         INSERT INTO RPT_TEMPLATE01 VALUES ('Y', 12, 'A', 'G', 'HOM', 'GG');
         INSERT INTO RPT_TEMPLATE01 VALUES ('Y', 5, 'A', 'G', 'HET', 'AG');
         INSERT INTO RPT_TEMPLATE01 VALUES ('MT', 2, 'G', 'C', 'HOM', 'CC');
         INSERT INTO RPT_TEMPLATE01 VALUES ('1', 5, 'A', 'G', 'HET', 'AG');
         INSERT INTO RPT_TEMPLATE01 VALUES ('Y', 10, 'A', 'G', 'WT', 'AA');
         INSERT INTO RPT_TEMPLATE01 VALUES ('Y', 7, 'D', 'I', 'HOM', 'II');",
    )
    .unwrap();
    let vcf_path = tmp.path().join("calls.vcf");
    write_haplogroup_vcf(&conn, "RPT_TEMPLATE01", &vcf_path).unwrap();
    let calls: Vec<Vec<String>> = fs::read_to_string(&vcf_path)
        .unwrap()
        .lines()
        .filter(|l| !l.starts_with('#'))
        .map(|l| l.split('\t').map(String::from).collect())
        .collect();
    let summary_calls: Vec<(&str, &str, &str)> = calls
        .iter()
        .map(|r| (r[0].as_str(), r[1].as_str(), r.last().unwrap().as_str()))
        .collect();
    assert_eq!(
        summary_calls,
        vec![("MT", "2", "1/1"), ("Y", "5", "0/1"), ("Y", "12", "1/1")]
    );
}

#[test]
fn test_build_reference_gzip_to_sqlite() {
    let tmp = TempDir::new().unwrap();
    let gz_path = tmp.path().join("core.txt.gz");
    {
        let f = fs::File::create(&gz_path).unwrap();
        let mut enc = GzEncoder::new(f, Compression::default());
        writeln!(
            enc,
            "Chrom\tStart\tRef\tAlt\tGene\tRSID\tgnomAD_AF\tCLNSIG\tCLNDN"
        )
        .unwrap();
        writeln!(enc, "chr1\t50\tA\tG\tGENE1\trs2\t0.00047\t.\t.").unwrap();
        writeln!(enc, "chrM\t10\tA\t-\tMTG\tmt1\t.\t.\t.").unwrap();
        enc.finish().unwrap();
    }
    let out_db = tmp.path().join("ref.sqlite");
    build_reference(&gz_path, &out_db).unwrap();
    let conn = open_connection(&out_db).unwrap();
    let rows: Vec<(String, String, String, String, String)> = {
        let mut stmt = conn
            .prepare("SELECT chrom, start, ref, alt, rsid FROM variants ORDER BY seq")
            .unwrap();
        let mapped = stmt
            .query_map([], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        mapped
    };
    assert_eq!(
        rows,
        vec![
            (
                "1".into(),
                "50".into(),
                "A".into(),
                "G".into(),
                "rs2".into()
            ),
            (
                "MT".into(),
                "10".into(),
                "I".into(),
                "D".into(),
                "mt1".into()
            ),
        ]
    );
}

#[tokio::test]
async fn test_public_and_private_http_gateways() {
    let tmp = TempDir::new().unwrap();
    let mut cfg = test_config(tmp.path());
    cfg.max_body = 50 * 1024 * 1024;
    init_sqlite_schema(&cfg.db_path).unwrap();
    fs::write(cfg.web_root.join("index.html"), "<html>ok</html>").unwrap();
    fs::write(cfg.web_root.join("login.html"), "<html>login</html>").unwrap();
    fs::create_dir_all(cfg.web_root.join("_next").join("static")).unwrap();
    fs::write(
        cfg.web_root.join("_next").join("static").join("app.js"),
        "console.log(1);",
    )
    .unwrap();

    let state = AppState::new(cfg.clone()).unwrap();
    let public = build_public_router(state.clone());
    let private = build_private_router(state.clone());

    // 1. Public rejects API key / forged Host
    let resp = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/auth/me")
                .header("host", "localhost:8000")
                .header("x-api-key", "test-internal-key")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

    // 2. Wrong secret and expired JWT rejected
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    for (secret, exp) in [
        ("another-another-another-another-another-", now + 100),
        (cfg.jwt_secret.as_str(), now - 1),
    ] {
        let tok = encode_jwt_hs256(
            &SessionClaims {
                email: "demo@example.invalid".into(),
                name: "demo".into(),
                iat: now - 20,
                exp,
            },
            secret,
        )
        .unwrap();
        let resp = public
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/auth/me")
                    .header(header::COOKIE, format!("auth_token={tok}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    // 3. Unauthenticated page redirects to /login
    let resp = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/analysis/traits")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::TEMPORARY_REDIRECT);
    assert_eq!(resp.headers().get(header::LOCATION).unwrap(), "/login");

    // 4. Static asset bypasses auth with immutable cache
    let resp = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/_next/static/app.js")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(
        resp.headers().get(header::CACHE_CONTROL).unwrap(),
        "public, max-age=31536000, immutable"
    );

    // 5. Login -> cookie -> /api/auth/me -> trait detail redirect -> logout
    let login_resp = public
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    r#"{"email":"demo@example.invalid","password":"temporary password"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(login_resp.status(), StatusCode::OK);
    let set_cookie = login_resp
        .headers()
        .get(header::SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    assert!(set_cookie.contains("HttpOnly"));
    let cookie_pair = set_cookie.split(';').next().unwrap().to_string();

    let me_resp = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/auth/me")
                .header(header::COOKIE, &cookie_pair)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(me_resp.status(), StatusCode::OK);
    let me_body: Value =
        serde_json::from_slice(&me_resp.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(me_body["email"], "demo@example.invalid");

    // ExportedPages trait detail redirect
    let redir_resp = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/analysis/traits/eye-color")
                .header(header::COOKIE, &cookie_pair)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(redir_resp.status(), StatusCode::TEMPORARY_REDIRECT);
    assert_eq!(
        redir_resp.headers().get(header::LOCATION).unwrap(),
        "/analysis/traits/detail?id=eye-color"
    );

    // 6. Private gateway requires X-API-Key and returns X-Request-ID
    let priv_unauth = private
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/user/id")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(priv_unauth.status(), StatusCode::UNAUTHORIZED);

    let priv_ok = private
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/user/id")
                .header("x-api-key", "test-internal-key")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(priv_ok.status(), StatusCode::OK);
    assert!(priv_ok.headers().get("x-request-id").is_some());
    assert!(priv_ok.headers().get("x-response-time").is_some());

    // 7. Body limit test (auth precedes 413; open POST enforces 413)
    let mut small_cfg = cfg.clone();
    small_cfg.max_body = 12;
    let small_state = AppState::new(small_cfg).unwrap();
    let small_public = build_public_router(small_state);

    let unauth_big = small_public
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/report/create")
                .body(Body::from("xxxxxxxxxxxxx"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(unauth_big.status(), StatusCode::UNAUTHORIZED);

    let open_big = small_public
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from("xxxxxxxxxxxxx"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(open_big.status(), StatusCode::PAYLOAD_TOO_LARGE);
}

#[tokio::test]
async fn test_full_api_routes_traits_reports_and_health() {
    let tmp = TempDir::new().unwrap();
    let cfg = test_config(tmp.path());
    seed_report_db(&cfg.db_path, "RPT_TEMPLATE01");
    {
        let conn = open_connection(&cfg.db_path).unwrap();
        conn.execute(
            "INSERT INTO users(email, user_id, name) VALUES ('demo@example.invalid', 'ID_TEST123456', 'demo')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO admixture(report_id, East_Asian, West_African) VALUES ('RPT_TEMPLATE01', 86.69, 13.31)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO haplogroup(report_id, y_hap, mt_hap) VALUES ('RPT_TEMPLATE01', 'O2a2a1a1a', 'F1a1')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO RPT_TEMPLATE01(chromosome, position, ref, alt, gnomAD_AF, gene, clnsig, clndn, rsid, genotype, gt)
             VALUES ('15', 28365618, 'A', 'G', 0.25, 'HERC2', 'Benign', 'Eye_color', 'rs12913832', 'GG', 'HOM')",
            [],
        )
        .unwrap();
    }
    json_to_trait_table(&cfg.default_traits_path, &cfg.db_path).unwrap();
    let (loci, registry_hash) = load_locus_registry(&cfg.trait_locus_path).unwrap();
    backfill_report(
        &cfg,
        &cfg.db_path,
        "RPT_TEMPLATE01",
        "23andme",
        &loci,
        &registry_hash,
    )
    .unwrap();
    let metadata = get_trait_catalog_metadata(&cfg).unwrap();
    persist_trait_catalog_metadata(&metadata, &cfg.trait_catalog_state_path).unwrap();

    let state = AppState::new(cfg.clone()).unwrap();
    let public = build_public_router(state.clone());
    let private = build_private_router(state.clone());

    // Login
    let login_resp = public
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    r#"{"email":"demo@example.invalid","password":"temporary password"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(login_resp.status(), StatusCode::OK);
    let cookie = login_resp
        .headers()
        .get(header::SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();

    // Readiness & Health
    let ready = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/health/ready")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(ready.status(), StatusCode::OK);
    let ready_json: Value =
        serde_json::from_slice(&ready.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(ready_json["status"], "ready");

    let health = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(health.status(), StatusCode::OK);

    // Dashboard
    let dash = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/reports/RPT_TEMPLATE01/dashboard")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(dash.status(), StatusCode::OK);
    let dash_json: Value =
        serde_json::from_slice(&dash.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(dash_json["haplogroups"]["y_hap"], "O2a2a1a1a");
    assert_eq!(dash_json["ancestry"]["East_Asian"], 86.69);
    assert_eq!(dash_json["traits"].as_array().unwrap().len(), 4);

    // Catalog + ETag 304
    let cat = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/traits/catalog")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(cat.status(), StatusCode::OK);
    let etag = cat
        .headers()
        .get(header::ETAG)
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    let cat_304 = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/traits/catalog")
                .header(header::COOKIE, &cookie)
                .header(header::IF_NONE_MATCH, &etag)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(cat_304.status(), StatusCode::NOT_MODIFIED);

    // Trait detail
    let detail = public
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/traits/eye-color?report_id=RPT_TEMPLATE01")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(detail.status(), StatusCode::OK);
    let detail_json: Value =
        serde_json::from_slice(&detail.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(detail_json["id"], "eye-color");
    assert_eq!(detail_json["evaluation"]["status"], "ok");

    // Add custom trait -> ETag updates -> export -> delete
    let add_resp = public
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/traits/add")
                .header(header::COOKIE, &cookie)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "traitData": {
                            "name": {"en": "My Trait", "zh-CN": "自定义", "default": ""},
                            "description": {"en": "Desc", "zh-CN": "描述", "default": ""},
                            "scoreThresholds": {"High": 5, "Low": 0},
                            "result": {
                                "High": {"en": "High", "zh-CN": "高", "default": ""},
                                "Low": {"en": "Low", "zh-CN": "低", "default": ""}
                            },
                            "rsids": ["rs12913832"],
                            "formula": "SCORE(rs12913832:GG=10,AG=5,AA=0)",
                            "reference": ["12345, 67890"]
                        }
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(add_resp.status(), StatusCode::OK);

    let export_resp = public
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/traits/export")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(export_resp.status(), StatusCode::OK);
    let exported: Vec<Value> =
        serde_json::from_slice(&export_resp.into_body().collect().await.unwrap().to_bytes())
            .unwrap();
    assert_eq!(exported.len(), 1);
    let custom_id = exported[0]["id"].as_str().unwrap().to_string();
    assert!(custom_id.starts_with("TRA_"));

    let del_resp = public
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/traits/delete")
                .header(header::COOKIE, &cookie)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json!({"traits_id": custom_id}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(del_resp.status(), StatusCode::OK);

    // Private metrics & cache clear
    let metrics = private
        .clone()
        .oneshot(
            Request::builder()
                .uri("/metrics")
                .header("x-api-key", "test-internal-key")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(metrics.status(), StatusCode::OK);

    let clear = private
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/admin/cache/clear")
                .header("x-api-key", "test-internal-key")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(clear.status(), StatusCode::OK);
}

fn find_native_binary(name: &str) -> String {
    let exe = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    };
    let reader_target = repo_backend_root().join("reader").join("target");
    for profile in ["debug", "release"] {
        let candidate = reader_target.join(profile).join(&exe);
        if candidate.is_file() {
            return candidate.to_string_lossy().into_owned();
        }
    }
    name.to_string()
}

#[test]
fn test_rust_reader_multiallelic_haploid_and_rollback() {
    let reader_bin = find_native_binary("rootara-reader");
    for (vendor, rows, expected_mt) in [
        ("23andme", "rs2\t1\t50\tAA\nunknown\t1\t50\tAA\nmt\tMT\t10\tG\n", true),
        ("wegene", "rs2\t1\t50\tAA\nunknown\t1\t50\tAA\nmt\tMT\t10\tG\n", false),
        (
            "ancestry",
            "rsid\tposition\tchromosome\tallele2\tallele1\nrs2\t50\t1\tA\tA\nunknown\t50\t1\tA\tA\nmt\t10\t26\tG\tG\n",
            true,
        ),
    ] {
        let tmp = TempDir::new().unwrap();
        let core = tmp.path().join("core.gz");
        {
            let f = fs::File::create(&core).unwrap();
            let mut enc = GzEncoder::new(f, Compression::default());
            writeln!(enc, "Chrom\tStart\tRef\tAlt\tGene\tRSID\tgnomAD_AF\tCLNSIG\tCLNDN").unwrap();
            for (chrom, pos, alt, rsid) in [
                ("chr1", 50, "C", "rs1"),
                ("chr1", 50, "G", "rs2"),
                ("chrM", 10, "G", "mt"),
            ] {
                writeln!(enc, "{chrom}\t{pos}\tA\t{alt}\tgene\t{rsid}\t0.0004735077378849575\t.\t.")
                    .unwrap();
            }
            enc.finish().unwrap();
        }
        let reference = tmp.path().join("reference.db");
        build_reference(&core, &reference).unwrap();

        let source = tmp.path().join("input.txt");
        fs::write(&source, format!("# comment\n{rows}")).unwrap();
        let report_db = tmp.path().join("out.db");

        let status = std::process::Command::new(&reader_bin)
            .args(["--input"])
            .arg(&source)
            .args(["--db"])
            .arg(&report_db)
            .args(["--reference"])
            .arg(&reference)
            .args(["--method", vendor, "--report", "RPT_TEMPLATE01"])
            .status()
            .expect("failed to execute rootara-reader");
        assert!(status.success(), "rootara-reader failed for {vendor}");

        let conn = open_connection(&report_db).unwrap();
        let got: Vec<(String, String, String, String)> = {
            let mut stmt = conn
                .prepare("SELECT rsid, chromosome, genotype, gt FROM RPT_TEMPLATE01 ORDER BY rowid")
                .unwrap();
            let rows = stmt
                .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap();
            rows
        };
        let mut expected = vec![("rs2".into(), "1".into(), "AA".into(), "WT".into())];
        if expected_mt {
            expected.push(("mt".into(), "MT".into(), "GG".into(), "HOM".into()));
        }
        assert_eq!(got, expected);

        // A failed replacement must roll back and leave the previous table intact.
        let mut bytes = fs::read(&source).unwrap();
        bytes.extend_from_slice(b"bad\t1\t50\t\xff\n");
        fs::write(&source, bytes).unwrap();
        let bad_status = std::process::Command::new(&reader_bin)
            .args(["--input"])
            .arg(&source)
            .args(["--db"])
            .arg(&report_db)
            .args(["--reference"])
            .arg(&reference)
            .args(["--method", vendor, "--report", "RPT_TEMPLATE01"])
            .status()
            .unwrap();
        assert!(!bad_status.success());
        let cnt: usize = conn
            .query_row("SELECT COUNT(*) FROM RPT_TEMPLATE01", [], |r| r.get(0))
            .unwrap();
        assert_eq!(cnt, expected.len());
    }
}

#[test]
fn test_lossless_archive_and_legacy_migration() {
    let archive_bin = find_native_binary("rootara-archive");
    for (source, raw) in [
        (
            "23andme",
            b"\xef\xbb\xbf# 23andMe\r\nrs91\t1\t55\tAG\r\nrs92\tX\t42\tA".as_slice(),
        ),
        (
            "ancestry",
            b"# comment\nrsid\tchromosome\tposition\tallele1\tallele2\nrs91\t23\t55\tA\tG\n"
                .as_slice(),
        ),
        ("wegene", b"# header\r\nrs91,1,55,AG\r\n".as_slice()),
    ] {
        let tmp = TempDir::new().unwrap();
        let upload = tmp.path().join("source.txt");
        fs::write(&upload, raw).unwrap();
        let archive = tmp.path().join("raw.parquet");
        rootara_server::archive::write_archive(&archive_bin, &upload, &archive, source).unwrap();

        let expected_sha = rootara_server::archive::sha256_file(&upload).unwrap();
        let exported_sha =
            rootara_server::archive::sha256_archive_export(&archive_bin, &archive).unwrap();
        assert_eq!(exported_sha, expected_sha);

        let projected = rootara_server::archive::archive_variants(
            &archive_bin,
            &archive,
            Some(&["rs91".to_string()]),
        )
        .unwrap();
        assert_eq!(projected.len(), 1);
        assert_eq!(projected[0].0, "rs91");
        assert_eq!(projected[0].2, 55);
        assert_eq!(projected[0].3, "AG");
    }

    // Legacy TXT migration verifies SHA-256 before optional removal
    let tmp = TempDir::new().unwrap();
    let txt = tmp.path().join("RDT_0123456789.23andme.txt");
    let orig = b"# vendor\r\nrs1\t1\t9\tAG\r\n";
    fs::write(&txt, orig).unwrap();
    let migrated =
        rootara_server::archive::migrate_text_archives(&archive_bin, tmp.path(), false).unwrap();
    assert_eq!(migrated, vec!["RDT_0123456789.23andme.parquet".to_string()]);
    assert!(txt.is_file());

    // Tampered source must fail verification and preserve text
    fs::write(&txt, b"updated").unwrap();
    assert!(
        rootara_server::archive::migrate_text_archives(&archive_bin, tmp.path(), true).is_err()
    );
    assert_eq!(fs::read(&txt).unwrap(), b"updated");

    // Matching source passes and removes text when requested
    fs::write(&txt, orig).unwrap();
    rootara_server::archive::migrate_text_archives(&archive_bin, tmp.path(), true).unwrap();
    assert!(!txt.exists());
}
