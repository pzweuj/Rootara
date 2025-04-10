"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Coffee, Sun, Moon, Droplet } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useRouter } from "next/navigation"

const traits = [
  {
    id: 1,
    name: "Eye Color",
    nameZh: "眼睛颜色",
    result: "Brown",
    resultZh: "棕色",
    description: "You have genetic markers associated with brown eyes.",
    descriptionZh: "您的基因标记与棕色眼睛相关。",
    icon: Eye,
    confidence: "high",
  },
  {
    id: 2,
    name: "Caffeine Metabolism",
    nameZh: "咖啡因代谢",
    result: "Slow Metabolizer",
    resultZh: "代谢缓慢",
    description: "You may be more sensitive to caffeine's effects.",
    descriptionZh: "您可能对咖啡因的影响更敏感。",
    icon: Coffee,
    confidence: "medium",
  },
  {
    id: 3,
    name: "Sleep Patterns",
    nameZh: "睡眠模式",
    result: "Night Owl",
    resultZh: "夜猫子",
    description: "Your genetic profile suggests you may naturally prefer staying up late.",
    descriptionZh: "您的基因特征表明您可能天生喜欢熬夜。",
    icon: Moon,
    confidence: "high",
  },
  {
    id: 4,
    name: "Lactose Tolerance",
    nameZh: "乳糖耐受性",
    result: "Tolerant",
    resultZh: "耐受",
    description: "You likely maintain the ability to digest lactose into adulthood.",
    descriptionZh: "您可能保持了成年后消化乳糖的能力。",
    icon: Droplet,
    confidence: "high",
  },
  {
    id: 5,
    name: "Sun Sensitivity",
    nameZh: "阳光敏感度",
    result: "Moderate",
    resultZh: "中等",
    description: "You have a moderate genetic predisposition to sunburn.",
    descriptionZh: "您有中等程度的遗传性晒伤倾向。",
    icon: Sun,
    confidence: "medium",
  },
]

export function TraitHighlights() {
  const { language } = useLanguage()
  const router = useRouter()

  const translations = {
    en: {
      traitHighlights: "Trait Highlights",
      viewAllTraits: "View All Traits",
      highConfidence: "High confidence",
      mediumConfidence: "Medium confidence",
      lowConfidence: "Low confidence",
    },
    "zh-CN": {
      traitHighlights: "特征亮点",
      viewAllTraits: "查看所有特征",
      highConfidence: "高可信度",
      mediumConfidence: "中等可信度",
      lowConfidence: "低可信度",
    },
  }

  const t = (key: string) => {
    return translations[language as keyof typeof translations][key as keyof (typeof translations)[typeof language]] || key
  }

  const getConfidenceBadge = (confidence: "high" | "medium" | "low") => {
    const styles = {
      high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    }

    const confidenceText = {
      high: t("highConfidence"),
      medium: t("mediumConfidence"),
      low: t("lowConfidence"),
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[confidence as keyof typeof styles]}`}>
        {confidenceText[confidence as keyof typeof confidenceText]}
      </span>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t("traitHighlights")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {traits.slice(0, 3).map((trait) => (
            <div key={trait.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <trait.icon className="h-5 w-5 text-primary mr-2" />
                  <span className="font-medium">{language === "zh-CN" ? trait.nameZh : trait.name}</span>
                </div>
                {getConfidenceBadge(trait.confidence as "high" | "medium" | "low")}
              </div>
              <div>
                <p className="text-sm font-semibold">{language === "zh-CN" ? trait.resultZh : trait.result}</p>
                <p className="text-xs text-muted-foreground">
                  {language === "zh-CN" ? trait.descriptionZh : trait.description}
                </p>
              </div>
            </div>
          ))}
          <Button 
            className="w-full" 
            variant="outline" 
            onClick={() => router.push("/analysis/traits")}
          >
            {t("viewAllTraits")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

