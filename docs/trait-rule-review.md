# Trait rule evidence review

The legacy rules in `backend/database/default-traits.json` are executable
data, not proof that the underlying interpretation is valid. Every one of the
53 rules now has a record in `backend/database/trait-evidence.json`, and the
status/grade/limitations are materialized in the default file:

- `curated`: independent literature covers the declared loci and the mapping
  has executable fixtures (6 rules).
- `partial_evidence`: at least one locus is supported, but a blocker remains
  (currently lactose tolerance because `rs182549` lacks a direct source).
- `review_required`: the mapping is copied from the legacy formula solely so
  it can be tested; no biological claim is made (32 rules).
- `do_not_import_unknown_formula`: medical/risk formulas are blocked until a
  clinically appropriate model and evidence review exists (14 rules).

`review_required`, `partial_evidence` and `do_not_import_unknown_formula`
rules remain visible for audit, but the API sets
`evaluationStatus=review_required` and withholds `result_current`. This avoids
turning generated scores into an apparently validated personal result.

For each rule, the sidecar stores every genotype used by the formula. The
`cartesian_exhaustive` fixture strategy evaluates every combination of those
genotypes, including multi-locus rules. A mapping is not promoted to
`curated` until an independent source explicitly supports each RSID, allele
orientation and phenotype direction.

The historical `eye-color` record declared `rs16891982` without using it in
the formula. It is now removed from that rule's declared inputs rather than
silently treating an unused locus as evidence; it can be re-added only with a
reviewed multi-locus model.

The 95 WeGene discoveries are kept in
`backend/database/trait-candidate-review.json`. They are all marked
`do_not_import_unknown_formula`: the public demo exposes example genotypes and
labels, but not a reproducible formula, weights, intercept, calibration
population or complete genotype mapping. A demo observation is therefore not
used as a production rule.

Run the deterministic checks from the repository root:

```bash
PYTHONPATH=backend python -m scripts.trait_rule_validation
PYTHONPATH=backend python -m scripts.candidate_review_validation
```

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
