"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

interface ScoreThresholdManagerProps {
  thresholds: Record<string, number>
  onChange: (thresholds: Record<string, number>) => void
}

export function ScoreThresholdManager({ thresholds, onChange }: ScoreThresholdManagerProps) {
  const { language } = useLanguage()
  const [thresholdName, setThresholdName] = useState("")
  const [thresholdValue, setThresholdValue] = useState("")

  const translations = {
    en: {
      scoreThresholds: "Score Thresholds",
      thresholdName: "Result Name",
      thresholdValue: "Minimum Score",
      thresholdNamePlaceholder: "e.g., Brown",
      thresholdValuePlaceholder: "e.g., 12",
      thresholdsDescription: "Define the score thresholds for different results (higher scores are checked first)",
      add: "Add",
      result: "Result",
    },
    "zh-CN": {
      scoreThresholds: "分数阈值",
      thresholdName: "结果名称",
      thresholdValue: "最小分数",
      thresholdNamePlaceholder: "例如：棕色",
      thresholdValuePlaceholder: "例如：12",
      thresholdsDescription: "定义不同结果的分数阈值（先检查较高的分数）",
      add: "添加",
      result: "结果",
    },
  }

  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  const addScoreThreshold = () => {
    if (!thresholdName || !thresholdValue) return

    const updatedThresholds = { ...thresholds }
    updatedThresholds[thresholdName] = Number.parseInt(thresholdValue, 10)

    onChange(updatedThresholds)

    setThresholdName("")
    setThresholdValue("")
  }

  const removeScoreThreshold = (key: string) => {
    const updatedThresholds = { ...thresholds }
    delete updatedThresholds[key]

    onChange(updatedThresholds)
  }

  return (
    <div className="space-y-2">
      <Label>{t("scoreThresholds")}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={t("thresholdNamePlaceholder")}
          value={thresholdName}
          onChange={(e) => setThresholdName(e.target.value)}
        />
        <Input
          placeholder={t("thresholdValuePlaceholder")}
          type="number"
          value={thresholdValue}
          onChange={(e) => setThresholdValue(e.target.value)}
        />
        <Button type="button" onClick={addScoreThreshold} disabled={!thresholdName || !thresholdValue} size="sm">
          {t("add")}
        </Button>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground grid grid-cols-2 w-full">
          <span>{t("thresholdName")}</span>
          <span>{t("thresholdValue")}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("thresholdsDescription")}</p>

      {/* Display added score thresholds */}
      {Object.keys(thresholds).length > 0 && (
        <div className="mt-2 border rounded-md p-2">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 font-medium text-sm mb-1">
            <div>{t("result")}</div>
            <div>{t("thresholdValue")}</div>
            <div></div>
          </div>
          {Object.entries(thresholds).map(([key, value]) => (
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
  )
}
