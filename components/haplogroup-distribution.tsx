"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"

export function HaplogroupDistribution() {
  const { language } = useLanguage()

  const translations = {
    en: {
      haplogroupDistribution: "Haplogroup Distribution",
      maternalLine: "Maternal Line (mtDNA)",
      paternalLine: "Paternal Line (Y-DNA)",
      noDataAvailable: "No data available for haplogroup distribution.",
    },
    "zh-CN": {
      haplogroupDistribution: "单倍群分布",
      maternalLine: "母系 (mtDNA)",
      paternalLine: "父系 (Y-DNA)",
      noDataAvailable: "没有可用的单倍群分布数据。",
    },
  }

  const t = (key: string) => {
    return translations[language][key] || key
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("haplogroupDistribution")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("noDataAvailable")}</p>
        {/* You can add a visualization or more detailed information here */}
      </CardContent>
    </Card>
  )
}
