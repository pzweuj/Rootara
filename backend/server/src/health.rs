use crate::cache::CacheManager;
use crate::config::RuntimeConfig;
use crate::db::DbPool;
use crate::traits::{
    get_report_backfill_status, get_trait_catalog_metadata, persisted_trait_catalog_matches,
    validate_production_catalog,
};
use chrono::Local;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

pub struct HealthMonitor {
    start_instant: Instant,
    start_epoch_secs: f64,
}

impl HealthMonitor {
    pub fn new() -> Self {
        let now_epoch = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs_f64();
        Self {
            start_instant: Instant::now(),
            start_epoch_secs: now_epoch,
        }
    }

    pub fn uptime_seconds(&self) -> f64 {
        self.start_instant.elapsed().as_secs_f64()
    }

    pub fn readiness(&self, cfg: &RuntimeConfig, pool: &DbPool) -> (u16, Value) {
        let result: anyhow::Result<Value> = (|| {
            pool.with_conn(|conn| {
                conn.execute_batch("SELECT 1")?;
                Ok(())
            })?;

            let catalog = get_trait_catalog_metadata(cfg)?;
            let count = catalog.get("count").and_then(Value::as_u64).unwrap_or(0) as usize;
            if let Some(expected) = cfg.expected_trait_count {
                if count != expected {
                    anyhow::bail!("trait catalog count does not match release contract");
                }
            }
            if catalog
                .get("statuses")
                .and_then(|s| s.get("missing"))
                .and_then(Value::as_u64)
                .unwrap_or(0)
                > 0
            {
                anyhow::bail!("trait catalog has missing evidence records");
            }
            if !persisted_trait_catalog_matches(cfg, &catalog) {
                anyhow::bail!("persisted trait catalog metadata is missing or stale");
            }
            if cfg.require_curated_catalog {
                let curated = catalog
                    .get("statuses")
                    .and_then(|s| s.get("curated"))
                    .and_then(Value::as_u64)
                    .unwrap_or(0) as usize;
                if curated != count {
                    anyhow::bail!("release requires a fully curated trait catalog");
                }
            }

            let locus_hash = catalog
                .get("locus_hash")
                .and_then(Value::as_str)
                .unwrap_or("");
            let backfill = get_report_backfill_status(&cfg.db_path, locus_hash)?;
            if backfill.get("ready").and_then(Value::as_bool) != Some(true) {
                anyhow::bail!(
                    "one or more reports have not passed the current trait import migration"
                );
            }

            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs_f64();
            Ok(json!({
                "status": "ready",
                "timestamp": now,
                "traitCatalog": catalog,
                "traitImporter": backfill,
            }))
        })();

        match result {
            Ok(val) => (200, val),
            Err(err) => (
                503,
                json!({
                    "status": "not_ready",
                    "error": err.to_string(),
                }),
            ),
        }
    }

    pub fn full_health(
        &self,
        cfg: &RuntimeConfig,
        pool: &DbPool,
        cache: &CacheManager,
    ) -> (u16, Value) {
        let start = Instant::now();
        let db_check = check_database(pool);
        let cache_check = check_cache(cache);
        let trait_check = check_trait_catalog(cfg);
        let disk_info = get_disk_info(&cfg.data_dir);
        let disk_check = check_disk_space(&disk_info);
        let mem_info = get_memory_info();
        let mem_check = check_memory_usage(&mem_info);

        let checks = json!({
            "database": db_check,
            "cache": cache_check,
            "trait_catalog": trait_check,
            "disk_space": disk_check,
            "memory": mem_check,
        });

        let mut overall = "healthy";
        let mut critical_issues: Vec<String> = Vec::new();
        let mut warnings: Vec<String> = Vec::new();

        if let Some(obj) = checks.as_object() {
            for (name, val) in obj {
                let st = val
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown");
                if matches!(st, "unhealthy" | "critical" | "error") {
                    overall = "unhealthy";
                    critical_issues.push(name.clone());
                } else if matches!(st, "degraded" | "warning") && overall == "healthy" {
                    overall = "degraded";
                    warnings.push(name.clone());
                }
            }
        }

        let duration_ms = (start.elapsed().as_secs_f64() * 1000.0 * 100.0).round() / 100.0;
        let mut details = json!({
            "system": {
                "cpu": get_cpu_info(),
                "memory": mem_info,
                "disk": disk_info,
                "process": self.get_process_info(),
                "network": get_network_info(),
            },
            "check_duration_ms": duration_ms,
        });
        if !critical_issues.is_empty() {
            details["critical_issues"] = json!(critical_issues);
        }
        if !warnings.is_empty() {
            details["warnings"] = json!(warnings);
        }

        let status_code = if overall == "unhealthy" { 503 } else { 200 };
        let payload = json!({
            "status": overall,
            "timestamp": Local::now().naive_local().format("%Y-%m-%dT%H:%M:%S%.6f").to_string(),
            "uptime_seconds": self.uptime_seconds(),
            "checks": checks,
            "details": details,
        });
        (status_code, payload)
    }

    fn get_process_info(&self) -> Value {
        let (rss, vms, threads) = read_process_stats();
        json!({
            "pid": std::process::id(),
            "memory_rss": rss,
            "memory_vms": vms,
            "cpu_percent": 0.0,
            "num_threads": threads,
            "create_time": self.start_epoch_secs,
            "uptime_seconds": self.uptime_seconds(),
        })
    }
}

fn check_database(pool: &DbPool) -> Value {
    let start = Instant::now();
    let path = pool.path();
    let exists = path.exists();
    match pool.with_conn(|conn| {
        conn.execute_batch("SELECT 1")?;
        Ok(())
    }) {
        Ok(()) => {
            let ms = (start.elapsed().as_secs_f64() * 1000.0 * 100.0).round() / 100.0;
            let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
            json!({
                "status": "healthy",
                "response_time_ms": ms,
                "pool_stats": pool.stats(),
                "database_file_exists": exists,
                "database_size_bytes": size,
            })
        }
        Err(err) => json!({
            "status": "unhealthy",
            "error": err.to_string(),
            "database_file_exists": exists,
        }),
    }
}

fn check_cache(cache: &CacheManager) -> Value {
    let start = Instant::now();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let key = format!("health_check_{now}");
    let val = json!({"test": true, "timestamp": now});
    cache.set("health", &key, val, Some(10.0));
    let retrieved = cache.get("health", &key);
    let ms = (start.elapsed().as_secs_f64() * 1000.0 * 100.0).round() / 100.0;
    let stats = cache.get_stats();
    cache.delete("health", &key);
    let ok = retrieved
        .and_then(|v| v.get("test").and_then(Value::as_bool))
        .unwrap_or(false);
    json!({
        "status": if ok { "healthy" } else { "degraded" },
        "type": stats.get("type").cloned().unwrap_or_else(|| json!("memory")),
        "available": true,
        "response_time_ms": ms,
        "stats": stats,
    })
}

fn check_trait_catalog(cfg: &RuntimeConfig) -> Value {
    let Ok(metadata) = get_trait_catalog_metadata(cfg) else {
        return json!({
            "status": "unhealthy",
            "error": "trait catalog is unreadable",
        });
    };
    let mut out = metadata.as_object().cloned().unwrap_or_default();
    let count = metadata.get("count").and_then(Value::as_u64).unwrap_or(0) as usize;
    if let Some(expected) = cfg.expected_trait_count {
        if count != expected {
            out.insert("status".to_string(), json!("unhealthy"));
            out.insert(
                "error".to_string(),
                json!("trait catalog count does not match the release contract"),
            );
            out.insert("expected_count".to_string(), json!(expected));
            return Value::Object(out);
        }
    }
    if metadata
        .get("statuses")
        .and_then(|s| s.get("missing"))
        .and_then(Value::as_u64)
        .unwrap_or(0)
        > 0
    {
        out.insert("status".to_string(), json!("unhealthy"));
        out.insert(
            "error".to_string(),
            json!("trait catalog has rules without evidence records"),
        );
        return Value::Object(out);
    }
    if cfg.require_curated_catalog {
        let curated = metadata
            .get("statuses")
            .and_then(|s| s.get("curated"))
            .and_then(Value::as_u64)
            .unwrap_or(0) as usize;
        let non_curated = count.saturating_sub(curated);
        if non_curated > 0 {
            out.insert("status".to_string(), json!("unhealthy"));
            out.insert(
                "error".to_string(),
                json!("release requires every production trait to be curated"),
            );
            out.insert("non_curated".to_string(), json!(non_curated));
            return Value::Object(out);
        }
        let expected_n = cfg.expected_trait_count.unwrap_or(152);
        let errors = validate_production_catalog(cfg, expected_n);
        if !errors.is_empty() {
            out.insert("status".to_string(), json!("unhealthy"));
            out.insert(
                "error".to_string(),
                json!("trait catalog failed production validation"),
            );
            out.insert(
                "validation_errors".to_string(),
                json!(&errors[..errors.len().min(20)]),
            );
            return Value::Object(out);
        }
        if !persisted_trait_catalog_matches(cfg, &metadata) {
            out.insert("status".to_string(), json!("unhealthy"));
            out.insert(
                "error".to_string(),
                json!("persisted trait catalog metadata is missing or stale"),
            );
            return Value::Object(out);
        }
    }
    out.insert("status".to_string(), json!("healthy"));
    Value::Object(out)
}

fn get_cpu_info() -> Value {
    let cpu_count = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    let (l1, l5, l15) = read_loadavg();
    json!({
        "cpu_percent": 0.0,
        "cpu_count": cpu_count,
        "load_average": {
            "1min": l1,
            "5min": l5,
            "15min": l15,
        }
    })
}

fn read_loadavg() -> (f64, f64, f64) {
    if let Ok(content) = fs::read_to_string("/proc/loadavg") {
        let mut parts = content.split_whitespace();
        let a = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0.0);
        let b = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0.0);
        let c = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0.0);
        return (a, b, c);
    }
    (0.0, 0.0, 0.0)
}

fn get_memory_info() -> Value {
    #[cfg(target_os = "linux")]
    {
        let mut total = 0u64;
        let mut available = 0u64;
        let mut swap_total = 0u64;
        let mut swap_free = 0u64;
        if let Ok(content) = fs::read_to_string("/proc/meminfo") {
            for line in content.lines() {
                let mut parts = line.split_whitespace();
                let key = parts.next().unwrap_or("");
                let kb: u64 = parts.next().and_then(|v| v.parse().ok()).unwrap_or(0);
                match key {
                    "MemTotal:" => total = kb * 1024,
                    "MemAvailable:" => available = kb * 1024,
                    "SwapTotal:" => swap_total = kb * 1024,
                    "SwapFree:" => swap_free = kb * 1024,
                    _ => {}
                }
            }
        }
        let used = total.saturating_sub(available);
        let pct = if total > 0 {
            (used as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        let swap_used = swap_total.saturating_sub(swap_free);
        let swap_pct = if swap_total > 0 {
            (swap_used as f64 / swap_total as f64) * 100.0
        } else {
            0.0
        };
        json!({
            "virtual_memory": {
                "total": total,
                "available": available,
                "used": used,
                "percent": (pct * 10.0).round() / 10.0,
            },
            "swap_memory": {
                "total": swap_total,
                "used": swap_used,
                "percent": (swap_pct * 10.0).round() / 10.0,
            }
        })
    }
    #[cfg(not(target_os = "linux"))]
    {
        json!({
            "virtual_memory": { "total": 0, "available": 0, "used": 0, "percent": 0.0 },
            "swap_memory": { "total": 0, "used": 0, "percent": 0.0 }
        })
    }
}

fn check_memory_usage(mem_info: &Value) -> Value {
    let mem_pct = mem_info
        .get("virtual_memory")
        .and_then(|m| m.get("percent"))
        .and_then(Value::as_f64)
        .unwrap_or(0.0);
    let swap_pct = mem_info
        .get("swap_memory")
        .and_then(|m| m.get("percent"))
        .and_then(Value::as_f64)
        .unwrap_or(0.0);
    let status = if mem_pct > 90.0 || swap_pct > 50.0 {
        "critical"
    } else if mem_pct > 80.0 || swap_pct > 25.0 {
        "warning"
    } else {
        "healthy"
    };
    json!({
        "status": status,
        "memory_percent": mem_pct,
        "swap_percent": swap_pct,
        "details": mem_info,
    })
}

#[cfg(unix)]
fn statvfs_usage(path: &Path) -> Option<Value> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;
    let c_path = CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    let ret = unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) };
    if ret != 0 {
        return None;
    }
    let frsize = stat.f_frsize as u64;
    let total = (stat.f_blocks as u64).saturating_mul(frsize);
    let free = (stat.f_bavail as u64).saturating_mul(frsize);
    let used = total.saturating_sub((stat.f_bfree as u64).saturating_mul(frsize));
    let pct = if total > 0 {
        (used as f64 / total as f64) * 100.0
    } else {
        0.0
    };
    Some(json!({
        "total": total,
        "used": used,
        "free": free,
        "percent": pct,
    }))
}

#[cfg(not(unix))]
fn statvfs_usage(_path: &Path) -> Option<Value> {
    Some(json!({ "total": 1, "used": 0, "free": 1, "percent": 0.0 }))
}

fn get_disk_info(data_dir: &Path) -> Value {
    let root = statvfs_usage(Path::new("/"))
        .unwrap_or_else(|| json!({ "total": 1, "used": 0, "free": 1, "percent": 0.0 }));
    let mut out = json!({ "root_partition": root });
    if data_dir.exists() {
        if let Some(dp) = statvfs_usage(data_dir) {
            out["data_partition"] = dp;
        }
    }
    out
}

fn check_disk_space(disk_info: &Value) -> Value {
    let classify = |pct: f64| {
        if pct > 90.0 {
            "critical"
        } else if pct > 80.0 {
            "warning"
        } else {
            "healthy"
        }
    };
    let root_st = classify(
        disk_info
            .get("root_partition")
            .and_then(|p| p.get("percent"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    );
    let data_st = classify(
        disk_info
            .get("data_partition")
            .and_then(|p| p.get("percent"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    );
    let overall = if root_st == "critical" || data_st == "critical" {
        "critical"
    } else if root_st == "warning" || data_st == "warning" {
        "warning"
    } else {
        "healthy"
    };
    json!({
        "status": overall,
        "root_partition": root_st,
        "data_partition": data_st,
        "details": disk_info,
    })
}

fn read_process_stats() -> (u64, u64, u64) {
    #[cfg(target_os = "linux")]
    {
        let page_size = unsafe { libc::sysconf(libc::_SC_PAGESIZE) } as u64;
        let (vms, rss) = fs::read_to_string("/proc/self/statm")
            .ok()
            .map(|s| {
                let mut parts = s.split_whitespace();
                let v = parts
                    .next()
                    .and_then(|x| x.parse::<u64>().ok())
                    .unwrap_or(0);
                let r = parts
                    .next()
                    .and_then(|x| x.parse::<u64>().ok())
                    .unwrap_or(0);
                (v * page_size, r * page_size)
            })
            .unwrap_or((0, 0));
        let threads = fs::read_to_string("/proc/self/status")
            .ok()
            .and_then(|s| {
                s.lines().find_map(|line| {
                    line.strip_prefix("Threads:")
                        .and_then(|v| v.trim().parse::<u64>().ok())
                })
            })
            .unwrap_or(1);
        (rss, vms, threads)
    }
    #[cfg(not(target_os = "linux"))]
    {
        (0, 0, 1)
    }
}

fn get_network_info() -> Value {
    let mut bytes_recv = 0u64;
    let mut packets_recv = 0u64;
    let mut bytes_sent = 0u64;
    let mut packets_sent = 0u64;
    if let Ok(content) = fs::read_to_string("/proc/net/dev") {
        for line in content.lines().skip(2) {
            if let Some((_, rest)) = line.split_once(':') {
                let cols: Vec<u64> = rest
                    .split_whitespace()
                    .filter_map(|v| v.parse().ok())
                    .collect();
                if cols.len() >= 10 {
                    bytes_recv = bytes_recv.saturating_add(cols[0]);
                    packets_recv = packets_recv.saturating_add(cols[1]);
                    bytes_sent = bytes_sent.saturating_add(cols[8]);
                    packets_sent = packets_sent.saturating_add(cols[9]);
                }
            }
        }
    }
    json!({
        "bytes_sent": bytes_sent,
        "bytes_recv": bytes_recv,
        "packets_sent": packets_sent,
        "packets_recv": packets_recv,
        "connections_count": 0,
    })
}
