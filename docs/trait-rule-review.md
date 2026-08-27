# Trait rule evidence review

The legacy rules in `backend/database/default-traits.json` are executable
data, not proof that the underlying interpretation is valid. Every shipped
rule has a record in `backend/database/trait-evidence.json`, and the
status/grade/limitations are materialized in the default file. The release
gate in `scripts.production_catalog_validation` is stricter than the audit
catalog: a production build must contain exactly 150 rules, all `curated`,
with grade A or B evidence.

- `curated`: the production release contains exactly 150 rules; every rule
  has a direct source record, complete mapping, population scope, limitations,
  and executable fixtures. Evidence grades are A/B only.
- The 108 WeGene discovery records remain rejected and are not counted as
  production rules. Legacy formulas that did not pass independent review are
  not exposed as production cards.
- Ten disease/drug-association cards that lacked ClinVar, CPIC, PharmGKB, or
  a complete validated model were rejected and replaced with ten independent
  non-diagnostic GWAS cards. Caffeine metabolism was explicitly reclassified
  as lifestyle physiology, and the former acne label was replaced by a
  CHRNA3 smoking-cessation response card. The complete decision log is in
  `trait-evidence.json.review_audit` and the generated audit report.

The API still understands `review_required` for user-defined or future
candidate rules, but the shipped default catalog contains no such entries.
This prevents generated scores from being presented as validated personal
results.

For each rule, the sidecar stores every genotype used by the formula. The
`cartesian_exhaustive` fixture strategy evaluates every combination of those
genotypes, including multi-locus rules. A mapping is not promoted to
`curated` until an independent source explicitly supports each RSID, allele
orientation and phenotype direction.

The historical `eye-color` record declared `rs16891982` without using it in
the formula. It is now removed from that rule's declared inputs rather than
silently treating an unused locus as evidence; it can be re-added only with a
reviewed multi-locus model.

The WeGene discoveries are kept in
`backend/database/trait-candidate-review.json`. The current 108 discovery
records are explicitly rejected (with reviewer, date and reason) because the
public demo exposes example genotypes and labels, but not a reproducible
formula, weights, intercept, calibration population or complete genotype
mapping. A demo observation is therefore not used as a production rule.

Candidates are reviewed independently. A reviewed candidate receives
`review_status=accepted` with `disposition=accepted_independent_evidence` only
after a direct paper supports every declared RSID and a complete Rootara-input
genotype map is recorded. Rejected candidates use an explicit disposition:
`rejected_evidence_insufficient`, `rejected_semantic_duplicate`, or
`rejected_medical_model_insufficient`; each remains in the manifest with a
reason and reviewer/date so the path to the 150-rule release is auditable.
WeGene text and results are discovery metadata, not evidence. The release gate
is open only when the exact 150-rule production catalog validator passes.

Run the deterministic checks from the repository root:

```bash
PYTHONPATH=backend python -m scripts.trait_rule_validation
PYTHONPATH=backend python -m scripts.candidate_review_validation
PYTHONPATH=backend python -m scripts.production_catalog_validation
```

The reviewed GWAS batch can be regenerated with
`PYTHONPATH=backend python -m scripts.curate_gwas_catalog_rules` when the
review-session source snapshots are available; the committed JSON files are
the release input and do not depend on a live GWAS service at runtime.
At startup the launcher persists the catalog version/hash to
`/data/config/trait-catalog.json`; readiness fails if that validated version
cannot be persisted or no longer matches the shipped files.

When a rule is manually reviewed, edit
`backend/database/curated-trait-evidence.json`, add independent PMID/DOI
records and fixtures, rebuild the aggregate catalog, then materialize the
legacy array:

```bash
PYTHONPATH=backend python -m scripts.build_trait_evidence_catalog \
  --write backend/database/trait-evidence.json
PYTHONPATH=backend python -m scripts.materialize_trait_evidence \
  --write backend/database/default-traits.json
```

Do not add a WeGene result or a guessed multi-locus weight as evidence.
