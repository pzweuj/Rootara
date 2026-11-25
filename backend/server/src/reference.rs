use anyhow::{Context, Result};
use flate2::read::GzDecoder;
use rusqlite::{params, Connection};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use tempfile::NamedTempFile;

pub fn build_reference(source: &Path, destination: &Path) -> Result<()> {
    let parent = destination
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(parent)?;
    let tmp = NamedTempFile::new_in(parent)?;
    let tmp_path = tmp.into_temp_path();

    {
        let mut db = Connection::open(&tmp_path)?;
        db.execute_batch(
            "PRAGMA journal_mode=OFF;
             PRAGMA synchronous=OFF;
             CREATE TABLE variants (
                chrom TEXT, start TEXT, seq INTEGER, ref TEXT, alt TEXT, rsid TEXT, af TEXT,
                gene TEXT, clnsig TEXT, clndn TEXT, PRIMARY KEY(chrom,start,seq)
             ) WITHOUT ROWID;",
        )?;

        let file = File::open(source)
            .with_context(|| format!("failed to open reference source {}", source.display()))?;
        let decoder = GzDecoder::new(BufReader::new(file));
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(b'\t')
            .quoting(false)
            .has_headers(true)
            .from_reader(decoder);

        let headers = reader.headers()?.clone();
        let idx = |name: &str| -> Result<usize> {
            headers
                .iter()
                .position(|h| h == name)
                .with_context(|| format!("missing reference header column {name}"))
        };
        let i_chrom = idx("Chrom")?;
        let i_start = idx("Start")?;
        let i_ref = idx("Ref")?;
        let i_alt = idx("Alt")?;
        let i_rsid = idx("RSID")?;
        let i_af = idx("gnomAD_AF")?;
        let i_gene = idx("Gene")?;
        let i_clnsig = idx("CLNSIG")?;
        let i_clndn = idx("CLNDN")?;

        let tx = db.transaction()?;
        {
            let mut stmt = tx.prepare("INSERT INTO variants VALUES (?,?,?,?,?,?,?,?,?,?)")?;
            let mut record = csv::StringRecord::new();
            let mut sequence: i64 = 0;
            while reader.read_record(&mut record)? {
                let seq = sequence;
                sequence += 1;

                let mut ref_a = record.get(i_ref).unwrap_or("");
                let mut alt_a = record.get(i_alt).unwrap_or("");
                if ref_a.len() > alt_a.len() {
                    ref_a = "I";
                    alt_a = "D";
                } else if ref_a.len() < alt_a.len() {
                    ref_a = "D";
                    alt_a = "I";
                } else if ref_a.len() != 1 {
                    continue;
                } else if alt_a == "-" {
                    ref_a = "I";
                    alt_a = "D";
                } else if ref_a == "-" {
                    ref_a = "D";
                    alt_a = "I";
                }

                let raw_chrom = record.get(i_chrom).unwrap_or("");
                let replaced = raw_chrom.replace("chrM", "MT");
                let chrom = replaced.strip_prefix("chr").unwrap_or(&replaced);

                stmt.execute(params![
                    chrom,
                    record.get(i_start).unwrap_or(""),
                    seq,
                    ref_a,
                    alt_a,
                    record.get(i_rsid).unwrap_or(""),
                    record.get(i_af).unwrap_or(""),
                    record.get(i_gene).unwrap_or(""),
                    record.get(i_clnsig).unwrap_or(""),
                    record.get(i_clndn).unwrap_or(""),
                ])?;
            }
        }
        tx.commit()?;
    }

    tmp_path.persist(destination).map_err(|e| e.error)?;
    Ok(())
}
