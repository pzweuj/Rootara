"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Info } from "lucide-react"
import { AncestryMap } from "@/components/ancestry-map"
import { HaplogroupDistribution } from "@/components/haplogroup-distribution"
import { useLanguage } from "@/contexts/language-context"

export default function AncestryAnalysisPage() {
  const { language } = useLanguage()

  // 添加翻译对象
  const translations = {
    en: {
      ancestryAnalysis: "Ancestry Analysis",
      exploreGenetic: "Explore your genetic ancestry and find DNA relatives",
      ancestryComposition: "Ancestry Composition",
      haplogroups: "Haplogroups",
      understandingResults: "Understanding Your Results",
      compositionDescription:
        "Your ancestry composition estimates the proportion of your DNA that comes from each of 45+ populations worldwide.",
      analysisDescription:
        "The analysis is based on comparing your genome to reference populations from around the world.",
      admixtureTechnology: "Admixture",
      admixtureTechDescription:
        "Admixture analysis uses statistical methods to estimate the proportion of your genome derived from different ancestral populations. This technique compares segments of your DNA to reference panels from diverse global populations.",
      haplogroupsExplained: "Understanding Haplogroups",
      haplogroupsExplainedDescription:
        "Haplogroups are genetic population groups that share a common ancestor. Y-DNA haplogroups trace paternal lineage (Chrom Y), while mtDNA haplogroups trace maternal lineage (Mitochondria). These markers remain relatively unchanged over generations, providing insights into ancient migration patterns.",
    },
    "zh-CN": {
      ancestryAnalysis: "祖源分析",
      exploreGenetic: "探索您的遗传祖源并寻找DNA亲缘关系",
      ancestryComposition: "祖源构成",
      haplogroups: "单倍群",
      understandingResults: "了解您的结果",
      compositionDescription: "您的祖源构成估计了您的DNA中来自全球45多个人群的比例。",
      analysisDescription: "该分析基于将您的基因组与世界各地的参考人群进行比较。",
      admixtureTechnology: "Admixture算法",
      admixtureTechDescription:
        "Admixture算法使用统计方法来估计您的基因组中源自不同祖先人群的比例。这种技术将您DNA的片段与来自全球不同人群的参考数据集进行比较。",
      haplogroupsExplained: "单倍群解析",
      haplogroupsExplainedDescription:
        "单倍群是共享共同祖先的遗传人群。Y-DNA单倍群追踪父系血统（Y染色体），而mtDNA单倍群追踪母系血统（线粒体）。这些标记在几代人中保持相对不变，提供了对古代迁徙模式的见解。",
    },
  }

  // 翻译函数
  const t = (key: keyof (typeof translations)["en"]) => {
    return translations[language][key] || key
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("ancestryAnalysis")}</h1>
          <p className="text-muted-foreground">{t("exploreGenetic")}</p>
        </div>
      </div>

      {/* 祖源构成部分 */}
      <div>
        <h2 className="text-2xl font-bold mb-4">{t("ancestryComposition")}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <AncestryMap />
          </div>
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("understandingResults")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("compositionDescription")}</p>
                <div className="flex items-start space-x-2">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <p className="text-sm">{t("analysisDescription")}</p>
                </div>

                {/* 添加 Admixture 技术介绍 */}
                <div className="pt-2">
                  <h3 className="text-sm font-medium mb-1">{t("admixtureTechnology")}</h3>
                  <p className="text-sm text-muted-foreground">{t("admixtureTechDescription")}</p>
                </div>

                {/* 添加单倍群介绍 */}
                <div className="pt-2">
                  <h3 className="text-sm font-medium mb-1">{t("haplogroupsExplained")}</h3>
                  <p className="text-sm text-muted-foreground">{t("haplogroupsExplainedDescription")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 单倍群部分 */}
      <div>
        <h2 className="text-2xl font-bold mb-4">{t("haplogroups")}</h2>
        <HaplogroupDistribution />
      </div>
    </div>
  )
}
