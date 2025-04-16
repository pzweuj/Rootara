"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { Badge } from "@/components/ui/badge"
import { Dna } from "lucide-react"

// 简化的单倍群数据
const haplogroupData = {
  yDna: { haplogroup: "R1b", description: "Most common in Western Europe" },
  mtdna: { haplogroup: "H", description: "Most common in Europe" },
}

export function HaplogroupDistribution() {
  const { language } = useLanguage()

  const translations = {
    en: {
      yDnaHaplogroup: "Y-DNA Haplogroup",
      mtdnaHaplogroup: "mtDNA Haplogroup",
      paternalLineage: "Paternal Lineage",
      maternalLineage: "Maternal Lineage",
      description: "Description",
    },
    "zh-CN": {
      yDnaHaplogroup: "Y-DNA 单倍群",
      mtdnaHaplogroup: "mtDNA 单倍群",
      paternalLineage: "父系遗传",
      maternalLineage: "母系遗传",
      description: "描述",
    },
  }

  const t = (key: string) => {
    return translations[language][key] || key
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="overflow-hidden border-2 border-blue-100 dark:border-blue-900">
        <CardHeader className="bg-blue-50 dark:bg-blue-900/30 pb-2">
          <CardTitle className="flex items-center text-lg font-medium text-blue-700 dark:text-blue-300">
            <Dna className="mr-2 h-5 w-5" />
            {t("yDnaHaplogroup")}
            <Badge className="ml-auto bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {t("paternalLineage")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col items-center text-center">
            <div className="text-4xl font-bold mb-2 text-blue-600 dark:text-blue-400">
              {haplogroupData.yDna.haplogroup}
            </div>
            <p className="text-sm text-muted-foreground">{haplogroupData.yDna.description}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-2 border-pink-100 dark:border-pink-900">
        <CardHeader className="bg-pink-50 dark:bg-pink-900/30 pb-2">
          <CardTitle className="flex items-center text-lg font-medium text-pink-700 dark:text-pink-300">
            <Dna className="mr-2 h-5 w-5" />
            {t("mtdnaHaplogroup")}
            <Badge className="ml-auto bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">
              {t("maternalLineage")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col items-center text-center">
            <div className="text-4xl font-bold mb-2 text-pink-600 dark:text-pink-400">
              {haplogroupData.mtdna.haplogroup}
            </div>
            <p className="text-sm text-muted-foreground">{haplogroupData.mtdna.description}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
