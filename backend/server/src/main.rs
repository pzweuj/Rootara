use anyhow::{anyhow, Result};
use clap::{Parser, Subcommand};
use rootara_server::archive::migrate_text_archives;
use rootara_server::catalog_audit::{
    audit_legacy_traits, validate_candidate_manifest, validate_catalog,
    validate_production_catalog_full,
};
use rootara_server::config::RuntimeConfig;
use rootara_server::init::initialize_database;
use rootara_server::reference::build_reference;
use rootara_server::reports::verify_report_rows_sha256;
use rootara_server::server::run_server;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Parser)]
#[command(name = "rootara-server", version)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize volume and start public (3000) and private (8000) HTTP servers.
    Serve {
        /// Skip startup DB initialization and migration (for development/tests).
        #[arg(long)]
        skip_init: bool,
    },
    /// Initialize the volume and database, then exit.
    Init,
    /// Probe http://127.0.0.1:<PORT>/health/ready for container HEALTHCHECK.
    Healthcheck {
        #[arg(long)]
        port: Option<u16>,
        #[arg(long, default_value = "/health/ready")]
        path: String,
    },
    /// Build the read-only SQLite variant lookup reference from a gzipped TSV.
    BuildReference {
        source: PathBuf,
        destination: PathBuf,
    },
    /// Convert legacy TXT uploads in RAWDATA_DIR to verified Parquet archives.
    MigrateArchives {
        #[arg(long)]
        dir: Option<PathBuf>,
        #[arg(long)]
        remove_text: bool,
    },
    /// Print the row-order SHA-256 of a report variant table (for parity verification).
    VerifyRows {
        report_id: String,
        #[arg(long)]
        db: Option<PathBuf>,
    },
    /// Run full trait catalog, evidence, locus registry, and candidate manifest audits.
    ValidateCatalog {
        #[arg(long, default_value = ".")]
        repo_root: PathBuf,
        #[arg(long, default_value_t = 152)]
        expected_count: usize,
    },
}

fn run_healthcheck(port: u16, path: &str) -> Result<()> {
    let addr = format!("127.0.0.1:{port}");
    let mut stream = TcpStream::connect_timeout(&addr.parse()?, Duration::from_secs(4))?;
    stream.set_read_timeout(Some(Duration::from_secs(4)))?;
    stream.set_write_timeout(Some(Duration::from_secs(4)))?;
    let req = format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
    stream.write_all(req.as_bytes())?;
    let mut buf = [0u8; 512];
    let n = stream.read(&mut buf)?;
    let first_line = std::str::from_utf8(&buf[..n])
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("");
    if first_line.contains(" 200 ") {
        Ok(())
    } else {
        Err(anyhow!("unhealthy response: {first_line}"))
    }
}

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    match cli.command.unwrap_or(Commands::Serve { skip_init: false }) {
        Commands::Serve { skip_init } => {
            let cfg = RuntimeConfig::from_env()?;
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()?;
            rt.block_on(run_server(cfg, skip_init))?;
        }
        Commands::Init => {
            let mut cfg = RuntimeConfig::from_env()?;
            cfg.require_admin_password()?;
            cfg.ensure_data_directories()?;
            cfg.ensure_jwt_secret()?;
            initialize_database(&cfg)?;
        }
        Commands::Healthcheck { port, path } => {
            let p = port.unwrap_or_else(|| {
                std::env::var("PORT")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(3000)
            });
            run_healthcheck(p, &path)?;
        }
        Commands::BuildReference {
            source,
            destination,
        } => {
            build_reference(&source, &destination)?;
        }
        Commands::MigrateArchives { dir, remove_text } => {
            let cfg = RuntimeConfig::from_env()?;
            let target_dir = dir.unwrap_or(cfg.rawdata_dir);
            for name in migrate_text_archives(&cfg.archive_tool, &target_dir, remove_text)? {
                println!("{name}");
            }
        }
        Commands::VerifyRows { report_id, db } => {
            let cfg = RuntimeConfig::from_env()?;
            let db_path = db.unwrap_or(cfg.db_path);
            let digest = verify_report_rows_sha256(&db_path, &report_id)?;
            println!("{digest}");
        }
        Commands::ValidateCatalog {
            repo_root,
            expected_count,
        } => {
            let db_dir = repo_root.join("backend").join("database");
            let default_path = db_dir.join("default-traits.json");
            let evidence_path = db_dir.join("trait-evidence.json");
            let locus_path = db_dir.join("trait-locus-registry.json");
            let normalized_path = db_dir.join("trait-catalog.json");
            let manifest_path = db_dir.join("trait-candidate-review.json");
            let candidate_source = repo_root
                .join("docs")
                .join("wegene-demo-priority-candidates.json");

            let audit = audit_legacy_traits(&default_path)?;
            let rule_errors = validate_catalog(&default_path, &evidence_path)?;
            let prod_errors = validate_production_catalog_full(
                &default_path,
                &evidence_path,
                &locus_path,
                &normalized_path,
                expected_count,
            )?;
            let manifest_errors = if manifest_path.exists() && candidate_source.exists() {
                validate_candidate_manifest(&manifest_path, &candidate_source, &repo_root)?
            } else {
                Vec::new()
            };

            let summary = serde_json::json!({
                "valid": rule_errors.is_empty() && prod_errors.is_empty() && manifest_errors.is_empty(),
                "audit": audit,
                "rule_errors": rule_errors,
                "production_errors": prod_errors,
                "candidate_manifest_errors": manifest_errors,
            });
            println!("{}", serde_json::to_string_pretty(&summary)?);
            if summary["valid"].as_bool() != Some(true) {
                return Err(anyhow!("trait catalog validation failed"));
            }
        }
    }
    Ok(())
}
