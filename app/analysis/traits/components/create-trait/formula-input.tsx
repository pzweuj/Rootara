"use client"

import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/language-context"

interface FormulaInputProps {
  formula: string
  onChange: (formula: string) => void
}

export function FormulaInput({ formula, onChange }: FormulaInputProps) {
  const { language } = useLanguage()

  // 修改translations中的formulaDescription
  const translations = {
    en: {
      formula: "Calculation Formula",
      formulaDescription:
        "Define how to calculate the score. Examples: SCORE(rs12913832:GG=10,GA=5,AA=0; rs1800407:CC=5,CT=3,TT=0) or IF(rs12913832=GG, 10, 0) or IF(rs12913832=GG, true, false) for boolean results",
      resultCalculated: "Result will be automatically calculated based on formula and thresholds",
    },
    "zh-CN": {
      formula: "计算公式",
      formulaDescription:
        "定义如何计算分数。例如：SCORE(rs12913832:GG=10,GA=5,AA=0; rs1800407:CC=5,CT=3,TT=0) 或 IF(rs12913832=GG, 10, 0) 或 IF(rs12913832=GG, true, false) 用于布尔值结果",
      resultCalculated: "结果将根据公式和阈值自动计算",
    },
  }

  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  return (
    <div className="space-y-2 w-full overflow-hidden">
      <Label htmlFor="formula">{t("formula")}</Label>
      <Textarea
        id="formula"
        placeholder="SCORE(rs12913832:GG=10,GA=5,AA=0; rs1800407:CC=5,CT=3,TT=0)"
        value={formula}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[60px] sm:min-h-[80px] resize-none w-full"
      />
      <p className="text-xs text-muted-foreground break-words">
        {t("formulaDescription").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
      </p>
      <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
        <p className="text-xs text-yellow-800 dark:text-yellow-200 break-words">{t("resultCalculated")}</p>
      </div>
    </div>
  )
}
