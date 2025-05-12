"use client"

import type React from "react"
import type { Trait, TraitCategory } from "@/types/trait"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Search,
  Plus,
  Trash2,
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
  Upload,
  Download,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/contexts/language-context"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import defaultTraitsData from "@/data/default-traits.json"
import { getCategoryColor, getCategoryName } from "@/lib/trait-utils"

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
      const ifMatch = trait.formula.match(/IF$$(.*?),(.*),(.*)$$/)
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
  const { t, language } = useLanguage()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<TraitCategory>("all")
  const [traits, setTraits] = useState<Trait[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [traitToDelete, setTraitToDelete] = useState<Trait | null>(null)
  const [newTrait, setNewTrait] = useState<Partial<Trait>>({
    name: { en: "", "zh-CN": "" },
    result: { en: "", "zh-CN": "" },
    description: { en: "", "zh-CN": "" },
    icon: "AlertCircle",
    confidence: "medium",
    category: "appearance",
    rsids: [],
    referenceGenotypes: [],
    yourGenotypes: [],
    formula: "",
    scoreThresholds: {},
  })
  const [rsidInput, setRsidInput] = useState("")
  const [referenceGenotypeInput, setReferenceGenotypeInput] = useState("")
  const [yourGenotypeInput, setYourGenotypeInput] = useState("")
  const [thresholdName, setThresholdName] = useState("")
  const [thresholdValue, setThresholdValue] = useState("")

  // Load traits from localStorage and default traits on component mount
  useEffect(() => {
    const loadTraits = () => {
      try {
        // Load default traits
        // 将默认特征数据转换为 Trait[] 类型
        const defaultTraits = defaultTraitsData as unknown as Trait[]

        // Load user traits from localStorage
        const savedTraits = localStorage.getItem("userTraits")
        if (savedTraits) {
          const parsedTraits = JSON.parse(savedTraits) as Trait[]
          // Combine default traits with user traits
          setTraits([...defaultTraits, ...parsedTraits])
        } else {
          setTraits(defaultTraits)
        }
      } catch (error) {
        console.error("Failed to load traits:", error)
        setTraits(defaultTraitsData as unknown as Trait[])
      }
    }

    loadTraits()
  }, [])

  // Save user traits to localStorage
  const saveUserTraits = (updatedTraits: Trait[]) => {
    try {
      // Filter out default traits before saving
      const userTraits = updatedTraits.filter((trait) => !trait.isDefault)
      localStorage.setItem("userTraits", JSON.stringify(userTraits))
    } catch (error) {
      console.error("Failed to save traits:", error)
    }
  }

  const filteredTraits = traits.filter((trait) => {
    const matchesSearch = trait.name[language as keyof typeof trait.name]
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || trait.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleTraitClick = (trait: Trait) => {
    // Navigate to trait detail page
    router.push(`/analysis/traits/${trait.id}`)
  }

  // 修改 handleCreateTrait 函数，自动计算结果
  const handleCreateTrait = () => {
    if (!newTrait.name || !newTrait.description) {
      toast.error(language === "en" ? "Please fill in all required fields" : "请填写所有必填字段")
      return
    }

    if (!newTrait.rsids || newTrait.rsids.length === 0) {
      toast.error(language === "en" ? "Please add at least one RSID" : "请至少添加一个RSID")
      return
    }

    if (!newTrait.formula) {
      toast.error(language === "en" ? "Please enter a calculation formula" : "请输入计算公式")
      return
    }

    if (!newTrait.scoreThresholds || Object.keys(newTrait.scoreThresholds).length === 0) {
      toast.error(language === "en" ? "Please add at least one score threshold" : "请至少添加一个分数阈值")
      return
    }

    // 根据公式和阈值自动计算结果
    const calculatedResult = determineResult(newTrait)

    // Create a new trait
    const id = `custom-${Date.now()}`
    const createdTrait: Trait = {
      ...(newTrait as any),
      id,
      isDefault: false,
      createdAt: new Date().toISOString(),
      result: calculatedResult,
    }

    // 设置其他语言的字段（如果为空）
    if (!createdTrait.name["zh-CN"] && language === "en") {
      createdTrait.name["zh-CN"] = createdTrait.name.en
    } else if (!createdTrait.name.en && language === "zh-CN") {
      createdTrait.name.en = createdTrait.name["zh-CN"]
    }

    if (!createdTrait.description["zh-CN"] && language === "en") {
      createdTrait.description["zh-CN"] = createdTrait.description.en
    } else if (!createdTrait.description.en && language === "zh-CN") {
      createdTrait.description.en = createdTrait.description["zh-CN"]
    }

    const updatedTraits = [...traits, createdTrait]
    setTraits(updatedTraits)
    saveUserTraits(updatedTraits)

    // 重置表单并关闭对话框
    setNewTrait({
      name: { en: "", "zh-CN": "" },
      result: { en: "", "zh-CN": "" },
      description: { en: "", "zh-CN": "" },
      icon: "AlertCircle",
      confidence: "medium",
      category: "appearance",
      rsids: [],
      referenceGenotypes: [],
      yourGenotypes: [],
      formula: "",
      scoreThresholds: {},
    })
    setRsidInput("")
    setReferenceGenotypeInput("")
    setYourGenotypeInput("")
    setThresholdName("")
    setThresholdValue("")
    setIsCreateDialogOpen(false)

    toast.success(
      language === "en"
        ? `Trait created successfully with result: ${calculatedResult.en}`
        : `特征创建成功，结果为：${calculatedResult["zh-CN"]}`,
    )
  }

  const handleDeleteTrait = () => {
    if (!traitToDelete) return

    const updatedTraits = traits.filter((trait) => trait.id !== traitToDelete.id)
    setTraits(updatedTraits)
    saveUserTraits(updatedTraits)
    setIsDeleteDialogOpen(false)
    setTraitToDelete(null)

    toast.success(language === "en" ? "Trait deleted successfully" : "特征删除成功")
  }

  const confirmDelete = (e: React.MouseEvent, trait: Trait) => {
    e.stopPropagation() // Prevent card click
    setTraitToDelete(trait)
    setIsDeleteDialogOpen(true)
  }

  // 修改 addRsidGenotype 函数
  const addRsidGenotype = () => {
    if (!rsidInput) return

    // 即使基因型是"--"也允许添加
    const refGenotype = referenceGenotypeInput || "--"
    const userGenotype = yourGenotypeInput || "--"

    setNewTrait({
      ...newTrait,
      rsids: [...(newTrait.rsids || []), rsidInput],
      referenceGenotypes: [...(newTrait.referenceGenotypes || []), refGenotype],
      yourGenotypes: [...(newTrait.yourGenotypes || []), userGenotype],
    })

    // 重置输入
    setRsidInput("")
    setReferenceGenotypeInput("")
    setYourGenotypeInput("")
  }

  const removeRsidGenotype = (index: number) => {
    const updatedRsids = [...(newTrait.rsids || [])]
    const updatedReferenceGenotypes = [...(newTrait.referenceGenotypes || [])]
    const updatedYourGenotypes = [...(newTrait.yourGenotypes || [])]

    updatedRsids.splice(index, 1)
    updatedReferenceGenotypes.splice(index, 1)
    updatedYourGenotypes.splice(index, 1)

    setNewTrait({
      ...newTrait,
      rsids: updatedRsids,
      referenceGenotypes: updatedReferenceGenotypes,
      yourGenotypes: updatedYourGenotypes,
    })
  }

  const addScoreThreshold = () => {
    if (!thresholdName || !thresholdValue) return

    const updatedThresholds = { ...(newTrait.scoreThresholds || {}) }
    updatedThresholds[thresholdName] = Number.parseInt(thresholdValue, 10)

    setNewTrait({
      ...newTrait,
      scoreThresholds: updatedThresholds,
    })

    setThresholdName("")
    setThresholdValue("")
  }

  const removeScoreThreshold = (key: string) => {
    const updatedThresholds = { ...(newTrait.scoreThresholds || {}) }
    delete updatedThresholds[key]

    setNewTrait({
      ...newTrait,
      scoreThresholds: updatedThresholds,
    })
  }

  // 修改表单部分，移除手动输入结果的字段，添加公式说明
  const localT = (key: keyof typeof translations.en) => {
    return translations[language as keyof typeof translations][key] || key
  }

  const handleImportTraits = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      toast.error(localT("noFileSelected"))
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string)
        if (!Array.isArray(jsonData)) {
          throw new Error("Uploaded file does not contain an array of traits.")
        }

        // Validate each trait object
        jsonData.forEach((trait: any) => {
          if (
            typeof trait.name !== "object" ||
            typeof trait.description !== "object" ||
            typeof trait.category !== "string" ||
            !Array.isArray(trait.rsids) ||
            !Array.isArray(trait.referenceGenotypes) ||
            !Array.isArray(trait.yourGenotypes) ||
            typeof trait.formula !== "string" ||
            typeof trait.scoreThresholds !== "object"
          ) {
            throw new Error("Invalid trait format in the uploaded file.")
          }
        })

        const importedTraits = jsonData as Trait[]
        const updatedTraits = [...traits, ...importedTraits]
        setTraits(updatedTraits)
        saveUserTraits(updatedTraits)
        toast.success(localT("importSuccess"))
      } catch (error: any) {
        console.error("Error importing traits:", error)
        toast.error(`${localT("importError")}: ${error.message}`)
      }
    }

    reader.readAsText(file)
  }

  const handleExportTraits = () => {
    const userTraits = traits.filter((trait) => !trait.isDefault)
    if (userTraits.length === 0) {
      toast.warning(localT("noCustomTraits"))
      return
    }
    const jsonString = JSON.stringify(userTraits, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "exported_traits.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(localT("exportSuccess"))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative w-full md:w-2/5">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={localT("searchTraits")}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-1 gap-2">
          <Tabs
            defaultValue="all"
            className="flex-1"
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value as TraitCategory)}
          >
            <TabsList className="w-full grid grid-cols-6">
              <TabsTrigger value="all">{localT("allCategories")}</TabsTrigger>
              <TabsTrigger value="appearance">{localT("appearance")}</TabsTrigger>
              <TabsTrigger value="sensory">{localT("sensory")}</TabsTrigger>
              <TabsTrigger value="nutrition">{localT("nutrition")}</TabsTrigger>
              <TabsTrigger value="sleep">{localT("sleep")}</TabsTrigger>
              <TabsTrigger value="cognitive">{localT("cognitive")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <input type="file" id="import-traits" className="hidden" accept=".json" onChange={handleImportTraits} />
            <Button
              variant="outline"
              size="icon"
              title={localT("importTraits")}
              onClick={() => document.getElementById("import-traits")?.click()}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" title={localT("exportTraits")} onClick={handleExportTraits}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTraits.map((trait) => {
          const IconComponent = iconMapping[trait.icon] || AlertCircle
          return (
            <Card
              key={trait.id}
              className="relative cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleTraitClick(trait)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <IconComponent className="h-5 w-5 text-primary mr-2" />
                    <CardTitle className="text-lg">{trait.name[language as keyof typeof trait.name]}</CardTitle>
                  </div>
                  <Badge className={getCategoryColor(trait.category)}>
                    {getCategoryName(trait.category, language)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="text-xl font-bold mb-1">{trait.result[language as keyof typeof trait.result]}</div>
                  <p className="text-sm text-muted-foreground">
                    {trait.description[language as keyof typeof trait.description]}
                  </p>
                </div>
              </CardContent>
              {!trait.isDefault && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-2 right-2 text-muted-foreground hover:bg-secondary"
                  onClick={(e) => confirmDelete(e, trait)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </Card>
          )
        })}

        {/* Create New Trait Card */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-dashed flex flex-col items-center justify-center"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <CardContent className="flex flex-col items-center justify-center h-full py-8">
            <Plus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-center">{localT("createNewTrait")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Trait Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{localT("createTrait")}</DialogTitle>
            <DialogDescription>
              {language === "en" ? "Fill in the details to create a new trait." : "填写详细信息以创建新特征。"}
            </DialogDescription>
          </DialogHeader>
          {/* 修改对话框内容，移除结果输入框，添加公式说明 */}
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{localT("traitName")}</Label>
              <Input
                id="name"
                value={newTrait.name?.[language as keyof typeof newTrait.name] || ""}
                onChange={(e) => {
                  const updatedName = { ...newTrait.name } as Record<string, string>
                  updatedName[language] = e.target.value
                  setNewTrait({ ...newTrait, name: updatedName as any })
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{localT("description")}</Label>
              <Textarea
                id="description"
                value={newTrait.description?.[language as keyof typeof newTrait.description] || ""}
                onChange={(e) => {
                  const updatedDescription = { ...newTrait.description } as Record<string, string>
                  updatedDescription[language] = e.target.value
                  setNewTrait({ ...newTrait, description: updatedDescription as any })
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="confidence">{localT("confidence")}</Label>
                <Select
                  value={newTrait.confidence}
                  onValueChange={(value: "high" | "medium" | "low") => setNewTrait({ ...newTrait, confidence: value })}
                >
                  <SelectTrigger id="confidence">
                    <SelectValue placeholder={localT("confidence")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{localT("category")}</Label>
                <Select
                  value={newTrait.category}
                  onValueChange={(value: any) => setNewTrait({ ...newTrait, category: value })}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder={localT("category")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appearance">{localT("appearance")}</SelectItem>
                    <SelectItem value="sensory">{localT("sensory")}</SelectItem>
                    <SelectItem value="nutrition">{localT("nutrition")}</SelectItem>
                    <SelectItem value="sleep">{localT("sleep")}</SelectItem>
                    <SelectItem value="cognitive">{localT("cognitive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label>{localT("iconSelector")}</Label>
              <div className="p-2 border rounded-md">
                <p className="text-xs text-muted-foreground mb-2">{localT("selectIcon")}</p>
                <div className="grid grid-cols-8 gap-2">
                  {Object.entries(iconMapping).map(([name, Icon]) => (
                    <Button
                      key={name}
                      type="button"
                      variant={newTrait.icon === name ? "default" : "outline"}
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setNewTrait({ ...newTrait, icon: name })}
                    >
                      <Icon className="h-5 w-5" />
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{localT("rsidsAndGenotypes")}</Label>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex gap-2">
                  <Input
                    placeholder={localT("rsidPlaceholder")}
                    value={rsidInput}
                    onChange={(e) => {
                      setRsidInput(e.target.value)
                      // 当输入RSID时的自动获取基因型逻辑
                      const input = e.target.value.trim()
                      if (input.match(/^rs\d{4,}$/)) {
                        const genotypeData = fetchGenotypeData(input)
                        if (genotypeData.reference && genotypeData.user) {
                          setReferenceGenotypeInput(genotypeData.reference)
                          setYourGenotypeInput(genotypeData.user)
                        } else {
                          // 当查询不到位点时，显示"--"
                          setReferenceGenotypeInput("--")
                          setYourGenotypeInput("--")
                        }
                      }
                    }}
                  />
                  <Button type="button" onClick={addRsidGenotype} disabled={!rsidInput}>
                    {localT("add")}
                  </Button>
                </div>

                {/* 显示当前选择的RSID的基因型信息 */}
                {rsidInput && (
                  <div className="grid grid-cols-2 gap-2 p-2 bg-secondary/30 rounded-md">
                    <div className="space-y-1">
                      <Label className="text-xs">{localT("referenceGenotype")}</Label>
                      <div className="text-sm font-mono">{referenceGenotypeInput || "--"}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{localT("yourGenotype")}</Label>
                      <div className="text-sm font-mono">{yourGenotypeInput || "--"}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Display added RSIDs and genotypes */}
              {newTrait.rsids && newTrait.rsids.length > 0 && (
                <div className="mt-2 border rounded-md p-2">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 font-medium text-sm mb-1">
                    <div>{localT("rsid")}</div>
                    <div>{localT("referenceGenotype")}</div>
                    <div>{localT("yourGenotype")}</div>
                    <div></div>
                  </div>
                  {newTrait.rsids.map((rsid, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-sm items-center">
                      <div>{rsid}</div>
                      <div>{newTrait.referenceGenotypes?.[index] || "--"}</div>
                      <div>{newTrait.yourGenotypes?.[index] || "--"}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500"
                        onClick={() => removeRsidGenotype(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="formula">{localT("formula")}</Label>
              <Textarea
                id="formula"
                placeholder="SCORE(rs12913832:GG=10,GA=5,AA=0; rs1800407:CC=5,CT=3,TT=0)"
                value={newTrait.formula || ""}
                onChange={(e) => setNewTrait({ ...newTrait, formula: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {localT("formulaDescription").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
              </p>
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">{localT("resultCalculated")}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{localT("scoreThresholds")}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={localT("thresholdNamePlaceholder")}
                  value={thresholdName}
                  onChange={(e) => setThresholdName(e.target.value)}
                />
                <Input
                  placeholder={localT("thresholdValuePlaceholder")}
                  type="number"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={addScoreThreshold}
                  disabled={!thresholdName || !thresholdValue}
                  size="sm"
                >
                  {localT("add")}
                </Button>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-xs text-muted-foreground grid grid-cols-2 w-full">
                  <span>{localT("thresholdName")}</span>
                  <span>{localT("thresholdValue")}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{localT("thresholdsDescription")}</p>

              {/* Display added score thresholds */}
              {newTrait.scoreThresholds && Object.keys(newTrait.scoreThresholds).length > 0 && (
                <div className="mt-2 border rounded-md p-2">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 font-medium text-sm mb-1">
                    <div>{localT("result")}</div>
                    <div>{localT("thresholdValue")}</div>
                    <div></div>
                  </div>
                  {Object.entries(newTrait.scoreThresholds).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[1fr_1fr_auto] gap-2 text-sm items-center">
                      <div>{key}</div>
                      <div>{value}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500"
                        onClick={() => removeScoreThreshold(key)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {localT("cancel")}
            </Button>
            <Button
              onClick={handleCreateTrait}
              disabled={
                !newTrait.name?.[language as keyof typeof newTrait.name] ||
                !newTrait.description?.[language as keyof typeof newTrait.description]
              }
            >
              {localT("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{localT("deleteConfirmation")}</DialogTitle>
            <DialogDescription>
              {localT("deleteTraitQuestion")} {localT("thisActionCannot")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {localT("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteTrait}>
              {localT("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
