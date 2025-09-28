"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useReport } from "@/contexts/report-context" // 导入报告上下文
import { fetchGenotypeData } from "@/app/analysis/traits/utils/genotype-utils"

interface RsidGenotypeManagerProps {
  rsids: string[]
  referenceGenotypes: string[]
  yourGenotypes: string[]
  onChange: (
    rsids: string[],
    referenceGenotypes: string[],
    yourGenotypes: string[]
  ) => void
}

export function RsidGenotypeManager({
  rsids,
  referenceGenotypes,
  yourGenotypes,
  onChange,
}: RsidGenotypeManagerProps) {
  const { language } = useLanguage()
  const { currentReportId } = useReport()
  const [rsidInput, setRsidInput] = useState("")
  const [referenceGenotypeInput, setReferenceGenotypeInput] = useState("")
  const [yourGenotypeInput, setYourGenotypeInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const translations = {
    en: {
      rsidsAndGenotypes: "Variant RSID",
      rsid: "RSID",
      referenceGenotype: "Reference Genotype",
      yourGenotype: "Your Genotype",
      rsidPlaceholder: "e.g., rs12913832",
      add: "Add",
      remove: "Remove",
      loading: "Loading...",
    },
    "zh-CN": {
      rsidsAndGenotypes: "位点RSID",
      rsid: "RSID",
      referenceGenotype: "参考基因型",
      yourGenotype: "您的基因型",
      rsidPlaceholder: "例如：rs12913832",
      add: "添加",
      remove: "移除",
      loading: "加载中...",
    },
  }

  const t = (key: keyof typeof translations.en) =>
    translations[language as keyof typeof translations][key] || key

  // 获取基因型数据的函数
  const getGenotypeData = async (rsid: string) => {
    if (!rsid.match(/^rs\d{1,}$/))
      return { success: false, reference: "--", user: "--" }

    setIsLoading(true)
    try {
      const genotypeData = await fetchGenotypeData(rsid, currentReportId)
      setReferenceGenotypeInput(genotypeData.reference)
      setYourGenotypeInput(genotypeData.user)
      setIsLoading(false)
      return {
        success: true,
        reference: genotypeData.reference,
        user: genotypeData.user,
      }
    } catch (error) {
      console.error("Error fetching genotype data:", error)
      setReferenceGenotypeInput("--")
      setYourGenotypeInput("--")
      setIsLoading(false)
      return { success: false, reference: "--", user: "--" }
    }
  }

  const addRsidGenotype = async () => {
    if (!rsidInput) return

    // 获取基因型数据
    const result = await getGenotypeData(rsidInput)

    // 使用从getGenotypeData返回的值，而不是状态变量
    const refGenotype = result.reference
    const userGenotype = result.user

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
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder={t("rsidPlaceholder")}
            value={rsidInput}
            onChange={(e) => setRsidInput(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={addRsidGenotype}
            disabled={!rsidInput || isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? t("loading") : t("add")}
          </Button>
        </div>

        {/* 显示当前选择的RSID的基因型信息 - 仅在添加后显示 */}
        {rsids.length > 0 && (
          <div className="mt-2 border rounded-md p-2 overflow-x-auto">
            {/* 桌面端表格视图 */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 font-medium text-sm mb-1 border-b pb-1">
                <div className="px-2 text-center border-r">{t("rsid")}</div>
                <div className="px-2 text-center border-r">
                  {t("referenceGenotype")}
                </div>
                <div className="px-2 text-center border-r">
                  {t("yourGenotype")}
                </div>
                <div className="px-2 text-center">{t("remove")}</div>
              </div>
              {rsids.map((rsid, index) => (
                <div
                  key={index}
                  className={`grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-sm items-center py-1 ${index < rsids.length - 1 ? "border-b" : ""}`}
                >
                  <div className="px-2 text-center border-r">{rsid}</div>
                  <div className="px-2 text-center border-r">
                    {referenceGenotypes[index] || "--"}
                  </div>
                  <div className="px-2 text-center border-r">
                    {yourGenotypes[index] || "--"}
                  </div>
                  <div className="px-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500"
                      onClick={() => removeRsidGenotype(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* 移动端卡片视图 */}
            <div className="sm:hidden space-y-2">
              {rsids.map((rsid, index) => (
                <div key={index} className="border rounded-md p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{rsid}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500"
                      onClick={() => removeRsidGenotype(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">
                        {t("referenceGenotype")}:
                      </span>
                      <span className="ml-1">
                        {referenceGenotypes[index] || "--"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t("yourGenotype")}:
                      </span>
                      <span className="ml-1">
                        {yourGenotypes[index] || "--"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
