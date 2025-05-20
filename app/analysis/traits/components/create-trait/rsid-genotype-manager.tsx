"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { fetchGenotypeData } from "@/app/analysis/traits/utils/genotype-utils"

interface RsidGenotypeManagerProps {
  rsids: string[]
  referenceGenotypes: string[]
  yourGenotypes: string[]
  onChange: (rsids: string[], referenceGenotypes: string[], yourGenotypes: string[]) => void
}

export function RsidGenotypeManager({ rsids, referenceGenotypes, yourGenotypes, onChange }: RsidGenotypeManagerProps) {
  const { language } = useLanguage()
  const [rsidInput, setRsidInput] = useState("")
  const [referenceGenotypeInput, setReferenceGenotypeInput] = useState("")
  const [yourGenotypeInput, setYourGenotypeInput] = useState("")

  const translations = {
    en: {
      rsidsAndGenotypes: "RSIDs and Genotypes",
      rsid: "RSID",
      referenceGenotype: "Reference Genotype",
      yourGenotype: "Your Genotype",
      rsidPlaceholder: "e.g., rs12913832",
      add: "Add",
      remove: "Remove",
    },
    "zh-CN": {
      rsidsAndGenotypes: "RSID和基因型",
      rsid: "RSID",
      referenceGenotype: "参考基因型",
      yourGenotype: "您的基因型",
      rsidPlaceholder: "例如：rs12913832",
      add: "添加",
      remove: "移除",
    },
  }

  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  const addRsidGenotype = () => {
    if (!rsidInput) return

    // 即使基因型是"--"也允许添加
    const refGenotype = referenceGenotypeInput || "--"
    const userGenotype = yourGenotypeInput || "--"

    const updatedRsids = [...rsids, rsidInput]
    const updatedReferenceGenotypes = [...referenceGenotypes, refGenotype]
    const updatedYourGenotypes = [...yourGenotypes, userGenotype]

    onChange(updatedRsids, updatedReferenceGenotypes, updatedYourGenotypes)

    // 重置输入
    setRsidInput("")
    setReferenceGenotypeInput("")
    setYourGenotypeInput("")
  }

  const removeRsidGenotype = (index: number) => {
    const updatedRsids = [...rsids]
    const updatedReferenceGenotypes = [...referenceGenotypes]
    const updatedYourGenotypes = [...yourGenotypes]

    updatedRsids.splice(index, 1)
    updatedReferenceGenotypes.splice(index, 1)
    updatedYourGenotypes.splice(index, 1)

    onChange(updatedRsids, updatedReferenceGenotypes, updatedYourGenotypes)
  }

  return (
    <div className="space-y-2">
      <Label>{t("rsidsAndGenotypes")}</Label>
      <div className="grid grid-cols-1 gap-2">
        <div className="flex gap-2">
          <Input
            placeholder={t("rsidPlaceholder")}
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
            {t("add")}
          </Button>
        </div>

        {/* 显示当前选择的RSID的基因型信息 */}
        {rsidInput && (
          <div className="grid grid-cols-2 gap-2 p-2 bg-secondary/30 rounded-md">
            <div className="space-y-1">
              <Label className="text-xs">{t("referenceGenotype")}</Label>
              <div className="text-sm font-mono">{referenceGenotypeInput || "--"}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("yourGenotype")}</Label>
              <div className="text-sm font-mono">{yourGenotypeInput || "--"}</div>
            </div>
          </div>
        )}
      </div>

      {/* Display added RSIDs and genotypes */}
      {rsids.length > 0 && (
        <div className="mt-2 border rounded-md p-2">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 font-medium text-sm mb-1">
            <div>{t("rsid")}</div>
            <div>{t("referenceGenotype")}</div>
            <div>{t("yourGenotype")}</div>
            <div></div>
          </div>
          {rsids.map((rsid, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-sm items-center">
              <div>{rsid}</div>
              <div>{referenceGenotypes[index] || "--"}</div>
              <div>{yourGenotypes[index] || "--"}</div>
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
  )
}
