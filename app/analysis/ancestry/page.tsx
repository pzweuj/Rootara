"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
      learnMoreMethodology: "Learn More About Methodology",
    },
    "zh-CN": {
      ancestryAnalysis: "祖源分析",
      exploreGenetic: "探索您的遗传祖源并寻找DNA亲缘关系",
      ancestryComposition: "祖源构成",
      haplogroups: "单倍群",
      understandingResults: "了解您的结果",
      compositionDescription: "您的祖源构成估计了您的DNA中来自全球45多个人群的比例。",
      analysisDescription: "该分析基于将您的基因组与世界各地的参考人群进行比较。",
      learnMoreMethodology: "关于分析方法，了解更多",
      phylogeneticTree: "系统发生树",
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
                <Button variant="outline" className="w-full">
                  {t("learnMoreMethodology")}
                </Button>
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
