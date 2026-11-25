use crate::config::{generate_random_upper_alnum, RuntimeConfig};
use crate::db::{init_sqlite_schema, open_connection, table_exists};
use crate::reports::{create_new_report, ReportInput};
use crate::traits::{
    backfill_all_reports, ensure_report_rsid_indexes, get_trait_catalog_metadata,
    json_to_trait_table, persist_trait_catalog_metadata, validate_production_catalog,
};
use anyhow::{anyhow, Result};
use chrono::Local;
use rusqlite::params;
use serde_json::Value;
use tracing::info;

pub fn initialize_database(cfg: &RuntimeConfig) -> Result<()> {
    init_sqlite_schema(&cfg.db_path)?;

    let email = &cfg.admin_email;
    let name = email
        .split('@')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("Admin");
    let template_id = "RPT_TEMPLATE01";

    let (user_id, need_template_snps) = {
        let conn = open_connection(&cfg.db_path)?;
        let existing_user: Option<String> = conn
            .query_row("SELECT user_id FROM users WHERE email = ?", [email], |r| {
                r.get(0)
            })
            .ok();
        let user_id = if let Some(uid) = existing_user {
            uid
        } else {
            let uid = format!("ID_{}", generate_random_upper_alnum(10));
            let now = Local::now()
                .naive_local()
                .format("%Y-%m-%dT%H:%M:%S%.6f")
                .to_string();
            conn.execute(
                "INSERT INTO users (email, user_id, name, created_at) VALUES (?, ?, ?, ?)",
                params![email, &uid, name, now],
            )?;
            uid
        };

        let has_admix: Option<String> = conn
            .query_row(
                "SELECT report_id FROM admixture WHERE report_id = ?",
                [template_id],
                |r| r.get(0),
            )
            .ok();
        if has_admix.is_none() {
            conn.execute(
                "INSERT INTO admixture (report_id, Omotic, North_Sea_Germanic, West_African, East_Asian)
                 VALUES (?, ?, ?, ?, ?)",
                params![template_id, 0.01_f64, 0.02_f64, 13.28_f64, 86.69_f64],
            )?;
        }

        let has_haplo: Option<String> = conn
            .query_row(
                "SELECT report_id FROM haplogroup WHERE report_id = ?",
                [template_id],
                |r| r.get(0),
            )
            .ok();
        if has_haplo.is_none() {
            conn.execute(
                "INSERT INTO haplogroup (report_id, y_hap, mt_hap) VALUES (?, ?, ?)",
                params![template_id, "O2a2a1a1a", "F1a1"],
            )?;
        }

        let need_snps = if !table_exists(&conn, template_id)? {
            true
        } else {
            let cnt: i64 =
                conn.query_row("SELECT COUNT(*) FROM RPT_TEMPLATE01", [], |r| r.get(0))?;
            cnt == 0
        };

        (user_id, need_snps)
    };

    if need_template_snps {
        create_new_report(
            cfg,
            &user_id,
            ReportInput::Path(&cfg.template_path),
            "23andme",
            "EXAMPLE",
            &cfg.db_path,
            false,
            true,
            None,
            |_| {},
        )?;
    }

    // Synchronize the shipped default trait catalog while preserving custom TRA_* rows.
    json_to_trait_table(&cfg.default_traits_path, &cfg.db_path)?;

    // Ensure RSID indexes on all report tables and backfill catalog loci.
    ensure_report_rsid_indexes(&cfg.db_path)?;
    let backfilled = backfill_all_reports(cfg, &cfg.db_path)?;
    info!("Trait report backfill complete: {:?}", backfilled);

    // Release gates matching deploy/launcher.py.
    let catalog = get_trait_catalog_metadata(cfg)?;
    let count = catalog.get("count").and_then(Value::as_u64).unwrap_or(0) as usize;
    if let Some(expected) = cfg.expected_trait_count {
        if count != expected {
            return Err(anyhow!(
                "trait catalog count {count} does not match {expected}"
            ));
        }
    }
    let locus_count = catalog
        .get("locus_count")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let verified_locus_count = catalog
        .get("verified_locus_count")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    if locus_count != 154 || verified_locus_count != 154 {
        return Err(anyhow!(
            "release requires 154 verified trait loci; found {verified_locus_count}/{locus_count}"
        ));
    }

    if cfg.require_curated_catalog {
        let curated = catalog
            .get("statuses")
            .and_then(|s| s.get("curated"))
            .and_then(Value::as_u64)
            .unwrap_or(0) as usize;
        if curated != count {
            return Err(anyhow!(
                "release requires every production trait to be curated"
            ));
        }
        let errors = validate_production_catalog(cfg, cfg.expected_trait_count.unwrap_or(152));
        if !errors.is_empty() {
            let preview = errors[..errors.len().min(5)].join("; ");
            return Err(anyhow!(
                "production trait catalog validation failed: {preview}"
            ));
        }
    }

    persist_trait_catalog_metadata(&catalog, &cfg.trait_catalog_state_path)?;
    Ok(())
}
