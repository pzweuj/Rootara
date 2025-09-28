"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { toast } from "sonner"
import { TraitBasicInfo } from "./create-trait/trait-basic-info"
import { RsidGenotypeManager } from "./create-trait/rsid-genotype-manager"
import { FormulaInput } from "./create-trait/formula-input"
import { ScoreThresholdManager } from "./create-trait/score-threshold-manager"
import { IconSelector } from "./create-trait/icon-selector"
import type { Trait } from "@/types/trait"

interface CreateTraitDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCreateTrait: (trait: Trait) => void
}

export function CreateTraitDialog({
  isOpen,
  onOpenChange,
  onCreateTrait,
}: CreateTraitDialogProps) {
  const { language } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [newTrait, setNewTrait] = useState<Partial<Trait>>({
    name: {
      en: "",
      "zh-CN": "",
      default: "",
    },
    result: {
      en: "",
      "zh-CN": "",
      default: "",
    },
    description: {
      en: "",
      "zh-CN": "",
      default: "",
    },
    icon: "AlertCircle",
    confidence: "medium",
    category: "appearance",
    rsids: [],
    referenceGenotypes: [],
    yourGenotypes: [],
    formula: "",
    scoreThresholds: {},
    reference: [],
  })

  const translations = {
    en: {
      createTrait: "Create Trait",
      fillDetails: "Fill in the details to create a new trait.",
      cancel: "Cancel",
      create: "Create",
      pleaseAllFields: "Please fill in all required fields",
      pleaseAddRsid: "Please add at least one RSID",
      pleaseEnterFormula: "Please enter a calculation formula",
      pleaseAddThreshold: "Please add at least one score threshold",
      creatingTrait: "Creating trait...",
      errorCreatingTrait: "Error creating trait",
      references: "References", // Added translation key
      reference_note:
        "Enter comma-separated PubMed IDs (e.g., 12345678,98765432)", // Added translation key
    },
    "zh-CN": {
      createTrait: "创建特征",
      fillDetails: "填写详细信息以创建新特征。",
      cancel: "取消",
      create: "创建",
      pleaseAllFields: "请填写所有必填字段",
      pleaseAddRsid: "请至少添加一个RSID",
      pleaseEnterFormula: "请输入计算公式",
      pleaseAddThreshold: "请至少添加一个分数阈值",
      creatingTrait: "正在创建特征...",
      errorCreatingTrait: "创建特征时出错",
      references: "参考文献", // Added translation key
      reference_note: "以逗号分隔的PubMed ID（例如，12345678,98765432）", // Added translation key
    },
  }

  const t = (key: keyof typeof translations.en) =>
    translations[language as keyof typeof translations][key] || key

  const handleCreateTrait = async () => {
    // 验证逻辑只检查default字段
    if (!newTrait.name?.default || !newTrait.description?.default) {
      toast.error(t("pleaseAllFields"))
      return
    }

    if (!newTrait.rsids || newTrait.rsids.length === 0) {
      toast.error(t("pleaseAddRsid"))
      return
    }

    if (!newTrait.formula) {
      toast.error(t("pleaseEnterFormula"))
      return
    }

    if (
      !newTrait.scoreThresholds ||
      Object.keys(newTrait.scoreThresholds).length === 0
    ) {
      toast.error(t("pleaseAddThreshold"))
      return
    }

    // 构建特征数据对象
    const traitData = {
      name: newTrait.name,
      result: Object.keys(newTrait.scoreThresholds).reduce(
        (acc, key) => ({
          ...acc,
          [key]: {
            en: "",
            "zh-CN": "",
            default: key,
          },
        }),
        {}
      ),
      description: newTrait.description,
      icon: newTrait.icon,
      confidence: newTrait.confidence,
      category: newTrait.category,
      rsids: newTrait.rsids,
      formula: newTrait.formula,
      scoreThresholds: newTrait.scoreThresholds,
      reference: newTrait.reference, // 参考文献已经包含在这里
    }

    try {
      setIsLoading(true)
      toast.loading(t("creatingTrait"))

      // 调用API路由创建特征
      const response = await fetch("/api/traits/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ traitData: traitData }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()

      // 如果API返回了更新后的特征数据，使用它
      const finalTrait = result.trait || (traitData as Trait)

      // 通知父组件特征已创建
      onCreateTrait(finalTrait)
      toast.dismiss()
      toast.success(
        language === "en" ? "Trait created successfully" : "特征创建成功"
      )

      // 重置表单
      setNewTrait({
        name: { en: "", "zh-CN": "", default: "" },
        result: { en: "", "zh-CN": "", default: "" },
        description: { en: "", "zh-CN": "", default: "" },
        icon: "AlertCircle",
        confidence: "medium",
        category: "appearance",
        rsids: [],
        referenceGenotypes: [],
        yourGenotypes: [],
        formula: "",
        scoreThresholds: {},
        reference: [], // 重置参考文献
      })
    } catch (error) {
      console.error("Error creating trait:", error)
      toast.dismiss()
      toast.error(t("errorCreatingTrait"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[600px] max-h-[90vh] overflow-hidden p-4 sm:p-6">
        <div className="overflow-y-auto scrollbar-thin max-h-[calc(90vh-8rem)]">
          <DialogHeader className="pb-2 pr-6">
            <DialogTitle className="text-lg sm:text-xl">
              {t("createTrait")}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {t("fillDetails")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:gap-4 py-2 sm:py-4 overflow-hidden">
            <TraitBasicInfo trait={newTrait} onChange={setNewTrait} />

            <IconSelector
              selectedIcon={newTrait.icon || "AlertCircle"}
              onSelectIcon={(icon) => setNewTrait({ ...newTrait, icon })}
            />

            <RsidGenotypeManager
              rsids={newTrait.rsids || []}
              referenceGenotypes={newTrait.referenceGenotypes || []}
              yourGenotypes={newTrait.yourGenotypes || []}
              onChange={(rsids, referenceGenotypes, yourGenotypes) =>
                setNewTrait({
                  ...newTrait,
                  rsids,
                  referenceGenotypes,
                  yourGenotypes,
                })
              }
            />

            <FormulaInput
              formula={newTrait.formula || ""}
              onChange={(formula) => setNewTrait({ ...newTrait, formula })}
            />

            <ScoreThresholdManager
              thresholds={newTrait.scoreThresholds || {}}
              onChange={(scoreThresholds) =>
                setNewTrait({ ...newTrait, scoreThresholds })
              }
            />

            {/* References Input */}
            <div className="space-y-2">
              <label
                htmlFor="references"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t("references")} {/* Add translation key */}
              </label>
              <textarea
                id="references"
                value={newTrait.reference?.join(", ") || ""}
                onChange={(e) =>
                  setNewTrait({
                    ...newTrait,
                    reference: [e.target.value], // 将整个输入字符串作为数组的一个元素
                  })
                }
                className="flex min-h-[60px] sm:min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder={t("reference_note")} // Add translation key
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 pt-4 mt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreateTrait}
              disabled={isLoading}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {isLoading
                ? language === "en"
                  ? "Creating..."
                  : "创建中..."
                : t("create")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
