use anyhow::{ensure, Context, Result};
use arrow_array::builder::{BinaryBuilder, Int64Builder, StringBuilder};
use arrow_array::{Array, BinaryArray, Int64Array, RecordBatch, StringArray};
use arrow_schema::{DataType, Field, Schema};
use clap::{Parser, Subcommand, ValueEnum};
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::arrow::{ArrowWriter, ProjectionMask};
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use std::collections::HashSet;
use std::fs::File;
use std::io::{self, BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tempfile::NamedTempFile;

#[derive(Parser)]
struct Args {
    #[command(subcommand)]
    command: Command,
}

#[derive(Clone, Copy, ValueEnum)]
enum Vendor {
    #[value(name = "23andme")]
    TwentyThree,
    Wegene,
    Ancestry,
}

#[derive(Subcommand)]
enum Command {
    Pack {
        source: PathBuf,
        destination: PathBuf,
        vendor: Vendor,
    },
    Export {
        archive: PathBuf,
    },
    Variants {
        archive: PathBuf,
        rsids: Vec<String>,
    },
}

const BATCH: usize = 4096;
const CALL_COLUMNS: [&str; 4] = ["rsid", "chromosome", "position", "genotype"];

#[derive(Default)]
struct Columns {
    lines: BinaryBuilder,
    ids: StringBuilder,
    chromosomes: StringBuilder,
    positions: Int64Builder,
    genotypes: StringBuilder,
}

fn chromosome(value: &str) -> Option<&str> {
    let stripped = value.trim().strip_prefix("chr").unwrap_or(value.trim());
    match stripped {
        "25" => None,
        "23" => Some("X"),
        "24" => Some("Y"),
        "26" | "M" => Some("MT"),
        other => Some(other),
    }
}

impl Columns {
    fn append(&mut self, call: Option<(&str, &str, i64, &str)>) {
        self.ids.append_option(call.map(|v| v.0));
        self.chromosomes
            .append_option(call.and_then(|v| chromosome(v.1)));
        self.positions.append_option(call.map(|v| v.2));
        self.genotypes.append_option(call.map(|v| v.3));
    }

    fn flush(&mut self, writer: &mut ArrowWriter<&mut File>, schema: &Arc<Schema>) -> Result<()> {
        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![
                Arc::new(self.lines.finish()),
                Arc::new(self.ids.finish()),
                Arc::new(self.chromosomes.finish()),
                Arc::new(self.positions.finish()),
                Arc::new(self.genotypes.finish()),
            ],
        )?;
        writer.write(&batch)?;
        writer.flush()?;
        Ok(())
    }
}

fn ancestry_indices(fields: &[&str]) -> Result<[usize; 5]> {
    let mut indices = [0; 5];
    for (i, name) in ["rsid", "chromosome", "position", "allele1", "allele2"]
        .iter()
        .enumerate()
    {
        indices[i] = fields
            .iter()
            .position(|field| field == name)
            .with_context(|| format!("missing Ancestry column {name}"))?;
    }
    Ok(indices)
}

fn pack(source: &Path, destination: &Path, vendor: Vendor) -> Result<()> {
    let schema = Arc::new(Schema::new(vec![
        Field::new("original_line", DataType::Binary, true),
        Field::new("rsid", DataType::Utf8, true),
        Field::new("chromosome", DataType::Utf8, true),
        Field::new("position", DataType::Int64, true),
        Field::new("genotype", DataType::Utf8, true),
    ]));
    let props = WriterProperties::builder()
        .set_compression(Compression::ZSTD(Default::default()))
        .set_dictionary_enabled(false)
        .set_column_dictionary_enabled("chromosome".into(), true)
        .set_column_dictionary_enabled("genotype".into(), true)
        .set_max_row_group_size(BATCH)
        .build();
    let mut input = BufReader::new(File::open(source)?);
    let mut temp = NamedTempFile::new_in(
        destination
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new(".")),
    )?;
    let mut writer = ArrowWriter::try_new(temp.as_file_mut(), schema.clone(), Some(props))?;
    let mut columns = Columns::default();
    let mut line = Vec::new();
    let mut header: Option<[usize; 5]> = None;
    let (mut rows, mut bytes) = (0, 0);
    loop {
        line.clear();
        if input.read_until(b'\n', &mut line)? == 0 {
            break;
        }
        columns.lines.append_value(&line);
        let text = String::from_utf8_lossy(&line);
        let text = text
            .trim_start_matches('\u{feff}')
            .trim_end_matches(['\r', '\n']);
        if text.is_empty() || text.starts_with('#') {
            columns.append(None);
        } else if matches!(vendor, Vendor::Ancestry) {
            let record;
            let fields: Vec<&str> = if text.contains('"') {
                record = csv::ReaderBuilder::new()
                    .has_headers(false)
                    .delimiter(b'\t')
                    .from_reader(text.as_bytes())
                    .records()
                    .next()
                    .transpose()?
                    .unwrap_or_default();
                record.iter().collect()
            } else {
                text.split('\t').collect()
            };
            if let Some([id, chrom, pos, a, b]) = header {
                let call = (|| {
                    Some((
                        *fields.get(id)?,
                        *fields.get(chrom)?,
                        fields.get(pos)?.trim().parse().ok()?,
                        format!("{}{}", fields.get(a)?, fields.get(b)?),
                    ))
                })();
                columns.append(
                    call.as_ref()
                        .map(|(id, chr, pos, gt)| (*id, *chr, *pos, gt.as_str())),
                );
            } else {
                header = Some(ancestry_indices(&fields)?);
                columns.append(None);
            }
        } else {
            let mut fields = text.split(['\t', ',']);
            let call = (|| {
                let id = fields.next()?;
                if !id.get(..2)?.eq_ignore_ascii_case("rs") {
                    return None;
                }
                Some((
                    id,
                    fields.next()?,
                    fields.next()?.trim().parse().ok()?,
                    fields.next()?,
                ))
            })();
            columns.append(call);
        }
        rows += 1;
        bytes += line.len();
        if rows == BATCH || bytes >= 256 * 1024 {
            columns.flush(&mut writer, &schema)?;
            (rows, bytes) = (0, 0);
        }
    }
    if rows > 0 {
        columns.flush(&mut writer, &schema)?;
    }
    writer.close()?;
    temp.persist(destination)?;
    Ok(())
}

fn batches(
    path: &Path,
    names: &[&str],
) -> Result<impl Iterator<Item = std::result::Result<RecordBatch, arrow_schema::ArrowError>>> {
    let builder = ParquetRecordBatchReaderBuilder::try_new(File::open(path)?)?;
    let indices = names
        .iter()
        .map(|name| builder.schema().index_of(name))
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let mask = ProjectionMask::roots(builder.parquet_schema(), indices);
    Ok(builder
        .with_projection(mask)
        .with_batch_size(BATCH)
        .build()?)
}

fn column<'a, T: Array + 'static>(batch: &'a RecordBatch, name: &str) -> Result<&'a T> {
    batch
        .column_by_name(name)
        .and_then(|a| a.as_any().downcast_ref())
        .with_context(|| format!("invalid archive column {name}"))
}

fn main() -> Result<()> {
    let mut out = BufWriter::new(io::stdout().lock());
    match Args::parse().command {
        Command::Pack {
            source,
            destination,
            vendor,
        } => pack(&source, &destination, vendor)?,
        Command::Export { archive } => {
            for batch in batches(&archive, &["original_line"])? {
                let batch = batch?;
                let lines: &BinaryArray = column(&batch, "original_line")?;
                ensure!(lines.null_count() == 0, "missing original upload bytes");
                for line in lines.iter().flatten() {
                    out.write_all(line)?;
                }
            }
        }
        Command::Variants { archive, rsids } => {
            let wanted: HashSet<_> = rsids.into_iter().collect();
            for batch in batches(&archive, &CALL_COLUMNS)? {
                let batch = batch?;
                let ids: &StringArray = column(&batch, "rsid")?;
                let chrom: &StringArray = column(&batch, "chromosome")?;
                let pos: &Int64Array = column(&batch, "position")?;
                let gt: &StringArray = column(&batch, "genotype")?;
                for i in 0..batch.num_rows() {
                    if chrom.is_null(i) || (!wanted.is_empty() && !wanted.contains(ids.value(i))) {
                        continue;
                    }
                    serde_json::to_writer(
                        &mut out,
                        &(ids.value(i), chrom.value(i), pos.value(i), gt.value(i)),
                    )?;
                    out.write_all(b"\n")?;
                }
            }
        }
    }
    out.flush()?;
    Ok(())
}
