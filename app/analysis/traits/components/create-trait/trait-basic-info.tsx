"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"
import type { Trait } from "@/types/trait"

interface TraitBasicInfoProps {
  trait: Partial<Trait>
  onChange: (trait: Partial<Trait>) => void
}

export function TraitBasicInfo({ trait, onChange }: TraitBasicInfoProps) {
  const { language } = useLanguage()

  const translations = {
    en: {
      traitName: "Trait Name",
      description: "Description",
      confidence: "Confidence",
      category: "Category",
      appearance: "Appearance",
      internal: "Internal",
      nutrition: "Nutrition",
      risk: "Risk",
      lifestyle: "Lifestyle",
      high: "High",
      medium: "Medium",
      low: "Low",
    },
    "zh-CN": {
      traitName: "特征名称",
      description: "描述",
      confidence: "可信度",
      category: "类别",
      appearance: "外观",
      internal: "内在",
      nutrition: "营养",
      risk: "风险",
      lifestyle: "生活",
      high: "高",
      medium: "中等",
      low: "低",
    },
  }

  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">{t("traitName")}</Label>
        <Input
          id="name"
          value={trait.name?.[language as keyof typeof trait.name] || ""}
          onChange={(e) => {
            const updatedName = { ...trait.name } as Record<string, string>
            updatedName[language] = e.target.value
            // 同时更新default字段
            updatedName.default = e.target.value
            onChange({ ...trait, name: updatedName as any })
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          className="min-h-[60px] sm:min-h-[80px] resize-none"
          value={trait.description?.[language as keyof typeof trait.description] || ""}
          onChange={(e) => {
            const updatedDescription = { ...trait.description } as Record<string, string>
            updatedDescription[language] = e.target.value
            // 同时更新default字段
            updatedDescription.default = e.target.value
            onChange({ ...trait, description: updatedDescription as any })
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2">
          <Label htmlFor="confidence">{t("confidence")}</Label>
          <Select
            value={trait.confidence}
            onValueChange={(value: "high" | "medium" | "low") => onChange({ ...trait, confidence: value })}
          >
            <SelectTrigger id="confidence">
              <SelectValue placeholder={t("confidence")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">{t("high")}</SelectItem>
              <SelectItem value="medium">{t("medium")}</SelectItem>
              <SelectItem value="low">{t("low")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">{t("category")}</Label>
          <Select value={trait.category} onValueChange={(value: any) => onChange({ ...trait, category: value })}>
            <SelectTrigger id="category">
              <SelectValue placeholder={t("category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="appearance">{t("appearance")}</SelectItem>
              <SelectItem value="internal">{t("internal")}</SelectItem>
              <SelectItem value="nutrition">{t("nutrition")}</SelectItem>
              <SelectItem value="risk">{t("risk")}</SelectItem>
              <SelectItem value="lifestyle">{t("lifestyle")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  )
}
