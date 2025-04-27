"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"

export function HaplogroupDistribution() {
  const { language } = useLanguage()

  const translations = {
    en: {
      haplogroupDistribution: "Haplogroup Distribution",
      maternalLineage: "Maternal Lineage (mtDNA)",
      paternalLineage: "Paternal Lineage (Y-DNA)",
      commonHaplogroups: "Common Haplogroups",
      understandingHaplogroups: "Understanding Haplogroups",
      haplogroupDescription:
        "Haplogroups are genetic populations of people who share a common ancestor on either their maternal or paternal lines.",
      analysisDescription:
        "This analysis traces your deep ancestry by examining specific markers in your mitochondrial DNA (mtDNA) and, if applicable, your Y-chromosome DNA.",
    },
    "zh-CN": {
      haplogroupDistribution: "单倍群分布",
      maternalLineage: "母系谱系 (mtDNA)",
      paternalLineage: "父系谱系 (Y-DNA)",
      commonHaplogroups: "常见单倍群",
      understandingHaplogroups: "了解单倍群",
      haplogroupDescription: "单倍群是共享母系或父系祖先的遗传人群。",
      analysisDescription:
        "此分析通过检查您线粒体DNA（mtDNA）中的特定标记以及（如果适用）您的Y染色体DNA来追溯您的深层祖先。",
    },
  }

  const t = (key: string) => {
    return translations[language][key] || key
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t("haplogroupDistribution")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("haplogroupDescription")}</p>
        <p className="text-sm text-muted-foreground">{t("analysisDescription")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium">{t("maternalLineage")}</h3>
            <p className="text-sm">H (Common in Europe and North Africa)</p>
          </div>
          <div>
            <h3 className="text-sm font-medium">{t("paternalLineage")}</h3>
            <p className="text-sm">R1b (Common in Western Europe)</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium">{t("commonHaplogroups")}</h3>
          <ul className="list-disc list-inside text-sm">
            <li>H1, H3 (European)</li>
            <li>R1a (Eastern European, Central Asian)</li>
            <li>O2, O3 (East Asian)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
