"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useRouter } from "next/navigation"
import { useReport } from "@/contexts/report-context"
import type { Trait } from "@/types/trait"

const iconNames = [
  "Plus", "AlertCircle", "Coffee", "Moon", "Brain", "Music", "Clock", "Droplet",
  "Eye", "Scissors", "Utensils", "Wine", "Heart", "Dna", "Leaf", "Zap", "Sun",
  "Smile", "Frown", "Thermometer", "Wind", "Umbrella", "Flame", "Snowflake",
  "Activity", "Apple", "Baby", "Banana", "Beef", "Beer", "Book", "Braces",
  "Briefcase", "Cake", "Camera", "Car", "Cat", "ChefHat", "Cherry", "Cloud",
  "Code", "Compass", "Cookie", "Cpu", "Crown", "Diamond", "Dog", "Egg", "Fish",
  "Flower", "Gamepad2", "Gift", "Glasses", "Globe", "Grape", "Hammer", "HandMetal",
  "Headphones", "Home", "IceCream", "Landmark", "Lightbulb", "Microscope", "Mountain",
  "Palette", "Pill", "Pizza", "Plane", "Rocket", "Salad", "Shirt", "ShoppingBag",
  "Smartphone", "Star", "Stethoscope", "Syringe", "Target", "Tent", "Trophy",
  "Tv", "Wheat", "AlertTriangle", "Milk", "Paw", "Pencil", "Pig", "PizzaSlice",
  "Poo", "QuestionMark", "Ribbon", "Shield", "Shirt2", "Socks", "Star2", "Truck",
  "Wifi",
];

// 创建动态组件
const dynamicIcons: Record<string, React.ComponentType<{ className?: string }>> = {};

iconNames.forEach((name) => {
  // 使用类型断言确保类型正确
  dynamicIcons[name] = dynamic(
    async (): Promise<{ default: React.ComponentType<{ className?: string }> }> => {
      const module = await import("lucide-react");
      const Icon = module[name as keyof typeof module];
      // 确保返回的Icon组件符合ComponentType<{ className?: string }> 类型
      return {
        default: Icon as React.ComponentType<{ className?: string }>
      };
    },
    { ssr: false }
  ) as React.ComponentType<{ className?: string }>;
});

export function TraitHighlights() {
  const { language } = useLanguage()
  const router = useRouter()
  const { currentReportId } = useReport()
  const [traits, setTraits] = useState<Trait[]>([])
  const [loading, setLoading] = useState(true)

  // 随机选择特征的函数
  const getRandomTraits = (allTraits: Trait[], count: number = 4): Trait[] => {
    const shuffled = [...allTraits].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  }

  // 从API加载特征数据
  useEffect(() => {
    const loadTraits = async () => {
      if (!currentReportId) return

      try {
        setLoading(true)
        const response = await fetch('/api/traits/info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ report_id: currentReportId })
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        // 随机选择4个特征
        const randomTraits = getRandomTraits(data, 4)
        setTraits(randomTraits)
      } catch (error) {
        console.error("Failed to load traits:", error)
        setTraits([])
      } finally {
        setLoading(false)
      }
    }

    loadTraits()
  }, [currentReportId])

  const translations = {
    en: {
      traitHighlights: "Trait Highlights",
      viewAllTraits: "View All Traits",
      highConfidence: "High confidence",
      mediumConfidence: "Medium confidence",
      lowConfidence: "Low confidence",
      loading: "Loading traits...",
      noTraits: "No traits available",
    },
    "zh-CN": {
      traitHighlights: "特征亮点",
      viewAllTraits: "查看所有特征",
      highConfidence: "高可信度",
      mediumConfidence: "中等可信度",
      lowConfidence: "低可信度",
      loading: "正在加载特征...",
      noTraits: "暂无特征数据",
    },
  }

  const t = (key: string) => {
    return (
      translations[language as keyof typeof translations][key as keyof (typeof translations)[typeof language]] || key
    )
  }

  // 辅助函数：获取多语言字段的文本
  const getLocalizedText = (field: { en: string; "zh-CN": string; default: string } | undefined, fallback: string = "N/A"): string => {
    if (!field) return fallback
    return field[language as keyof typeof field] || field.default || fallback
  }

  // 辅助函数：从result Record中获取第一个结果的文本
  const getResultText = (result: Record<string, { en: string; "zh-CN": string; default: string }> | undefined): string => {
    if (!result) return "N/A"
    const firstKey = Object.keys(result)[0]
    if (!firstKey) return "N/A"
    const firstResult = result[firstKey]
    return getLocalizedText(firstResult, "N/A")
  }

  // 辅助函数：获取图标组件
  const getIconComponent = (iconName: string): React.ComponentType<{ className?: string }> => {
    // 如果图标名称在动态图标中存在，返回对应的组件
    if (dynamicIcons[iconName]) {
      return dynamicIcons[iconName]
    }
    // 如果不存在，返回默认的AlertCircle图标
    return dynamicIcons["AlertCircle"] || (() => <div className="w-2 h-2 bg-primary rounded-full" />)
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

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">{t("traitHighlights")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">{t("loading")}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 如果没有特征数据，显示空状态
  if (traits.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">{t("traitHighlights")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">{t("noTraits")}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t("traitHighlights")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {traits.map((trait) => {
            const IconComponent = getIconComponent(trait.icon)
            return (
              <div key={trait.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-5 w-5 text-primary mr-2 flex items-center justify-center">
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <span className="font-medium">
                      {getLocalizedText(trait.name, "Unknown Trait")}
                    </span>
                  </div>
                  {getConfidenceBadge(trait.confidence)}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {getLocalizedText(trait.result_current) || getResultText(trait.result)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getLocalizedText(trait.description, "No description available")}
                  </p>
                </div>
              </div>
            )
          })}
          <Button className="w-full" variant="outline" onClick={() => router.push("/analysis/traits")}>
            {t("viewAllTraits")}
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
