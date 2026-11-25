use crate::archive::archive_variants;
use crate::config::{generate_random_upper_alnum, set_mode_600, RuntimeConfig};
use crate::db::{open_connection, table_exists, validate_report_table_name};
use crate::reports::get_snp_info_by_rsid;
use anyhow::{anyhow, Context, Result};
use chrono::{Local, Utc};
use rusqlite::{params, Connection};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::UNIX_EPOCH;

pub const IMPORTER_VERSION: &str = "4";

#[derive(Debug, Clone)]
pub enum FormulaValue {
    Bool(bool),
    Score(f64),
}

#[derive(Debug, Clone)]
pub enum FormulaError {
    InsufficientData(String),
    InvalidRule(String),
}

impl std::fmt::Display for FormulaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FormulaError::InsufficientData(s) | FormulaError::InvalidRule(s) => write!(f, "{s}"),
        }
    }
}

impl std::error::Error for FormulaError {}

fn genotype_order(c: char) -> Option<usize> {
    match c {
        '-' => Some(0),
        'A' => Some(1),
        'C' => Some(2),
        'G' => Some(3),
        'T' => Some(4),
        'D' => Some(5),
        'I' => Some(6),
        _ => None,
    }
}

pub fn normalize_genotype(genotype: &str) -> String {
    let value = genotype.trim().to_ascii_uppercase();
    let chars: Vec<char> = value.chars().collect();
    if chars.len() != 2 {
        return value;
    }
    let (Some(o0), Some(o1)) = (genotype_order(chars[0]), genotype_order(chars[1])) else {
        return value;
    };
    if o0 <= o1 {
        value
    } else {
        let mut out = String::with_capacity(2);
        out.push(chars[1]);
        out.push(chars[0]);
        out
    }
}

pub fn parse_formula(
    formula: &str,
    genotype_dict: &HashMap<String, String>,
) -> std::result::Result<FormulaValue, FormulaError> {
    if formula.starts_with("IF(") && formula.contains('{') {
        parse_combined_formula(formula, genotype_dict)
    } else if formula.starts_with("IF(") {
        Ok(FormulaValue::Bool(parse_if_formula(
            formula,
            genotype_dict,
        )?))
    } else if formula.starts_with("SCORE(") {
        Ok(FormulaValue::Score(parse_score_formula(
            formula,
            genotype_dict,
        )?))
    } else {
        Err(FormulaError::InvalidRule(
            "公式格式不正确，应以SCORE(或IF(开头".to_string(),
        ))
    }
}

fn parse_score_formula(
    formula: &str,
    genotype_dict: &HashMap<String, String>,
) -> std::result::Result<f64, FormulaError> {
    if !formula.starts_with("SCORE(") || !formula.ends_with(')') {
        return Err(FormulaError::InvalidRule(
            "SCORE公式格式不正确，应以SCORE(开头并以)结尾".to_string(),
        ));
    }
    let content = formula[6..formula.len() - 1].trim();
    let mut total_score = 0.0_f64;

    for raw_rule in content.split(';') {
        let rule = raw_rule.trim();
        if rule.is_empty() {
            continue;
        }
        let parts: Vec<&str> = rule.split(':').collect();
        if parts.len() != 2 {
            return Err(FormulaError::InvalidRule(format!(
                "SCORE规则格式不正确: {rule}"
            )));
        }
        let rsid = parts[0].trim();
        let score_rules = parts[1].trim();
        let Some(raw_gt) = genotype_dict.get(rsid) else {
            return Err(FormulaError::InsufficientData(format!(
                "缺少位点基因型: {rsid}"
            )));
        };
        let genotype = normalize_genotype(raw_gt);
        if genotype.is_empty() {
            return Err(FormulaError::InsufficientData(format!(
                "位点基因型为空: {rsid}"
            )));
        }
        let mut matched = false;
        for raw_pair in score_rules.split(',') {
            let pair = raw_pair.trim();
            if pair.is_empty() {
                continue;
            }
            let gt_score: Vec<&str> = pair.split('=').collect();
            if gt_score.len() != 2 {
                return Err(FormulaError::InvalidRule(format!(
                    "SCORE基因型规则格式不正确: {pair}"
                )));
            }
            let gt = normalize_genotype(gt_score[0].trim());
            let score: f64 = gt_score[1]
                .trim()
                .parse()
                .map_err(|_| FormulaError::InvalidRule(format!("SCORE分数不是数字: {pair}")))?;
            if gt == genotype {
                total_score += score;
                matched = true;
                break;
            }
        }
        if !matched {
            return Err(FormulaError::InsufficientData(format!(
                "位点基因型没有匹配规则: {rsid}={genotype}"
            )));
        }
    }
    Ok(total_score)
}

fn parse_if_formula(
    formula: &str,
    genotype_dict: &HashMap<String, String>,
) -> std::result::Result<bool, FormulaError> {
    if !formula.starts_with("IF(") || !formula.ends_with(')') {
        return Err(FormulaError::InvalidRule(
            "IF公式格式不正确，应以IF(开头并以)结尾".to_string(),
        ));
    }
    let content = formula[3..formula.len() - 1].trim();
    let mut has_rule = false;

    for raw_rule in content.split(';') {
        let rule = raw_rule.trim();
        if rule.is_empty() {
            continue;
        }
        has_rule = true;
        let parts: Vec<&str> = rule.split(':').collect();
        if parts.len() != 2 {
            return Err(FormulaError::InvalidRule(format!(
                "IF规则格式不正确: {rule}"
            )));
        }
        let rsid = parts[0].trim();
        let cond_rules = parts[1].trim();
        let Some(raw_gt) = genotype_dict.get(rsid) else {
            return Err(FormulaError::InsufficientData(format!(
                "缺少位点基因型: {rsid}"
            )));
        };
        let genotype = normalize_genotype(raw_gt);
        if genotype.is_empty() {
            return Err(FormulaError::InsufficientData(format!(
                "位点基因型为空: {rsid}"
            )));
        }
        let mut matched = false;
        let mut rule_result = false;
        for raw_pair in cond_rules.split(',') {
            let pair = raw_pair.trim();
            if pair.is_empty() {
                continue;
            }
            let gt_cond: Vec<&str> = pair.split('=').collect();
            if gt_cond.len() != 2 {
                return Err(FormulaError::InvalidRule(format!(
                    "IF基因型规则格式不正确: {pair}"
                )));
            }
            let gt = normalize_genotype(gt_cond[0].trim());
            let cond = match gt_cond[1].trim().to_ascii_lowercase().as_str() {
                "true" => true,
                "false" => false,
                _ => {
                    return Err(FormulaError::InvalidRule(format!(
                        "IF条件不是布尔值: {pair}"
                    )));
                }
            };
            if gt == genotype {
                matched = true;
                rule_result = cond;
                break;
            }
        }
        if !matched {
            return Err(FormulaError::InsufficientData(format!(
                "位点基因型没有匹配规则: {rsid}={genotype}"
            )));
        }
        if !rule_result {
            return Ok(false);
        }
    }

    if !has_rule {
        return Err(FormulaError::InvalidRule(
            "IF公式不包含有效规则".to_string(),
        ));
    }
    Ok(true)
}

fn find_matching_brace(text: &str, start_byte: usize) -> Option<usize> {
    let mut count = 1usize;
    for (offset, ch) in text[start_byte..].char_indices() {
        if ch == '{' {
            count += 1;
        } else if ch == '}' {
            count -= 1;
            if count == 0 {
                return Some(start_byte + offset);
            }
        }
    }
    None
}

fn parse_combined_formula(
    formula: &str,
    genotype_dict: &HashMap<String, String>,
) -> std::result::Result<FormulaValue, FormulaError> {
    let if_end = formula
        .find('{')
        .ok_or_else(|| FormulaError::InvalidRule("组合公式格式不正确，缺少{".to_string()))?;
    let if_condition = &formula[..if_end];
    let true_start = if_end + 1;
    let true_end = find_matching_brace(formula, true_start)
        .ok_or_else(|| FormulaError::InvalidRule("组合公式格式不正确，缺少匹配的}".to_string()))?;
    let true_formula = &formula[true_start..true_end];

    let mut else_formula: Option<&str> = None;
    let rest = &formula[true_end + 1..];
    if rest.trim_start().starts_with("ELSE{") {
        let rel_brace = rest.find('{').unwrap();
        let else_start = true_end + 1 + rel_brace + 1;
        let else_end = find_matching_brace(formula, else_start).ok_or_else(|| {
            FormulaError::InvalidRule("组合公式格式不正确，ELSE部分缺少匹配的}".to_string())
        })?;
        else_formula = Some(&formula[else_start..else_end]);
    }

    if parse_if_formula(if_condition, genotype_dict)? {
        parse_formula(true_formula, genotype_dict)
    } else if let Some(ef) = else_formula {
        parse_formula(ef, genotype_dict)
    } else {
        Ok(FormulaValue::Score(0.0))
    }
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(64);
    for b in digest {
        use std::fmt::Write;
        let _ = write!(&mut out, "{:02x}", b);
    }
    out
}

fn canonical_json_bytes(value: &Value) -> Vec<u8> {
    fn sort_value(v: &Value) -> Value {
        match v {
            Value::Object(map) => {
                let mut sorted: BTreeMap<&String, Value> = BTreeMap::new();
                for (k, val) in map {
                    sorted.insert(k, sort_value(val));
                }
                let mut out = Map::new();
                for (k, val) in sorted {
                    out.insert(k.clone(), val);
                }
                Value::Object(out)
            }
            Value::Array(arr) => Value::Array(arr.iter().map(sort_value).collect()),
            other => other.clone(),
        }
    }
    let sorted = sort_value(value);
    serde_json::to_vec(&sorted).unwrap_or_default()
}

pub fn get_trait_catalog_metadata(cfg: &RuntimeConfig) -> Result<Value> {
    let normalized_raw = fs::read(&cfg.normalized_trait_catalog_path).with_context(|| {
        format!(
            "failed to read {}",
            cfg.normalized_trait_catalog_path.display()
        )
    })?;
    let document: Value = serde_json::from_slice(&normalized_raw)?;
    let traits = document
        .get("traits")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let loci = document
        .get("locusRegistry")
        .and_then(|v| v.get("loci"))
        .and_then(Value::as_object);

    let mut statuses: BTreeMap<String, usize> = BTreeMap::new();
    for t in &traits {
        let status = t
            .get("evidenceRecord")
            .and_then(|r| r.get("status"))
            .and_then(Value::as_str)
            .unwrap_or("missing")
            .to_string();
        *statuses.entry(status).or_insert(0) += 1;
    }

    let normalized_hash = sha256_hex(&normalized_raw);
    let catalog_hash = sha256_hex(&fs::read(&cfg.default_traits_path)?);
    let evidence_hash = sha256_hex(&fs::read(&cfg.trait_evidence_path)?);
    let locus_hash = sha256_hex(&fs::read(&cfg.trait_locus_path)?);
    let version = document
        .get("catalogVersion")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| normalized_hash[..16].to_string());

    let locus_count = loci.map(|m| m.len()).unwrap_or(0);
    let verified_locus_count = loci
        .map(|m| {
            m.values()
                .filter(|item| item.get("status").and_then(Value::as_str) == Some("verified"))
                .count()
        })
        .unwrap_or(0);

    Ok(json!({
        "count": traits.len(),
        "version": version,
        "normalized_hash": normalized_hash,
        "catalog_hash": catalog_hash,
        "evidence_hash": evidence_hash,
        "locus_hash": locus_hash,
        "locus_count": locus_count,
        "verified_locus_count": verified_locus_count,
        "statuses": statuses,
    }))
}

pub fn persist_trait_catalog_metadata(metadata: &Value, target: &Path) -> Result<PathBuf> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp_name = format!(
        "{}.tmp",
        target
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("trait-catalog.json")
    );
    let tmp = target.with_file_name(tmp_name);
    let mut text = String::from_utf8(canonical_json_bytes(metadata))?;
    text.push('\n');
    fs::write(&tmp, text)?;
    set_mode_600(&tmp)?;
    fs::rename(&tmp, target)?;
    Ok(target.to_path_buf())
}

pub fn persisted_trait_catalog_matches(cfg: &RuntimeConfig, metadata: &Value) -> bool {
    let Ok(raw) = fs::read(&cfg.trait_catalog_state_path) else {
        return false;
    };
    let Ok(persisted): Result<Value, _> = serde_json::from_slice(&raw) else {
        return false;
    };
    [
        "version",
        "normalized_hash",
        "catalog_hash",
        "evidence_hash",
        "locus_hash",
    ]
    .iter()
    .all(|k| persisted.get(*k) == metadata.get(*k))
}

pub fn validate_production_catalog(cfg: &RuntimeConfig, expected_count: usize) -> Vec<String> {
    let mut errors = Vec::new();
    let Ok(default_raw) = fs::read(&cfg.default_traits_path) else {
        return vec!["failed to read default-traits.json".to_string()];
    };
    let Ok(evidence_raw) = fs::read(&cfg.trait_evidence_path) else {
        return vec!["failed to read trait-evidence.json".to_string()];
    };
    let Ok(locus_raw) = fs::read(&cfg.trait_locus_path) else {
        return vec!["failed to read trait-locus-registry.json".to_string()];
    };
    let Ok(norm_raw) = fs::read(&cfg.normalized_trait_catalog_path) else {
        return vec!["failed to read trait-catalog.json".to_string()];
    };

    let Ok(traits): Result<Vec<Value>, _> = serde_json::from_slice(&default_raw) else {
        return vec!["invalid default-traits.json".to_string()];
    };
    let Ok(evidence_doc): Result<Value, _> = serde_json::from_slice(&evidence_raw) else {
        return vec!["invalid trait-evidence.json".to_string()];
    };
    let Ok(locus_doc): Result<Value, _> = serde_json::from_slice(&locus_raw) else {
        return vec!["invalid trait-locus-registry.json".to_string()];
    };
    let Ok(norm_doc): Result<Value, _> = serde_json::from_slice(&norm_raw) else {
        return vec!["invalid trait-catalog.json".to_string()];
    };

    if traits.len() != expected_count {
        errors.push(format!(
            "production count {} != {}",
            traits.len(),
            expected_count
        ));
    }

    let loci = locus_doc
        .get("loci")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let rules = evidence_doc
        .get("rules")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();

    // Check normalized catalog count parity
    let norm_traits_len = norm_doc
        .get("traits")
        .and_then(Value::as_array)
        .map(|a| a.len())
        .unwrap_or(0);
    if norm_traits_len != traits.len() {
        errors.push(
            "normalized trait catalog and compatibility artifacts are out of sync".to_string(),
        );
    }

    let mut declared_rsids: HashSet<String> = HashSet::new();
    let mut ids: Vec<String> = Vec::new();
    for t in &traits {
        if let Some(id) = t.get("id").and_then(Value::as_str) {
            ids.push(id.to_string());
        }
        if let Some(rsids) = t.get("rsids").and_then(Value::as_array) {
            for r in rsids {
                if let Some(s) = r.as_str() {
                    declared_rsids.insert(s.to_string());
                }
            }
        }
    }
    if declared_rsids.len() != 154 {
        errors.push(format!(
            "production locus count {} != 154",
            declared_rsids.len()
        ));
    }
    let locus_keys: HashSet<String> = loci.keys().cloned().collect();
    if locus_keys != declared_rsids {
        errors.push("trait locus registry does not exactly match production RSIDs".to_string());
    }

    for (rsid, locus) in &loci {
        if locus.get("status").and_then(Value::as_str) != Some("verified") {
            errors.push(format!("{rsid}: locus registry status is not verified"));
        }
        if locus.get("sourceAgreement").and_then(Value::as_bool) != Some(true) {
            errors.push(format!(
                "{rsid}: NCBI and Ensembl GRCh38 placements disagree"
            ));
        }
        for asm in ["grch37", "grch38"] {
            let placement = locus.get(asm);
            let ok = placement
                .and_then(|p| p.get("chromosome"))
                .and_then(Value::as_str)
                .map(|s| !s.is_empty())
                .unwrap_or(false)
                && placement
                    .and_then(|p| p.get("position"))
                    .and_then(Value::as_i64)
                    .map(|p| p > 0)
                    .unwrap_or(false);
            if !ok {
                errors.push(format!("{rsid}: missing {asm} chromosome placement"));
            }
        }
        let transform = locus.get("inputTransform").and_then(Value::as_str);
        if !matches!(transform, Some("identity" | "complement")) {
            errors.push(format!("{rsid}: unresolved literature allele orientation"));
        }
    }

    let id_set: HashSet<&String> = ids.iter().collect();
    if id_set.len() != ids.len() {
        errors.push("production catalog contains duplicate ids".to_string());
    }
    let rule_keys: HashSet<&String> = rules.keys().collect();
    if rule_keys != id_set {
        errors.push("production evidence ids do not match default traits".to_string());
    }

    for t in &traits {
        let tid = t.get("id").and_then(Value::as_str).unwrap_or("");
        let Some(rule) = rules.get(tid) else {
            continue;
        };
        if rule.get("status").and_then(Value::as_str) != Some("curated") {
            errors.push(format!("{tid}: production rule is not curated"));
        }
        if !matches!(
            rule.get("evidence_grade").and_then(Value::as_str),
            Some("A" | "B")
        ) {
            errors.push(format!("{tid}: unsupported production evidence grade"));
        }
        if rule
            .get("review_blockers")
            .and_then(Value::as_array)
            .map(|a| !a.is_empty())
            .unwrap_or(false)
        {
            errors.push(format!("{tid}: curated rule still has review blockers"));
        }
        if rule
            .get("evidence")
            .and_then(Value::as_array)
            .map(|a| a.is_empty())
            .unwrap_or(true)
        {
            errors.push(format!("{tid}: curated rule needs evidence"));
        }
    }

    errors.sort();
    errors.dedup();
    errors
}

#[derive(Clone)]
pub struct CompiledCatalog {
    pub version: String,
    pub traits: Vec<Value>,
    pub by_id: HashMap<String, usize>,
    pub evidence: HashMap<String, Value>,
    pub loci: Map<String, Value>,
    pub all_rsids: Vec<String>,
}

static BASE_CATALOG_CACHE: OnceLock<Mutex<HashMap<PathBuf, Arc<CompiledCatalog>>>> =
    OnceLock::new();

pub fn load_compiled_catalog(cfg: &RuntimeConfig) -> Result<Arc<CompiledCatalog>> {
    let cache = BASE_CATALOG_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let key = cfg.normalized_trait_catalog_path.clone();
    {
        let guard = cache.lock().unwrap();
        if let Some(existing) = guard.get(&key) {
            return Ok(existing.clone());
        }
    }

    let raw = fs::read(&cfg.normalized_trait_catalog_path).unwrap_or_else(|_| b"{}".to_vec());
    let doc: Value = serde_json::from_slice(&raw).unwrap_or_else(|_| json!({}));
    let entries = doc
        .get("traits")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut traits = Vec::with_capacity(entries.len());
    let mut by_id = HashMap::with_capacity(entries.len());
    let mut evidence = HashMap::with_capacity(entries.len());
    let mut rsid_set = BTreeSet::new();

    for entry in entries {
        if let Some(obj) = entry.as_object() {
            let id = obj
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let ev = obj
                .get("evidenceRecord")
                .cloned()
                .unwrap_or_else(|| json!({}));
            evidence.insert(id.clone(), ev);

            let mut stripped = Map::new();
            for (k, v) in obj {
                if k != "evidenceRecord" {
                    stripped.insert(k.clone(), v.clone());
                }
            }
            if let Some(rsids) = stripped.get("rsids").and_then(Value::as_array) {
                for r in rsids {
                    if let Some(s) = r.as_str() {
                        rsid_set.insert(s.to_string());
                    }
                }
            }
            by_id.insert(id, traits.len());
            traits.push(Value::Object(stripped));
        }
    }

    let loci = doc
        .get("locusRegistry")
        .and_then(|v| v.get("loci"))
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let version = doc
        .get("catalogVersion")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| sha256_hex(&raw)[..16].to_string());

    let compiled = Arc::new(CompiledCatalog {
        version,
        traits,
        by_id,
        evidence,
        loci,
        all_rsids: rsid_set.into_iter().collect(),
    });
    cache.lock().unwrap().insert(key, compiled.clone());
    Ok(compiled)
}

fn load_custom_traits(db_path: &Path) -> Result<Vec<Value>> {
    let conn = open_connection(db_path)?;
    if !table_exists(&conn, "traits")? {
        return Ok(Vec::new());
    }
    let mut stmt = conn.prepare(
        "SELECT id, name, description, icon, confidence, isDefault, createdAt, category, rsids, formula, scoreThresholds, result, reference
         FROM traits WHERE isDefault = 0 ORDER BY id",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1).unwrap_or_default(),
            row.get::<_, String>(2).unwrap_or_default(),
            row.get::<_, String>(3).unwrap_or_default(),
            row.get::<_, String>(4).unwrap_or_default(),
            row.get::<_, String>(6).unwrap_or_default(),
            row.get::<_, String>(7).unwrap_or_default(),
            row.get::<_, String>(8).unwrap_or_default(),
            row.get::<_, String>(9).unwrap_or_default(),
            row.get::<_, String>(10).unwrap_or_default(),
            row.get::<_, String>(11).unwrap_or_default(),
            row.get::<_, String>(12).unwrap_or_default(),
        ))
    })?;

    let mut custom = Vec::new();
    for r in rows {
        let (
            id,
            name_s,
            desc_s,
            icon,
            confidence,
            created_at,
            category,
            rsids_s,
            formula,
            thresh_s,
            result_s,
            ref_s,
        ) = r?;
        let Ok(name): Result<Value, _> = serde_json::from_str(&name_s) else {
            continue;
        };
        let Ok(description): Result<Value, _> = serde_json::from_str(&desc_s) else {
            continue;
        };
        let Ok(score_thresholds): Result<Value, _> = serde_json::from_str(&thresh_s) else {
            continue;
        };
        let Ok(result): Result<Value, _> = serde_json::from_str(&result_s) else {
            continue;
        };
        let rsids: Vec<String> = if rsids_s.is_empty() {
            Vec::new()
        } else {
            rsids_s.split(';').map(String::from).collect()
        };
        let reference: Vec<String> = if ref_s.is_empty() {
            Vec::new()
        } else {
            ref_s.split(';').map(String::from).collect()
        };
        custom.push(json!({
            "id": id,
            "name": name,
            "description": description,
            "icon": icon,
            "confidence": confidence,
            "isDefault": false,
            "createdAt": created_at,
            "category": category,
            "rsids": rsids,
            "formula": formula,
            "scoreThresholds": score_thresholds,
            "result": result,
            "reference": reference,
            "sourceLabel": "Custom",
        }));
    }
    Ok(custom)
}

pub fn custom_revision(db_path: &Path) -> i64 {
    let Ok(conn) = open_connection(db_path) else {
        return 0;
    };
    conn.query_row(
        "SELECT revision FROM trait_catalog_revision WHERE singleton = 1",
        [],
        |r| r.get::<_, i64>(0),
    )
    .unwrap_or(0)
}

pub fn catalog_for_db(cfg: &RuntimeConfig, db_path: &Path) -> Result<CompiledCatalog> {
    let base = load_compiled_catalog(cfg)?;
    let custom = load_custom_traits(db_path)?;

    let custom_bytes = canonical_json_bytes(&Value::Array(custom.clone()));
    let custom_hash = &sha256_hex(&custom_bytes)[..16];
    let combined_version = &sha256_hex(format!("{}:{custom_hash}", base.version).as_bytes())[..16];

    let mut traits = base.traits.clone();
    traits.extend(custom);
    let mut by_id = HashMap::with_capacity(traits.len());
    let mut rsid_set = BTreeSet::new();
    for (idx, t) in traits.iter().enumerate() {
        if let Some(id) = t.get("id").and_then(Value::as_str) {
            by_id.insert(id.to_string(), idx);
        }
        if let Some(arr) = t.get("rsids").and_then(Value::as_array) {
            for r in arr {
                if let Some(s) = r.as_str() {
                    rsid_set.insert(s.to_string());
                }
            }
        }
    }

    Ok(CompiledCatalog {
        version: combined_version.to_string(),
        traits,
        by_id,
        evidence: base.evidence.clone(),
        loci: base.loci.clone(),
        all_rsids: rsid_set.into_iter().collect(),
    })
}

fn locus_view(
    rsid: &str,
    evidence_rule: &Value,
    loci: &Map<String, Value>,
    include_sources: bool,
) -> Value {
    let empty_obj = json!({});
    let evidence_variant = evidence_rule
        .get("variants")
        .and_then(Value::as_array)
        .and_then(|arr| {
            arr.iter()
                .find(|item| item.get("rsid").and_then(Value::as_str) == Some(rsid))
        })
        .unwrap_or(&empty_obj);
    let registered = loci.get(rsid).unwrap_or(&empty_obj);
    let grch38 = registered.get("grch38").unwrap_or(&empty_obj);
    let grch37 = registered.get("grch37").unwrap_or(&empty_obj);

    let mut assemblies = Map::new();
    assemblies.insert(
        "GRCh38".to_string(),
        json!({
            "chromosome": grch38.get("chromosome").cloned().unwrap_or(Value::Null),
            "position": grch38.get("position").cloned().unwrap_or(Value::Null),
        }),
    );
    if include_sources {
        assemblies.insert(
            "GRCh37".to_string(),
            json!({
                "chromosome": grch37.get("chromosome").cloned().unwrap_or(Value::Null),
                "position": grch37.get("position").cloned().unwrap_or(Value::Null),
            }),
        );
    }

    let gene = registered
        .get("gene")
        .filter(|v| !v.is_null() && v.as_str() != Some(""))
        .or_else(|| evidence_variant.get("gene"))
        .cloned()
        .unwrap_or(Value::Null);
    let effect_allele = registered
        .get("forwardEffectAllele")
        .filter(|v| !v.is_null() && v.as_str() != Some(""))
        .or_else(|| evidence_variant.get("effect_allele"))
        .cloned()
        .unwrap_or(Value::Null);
    let effect_direction = registered
        .get("effectDirection")
        .filter(|v| !v.is_null() && v.as_str() != Some(""))
        .or_else(|| evidence_variant.get("direction"))
        .cloned()
        .unwrap_or(Value::Null);

    let mut out = Map::new();
    out.insert("rsid".to_string(), Value::String(rsid.to_string()));
    out.insert("gene".to_string(), gene);
    out.insert("assembly".to_string(), Value::Object(assemblies));
    out.insert(
        "referenceAllele".to_string(),
        grch38.get("reference").cloned().unwrap_or(Value::Null),
    );
    out.insert(
        "alternateAlleles".to_string(),
        grch38
            .get("alternates")
            .cloned()
            .unwrap_or_else(|| json!([])),
    );
    out.insert("effectAllele".to_string(), effect_allele);
    out.insert("effectDirection".to_string(), effect_direction);

    if include_sources {
        out.insert(
            "inputTransform".to_string(),
            registered
                .get("inputTransform")
                .cloned()
                .unwrap_or(Value::Null),
        );
        out.insert(
            "verificationStatus".to_string(),
            registered
                .get("status")
                .cloned()
                .unwrap_or_else(|| Value::String("registry_missing".to_string())),
        );
        out.insert(
            "traitAlleles".to_string(),
            registered
                .get("traitAlleles")
                .cloned()
                .unwrap_or_else(|| json!([])),
        );
        out.insert(
            "sources".to_string(),
            registered
                .get("sources")
                .cloned()
                .unwrap_or_else(|| json!({})),
        );
        out.insert(
            "reviewedAt".to_string(),
            registered.get("reviewedAt").cloned().unwrap_or(Value::Null),
        );
    }
    Value::Object(out)
}

fn filter_truthy_str_map(val: Option<&Value>) -> Map<String, Value> {
    let mut out = Map::new();
    if let Some(obj) = val.and_then(Value::as_object) {
        for (k, v) in obj {
            let keep = match v {
                Value::Null => false,
                Value::String(s) => !s.is_empty(),
                _ => true,
            };
            if keep {
                out.insert(k.clone(), v.clone());
            }
        }
    }
    out
}

fn trait_summary(trait_val: &Value, compiled: &CompiledCatalog) -> Map<String, Value> {
    let empty_obj = json!({});
    let id = trait_val.get("id").and_then(Value::as_str).unwrap_or("");
    let evidence_rule = compiled.evidence.get(id).unwrap_or(&empty_obj);

    let mut out = Map::new();
    out.insert("id".to_string(), Value::String(id.to_string()));
    out.insert(
        "name".to_string(),
        Value::Object(filter_truthy_str_map(trait_val.get("name"))),
    );
    out.insert(
        "description".to_string(),
        Value::Object(filter_truthy_str_map(trait_val.get("description"))),
    );
    let icon = trait_val
        .get("icon")
        .and_then(Value::as_str)
        .unwrap_or("Dna");
    if icon != "Dna" {
        out.insert("icon".to_string(), Value::String(icon.to_string()));
    }
    let confidence = trait_val
        .get("confidence")
        .and_then(Value::as_str)
        .unwrap_or("low");
    if confidence != "low" {
        out.insert(
            "confidence".to_string(),
            Value::String(confidence.to_string()),
        );
    }
    if trait_val.get("isDefault").and_then(Value::as_bool) == Some(false) {
        out.insert("isDefault".to_string(), Value::Bool(false));
    }
    out.insert(
        "category".to_string(),
        Value::String(
            trait_val
                .get("category")
                .and_then(Value::as_str)
                .unwrap_or("internal")
                .to_string(),
        ),
    );
    if let Some(grade) = evidence_rule
        .get("evidence_grade")
        .filter(|v| !v.is_null() && v.as_str() != Some(""))
        .or_else(|| {
            trait_val
                .get("evidenceGrade")
                .filter(|v| !v.is_null() && v.as_str() != Some(""))
        })
    {
        out.insert("evidenceGrade".to_string(), grade.clone());
    }
    if let Some(label) = trait_val.get("sourceLabel").filter(|v| !v.is_null()) {
        out.insert("sourceLabel".to_string(), label.clone());
    }
    let loci_list: Vec<Value> = trait_val
        .get("rsids")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .map(|rsid| locus_view(rsid, evidence_rule, &compiled.loci, false))
                .collect()
        })
        .unwrap_or_default();
    out.insert("loci".to_string(), Value::Array(loci_list));
    out
}

pub fn get_catalog_payload(cfg: &RuntimeConfig, db_path: &Path) -> Result<Value> {
    let compiled = catalog_for_db(cfg, db_path)?;
    let traits: Vec<Value> = compiled
        .traits
        .iter()
        .map(|t| Value::Object(trait_summary(t, &compiled)))
        .collect();
    Ok(json!({
        "version": compiled.version,
        "count": traits.len(),
        "traits": traits,
    }))
}

fn evaluate_trait(
    trait_val: &Value,
    genotypes: &HashMap<String, Option<String>>,
    loci: &Map<String, Value>,
) -> Value {
    let id = trait_val
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let required: Vec<String> = trait_val
        .get("rsids")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default();

    let mut present_map: Map<String, Value> = Map::new();
    let mut present_str: HashMap<String, String> = HashMap::new();
    let mut missing: Vec<String> = Vec::new();
    for rsid in &required {
        if let Some(Some(gt)) = genotypes.get(rsid) {
            if !gt.is_empty() {
                present_map.insert(rsid.clone(), Value::String(gt.clone()));
                present_str.insert(rsid.clone(), gt.clone());
                continue;
            }
        }
        missing.push(rsid.clone());
    }

    if !missing.is_empty() {
        return json!({
            "traitId": id,
            "genotypes": present_map,
            "status": "insufficient_data",
            "missingRsids": missing,
            "detectedCount": present_str.len(),
            "requiredCount": required.len(),
        });
    }

    for (rsid, gt) in &present_str {
        if let Some(allowed) = loci
            .get(rsid)
            .and_then(|l| l.get("traitAlleles"))
            .and_then(Value::as_array)
        {
            if !allowed.is_empty() {
                let allowed_chars: HashSet<char> = allowed
                    .iter()
                    .filter_map(Value::as_str)
                    .flat_map(|s| s.chars())
                    .collect();
                let upper = gt.to_ascii_uppercase();
                if upper.len() != 2 || !upper.chars().all(|c| allowed_chars.contains(&c)) {
                    return json!({
                        "traitId": id,
                        "genotypes": present_map,
                        "status": "invalid_orientation",
                    });
                }
            }
        }
    }

    let formula = trait_val
        .get("formula")
        .and_then(Value::as_str)
        .unwrap_or("");
    let value = match parse_formula(formula, &present_str) {
        Ok(v) => v,
        Err(FormulaError::InsufficientData(_)) => {
            return json!({
                "traitId": id,
                "genotypes": present_map,
                "status": "insufficient_data",
            });
        }
        Err(FormulaError::InvalidRule(_)) => {
            return json!({
                "traitId": id,
                "genotypes": present_map,
                "status": "invalid_rule",
            });
        }
    };

    let mut thresholds: Vec<(String, Value)> = trait_val
        .get("scoreThresholds")
        .and_then(Value::as_object)
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();

    // Stable sort descending by numeric threshold (non-numbers/bools sort as 0.0)
    thresholds.sort_by(|a, b| {
        let va = if a.1.is_boolean() {
            0.0
        } else {
            a.1.as_f64().unwrap_or(0.0)
        };
        let vb = if b.1.is_boolean() {
            0.0
        } else {
            b.1.as_f64().unwrap_or(0.0)
        };
        vb.partial_cmp(&va).unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut result_key: Option<String> = None;
    for (k, threshold) in &thresholds {
        match &value {
            FormulaValue::Bool(b) => {
                if threshold.as_bool() == Some(*b) {
                    result_key = Some(k.clone());
                    break;
                }
            }
            FormulaValue::Score(s) => {
                if !threshold.is_boolean() {
                    if let Some(t) = threshold.as_f64() {
                        if *s >= t {
                            result_key = Some(k.clone());
                            break;
                        }
                    }
                }
            }
        }
    }

    let result_current = match &result_key {
        Some(rk) => {
            let raw_res = trait_val
                .get("result")
                .and_then(|r| r.get(rk))
                .cloned()
                .unwrap_or(Value::Null);
            if let Some(obj) = raw_res.as_object() {
                let en = obj.get("en");
                let zh = obj.get("zh-CN");
                let mut filtered = Map::new();
                for (k, v) in obj {
                    let truthy = match v {
                        Value::Null => false,
                        Value::String(s) => !s.is_empty(),
                        _ => true,
                    };
                    if !truthy {
                        continue;
                    }
                    if k == "default" && (Some(v) == en || Some(v) == zh) {
                        continue;
                    }
                    filtered.insert(k.clone(), v.clone());
                }
                Value::Object(filtered)
            } else {
                raw_res
            }
        }
        None => Value::Null,
    };

    json!({
        "traitId": id,
        "genotypes": present_map,
        "status": if result_key.is_some() { "ok" } else { "invalid_rule" },
        "resultKey": result_key,
        "resultCurrent": result_current,
    })
}

pub fn report_revision_key(db_path: &Path, report_id: &str) -> Result<String> {
    let report_id = validate_report_table_name(report_id)?;
    let conn = open_connection(db_path)?;
    let report_part: Option<(Option<i64>, Option<String>)> = conn
        .query_row(
            "SELECT total_snps, upload_date FROM reports WHERE report_id=?",
            [report_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .ok();
    let migration_part: Option<(String, String, i64, String)> = conn
        .query_row(
            "SELECT importer_version, registry_hash, added_count, updated_at
             FROM report_trait_import_state WHERE report_id=?",
            [report_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .ok();
    Ok(format!("{report_part:?}|{migration_part:?}"))
}

pub fn get_report_results(cfg: &RuntimeConfig, report_id: &str, db_path: &Path) -> Result<Value> {
    let report_id = validate_report_table_name(report_id)?;
    let compiled = catalog_for_db(cfg, db_path)?;
    let snp_rows = get_snp_info_by_rsid(&compiled.all_rsids, report_id, db_path)?;
    let mut genotypes: HashMap<String, Option<String>> = HashMap::with_capacity(snp_rows.len());
    for (rsid, val) in snp_rows {
        let gt = val
            .get("genotype")
            .and_then(Value::as_str)
            .map(String::from);
        genotypes.insert(rsid, gt);
    }
    let evaluations: Vec<Value> = compiled
        .traits
        .iter()
        .map(|t| evaluate_trait(t, &genotypes, &compiled.loci))
        .collect();
    Ok(json!({
        "catalogVersion": compiled.version,
        "reportId": report_id,
        "count": evaluations.len(),
        "results": evaluations,
    }))
}

pub fn get_trait_highlights(
    cfg: &RuntimeConfig,
    report_id: &str,
    db_path: &Path,
) -> Result<Vec<Value>> {
    let compiled = catalog_for_db(cfg, db_path)?;
    let results = get_report_results(cfg, report_id, db_path)?;
    let mut highlights = Vec::new();
    let mut seen_categories = HashSet::new();
    if let Some(arr) = results.get("results").and_then(Value::as_array) {
        for eval in arr {
            if eval.get("status").and_then(Value::as_str) != Some("ok") {
                continue;
            }
            let tid = eval.get("traitId").and_then(Value::as_str).unwrap_or("");
            let Some(&idx) = compiled.by_id.get(tid) else {
                continue;
            };
            let trait_val = &compiled.traits[idx];
            let category = trait_val
                .get("category")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            if seen_categories.contains(&category) {
                continue;
            }
            seen_categories.insert(category);
            highlights.push(json!({
                "id": trait_val.get("id").cloned().unwrap_or(Value::Null),
                "icon": trait_val.get("icon").cloned().unwrap_or(Value::Null),
                "name": trait_val.get("name").cloned().unwrap_or(Value::Null),
                "description": trait_val.get("description").cloned().unwrap_or(Value::Null),
                "confidence": trait_val.get("confidence").cloned().unwrap_or(Value::Null),
                "result_current": eval.get("resultCurrent").cloned().unwrap_or(Value::Null),
            }));
            if highlights.len() == 4 {
                break;
            }
        }
    }
    Ok(highlights)
}

pub fn get_trait_detail(
    cfg: &RuntimeConfig,
    trait_id: &str,
    report_id: &str,
    db_path: &Path,
) -> Result<Option<Value>> {
    let compiled = catalog_for_db(cfg, db_path)?;
    let Some(&idx) = compiled.by_id.get(trait_id) else {
        return Ok(None);
    };
    let trait_val = &compiled.traits[idx];
    let rsids: Vec<String> = trait_val
        .get("rsids")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default();
    let snp_rows = get_snp_info_by_rsid(&rsids, report_id, db_path)?;
    let mut genotypes = HashMap::new();
    for (rsid, val) in snp_rows {
        genotypes.insert(
            rsid,
            val.get("genotype")
                .and_then(Value::as_str)
                .map(String::from),
        );
    }
    let evaluation = evaluate_trait(trait_val, &genotypes, &compiled.loci);
    let empty_obj = json!({});
    let evidence_rule = compiled.evidence.get(trait_id).unwrap_or(&empty_obj);

    let mut out = trait_summary(trait_val, &compiled);
    let detailed_loci: Vec<Value> = rsids
        .iter()
        .map(|r| locus_view(r, evidence_rule, &compiled.loci, true))
        .collect();
    out.insert("loci".to_string(), Value::Array(detailed_loci));
    out.insert(
        "catalogVersion".to_string(),
        Value::String(compiled.version.clone()),
    );
    out.insert(
        "createdAt".to_string(),
        trait_val.get("createdAt").cloned().unwrap_or(Value::Null),
    );
    out.insert(
        "formula".to_string(),
        trait_val.get("formula").cloned().unwrap_or(Value::Null),
    );
    out.insert(
        "scoreThresholds".to_string(),
        trait_val
            .get("scoreThresholds")
            .cloned()
            .unwrap_or_else(|| json!({})),
    );
    out.insert(
        "result".to_string(),
        trait_val
            .get("result")
            .cloned()
            .unwrap_or_else(|| json!({})),
    );
    let pop_scope = evidence_rule
        .get("population_scope_i18n")
        .filter(|v| !v.is_null())
        .cloned()
        .unwrap_or_else(|| {
            json!({
                "en": evidence_rule.get("population_scope").and_then(Value::as_str).unwrap_or(""),
                "zh-CN": "",
                "default": "",
            })
        });
    let limitations = evidence_rule
        .get("limitations_i18n")
        .filter(|v| !v.is_null())
        .cloned()
        .unwrap_or_else(|| {
            json!({
                "en": evidence_rule.get("limitations").cloned().unwrap_or_else(|| json!([])),
                "zh-CN": [],
                "default": [],
            })
        });
    out.insert("populationScope".to_string(), pop_scope);
    out.insert("limitations".to_string(), limitations);
    out.insert(
        "evidenceSummary".to_string(),
        evidence_rule
            .get("evidence_summary_i18n")
            .cloned()
            .unwrap_or(Value::Null),
    );
    out.insert(
        "evidence".to_string(),
        evidence_rule
            .get("evidence")
            .cloned()
            .unwrap_or_else(|| json!([])),
    );
    out.insert(
        "medicalDisclaimer".to_string(),
        evidence_rule
            .get("medical_disclaimer")
            .cloned()
            .unwrap_or(Value::Null),
    );
    out.insert("evaluation".to_string(), evaluation);
    Ok(Some(Value::Object(out)))
}

pub fn get_legacy_traits_payload(
    cfg: &RuntimeConfig,
    report_id: &str,
    db_path: &Path,
) -> Result<Vec<Value>> {
    let compiled = catalog_for_db(cfg, db_path)?;
    let results = get_report_results(cfg, report_id, db_path)?;
    let mut by_id: HashMap<String, Value> = HashMap::new();
    if let Some(arr) = results.get("results").and_then(Value::as_array) {
        for item in arr {
            if let Some(tid) = item.get("traitId").and_then(Value::as_str) {
                by_id.insert(tid.to_string(), item.clone());
            }
        }
    }

    let mut payload = Vec::with_capacity(compiled.traits.len());
    for source in &compiled.traits {
        let mut trait_map = source.as_object().cloned().unwrap_or_default();
        let tid = trait_map
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let eval = by_id.get(&tid);
        let rsids: Vec<String> = trait_map
            .get("rsids")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(Value::as_str)
                    .map(String::from)
                    .collect()
            })
            .unwrap_or_default();

        let ref_gts: Vec<Value> = rsids
            .iter()
            .map(|r| {
                let ref_a = compiled
                    .loci
                    .get(r)
                    .and_then(|l| l.get("grch38"))
                    .and_then(|g| g.get("reference"))
                    .and_then(Value::as_str)
                    .unwrap_or("");
                if ref_a.is_empty() {
                    Value::Null
                } else {
                    Value::String(format!("{ref_a}{ref_a}"))
                }
            })
            .collect();
        let your_gts: Vec<Value> = rsids
            .iter()
            .map(|r| {
                eval.and_then(|e| e.get("genotypes"))
                    .and_then(|g| g.get(r))
                    .cloned()
                    .unwrap_or(Value::Null)
            })
            .collect();

        trait_map.insert("referenceGenotypes".to_string(), Value::Array(ref_gts));
        trait_map.insert("yourGenotypes".to_string(), Value::Array(your_gts));
        trait_map.insert(
            "result_current".to_string(),
            eval.and_then(|e| e.get("resultCurrent"))
                .cloned()
                .unwrap_or(Value::Null),
        );
        trait_map.insert(
            "evaluationStatus".to_string(),
            eval.and_then(|e| e.get("status"))
                .cloned()
                .unwrap_or_else(|| Value::String("insufficient_data".to_string())),
        );

        if let Some(ev) = compiled.evidence.get(&tid) {
            if let Some(obj) = ev.as_object() {
                if !obj.is_empty() {
                    trait_map.insert(
                        "evidenceStatus".to_string(),
                        ev.get("status").cloned().unwrap_or(Value::Null),
                    );
                    trait_map.insert(
                        "evidenceGrade".to_string(),
                        ev.get("evidence_grade").cloned().unwrap_or(Value::Null),
                    );
                    trait_map.insert(
                        "evidence".to_string(),
                        ev.get("evidence").cloned().unwrap_or_else(|| json!([])),
                    );
                    trait_map.insert(
                        "populationScope".to_string(),
                        ev.get("population_scope").cloned().unwrap_or(Value::Null),
                    );
                    trait_map.insert(
                        "limitations".to_string(),
                        ev.get("limitations").cloned().unwrap_or_else(|| json!([])),
                    );
                    trait_map.insert(
                        "reviewBlockers".to_string(),
                        ev.get("review_blockers")
                            .cloned()
                            .unwrap_or_else(|| json!([])),
                    );
                    trait_map.insert(
                        "medicalDisclaimer".to_string(),
                        ev.get("medical_disclaimer").cloned().unwrap_or(Value::Null),
                    );
                }
            }
        }
        payload.push(Value::Object(trait_map));
    }
    Ok(payload)
}

fn ensure_trait_catalog_revision(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS trait_catalog_revision (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            revision INTEGER NOT NULL
        );
        INSERT INTO trait_catalog_revision (singleton, revision)
        VALUES (1, 0)
        ON CONFLICT(singleton) DO NOTHING;",
    )?;
    Ok(())
}

fn bump_trait_catalog_revision(conn: &Connection) -> Result<()> {
    ensure_trait_catalog_revision(conn)?;
    conn.execute(
        "UPDATE trait_catalog_revision SET revision = revision + 1 WHERE singleton = 1",
        [],
    )?;
    Ok(())
}

pub fn json_to_trait_table(json_file: &Path, db_path: &Path) -> Result<()> {
    let raw = fs::read_to_string(json_file)
        .with_context(|| format!("failed to read {}", json_file.display()))?;
    let data: Vec<Value> = serde_json::from_str(&raw)?;
    if data.is_empty() {
        return Err(anyhow!(
            "default trait catalog must be a non-empty JSON array"
        ));
    }

    let mut ids: Vec<String> = Vec::with_capacity(data.len());
    let mut seen: HashSet<String> = HashSet::with_capacity(data.len());
    for item in &data {
        let id = item
            .get("id")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| anyhow!("every default trait must have an id"))?;
        if !seen.insert(id.to_string()) {
            return Err(anyhow!("default trait catalog contains duplicate ids"));
        }
        ids.push(id.to_string());
    }

    let mut conn = open_connection(db_path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS traits (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            icon TEXT,
            confidence TEXT,
            isDefault BOOLEAN,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            category TEXT,
            rsids TEXT,
            formula TEXT,
            scoreThresholds TEXT,
            result TEXT,
            reference TEXT
        );",
    )?;
    ensure_trait_catalog_revision(&conn)?;

    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO traits
                (id, name, description, icon, confidence, isDefault,
                 createdAt, category, rsids, formula, scoreThresholds,
                 result, reference)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                description=excluded.description,
                icon=excluded.icon,
                confidence=excluded.confidence,
                isDefault=1,
                createdAt=excluded.createdAt,
                category=excluded.category,
                rsids=excluded.rsids,
                formula=excluded.formula,
                scoreThresholds=excluded.scoreThresholds,
                result=excluded.result,
                reference=excluded.reference",
        )?;
        let now = Local::now()
            .naive_local()
            .format("%Y-%m-%dT%H:%M:%S%.6f")
            .to_string();
        for item in &data {
            let id = item.get("id").and_then(Value::as_str).unwrap_or("");
            let name = serde_json::to_string(item.get("name").unwrap_or(&json!({})))?;
            let description = serde_json::to_string(item.get("description").unwrap_or(&json!({})))?;
            let icon = item.get("icon").and_then(Value::as_str).unwrap_or("Dna");
            let confidence = item
                .get("confidence")
                .and_then(Value::as_str)
                .unwrap_or("low");
            let created_at = item
                .get("createdAt")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .unwrap_or(&now);
            let category = item
                .get("category")
                .and_then(Value::as_str)
                .unwrap_or("internal");
            let rsids = item
                .get("rsids")
                .and_then(Value::as_array)
                .map(|a| {
                    a.iter()
                        .filter_map(Value::as_str)
                        .collect::<Vec<_>>()
                        .join(";")
                })
                .unwrap_or_default();
            let formula = item.get("formula").and_then(Value::as_str).unwrap_or("");
            let thresholds =
                serde_json::to_string(item.get("scoreThresholds").unwrap_or(&json!({})))?;
            let result = serde_json::to_string(item.get("result").unwrap_or(&json!({})))?;
            let reference = item
                .get("reference")
                .and_then(Value::as_array)
                .map(|a| {
                    a.iter()
                        .filter_map(Value::as_str)
                        .collect::<Vec<_>>()
                        .join(";")
                })
                .unwrap_or_default();

            stmt.execute(params![
                id,
                name,
                description,
                icon,
                confidence,
                1i64,
                created_at,
                category,
                rsids,
                formula,
                thresholds,
                result,
                reference
            ])?;
        }
    }

    let placeholders = vec!["?"; ids.len()].join(",");
    let delete_sql =
        format!("DELETE FROM traits WHERE isDefault = 1 AND id NOT IN ({placeholders})");
    tx.execute(&delete_sql, rusqlite::params_from_iter(ids.iter()))?;
    tx.commit()?;
    Ok(())
}

fn ensure_json_string(val: &Value) -> String {
    match val {
        Value::String(s) => {
            if serde_json::from_str::<Value>(s).is_ok() {
                s.clone()
            } else {
                serde_json::to_string(s).unwrap_or_else(|_| "\"\"".to_string())
            }
        }
        other => serde_json::to_string(other).unwrap_or_else(|_| "{}".to_string()),
    }
}

pub fn add_trait(data: &Value, db_path: &Path, add_mode: bool, is_default: bool) -> Result<()> {
    let conn = open_connection(db_path)?;
    let id = if add_mode {
        format!("TRA_{}", generate_random_upper_alnum(10))
    } else {
        data.get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("missing trait id"))?
            .to_string()
    };

    let name = ensure_json_string(data.get("name").unwrap_or(&Value::Null));
    let description = ensure_json_string(data.get("description").unwrap_or(&Value::Null));
    let score_thresholds = ensure_json_string(data.get("scoreThresholds").unwrap_or(&Value::Null));
    let result = ensure_json_string(data.get("result").unwrap_or(&Value::Null));
    let icon = data
        .get("icon")
        .and_then(Value::as_str)
        .unwrap_or("AlertCircle");
    let confidence = data
        .get("confidence")
        .and_then(Value::as_str)
        .unwrap_or("medium");
    let created_at = Local::now()
        .naive_local()
        .format("%Y-%m-%dT%H:%M:%S%.6f")
        .to_string();
    let category = data
        .get("category")
        .and_then(Value::as_str)
        .unwrap_or("appearance");
    let rsids = data
        .get("rsids")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join(";")
        })
        .unwrap_or_default();
    let formula = data.get("formula").and_then(Value::as_str).unwrap_or("");
    let reference = data
        .get("reference")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join(";")
        })
        .unwrap_or_default();

    conn.execute(
        "INSERT INTO traits (id, name, description, icon, confidence, isDefault, createdAt, category, rsids, formula, scoreThresholds, result, reference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            id,
            name,
            description,
            icon,
            confidence,
            if is_default { 1i64 } else { 0i64 },
            created_at,
            category,
            rsids,
            formula,
            score_thresholds,
            result,
            reference
        ],
    )?;

    if !is_default {
        bump_trait_catalog_revision(&conn)?;
    }
    Ok(())
}

pub fn delete_trait(id: &str, db_path: &Path) -> Result<()> {
    if !id.starts_with("TRA_") {
        return Ok(());
    }
    let conn = open_connection(db_path)?;
    let changed = conn.execute("DELETE FROM traits WHERE id = ?", [id])?;
    if changed > 0 {
        bump_trait_catalog_revision(&conn)?;
    }
    Ok(())
}

pub fn import_custom_traits(items: &[Value], db_path: &Path) -> Result<()> {
    for item in items {
        if !item.is_object() {
            continue;
        }
        add_trait(item, db_path, false, false)?;
    }
    Ok(())
}

pub fn export_custom_traits(cfg: &RuntimeConfig, db_path: &Path) -> Result<Vec<Value>> {
    let compiled = load_compiled_catalog(cfg).ok();
    let conn = open_connection(db_path)?;
    if !table_exists(&conn, "traits")? {
        return Ok(Vec::new());
    }
    let mut stmt = conn.prepare(
        "SELECT id, name, description, icon, confidence, isDefault, createdAt, category, rsids, formula, scoreThresholds, result, reference
         FROM traits WHERE isDefault = 0",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1).unwrap_or_default(),
            row.get::<_, String>(2).unwrap_or_default(),
            row.get::<_, String>(3).unwrap_or_default(),
            row.get::<_, String>(4).unwrap_or_default(),
            row.get::<_, i64>(5).unwrap_or(0) != 0,
            row.get::<_, String>(6).unwrap_or_default(),
            row.get::<_, String>(7).unwrap_or_default(),
            row.get::<_, String>(8).unwrap_or_default(),
            row.get::<_, String>(9).unwrap_or_default(),
            row.get::<_, String>(10).unwrap_or_default(),
            row.get::<_, String>(11).unwrap_or_default(),
            row.get::<_, String>(12).unwrap_or_default(),
        ))
    })?;

    let mut out = Vec::new();
    for r in rows {
        let (
            id,
            name_s,
            desc_s,
            icon,
            confidence,
            is_default,
            created_at,
            category,
            rsids_s,
            formula,
            thresh_s,
            result_s,
            ref_s,
        ) = r?;
        let Ok(name): Result<Value, _> = serde_json::from_str(&name_s) else {
            continue;
        };
        let Ok(description): Result<Value, _> = serde_json::from_str(&desc_s) else {
            continue;
        };
        let Ok(score_thresholds): Result<Value, _> = serde_json::from_str(&thresh_s) else {
            continue;
        };
        let Ok(result): Result<Value, _> = serde_json::from_str(&result_s) else {
            continue;
        };
        let rsids: Vec<String> = if rsids_s.is_empty() {
            Vec::new()
        } else {
            rsids_s.split(';').map(String::from).collect()
        };
        let mut refs: Vec<String> = if ref_s.is_empty() {
            Vec::new()
        } else {
            ref_s
                .split(';')
                .filter(|r| !matches!(*r, "11111111" | "222222222" | "333333333"))
                .map(String::from)
                .collect()
        };
        if let Some(ev) = compiled.as_ref().and_then(|c| c.evidence.get(&id)) {
            if let Some(arr) = ev.get("evidence").and_then(Value::as_array) {
                refs = arr
                    .iter()
                    .filter_map(|i| i.get("id").and_then(Value::as_str).map(String::from))
                    .collect();
            }
        }
        out.push(json!({
            "id": id,
            "name": name,
            "description": description,
            "icon": icon,
            "confidence": confidence,
            "isDefault": is_default,
            "createdAt": created_at,
            "category": category,
            "rsids": rsids,
            "formula": formula,
            "scoreThresholds": score_thresholds,
            "result": result,
            "reference": refs,
        }));
    }
    Ok(out)
}

pub fn ensure_report_rsid_indexes(db_path: &Path) -> Result<()> {
    let mut conn = open_connection(db_path)?;
    let tables: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'RPT_%'")?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        rows
    };
    let tx = conn.transaction()?;
    for table in tables {
        if !table.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            return Err(anyhow!("unsafe report table name: {table}"));
        }
        tx.execute_batch(&format!(
            "CREATE INDEX IF NOT EXISTS idx_{table}_rsid ON {table}(rsid)"
        ))?;
    }
    tx.commit()?;
    Ok(())
}

// =========================================================================
// Trait Report Backfill Migration (port of trait_report_migration.py)
// =========================================================================

fn normalize_backfill_genotype(value: &str) -> Option<String> {
    let cleaned: String = value
        .trim()
        .to_ascii_uppercase()
        .replace('/', "")
        .replace('|', "");
    if matches!(cleaned.as_str(), "" | "--" | "00" | "NN") {
        return None;
    }
    let doubled = if cleaned.len() == 1 && "ACGTDI".contains(cleaned.as_str()) {
        format!("{cleaned}{cleaned}")
    } else {
        cleaned
    };
    if doubled.len() != 2 || !doubled.chars().all(|c| "ACGTDI".contains(c)) {
        return None;
    }
    let mut chars: Vec<char> = doubled.chars().collect();
    chars.sort_unstable();
    Some(chars.into_iter().collect())
}

fn normalize_chromosome(value: &str) -> Option<String> {
    let trimmed = value.trim();
    let stripped = trimmed.strip_prefix("chr").unwrap_or(trimmed);
    match stripped {
        "23" => Some("X".to_string()),
        "24" => Some("Y".to_string()),
        "25" => None,
        "26" | "M" => Some("MT".to_string()),
        other => Some(other.to_string()),
    }
}

fn iter_raw_variants(
    archive_tool: &str,
    path: &Path,
    source: &str,
    wanted: Option<&HashSet<String>>,
) -> Result<Vec<(String, String, i64, String)>> {
    if path.extension().and_then(|e| e.to_str()) == Some("parquet") {
        let list: Option<Vec<String>> = wanted.map(|s| s.iter().cloned().collect());
        return archive_variants(archive_tool, path, list.as_deref());
    }
    let mut out = Vec::new();
    let file = File::open(path)?;
    let reader = BufReader::new(file);

    if source.eq_ignore_ascii_case("ancestry") {
        let mut header: Option<[usize; 5]> = None;
        for line_res in reader.lines() {
            let line = line_res?;
            let text = line.trim_start_matches('\u{feff}').trim_end_matches('\r');
            if text.is_empty() || text.starts_with('#') {
                continue;
            }
            let fields: Vec<&str> = text.split('\t').collect();
            if let Some([i_rsid, i_chr, i_pos, i_a1, i_a2]) = header {
                let Some(rsid) = fields.get(i_rsid) else {
                    continue;
                };
                if let Some(w) = wanted {
                    if !w.contains(*rsid) {
                        continue;
                    }
                }
                let Some(chr) = fields.get(i_chr).and_then(|c| normalize_chromosome(c)) else {
                    continue;
                };
                let Ok(pos) = fields
                    .get(i_pos)
                    .map(|p| p.trim())
                    .unwrap_or("")
                    .parse::<i64>()
                else {
                    continue;
                };
                let gt = format!(
                    "{}{}",
                    fields.get(i_a1).unwrap_or(&""),
                    fields.get(i_a2).unwrap_or(&"")
                );
                out.push(((*rsid).to_string(), chr, pos, gt));
            } else {
                let find_col = |name: &str| fields.iter().position(|f| *f == name);
                if let (Some(a), Some(b), Some(c), Some(d), Some(e)) = (
                    find_col("rsid"),
                    find_col("chromosome"),
                    find_col("position"),
                    find_col("allele1"),
                    find_col("allele2"),
                ) {
                    header = Some([a, b, c, d, e]);
                }
            }
        }
    } else {
        for line_res in reader.lines() {
            let line = line_res?;
            let text = line.trim_start_matches('\u{feff}').trim_end_matches('\r');
            if text.trim().is_empty() || text.starts_with('#') {
                continue;
            }
            let fields: Vec<&str> = text.split(['\t', ',']).collect();
            if fields.len() < 4 || !fields[0].to_ascii_lowercase().starts_with("rs") {
                continue;
            }
            if let Some(w) = wanted {
                if !w.contains(fields[0]) {
                    continue;
                }
            }
            let Some(chr) = normalize_chromosome(fields[1]) else {
                continue;
            };
            let Ok(pos) = fields[2].trim().parse::<i64>() else {
                continue;
            };
            out.push((fields[0].to_string(), chr, pos, fields[3].to_string()));
        }
    }
    Ok(out)
}

pub fn load_locus_registry(path: &Path) -> Result<(Map<String, Value>, String)> {
    let raw = fs::read(path).with_context(|| format!("failed to read {}", path.display()))?;
    let doc: Value = serde_json::from_slice(&raw)?;
    let loci = doc
        .get("loci")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let expected = doc
        .get("counts")
        .and_then(|c| c.get("expected"))
        .and_then(Value::as_u64)
        .unwrap_or(0) as usize;
    if expected != 154 || loci.len() != expected {
        return Err(anyhow!(
            "trait locus registry is incomplete: {}/{}",
            loci.len(),
            if expected == 0 { 154 } else { expected }
        ));
    }
    let unverified: Vec<&String> = loci
        .iter()
        .filter_map(|(k, v)| {
            (v.get("status").and_then(Value::as_str) != Some("verified")).then_some(k)
        })
        .collect();
    if !unverified.is_empty() {
        return Err(anyhow!(
            "trait locus registry has unverified entries: {:?}",
            &unverified[..unverified.len().min(10)]
        ));
    }
    Ok((loci, sha256_hex(&raw)))
}

fn find_raw_path_for_backfill(
    cfg: &RuntimeConfig,
    report_id: &str,
    source: &str,
) -> Result<PathBuf> {
    if report_id == "RPT_TEMPLATE01" {
        return Ok(cfg.template_path.clone());
    }
    let suffix = report_id.strip_prefix("RPT_").unwrap_or(report_id);
    let prefix = format!("RDT_{suffix}.");
    let mut matches: Vec<PathBuf> = fs::read_dir(&cfg.rawdata_dir)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with(&prefix))
                .unwrap_or(false)
        })
        .filter(|p| {
            matches!(
                p.extension().and_then(|e| e.to_str()),
                Some("txt" | "parquet")
            )
        })
        .collect();
    matches.sort();

    let all_set: HashSet<PathBuf> = matches.iter().cloned().collect();
    matches.retain(|p| {
        !(p.extension().and_then(|e| e.to_str()) == Some("txt")
            && all_set.contains(&p.with_extension("parquet")))
    });

    let needle = format!(".{source}.");
    let source_matches: Vec<PathBuf> = matches
        .iter()
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.contains(&needle))
                .unwrap_or(false)
        })
        .cloned()
        .collect();
    let candidates = if source_matches.is_empty() {
        matches
    } else {
        source_matches
    };
    if candidates.len() != 1 {
        return Err(anyhow!("raw file for {report_id} is missing or ambiguous"));
    }
    Ok(candidates.into_iter().next().unwrap())
}

fn complement_gt(gt: &str) -> Option<String> {
    let mut chars: Vec<char> = Vec::with_capacity(gt.len());
    for c in gt.chars() {
        chars.push(match c {
            'A' => 'T',
            'T' => 'A',
            'C' => 'G',
            'G' => 'C',
            _ => return None,
        });
    }
    chars.sort_unstable();
    Some(chars.into_iter().collect())
}

pub fn forward_genotype(genotype: &str, locus: &Value, source_strand: &str) -> Result<String> {
    let normalized = normalize_backfill_genotype(genotype)
        .ok_or_else(|| anyhow!("empty or unsupported genotype"))?;
    let mut alleles: HashSet<char> = locus
        .get("traitAlleles")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .flat_map(|s| s.chars())
                .collect()
        })
        .unwrap_or_default();
    if alleles.is_empty() {
        if let Some(grch38) = locus.get("grch38") {
            if let Some(r) = grch38.get("reference").and_then(Value::as_str) {
                alleles.extend(r.chars());
            }
            if let Some(alts) = grch38.get("alternates").and_then(Value::as_array) {
                for a in alts.iter().filter_map(Value::as_str) {
                    alleles.extend(a.chars());
                }
            }
        }
    }
    let matches_alleles = |gt: &str| gt.chars().all(|c| alleles.contains(&c));

    if source_strand == "forward" {
        if matches_alleles(&normalized) {
            return Ok(normalized);
        }
        return Err(anyhow!(
            "forward genotype {normalized} does not match {:?}",
            alleles
        ));
    }
    if source_strand == "reverse" {
        let comp = complement_gt(&normalized).ok_or_else(|| {
            anyhow!("reverse-strand conversion is unavailable for encoded indels")
        })?;
        if matches_alleles(&comp) {
            return Ok(comp);
        }
        return Err(anyhow!(
            "reverse genotype {normalized} does not match {:?}",
            alleles
        ));
    }

    let id_ok = matches_alleles(&normalized);
    let comp = complement_gt(&normalized).unwrap_or_else(|| normalized.clone());
    let comp_ok = matches_alleles(&comp);
    if id_ok && !comp_ok {
        return Ok(normalized);
    }
    if comp_ok && !id_ok {
        return Ok(comp);
    }
    if id_ok && comp_ok && normalized != comp {
        return Err(anyhow!(
            "genotype {normalized} is strand-ambiguous without a source adapter"
        ));
    }
    if id_ok {
        return Ok(normalized);
    }
    Err(anyhow!(
        "genotype {normalized} does not match forward alleles {:?}",
        alleles
    ))
}

fn position_matches(rsid: &str, chromosome: &str, position: i64, locus: &Value) -> bool {
    for asm in ["grch37", "grch38"] {
        if let Some(placement) = locus.get(asm) {
            let chr_match = placement
                .get("chromosome")
                .map(|c| match c {
                    Value::String(s) => s == chromosome,
                    Value::Number(n) => n.to_string() == chromosome,
                    _ => false,
                })
                .unwrap_or(false);
            let pos_match = placement.get("position").and_then(Value::as_i64) == Some(position);
            if chr_match && pos_match {
                return true;
            }
        }
    }
    rsid == "rs1799750"
        && locus.get("alleleEncoding").and_then(Value::as_str) == Some("insertion_deletion")
        && chromosome == "11"
        && matches!(position, 102670495 | 102799764)
}

fn file_signature(path: &Path) -> Result<String> {
    let meta = fs::metadata(path)?;
    let size = meta.len();
    let mtime_ns = meta
        .modified()?
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    Ok(format!("{size}:{mtime_ns}"))
}

pub fn backfill_report(
    cfg: &RuntimeConfig,
    db_path: &Path,
    report_id: &str,
    source: &str,
    loci: &Map<String, Value>,
    registry_hash: &str,
) -> Result<usize> {
    let report_id = validate_report_table_name(report_id)?;
    let source_lower = source.to_ascii_lowercase();
    if !matches!(source_lower.as_str(), "23andme" | "wegene" | "ancestry") {
        return Err(anyhow!("unsupported raw-data source adapter: {source}"));
    }
    let raw_path = find_raw_path_for_backfill(cfg, report_id, source)?;
    let signature = file_signature(&raw_path)?;

    {
        let check = open_connection(db_path)?;
        let cols: HashSet<String> = crate::db::table_columns(&check, "report_trait_import_state")
            .unwrap_or_default()
            .into_iter()
            .collect();
        if cols.contains("file_signature") {
            let prev: Option<(String, String, Option<String>)> = check
                .query_row(
                    "SELECT importer_version, registry_hash, file_signature FROM report_trait_import_state WHERE report_id=?",
                    [report_id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .ok();
            if prev
                == Some((
                    IMPORTER_VERSION.to_string(),
                    registry_hash.to_string(),
                    Some(signature.clone()),
                ))
            {
                return Ok(0);
            }
        }
    }

    let wanted: HashSet<String> = loci.keys().cloned().collect();
    let mut raw_rows: HashMap<String, String> = HashMap::new();
    let mut raw_order: Vec<String> = Vec::new();
    for (rsid, chromosome, position, raw_genotype) in
        iter_raw_variants(&cfg.archive_tool, &raw_path, source, Some(&wanted))?
    {
        if !wanted.contains(&rsid) {
            continue;
        }
        let trimmed = raw_genotype.trim().to_ascii_uppercase();
        if matches!(trimmed.as_str(), "" | "--" | "00" | "NN") {
            continue;
        }
        let locus = &loci[&rsid];
        if !position_matches(&rsid, &chromosome, position, locus) {
            return Err(anyhow!(
                "{report_id}/{rsid}: source position {chromosome}:{position} matches neither GRCh37 nor GRCh38"
            ));
        }
        let genotype = forward_genotype(&raw_genotype, locus, "forward")
            .map_err(|e| anyhow!("{report_id}/{rsid}: {e}"))?;
        if let Some(prev) = raw_rows.get(&rsid) {
            if prev != &genotype {
                return Err(anyhow!(
                    "{report_id}/{rsid}: conflicting duplicate raw genotypes"
                ));
            }
        } else {
            raw_order.push(rsid.clone());
        }
        raw_rows.insert(rsid, genotype);
    }

    let mut conn = open_connection(db_path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS report_trait_import_state (
            report_id TEXT PRIMARY KEY,
            importer_version TEXT NOT NULL,
            registry_hash TEXT NOT NULL,
            added_count INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        );",
    )?;
    let cols: HashSet<String> = crate::db::table_columns(&conn, "report_trait_import_state")?
        .into_iter()
        .collect();
    if !cols.contains("file_signature") {
        conn.execute(
            "ALTER TABLE report_trait_import_state ADD COLUMN file_signature TEXT",
            [],
        )?;
    }

    let mut existing: HashMap<String, Option<String>> = HashMap::new();
    if !raw_rows.is_empty() {
        let keys: Vec<&String> = raw_rows.keys().collect();
        let marks = vec!["?"; keys.len()].join(",");
        let mut stmt = conn.prepare(&format!(
            "SELECT rsid, genotype FROM {report_id} WHERE rsid IN ({marks})"
        ))?;
        let mut rows = stmt.query(rusqlite::params_from_iter(keys.iter()))?;
        while let Some(r) = rows.next()? {
            let k: String = r.get(0)?;
            let v: Option<String> = r.get(1)?;
            existing.insert(k, v);
        }
    }

    let mut additions: Vec<(
        String,
        i64,
        String,
        String,
        Option<String>,
        String,
        String,
        String,
    )> = Vec::new();
    for rsid in &raw_order {
        let genotype = &raw_rows[rsid];
        if let Some(stored) = existing.get(rsid) {
            let stored_norm = stored.as_deref().and_then(normalize_backfill_genotype);
            if stored_norm.as_deref() != Some(genotype.as_str()) {
                return Err(anyhow!(
                    "{report_id}/{rsid}: stored genotype conflicts with preserved raw data"
                ));
            }
            continue;
        }
        let locus = &loci[rsid];
        let placement = locus
            .get("grch38")
            .ok_or_else(|| anyhow!("{rsid}: missing grch38"))?;
        let mut alternatives: Vec<String> = placement
            .get("alternates")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(Value::as_str)
                    .map(String::from)
                    .collect()
            })
            .unwrap_or_default();
        if alternatives.is_empty() {
            return Err(anyhow!("{rsid}: registry has no alternate allele"));
        }
        let reference = locus
            .get("traitReferenceAllele")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .or_else(|| placement.get("reference").and_then(Value::as_str))
            .ok_or_else(|| anyhow!("{rsid}: missing reference allele"))?
            .to_string();
        if locus.get("alleleEncoding").and_then(Value::as_str) == Some("insertion_deletion") {
            alternatives = locus
                .get("traitAlleles")
                .and_then(Value::as_array)
                .map(|a| {
                    a.iter()
                        .filter_map(Value::as_str)
                        .filter(|al| *al != reference.as_str())
                        .map(String::from)
                        .collect()
                })
                .unwrap_or_default();
        }
        let ref_count = genotype.matches(&reference).count();
        let gt_class = match ref_count {
            2 => "WT",
            1 => "HET",
            _ => "HOM",
        };
        let chrom = placement
            .get("chromosome")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let pos = placement
            .get("position")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        let gene = locus.get("gene").and_then(Value::as_str).map(String::from);
        additions.push((
            chrom,
            pos,
            reference,
            alternatives.join(","),
            gene,
            rsid.clone(),
            genotype.clone(),
            gt_class.to_string(),
        ));
    }

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    {
        let mut stmt = tx.prepare(&format!(
            "INSERT INTO {report_id}
                (chromosome, position, ref, alt, gnomAD_AF, gene, clnsig, clndn, rsid, genotype, gt)
             VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?, ?)"
        ))?;
        for (chrom, pos, reference, alt, gene, rsid, gt, gt_class) in &additions {
            stmt.execute(params![
                chrom, pos, reference, alt, gene, rsid, gt, gt_class
            ])?;
        }
    }
    tx.execute_batch(&format!(
        "CREATE INDEX IF NOT EXISTS idx_{report_id}_rsid ON {report_id}(rsid)"
    ))?;
    tx.execute(
        "INSERT INTO report_trait_import_state
            (report_id, importer_version, registry_hash, added_count, updated_at, file_signature)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(report_id) DO UPDATE SET
            importer_version=excluded.importer_version,
            registry_hash=excluded.registry_hash,
            added_count=excluded.added_count,
            updated_at=excluded.updated_at,
            file_signature=excluded.file_signature",
        params![
            report_id,
            IMPORTER_VERSION,
            registry_hash,
            additions.len() as i64,
            Utc::now().to_rfc3339(),
            signature,
        ],
    )?;
    tx.execute(
        &format!(
            "UPDATE reports SET total_snps=(SELECT COUNT(*) FROM {report_id}) WHERE report_id=?"
        ),
        [report_id],
    )?;
    tx.commit()?;
    Ok(additions.len())
}

pub fn backfill_all_reports(
    cfg: &RuntimeConfig,
    db_path: &Path,
) -> Result<BTreeMap<String, usize>> {
    let (loci, registry_hash) = load_locus_registry(&cfg.trait_locus_path)?;
    let conn = open_connection(db_path)?;
    let reports: Vec<(String, String)> = {
        let mut stmt =
            conn.prepare("SELECT report_id, data_source FROM reports ORDER BY report_id")?;
        let rows = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        rows
    };
    drop(conn);
    let mut results = BTreeMap::new();
    for (report_id, source) in reports {
        let added = backfill_report(cfg, db_path, &report_id, &source, &loci, &registry_hash)?;
        results.insert(report_id, added);
    }
    Ok(results)
}

pub fn get_report_backfill_status(db_path: &Path, registry_hash: &str) -> Result<Value> {
    let conn = open_connection(db_path)?;
    let report_ids: Vec<String> = {
        let mut stmt = conn.prepare("SELECT report_id FROM reports")?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        rows
    };
    let current_ids: HashSet<String> = conn
        .prepare(
            "SELECT report_id FROM report_trait_import_state WHERE importer_version=? AND registry_hash=?",
        )
        .and_then(|mut stmt| {
            let rows = stmt.query_map(params![IMPORTER_VERSION, registry_hash], |r| {
                r.get::<_, String>(0)
            })?;
            let mut set = HashSet::new();
            for r in rows {
                set.insert(r?);
            }
            Ok(set)
        })
        .unwrap_or_default();

    let stale_count = report_ids
        .iter()
        .filter(|id| !current_ids.contains(*id))
        .count();
    Ok(json!({
        "importerVersion": IMPORTER_VERSION,
        "total": report_ids.len(),
        "current": report_ids.len() - stale_count,
        "staleCount": stale_count,
        "ready": stale_count == 0,
    }))
}
