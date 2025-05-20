"use client"

import type React from "react"
import type { Trait, TraitCategory } from "@/types/trait"

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
} from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { loadAllTraits, saveUserTraits } from "@/lib/trait-utils"
import { TraitFilters } from "./components/trait-filters"
import { TraitsList } from "./components/trait-list"
import { CreateTraitDialog } from "./components/create-trait-dialog"
import { DeleteTraitDialog } from "./components/delete-trait-dialog"
import { TraitImportExport } from "./components/trait-import-export"

// API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_URL || "http://0.0.0.0:8000"
// API密钥
const API_KEY = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001"

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

// 修改 fetchGenotypeData 函数，增强其功能
const fetchGenotypeData = (rsid: string) => {
  // 这里应该是从基因报告中获取数据的实际逻辑
  // 目前使用模拟数据进行演示
  const mockGenotypes = {
    rs12913832: { reference: "GG", user: "AG" },
    rs1800407: { reference: "CC", user: "CT" },
    rs16891982: { reference: "CC", user: "CC" },
    rs1393350: { reference: "GG", user: "AG" },
    rs4778138: { reference: "GG", user: "AG" },
    rs683: { reference: "CC", user: "CT" },
    rs3827760: { reference: "AA", user: "AG" },
    rs11803731: { reference: "GG", user: "AG" },
    rs713598: { reference: "CC", user: "CG" },
    rs1726866: { reference: "AA", user: "AG" },
    rs10246939: { reference: "TT", user: "CT" },
    rs762551: { reference: "AA", user: "AC" },
    rs2472297: { reference: "CC", user: "CT" },
    rs4988235: { reference: "TT", user: "CT" },
    rs182549: { reference: "TT", user: "CT" },
    rs671: { reference: "GG", user: "GG" },
    rs1229984: { reference: "CC", user: "CC" },
    rs73598374: { reference: "CC", user: "CT" },
    rs5751876: { reference: "TT", user: "TC" },
    rs1801260: { reference: "CC", user: "CC" },
    rs228697: { reference: "GG", user: "GG" },
    rs6265: { reference: "GG", user: "AG" },
    rs17070145: { reference: "CC", user: "CT" },
    rs9854612: { reference: "TT", user: "CT" },
    rs4148254: { reference: "GG", user: "GA" },
  }

  if (mockGenotypes[rsid as keyof typeof mockGenotypes]) {
    return mockGenotypes[rsid as keyof typeof mockGenotypes]
  }

  // 如果找不到数据，返回空值
  return { reference: "", user: "" }
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

  // 按分数阈值从高到低排序
  const sortedThresholds = Object.entries(trait.scoreThresholds).sort((a, b) => b[1] - a[1])

  // 找到第一个分数小于等于计算分数的阈值
  for (const [result, threshold] of sortedThresholds) {
    if (score >= threshold) {
      return { en: result, "zh-CN": result }
    }
  }

  // 如果没有匹配的阈值，返回分数最低的结果
  const lowestResult = sortedThresholds[sortedThresholds.length - 1][0]
  return { en: lowestResult, "zh-CN": lowestResult }
}

const translations = {
  en: {
    traits: "Traits",
    searchTraits: "Search traits...",
    allCategories: "All",
    appearance: "Appearance",
    sensory: "Sensory",
    nutrition: "Nutrition",
    sleep: "Sleep",
    cognitive: "Cognitive",
    internal: "Internal",
    risk: "Risks",
    lifestyle: "Lifestyle",
    createNewTrait: "Create New Trait",
    createTrait: "Create Trait",
    traitName: "Trait Name",
    result: "Result",
    description: "Description",
    icon: "Icon",
    confidence: "Confidence",
    category: "Category",
    cancel: "Cancel",
    create: "Create",
    deleteConfirmation: "Delete Confirmation",
    deleteTraitQuestion: "Are you sure you want to delete this trait?",
    thisActionCannot: "This action cannot be undone.",
    delete: "Delete",
    rsid: "RSID",
    referenceGenotype: "Reference Genotype",
    yourGenotype: "Your Genotype",
    addRsid: "Add RSID",
    rsidsAndGenotypes: "RSIDs and Genotypes",
    formula: "Calculation Formula",
    formulaDescription:
      "Define how to calculate the score. Examples: SCORE(rs12913832:GG=10,GA=5,AA=0; rs1800407:CC=5,CT=3,TT=0) or IF(rs12913832=GG, 10, 0) or IF(rs12913832=GG, SCORE(rs1800407:CC=5,CT=3,TT=0), 0)",
    rsidPlaceholder: "e.g., rs12913832",
    genotypePlaceholder: "e.g., GG",
    add: "Add",
    remove: "Remove",
    scoreThresholds: "Score Thresholds",
    thresholdName: "Result Name",
    thresholdValue: "Minimum Score",
    thresholdNamePlaceholder: "e.g., Brown",
    thresholdValuePlaceholder: "e.g., 12",
    thresholdsDescription: "Define the score thresholds for different results (higher scores are checked first)",
    iconSelector: "Icon Selector",
    selectIcon: "Select an icon for your trait",
    autoFetchGenotypes: "Auto-fetch genotypes from your report",
    manualEntry: "Manual entry",
    rsidNotFound: "RSID not found in your report",
    fetchingGenotypes: "Fetching genotypes...",
    genotypesFetched: "Genotypes fetched successfully",
    resultCalculated: "Result will be automatically calculated based on formula and thresholds",
    importTraits: "Import Traits",
    exportTraits: "Export Traits",
    importSuccess: "Traits imported successfully",
    importError: "Error importing traits",
    noCustomTraits: "No custom traits to export",
    exportSuccess: "Traits exported successfully",
    noFileSelected: "No file selected",
  },
  "zh-CN": {
    traits: "特征",
    searchTraits: "搜索特征...",
    allCategories: "所有类别",
    appearance: "外观",
    sensory: "感官",
    nutrition: "营养",
    sleep: "睡眠",
    cognitive: "认知",
    internal: "内在",
    risk: "风险",
    lifestyle: "生活",
    createNewTrait: "创建新特征",
    createTrait: "创建特征",
    traitName: "特征名称",
    result: "结果",
    description: "描述",
    icon: "图标",
    confidence: "可信度",
    category: "类别",
    cancel: "取消",
    create: "创建",
    deleteConfirmation: "删除确认",
    deleteTraitQuestion: "您确定要删除这个特征吗？",
    thisActionCannot: "此操作无法撤销。",
    delete: "删除",
    rsid: "RSID",
    referenceGenotype: "参考基因型",
    yourGenotype: "您的基因型",
    addRsid: "添加RSID",
    rsidsAndGenotypes: "RSID和基因型",
    formula: "计算公式",
    formulaDescription:
      "定义如何计算分数。例如：SCORE(rs12913832:GG=10,GA=5,AA=0; rs1800407:CC=5,CT=3,TT=0) 或 IF(rs12913832=GG, 10, 0) 或 IF(rs12913832=GG, SCORE(rs1800407:CC=5,CT=3,TT=0), 0)",
    rsidPlaceholder: "例如：rs12913832",
    genotypePlaceholder: "例如：GG",
    add: "添加",
    remove: "移除",
    scoreThresholds: "分数阈值",
    thresholdName: "结果名称",
    thresholdValue: "最小分数",
    thresholdNamePlaceholder: "例如：棕色",
    thresholdValuePlaceholder: "例如：12",
    thresholdsDescription: "定义不同结果的分数阈值（先检查较高的分数）",
    iconSelector: "图标选择器",
    selectIcon: "为您的特征选择一个图标",
    autoFetchGenotypes: "从您的报告中自动获取基因型",
    manualEntry: "手动输入",
    rsidNotFound: "在您的报告中找不到此RSID",
    fetchingGenotypes: "正在获取基因型...",
    genotypesFetched: "基因型获取成功",
    resultCalculated: "结果将根据公式和阈值自动计算",
    importTraits: "导入特征",
    exportTraits: "导出特征",
    importSuccess: "特征导入成功",
    importError: "导入特征时出错",
    noCustomTraits: "没有自定义特征可导出",
    exportSuccess: "特征导出成功",
    noFileSelected: "未选择文件",
  },
}

export default function TraitsPage() {
  const { language } = useLanguage()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<TraitCategory>("all")
  const [traits, setTraits] = useState<Trait[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [traitToDelete, setTraitToDelete] = useState<Trait | null>(null)

  // Load traits on component mount
  useEffect(() => {
    const allTraits = loadAllTraits()
    setTraits(allTraits)
  }, [])

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
    saveUserTraits(updatedTraits)
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
    saveUserTraits(updatedTraits)
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
    saveUserTraits(updatedTraits)
  }

  return (
    <div className="space-y-6">
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
