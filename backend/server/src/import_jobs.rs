use crate::config::{generate_random_hex_upper, RuntimeConfig};
use crate::db::open_connection;
use crate::reports::{create_new_report, ReportInput};
use anyhow::{anyhow, Result};
use rusqlite::params;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info};

enum WorkerTask {
    Job(String),
    Direct {
        user_id: String,
        input_data: String,
        source_from: String,
        report_name: String,
        default_report: bool,
        reply: tokio::sync::oneshot::Sender<Result<String>>,
    },
}

pub struct ImportQueue {
    cfg: Arc<RuntimeConfig>,
    tx: mpsc::UnboundedSender<WorkerTask>,
    worker_handle: tokio::sync::Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl ImportQueue {
    pub fn start(cfg: Arc<RuntimeConfig>) -> Result<Arc<Self>> {
        fs::create_dir_all(&cfg.imports_dir)?;
        let pending_jobs: Vec<String> = {
            let conn = open_connection(&cfg.db_path)?;
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS import_jobs (
                    id TEXT PRIMARY KEY,
                    report_id TEXT NOT NULL UNIQUE,
                    user_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    name TEXT NOT NULL,
                    is_default INTEGER NOT NULL,
                    stage TEXT NOT NULL,
                    error TEXT
                );",
            )?;
            let mut stmt = conn.prepare("SELECT id, stage FROM import_jobs ORDER BY rowid")?;
            let rows =
                stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
            let mut pending = Vec::new();
            for row in rows {
                let (id, stage) = row?;
                if stage == "done" || stage == "failed" {
                    let _ = fs::remove_file(cfg.imports_dir.join(&id));
                } else {
                    pending.push(id);
                }
            }
            pending
        };

        if let Ok(entries) = fs::read_dir(&cfg.imports_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                if let Some(s) = name.to_str() {
                    if s.starts_with("receiving-") && s.ends_with(".part") {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }

        let (tx, mut rx) = mpsc::unbounded_channel::<WorkerTask>();
        let worker_cfg = cfg.clone();
        let handle = tokio::spawn(async move {
            while let Some(task) = rx.recv().await {
                let cfg_clone = worker_cfg.clone();
                match task {
                    WorkerTask::Job(job_id) => {
                        let res = tokio::task::spawn_blocking(move || {
                            run_job(&cfg_clone, &job_id);
                        })
                        .await;
                        if let Err(err) = res {
                            error!("import worker task panicked: {err}");
                        }
                    }
                    WorkerTask::Direct {
                        user_id,
                        input_data,
                        source_from,
                        report_name,
                        default_report,
                        reply,
                    } => {
                        let res = tokio::task::spawn_blocking(move || {
                            create_new_report(
                                &cfg_clone,
                                &user_id,
                                ReportInput::Text(&input_data),
                                &source_from,
                                &report_name,
                                &cfg_clone.db_path,
                                default_report,
                                false,
                                None,
                                |_| {},
                            )
                        })
                        .await
                        .unwrap_or_else(|e| Err(anyhow!("import task join error: {e}")));
                        let _ = reply.send(res);
                    }
                }
            }
            info!("import worker stopped");
        });

        for job in pending_jobs {
            let _ = tx.send(WorkerTask::Job(job));
        }

        Ok(Arc::new(Self {
            cfg,
            tx,
            worker_handle: tokio::sync::Mutex::new(Some(handle)),
        }))
    }

    pub fn enqueue(
        &self,
        job_id: &str,
        upload_path: &Path,
        user_id: &str,
        source: &str,
        name: &str,
        is_default: bool,
    ) -> Result<()> {
        fs::create_dir_all(&self.cfg.imports_dir)?;
        let mut conn = open_connection(&self.cfg.db_path)?;
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let exists: Option<i64> = tx
            .query_row("SELECT 1 FROM import_jobs WHERE id=?", [job_id], |r| {
                r.get(0)
            })
            .ok();
        if exists.is_some() {
            return Ok(());
        }
        let target = self.cfg.imports_dir.join(job_id);
        fs::rename(upload_path, &target)?;
        let report_id = format!("RPT_{}", generate_random_hex_upper(5));
        tx.execute(
            "INSERT INTO import_jobs VALUES (?, ?, ?, ?, ?, ?, 'queued', NULL)",
            params![
                job_id,
                report_id,
                user_id,
                source,
                name,
                if is_default { 1i64 } else { 0i64 },
            ],
        )?;
        tx.commit()?;
        let _ = self.tx.send(WorkerTask::Job(job_id.to_string()));
        Ok(())
    }

    pub async fn submit_direct_report(
        &self,
        user_id: String,
        input_data: String,
        source_from: String,
        report_name: String,
        default_report: bool,
    ) -> Result<String> {
        let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
        self.tx
            .send(WorkerTask::Direct {
                user_id,
                input_data,
                source_from,
                report_name,
                default_report,
                reply: reply_tx,
            })
            .map_err(|_| anyhow!("import worker channel closed"))?;
        reply_rx
            .await
            .map_err(|_| anyhow!("import worker dropped response"))?
    }

    pub fn status(&self, job_id: &str) -> Result<Option<Value>> {
        let conn = open_connection(&self.cfg.db_path)?;
        let row = conn
            .query_row(
                "SELECT id, report_id, stage, error FROM import_jobs WHERE id=?",
                [job_id],
                |r| {
                    Ok(json!({
                        "id": r.get::<_, String>(0)?,
                        "report_id": r.get::<_, String>(1)?,
                        "stage": r.get::<_, String>(2)?,
                        "error": r.get::<_, Option<String>>(3)?,
                    }))
                },
            )
            .ok();
        Ok(row)
    }

    pub async fn shutdown(&self) {
        if let Some(handle) = self.worker_handle.lock().await.take() {
            handle.abort();
        }
    }
}

fn update_stage(db_path: &Path, job_id: &str, stage: &str, error: Option<&str>) {
    if let Ok(conn) = open_connection(db_path) {
        let _ = conn.execute(
            "UPDATE import_jobs SET stage=?, error=? WHERE id=?",
            params![stage, error, job_id],
        );
    }
}

fn run_job(cfg: &RuntimeConfig, job_id: &str) {
    let row: Option<(String, String, String, String, bool)> =
        open_connection(&cfg.db_path).ok().and_then(|conn| {
            conn.query_row(
                "SELECT report_id, user_id, source, name, is_default FROM import_jobs WHERE id=?",
                [job_id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, i64>(4)? != 0,
                    ))
                },
            )
            .ok()
        });
    let Some((report_id, user_id, source, name, is_default)) = row else {
        return;
    };

    let spool_path = cfg.imports_dir.join(job_id);
    let result = create_new_report(
        cfg,
        &user_id,
        ReportInput::Path(&spool_path),
        &source,
        &name,
        &cfg.db_path,
        is_default,
        false,
        Some(&report_id),
        |stage| update_stage(&cfg.db_path, job_id, stage, None),
    );

    match result {
        Ok(_) => update_stage(&cfg.db_path, job_id, "done", None),
        Err(err) => update_stage(&cfg.db_path, job_id, "failed", Some(&err.to_string())),
    }
    let _ = fs::remove_file(&spool_path);
}
