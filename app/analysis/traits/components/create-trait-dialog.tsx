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
import { determineResult } from "@/app/analysis/traits/utils/trait-calculations"
import { TraitBasicInfo } from "./create-trait/trait-basic-info"
import { RsidGenotypeManager } from "./create-trait/rsid-genotype-manager"
import { FormulaInput } from "./create-trait/formula-input"
import { ScoreThresholdManager } from "./create-trait/score-threshold-manager"
import { IconSelector } from "./create-trait/icon-selector"
import type { Trait } from "@/types/trait"

// 删除API基础URL和API密钥的定义

interface CreateTraitDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCreateTrait: (trait: Trait) => void
}

export function CreateTraitDialog({ isOpen, onOpenChange, onCreateTrait }: CreateTraitDialogProps) {
  const { language } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [newTrait, setNewTrait] = useState<Partial<Trait>>({
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
    },
  }

  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  const handleCreateTrait = async () => {
    if (!newTrait.name || !newTrait.description) {
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

    if (!newTrait.scoreThresholds || Object.keys(newTrait.scoreThresholds).length === 0) {
      toast.error(t("pleaseAddThreshold"))
      return
    }

    // 根据公式和阈值自动计算结果
    const calculatedResult = determineResult(newTrait)

    // 创建特征数据
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

    try {
      setIsLoading(true)
      toast.loading(t("creatingTrait"))
      
      // 调用新的API路由创建特征
      const response = await fetch('/api/traits/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trait: createdTrait })
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const result = await response.json()
      
      // 如果API返回了更新后的特征数据，使用它
      const finalTrait = result.trait || createdTrait
      
      // 通知父组件特征已创建
      onCreateTrait(finalTrait)
      toast.dismiss()
      toast.success(language === 'en' ? 'Trait created successfully' : '特征创建成功')
      
      // 重置表单
      setNewTrait({
        name: { en: "", "zh-CN": "", default: ""  },
        result: { en: "", "zh-CN": "", default: ""  },
        description: { en: "", "zh-CN": "", default: ""  },
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
    } catch (error) {
      console.error('Error creating trait:', error)
      toast.dismiss()
      toast.error(t("errorCreatingTrait"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("createTrait")}</DialogTitle>
          <DialogDescription>{t("fillDetails")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
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
              setNewTrait({ ...newTrait, rsids, referenceGenotypes, yourGenotypes })
            }
          />

          <FormulaInput
            formula={newTrait.formula || ""}
            onChange={(formula) => setNewTrait({ ...newTrait, formula })}
          />

          <ScoreThresholdManager
            thresholds={newTrait.scoreThresholds || {}}
            onChange={(scoreThresholds) => setNewTrait({ ...newTrait, scoreThresholds })}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t("cancel")}
          </Button>
          <Button onClick={handleCreateTrait} disabled={isLoading}>
            {isLoading ? (language === 'en' ? 'Creating...' : '创建中...') : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
