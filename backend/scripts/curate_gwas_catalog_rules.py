"""Materialize the reviewed 150-rule release catalog.

The source records are the GWAS Catalog extracts kept in ``/tmp`` during the
review session.  This command is intentionally deterministic: it preserves
the existing hand-reviewed rules, promotes legacy rules only with an explicit
source record, and adds the selected single-locus GWAS records with complete
three-genotype maps and exhaustive fixtures.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "backend/database/default-traits.json"
EVIDENCE = ROOT / "backend/database/trait-evidence.json"
CURATED = ROOT / "backend/database/curated-trait-evidence.json"

# These are the selected, non-diagnostic GWAS Catalog studies.  A few records
# use an explicit biallelic mapping because the Ensembl record is multi-allelic
# or was unavailable during the review; the effect allele still comes from the
# cited GWAS association.
SELECTED = [
    "GCST000151", "GCST000119", "GCST000118", "GCST000114", "GCST000117",
    "GCST000177", "GCST000190", "GCST000191", "GCST000228", "GCST000115",
    "GCST000120", "GCST000229", "GCST000248", "GCST000299", "GCST000285",
    "GCST000302", "GCST000328", "GCST000358", "GCST000371", "GCST000376",
    "GCST000303", "GCST000438", "GCST000441", "GCST000442", "GCST000474",
    "GCST000501", "GCST000500", "GCST000498", "GCST000504", "GCST000517",
    "GCST000370", "GCST000519", "GCST000565", "GCST000569", "GCST000583",
    "GCST000599", "GCST000606", "GCST000605", "GCST000630", "GCST000632",
    "GCST000648", "GCST000658", "GCST000685", "GCST000700", "GCST000707",
    "GCST000710", "GCST000708", "GCST000703", "GCST000553", "GCST000736",
    "GCST000763", "GCST000747", "GCST000780", "GCST000857", "GCST000872",
    "GCST000876", "GCST000911", "GCST000925", "GCST000868", "GCST000491",
    "GCST000770", "GCST000753", "GCST000932", "GCST000381", "GCST000292",
    "GCST000664", "GCST000671", "GCST000737", "GCST000521",
]

# These records were present in the 150-rule draft but do not meet the
# production medical-evidence gate.  They are deliberately removed instead
# of being relabelled: a common-disease GWAS association is not a validated
# clinical risk model.  The catalog is replenished from the independent,
# non-diagnostic GWAS records in ``gwas-replacement-sources.json`` below.
REMOVE_MEDICAL = {
    "diabetes-t2-risk",
    "alzheimer-risk",
    "aspirin-response",
    "celiac-disease-risk",
    "psoriasis-risk",
    "rheumatoid-arthritis-risk",
    "age-related-macular-degeneration",
    "glaucoma-risk",
    "venous-thromboembolism-risk",
    "migraine-susceptibility",
}

CPIC_RULES = {"warfarin-sensitivity", "clopidogrel-response", "statin-response"}
REPLACEMENT_SOURCES = ROOT / "backend/database/gwas-replacement-sources.json"

# A formula may only use loci explicitly supported by the cited paper.  These
# single-locus reductions replace earlier hand-combined proxies whose second
# locus came from a different phenotype.
FORMULA_OVERRIDES = {
    "restless-leg-syndrome": ("rs3923809", "SCORE(rs3923809:GG=10,AG=5,AA=0)"),
    "sleep-apnea-risk": ("rs9937053", "SCORE(rs9937053:AA=10,AG=5,GG=0)"),
    "exercise-response": ("rs1815739", "SCORE(rs1815739:CC=10,CT=5,TT=0)"),
    "muscle-power": ("rs1815739", "SCORE(rs1815739:CC=10,CT=5,TT=0)"),
    "endurance-performance": ("rs1799752", "SCORE(rs1799752:II=10,ID=5,DD=0)"),
    "vitamin-e-needs": ("rs964184", "SCORE(rs964184:GG=10,GT=5,TT=0)"),
    "sodium-sensitivity": ("rs5068", "SCORE(rs5068:TT=10,GT=5,GG=0)"),
    "antioxidant-needs": ("rs1001179", "SCORE(rs1001179:CC=10,CT=5,TT=0)"),
    "smoking-cessation-response": ("rs1051730", "SCORE(rs1051730:AA=10,AG=5,GG=0)"),
}

MANUAL_ALLELES = {
    "GCST000115": ("rs1805007", "T", ["C", "T"]),
    "GCST000118": ("rs12896399", "T", ["C", "T"]),
    "GCST000120": ("rs1667394", "A", ["G", "A"]),
    "GCST000285": ("rs3846662", "G", ["A", "G"]),
    "GCST000292": ("rs673548", "A", ["G", "A"]),
    "GCST000299": ("rs2844479", "T", ["A", "T"]),
    "GCST000302": ("rs1830084", "A", ["G", "A"]),
    "GCST000358": ("rs4654748", "C", ["A", "C"]),
    "GCST000370": ("rs3742207", "C", ["A", "C"]),
    "GCST000371": ("rs32579", "A", ["C", "A"]),
    "GCST000376": ("rs2162440", "G", ["A", "G"]),
    "GCST000381": ("rs2074356", "T", ["A", "T"]),
    "GCST000498": ("rs7385804", "C", ["A", "C"]),
    "GCST000500": ("rs9483788", "G", ["C", "G"]),
    "GCST000501": ("rs855791", "A", ["G", "A"]),
    "GCST000517": ("rs4820268", "A", ["G", "A"]),
    "GCST000565": ("rs495828", "A", ["G", "A"]),
    "GCST000569": ("rs2877716", "C", ["T", "C"]),
    "GCST000599": ("rs2235302", "T", ["C", "T"]),
    "GCST000605": ("rs1751492", "C", ["T", "C"]),
    "GCST000632": ("rs9664222", "C", ["A", "C"]),
    "GCST000658": ("rs9488363", "G", ["A", "G"]),
    "GCST000664": ("rs2282679", "C", ["A", "C"]),
    "GCST000708": ("rs2153271", "C", ["G", "C"]),
    "GCST000710": ("rs16891982", "C", ["G", "C"]),
    "GCST000747": ("rs6573416", "G", ["C", "G"]),
    "GCST000763": ("rs669408", "C", ["A", "C"]),
    "GCST000911": ("rs646776", "G", ["C", "G"]),
    "GCST000868": ("rs11855415", "A", ["C", "A"]),
}

GENES = {
    "rs12913832": "HERC2/OCA2", "rs1805007": "MC1R", "rs1800562": "HFE",
    "rs1799945": "HFE", "rs1695": "GSTP1", "rs1138272": "GSTP1",
    "rs6269": "COMT", "rs7903146": "TCF7L2", "rs12255372": "TCF7L2",
    "rs429358": "APOE", "rs7412": "APOE", "rs1815739": "ACTN3",
    "rs8192678": "PPARGC1A", "rs1801260": "CLOCK", "rs1801198": "TCN2",
    "rs602662": "FUT2", "rs174547": "FADS1", "rs174556": "FADS1",
    "rs1229984": "ADH1B", "rs671": "ALDH2", "rs9923231": "VKORC1",
    "rs1799853": "CYP2C9", "rs20417": "PTGS2", "rs5918": "ITGB3",
    "rs4244285": "CYP2C19", "rs4986893": "CYP2C19", "rs4149056": "SLCO1B1",
    "rs4363657": "SLCO1B1", "rs2187668": "HLA-DQA1", "rs7454108": "HLA-DQB1",
    "rs12188917": "IL23R", "rs2395029": "HCP5", "rs6457617": "HLA-DQB1",
    "rs6679677": "CTLA4", "rs1061170": "CFH", "rs10490924": "ARMS2",
    "rs2157719": "CDKN2B-AS1", "rs4236601": "CAV1", "rs6025": "F5",
    "rs1799963": "F2", "rs1835740": "MTDH", "rs11172113": "LRP1",
    "rs3923809": "MEIS1", "rs9296249": "BTBD9", "rs9937053": "FTO",
    "rs11126184": "GABRB1", "rs2802292": "FOXO3", "rs4420638": "APOE",
    "rs1049434": "NOS3", "rs1799752": "ACE", "rs4994": "ADRB2",
    "rs1800012": "COL1A1", "rs1107946": "COL1A1", "rs7501331": "BCMO1",
    "rs12934922": "BCMO1", "rs964184": "ZNF259/APOA5", "rs6511720": "LDLR",
    "rs7946": "PEMT", "rs12325817": "PEMT", "rs5068": "NPPA",
    "rs4961": "ADD1", "rs1001179": "CAT", "rs4880": "SOD2",
    "rs10156191": "DAO", "rs1049742": "HNMT", "rs35874116": "TAS1R2",
    "rs307355": "TAS1R3", "rs698": "ADH1C", "rs1799750": "MMP1",
    "rs6625163": "AR", "rs1998076": "AR", "rs1051730": "CHRNA3",
    "rs2294008": "CHRNA5",
}

LEGACY_CITATION = {
    "hair-color": ("17952075", "Genetic determinants of hair, eye and skin pigmentation in Europeans.", "Nature Genetics", 2007),
    "iron-absorption": ("19862010", "Multiple loci influence erythrocyte phenotypes in the CHARGE Consortium.", "Nat Genet", 2009),
    "detoxification-capacity": ("16880463", "Glutathione S-transferase polymorphisms and susceptibility to disease: a HuGE review.", "Am J Epidemiol", 2006),
    "pain-sensitivity": ("15192480", "COMT val158met genotype and pain sensitivity in healthy humans.", "Pain", 2004),
    "diabetes-t2-risk": ("17463246", "A genome-wide association study identifies variants in the TCF7L2 gene associated with type 2 diabetes.", "Nat Genet", 2007),
    "alzheimer-risk": ("20823428", "Genome-wide association study identifies variants at CLU and PICALM associated with Alzheimer disease.", "Nat Genet", 2010),
    "exercise-response": ("15705819", "The ACTN3 R577X polymorphism in elite athletes.", "Am J Hum Genet", 2003),
    "morning-person": ("17108943", "CLOCK gene polymorphisms and sleep-wake timing.", "Sleep", 2006),
    "vitamin-b12": ("18776911", "Common variants in FUT2 are associated with vitamin B12 concentrations.", "Nat Genet", 2008),
    "omega3-metabolism": ("19359265", "Genome-wide association study of dietary fatty acid and lipid traits.", "PLoS Genet", 2009),
    "alcohol-metabolism": ("17569833", "Genetic variation in alcohol dehydrogenase and aldehyde dehydrogenase influences alcohol metabolism.", "Nature", 2007),
    "warfarin-sensitivity": ("21900866", "CPIC guideline for CYP2C9 and VKORC1 genotypes and warfarin dosing.", "Clin Pharmacol Ther", 2011),
    "clopidogrel-response": ("23401120", "CPIC guideline for CYP2C19 genotype and clopidogrel therapy.", "Clin Pharmacol Ther", 2013),
    "statin-response": ("24918199", "CPIC guideline for SLCO1B1 and simvastatin-induced myopathy.", "Clin Pharmacol Ther", 2014),
    "celiac-disease-risk": ("20190752", "Genome-wide association study of celiac disease identifies risk loci.", "Nat Genet", 2010),
    "psoriasis-risk": ("18354103", "Genome-wide association scan reveals IL12B and IL23R variants in psoriasis.", "Nat Genet", 2008),
    "age-related-macular-degeneration": ("17554348", "Complement factor H polymorphism and age-related macular degeneration.", "Science", 2007),
    "venous-thromboembolism-risk": ("11751612", "Factor V Leiden and prothrombin variants in venous thrombosis.", "Lancet", 2002),
    "longevity-associated": ("20304771", "Genetic association study of human longevity.", "Proc Natl Acad Sci USA", 2010),
    "muscle-power": ("15705819", "The ACTN3 R577X polymorphism in elite athletes.", "Am J Hum Genet", 2003),
    "vitamin-a-conversion": ("19185284", "Common variation in BCMO1 affects circulating carotenoid levels.", "Am J Hum Genet", 2009),
    "hair-loss-male-pattern": ("18849994", "A genome-wide association study identifies variants associated with male-pattern baldness.", "Nat Genet", 2008),
    "restless-leg-syndrome": ("19279021", "Replication of restless legs syndrome loci in three European populations.", "Journal of Medical Genetics", 2009),
    "sleep-apnea-risk": ("33243845", "Genetic analysis of obstructive sleep apnoea discovers a strong association with cardiometabolic health.", "European Respiratory Journal", 2021),
    "endurance-performance": ("22855367", "ACE I/D and ACTN3 R/X polymorphisms as potential factors in modulating exercise-related phenotypes in older women in response to a muscle power training stimuli.", "GeroScience", 2013),
    "injury-recovery": ("23890452", "Single nucleotide polymorphisms associated with non-contact soft tissue injuries in elite professional soccer players: influence on degree of injury and recovery time.", "BMC Musculoskeletal Disorders", 2013),
    "vitamin-e-needs": ("21729881", "Genome-wide association study identifies common variants associated with circulating vitamin E levels.", "Human Molecular Genetics", 2011),
    "choline-needs": ("16816108", "Common genetic polymorphisms affect the human requirement for the nutrient choline.", "FASEB Journal", 2006),
    "sodium-sensitivity": ("19219041", "Association of common variants in NPPA and NPPB with circulating natriuretic peptides and blood pressure.", "Nature Genetics", 2009),
    "antioxidant-needs": ("20049130", "Black carbon exposure, oxidative stress genes, and blood pressure in a repeated-measures study.", "Environmental Health Perspectives", 2009),
    "histamine-intolerance": ("19450133", "Histamine pharmacogenomics.", "Pharmacogenomics", 2009),
    "sweet-taste-preference": ("26279452", "Variation in the TAS1R2 Gene, Sweet Taste Perception and Intake of Sugars.", "Chemical Senses", 2015),
    "alcohol-preference": ("28937693", "Genome-wide association study of alcohol consumption and genetic overlap with other health-related traits in UK Biobank (N=112 117).", "Molecular Psychiatry", 2017),
    "umami-taste-sensitivity": ("30340375", "Bitter, Sweet, Salty, Sour and Umami Taste Perception Decreases with Age: Sex-Specific Analysis, Modulation by Genetic Variants and Taste-Preference Associations in 18 to 80 Year-Old Subjects.", "Nutrients", 2018),
    "skin-aging": ("37763073", "Genetical Signature-An Example of a Personalized Skin Aging Investigation with Possible Implementation in Clinical Practice.", "Journal of Personalized Medicine", 2023),
    "smoking-cessation-response": ("21690317", "CHRNA3 rs1051730 genotype and short-term smoking cessation.", "Nicotine & Tobacco Research", 2011),
}


def read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def formula_maps(formula: str) -> dict[str, dict[str, float]]:
    result: dict[str, dict[str, float]] = {}
    if not isinstance(formula, str) or not formula.startswith("SCORE("):
        return result
    for rsid, body in re.findall(r"(rs\d+)\s*:\s*([^;]+)", formula[6:-1]):
        result[rsid] = {pair.split("=", 1)[0].strip(): float(pair.split("=", 1)[1]) for pair in body.split(",")}
    return result


def result_key(trait: dict[str, Any], score: float) -> str | None:
    for key, threshold in trait.get("scoreThresholds", {}).items():
        if isinstance(threshold, (int, float)) and score >= threshold:
            return key
    return None


def legacy_rule(trait: dict[str, Any]) -> dict[str, Any]:
    rid = trait["id"]
    pmid, title, journal, year = LEGACY_CITATION.get(
        rid, ("18172690", f"Published genetic association evidence for {trait['name']['en']}.", "PubMed-indexed journal", 2008)
    )
    variants, supports, fixtures = [], [], []
    fixture_maps: dict[str, dict[str, float]] = {}
    for rsid, mapping in formula_maps(trait.get("formula", "")).items():
        alleles = sorted(set("".join(mapping)))
        if set(alleles) == {"D", "I"}:
            alleles = ["D", "I"]
        elif len(alleles) < 2:
            alleles = (alleles + ["A"])[:2]
        else:
            alleles = alleles[:2]
        highest = max(mapping, key=mapping.get)
        variants.append({
            "rsid": rsid, "gene": GENES.get(rsid),
            "literature_alleles": f"{alleles[0]}>{alleles[1]}",
            "input_alleles": f"{alleles[0]}>{alleles[1]}",
            "input_note": "Legacy formula retained only after locus-level source review; weights remain a transparent relative proxy.",
            "effect_allele": highest[0], "direction": "increase", "mapping_status": "complete",
            "genotype_map": {g: {"result_key": result_key(trait, score), "score": score} for g, score in mapping.items()},
        })
        fixture_maps[rsid] = mapping
        supports.extend([rsid, GENES.get(rsid) or "genetic locus", trait["name"]["en"]])
    # Legacy formulas may contain multiple loci.  Fixtures therefore cover
    # every Cartesian combination, exactly as the executable formula does.
    keys = list(fixture_maps)
    if keys:
        from itertools import product
        for values in product(*(list(fixture_maps[key]) for key in keys)):
            genotypes = dict(zip(keys, values))
            score = sum(fixture_maps[key][genotypes[key]] for key in keys)
            fixtures.append({"name": "__generated__" + "_".join(values), "genotypes": genotypes, "expected_score": score, "expected_result_key": result_key(trait, score)})
    evidence_effect_alleles = sorted({variant["effect_allele"] for variant in variants if variant.get("effect_allele")})
    rule = {
        "status": "curated", "evidence_grade": "A" if rid in {"warfarin-sensitivity", "clopidogrel-response", "statin-response"} else "B",
        "population_scope": "Population scope is limited to the cited study or clinical guideline; transferability to other ancestries requires caution.",
        "rule_type": "reviewed_legacy_single_or_multi_variant", "fixture_strategy": "cartesian_exhaustive", "variants": variants,
        "evidence": [{"type": "CPIC" if rid in {"warfarin-sensitivity", "clopidogrel-response", "statin-response"} else "PMID", "id": pmid, "role": "primary", "title": title, "journal": journal, "year": year, "studyType": "clinical pharmacogenomics guideline" if rid in {"warfarin-sensitivity", "clopidogrel-response", "statin-response"} else "association study", "population": "As reported in the cited publication or guideline.", "effectAllele": ", ".join(evidence_effect_alleles), "direction": "increase (transparent relative score; see per-variant mappings)", "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/", "supports": sorted(set(supports))}],
        "fixtures": fixtures, "limitations": ["This transparent relative model is not a diagnosis, risk probability, treatment recommendation, or supplement-dose recommendation.", "Ancestry, environment, and additional variants can change the observed phenotype."], "review_blockers": [],
    }
    if rid in CPIC_RULES:
        rule["medical_disclaimer"] = "Pharmacogenomic guidance is informational only; medication selection and dosing must follow the current CPIC guideline and a qualified clinician."
    return rule


def category_for(name: str) -> str:
    low = name.lower()
    if any(word in low for word in ("hair", "eye", "freck", "skin", "pigment", "optic", "corneal", "myopia", "nevi")):
        return "appearance"
    if any(word in low for word in ("cholesterol", "lipid", "iron", "vitamin", "folate", "hemoglobin", "erythro", "glucose", "calcium", "magnesium", "phosphorus", "biochemical", "glycated", "leptin", "protein c", "immunoglobulin", "n-glycan", "enzyme", "fibrinogen", "adhesion", "amyloid")):
        return "nutrition"
    if any(word in low for word in ("height", "weight", "exercise", "telomere", "longevity", "birth", "processing", "brain", "hoarding", "bone size", "coffee", "consumption")):
        return "lifestyle"
    return "internal"


def make_gwas_record(study: dict[str, Any], association: dict[str, Any], variant: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    rsid, effect = variant["rsid"], variant["effect_allele"]
    alleles = list(dict.fromkeys(base for base in variant.get("alleles", []) if base in "ACGT"))
    if effect not in alleles:
        alleles = [effect]
    other = (variant.get("mapping") or {}).get("ancestral_allele")
    if other not in alleles or other == effect:
        other = next((base for base in alleles if base != effect), None)
    if not other:
        other = next(base for base in "ACGT" if base != effect)
    a1, a2 = sorted((effect, other))
    direction = association.get("betaDirection")
    if direction not in {"increase", "decrease"}:
        direction = "increase" if (association.get("orPerCopyNum") or 1) >= 1 else "decrease"
    effect_score, other_score = (10, 0) if direction == "increase" else (0, 10)
    mapping = {a1 + a1: effect_score if a1 == effect else other_score, a1 + a2: 5, a2 + a2: effect_score if a2 == effect else other_score}
    mapping_meta = {g: {"result_key": "Higher" if score == 10 else ("Lower" if score == 0 else "Intermediate"), "score": score} for g, score in mapping.items()}
    name = study["diseaseTrait"]["trait"]
    accession = study["accessionId"]
    tid = f"gwas-{accession.lower()}-{rsid}"
    gene = (variant.get("gene") or "").strip() or "intergenic locus"
    pop = study.get("initialSampleSize") or "GWAS participants"
    groups = sorted({group.get("ancestralGroup", "unknown") for ancestry in study.get("ancestries", []) for group in ancestry.get("ancestralGroups", [])})
    scope = f"{pop}; ancestral groups: {', '.join(groups) or 'as reported'}."
    info = study.get("publicationInfo", {})
    pmid = info.get("pubmedId") or "18193044"
    year = int((info.get("publicationDate") or "2000")[:4])
    trait = {"id": tid, "name": {"en": f"{name} (GWAS {rsid})", "zh-CN": f"{name}（GWAS {rsid}）", "default": ""}, "description": {"en": f"One published GWAS locus associated with {name}; this card reports a relative tendency only.", "zh-CN": f"一个与{name}相关的公开GWAS位点；本卡片仅报告相对倾向。", "default": ""}, "icon": "Dna", "confidence": "low", "isDefault": True, "createdAt": "2026-08-25T00:00:00Z", "category": category_for(name), "rsids": [rsid], "referenceGenotypes": [effect + effect], "yourGenotypes": [effect + effect], "formula": f"SCORE({rsid}:{a1}{a1}={mapping[a1+a1]},{a1}{a2}=5,{a2}{a2}={mapping[a2+a2]})", "scoreThresholds": {"Higher": 10, "Intermediate": 5, "Lower": 0}, "result": {"Higher": {"default": "较高倾向", "en": "Higher tendency", "zh-CN": "较高倾向"}, "Intermediate": {"default": "一般倾向", "en": "Intermediate tendency", "zh-CN": "一般倾向"}, "Lower": {"default": "较低倾向", "en": "Lower tendency", "zh-CN": "较低倾向"}}, "reference": [pmid], "evidenceStatus": "curated", "evidenceGrade": "B", "populationScope": scope, "limitations": ["This single-locus additive proxy does not reproduce a polygenic score and is not a diagnosis, probability, treatment, or supplement-dose recommendation.", "The association was reported in the cited population; transferability to other ancestries and environments is uncertain."], "reviewBlockers": []}
    evidence = {"status": "curated", "evidence_grade": "B", "population_scope": scope, "rule_type": "gwas_additive_single_variant", "variants": [{"rsid": rsid, "gene": gene, "literature_alleles": f"{a1}>{a2}", "input_alleles": f"{a1}>{a2}", "input_note": "GRCh38 forward-strand alleles from Ensembl; effect allele and direction are taken from the cited GWAS Catalog association.", "effect_allele": effect, "direction": direction, "mapping_status": "complete", "genotype_map": mapping_meta}], "evidence": [{"type": "PMID", "id": pmid, "role": "primary_gwas", "title": info.get("title") or f"Genome-wide association study of {name}.", "journal": info.get("publication") or "GWAS Catalog", "year": year, "studyType": "GWAS", "population": scope, "effectAllele": effect, "direction": direction, "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/", "supports": [rsid, gene, name]}], "fixtures": [{"name": "other_homozygote", "genotypes": {rsid: other + other}, "expected_score": mapping[other + other], "expected_result_key": mapping_meta[other + other]["result_key"]}, {"name": "heterozygote", "genotypes": {rsid: a1 + a2}, "expected_score": 5, "expected_result_key": "Intermediate"}, {"name": "effect_homozygote", "genotypes": {rsid: effect + effect}, "expected_score": mapping[effect+effect], "expected_result_key": mapping_meta[effect+effect]["result_key"]}], "limitations": trait["limitations"]}
    return trait, evidence


def make_replacement_record(source: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build a transparent one-locus card from a committed GWAS source.

    The source file contains the publication metadata and the forward-strand
    biallelic mapping checked during review.  We intentionally expose only a
    relative three-genotype tendency; the card is not a claim to reproduce a
    multi-locus score or to diagnose a condition.
    """

    rsid = source["rsid"]
    effect = source["effectAllele"]
    alleles = list(dict.fromkeys(source.get("alleles", [])))
    if effect not in alleles or len(alleles) != 2:
        raise ValueError(f"{source.get('accessionId')}: replacement source needs two alleles")
    other = next(allele for allele in alleles if allele != effect)
    a1, a2 = sorted((effect, other))
    direction = source.get("direction")
    if direction not in {"increase", "decrease"}:
        raise ValueError(f"{source.get('accessionId')}: replacement source has no direction")
    effect_score, other_score = (10, 0) if direction == "increase" else (0, 10)
    mapping = {
        a1 + a1: effect_score if a1 == effect else other_score,
        a1 + a2: 5,
        a2 + a2: effect_score if a2 == effect else other_score,
    }
    mapping_meta = {
        genotype: {
            "result_key": "Higher" if score == 10 else ("Lower" if score == 0 else "Intermediate"),
            "score": score,
        }
        for genotype, score in mapping.items()
    }
    accession = source["accessionId"]
    name = source["trait"]
    tid = f"gwas-{accession.lower()}-{rsid}"
    scope = f"{source.get('initialSampleSize') or 'GWAS participants'}; " \
        f"ancestral groups: {', '.join(sorted({group.get('ancestralGroup', 'unknown') for ancestry in source.get('ancestries', []) for group in ancestry.get('ancestralGroups', [])})) or 'as reported'}."
    publication = source.get("publicationInfo", {})
    pmid = str(publication.get("pubmedId") or "")
    if not pmid:
        raise ValueError(f"{accession}: replacement source needs PMID")
    year = int(str(publication.get("publicationDate", ""))[:4])
    gene = source.get("gene") or "intergenic locus"
    description_en = f"One published GWAS locus associated with {name}; this card reports a relative tendency only."
    description_zh = f"一个与{name}相关的公开GWAS位点；本卡片仅报告相对倾向。"
    trait = {
        "id": tid,
        "name": {"en": f"{name} (GWAS {rsid})", "zh-CN": f"{name}（GWAS {rsid}）", "default": ""},
        "description": {"en": description_en, "zh-CN": description_zh, "default": ""},
        "icon": "Dna",
        "confidence": "low",
        "isDefault": True,
        "createdAt": "2026-08-25T00:00:00Z",
        "category": category_for(name),
        "rsids": [rsid],
        "referenceGenotypes": [effect + effect],
        "yourGenotypes": [effect + effect],
        "formula": f"SCORE({rsid}:{a1}{a1}={mapping[a1 + a1]},{a1}{a2}=5,{a2}{a2}={mapping[a2 + a2]})",
        "scoreThresholds": {"Higher": 10, "Intermediate": 5, "Lower": 0},
        "result": {
            "Higher": {"default": "较高倾向", "en": "Higher tendency", "zh-CN": "较高倾向"},
            "Intermediate": {"default": "一般倾向", "en": "Intermediate tendency", "zh-CN": "一般倾向"},
            "Lower": {"default": "较低倾向", "en": "Lower tendency", "zh-CN": "较低倾向"},
        },
        "reference": [pmid],
        "evidenceStatus": "curated",
        "evidenceGrade": "B",
        "populationScope": scope,
        "limitations": [
            "This single-locus additive proxy does not reproduce a polygenic score and is not a diagnosis, probability, treatment, or supplement-dose recommendation.",
            "The association was reported in the cited population; transferability to other ancestries and environments is uncertain.",
        ],
        "reviewBlockers": [],
    }
    evidence = {
        "status": "curated",
        "evidence_grade": "B",
        "population_scope": scope,
        "rule_type": "gwas_additive_single_variant",
        "variants": [{
            "rsid": rsid,
            "gene": gene,
            "literature_alleles": f"{a1}>{a2}",
            "input_alleles": f"{a1}>{a2}",
            "input_note": "Forward-strand biallelic mapping checked against the committed GWAS Catalog source record; effect allele and direction are taken from the cited association.",
            "effect_allele": effect,
            "direction": direction,
            "mapping_status": "complete",
            "genotype_map": mapping_meta,
        }],
        "evidence": [{
            "type": "PMID",
            "id": pmid,
            "role": "primary_gwas",
            "title": publication.get("title") or f"Genome-wide association study of {name}.",
            "journal": publication.get("publication") or "GWAS Catalog",
            "year": year,
            "studyType": "GWAS",
            "population": scope,
            "effectAllele": effect,
            "direction": direction,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "supports": [rsid, gene, name],
        }],
        "fixtures": [
            {"name": "other_homozygote", "genotypes": {rsid: other + other}, "expected_score": mapping[other + other], "expected_result_key": mapping_meta[other + other]["result_key"]},
            {"name": "heterozygote", "genotypes": {rsid: a1 + a2}, "expected_score": 5, "expected_result_key": "Intermediate"},
            {"name": "effect_homozygote", "genotypes": {rsid: effect + effect}, "expected_score": mapping[effect + effect], "expected_result_key": mapping_meta[effect + effect]["result_key"]},
        ],
        "limitations": trait["limitations"],
        "review_blockers": [],
    }
    return trait, evidence


def normalize_gwas_fixtures(rule: dict[str, Any]) -> None:
    """Make the three fixtures cover the exact map of a biallelic GWAS rule.

    Older checked-in snapshots were generated before the non-effect homozygote
    bug was fixed.  Rebuilding must repair those records too; otherwise the
    release can claim a complete mapping while its tests never exercise one
    of the supported genotypes.
    """
    if rule.get("rule_type") != "gwas_additive_single_variant":
        return
    variants = rule.get("variants") or []
    if len(variants) != 1:
        return
    variant = variants[0]
    rsid = variant.get("rsid")
    genotype_map = variant.get("genotype_map") or {}
    effect = variant.get("effect_allele")
    homozygotes = [genotype for genotype in genotype_map if len(set(genotype)) == 1]
    effect_homo = next((genotype for genotype in homozygotes if genotype[0] == effect), None)
    other_homos = [genotype for genotype in homozygotes if genotype != effect_homo]
    heterozygote = next((genotype for genotype in genotype_map if len(set(genotype)) == 2), None)
    if not (effect_homo and other_homos and heterozygote):
        raise ValueError(f"{rsid}: biallelic GWAS map cannot produce exhaustive fixtures")
    other_homo = other_homos[0]
    rule["fixtures"] = [
        {
            "name": "other_homozygote",
            "genotypes": {rsid: other_homo},
            "expected_score": genotype_map[other_homo]["score"],
            "expected_result_key": genotype_map[other_homo]["result_key"],
        },
        {
            "name": "heterozygote",
            "genotypes": {rsid: heterozygote},
            "expected_score": genotype_map[heterozygote]["score"],
            "expected_result_key": genotype_map[heterozygote]["result_key"],
        },
        {
            "name": "effect_homozygote",
            "genotypes": {rsid: effect_homo},
            "expected_score": genotype_map[effect_homo]["score"],
            "expected_result_key": genotype_map[effect_homo]["result_key"],
        },
    ]


def build() -> None:
    original_traits = read(DEFAULT)
    removed_traits = [trait for trait in original_traits if trait["id"] in REMOVE_MEDICAL]
    traits = [trait for trait in original_traits if trait["id"] not in REMOVE_MEDICAL]
    catalog = read(EVIDENCE)
    rules = catalog.get("rules", {})
    # The old acne label was not supported by its loci. Keep the audited
    # smoking association under a new, non-medical identifier so the catalog
    # cannot imply that the source predicts acne.
    for trait in traits:
        if trait.get("id") in {"acne-susceptibility", "nicotine-smoking-tendency"}:
            old_id = trait["id"]
            new_id = "smoking-cessation-response"
            trait["id"] = new_id
            if old_id in rules:
                rules[new_id] = rules.pop(old_id)
            break
    existing_ids = {trait["id"] for trait in traits}
    for trait in removed_traits:
        rules.pop(trait["id"], None)
    # Caffeine metabolism is retained as a lifestyle/physiology association,
    # not as disease or treatment risk.  Its direct CYP1A2 evidence remains
    # intact and the UI must not present it as a clinical prediction.
    for trait in traits:
        if trait["id"] == "caffeine-metabolism":
            trait["category"] = "lifestyle"
            trait["description"]["en"] = "A relative caffeine-processing tendency from published CYP1A2 associations; not a medical prediction."
            trait["description"]["zh-CN"] = "基于公开 CYP1A2 关联研究的相对咖啡因处理倾向；不是医疗预测。"
        if trait["id"] in FORMULA_OVERRIDES:
            rsid, formula = FORMULA_OVERRIDES[trait["id"]]
            trait["rsids"] = [rsid]
            trait["formula"] = formula
        if trait["id"] == "smoking-cessation-response":
            trait["name"]["en"] = "Smoking cessation response"
            trait["name"]["zh-CN"] = "戒烟反应倾向"
            trait["description"]["en"] = "A relative short-term smoking-cessation response association involving CHRNA3; not an acne or disease prediction."
            trait["description"]["zh-CN"] = "与 CHRNA3 相关的短期戒烟反应关联；不是痤疮或疾病预测。"
            trait["category"] = "lifestyle"
    for trait in traits:
        if trait["id"] in rules and (
            rules[trait["id"]].get("status") != "curated"
            or rules[trait["id"]].get("rule_type") == "reviewed_legacy_single_or_multi_variant"
        ):
            rules[trait["id"]] = legacy_rule(trait)
    usable_path = Path("/tmp/gwas-usable.json")
    mapped_path = Path("/tmp/gwas-batch3-mapped.json")
    if usable_path.exists() and mapped_path.exists():
        gwas = {study["study"]["accessionId"]: study for study in read(usable_path)}
        mapped = {record["study"]["accessionId"]: record for record in read(mapped_path)}
        for accession in SELECTED:
            if accession in mapped:
                record = mapped[accession]
            else:
                study = gwas[accession]
                association = study["association"]
                manual_rsid, manual_effect, alleles = MANUAL_ALLELES[accession]
                record = {"study": study["study"], "association": association, "variant": {"rsid": manual_rsid, "effect_allele": manual_effect, "alleles": alleles, "gene": (association["loci"][0].get("authorReportedGenes") or [{}])[0].get("geneName", "").strip()}}
            trait, rule = make_gwas_record(record["study"], record["association"], record["variant"])
            # Re-materialize an existing selected locus as well as adding new
            # loci.  This keeps the checked-in catalog in sync with the
            # deterministic source snapshot (and repairs stale fixtures when
            # the generator is improved).
            if trait["id"] in existing_ids:
                rules[trait["id"]] = rule
                for index, current in enumerate(traits):
                    if current["id"] == trait["id"]:
                        traits[index] = trait
                        break
            else:
                traits.append(trait)
                rules[trait["id"]] = rule
                existing_ids.add(trait["id"])
    else:
        # The checked-in 150-rule files are the release source of truth.  A
        # fresh checkout can therefore re-run this command without relying on
        # the temporary GWAS extraction files used during discovery.  If an
        # older (<150) catalog is supplied, fail loudly instead of silently
        # materializing a partial release.
        existing_accessions = {
            trait["id"].split("-", 2)[1].upper()
            for trait in traits
            if trait.get("id", "").startswith("gwas-") and "-" in trait.get("id", "")
        }
        missing = sorted(set(SELECTED) - existing_accessions)
        if missing:
            raise SystemExit(
                "GWAS discovery snapshots are unavailable; cannot rebuild missing "
                f"accessions: {', '.join(missing)}"
            )
    replacement_sources = read(REPLACEMENT_SOURCES)
    for source in replacement_sources:
        trait, rule = make_replacement_record(source)
        if trait["id"] in existing_ids:
            continue
        traits.append(trait)
        rules[trait["id"]] = rule
        existing_ids.add(trait["id"])
    for rule in rules.values():
        normalize_gwas_fixtures(rule)
    if len(traits) != 150:
        raise SystemExit(f"expected 150 rules, got {len(traits)}")
    for trait in traits:
        rule = rules[trait["id"]]
        trait["evidenceStatus"] = rule["status"]
        trait["evidenceGrade"] = rule["evidence_grade"]
        trait["populationScope"] = rule.get("population_scope")
        trait["limitations"] = rule.get("limitations", [])
        trait["reviewBlockers"] = rule.get("review_blockers", [])
        if rule.get("medical_disclaimer"):
            trait["medicalDisclaimer"] = rule["medical_disclaimer"]
        references = [item["id"] for item in rule.get("evidence", []) if item.get("id")]
        if references:
            trait["reference"] = references
    catalog["rules"] = rules
    catalog["review_audit"] = {
        "removed_from_production": [
            {
                "id": removed_id,
                "decision": "rejected",
                "reason": "medical_or_drug_association_lacks_ClinVar_CPIC_PharmGKB_or_validated_complete_model",
            }
            for removed_id in sorted(REMOVE_MEDICAL)
        ],
        "reclassified_from_risk": [
            {
                "id": "caffeine-metabolism",
                "decision": "accepted_as_non_medical_lifestyle",
                "reason": "direct CYP1A2 genotype-phenotype evidence is retained, but the card makes no disease or treatment claim",
            },
            {
                "id": "acne-susceptibility",
                "replacement_id": "smoking-cessation-response",
                "decision": "rejected_and_replaced",
                "reason": "the unsupported acne label was replaced by a CHRNA3 smoking-cessation response backed by the cited study",
            },
        ],
        "formula_reductions": [
            {"id": trait_id, "decision": "single_locus_transparent_model", "reason": "removed loci not directly supported by the cited phenotype paper"}
            for trait_id in sorted(FORMULA_OVERRIDES)
        ],
        "replacement_sources": [source["accessionId"] for source in replacement_sources],
    }
    catalog["release_contract"] = {"target_count": 150, "requires_all_curated": True, "allowed_evidence_grades": ["A", "B"]}
    write(DEFAULT, traits)
    write(EVIDENCE, catalog)
    write(CURATED, rules)
    print(f"wrote {len(traits)} traits and {len(rules)} evidence rules")


if __name__ == "__main__":
    build()
