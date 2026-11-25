use crate::traits::{parse_formula, sha256_hex, FormulaValue};
use anyhow::{anyhow, Context, Result};
use serde_json::{json, Map, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::Path;

const PLACEHOLDER_REFS: &[&str] = &["11111111", "222222222", "333333333"];
const REJECTED_DISPOSITIONS: &[&str] = &[
    "rejected_evidence_insufficient",
    "rejected_semantic_duplicate",
    "rejected_medical_model_insufficient",
];

fn is_valid_rsid(s: &str) -> bool {
    let Some(rest) = s.strip_prefix("rs") else {
        return false;
    };
    !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_digit())
}

fn is_valid_genotype(s: &str) -> bool {
    if s == "--" {
        return true;
    }
    s.len() == 2
        && s.bytes()
            .all(|b| matches!(b, b'A' | b'C' | b'G' | b'T' | b'D' | b'I' | b'-'))
}

fn canonical_genotype(gt: &str) -> String {
    if gt.len() != 2 || gt == "--" {
        return gt.to_string();
    }
    let mut chars: Vec<char> = gt.to_ascii_uppercase().chars().collect();
    chars.sort_unstable();
    chars.into_iter().collect()
}

fn has_cjk(s: &str) -> bool {
    s.chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c))
}

fn find_all_rsids(formula: &str) -> HashSet<String> {
    let mut out = HashSet::new();
    let bytes = formula.as_bytes();
    let mut i = 0;
    while i + 2 < bytes.len() {
        if bytes[i] == b'r' && bytes[i + 1] == b's' && bytes[i + 2].is_ascii_digit() {
            let start = i;
            let mut end = i + 2;
            while end < bytes.len() && bytes[end].is_ascii_digit() {
                end += 1;
            }
            out.insert(formula[start..end].to_string());
            i = end;
        } else {
            i += 1;
        }
    }
    out
}

pub fn extract_formula_maps(formula: &str) -> Vec<(String, Vec<(String, f64)>)> {
    if !formula.starts_with("SCORE(") || !formula.ends_with(')') {
        return Vec::new();
    }
    let inner = &formula[6..formula.len() - 1];
    let mut out = Vec::new();
    for segment in inner.split(';') {
        let seg = segment.trim();
        if seg.is_empty() {
            continue;
        }
        let Some((rsid_raw, rules_raw)) = seg.split_once(':') else {
            continue;
        };
        let rsid = rsid_raw.trim();
        if !is_valid_rsid(rsid) {
            continue;
        }
        let mut mapping = Vec::new();
        for pair in rules_raw.split(',') {
            let pair = pair.trim();
            if let Some((gt, score_s)) = pair.split_once('=') {
                if let Ok(score) = score_s.trim().parse::<f64>() {
                    mapping.push((gt.trim().to_string(), score));
                }
            }
        }
        out.push((rsid.to_string(), mapping));
    }
    out
}

fn expected_result_key(trait_val: &Value, value: &FormulaValue) -> Option<String> {
    let thresholds = trait_val.get("scoreThresholds")?.as_object()?;
    for (k, v) in thresholds {
        match value {
            FormulaValue::Bool(b) => {
                if v.as_bool() == Some(*b) {
                    return Some(k.clone());
                }
            }
            FormulaValue::Score(s) => {
                if !v.is_boolean() {
                    if let Some(t) = v.as_f64() {
                        if *s >= t {
                            return Some(k.clone());
                        }
                    }
                }
            }
        }
    }
    None
}

pub fn exhaustive_score_fixtures(trait_val: &Value) -> Vec<Value> {
    let formula = trait_val
        .get("formula")
        .and_then(Value::as_str)
        .unwrap_or("");
    let maps = extract_formula_maps(formula);
    if maps.is_empty() {
        return Vec::new();
    }

    let mut combos: Vec<Vec<(String, String, f64)>> = vec![vec![]];
    for (rsid, entries) in &maps {
        let mut next = Vec::new();
        for existing in &combos {
            for (gt, score) in entries {
                let mut item = existing.clone();
                item.push((rsid.clone(), gt.clone(), *score));
                next.push(item);
            }
        }
        combos = next;
    }

    let mut fixtures = Vec::with_capacity(combos.len());
    for combo in combos {
        let mut gt_map = Map::new();
        let mut name_parts = Vec::with_capacity(combo.len());
        let mut expected_score = 0.0_f64;
        for (rsid, gt, score) in combo {
            name_parts.push(gt.clone());
            gt_map.insert(rsid, Value::String(gt));
            expected_score += score;
        }
        let result_key = expected_result_key(trait_val, &FormulaValue::Score(expected_score));
        fixtures.push(json!({
            "name": format!("__generated__{}", name_parts.join("_")),
            "genotypes": gt_map,
            "expected_score": expected_score,
            "expected_result_key": result_key,
        }));
    }
    fixtures
}

pub fn resolve_legacy_result(
    trait_val: &Value,
    genotypes: &HashMap<String, String>,
) -> Result<(FormulaValue, Option<String>)> {
    let formula = trait_val
        .get("formula")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("missing formula"))?;
    let val = parse_formula(formula, genotypes).map_err(|e| anyhow!("{e}"))?;
    let key = expected_result_key(trait_val, &val);
    Ok((val, key))
}

fn canonical_json_str(value: &Value) -> String {
    fn sort_val(v: &Value) -> Value {
        match v {
            Value::Object(map) => {
                let mut sorted: BTreeMap<&String, Value> = BTreeMap::new();
                for (k, val) in map {
                    sorted.insert(k, sort_val(val));
                }
                let mut out = Map::new();
                for (k, val) in sorted {
                    out.insert(k.clone(), val);
                }
                Value::Object(out)
            }
            Value::Array(arr) => Value::Array(arr.iter().map(sort_val).collect()),
            other => other.clone(),
        }
    }
    serde_json::to_string(&sort_val(value)).unwrap_or_default()
}

pub fn catalog_version_hash(document: &Value) -> String {
    let mut versionless = document.as_object().cloned().unwrap_or_default();
    versionless.remove("catalogVersion");
    let canonical = canonical_json_str(&Value::Object(versionless));
    sha256_hex(canonical.as_bytes())[..16].to_string()
}

pub fn materialize_compatibility(document: &Value) -> Result<(Vec<Value>, Value, Value)> {
    let declared = document
        .get("catalogVersion")
        .and_then(Value::as_str)
        .unwrap_or("");
    if declared != catalog_version_hash(document) {
        return Err(anyhow!("normalized trait catalog version hash is stale"));
    }
    let mut traits = Vec::new();
    let mut rules = Map::new();
    if let Some(arr) = document.get("traits").and_then(Value::as_array) {
        for item in arr {
            let mut trait_obj = item.as_object().cloned().unwrap_or_default();
            let ev = trait_obj
                .remove("evidenceRecord")
                .unwrap_or_else(|| json!({}));
            let tid = trait_obj
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            traits.push(Value::Object(trait_obj));
            rules.insert(tid, ev);
        }
    }
    let mut evidence = document
        .get("evidenceMetadata")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    evidence.insert("rules".to_string(), Value::Object(rules));
    let loci = document
        .get("locusRegistry")
        .cloned()
        .unwrap_or_else(|| json!({}));
    Ok((traits, Value::Object(evidence), loci))
}

fn mapping_is_complete(mapping: &Map<String, Value>) -> bool {
    let canonical: HashSet<String> = mapping.keys().map(|k| canonical_genotype(k)).collect();
    let alleles: HashSet<char> = canonical
        .iter()
        .flat_map(|gt| gt.chars())
        .filter(|c| "ACGTDI".contains(*c))
        .collect();
    let di: HashSet<char> = ['D', 'I'].into_iter().collect();
    if alleles == di {
        let expected: HashSet<String> = ["DD", "DI", "II"].into_iter().map(String::from).collect();
        return canonical == expected;
    }
    let acgt: HashSet<char> = ['A', 'C', 'G', 'T'].into_iter().collect();
    if alleles.len() != 2 || !alleles.is_subset(&acgt) {
        return false;
    }
    let mut sorted: Vec<char> = alleles.into_iter().collect();
    sorted.sort_unstable();
    let expected: HashSet<String> = [
        format!("{}{}", sorted[0], sorted[0]),
        format!("{}{}", sorted[0], sorted[1]),
        format!("{}{}", sorted[1], sorted[1]),
    ]
    .into_iter()
    .collect();
    canonical == expected
}

fn is_non_empty_json(val: Option<&Value>) -> bool {
    match val {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => !s.is_empty(),
        Some(Value::Array(a)) => !a.is_empty(),
        Some(Value::Object(o)) => !o.is_empty(),
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0) != 0.0,
    }
}

pub fn validate_catalog(default_path: &Path, evidence_path: &Path) -> Result<Vec<String>> {
    let traits_vec: Vec<Value> = serde_json::from_str(
        &fs::read_to_string(default_path)
            .with_context(|| format!("failed to read {}", default_path.display()))?,
    )?;
    let catalog: Value = serde_json::from_str(
        &fs::read_to_string(evidence_path)
            .with_context(|| format!("failed to read {}", evidence_path.display()))?,
    )?;
    let mut traits: HashMap<String, &Value> = HashMap::new();
    for t in &traits_vec {
        if let Some(id) = t.get("id").and_then(Value::as_str) {
            traits.insert(id.to_string(), t);
        }
    }

    let mut errors = Vec::new();
    if catalog.get("schema_version").and_then(Value::as_i64) != Some(1) {
        errors.push("catalog.schema_version must be 1".to_string());
    }
    if !is_non_empty_json(
        catalog
            .get("review_policy")
            .and_then(|p| p.get("curated_requires")),
    ) {
        errors.push("catalog.review_policy.curated_requires must be non-empty".to_string());
    }

    let empty_map = Map::new();
    let catalog_rules = catalog
        .get("rules")
        .and_then(Value::as_object)
        .unwrap_or(&empty_map);

    let mut missing_entries: Vec<&String> = traits
        .keys()
        .filter(|id| !catalog_rules.contains_key(*id))
        .collect();
    missing_entries.sort();
    for id in missing_entries {
        errors.push(format!("{id}: missing evidence catalog entry"));
    }

    for (rule_id, rule) in catalog_rules {
        let Some(trait_val) = traits.get(rule_id) else {
            errors.push(format!("{rule_id}: no matching legacy trait"));
            continue;
        };
        let status = rule.get("status").and_then(Value::as_str).unwrap_or("");
        if trait_val.get("evidenceStatus") != rule.get("status") {
            errors.push(format!(
                "{rule_id}: default trait evidenceStatus does not match sidecar status"
            ));
        }
        if trait_val.get("evidenceGrade") != rule.get("evidence_grade") {
            errors.push(format!(
                "{rule_id}: default trait evidenceGrade does not match sidecar grade"
            ));
        }
        if status != "curated" && trait_val.get("confidence").and_then(Value::as_str) != Some("low")
        {
            errors.push(format!(
                "{rule_id}: unreviewed/default-low-confidence rule has non-low confidence"
            ));
        }
        if !matches!(
            status,
            "curated" | "partial_evidence" | "review_required" | "do_not_import_unknown_formula"
        ) {
            errors.push(format!("{rule_id}: unsupported status {status:?}"));
        }

        let variants = rule
            .get("variants")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let variant_ids: Vec<String> = variants
            .iter()
            .filter_map(|v| v.get("rsid").and_then(Value::as_str).map(String::from))
            .collect();
        let variant_set: HashSet<&String> = variant_ids.iter().collect();
        if variant_set.len() != variant_ids.len() {
            errors.push(format!("{rule_id}: duplicate variant RSID"));
        }
        let legacy_rsids: HashSet<String> = trait_val
            .get("rsids")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(Value::as_str)
                    .map(String::from)
                    .collect()
            })
            .unwrap_or_default();
        let variant_owned_set: HashSet<String> = variant_ids.iter().cloned().collect();
        if variant_owned_set != legacy_rsids {
            errors.push(format!(
                "{rule_id}: evidence variants do not cover legacy RSIDs"
            ));
        }

        for variant in &variants {
            let rsid = variant.get("rsid").and_then(Value::as_str).unwrap_or("");
            if !is_valid_rsid(rsid) {
                errors.push(format!("{rule_id}: invalid RSID {rsid:?}"));
            }
            let mapping = variant.get("genotype_map").and_then(Value::as_object);
            if mapping.map(|m| m.is_empty()).unwrap_or(true) {
                errors.push(format!("{rule_id}/{rsid}: empty genotype_map"));
            }
            if status == "curated"
                && !matches!(
                    variant.get("mapping_status").and_then(Value::as_str),
                    Some("complete" | "literature_complete")
                )
            {
                errors.push(format!(
                    "{rule_id}/{rsid}: curated mapping_status must be complete"
                ));
            }
            if let Some(m) = mapping {
                for (gt, val) in m {
                    if !is_valid_genotype(gt) {
                        errors.push(format!("{rule_id}/{rsid}: invalid genotype {gt:?}"));
                    }
                    if !val.is_object() {
                        errors.push(format!("{rule_id}/{rsid}/{gt}: mapping must be object"));
                    }
                }
            }
            if status == "curated" {
                for field in [
                    "gene",
                    "literature_alleles",
                    "input_alleles",
                    "effect_allele",
                    "direction",
                ] {
                    if !is_non_empty_json(variant.get(field)) {
                        errors.push(format!("{rule_id}/{rsid}: curated mapping needs {field}"));
                    }
                }
            }
        }

        let formula = trait_val
            .get("formula")
            .and_then(Value::as_str)
            .unwrap_or("");
        for (rsid, expected_entries) in extract_formula_maps(formula) {
            let Some(sidecar) = variants
                .iter()
                .find(|v| v.get("rsid").and_then(Value::as_str) == Some(rsid.as_str()))
            else {
                continue;
            };
            let Some(actual_map) = sidecar.get("genotype_map").and_then(Value::as_object) else {
                continue;
            };
            let actual_keys: HashSet<String> =
                actual_map.keys().map(|k| canonical_genotype(k)).collect();
            let expected_keys: HashSet<String> = expected_entries
                .iter()
                .map(|(k, _)| canonical_genotype(k))
                .collect();
            if actual_keys != expected_keys {
                errors.push(format!(
                    "{rule_id}/{rsid}: genotype_map does not match formula genotypes"
                ));
            }
            for (gt, expected_score) in &expected_entries {
                let canon = canonical_genotype(gt);
                if let Some((_, entry)) = actual_map
                    .iter()
                    .find(|(k, _)| canonical_genotype(k) == canon)
                {
                    if let Some(actual_score) = entry.get("score").and_then(Value::as_f64) {
                        if (actual_score - expected_score).abs() > 1e-9 {
                            errors.push(format!(
                                "{rule_id}/{rsid}/{gt}: sidecar score {actual_score} != formula score {expected_score}"
                            ));
                        }
                    }
                }
            }
        }

        let evidence = rule
            .get("evidence")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if matches!(status, "curated" | "partial_evidence") && evidence.is_empty() {
            errors.push(format!("{rule_id}: curated rule has no evidence"));
        }
        let supported_terms: HashSet<String> = evidence
            .iter()
            .filter_map(|i| i.get("supports").and_then(Value::as_array))
            .flatten()
            .filter_map(Value::as_str)
            .map(String::from)
            .collect();
        if status == "curated" {
            for rsid in &variant_ids {
                if !supported_terms.contains(rsid) {
                    errors.push(format!("{rule_id}: no evidence explicitly supports {rsid}"));
                }
            }
        } else if status == "partial_evidence" && supported_terms.is_empty() {
            errors.push(format!("{rule_id}: partial rule has no supported terms"));
        }

        for item in &evidence {
            let etype = item.get("type").and_then(Value::as_str).unwrap_or("");
            if !matches!(etype, "PMID" | "DOI" | "ClinVar" | "CPIC" | "PharmGKB") {
                errors.push(format!("{rule_id}: unsupported evidence type {etype:?}"));
            }
            if !is_non_empty_json(item.get("id")) || !is_non_empty_json(item.get("url")) {
                errors.push(format!("{rule_id}: evidence item needs id and url"));
            }
            if status == "curated" {
                for field in [
                    "title",
                    "journal",
                    "year",
                    "studyType",
                    "supports",
                    "population",
                    "effectAllele",
                    "direction",
                ] {
                    if !is_non_empty_json(item.get(field)) {
                        errors.push(format!("{rule_id}: curated evidence item needs {field}"));
                    }
                }
            }
            if let Some(eid) = item.get("id").and_then(Value::as_str) {
                if PLACEHOLDER_REFS.contains(&eid) {
                    errors.push(format!(
                        "{rule_id}: placeholder evidence identifier is forbidden"
                    ));
                }
            }
        }

        if matches!(status, "review_required" | "do_not_import_unknown_formula")
            && !is_non_empty_json(rule.get("review_blockers"))
        {
            errors.push(format!(
                "{rule_id}: review-required rule needs review_blockers"
            ));
        }

        let fixtures = if rule.get("fixture_strategy").and_then(Value::as_str)
            == Some("cartesian_exhaustive")
        {
            exhaustive_score_fixtures(trait_val)
        } else {
            rule.get("fixtures")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default()
        };

        for fixture in &fixtures {
            let fname = fixture
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("<unnamed>");
            let gt_map: HashMap<String, String> = fixture
                .get("genotypes")
                .and_then(Value::as_object)
                .map(|o| {
                    o.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                        .collect()
                })
                .unwrap_or_default();
            match resolve_legacy_result(trait_val, &gt_map) {
                Err(exc) => errors.push(format!("{rule_id}/{fname}: evaluation failed: {exc}")),
                Ok((val, result_key)) => {
                    let expected_score = fixture.get("expected_score");
                    let score_ok = match (&val, expected_score) {
                        (FormulaValue::Bool(b), Some(Value::Bool(eb))) => b == eb,
                        (FormulaValue::Score(s), Some(Value::Number(n))) => {
                            n.as_f64().map(|es| (s - es).abs() < 1e-9).unwrap_or(false)
                        }
                        _ => false,
                    };
                    if !score_ok {
                        errors.push(format!(
                            "{rule_id}/{fname}: expected score {expected_score:?}, got {val:?}"
                        ));
                    }
                    let expected_key = fixture
                        .get("expected_result_key")
                        .and_then(Value::as_str)
                        .map(String::from);
                    if result_key != expected_key {
                        errors.push(format!(
                            "{rule_id}/{fname}: expected result {expected_key:?}, got {result_key:?}"
                        ));
                    }
                }
            }
        }
    }

    Ok(errors)
}

pub fn audit_legacy_traits(default_path: &Path) -> Result<Value> {
    let traits: Vec<Value> = serde_json::from_str(&fs::read_to_string(default_path)?)?;
    let mut missing_references = Vec::new();
    let mut placeholder_references = Vec::new();
    let mut formula_rsid_mismatches = Vec::new();
    let mut duplicate_rsids = Vec::new();

    for t in &traits {
        let tid = t
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let refs: Vec<&str> = t
            .get("reference")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter_map(Value::as_str).collect())
            .unwrap_or_default();
        if refs.is_empty() {
            missing_references.push(tid.clone());
        }
        if refs.iter().any(|r| PLACEHOLDER_REFS.contains(r)) {
            placeholder_references.push(tid.clone());
        }
        let formula = t.get("formula").and_then(Value::as_str).unwrap_or("");
        let formula_rsids = find_all_rsids(formula);
        let rsids_list: Vec<String> = t
            .get("rsids")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(Value::as_str)
                    .map(String::from)
                    .collect()
            })
            .unwrap_or_default();
        let declared_rsids: HashSet<String> = rsids_list.iter().cloned().collect();
        if formula_rsids != declared_rsids {
            let mut declared_only: Vec<String> =
                declared_rsids.difference(&formula_rsids).cloned().collect();
            declared_only.sort();
            let mut formula_only: Vec<String> =
                formula_rsids.difference(&declared_rsids).cloned().collect();
            formula_only.sort();
            formula_rsid_mismatches.push(json!({
                "id": tid,
                "declared_only": declared_only,
                "formula_only": formula_only,
            }));
        }
        if declared_rsids.len() != rsids_list.len() {
            duplicate_rsids.push(tid);
        }
    }

    Ok(json!({
        "total": traits.len(),
        "missing_references": missing_references,
        "placeholder_references": placeholder_references,
        "formula_rsid_mismatches": formula_rsid_mismatches,
        "duplicate_rsids": duplicate_rsids,
        "formula_only_rsids": [],
    }))
}

pub fn validate_production_catalog_full(
    default_path: &Path,
    evidence_path: &Path,
    locus_path: &Path,
    normalized_path: &Path,
    expected_count: usize,
) -> Result<Vec<String>> {
    let traits: Vec<Value> = serde_json::from_str(&fs::read_to_string(default_path)?)?;
    let catalog: Value = serde_json::from_str(&fs::read_to_string(evidence_path)?)?;
    let locus_doc: Value = serde_json::from_str(&fs::read_to_string(locus_path)?)?;
    let normalized_doc: Value = serde_json::from_str(&fs::read_to_string(normalized_path)?)?;

    let mut errors = validate_catalog(default_path, evidence_path)?;
    match materialize_compatibility(&normalized_doc) {
        Ok((gen_traits, gen_ev, gen_loci)) => {
            if gen_traits != traits || gen_ev != catalog || gen_loci != locus_doc {
                errors.push(
                    "normalized trait catalog and compatibility artifacts are out of sync"
                        .to_string(),
                );
            }
        }
        Err(e) => errors.push(e.to_string()),
    }

    if traits.len() != expected_count {
        errors.push(format!(
            "production count {} != {}",
            traits.len(),
            expected_count
        ));
    }

    let empty_map = Map::new();
    let loci = locus_doc
        .get("loci")
        .and_then(Value::as_object)
        .unwrap_or(&empty_map);
    let declared_rsids: HashSet<String> = traits
        .iter()
        .filter_map(|t| t.get("rsids").and_then(Value::as_array))
        .flatten()
        .filter_map(Value::as_str)
        .map(String::from)
        .collect();
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

    for (rsid, locus) in loci {
        if locus.get("status").and_then(Value::as_str) != Some("verified") {
            errors.push(format!("{rsid}: locus registry status is not verified"));
        }
        if locus.get("sourceAgreement").and_then(Value::as_bool) != Some(true) {
            errors.push(format!(
                "{rsid}: NCBI and Ensembl GRCh38 placements disagree"
            ));
        }
        for asm in ["grch37", "grch38"] {
            let p = locus.get(asm);
            if !is_non_empty_json(p.and_then(|v| v.get("chromosome")))
                || !is_non_empty_json(p.and_then(|v| v.get("position")))
            {
                errors.push(format!("{rsid}: missing {asm} chromosome placement"));
            }
        }
        let grch38 = locus.get("grch38");
        if !is_non_empty_json(grch38.and_then(|v| v.get("reference")))
            || !is_non_empty_json(grch38.and_then(|v| v.get("alternates")))
        {
            errors.push(format!(
                "{rsid}: missing GRCh38 reference/alternate alleles"
            ));
        }
        let trait_alleles: HashSet<String> = locus
            .get("traitAlleles")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(Value::as_str)
                    .map(String::from)
                    .collect()
            })
            .unwrap_or_default();
        let mut forward_alleles: HashSet<String> = HashSet::new();
        if let Some(r) = grch38
            .and_then(|v| v.get("reference"))
            .and_then(Value::as_str)
        {
            forward_alleles.insert(r.to_string());
        }
        if let Some(alts) = grch38
            .and_then(|v| v.get("alternates"))
            .and_then(Value::as_array)
        {
            for a in alts.iter().filter_map(Value::as_str) {
                forward_alleles.insert(a.to_string());
            }
        }
        let encoded_indel =
            locus.get("alleleEncoding").and_then(Value::as_str) == Some("insertion_deletion");
        if trait_alleles.len() != 2
            || (!encoded_indel && !trait_alleles.is_subset(&forward_alleles))
        {
            errors.push(format!(
                "{rsid}: reviewed trait allele pair is incomplete or not forward-strand"
            ));
        }
        let fwd_eff = locus.get("forwardEffectAllele").and_then(Value::as_str);
        match fwd_eff {
            None | Some("") => errors.push(format!("{rsid}: missing forward-strand effect allele")),
            Some(a) if !trait_alleles.contains(a) => errors.push(format!(
                "{rsid}: effect allele is outside the reviewed trait allele pair"
            )),
            _ => {}
        }
        if !matches!(
            locus.get("inputTransform").and_then(Value::as_str),
            Some("identity" | "complement")
        ) {
            errors.push(format!("{rsid}: unresolved literature allele orientation"));
        }
    }

    let ids: Vec<String> = traits
        .iter()
        .filter_map(|t| t.get("id").and_then(Value::as_str).map(String::from))
        .collect();
    let id_set: HashSet<String> = ids.iter().cloned().collect();
    if id_set.len() != ids.len() {
        errors.push("production catalog contains duplicate ids".to_string());
    }
    let rules = catalog
        .get("rules")
        .and_then(Value::as_object)
        .unwrap_or(&empty_map);
    let rule_ids: HashSet<String> = rules.keys().cloned().collect();
    if rule_ids != id_set {
        errors.push("production evidence ids do not match default traits".to_string());
    }

    let mut names: HashSet<(String, String)> = HashSet::new();
    for t in &traits {
        let tid = t.get("id").and_then(Value::as_str).unwrap_or("");
        let en = t
            .get("name")
            .and_then(|n| n.get("en"))
            .and_then(Value::as_str)
            .unwrap_or("");
        let zh = t
            .get("name")
            .and_then(|n| n.get("zh-CN"))
            .and_then(Value::as_str)
            .unwrap_or("");
        if tid.starts_with("gwas-") && en.contains("GWAS") {
            errors.push(format!(
                "{tid}: generated GWAS suffix must not appear in title"
            ));
        }
        if !has_cjk(zh) {
            errors.push(format!("{tid}: Chinese name is not localized"));
        }
        if zh.trim().to_lowercase() == en.trim().to_lowercase() {
            errors.push(format!("{tid}: Chinese name duplicates English"));
        }
        let desc_zh = t
            .get("description")
            .and_then(|d| d.get("zh-CN"))
            .and_then(Value::as_str)
            .unwrap_or("");
        if !has_cjk(desc_zh) {
            errors.push(format!("{tid}: Chinese description is not localized"));
        }
        let norm_name = (en.trim().to_lowercase(), zh.trim().to_string());
        if !names.insert(norm_name) {
            errors.push(format!("{tid}: duplicate normalized trait name"));
        }

        let Some(rule) = rules.get(tid) else {
            continue;
        };
        let evidence = rule
            .get("evidence")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if t.get("category").and_then(Value::as_str) == Some("risk") {
            let has_auth = evidence.iter().any(|item| {
                matches!(
                    item.get("type").and_then(Value::as_str),
                    Some("ClinVar" | "CPIC" | "PharmGKB")
                )
            });
            let has_model = rule
                .get("validated_model")
                .and_then(Value::as_object)
                .map(|m| {
                    m.get("complete").and_then(Value::as_bool) == Some(true)
                        && is_non_empty_json(m.get("source"))
                })
                .unwrap_or(false);
            if !has_auth && !has_model {
                errors.push(format!(
                    "{tid}: medical/risk rule needs ClinVar, CPIC, PharmGKB, or a complete validated model"
                ));
            }
            if !is_non_empty_json(rule.get("medical_disclaimer")) {
                errors.push(format!(
                    "{tid}: medical/risk rule needs an explicit disclaimer"
                ));
            }
        }
        if rule.get("status").and_then(Value::as_str) != Some("curated") {
            errors.push(format!("{tid}: production rule is not curated"));
        }
        if !matches!(
            rule.get("evidence_grade").and_then(Value::as_str),
            Some("A" | "B")
        ) {
            errors.push(format!("{tid}: unsupported production evidence grade"));
        }
        if !is_non_empty_json(rule.get("population_scope")) {
            errors.push(format!("{tid}: missing population scope"));
        }
        if is_non_empty_json(rule.get("review_blockers")) {
            errors.push(format!("{tid}: curated rule still has review blockers"));
        }
        if !is_non_empty_json(rule.get("limitations")) {
            errors.push(format!("{tid}: curated rule needs explicit limitations"));
        }
        if !is_non_empty_json(
            rule.get("population_scope_i18n")
                .and_then(|v| v.get("zh-CN")),
        ) {
            errors.push(format!("{tid}: missing Chinese population scope"));
        }
        if !is_non_empty_json(rule.get("limitations_i18n").and_then(|v| v.get("zh-CN"))) {
            errors.push(format!("{tid}: missing Chinese limitations"));
        }
        if evidence.is_empty() {
            errors.push(format!("{tid}: curated rule needs evidence"));
        }
        for ev in &evidence {
            for field in [
                "id",
                "url",
                "title",
                "journal",
                "year",
                "studyType",
                "supports",
            ] {
                if !is_non_empty_json(ev.get(field)) {
                    errors.push(format!("{tid}: evidence missing {field}"));
                }
            }
            if !ev.get("supports").map(Value::is_array).unwrap_or(false) {
                errors.push(format!("{tid}: evidence supports must be a list"));
            }
        }

        let supported: HashSet<String> = evidence
            .iter()
            .filter_map(|i| i.get("supports").and_then(Value::as_array))
            .flatten()
            .filter_map(Value::as_str)
            .map(String::from)
            .collect();
        let formula_maps: HashMap<String, Vec<(String, f64)>> =
            extract_formula_maps(t.get("formula").and_then(Value::as_str).unwrap_or(""))
                .into_iter()
                .collect();

        if let Some(variants) = rule.get("variants").and_then(Value::as_array) {
            for variant in variants {
                let rsid = variant.get("rsid").and_then(Value::as_str).unwrap_or("");
                if !is_valid_rsid(rsid) {
                    errors.push(format!("{tid}: invalid production RSID {rsid:?}"));
                }
                if !supported.contains(rsid) {
                    errors.push(format!("{tid}/{rsid}: no direct supporting source"));
                }
                let mapping = variant.get("genotype_map").and_then(Value::as_object);
                if mapping.map(|m| m.is_empty()).unwrap_or(true) {
                    errors.push(format!("{tid}/{rsid}: empty genotype mapping"));
                } else if !mapping_is_complete(mapping.unwrap()) {
                    errors.push(format!("{tid}/{rsid}: genotype mapping is incomplete"));
                }
                if !matches!(
                    variant.get("direction").and_then(Value::as_str),
                    Some("increase" | "decrease" | "protective" | "risk")
                ) {
                    errors.push(format!("{tid}/{rsid}: missing effect direction"));
                }
                if let Some(registered) = loci.get(rsid) {
                    let forward_set: HashSet<char> = registered
                        .get("traitAlleles")
                        .and_then(Value::as_array)
                        .map(|a| {
                            a.iter()
                                .filter_map(Value::as_str)
                                .flat_map(|s| s.chars())
                                .collect()
                        })
                        .unwrap_or_default();
                    let formula_alleles: HashSet<char> = formula_maps
                        .get(rsid)
                        .map(|entries| entries.iter().flat_map(|(gt, _)| gt.chars()).collect())
                        .unwrap_or_default();
                    if formula_alleles != forward_set {
                        errors.push(format!(
                            "{tid}/{rsid}: formula alleles do not match GRCh38 forward alleles"
                        ));
                    }
                }
            }
        }
    }

    errors.sort();
    errors.dedup();
    Ok(errors)
}

pub fn validate_candidate_manifest(
    manifest_path: &Path,
    source_path: &Path,
    repo_root: &Path,
) -> Result<Vec<String>> {
    let manifest: Value = serde_json::from_str(&fs::read_to_string(manifest_path)?)?;
    let source: Value = serde_json::from_str(&fs::read_to_string(source_path)?)?;
    let mut errors = Vec::new();

    if let Some(supp) = manifest
        .get("source")
        .and_then(|s| s.get("supplemental_discovery"))
    {
        let rel = supp.get("path").and_then(Value::as_str).unwrap_or("");
        let supp_path = repo_root.join(rel);
        if !supp_path.exists() {
            errors.push("supplemental discovery source does not exist".to_string());
        } else {
            let supp_data: Value = serde_json::from_str(&fs::read_to_string(&supp_path)?)?;
            let expected = supp.get("count").and_then(Value::as_u64);
            let actual = supp_data
                .get("traits")
                .and_then(Value::as_array)
                .map(|a| a.len() as u64);
            if expected != actual {
                errors.push(format!(
                    "supplemental discovery count mismatch: {expected:?} != {actual:?}"
                ));
            }
        }
    }

    let candidates = manifest
        .get("candidates")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let source_traits = source
        .get("traits")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if candidates.len() != source_traits.len() {
        errors.push(format!(
            "candidate count mismatch: {} != {}",
            candidates.len(),
            source_traits.len()
        ));
    }

    let source_by_id: HashMap<String, &Value> = source_traits
        .iter()
        .filter_map(|i| {
            i.get("id")
                .and_then(Value::as_str)
                .map(|s| (s.to_string(), i))
        })
        .collect();
    let cand_ids: HashSet<String> = candidates
        .iter()
        .filter_map(|i| i.get("id").and_then(Value::as_str).map(String::from))
        .collect();
    let src_ids: HashSet<String> = source_by_id.keys().cloned().collect();
    if cand_ids != src_ids {
        errors.push("manifest candidate IDs do not match the discovery source".to_string());
    }

    if manifest
        .get("counts")
        .and_then(|c| c.get("selected_candidates"))
        .and_then(Value::as_u64)
        != Some(candidates.len() as u64)
    {
        errors.push("manifest counts.selected_candidates is stale".to_string());
    }
    let supp_count = manifest
        .get("source")
        .and_then(|s| s.get("supplemental_discovery"))
        .and_then(|d| d.get("count"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    if manifest
        .get("counts")
        .and_then(|c| c.get("total_discovered"))
        .and_then(Value::as_u64)
        != Some(candidates.len() as u64 + supp_count)
    {
        errors.push("manifest counts.total_discovered is stale".to_string());
    }

    let supplemental_candidates = manifest
        .get("supplemental_candidates")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for status in ["pending", "accepted", "rejected"] {
        let count = candidates
            .iter()
            .chain(supplemental_candidates.iter())
            .filter(|i| {
                i.get("review_status")
                    .and_then(Value::as_str)
                    .unwrap_or("pending")
                    == status
            })
            .count() as u64;
        if let Some(declared) = manifest
            .get("counts")
            .and_then(|c| c.get(format!("{status}_candidates")))
            .and_then(Value::as_u64)
        {
            if declared != count {
                errors.push(format!("manifest counts.{status}_candidates is stale"));
            }
        }
    }

    for cand in &candidates {
        let cid = cand
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("<missing>");
        let status = cand
            .get("review_status")
            .and_then(Value::as_str)
            .unwrap_or("pending");
        match status {
            "pending" => {
                if cand.get("disposition").and_then(Value::as_str)
                    != Some("do_not_import_unknown_formula")
                {
                    errors.push(format!("{cid}: pending candidate must remain blocked"));
                }
                if cand.get("formula_status").and_then(Value::as_str) != Some("unknown") {
                    errors.push(format!("{cid}: pending formula_status must remain unknown"));
                }
                if cand.get("mapping_status").and_then(Value::as_str)
                    != Some("observed_only_incomplete")
                {
                    errors.push(format!(
                        "{cid}: pending mapping_status must remain incomplete"
                    ));
                }
                if !is_non_empty_json(cand.get("review_blockers")) {
                    errors.push(format!("{cid}: candidate has no review blockers"));
                }
            }
            "accepted" => {
                if cand.get("disposition").and_then(Value::as_str)
                    != Some("accepted_independent_evidence")
                {
                    errors.push(format!(
                        "{cid}: accepted candidate needs an explicit accepted disposition"
                    ));
                }
                if !is_non_empty_json(cand.get("production_trait_id")) {
                    errors.push(format!(
                        "{cid}: accepted candidate needs production_trait_id"
                    ));
                }
                if !is_non_empty_json(cand.get("evidence")) {
                    errors.push(format!(
                        "{cid}: accepted candidate needs independent evidence"
                    ));
                }
                if let Some(ev) = cand.get("evidence").and_then(Value::as_array) {
                    for item in ev {
                        if !is_non_empty_json(item.get("id")) || !is_non_empty_json(item.get("url"))
                        {
                            errors.push(format!("{cid}: accepted evidence needs id and url"));
                        }
                        if !is_non_empty_json(item.get("title"))
                            || !is_non_empty_json(item.get("year"))
                        {
                            errors.push(format!("{cid}: accepted evidence needs title and year"));
                        }
                    }
                }
                if !matches!(
                    cand.get("mapping_status").and_then(Value::as_str),
                    Some("complete" | "literature_complete")
                ) {
                    errors.push(format!(
                        "{cid}: accepted candidate needs a complete mapping"
                    ));
                }
            }
            "rejected" => {
                let disp = cand
                    .get("disposition")
                    .and_then(Value::as_str)
                    .unwrap_or("");
                if !REJECTED_DISPOSITIONS.contains(&disp) {
                    errors.push(format!(
                        "{cid}: rejected candidate needs an explicit rejection disposition"
                    ));
                }
                if !is_non_empty_json(cand.get("rejection_reason")) {
                    errors.push(format!("{cid}: rejected candidate needs rejection_reason"));
                }
                if !is_non_empty_json(cand.get("reviewed_at"))
                    || !is_non_empty_json(cand.get("reviewer"))
                {
                    errors.push(format!(
                        "{cid}: rejected candidate needs reviewer and reviewed_at"
                    ));
                }
            }
            _ => errors.push(format!("{cid}: unsupported review_status {status:?}")),
        }
        if !is_non_empty_json(cand.get("rsids")) {
            errors.push(format!("{cid}: candidate has no RSID"));
        }
        if let Some(src) = source_by_id.get(cid) {
            if cand.get("rsids") != src.get("rsids") {
                errors.push(format!(
                    "{cid}: manifest RSIDs differ from discovery source"
                ));
            }
        }
    }

    let supp_rel = manifest
        .get("source")
        .and_then(|s| s.get("supplemental_discovery"))
        .and_then(|d| d.get("path"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let supp_path = repo_root.join(supp_rel);
    let supp_source: Value = if !supplemental_candidates.is_empty() && supp_path.exists() {
        serde_json::from_str(&fs::read_to_string(&supp_path)?)?
    } else {
        json!({ "traits": [] })
    };
    let supp_by_id: HashMap<String, &Value> = supp_source
        .get("traits")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|i| {
                    i.get("id")
                        .and_then(Value::as_str)
                        .map(|s| (s.to_string(), i))
                })
                .collect()
        })
        .unwrap_or_default();
    let supp_cand_ids: HashSet<String> = supplemental_candidates
        .iter()
        .filter_map(|i| i.get("id").and_then(Value::as_str).map(String::from))
        .collect();
    let supp_src_ids: HashSet<String> = supp_by_id.keys().cloned().collect();
    if supp_cand_ids != supp_src_ids {
        errors.push("supplemental candidate IDs do not match the discovery source".to_string());
    }

    for cand in &supplemental_candidates {
        let cid = cand
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("<missing>");
        let status = cand
            .get("review_status")
            .and_then(Value::as_str)
            .unwrap_or("");
        if !matches!(status, "pending" | "accepted" | "rejected") {
            errors.push(format!("{cid}: unsupported supplemental review_status"));
        }
        if status == "rejected" {
            let disp = cand
                .get("disposition")
                .and_then(Value::as_str)
                .unwrap_or("");
            if !REJECTED_DISPOSITIONS.contains(&disp) {
                errors.push(format!(
                    "{cid}: rejected supplemental candidate needs an explicit rejection disposition"
                ));
            }
            if !is_non_empty_json(cand.get("rejection_reason")) {
                errors.push(format!(
                    "{cid}: rejected supplemental candidate needs rejection_reason"
                ));
            }
            if !is_non_empty_json(cand.get("reviewed_at"))
                || !is_non_empty_json(cand.get("reviewer"))
            {
                errors.push(format!(
                    "{cid}: rejected supplemental candidate needs reviewer and reviewed_at"
                ));
            }
        }
        if !is_non_empty_json(cand.get("rsids")) {
            errors.push(format!("{cid}: supplemental candidate has no RSID"));
        }
        if let Some(src) = supp_by_id.get(cid) {
            if cand.get("rsids") != src.get("rsids") {
                errors.push(format!(
                    "{cid}: supplemental manifest RSIDs differ from discovery source"
                ));
            }
        }
    }

    Ok(errors)
}
