"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/contexts/language-context"
import type { TraitCategory } from "@/types/trait"

const translations = {
  en: {
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
  },
  "zh-CN": {
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
  },
}

interface TraitFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCategory: TraitCategory
  onCategoryChange: (category: TraitCategory) => void
}

export function TraitFilters({ searchQuery, onSearchChange, selectedCategory, onCategoryChange }: TraitFiltersProps) {
  const { language } = useLanguage()
  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full">
      <div className="relative w-full md:w-2/5">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("searchTraits")}
          className="pl-8"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Tabs
        defaultValue="all"
        className="flex-1"
        value={selectedCategory}
        onValueChange={(value) => onCategoryChange(value as TraitCategory)}
      >
        <TabsList className="w-full grid grid-cols-6">
          <TabsTrigger value="all">{t("allCategories")}</TabsTrigger>
          <TabsTrigger value="appearance">{t("appearance")}</TabsTrigger>
          <TabsTrigger value="internal">{t("internal")}</TabsTrigger>
          <TabsTrigger value="nutrition">{t("nutrition")}</TabsTrigger>
          <TabsTrigger value="risk">{t("risk")}</TabsTrigger>
          <TabsTrigger value="lifestyle">{t("lifestyle")}</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
