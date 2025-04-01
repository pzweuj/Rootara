"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, CheckCircle, Info, ExternalLink } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import Link from "next/link"

// 模拟 ClinVar 数据
const clinvarData = {
  totalVariants: 42,
  pathogenic: 3,
  likelyPathogenic: 5,
  uncertain: 18,
  likelyBenign: 9,
  benign: 7,
  recentFindings: [
    {
      id: "rs28897696",
      gene: "BRCA2",
      condition: "Hereditary breast and ovarian cancer syndrome",
      classification: "Pathogenic",
      severity: "high",
    },
    {
      id: "rs80357711",
      gene: "BRCA1",
      condition: "Hereditary breast and ovarian cancer syndrome",
      classification: "Likely pathogenic",
      severity: "medium",
    },
    {
      id: "rs121908311",
      gene: "APOE",
      condition: "Alzheimer's disease (late onset), susceptibility to",
      classification: "Risk factor",
      severity: "medium",
    },
  ],
}

export function ClinvarSummary() {
  const { language } = useLanguage()

  const translations = {
    en: {
      clinvarAnalysis: "ClinVar Analysis",
      pathogenicVariants: "Pathogenic Variants",
      likelyPathogenic: "Likely Pathogenic",
      uncertainSignificance: "Uncertain Significance",
      likelyBenign: "Likely Benign",
      benign: "Benign",
      recentFindings: "Recent Findings",
      viewDetails: "View Details",
      totalVariants: "Total Variants Analyzed",
      gene: "Gene",
      condition: "Condition",
      classification: "Classification",
    },
    "zh-CN": {
      clinvarAnalysis: "ClinVar 分析",
      pathogenicVariants: "致病变异",
      likelyPathogenic: "可能致病",
      uncertainSignificance: "意义不明确",
      likelyBenign: "可能良性",
      benign: "良性",
      recentFindings: "最近发现",
      viewDetails: "查看详情",
      totalVariants: "分析的总变异数",
      gene: "基因",
      condition: "疾病",
      classification: "分类",
    },
  }

  const t = (key) => {
    return translations[language][key] || key
  }

  const getClassificationIcon = (classification) => {
    switch (classification) {
      case "Pathogenic":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "Likely pathogenic":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "Risk factor":
        return <Info className="h-4 w-4 text-blue-500" />
      case "Benign":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t("clinvarAnalysis")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{clinvarData.pathogenic}</div>
              <div className="text-xs text-red-600 dark:text-red-400">{t("pathogenicVariants")}</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {clinvarData.likelyPathogenic}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400">{t("likelyPathogenic")}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{clinvarData.uncertain}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">{t("uncertainSignificance")}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{clinvarData.likelyBenign}</div>
              <div className="text-xs text-green-600 dark:text-green-400">{t("likelyBenign")}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{clinvarData.benign}</div>
              <div className="text-xs text-green-600 dark:text-green-400">{t("benign")}</div>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">{t("recentFindings")}</h3>
            <div className="space-y-2">
              {clinvarData.recentFindings.map((finding) => (
                <div key={finding.id} className="border rounded-md p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getClassificationIcon(finding.classification)}
                      <span className="ml-2 font-medium text-sm">{finding.gene}</span>
                    </div>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{finding.id}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate" title={finding.condition}>
                    {finding.condition}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              {t("totalVariants")}: {clinvarData.totalVariants}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/analysis/clinvar">
                {t("viewDetails")}
                <ExternalLink className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

