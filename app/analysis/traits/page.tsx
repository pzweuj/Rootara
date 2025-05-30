"use client"

import type React from "react"
import type { Trait, TraitCategory } from "@/types/trait"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import {
  Plus,
  AlertCircle,
  Coffee,
  Moon,
  Brain,
  Music,
  Clock,
  Droplet,
  Eye,
  Scissors,
  Utensils,
  Wine,
  Heart,
  Dna,
  Leaf,
  Zap,
  Sun,
  Smile,
  Frown,
  Thermometer,
  Wind,
  Umbrella,
  Flame,
  Snowflake,
  Activity,
  Apple,
  Baby,
  Banana,
  Beef,
  Beer,
  Book,
  Braces,
  Briefcase,
  Cake,
  Camera,
  Car,
  Cat,
  ChefHat,
  Cherry,
  Cloud,
  Code,
  Compass,
  Cookie,
  Cpu,
  Crown,
  Diamond,
  Dog,
  Egg,
  Fish,
  Flower,
  Gamepad2,
  Gift,
  Glasses,
  Globe,
  Grape,
  Hammer,
  HandMetal,
  Headphones,
  Home,
  IceCream,
  Landmark,
  Lightbulb,
  Microscope,
  Mountain,
  Palette,
  Pill,
  Pizza,
  Plane,
  Rocket,
  Salad,
  Shirt,
  ShoppingBag,
  Smartphone,
  Star,
  Stethoscope,
  Syringe,
  Target,
  Tent,
  Trophy,
  Tv,
  Wheat,
  AlertTriangle,
} from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { loadAllTraits } from "@/lib/trait-utils"
import { TraitFilters } from "./components/trait-filters"
import { TraitsList } from "./components/trait-list"
import { CreateTraitDialog } from "./components/create-trait-dialog"
import { DeleteTraitDialog } from "./components/delete-trait-dialog"
import { TraitImportExport } from "./components/trait-import-export"
import { Card, CardContent } from "@/components/ui/card"
import { useReport } from "@/contexts/report-context" // 导入报告上下文

// Icon mapping for rendering
const iconMapping: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye: Eye,
  Coffee: Coffee,
  Moon: Moon,
  Droplet: Droplet,
  Brain: Brain,
  Scissors: Scissors,
  Utensils: Utensils,
  Wine: Wine,
  Clock: Clock,
  Music: Music,
  Heart: Heart,
  Dna: Dna,
  Leaf: Leaf,
  Zap: Zap,
  Sun: Sun,
  Smile: Smile,
  Frown: Frown,
  Thermometer: Thermometer,
  Wind: Wind,
  Umbrella: Umbrella,
  Flame: Flame,
  Snowflake: Snowflake,
  Activity: Activity,
  AlertCircle: AlertCircle,
  Plus: Plus,
  Apple: Apple,
  Baby: Baby,
  Banana: Banana,
  Beef: Beef,
  Beer: Beer,
  Book: Book,
  Braces: Braces,
  Briefcase: Briefcase,
  Cake: Cake,
  Camera: Camera,
  Car: Car,
  Cat: Cat,
  ChefHat: ChefHat,
  Cherry: Cherry,
  Cloud: Cloud,
  Code: Code,
  Compass: Compass,
  Cookie: Cookie,
  Cpu: Cpu,
  Crown: Crown,
  Diamond: Diamond,
  Dog: Dog,
  Egg: Egg,
  Fish: Fish,
  Flower: Flower,
  Gamepad2: Gamepad2,
  Gift: Gift,
  Glasses: Glasses,
  Globe: Globe,
  Grape: Grape,
  Hammer: Hammer,
  HandMetal: HandMetal,
  Headphones: Headphones,
  Home: Home,
  IceCream: IceCream,
  Landmark: Landmark,
  Lightbulb: Lightbulb,
  Microscope: Microscope,
  Mountain: Mountain,
  Palette: Palette,
  Pill: Pill,
  Pizza: Pizza,
  Plane: Plane,
  Rocket: Rocket,
  Salad: Salad,
  Shirt: Shirt,
  ShoppingBag: ShoppingBag,
  Smartphone: Smartphone,
  Star: Star,
  Stethoscope: Stethoscope,
  Syringe: Syringe,
  Target: Target,
  Tent: Tent,
  Trophy: Trophy,
  Tv: Tv,
  Wheat: Wheat,
}


// 添加计算特征分数的函数
const calculateTraitScore = (trait: Partial<Trait>): number => {
  if (!trait.formula || !trait.rsids || !trait.yourGenotypes) return 0

  try {
    // 解析SCORE公式
    if (trait.formula.startsWith("SCORE(") && trait.formula.endsWith(")")) {
      const formulaContent = trait.formula.substring(6, trait.formula.length - 1)
      const ruleGroups = formulaContent
        .split(";")
        .map((group) => group.trim())
        .filter((g) => g)

      let totalScore = 0

      // 处理每个RSID规则组
      for (const group of ruleGroups) {
        if (!group) continue

        const [rsidPart, scoresPart] = group.split(":").map((part) => part.trim())
        if (!rsidPart || !scoresPart) continue

        const rsid = rsidPart.trim()
        const rsidIndex = trait.rsids.findIndex((r) => r === rsid)

        if (rsidIndex === -1 || !trait.yourGenotypes[rsidIndex]) continue

        const userGenotype = trait.yourGenotypes[rsidIndex]
        const scoreRules = scoresPart.split(",").map((rule) => {
          const [genotype, scoreStr] = rule.split("=").map((r) => r.trim())
          return { genotype, score: Number.parseInt(scoreStr, 10) }
        })

        const matchingRule = scoreRules.find((rule) => rule.genotype === userGenotype)
        if (matchingRule) {
          totalScore += matchingRule.score
        }
      }

      return totalScore
    }
    // 解析IF条件公式
    else if (trait.formula.startsWith("IF(") && trait.formula.endsWith(")")) {
      const formulaContent = trait.formula.substring(3, trait.formula.length - 1)
      const parts = formulaContent.split(",").map((part) => part.trim())

      if (parts.length < 3) return 0

      // 解析条件
      const condition = parts[0]
      const trueValue = Number.parseInt(parts[1], 10)
      const falseValue = Number.parseInt(parts[2], 10)

      // 解析条件表达式，例如 "rs123=AG"
      const [rsid, expectedGenotype] = condition.split("=").map((part) => part.trim())
      const rsidIndex = trait.rsids.findIndex((r) => r === rsid)

      if (rsidIndex === -1 || !trait.yourGenotypes[rsidIndex]) return falseValue

      const userGenotype = trait.yourGenotypes[rsidIndex]
      return userGenotype === expectedGenotype ? trueValue : falseValue
    }
    // 支持组合公式：IF(condition, SCORE(...), value)
    else if (trait.formula.includes("IF(") && trait.formula.includes("SCORE(")) {
      // 提取IF条件
      const ifMatch = trait.formula.match(/IF$$(.*?),\s*(.*?),\s*(.*?)$$/)
      if (!ifMatch || ifMatch.length < 4) return 0

      const condition = ifMatch[1].trim()
      const trueExpr = ifMatch[2].trim()
      const falseExpr = ifMatch[3].trim()

      // 解析条件
      const [rsid, expectedGenotype] = condition.split("=").map((part) => part.trim())
      const rsidIndex = trait.rsids.findIndex((r) => r === rsid)

      if (rsidIndex === -1 || !trait.yourGenotypes[rsidIndex]) {
        // 条件不满足，返回falseExpr的值
        return isNaN(Number(falseExpr)) ? 0 : Number(falseExpr)
      }

      const userGenotype = trait.yourGenotypes[rsidIndex]

      if (userGenotype === expectedGenotype) {
        // 条件满足，计算trueExpr
        if (trueExpr.startsWith("SCORE(")) {
          // 递归调用计算SCORE
          const tempTrait = { ...trait, formula: trueExpr }
          return calculateTraitScore(tempTrait)
        } else {
          return isNaN(Number(trueExpr)) ? 0 : Number(trueExpr)
        }
      } else {
        // 条件不满足，返回falseExpr
        if (falseExpr.startsWith("SCORE(")) {
          // 递归调用计算SCORE
          const tempTrait = { ...trait, formula: falseExpr }
          return calculateTraitScore(tempTrait)
        } else {
          return isNaN(Number(falseExpr)) ? 0 : Number(falseExpr)
        }
      }
    }

    return 0
  } catch (error) {
    console.error("Error calculating trait score:", error)
    return 0
  }
}

// 根据分数和阈值确定结果
const determineResult = (trait: Partial<Trait>): { en: string; "zh-CN": string } => {
  if (!trait.scoreThresholds || Object.keys(trait.scoreThresholds).length === 0) {
    return { en: "", "zh-CN": "" }
  }

  const score = calculateTraitScore(trait)

  // 分离数字阈值和布尔值阈值
  const numericThresholds: [string, number][] = []
  const booleanThresholds: [string, boolean][] = []

  Object.entries(trait.scoreThresholds).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      booleanThresholds.push([key, value])
    } else {
      numericThresholds.push([key, value])
    }
  })

  // 如果有布尔值为true的阈值，优先返回它
  const trueThreshold = booleanThresholds.find(([_, value]) => value === true)
  if (trueThreshold) {
    return { en: trueThreshold[0], "zh-CN": trueThreshold[0] }
  }

  // 按分数阈值从高到低排序
  const sortedThresholds = numericThresholds.sort((a, b) => b[1] - a[1])

  // 找到第一个分数小于等于计算分数的阈值
  for (const [result, threshold] of sortedThresholds) {
    if (score >= threshold) {
      return { en: result, "zh-CN": result }
    }
  }

  // 如果没有匹配的阈值，返回分数最低的结果或第一个布尔值为false的结果
  if (sortedThresholds.length > 0) {
    const lowestResult = sortedThresholds[sortedThresholds.length - 1][0]
    return { en: lowestResult, "zh-CN": lowestResult }
  } else if (booleanThresholds.length > 0) {
    return { en: booleanThresholds[0][0], "zh-CN": booleanThresholds[0][0] }
  }

  return { en: "", "zh-CN": "" }
}

const translations = {
  en: {
    notice: "Note: These trait analyses are based on literature and user-contributed data, not clinical-grade interpretation. Results are for informational purposes only and should not be used as medical advice."
  },
  "zh-CN": {
    notice: "注意：这些特征分析基于文献和用户贡献数据，非临床级别解读。结果仅供参考，不能作为医疗建议。"
  },
}

export default function TraitsPage() {
  const { language } = useLanguage()
  const router = useRouter()
  const { currentReportId } = useReport() // 使用报告上下文获取当前报告ID
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<TraitCategory>("all")
  const [traits, setTraits] = useState<Trait[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [traitToDelete, setTraitToDelete] = useState<Trait | null>(null)

  // Load traits on component mount
  useEffect(() => {
    const loadTraitsData = async () => {
      if (currentReportId) {
        try {
          const allTraits = await loadAllTraits(currentReportId)
          setTraits(allTraits)
        } catch (error) {
          console.error("Failed to load traits:", error)
          // Fallback to empty array or show error message
          setTraits([])
        }
      }
    }

    loadTraitsData()
  }, [currentReportId])

  // Filter traits based on search query and selected category
  const filteredTraits = traits.filter((trait) => {
    const matchesSearch = trait.name[language as keyof typeof trait.name]
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || trait.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Handle trait card click - navigate to detail page
  const handleTraitClick = (trait: Trait) => {
    router.push(`/analysis/traits/${trait.id}`)
  }

  // Handle creating a new trait
  const handleCreateTrait = (newTrait: Trait) => {
    const updatedTraits = [...traits, newTrait]
    setTraits(updatedTraits)
    setIsCreateDialogOpen(false)

    toast.success(
      language === "en"
        ? `Trait created successfully with result: ${newTrait.result.en}`
        : `特征创建成功，结果为：${newTrait.result["zh-CN"]}`,
    )
  }

  // Handle deleting a trait
  const handleDeleteTrait = () => {
    if (!traitToDelete) return

    const updatedTraits = traits.filter((trait) => trait.id !== traitToDelete.id)
    setTraits(updatedTraits)
    setIsDeleteDialogOpen(false)
    setTraitToDelete(null)

    toast.success(language === "en" ? "Trait deleted successfully" : "特征删除成功")
  }

  // Open delete confirmation dialog
  const confirmDelete = (e: React.MouseEvent, trait: Trait) => {
    e.stopPropagation() // Prevent card click
    setTraitToDelete(trait)
    setIsDeleteDialogOpen(true)
  }

  // Handle importing traits
  const handleImportTraits = (importedTraits: Trait[]) => {
    const updatedTraits = [...traits, ...importedTraits]
    setTraits(updatedTraits)
  }

  return (
    <div className="space-y-6">
      <div className="flex space-x-4">
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 flex-[3]">
          <CardContent className="flex items-center space-x-4 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                {translations[language === "en" ? "en" : "zh-CN"].notice}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-[1] min-w-[200px] border-0 shadow-none">
          <CardContent className="flex items-center justify-center py-4">
            <Badge variant="outline" className="text-xs font-mono">
              {language === "en" ? "Report ID: " : "报告编号: "}
              {currentReportId}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <TraitFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        <TraitImportExport onImport={handleImportTraits} traits={traits} />
      </div>

      <TraitsList
        traits={filteredTraits}
        onTraitClick={handleTraitClick}
        onDeleteClick={confirmDelete}
        onCreateClick={() => setIsCreateDialogOpen(true)}
      />

      <CreateTraitDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateTrait={handleCreateTrait}
      />

      <DeleteTraitDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        traitToDelete={traitToDelete}
        onConfirmDelete={handleDeleteTrait}
      />
    </div>
  )
}
