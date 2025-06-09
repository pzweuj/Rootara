"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ScoreThresholdManagerProps {
  thresholds: Record<string, number | boolean>
  onChange: (thresholds: Record<string, number | boolean>) => void
}

export function ScoreThresholdManager({ thresholds, onChange }: ScoreThresholdManagerProps) {
  const { language } = useLanguage()
  const [thresholdName, setThresholdName] = useState("")
  const [thresholdValue, setThresholdValue] = useState("")
  const [thresholdType, setThresholdType] = useState<"number" | "boolean">("number")

  const translations = {
    en: {
      scoreThresholds: "Score Thresholds or Boolean Values",
      thresholdName: "Result Name",
      thresholdValue: "Value",
      thresholdType: "Type",
      thresholdNamePlaceholder: "e.g., Brown",
      thresholdValuePlaceholder: "e.g., 12",
      thresholdsDescription: "Define the score thresholds or boolean values for different results (higher scores are checked first)",
      delete: "Delete",
      add: "Add",
      result: "Result",
      number: "Number",
      boolean: "Boolean",
      true: "True",
      false: "False",
    },
    "zh-CN": {
      scoreThresholds: "分数阈值或布尔值",
      thresholdName: "结果名称",
      thresholdValue: "值",
      thresholdType: "类型",
      thresholdNamePlaceholder: "例如：棕色",
      thresholdValuePlaceholder: "例如：12",
      thresholdsDescription: "定义不同结果的分数阈值或布尔值（先检查较高的分数）",
      delete: "移除",
      add: "添加",
      result: "结果",
      number: "数字",
      boolean: "布尔值",
      true: "真",
      false: "假",
    },
  }

  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  const addScoreThreshold = () => {
    if (!thresholdName || !thresholdValue) return

    const updatedThresholds = { ...thresholds }
    
    if (thresholdType === "number") {
      updatedThresholds[thresholdName] = Number.parseInt(thresholdValue, 10)
    } else {
      updatedThresholds[thresholdName] = thresholdValue === "true"
    }

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
    <div className="space-y-2 w-full overflow-hidden">
      <Label>{t("scoreThresholds")}</Label>
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <Input
          placeholder={t("thresholdNamePlaceholder")}
          value={thresholdName}
          onChange={(e) => setThresholdName(e.target.value)}
          className="flex-1 min-w-0"
        />
        <Select
          value={thresholdType}
          onValueChange={(value) => {
            setThresholdType(value as "number" | "boolean")
            setThresholdValue(value === "boolean" ? "true" : "")
          }}
        >
          <SelectTrigger className="w-full sm:w-[120px]">
            <SelectValue placeholder={t("thresholdType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">{t("number")}</SelectItem>
            <SelectItem value="boolean">{t("boolean")}</SelectItem>
          </SelectContent>
        </Select>
        {thresholdType === "number" ? (
          <Input
            placeholder={t("thresholdValuePlaceholder")}
            type="number"
            value={thresholdValue}
            onChange={(e) => setThresholdValue(e.target.value)}
            className="flex-1 sm:flex-none sm:w-[120px] min-w-0"
          />
        ) : (
          <Select
            value={thresholdValue}
            onValueChange={(value) => setThresholdValue(value)}
          >
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue placeholder="Value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t("true")}</SelectItem>
              <SelectItem value="false">{t("false")}</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button
          type="button"
          onClick={addScoreThreshold}
          disabled={!thresholdName || !thresholdValue}
          size="sm"
          className="w-full sm:w-auto"
        >
          {t("add")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground break-words">{t("thresholdsDescription")}</p>

      {/* Display added score thresholds */}
      {Object.keys(thresholds).length > 0 && (
        <div className="mt-2 border rounded-md p-2 overflow-x-auto w-full">
          {/* 桌面端表格视图 */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 font-medium text-sm mb-1 border-b pb-1">
              <div className="px-2 text-center border-r">{t("result")}</div>
              <div className="px-2 text-center border-r">{t("thresholdValue")}</div>
              <div className="px-2 text-center">{t("delete")}</div>
            </div>
            {Object.entries(thresholds).map(([key, value], index) => (
              <div key={key} className={`grid grid-cols-[1fr_1fr_auto] gap-2 text-sm items-center py-1 ${index < Object.keys(thresholds).length - 1 ? 'border-b' : ''}`}>
                <div className="px-2 text-center border-r truncate">{key}</div>
                <div className="px-2 text-center border-r">{typeof value === "boolean" ? (value ? t("true") : t("false")) : value}</div>
                <div className="px-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500"
                    onClick={() => removeScoreThreshold(key)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* 移动端卡片视图 */}
          <div className="sm:hidden space-y-2">
            {Object.entries(thresholds).map(([key, value]) => (
              <div key={key} className="border rounded-md p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm truncate">{key}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 flex-shrink-0"
                    onClick={() => removeScoreThreshold(key)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">{t("thresholdValue")}:</span>
                  <span className="ml-1">{typeof value === "boolean" ? (value ? t("true") : t("false")) : value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
