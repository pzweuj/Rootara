use crate::archive::write_archive;
use crate::cache::CacheManager;
use crate::config::{generate_random_hex_upper, RuntimeConfig};
use crate::db::{
    open_connection, row_to_json_array, row_to_json_map, sql_value_to_json, table_columns,
    table_exists, validate_report_table_name,
};
use crate::traits::{backfill_report, load_locus_registry};
use anyhow::{anyhow, ensure, Context, Result};
use chrono::Local;
use rusqlite::{params, Connection, ToSql};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::Path;
use std::process::Command;

pub const CLINVAR_CLASSES: &[&str] = &[
    "Pathogenic",
    "Likely_pathogenic",
    "Uncertain_significance",
    "Likely_benign",
    "Benign",
];

pub fn get_user_id(db_path: &Path) -> Result<Option<String>> {
    let conn = open_connection(db_path)?;
    if !table_exists(&conn, "users")? {
        return Ok(None);
    }
    let id = conn
        .query_row("SELECT user_id FROM users LIMIT 1", [], |r| {
            r.get::<_, String>(0)
        })
        .ok();
    Ok(id)
}

pub fn get_report_info(report_id: &str, db_path: &Path) -> Result<Option<Vec<Value>>> {
    let conn = open_connection(db_path)?;
    let mut stmt = conn.prepare("SELECT * FROM reports WHERE report_id = ?")?;
    let col_count = stmt.column_count();
    let mut rows = stmt.query([report_id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row_to_json_array(row, col_count)?))
    } else {
        Ok(None)
    }
}

pub fn list_all_report_ids(db_path: &Path) -> Result<Vec<String>> {
    let conn = open_connection(db_path)?;
    let mut stmt = conn.prepare("SELECT report_id FROM reports")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get_all_report_info(db_path: &Path) -> Result<Vec<Value>> {
    let conn = open_connection(db_path)?;
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM reports", [], |r| r.get(0))?;
    let sql = if count >= 2 {
        "SELECT report_id, user_id, file_format, data_source, name, select_default, total_snps, upload_date FROM reports WHERE report_id != 'RPT_TEMPLATE01'"
    } else {
        "SELECT report_id, user_id, file_format, data_source, name, select_default, total_snps, upload_date FROM reports"
    };
    let mut stmt = conn.prepare(sql)?;
    let mut rows = stmt.query([])?;
    let mut out = Vec::new();
    while let Some(r) = rows.next()? {
        let id = sql_value_to_json(r.get_ref(0)?);
        let user_id = sql_value_to_json(r.get_ref(1)?);
        let extend = sql_value_to_json(r.get_ref(2)?);
        let source = sql_value_to_json(r.get_ref(3)?);
        let name = sql_value_to_json(r.get_ref(4)?);
        let is_default = sql_value_to_json(r.get_ref(5)?);
        let snp_count = sql_value_to_json(r.get_ref(6)?);
        let upload_date = sql_value_to_json(r.get_ref(7)?);
        out.push(json!({
            "id": id,
            "user_id": user_id,
            "extend": extend,
            "source": source,
            "name": name,
            "nameZh": name,
            "isDefault": is_default,
            "snpCount": snp_count,
            "uploadDate": upload_date,
        }));
    }
    Ok(out)
}

pub fn update_report_name(report_id: &str, new_name: &str, db_path: &Path) -> Result<()> {
    let conn = open_connection(db_path)?;
    conn.execute(
        "UPDATE reports SET name = ? WHERE report_id = ?",
        params![new_name, report_id],
    )?;
    Ok(())
}

pub fn set_default_report(report_id: &str, db_path: &Path) -> Result<()> {
    let conn = open_connection(db_path)?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM reports WHERE report_id=?",
        [report_id],
        |r| r.get(0),
    )?;
    if count == 0 {
        return Ok(());
    }
    conn.execute(
        "UPDATE reports SET select_default=1 WHERE report_id=?",
        [report_id],
    )?;
    conn.execute(
        "UPDATE reports SET select_default=0 WHERE report_id<>?",
        [report_id],
    )?;
    Ok(())
}

pub fn delete_report(report_id: &str, db_path: &Path, rawdata_dir: &Path) -> Result<()> {
    let report_id = validate_report_table_name(report_id)?;
    if report_id == "RPT_TEMPLATE01" {
        return Ok(());
    }
    let mut conn = open_connection(db_path)?;
    let tx = conn.transaction()?;
    tx.execute(&format!("DROP TABLE IF EXISTS [{report_id}]"), [])?;
    tx.execute("DELETE FROM admixture WHERE report_id = ?", [report_id])?;
    tx.execute("DELETE FROM haplogroup WHERE report_id = ?", [report_id])?;

    let is_default: bool = tx
        .query_row(
            "SELECT select_default FROM reports WHERE report_id = ?",
            [report_id],
            |r| r.get::<_, i64>(0),
        )
        .map(|v| v != 0)
        .unwrap_or(false);

    if is_default {
        tx.execute(
            "UPDATE reports
             SET select_default = 1
             WHERE report_id = (
                 SELECT report_id FROM reports
                 WHERE report_id != ?
                 ORDER BY upload_date DESC
                 LIMIT 1
             )",
            [report_id],
        )?;
    }

    tx.execute("DELETE FROM reports WHERE report_id = ?", [report_id])?;
    if table_exists(&tx, "report_trait_import_state")? {
        tx.execute(
            "DELETE FROM report_trait_import_state WHERE report_id=?",
            [report_id],
        )?;
    }
    if table_exists(&tx, "import_jobs")? {
        tx.execute("DELETE FROM import_jobs WHERE report_id=?", [report_id])?;
    }
    tx.commit()?;

    let prefix = format!("RDT_{}.", &report_id[4..]);
    if let Ok(entries) = fs::read_dir(rawdata_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let matches_prefix = path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with(&prefix))
                .unwrap_or(false);
            let matches_ext = matches!(
                path.extension().and_then(|e| e.to_str()),
                Some("txt" | "parquet")
            );
            if matches_prefix && matches_ext {
                let _ = fs::remove_file(&path);
            }
        }
    }
    Ok(())
}

pub fn get_admixture_info(
    report_id: &str,
    db_path: &Path,
    cache: Option<&CacheManager>,
) -> Result<Value> {
    if let Some(c) = cache {
        if let Some(hit) = c.get("admixture", report_id) {
            return Ok(hit);
        }
    }
    let conn = open_connection(db_path)?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM admixture WHERE report_id=?",
        [report_id],
        |r| r.get(0),
    )?;
    if count == 0 {
        let empty = json!({});
        if let Some(c) = cache {
            c.set("admixture", report_id, empty.clone(), Some(300.0));
        }
        return Ok(empty);
    }

    let mut stmt = conn.prepare("SELECT * FROM admixture WHERE report_id=?")?;
    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut rows = stmt.query([report_id])?;
    let Some(row) = rows.next()? else {
        let empty = json!({});
        if let Some(c) = cache {
            c.set("admixture", report_id, empty.clone(), Some(300.0));
        }
        return Ok(empty);
    };

    let mut map = Map::new();
    for (i, name) in col_names.iter().enumerate() {
        if name != "report_id" {
            map.insert(name.clone(), sql_value_to_json(row.get_ref(i)?));
        }
    }
    let val = Value::Object(map);
    if let Some(c) = cache {
        c.set("admixture", report_id, val.clone(), Some(3600.0));
    }
    Ok(val)
}

pub fn get_haplogroup_info(report_id: &str, db_path: &Path) -> Result<Value> {
    let conn = open_connection(db_path)?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM haplogroup WHERE report_id=?",
        [report_id],
        |r| r.get(0),
    )?;
    if count == 0 {
        return Ok(json!({}));
    }
    let mut stmt = conn.prepare("SELECT * FROM haplogroup WHERE report_id=?")?;
    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut rows = stmt.query([report_id])?;
    let Some(row) = rows.next()? else {
        return Ok(json!({}));
    };
    let mut map = Map::new();
    for (i, name) in col_names.iter().enumerate() {
        if name != "report_id" {
            map.insert(name.clone(), sql_value_to_json(row.get_ref(i)?));
        }
    }
    Ok(Value::Object(map))
}

fn empty_snp_record(rsid: &str) -> Value {
    json!({
        "chromosome": Value::Null,
        "position": Value::Null,
        "ref": Value::Null,
        "alt": Value::Null,
        "rsid": rsid,
        "gnomAD_AF": Value::Null,
        "gene": Value::Null,
        "clnsig": Value::Null,
        "clndn": Value::Null,
        "genotype": Value::Null,
        "check": Value::Null,
    })
}

pub fn get_snp_info_by_rsid(
    rsids: &[String],
    report_id: &str,
    db_path: &Path,
) -> Result<Map<String, Value>> {
    let report_id = validate_report_table_name(report_id)?;
    let conn = open_connection(db_path)?;

    let mut requested: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for r in rsids {
        if seen.insert(r.clone()) {
            requested.push(r.clone());
        }
    }

    if !table_exists(&conn, report_id)? {
        let mut out = Map::new();
        for r in &requested {
            out.insert(r.clone(), empty_snp_record(r));
        }
        return Ok(out);
    }

    let mut out = Map::new();
    if !requested.is_empty() {
        let marks = vec!["?"; requested.len()].join(",");
        let sql = format!("SELECT * FROM {report_id} WHERE rsid IN ({marks})");
        let mut stmt = conn.prepare(&sql)?;
        let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let mut rows = stmt.query(rusqlite::params_from_iter(requested.iter()))?;
        while let Some(row) = rows.next()? {
            let map = row_to_json_map(row, &col_names)?;
            if let Some(rsid) = map.get("rsid").and_then(Value::as_str) {
                if !rsid.is_empty() && !out.contains_key(rsid) {
                    out.insert(rsid.to_string(), Value::Object(map));
                }
            }
        }
    }

    for r in &requested {
        if !out.contains_key(r) {
            out.insert(r.clone(), empty_snp_record(r));
        }
    }
    Ok(out)
}

fn is_rsid_pattern(s: &str) -> bool {
    if s.len() < 3 {
        return false;
    }
    let bytes = s.as_bytes();
    (bytes[0] == b'r' || bytes[0] == b'R')
        && (bytes[1] == b's' || bytes[1] == b'S')
        && bytes[2..].iter().all(|b| b.is_ascii_digit())
}

fn push_sql_value(params_vec: &mut Vec<rusqlite::types::Value>, val: &Value) {
    match val {
        Value::Null => params_vec.push(rusqlite::types::Value::Null),
        Value::Bool(b) => params_vec.push(rusqlite::types::Value::Integer(if *b { 1 } else { 0 })),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                params_vec.push(rusqlite::types::Value::Integer(i));
            } else if let Some(f) = n.as_f64() {
                params_vec.push(rusqlite::types::Value::Real(f));
            } else {
                params_vec.push(rusqlite::types::Value::Text(n.to_string()));
            }
        }
        Value::String(s) => params_vec.push(rusqlite::types::Value::Text(s.clone())),
        other => params_vec.push(rusqlite::types::Value::Text(other.to_string())),
    }
}

pub struct TableQueryParams {
    pub report_id: String,
    pub page_size: usize,
    pub page: usize,
    pub sort_by: String,
    pub sort_order: String,
    pub search_term: String,
    pub filters: Map<String, Value>,
}

pub fn get_all_snp_info(q: &TableQueryParams, db_path: &Path) -> Result<Value> {
    let report_id = validate_report_table_name(&q.report_id)?;
    let conn = open_connection(db_path)?;

    if !table_exists(&conn, report_id)? {
        return Ok(json!({
            "data": {},
            "columns": [],
            "pagination": {
                "total": 0,
                "page": q.page,
                "page_size": q.page_size,
                "total_pages": 0,
            }
        }));
    }

    let columns = table_columns(&conn, report_id)?;
    let col_set: HashSet<&str> = columns.iter().map(String::as_str).collect();

    let mut where_clauses: Vec<String> = Vec::new();
    let mut query_params: Vec<rusqlite::types::Value> = Vec::new();

    if !q.search_term.is_empty() {
        if is_rsid_pattern(&q.search_term) {
            where_clauses.push("rsid = ?".to_string());
            query_params.push(rusqlite::types::Value::Text(
                q.search_term.to_ascii_lowercase(),
            ));
        } else if !columns.is_empty() {
            let conds: Vec<String> = columns.iter().map(|c| format!("{c} = ?")).collect();
            for _ in &columns {
                query_params.push(rusqlite::types::Value::Text(q.search_term.clone()));
            }
            where_clauses.push(format!("({})", conds.join(" OR ")));
        }
    }

    for (col, val) in &q.filters {
        if !col_set.contains(col.as_str()) {
            continue;
        }
        if let Some(arr) = val.as_array() {
            if !arr.is_empty() {
                let marks = vec!["?"; arr.len()].join(", ");
                where_clauses.push(format!("{col} IN ({marks})"));
                for item in arr {
                    push_sql_value(&mut query_params, item);
                }
            }
        } else {
            where_clauses.push(format!("{col} = ?"));
            push_sql_value(&mut query_params, val);
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM {report_id}{where_sql}");
    let total_count: usize = {
        let refs: Vec<&dyn ToSql> = query_params.iter().map(|v| v as &dyn ToSql).collect();
        conn.query_row(&count_sql, refs.as_slice(), |r| r.get::<_, i64>(0))? as usize
    };

    let mut data_sql = format!("SELECT rowid AS row_id, * FROM {report_id}{where_sql}");
    if !q.sort_by.is_empty() && col_set.contains(q.sort_by.as_str()) {
        let dir = if q.sort_order.eq_ignore_ascii_case("desc") {
            "DESC"
        } else {
            "ASC"
        };
        data_sql.push_str(&format!(" ORDER BY {} {dir}", q.sort_by));
    }
    data_sql.push_str(" LIMIT ? OFFSET ?");

    let offset = (q.page.saturating_sub(1)) * q.page_size;
    query_params.push(rusqlite::types::Value::Integer(q.page_size as i64));
    query_params.push(rusqlite::types::Value::Integer(offset as i64));

    let refs: Vec<&dyn ToSql> = query_params.iter().map(|v| v as &dyn ToSql).collect();
    let mut stmt = conn.prepare(&data_sql)?;
    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut rows = stmt.query(refs.as_slice())?;

    let mut data_map = Map::new();
    while let Some(row) = rows.next()? {
        let map = row_to_json_map(row, &col_names)?;
        let rsid_key = map
            .get("rsid")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .map(String::from);
        let key = match rsid_key {
            Some(k) if !data_map.contains_key(&k) => k,
            _ => format!(
                "row:{}",
                map.get("row_id").and_then(Value::as_i64).unwrap_or(0)
            ),
        };
        data_map.insert(key, Value::Object(map));
    }

    let total_pages = if q.page_size == 0 {
        0
    } else {
        (total_count + q.page_size - 1) / q.page_size
    };

    Ok(json!({
        "data": data_map,
        "columns": col_names,
        "pagination": {
            "total": total_count,
            "page": q.page,
            "page_size": q.page_size,
            "total_pages": total_pages,
        }
    }))
}

pub struct ClinvarQueryParams {
    pub report_id: String,
    pub page: Option<usize>,
    pub page_size: usize,
    pub summary: bool,
    pub classification: Option<String>,
    pub sort_by: String,
    pub sort_order: String,
    pub search_term: String,
    pub filters: Map<String, Value>,
    pub indel: bool,
}

pub fn get_clinvar_data(q: &ClinvarQueryParams, db_path: &Path) -> Result<Value> {
    let table = validate_report_table_name(&q.report_id)?;
    let mut stats = Map::new();
    for cls in CLINVAR_CLASSES {
        stats.insert(cls.to_ascii_lowercase(), Value::Number(0.into()));
    }

    let conn = open_connection(db_path)?;
    let columns = table_columns(&conn, table)?;
    if columns.is_empty() {
        return Ok(json!({
            "data": {},
            "columns": [],
            "total": 0,
            "statistics": stats,
        }));
    }
    let col_set: HashSet<&str> = columns.iter().map(String::as_str).collect();

    let primary = "substr(clnsig, 1, instr(clnsig || '/', '/') - 1)";
    let marks = vec!["?"; CLINVAR_CLASSES.len()].join(",");
    let mut base = format!(
        "FROM {table} WHERE gt NOT IN ('.','WT') AND clndn != '.' AND {primary} IN ({marks})"
    );
    if !q.indel {
        base.push_str(" AND ref NOT IN ('I','D') AND alt NOT IN ('I','D')");
    }

    let mut params_vec: Vec<rusqlite::types::Value> = CLINVAR_CLASSES
        .iter()
        .map(|c| rusqlite::types::Value::Text((*c).to_string()))
        .collect();

    {
        let stats_sql = format!("SELECT {primary}, COUNT(*) {base} GROUP BY {primary}");
        let refs: Vec<&dyn ToSql> = params_vec.iter().map(|v| v as &dyn ToSql).collect();
        let mut stmt = conn.prepare(&stats_sql)?;
        let mut rows = stmt.query(refs.as_slice())?;
        while let Some(r) = rows.next()? {
            let cat: String = r.get(0)?;
            let cnt: i64 = r.get(1)?;
            stats.insert(cat.to_ascii_lowercase(), Value::Number(cnt.into()));
        }
    }

    let mut query = base.clone();
    if let Some(cls) = q.classification.as_deref() {
        if !cls.is_empty() && cls != "all" {
            query.push_str(&format!(" AND lower({primary}) = ?"));
            params_vec.push(rusqlite::types::Value::Text(cls.to_ascii_lowercase()));
        }
    }

    if !q.search_term.is_empty() {
        if q.page.is_none() {
            let conds: Vec<String> = columns.iter().map(|c| format!("{c} = ?")).collect();
            query.push_str(&format!(" AND ({})", conds.join(" OR ")));
            for _ in &columns {
                params_vec.push(rusqlite::types::Value::Text(q.search_term.clone()));
            }
        } else {
            let fields = ["rsid", "gene", "replace(clndn, '_', ' ')"];
            let conds: Vec<String> = fields
                .iter()
                .map(|f| format!("instr(lower({f}), lower(?)) > 0"))
                .collect();
            query.push_str(&format!(" AND ({})", conds.join(" OR ")));
            for _ in &fields {
                params_vec.push(rusqlite::types::Value::Text(q.search_term.clone()));
            }
        }
    }

    for (key, val) in &q.filters {
        if !col_set.contains(key.as_str()) {
            continue;
        }
        let values: Vec<&Value> = if let Some(arr) = val.as_array() {
            arr.iter().collect()
        } else {
            vec![val]
        };
        if !values.is_empty() {
            let marks = vec!["?"; values.len()].join(",");
            query.push_str(&format!(" AND {key} IN ({marks})"));
            for v in values {
                push_sql_value(&mut params_vec, v);
            }
        }
    }

    let total: i64 = if query == base {
        stats.values().filter_map(Value::as_i64).sum()
    } else {
        let count_sql = format!("SELECT COUNT(*) {query}");
        let refs: Vec<&dyn ToSql> = params_vec.iter().map(|v| v as &dyn ToSql).collect();
        conn.query_row(&count_sql, refs.as_slice(), |r| r.get(0))?
    };

    if q.summary {
        query.push_str(&format!(
            " ORDER BY CASE {primary} WHEN 'Pathogenic' THEN 0 WHEN 'Likely_pathogenic' THEN 1 WHEN 'Uncertain_significance' THEN 2 WHEN 'Likely_benign' THEN 3 ELSE 4 END, rowid LIMIT 4"
        ));
    } else {
        if !q.sort_by.is_empty() && col_set.contains(q.sort_by.as_str()) {
            let dir = if q.sort_order.eq_ignore_ascii_case("desc") {
                "DESC"
            } else {
                "ASC"
            };
            query.push_str(&format!(" ORDER BY {} {dir}, rowid", q.sort_by));
        } else {
            query.push_str(" ORDER BY rowid");
        }
        if let Some(page) = q.page {
            query.push_str(" LIMIT ? OFFSET ?");
            params_vec.push(rusqlite::types::Value::Integer(q.page_size as i64));
            params_vec.push(rusqlite::types::Value::Integer(
                ((page.saturating_sub(1)) * q.page_size) as i64,
            ));
        }
    }

    let select_sql =
        format!("SELECT rowid AS row_id, *, lower({primary}) AS classification {query}");
    let refs: Vec<&dyn ToSql> = params_vec.iter().map(|v| v as &dyn ToSql).collect();
    let mut stmt = conn.prepare(&select_sql)?;
    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut rows = stmt.query(refs.as_slice())?;

    let mut data_map = Map::new();
    while let Some(row) = rows.next()? {
        let map = row_to_json_map(row, &col_names)?;
        let rsid_key = map
            .get("rsid")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .map(String::from);
        let key = match rsid_key {
            Some(k) if !data_map.contains_key(&k) => k,
            _ => format!(
                "row:{}",
                map.get("row_id").and_then(Value::as_i64).unwrap_or(0)
            ),
        };
        data_map.insert(key, Value::Object(map));
    }

    Ok(json!({
        "data": data_map,
        "columns": columns,
        "total": total,
        "statistics": stats,
    }))
}

// =========================================================================
// Report Creation Pipeline (port of rootara_report_create, admixture, haplo)
// =========================================================================

pub fn run_admixture_to_sqlite(
    cfg: &RuntimeConfig,
    input_file: &Path,
    report_id: &str,
    method: &str,
    db_path: &Path,
    force: bool,
) -> Result<()> {
    let mut conn = open_connection(db_path)?;
    if !force {
        let exists: Option<i64> = conn
            .query_row(
                "SELECT 1 FROM admixture WHERE report_id=?",
                [report_id],
                |r| r.get(0),
            )
            .ok();
        if exists.is_some() {
            return Ok(());
        }
    }

    let output = Command::new(&cfg.admix_tool)
        .arg("--data-dir")
        .arg(&cfg.admix_data)
        .arg("-f")
        .arg(input_file)
        .arg("-v")
        .arg(method)
        .arg("-m")
        .arg("K47")
        .output()
        .with_context(|| format!("failed to run {}", cfg.admix_tool))?;
    ensure!(
        output.status.success(),
        "admixrs failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8(output.stdout)?;
    let mut lines = stdout.trim().lines();
    let header = lines
        .next()
        .ok_or_else(|| anyhow!("Empty AdmixRS output"))?;
    if header != "K47" {
        return Err(anyhow!("Expected an AdmixRS K47 report"));
    }

    let expected: Vec<String> = table_columns(&conn, "admixture")?
        .into_iter()
        .filter(|c| c != "report_id")
        .collect();
    let mut estimates: HashMap<String, f64> = HashMap::new();
    for line in lines {
        let (label, percent) = line
            .split_once(": ")
            .ok_or_else(|| anyhow!("Invalid K47 line: {line}"))?;
        let col = label.replace('-', "_");
        let num_str = percent
            .strip_suffix('%')
            .ok_or_else(|| anyhow!("Invalid K47 estimate for {label}"))?;
        let val: f64 = num_str
            .parse()
            .map_err(|_| anyhow!("Invalid K47 estimate for {label}"))?;
        if !(0.0..=100.0).contains(&val) || estimates.contains_key(&col) {
            return Err(anyhow!("Invalid K47 estimate for {label}"));
        }
        estimates.insert(col, val);
    }

    let expected_set: HashSet<&String> = expected.iter().collect();
    let got_set: HashSet<&String> = estimates.keys().collect();
    if expected_set != got_set || expected.len() != 47 {
        return Err(anyhow!("K47 components do not match the report schema"));
    }

    let cols_sql = expected.join(", ");
    let placeholders = vec!["?"; expected.len()].join(", ");
    let mut sql_params: Vec<rusqlite::types::Value> = Vec::with_capacity(expected.len() + 1);
    sql_params.push(rusqlite::types::Value::Text(report_id.to_string()));
    for k in &expected {
        sql_params.push(rusqlite::types::Value::Real(estimates[k]));
    }
    let refs: Vec<&dyn ToSql> = sql_params.iter().map(|v| v as &dyn ToSql).collect();
    let tx = conn.transaction()?;
    tx.execute(
        &format!(
            "INSERT OR REPLACE INTO admixture (report_id, {cols_sql}) VALUES (?, {placeholders})"
        ),
        refs.as_slice(),
    )?;
    tx.commit()?;
    Ok(())
}

pub fn write_haplogroup_vcf(conn: &Connection, report_id: &str, vcf_path: &Path) -> Result<()> {
    let table = validate_report_table_name(report_id)?;
    let mut stmt = conn.prepare(&format!(
        "SELECT chromosome, position, ref, alt, gt FROM {table}
         WHERE chromosome IN ('Y','MT') AND gt != 'WT'
         AND genotype NOT IN ('DD','II','DI','ID','--')
         ORDER BY chromosome, position, rowid"
    ))?;
    let mut rows = stmt.query([])?;
    let mut writer = BufWriter::new(File::create(vcf_path)?);
    writer.write_all(b"##fileformat=VCFv4.2\n##reference=GRCh37\n")?;
    writer.write_all(b"#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tRootara\n")?;
    while let Some(r) = rows.next()? {
        let chrom: String = r.get(0)?;
        let pos: i64 = r.get(1)?;
        let ref_a: String = r.get(2)?;
        let alt_a: String = r.get(3)?;
        let check: String = r.get(4)?;
        let gt = if check == "HET" { "0/1" } else { "1/1" };
        writeln!(
            writer,
            "{chrom}\t{pos}\t.\t{ref_a}\t{alt_a}\t.\tPASS\t.\tGT\t{gt}"
        )?;
    }
    writer.flush()?;
    Ok(())
}

pub fn run_haplogroup_to_sqlite(
    cfg: &RuntimeConfig,
    report_id: &str,
    vcf_file: &Path,
    db_path: &Path,
    force: bool,
) -> Result<()> {
    let mut conn = open_connection(db_path)?;
    if !force {
        let exists: Option<i64> = conn
            .query_row(
                "SELECT 1 FROM haplogroup WHERE report_id=?",
                [report_id],
                |r| r.get(0),
            )
            .ok();
        if exists.is_some() {
            return Ok(());
        }
    }

    let data_dir = cfg.haplogrouper_dir.join("data");
    fs::create_dir_all(&cfg.temp_dir)?;
    let work = tempfile::tempdir_in(&cfg.temp_dir)?;
    let mut results: Vec<String> = Vec::with_capacity(2);

    for (chrom, tree, loci) in [
        (
            "Y",
            "chrY_isogg2019_tree",
            "chrY_isogg2019-decode1_loci_b37",
        ),
        ("MT", "chrMT_phylotree17_tree", "chrMT_phylotree17_loci"),
    ] {
        let out_path = work.path().join(format!("{tree}.tsv"));
        let status = Command::new(&cfg.haplogrouper_tool)
            .args(["-c", chrom])
            .arg("-v")
            .arg(vcf_file)
            .arg("-t")
            .arg(data_dir.join(format!("{tree}.txt")))
            .arg("-l")
            .arg(data_dir.join(format!("{loci}.txt")))
            .arg("-o")
            .arg(&out_path)
            .status()
            .with_context(|| format!("failed to run {}", cfg.haplogrouper_tool))?;
        ensure!(status.success(), "haplogrouper-rs failed for {chrom}");

        let mut reader = csv::ReaderBuilder::new()
            .delimiter(b'\t')
            .from_path(&out_path)?;
        let headers = reader.headers()?.clone();
        let hap_idx = headers
            .iter()
            .position(|h| h == "Haplogroup")
            .ok_or_else(|| anyhow!("Missing Haplogroup column for {chrom}"))?;
        let mut records = Vec::new();
        for rec in reader.records() {
            records.push(rec?);
        }
        if records.len() != 1 {
            return Err(anyhow!("Missing {chrom} haplogroup assignment"));
        }
        let hap = records[0].get(hap_idx).unwrap_or("").trim().to_string();
        if hap.is_empty() {
            return Err(anyhow!("Missing {chrom} haplogroup assignment"));
        }
        results.push(hap);
    }

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT OR REPLACE INTO haplogroup (report_id, y_hap, mt_hap) VALUES (?, ?, ?)",
        params![report_id, &results[0], &results[1]],
    )?;
    tx.commit()?;
    Ok(())
}

pub enum ReportInput<'a> {
    Path(&'a Path),
    Text(&'a str),
}

pub fn create_new_report<F>(
    cfg: &RuntimeConfig,
    user_id: &str,
    input: ReportInput<'_>,
    source_from: &str,
    report_name: &str,
    db_path: &Path,
    default_report: bool,
    initial: bool,
    explicit_report_id: Option<&str>,
    mut progress: F,
) -> Result<String>
where
    F: FnMut(&str),
{
    if !matches!(source_from, "ancestry" | "23andme" | "wegene") {
        return Err(anyhow!("Unsupported data source"));
    }
    let report_id_owned = if initial {
        "RPT_TEMPLATE01".to_string()
    } else if let Some(id) = explicit_report_id {
        id.to_string()
    } else {
        format!("RPT_{}", generate_random_hex_upper(5))
    };
    validate_report_table_name(&report_id_owned)?;
    let report_id = report_id_owned.as_str();

    let archive_path =
        cfg.rawdata_dir
            .join(format!("RDT_{}.{}.parquet", &report_id[4..], source_from));
    fs::create_dir_all(&cfg.temp_dir)?;
    let work = tempfile::tempdir_in(&cfg.temp_dir)?;

    {
        let conn = open_connection(db_path)?;
        if !initial {
            let exists: Option<i64> = conn
                .query_row(
                    "SELECT 1 FROM reports WHERE report_id=?",
                    [report_id],
                    |r| r.get(0),
                )
                .ok();
            if exists.is_some() {
                return Ok(report_id_owned);
            }
            conn.execute("DELETE FROM haplogroup WHERE report_id=?", [report_id])?;
            conn.execute("DELETE FROM admixture WHERE report_id=?", [report_id])?;
        }
    }

    let source_path = match input {
        ReportInput::Path(p) => p.to_path_buf(),
        ReportInput::Text(text) => {
            let p = work.path().join("upload.txt");
            fs::write(&p, text.as_bytes())?;
            p
        }
    };

    let pipeline_result: Result<()> = (|| {
        progress("variants");
        let status = Command::new(&cfg.reader_path)
            .arg("--input")
            .arg(&source_path)
            .arg("--method")
            .arg(source_from)
            .arg("--reference")
            .arg(&cfg.core_database_path)
            .arg("--db")
            .arg(db_path)
            .arg("--report")
            .arg(report_id)
            .status()
            .with_context(|| format!("failed to run {}", cfg.reader_path))?;
        ensure!(status.success(), "rootara-reader exited with {status}");

        if !initial {
            progress("ancestry");
            run_admixture_to_sqlite(cfg, &source_path, report_id, source_from, db_path, true)?;

            progress("haplogroups");
            let vcf_path = work.path().join("haplogroups.vcf");
            {
                let conn = open_connection(db_path)?;
                write_haplogroup_vcf(&conn, report_id, &vcf_path)?;
            }
            run_haplogroup_to_sqlite(cfg, report_id, &vcf_path, db_path, true)?;

            progress("archive");
            write_archive(&cfg.archive_tool, &source_path, &archive_path, source_from)?;
            let (loci, registry_hash) = load_locus_registry(&cfg.trait_locus_path)?;
            backfill_report(cfg, db_path, report_id, source_from, &loci, &registry_hash)?;
        }

        let mut conn = open_connection(db_path)?;
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let count: i64 = tx.query_row(&format!("SELECT COUNT(*) FROM {report_id}"), [], |r| {
            r.get(0)
        })?;
        if count == 0 {
            return Err(anyhow!("No variants matched this report"));
        }
        let has_non_template: bool = tx
            .query_row(
                "SELECT 1 FROM reports WHERE report_id != 'RPT_TEMPLATE01' LIMIT 1",
                [],
                |r| r.get::<_, i64>(0),
            )
            .is_ok();
        let is_default = default_report || initial || !has_non_template;
        if is_default {
            tx.execute("UPDATE reports SET select_default=0", [])?;
        }
        let now = Local::now()
            .naive_local()
            .format("%Y-%m-%dT%H:%M:%S%.6f")
            .to_string();
        tx.execute(
            "INSERT OR REPLACE INTO reports
                (report_id, user_id, file_format, data_source, name, select_default, total_snps, upload_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                report_id,
                user_id,
                "txt",
                source_from,
                report_name,
                if is_default { 1i64 } else { 0i64 },
                count,
                now,
            ],
        )?;
        tx.commit()?;
        Ok(())
    })();

    if let Err(err) = pipeline_result {
        if let Ok(mut conn) = open_connection(db_path) {
            if let Ok(tx) = conn.transaction() {
                let _ = tx.execute(&format!("DROP TABLE IF EXISTS {report_id}"), []);
                for table in ["admixture", "haplogroup", "report_trait_import_state"] {
                    if table_exists(&tx, table).unwrap_or(false) {
                        let _ = tx.execute(
                            &format!("DELETE FROM {table} WHERE report_id=?"),
                            [report_id],
                        );
                    }
                }
                let _ = tx.commit();
            }
        }
        let _ = fs::remove_file(&archive_path);
        return Err(err);
    }

    Ok(report_id_owned)
}

/// Format an f64 matching Python's `json.dumps(float)` representation so that
/// SHA-256 verification matches `deploy/benchmark_import_memory.py` byte-for-byte.
fn format_python_json_f64(val: f64, out: &mut String) {
    if val == 0.0 {
        if val.is_sign_negative() {
            out.push_str("-0.0");
        } else {
            out.push_str("0.0");
        }
        return;
    }
    let abs = val.abs();
    // Python uses scientific notation for abs < 1e-4 or abs >= 1e16
    if abs < 1e-4 || abs >= 1e16 {
        // Use ryu / std Display to get shortest significant digits, then format as Python e-05 / e+16
        let s = format!("{val:e}");
        if let Some((mantissa, exp_str)) = s.split_once('e') {
            let exp: i32 = exp_str.parse().unwrap_or(0);
            let sign = if exp < 0 { '-' } else { '+' };
            use std::fmt::Write;
            let _ = write!(out, "{mantissa}e{sign}{:02}", exp.abs());
            return;
        }
    }
    // Standard shortest decimal via serde_json
    let s = serde_json::to_string(&val).unwrap_or_else(|_| val.to_string());
    if !s.contains('.') && !s.contains('e') && !s.contains('E') {
        out.push_str(&s);
        out.push_str(".0");
    } else {
        out.push_str(&s);
    }
}

fn format_python_json_str(s: &str, out: &mut String) {
    use std::fmt::Write;
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\x08' => out.push_str("\\b"),
            '\x0c' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c if c.is_ascii() => out.push(c),
            c => {
                let mut buf = [0u16; 2];
                for unit in c.encode_utf16(&mut buf) {
                    let _ = write!(out, "\\u{:04x}", unit);
                }
            }
        }
    }
    out.push('"');
}

pub fn verify_report_rows_sha256(db_path: &Path, report_id: &str) -> Result<String> {
    let table = validate_report_table_name(report_id)?;
    let conn = open_connection(db_path)?;
    let mut stmt = conn.prepare(&format!("SELECT * FROM {table} ORDER BY rowid"))?;
    let col_count = stmt.column_count();
    let mut rows = stmt.query([])?;
    let mut hasher = Sha256::new();
    let mut line = String::with_capacity(256);

    while let Some(row) = rows.next()? {
        line.clear();
        line.push('[');
        for i in 0..col_count {
            if i > 0 {
                line.push(',');
            }
            match row.get_ref(i)? {
                rusqlite::types::ValueRef::Null => line.push_str("null"),
                rusqlite::types::ValueRef::Integer(n) => {
                    use std::fmt::Write;
                    let _ = write!(&mut line, "{n}");
                }
                rusqlite::types::ValueRef::Real(f) => format_python_json_f64(f, &mut line),
                rusqlite::types::ValueRef::Text(bytes) => {
                    let s = String::from_utf8_lossy(bytes);
                    format_python_json_str(&s, &mut line);
                }
                rusqlite::types::ValueRef::Blob(bytes) => {
                    let s = String::from_utf8_lossy(bytes);
                    format_python_json_str(&s, &mut line);
                }
            }
        }
        line.push_str("]\n");
        hasher.update(line.as_bytes());
    }

    let digest = hasher.finalize();
    let mut hex = String::with_capacity(64);
    for b in digest {
        use std::fmt::Write;
        let _ = write!(&mut hex, "{:02x}", b);
    }
    Ok(hex)
}
