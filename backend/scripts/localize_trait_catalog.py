"""Materialize reviewed Chinese display text for generated GWAS traits.

GWAS identifiers belong in structured source/locus fields, not in the human
trait title.  This script is deterministic and intentionally uses an explicit
reviewed glossary instead of machine translation at runtime.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TRAITS = ROOT / "backend" / "database" / "default-traits.json"
EVIDENCE = ROOT / "backend" / "database" / "trait-evidence.json"


ZH_NAMES = {
    "HDL cholesterol": "高密度脂蛋白胆固醇水平",
    "Triglycerides": "甘油三酯水平",
    "Height": "身高倾向",
    "Bone mineral density (spine)": "脊柱骨密度",
    "Bone mineral density (hip)": "髋部骨密度",
    "Male-pattern baldness": "男性型脱发倾向",
    "Carotenoid and tocopherol levels": "类胡萝卜素与生育酚水平",
    "Body mass (lean)": "瘦体重",
    "Adiposity": "体脂倾向",
    "Sphingolipid levels": "鞘脂水平",
    "Hematocrit": "红细胞压积",
    "Mean corpuscular volume": "平均红细胞体积",
    "Fibrinogen": "纤维蛋白原水平",
    "Matrix metalloproteinase levels": "基质金属蛋白酶水平",
    "PR interval": "心电图 PR 间期",
    "Fasting blood glucose": "空腹血糖水平",
    "Neutrophil count": "中性粒细胞计数",
    "Optic nerve measurement (disc area)": "视盘面积",
    "Optic nerve measurement (cup area)": "视杯面积",
    "Central corneal thickness": "中央角膜厚度",
    "Phytosterol levels": "植物甾醇水平",
    "Optic disc parameters": "视盘参数",
    "Magnesium levels": "镁水平",
    "Refractive error": "屈光误差倾向",
    "Red blood cell traits": "红细胞相关指标",
    "Atrioventricular conduction": "房室传导特征",
    "Retinal vascular caliber": "视网膜血管口径",
    "Information processing speed": "信息处理速度",
    "LDL cholesterol": "低密度脂蛋白胆固醇水平",
    "Freckles": "雀斑倾向",
    "Blond vs. brown hair color": "金发与棕发倾向",
    "Skin pigmentation": "皮肤色素沉着",
    "Blue vs. green eyes": "蓝眼与绿眼倾向",
    "YKL-40 levels": "YKL-40 水平",
    "Black vs. blond hair color": "黑发与金发倾向",
    "Black vs. red hair color": "黑发与红发倾向",
    "Vitamin B12 levels": "维生素 B12 水平",
    "Red vs non-red hair color": "红发倾向",
    "Blue vs. brown eyes": "蓝眼与棕眼倾向",
    "Hip bone size": "髋骨尺寸",
    "Liver enzyme levels": "肝酶水平",
    "Weight": "体重倾向",
    "Cholesterol, total": "总胆固醇水平",
    "Iron status biomarkers": "铁状态生物标志物",
    "Biochemical measures": "生化指标",
    "Folate pathway vitamin levels": "叶酸通路维生素水平",
    "Tanning": "晒黑倾向",
    "Telomere length": "端粒长度",
    "Glycated hemoglobin levels": "糖化血红蛋白水平",
    "Cutaneous nevi": "皮肤色素痣倾向",
    "Cardiac structure and function": "心脏结构与功能",
    "Aortic root size": "主动脉根部尺寸",
    "Leisure-time exercise behaviour": "休闲运动行为倾向",
    "Hemoglobin": "血红蛋白水平",
    "Other erythrocyte phenotypes": "其他红细胞表型",
    "Hematological parameters": "血液学指标",
    "Mean corpuscular hemoglobin": "平均红细胞血红蛋白量",
    "Iron levels": "铁水平",
    "Arterial stiffness": "动脉僵硬度",
    "Hair morphology": "头发形态",
    "Angiotensin-converting enzyme activity": "血管紧张素转换酶活性",
    "Two-hour glucose challenge": "口服葡萄糖负荷后两小时血糖",
    "Hematological and biochemical traits": "血液学与生化指标",
    "Soluble levels of adhesion molecules": "可溶性黏附分子水平",
    "E-selectin levels": "E-选择素水平",
    "Soluble leptin receptor levels": "可溶性瘦素受体水平",
    "Digit length ratio": "手指长度比例",
    "Longevity": "长寿相关倾向",
    "Birth weight": "出生体重倾向",
    "Optic nerve measurement (rim area)": "视神经盘缘面积",
    "Eye color traits": "眼睛颜色特征",
    "Vertical cup-disc ratio": "垂直杯盘比",
    "Hair color": "头发颜色倾向",
    "Eye color": "眼睛颜色倾向",
    "Freckling": "雀斑形成倾向",
    "Phosphorus levels": "磷水平",
    "CD4:CD8 lymphocyte ratio": "CD4/CD8 淋巴细胞比值",
    "Calcium levels": "钙水平",
    "Immunoglobulin A": "免疫球蛋白 A 水平",
    "Self-rated health": "自评健康倾向",
    "Protein C levels": "蛋白 C 水平",
    "Event-related brain oscillations": "事件相关脑电振荡",
    "QRS duration": "心电图 QRS 时限",
    "Amyloid A serum levels": "血清淀粉样蛋白 A 水平",
    "Progranulin levels": "颗粒蛋白前体水平",
    "N-glycan levels": "N-聚糖水平",
    "Handedness in dyslexia": "阅读障碍相关利手倾向",
    "Myopia (pathological)": "病理性近视倾向",
    "Emphysema-related traits": "肺气肿相关特征",
    "Metabolic syndrome": "代谢综合征相关倾向",
    "Hoarding": "囤积行为倾向",
    "Biomedical quantitative traits": "生物医学定量指标",
    "Metabolic traits": "代谢相关指标",
    "Vitamin D levels": "维生素 D 水平",
    "Lipoprotein-associated phospholipase A2 activity and mass": "脂蛋白相关磷脂酶 A2 活性与质量",
    "Hypertriglyceridemia": "高甘油三酯血症相关倾向",
    "Periodontitis": "牙周炎相关倾向",
    "Dehydroepiandrosterone sulphate levels": "硫酸脱氢表雄酮水平",
    "Soluble ICAM-1": "可溶性细胞间黏附分子 1 水平",
    "Thyroid volume": "甲状腺体积",
    "Urinary metabolites": "尿液代谢物水平",
    "Adiponectin levels": "脂联素水平",
    "Vitamin E levels": "维生素 E 水平",
    "Blood pressure": "血压倾向",
    "Butyrylcholinesterase levels": "丁酰胆碱酯酶水平",
    "Coffee consumption": "咖啡摄入倾向",
}


LIMITATIONS_ZH = [
    "该规则只反映所列位点的相对遗传倾向，不是临床测量、诊断、概率估计、治疗或补充剂剂量建议。",
    "该表型还受其他遗传位点、祖源和环境影响，结果向原研究人群以外推广时需谨慎。",
]


def materialize(default_path: Path = DEFAULT_TRAITS, evidence_path: Path = EVIDENCE) -> None:
    traits = json.loads(default_path.read_text(encoding="utf-8"))
    evidence_catalog = json.loads(evidence_path.read_text(encoding="utf-8"))
    rules = evidence_catalog["rules"]
    seen = set()
    for trait in traits:
        if not trait["id"].startswith("gwas-"):
            rule = rules[trait["id"]]
            rule["population_scope_i18n"] = {
                "en": rule.get("population_scope", ""),
                "zh-CN": "该规则适用于原研究或临床指南所述人群，向其他祖源人群推广时需谨慎。",
                "default": "",
            }
            rule["limitations_i18n"] = {
                "en": rule.get("limitations", []), "zh-CN": LIMITATIONS_ZH, "default": [],
            }
            continue
        english = trait["name"]["en"].rsplit(" (GWAS ", 1)[0]
        if english not in ZH_NAMES:
            raise ValueError(f"missing reviewed Chinese name: {english}")
        seen.add(english)
        chinese = ZH_NAMES[english]
        trait["name"] = {"en": english, "zh-CN": chinese, "default": ""}
        trait["description"] = {
            "en": f"A published locus associated with {english}; this card reports a relative genetic tendency only.",
            "zh-CN": f"公开研究发现一个与{chinese}相关的遗传位点；本卡片仅报告相对遗传倾向。",
            "default": "",
        }
        trait["sourceLabel"] = "GWAS"
        trait["limitationsLocalized"] = {
            "en": rules[trait["id"]].get("limitations", []),
            "zh-CN": LIMITATIONS_ZH,
            "default": [],
        }
        rule = rules[trait["id"]]
        evidence = rule.get("evidence", [{}])[0]
        direction = {"increase": "升高", "decrease": "降低", "risk": "风险升高", "protective": "保护"}.get(
            evidence.get("direction"), "相关"
        )
        gene = "/".join(sorted({item.get("gene", "") for item in rule.get("variants", []) if item.get("gene")}))
        rsids = "、".join(item.get("rsid", "") for item in rule.get("variants", []))
        rule["population_scope_i18n"] = {
            "en": rule.get("population_scope", ""),
            "zh-CN": "研究人群范围见原始论文；向不同祖源人群推广时需谨慎。",
            "default": "",
        }
        rule["limitations_i18n"] = {
            "en": rule.get("limitations", []), "zh-CN": LIMITATIONS_ZH, "default": [],
        }
        rule["evidence_summary_i18n"] = {
            "en": f"The cited study supports an association between {rsids}, {gene}, and {english}.",
            "zh-CN": f"引用研究支持 {gene} 的 {rsids} 与{chinese}相关，报告方向为{direction}。",
            "default": "",
        }
    if seen != set(ZH_NAMES):
        raise ValueError(f"unused Chinese glossary entries: {sorted(set(ZH_NAMES) - seen)}")
    default_path.write_text(json.dumps(traits, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    evidence_path.write_text(json.dumps(evidence_catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args()
    materialize()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
