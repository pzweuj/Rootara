use crate::db::validate_report_table_name;
use anyhow::{anyhow, ensure, Context, Result};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub fn write_archive(
    archive_tool: &str,
    source: &Path,
    destination: &Path,
    vendor: &str,
) -> Result<()> {
    if let Some(parent) = destination.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }
    let status = Command::new(archive_tool)
        .arg("pack")
        .arg(source)
        .arg(destination)
        .arg(vendor)
        .status()
        .with_context(|| format!("failed to run {archive_tool} pack"))?;
    ensure!(status.success(), "archive pack failed with status {status}");
    Ok(())
}

pub fn archive_variants(
    archive_tool: &str,
    archive_path: &Path,
    rsids: Option<&[String]>,
) -> Result<Vec<(String, String, i64, String)>> {
    if let Some(list) = rsids {
        if list.is_empty() {
            return Ok(Vec::new());
        }
    }
    let mut cmd = Command::new(archive_tool);
    cmd.arg("variants").arg(archive_path).arg("--");
    if let Some(list) = rsids {
        for rsid in list {
            cmd.arg(rsid);
        }
    }
    let mut child = cmd
        .stdout(Stdio::piped())
        .spawn()
        .with_context(|| format!("failed to run {archive_tool} variants"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow!("missing stdout from archive tool"))?;
    let reader = BufReader::new(stdout);
    let mut results = Vec::new();
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let tuple: (String, String, i64, String) = serde_json::from_str(&line)?;
        results.push(tuple);
    }
    let status = child.wait()?;
    ensure!(
        status.success(),
        "archive variants failed with status {status}"
    );
    Ok(results)
}

pub fn sha256_file(path: &Path) -> Result<[u8; 32]> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 128 * 1024];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    let digest = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest);
    Ok(out)
}

pub fn sha256_archive_export(archive_tool: &str, archive_path: &Path) -> Result<[u8; 32]> {
    let mut child = Command::new(archive_tool)
        .arg("export")
        .arg(archive_path)
        .stdout(Stdio::piped())
        .spawn()
        .with_context(|| format!("failed to run {archive_tool} export"))?;
    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow!("missing stdout from archive export"))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 128 * 1024];
    loop {
        let n = stdout.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    let status = child.wait()?;
    ensure!(
        status.success(),
        "archive export failed with status {status}"
    );
    let digest = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest);
    Ok(out)
}

pub enum RawdataSource {
    Parquet {
        path: PathBuf,
        download_name: String,
    },
    Text {
        path: PathBuf,
        download_name: String,
    },
}

pub fn find_rawdata_export(rawdata_dir: &Path, report_id: &str) -> Result<Option<RawdataSource>> {
    validate_report_table_name(report_id)?;
    if report_id == "RPT_TEMPLATE01" {
        return Ok(None);
    }
    let prefix = format!("RDT_{}.", &report_id[4..]);
    let mut entries: Vec<PathBuf> = match fs::read_dir(rawdata_dir) {
        Ok(rd) => rd
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| {
                p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with(&prefix))
                    .unwrap_or(false)
            })
            .collect(),
        Err(_) => return Ok(None),
    };
    entries.sort();

    for ext in ["parquet", "txt"] {
        for path in &entries {
            if path.extension().and_then(|e| e.to_str()) == Some(ext) {
                let download_name = path
                    .with_extension("txt")
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("rawdata.txt")
                    .to_string();
                return Ok(Some(if ext == "parquet" {
                    RawdataSource::Parquet {
                        path: path.clone(),
                        download_name,
                    }
                } else {
                    RawdataSource::Text {
                        path: path.clone(),
                        download_name,
                    }
                }));
            }
        }
    }
    Ok(None)
}

pub fn migrate_text_archives(
    archive_tool: &str,
    directory: &Path,
    remove_text: bool,
) -> Result<Vec<String>> {
    let mut sources: Vec<PathBuf> = fs::read_dir(directory)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .collect();
    sources.sort();

    let mut migrated = Vec::new();
    for source in sources {
        let Some(name) = source.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let Some(vendor) = parse_legacy_txt_vendor(name) else {
            continue;
        };
        let archive = source.with_extension("parquet");
        let expected_digest = sha256_file(&source)?;
        if !archive.exists() {
            write_archive(archive_tool, &source, &archive, vendor)?;
        }
        let actual_digest = sha256_archive_export(archive_tool, &archive)?;
        if actual_digest != expected_digest {
            return Err(anyhow!("Archive differs from {name}"));
        }
        if remove_text {
            fs::remove_file(&source)?;
        }
        if let Some(archive_name) = archive.file_name().and_then(|n| n.to_str()) {
            migrated.push(archive_name.to_string());
        }
    }
    Ok(migrated)
}

fn parse_legacy_txt_vendor(name: &str) -> Option<&'static str> {
    let rest = name.strip_prefix("RDT_")?;
    let (id, suffix) = rest.split_once('.')?;
    if id.len() != 10
        || !id
            .bytes()
            .all(|b| b.is_ascii_digit() || b.is_ascii_uppercase())
    {
        return None;
    }
    match suffix {
        "23andme.txt" => Some("23andme"),
        "ancestry.txt" => Some("ancestry"),
        "wegene.txt" => Some("wegene"),
        _ => None,
    }
}
