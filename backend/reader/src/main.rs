use anyhow::{ensure, Context, Result};
use clap::{Parser, ValueEnum};
use csv::{ReaderBuilder, StringRecord};
use rusqlite::{params, Connection, OpenFlags, Statement};
use std::path::PathBuf;

#[derive(Clone, Copy, ValueEnum, PartialEq)]
enum Vendor {
    #[value(name = "23andme")]
    TwentyThree,
    Wegene,
    Ancestry,
}

#[derive(Parser)]
struct Args {
    #[arg(long)]
    input: PathBuf,
    #[arg(long, value_enum)]
    method: Vendor,
    #[arg(long)]
    reference: PathBuf,
    #[arg(long)]
    db: PathBuf,
    #[arg(long)]
    report: String,
}

// Candidate equality includes all annotation fields. Equal-ranked conflicts are
// ambiguous even when they share the same alleles and RSID.
type Annotation = [String; 7];

fn best_match(
    query: &mut Statement,
    chrom: &str,
    start: &str,
    id: &str,
    gt: &[u8],
) -> Result<Option<Annotation>> {
    let mut best = None;
    let mut rank = 0;
    let mut ambiguous = false;
    let mut rows = query.query(params![chrom, start])?;
    while let Some(row) = rows.next()? {
        let reference = row.get_ref(0)?.as_str()?.as_bytes()[0];
        let alt = row.get_ref(1)?.as_str()?.as_bytes()[0];
        if !gt.iter().all(|&base| base == reference || base == alt) {
            continue;
        }
        let priority = if row.get_ref(2)?.as_str()? == id {
            2
        } else {
            1
        };
        if priority >= rank {
            let record = [
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ];
            if priority > rank {
                best = Some(record);
                rank = priority;
                ambiguous = false;
            } else if best.as_ref() != Some(&record) {
                ambiguous = true;
            }
        }
    }
    Ok(if ambiguous { None } else { best })
}

fn import(args: &Args) -> Result<()> {
    let table = &args.report;
    ensure!(
        table == "RPT_TEMPLATE01"
            || table.strip_prefix("RPT_").is_some_and(|id| id.len() == 10
                && id
                    .bytes()
                    .all(|b| b.is_ascii_digit() || b.is_ascii_uppercase())),
        "invalid report id"
    );
    let reference = Connection::open_with_flags(&args.reference, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    reference.execute_batch("BEGIN")?;
    let mut lookup = reference.prepare(
        "SELECT ref,alt,rsid,af,gene,clnsig,clndn FROM variants WHERE chrom=? AND start=?",
    )?;
    let ancestry = args.method == Vendor::Ancestry;
    let mut reader = ReaderBuilder::new()
        .delimiter(b'\t')
        .comment(Some(b'#'))
        .has_headers(ancestry)
        .quoting(ancestry)
        .flexible(!ancestry)
        .from_path(&args.input)?;
    let mut indices = [0, 1, 2, 3, 4];
    if ancestry {
        let header = reader.headers()?;
        for (i, name) in ["rsid", "chromosome", "position", "allele1", "allele2"]
            .iter()
            .enumerate()
        {
            indices[i] = header
                .iter()
                .position(|field| field == *name)
                .with_context(|| format!("missing Ancestry column {name}"))?;
        }
    }
    let mut db = Connection::open(&args.db)?;
    let tx = db.transaction()?;
    tx.execute_batch(&format!(
        "DROP TABLE IF EXISTS {table};
        CREATE TABLE {table} (chromosome TEXT, position INTEGER, ref TEXT, alt TEXT,
        rsid TEXT, gnomAD_AF REAL, gene TEXT, clnsig TEXT, clndn TEXT, genotype TEXT, gt TEXT)"
    ))?;
    let mut insert = tx.prepare(&format!(
        "INSERT INTO {table} VALUES
        (?, ?, ?, ?, nullif(?,''), nullif(?,''), nullif(?,''), nullif(?,''), nullif(?,''), ?, ?)"
    ))?;
    let mut row = StringRecord::new();
    let mut genotype = String::new();
    while reader.read_record(&mut row)? {
        if row.len() < 4 {
            continue;
        }
        let id = &row[indices[0]];
        let mut chrom = &row[indices[1]];
        let start = &row[indices[2]];
        genotype.clear();
        genotype.push_str(&row[indices[3]]);
        if ancestry {
            chrom = match chrom {
                "23" => "X",
                "24" => "Y",
                "25" => continue,
                "26" => "MT",
                c => c,
            };
            genotype.push_str(&row[indices[4]]);
        } else if args.method == Vendor::TwentyThree && genotype.len() == 1 {
            genotype.push_str(&row[indices[3]]);
        }
        if genotype.len() != 2 || genotype == "--" {
            continue;
        }
        if let Some([reference, alt, rsid, af, gene, clnsig, clndn]) =
            best_match(&mut lookup, chrom, start, id, genotype.as_bytes())?
        {
            let count = genotype
                .bytes()
                .filter(|&b| b == reference.as_bytes()[0])
                .count();
            let check = ["HOM", "HET", "WT"][count];
            insert.execute(params![
                chrom, start, reference, alt, rsid, af, gene, clnsig, clndn, genotype, check
            ])?;
        }
    }
    drop(insert);
    tx.execute_batch(&format!("CREATE INDEX idx_{table}_rsid ON {table}(rsid)"))?;
    tx.commit()?;
    Ok(())
}

fn main() -> Result<()> {
    import(&Args::parse())
}
