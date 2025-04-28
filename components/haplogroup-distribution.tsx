"use client"

import { useLanguage } from "@/contexts/language-context"

export function HaplogroupDistribution() {
  const { language } = useLanguage()

  const translations = {
    en: {
      maternalLineage: "Maternal Lineage (mtDNA)",
      paternalLineage: "Paternal Lineage (Y-DNA)",
    },
    "zh-CN": {
      maternalLineage: "母系遗传 (mtDNA)",
      paternalLineage: "父系遗传 (Y-DNA)",
    },
  }

  const t = (key) => {
    return translations[language][key] || key
  }

  // 样本数据
  const yDnaHaplogroup = "R1b"
  const mtDnaHaplogroup = "H"

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 父系谱系 Y-DNA - 蓝色卡片 */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{t("paternalLineage")}</h3>
        <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{yDnaHaplogroup}</p>
      </div>

      {/* 母系谱系 mtDNA - 红色卡片 */}
      <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800 flex flex-col items-center justify-center">
        <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">{t("maternalLineage")}</h3>
        <p className="text-3xl font-bold text-red-700 dark:text-red-300">{mtDnaHaplogroup}</p>
      </div>
    </div>
  )
}
