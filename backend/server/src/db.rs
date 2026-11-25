use anyhow::{anyhow, Result};
use rusqlite::types::ValueRef;
use rusqlite::{Connection, Row};
use serde_json::{json, Map, Number, Value};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

pub const ADMIXTURE_COLUMNS: &[&str] = &[
    "Kushitic",
    "North_Iberian",
    "East_Iberian",
    "Tibeto_Burman",
    "North_African",
    "South_Caucasian",
    "North_Caucasian",
    "Paleo_Balkan",
    "Turkic_Altai",
    "Proto_Austronesian",
    "Nilotic",
    "East_Med",
    "Omotic",
    "Munda",
    "North_Amerind",
    "Arabic",
    "East_Euro",
    "Central_African",
    "Andean",
    "Indo_Chinese",
    "South_Indian",
    "NE_Asian",
    "Volgan",
    "Mongolian",
    "Siberian",
    "North_Sea_Germanic",
    "Celtic",
    "West_African",
    "West_Finnic",
    "Uralic",
    "Sahelian",
    "NW_Indian",
    "East_African",
    "East_Asian",
    "Amuro_Manchurian",
    "Scando_Germanic",
    "Iranian",
    "South_African",
    "Amazonian",
    "Baltic",
    "Malay",
    "Meso_Amerind",
    "South_Chinese",
    "Papuan",
    "West_Med",
    "Pamirian",
    "Central_Med",
];

pub fn validate_report_table_name(report_id: &str) -> Result<&str> {
    if report_id == "RPT_TEMPLATE01" {
        return Ok(report_id);
    }
    if let Some(rest) = report_id.strip_prefix("RPT_") {
        if rest.len() == 10
            && rest
                .bytes()
                .all(|b| b.is_ascii_digit() || b.is_ascii_uppercase())
        {
            return Ok(report_id);
        }
    }
    Err(anyhow!("invalid report id"))
}

pub fn open_connection(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.busy_timeout(Duration::from_secs(30))?;
    // Match the v2 SQLite pragmas for bounded memory and WAL concurrency.
    // Keep foreign_keys OFF because legacy reports store string user_id ('ID_...').
    let _ = conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=NORMAL;
         PRAGMA cache_size=-2048;
         PRAGMA temp_store=FILE;
         PRAGMA foreign_keys=OFF;",
    );
    Ok(conn)
}

#[derive(Default)]
struct PoolStats {
    total_connections_created: usize,
    active_connections: usize,
    pool_hits: usize,
    pool_misses: usize,
    connection_errors: usize,
}

pub struct DbPool {
    db_path: PathBuf,
    max_connections: usize,
    conns: Mutex<Vec<Connection>>,
    stats: Mutex<PoolStats>,
}

impl DbPool {
    pub fn new(db_path: PathBuf, max_connections: usize) -> Self {
        let pool = Self {
            db_path,
            max_connections: max_connections.max(1),
            conns: Mutex::new(Vec::new()),
            stats: Mutex::new(PoolStats::default()),
        };
        if let Ok(conn) = pool.create_conn() {
            pool.conns.lock().unwrap().push(conn);
        }
        pool
    }

    fn create_conn(&self) -> Result<Connection> {
        match open_connection(&self.db_path) {
            Ok(conn) => {
                let mut stats = self.stats.lock().unwrap();
                stats.total_connections_created += 1;
                stats.active_connections += 1;
                Ok(conn)
            }
            Err(err) => {
                self.stats.lock().unwrap().connection_errors += 1;
                Err(err)
            }
        }
    }

    pub fn with_conn<T, F>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&mut Connection) -> Result<T>,
    {
        let mut conn = {
            let mut guard = self.conns.lock().unwrap();
            if let Some(c) = guard.pop() {
                drop(guard);
                self.stats.lock().unwrap().pool_hits += 1;
                if c.execute_batch("SELECT 1").is_ok() {
                    c
                } else {
                    let mut stats = self.stats.lock().unwrap();
                    stats.active_connections = stats.active_connections.saturating_sub(1);
                    drop(stats);
                    self.create_conn()?
                }
            } else {
                drop(guard);
                self.stats.lock().unwrap().pool_misses += 1;
                self.create_conn()?
            }
        };

        let result = f(&mut conn);

        let healthy = conn.execute_batch("SELECT 1").is_ok();
        if healthy {
            let mut guard = self.conns.lock().unwrap();
            if guard.len() < self.max_connections {
                guard.push(conn);
            } else {
                drop(conn);
                let mut stats = self.stats.lock().unwrap();
                stats.active_connections = stats.active_connections.saturating_sub(1);
            }
        } else {
            drop(conn);
            let mut stats = self.stats.lock().unwrap();
            stats.active_connections = stats.active_connections.saturating_sub(1);
        }

        result
    }

    pub fn stats(&self) -> Value {
        let pool_size = self.conns.lock().unwrap().len();
        let stats = self.stats.lock().unwrap();
        json!({
            "total_connections_created": stats.total_connections_created,
            "active_connections": stats.active_connections,
            "pool_hits": stats.pool_hits,
            "pool_misses": stats.pool_misses,
            "connection_errors": stats.connection_errors,
            "pool_size": pool_size,
            "max_connections": self.max_connections,
            "created_connections": stats.active_connections,
        })
    }

    pub fn path(&self) -> &Path {
        &self.db_path
    }
}

pub fn init_sqlite_schema(db_path: &Path) -> Result<()> {
    if let Some(parent) = db_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let conn = open_connection(db_path)?;
    let admixture_cols = ADMIXTURE_COLUMNS
        .iter()
        .map(|col| format!("{col} REAL DEFAULT 0.00"))
        .collect::<Vec<_>>()
        .join(",\n");

    conn.execute_batch(&format!(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            user_id TEXT UNIQUE NOT NULL,
            password_hash TEXT DEFAULT NULL,
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS reports (
            report_id TEXT PRIMARY KEY,
            user_id INTEGER,
            file_format TEXT,
            data_source TEXT,
            name TEXT,
            select_default boolean,
            total_snps INTEGER,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS RPT_TEMPLATE01 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chromosome TEXT,
            position INTEGER,
            ref TEXT,
            alt TEXT,
            rsid TEXT DEFAULT null,
            gnomAD_AF FLOAT DEFAULT null,
            gene TEXT,
            clnsig TEXT DEFAULT null,
            clndn TEXT DEFAULT null,
            genotype TEXT,
            gt TEXT
        );
        CREATE TABLE IF NOT EXISTS haplogroup (
            report_id TEXT PRIMARY KEY,
            y_hap TEXT DEFAULT null,
            mt_hap TEXT DEFAULT null
        );
        CREATE TABLE IF NOT EXISTS admixture (
            report_id TEXT PRIMARY KEY,
            {admixture_cols}
        );
        CREATE TABLE IF NOT EXISTS import_jobs (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL UNIQUE,
            user_id TEXT NOT NULL,
            source TEXT NOT NULL,
            name TEXT NOT NULL,
            is_default INTEGER NOT NULL,
            stage TEXT NOT NULL,
            error TEXT
        );"
    ))?;
    Ok(())
}

pub fn table_exists(conn: &Connection, name: &str) -> Result<bool> {
    let exists: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            [name],
            |r| r.get(0),
        )
        .ok();
    Ok(exists.is_some())
}

pub fn table_columns(conn: &Connection, table: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    let mut cols = Vec::new();
    for r in rows {
        cols.push(r?);
    }
    Ok(cols)
}

pub fn sql_value_to_json(val: ValueRef<'_>) -> Value {
    match val {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::Number(Number::from(i)),
        ValueRef::Real(f) => Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => Value::String(String::from_utf8_lossy(b).into_owned()),
    }
}

pub fn row_to_json_map(row: &Row<'_>, column_names: &[String]) -> Result<Map<String, Value>> {
    let mut map = Map::with_capacity(column_names.len());
    for (i, name) in column_names.iter().enumerate() {
        let val = sql_value_to_json(row.get_ref(i)?);
        map.insert(name.clone(), val);
    }
    Ok(map)
}

pub fn row_to_json_array(row: &Row<'_>, col_count: usize) -> Result<Vec<Value>> {
    let mut out = Vec::with_capacity(col_count);
    for i in 0..col_count {
        out.push(sql_value_to_json(row.get_ref(i)?));
    }
    Ok(out)
}
