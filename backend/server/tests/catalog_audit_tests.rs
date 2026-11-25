use rootara_server::catalog_audit::{
    audit_legacy_traits, exhaustive_score_fixtures, materialize_compatibility,
    validate_candidate_manifest, validate_catalog, validate_production_catalog_full,
};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

fn db_dir() -> PathBuf {
    repo_root().join("backend").join("database")
}

fn read_json(path: PathBuf) -> Value {
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}

#[test]
fn test_evidence_catalog_and_fixtures_are_valid() {
    let errors = validate_catalog(
        &db_dir().join("default-traits.json"),
        &db_dir().join("trait-evidence.json"),
    )
    .unwrap();
    assert!(errors.is_empty(), "errors: {errors:?}");
}

#[test]
fn test_curated_catalog_contains_independent_sources() {
    let catalog = read_json(db_dir().join("trait-evidence.json"));
    let rules = catalog["rules"].as_object().unwrap();
    let curated: Vec<&Value> = rules
        .values()
        .filter(|r| r["status"].as_str() == Some("curated"))
        .collect();
    assert_eq!(curated.len(), 152);
    for rule in curated {
        let ev = rule["evidence"].as_array().unwrap();
        assert!(!ev.is_empty());
        for item in ev {
            assert!(matches!(
                item["type"].as_str(),
                Some("PMID" | "DOI" | "ClinVar" | "CPIC" | "PharmGKB")
            ));
            assert_ne!(item["journal"].as_str(), Some("PubMed-indexed journal"));
            assert!(!item["title"]
                .as_str()
                .unwrap_or("")
                .starts_with("Published genetic association evidence"));
        }
    }
}

#[test]
fn test_every_default_rule_has_review_record_and_complete_mapping() {
    let traits_arr = read_json(db_dir().join("default-traits.json"));
    let traits: HashMap<String, &Value> = traits_arr
        .as_array()
        .unwrap()
        .iter()
        .map(|t| (t["id"].as_str().unwrap().to_string(), t))
        .collect();
    let catalog = read_json(db_dir().join("trait-evidence.json"));
    let rules = catalog["rules"].as_object().unwrap();

    let rule_ids: HashSet<String> = rules.keys().cloned().collect();
    let trait_ids: HashSet<String> = traits.keys().cloned().collect();
    assert_eq!(rule_ids, trait_ids);

    for (rule_id, _) in &traits {
        let record = &rules[rule_id];
        let variants = record["variants"].as_array().unwrap();
        assert!(!variants.is_empty());
        assert!(
            record["fixture_strategy"].as_str() == Some("cartesian_exhaustive")
                || !record["fixtures"].as_array().unwrap_or(&vec![]).is_empty()
        );
        for variant in variants {
            assert!(!variant["genotype_map"].as_object().unwrap().is_empty());
        }
    }
}

#[test]
fn test_generated_fixtures_exercise_all_formula_genotypes() {
    let traits = read_json(db_dir().join("default-traits.json"));
    let catalog = read_json(db_dir().join("trait-evidence.json"));
    let rules = catalog["rules"].as_object().unwrap();

    for trait_val in traits.as_array().unwrap() {
        let tid = trait_val["id"].as_str().unwrap();
        let record = &rules[tid];
        let fixtures = if record["fixture_strategy"].as_str() == Some("cartesian_exhaustive") {
            exhaustive_score_fixtures(trait_val)
        } else {
            record["fixtures"].as_array().cloned().unwrap_or_default()
        };
        let mut observed: HashMap<String, HashSet<String>> = HashMap::new();
        for fixture in &fixtures {
            for (rsid, gt) in fixture["genotypes"].as_object().unwrap() {
                observed
                    .entry(rsid.clone())
                    .or_default()
                    .insert(gt.as_str().unwrap().to_string());
            }
        }
        for variant in record["variants"].as_array().unwrap() {
            let rsid = variant["rsid"].as_str().unwrap();
            let expected: HashSet<String> = variant["genotype_map"]
                .as_object()
                .unwrap()
                .keys()
                .cloned()
                .collect();
            assert_eq!(observed.get(rsid).cloned().unwrap_or_default(), expected);
        }
    }
}

#[test]
fn test_production_audit_has_no_missing_references() {
    let report = audit_legacy_traits(&db_dir().join("default-traits.json")).unwrap();
    assert_eq!(report["total"], 152);
    assert!(report["missing_references"].as_array().unwrap().is_empty());
    assert!(report["placeholder_references"]
        .as_array()
        .unwrap()
        .is_empty());
    assert!(report["formula_rsid_mismatches"]
        .as_array()
        .unwrap()
        .is_empty());
}

#[test]
fn test_wegene_candidates_manifest_is_valid() {
    let errors = validate_candidate_manifest(
        &db_dir().join("trait-candidate-review.json"),
        &repo_root()
            .join("docs")
            .join("wegene-demo-priority-candidates.json"),
        &repo_root(),
    )
    .unwrap();
    assert!(errors.is_empty(), "errors: {errors:?}");
}

#[test]
fn test_candidate_review_requires_explicit_rejection_disposition() {
    let tmp = TempDir::new().unwrap();
    let mut manifest = read_json(db_dir().join("trait-candidate-review.json"));
    manifest["candidates"][0]["disposition"] = Value::String("rejected_unknown_reason".into());
    let path = tmp.path().join("manifest.json");
    fs::write(&path, serde_json::to_string(&manifest).unwrap()).unwrap();
    let errors = validate_candidate_manifest(
        &path,
        &repo_root()
            .join("docs")
            .join("wegene-demo-priority-candidates.json"),
        &repo_root(),
    )
    .unwrap();
    assert!(errors
        .iter()
        .any(|e| e.contains("explicit rejection disposition")));
}

#[test]
fn test_production_release_gate_has_exact_count_and_medical_sources() {
    let errors = validate_production_catalog_full(
        &db_dir().join("default-traits.json"),
        &db_dir().join("trait-evidence.json"),
        &db_dir().join("trait-locus-registry.json"),
        &db_dir().join("trait-catalog.json"),
        152,
    )
    .unwrap();
    assert!(errors.is_empty(), "errors: {errors:?}");

    let traits = read_json(db_dir().join("default-traits.json"));
    let evidence = read_json(db_dir().join("trait-evidence.json"));
    let arr = traits.as_array().unwrap();
    assert_eq!(arr.len(), 152);
    let risk_ids: HashSet<String> = arr
        .iter()
        .filter(|t| t["category"].as_str() == Some("risk"))
        .map(|t| t["id"].as_str().unwrap().to_string())
        .collect();
    let expected_risk: HashSet<String> = [
        "warfarin-sensitivity",
        "clopidogrel-response",
        "statin-response",
    ]
    .into_iter()
    .map(String::from)
    .collect();
    assert_eq!(risk_ids, expected_risk);

    for tid in risk_ids {
        let ev = evidence["rules"][&tid]["evidence"].as_array().unwrap();
        assert!(ev
            .iter()
            .any(|item| matches!(item["type"].as_str(), Some("ClinVar" | "CPIC" | "PharmGKB"))));
    }
}

#[test]
fn test_production_release_gate_rejects_unvalidated_risk_rule() {
    let tmp = TempDir::new().unwrap();
    let mut traits = read_json(db_dir().join("default-traits.json"));
    let mut evidence = read_json(db_dir().join("trait-evidence.json"));
    traits[0]["category"] = Value::String("risk".into());
    let tid = traits[0]["id"].as_str().unwrap().to_string();
    let filtered: Vec<Value> = evidence["rules"][&tid]["evidence"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|item| !matches!(item["type"].as_str(), Some("ClinVar" | "CPIC" | "PharmGKB")))
        .cloned()
        .collect();
    evidence["rules"][&tid]["evidence"] = Value::Array(filtered);

    let default_path = tmp.path().join("default.json");
    let evidence_path = tmp.path().join("evidence.json");
    fs::write(&default_path, serde_json::to_string(&traits).unwrap()).unwrap();
    fs::write(&evidence_path, serde_json::to_string(&evidence).unwrap()).unwrap();
    let errors = validate_production_catalog_full(
        &default_path,
        &evidence_path,
        &db_dir().join("trait-locus-registry.json"),
        &db_dir().join("trait-catalog.json"),
        152,
    )
    .unwrap();
    assert!(errors
        .iter()
        .any(|e| e.contains("needs ClinVar, CPIC, PharmGKB")));
}

#[test]
fn test_normalized_catalog_round_trips_compatibility_artifacts() {
    let document = read_json(db_dir().join("trait-catalog.json"));
    let (traits, evidence, loci) = materialize_compatibility(&document).unwrap();
    assert_eq!(
        Value::Array(traits),
        read_json(db_dir().join("default-traits.json"))
    );
    assert_eq!(evidence, read_json(db_dir().join("trait-evidence.json")));
    assert_eq!(loci, read_json(db_dir().join("trait-locus-registry.json")));
}

#[test]
fn test_registry_has_154_reviewed_forward_loci_and_rs495828_is_corrected() {
    let registry = read_json(db_dir().join("trait-locus-registry.json"));
    assert_eq!(
        registry["counts"],
        serde_json::json!({
            "expected": 154,
            "resolved": 154,
            "verified": 154,
            "conflicts": 0,
            "fetchErrors": 0,
        })
    );
    let loci = registry["loci"].as_object().unwrap();
    for locus in loci.values() {
        assert_eq!(locus["status"].as_str(), Some("verified"));
        assert!(locus["grch37"]["chromosome"].as_str().is_some());
        assert!(locus["grch37"]["position"].as_i64().is_some());
        assert!(locus["grch38"]["chromosome"].as_str().is_some());
        assert!(locus["grch38"]["position"].as_i64().is_some());
        assert_eq!(locus["traitAlleles"].as_array().unwrap().len(), 2);
        assert!(locus["sources"]["ncbi"]["url"].as_str().is_some());
        assert!(locus["sources"]["ensemblGRCh38"].as_str().is_some());
    }

    let rs495828 = &loci["rs495828"];
    assert_eq!(rs495828["grch37"]["position"], 136154867);
    assert_eq!(rs495828["grch38"]["position"], 133279294);
    assert_eq!(rs495828["inputTransform"], "complement");
    assert_eq!(rs495828["forwardEffectAllele"], "T");

    let traits = read_json(db_dir().join("default-traits.json"));
    let trait_item = traits
        .as_array()
        .unwrap()
        .iter()
        .find(|t| {
            t["rsids"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r.as_str() == Some("rs495828"))
        })
        .unwrap();
    assert_eq!(trait_item["formula"], "SCORE(rs495828:TT=10,GT=5,GG=0)");
}
